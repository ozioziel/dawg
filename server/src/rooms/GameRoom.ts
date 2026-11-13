// Partida: el mundo completo del Área 51 para 1 a 5 jugadores. Solo entran los reservados desde el lobby.
import { Room, type Client } from "@colyseus/core";
import {
  MAX_JUGADORES,
  PATCH_RATE,
  PING_TYPES,
  TICK_RATE,
  isAlienKind,
  type AbilityMsg,
  type ChatMsg,
  type InputMsg,
  type InteractMsg,
  type MejoraMsg,
  type MinigameMsg,
  type PingMsg,
  type ReiniciarMsg,
  type UltiMsg,
} from "@dawg/shared";
import { GameState } from "../schema/GameState";
import { Partida } from "../game/Partida";
import { jugadoresNecesarios } from "../config";
import { limpiarNombre } from "./LobbyRoom";

interface RosterEntry {
  nombre: string;
  alien: string;
  skin?: number;
  token: string;
}

export class GameRoom extends Room<GameState> {
  override maxClients = MAX_JUGADORES;
  override state = new GameState();
  partida!: Partida;
  private roster: RosterEntry[] = [];
  private usados = new Set<string>();
  /** Jugadores que ya terminaron de cargar el juego. */
  private cargados = new Set<string>();
  private chatAt = new Map<string, number>();

