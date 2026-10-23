// Partida del Área 1. Solo entran los jugadores reservados desde el lobby.
import { Room, type Client } from "@colyseus/core";
import {
  PATCH_RATE,
  PING_TYPES,
  TICK_RATE,
  isAlienKind,
  type AbilityMsg,
  type ChatMsg,
  type InputMsg,
  type InteractMsg,
  type MinigameMsg,
  type PingMsg,
} from "@dawg/shared";
import { GameState } from "../schema/GameState";
import { Partida } from "../game/Partida";
import { jugadoresNecesarios } from "../config";
import { limpiarNombre } from "./LobbyRoom";

interface RosterEntry {
  nombre: string;
  alien: string;
  token: string;
}

export class GameRoom extends Room<GameState> {
  override maxClients = 3;
  override state = new GameState();
  private partida!: Partida;
  private roster: RosterEntry[] = [];
  private usados = new Set<string>();
  /** Jugadores que ya terminaron de cargar el juego. */
  private cargados = new Set<string>();
  private chatAt = new Map<string, number>();

  override onCreate(options: { roster: RosterEntry[] }): void {
    this.roster = Array.isArray(options?.roster) ? options.roster.slice(0, 3) : [];
    this.maxClients = Math.max(1, this.roster.length);
    this.autoDispose = true;
    this.partida = new Partida(this.state, (type, msg, to) => {
      if (to) this.clients.find((c) => c.sessionId === to)?.send(type, msg);
      else this.broadcast(type, msg);
    });
    this.setPatchRate(1000 / PATCH_RATE);
    this.setSimulationInterval((ms) => this.partida.tick(Math.min(ms, 100) / 1000), 1000 / TICK_RATE);

    this.onMessage("input", (c, m: InputMsg) => this.partida.input(c.sessionId, m));
    this.onMessage("habilidad", (c, m: AbilityMsg) => this.partida.usarHabilidad(c.sessionId, m?.x, m?.y));
    this.onMessage("interactuar", (c, m: InteractMsg) => this.partida.setInteract(c.sessionId, Boolean(m?.down)));
    this.onMessage("cambiar", (c) => this.partida.cambiarHabilidad(c.sessionId));
    this.onMessage("dar", (c) => this.partida.darAlma(c.sessionId));
    this.onMessage("mg", (c, m: MinigameMsg) => this.partida.puzzles.message(c.sessionId, m));
    this.onMessage("reiniciar", (c) => this.partida.votarReinicio(c.sessionId));
    this.onMessage("cargado", (c) => {
      this.cargados.add(c.sessionId);
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
      this.onMessage("dbg", (c, m: { tp?: [number, number]; flag?: string; morir?: boolean; alma?: string; vida?: boolean }) => {
        const p = this.state.jugadores.get(c.sessionId);
        if (!p) return;
        if (m.tp) {
          p.x = Number(m.tp[0]);
          p.y = Number(m.tp[1]);
        }
        if (m.flag) this.partida.flags.add(m.flag);
        if (m.morir) this.partida.killPlayer(c.sessionId, p);
        if (m.alma && isAlienKind(m.alma)) p.almas.push(m.alma);
        if (m.vida) p.hp = p.maxHp;
      });
    }

    // Si en 2 minutos no llegaron todos, se cierra (la partida no arranca sin el equipo completo).
    this.clock.setTimeout(() => {
      if (this.state.fase === "esperando") this.disconnect();
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
    this.partida.addPlayer(client.sessionId, limpiarNombre(auth.nombre), alien);
    this.state.objetivo = "Esperando a que todos terminen de cargar…";
    const necesarios = Math.min(jugadoresNecesarios(), this.roster.length);
    if (this.state.jugadores.size >= necesarios) {
      this.lock();
      // Por si alguien no avisa que cargó, se empieza igual tras 45 s.
      this.clock.setTimeout(() => this.intentarEmpezar(true), 45_000);
    }
  }

  private intentarEmpezar(forzar = false): void {
    if (this.state.fase !== "esperando") return;
    const necesarios = Math.min(jugadoresNecesarios(), this.roster.length);
    if (this.state.jugadores.size < necesarios) return;
    let todos = true;
    this.state.jugadores.forEach((_p, id) => {
      if (!this.cargados.has(id)) todos = false;
    });
    if (todos || forzar) this.partida.start();
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const p = this.state.jugadores.get(client.sessionId);
    if (!p) return;
    p.conectado = false;
    if (!consented && this.state.fase === "jugando") {
      try {
        this.partida.aviso(`${p.nombre} perdió la conexión… esperando 60 s.`, "peligro");
        await this.allowReconnection(client, 60);
        p.conectado = true;
        this.partida.aviso(`${p.nombre} volvió.`, "exito");
        return;
      } catch {
        // no volvió a tiempo
      }
    }
    this.partida.playerLeft(client.sessionId);
  }
}