  override onCreate(options: { roster: RosterEntry[] }): void {
    // Sin alien repetido y como mucho 5.
    const vistos = new Set<string>();
    this.roster = (Array.isArray(options?.roster) ? options.roster : []).filter((r) => isAlienKind(r.alien) && !vistos.has(r.alien) && vistos.add(r.alien)).slice(0, MAX_JUGADORES);
    this.maxClients = Math.max(1, this.roster.length);
    this.autoDispose = true;
    this.partida = new Partida(this.state, (type, msg, to) => {
      if (to) this.clients.find((c) => c.sessionId === to)?.send(type, msg);
      else this.broadcast(type, msg);
    });
    this.setPatchRate(1000 / PATCH_RATE);
    this.setSimulationInterval((ms) => {
      // Si no queda nadie conectado (p. ej. el jugador solitario recarga la página), la partida se congela.
      let alguien = false;
      this.state.jugadores.forEach((p) => p.conectado && (alguien = true));
      if (alguien || this.state.fase !== "jugando") this.partida.tick(Math.min(ms, 100) / 1000);
    }, 1000 / TICK_RATE);

    this.onMessage("input", (c, m: InputMsg) => this.partida.input(c.sessionId, m));
    this.onMessage("habilidad", (c, m: AbilityMsg) => this.partida.usarHabilidad(c.sessionId, m?.x, m?.y, m?.fase === "up" ? "up" : "down"));
    this.onMessage("apunta", (c, m: { x: number; y: number }) => {
      const d = this.partida.pdata.get(c.sessionId);
      if (d && Number.isFinite(m?.x) && Number.isFinite(m?.y)) {
        d.aimX = Number(m.x);
        d.aimY = Number(m.y);
      }
    });
    this.onMessage("ulti", (c, m: UltiMsg) => this.partida.usarUlti(c.sessionId, m?.x, m?.y));
    this.onMessage("interactuar", (c, m: InteractMsg) => this.partida.setInteract(c.sessionId, Boolean(m?.down)));
    this.onMessage("cambiar", (c) => this.partida.cambiarForma(c.sessionId));
    this.onMessage("dar", (c) => this.partida.darAlma(c.sessionId));
    this.onMessage("mejora", (c, m: MejoraMsg) => this.partida.elegirMejora(c.sessionId, m?.i));
    this.onMessage("mg", (c, m: MinigameMsg) => this.partida.sectores.mensajeMinijuego(c.sessionId, m));
    this.onMessage("reiniciar", (c, m: ReiniciarMsg) => this.partida.votarReinicio(c.sessionId, m?.modo === "sector" ? "sector" : "todo"));
    this.onMessage("cargado", (c) => {
      this.cargados.add(c.sessionId);
      // Si la partida empezó sin él, deja de ser intocable con un margen de 3 s.
      const d = this.partida.pdata.get(c.sessionId);
      if (d && d.intocable > 1000) d.intocable = 3;
      this.intentarEmpezar();
    });
    this.onMessage("ping", (c, m: PingMsg) => {
      const p = this.state.jugadores.get(c.sessionId);
      if (!p || !PING_TYPES.includes(m?.tipo) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      if (this.spam(c.sessionId, 0.4)) return;
      this.broadcast("ping", { de: c.sessionId, tipo: m.tipo, x: Math.round(m.x), y: Math.round(m.y) });
    });
    this.onMessage("chat", (c, m: ChatMsg) => {
      const p = this.state.jugadores.get(c.sessionId);
      const texto = String(m?.texto ?? "").replace(/[<>]/g, "").trim().slice(0, 140);
      if (!p || !texto || this.spam(c.sessionId, 0.5)) return;
      this.broadcast("chat", { de: c.sessionId, nombre: p.nombre, alien: p.kind, texto });
    });

    // Atajos para pruebas locales (nunca activos en el VPS): PRUEBAS=1
    if (process.env.PRUEBAS === "1") {
      this.onMessage("dbg", (c, m: { tp?: [number, number]; flag?: string; morir?: boolean; alma?: string; vida?: boolean; ulti?: boolean; resolver?: string; sector?: number }) => {
        const p = this.state.jugadores.get(c.sessionId);
        if (!p) return;
        if (m.tp) {
          p.x = Number(m.tp[0]);
          p.y = Number(m.tp[1]);
        }
        if (m.flag) this.partida.flags.add(m.flag);
        if (m.morir) this.partida.killPlayer(c.sessionId, p);
        if (m.alma && isAlienKind(m.alma) && !p.almas.includes(m.alma)) p.almas.push(m.alma);
        if (m.vida) p.hp = p.maxHp;
        if (m.ulti) p.ulti = 1;
        if (m.resolver) this.partida.sectores.retos.get(m.resolver)?.resolver();
        if (m.sector) this.partida.reset("todo"), void 0;
      });
    }

    // Si en 2 minutos no llegó nadie, se cierra; si llegaron algunos, se empieza con ellos.
    this.clock.setTimeout(() => {
      if (this.state.fase !== "esperando") return;
      if (this.state.jugadores.size === 0) this.disconnect();
      else this.intentarEmpezar(true);
    }, 120_000);
  }

  private spam(id: string, gap: number): boolean {
    const now = this.clock.currentTime / 1000;
    const last = this.chatAt.get(id) ?? -99;
    if (now - last < gap) return true;
    this.chatAt.set(id, now);
    return false;
  }

  override onAuth(_client: Client, options: { token?: string }): RosterEntry {
    const r = this.roster.find((e) => e.token === options?.token);
    if (!r || this.usados.has(r.token)) throw new Error("No tienes plaza en esta partida.");
    this.usados.add(r.token);
    return r;
  }

  override onJoin(client: Client, _options: unknown, auth: RosterEntry): void {
    const alien = isAlienKind(auth.alien) ? auth.alien : "cambiaformas";
    this.partida.addPlayer(client.sessionId, limpiarNombre(auth.nombre), alien, auth.skin === 1 ? 1 : 0);
    this.state.objetivo = "Esperando a que todos terminen de cargar…";
    const necesarios = Math.min(jugadoresNecesarios(), this.roster.length);
    if (this.state.jugadores.size >= Math.max(necesarios, this.roster.length)) {
      this.lock();
      // Por si alguien no avisa que cargó, se empieza igual tras 45 s.
      this.clock.setTimeout(() => this.intentarEmpezar(true), 45_000);
    }
  }

  private intentarEmpezar(forzar = false): void {
    if (this.state.fase !== "esperando") return;
    if (this.state.jugadores.size < this.roster.length && !forzar) return;
    let todos = true;
    this.state.jugadores.forEach((_p, id) => {
      if (!this.cargados.has(id)) todos = false;
    });
    if (!todos && !forzar) return;
    // Nunca se empieza sin que al menos uno haya terminado de cargar (móviles y redes lentas).
    if (this.cargados.size === 0) {
      this.clock.setTimeout(() => this.intentarEmpezar(true), 10_000);
      return;
    }
    this.partida.start();
    // Quien sigue cargando no puede recibir daño ni ser objetivo hasta que avise.
    this.state.jugadores.forEach((_p, id) => {
      const d = this.partida.pdata.get(id);
      if (d && !this.cargados.has(id)) d.intocable = 1e6;
    });
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.jugadores.get(client.sessionId);
    if (!p) return;
    p.conectado = false;
    if (!consented && this.state.fase === "jugando") {
      // Mientras está desconectado (y hasta que vuelva a cargar el juego) nadie puede herirlo.
      const d = this.partida.pdata.get(client.sessionId);
      if (d) d.intocable = 1e6;
      this.cargados.delete(client.sessionId);
      try {
        this.partida.aviso(`${p.nombre} perdió la conexión… esperando 60 s.`, "peligro");
        await this.allowReconnection(client, 60);
        p.conectado = true;
        // Si el cliente no avisa de que cargó, la protección acaba igualmente a los 45 s.
        this.clock.setTimeout(() => {
          const dd = this.partida.pdata.get(client.sessionId);
          if (dd && dd.intocable > 1000) dd.intocable = 3;
        }, 45_000);
        this.partida.aviso(`${p.nombre} volvió.`, "exito");
        return;
      } catch {
        // no volvió a tiempo
      }
    }
    this.partida.playerLeft(client.sessionId);
  }
}
