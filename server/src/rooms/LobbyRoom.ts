// Sala de espera: código de 4 letras, de 1 a 5 jugadores, cada uno con un alien distinto.
// El anfitrión empieza la partida cuando todos están listos (en solitario, en cuanto elige alien).
import { Room, matchMaker, type Client } from "@colyseus/core";
import { LOBBY_BOUNDS, MAX_JUGADORES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isAlienKind, type LobbyMoveMsg, type PickMsg, type ReadyMsg } from "@dawg/shared";
import { randomUUID } from "node:crypto";
import { LobbyPlayer, LobbyState } from "../schema/LobbyState";
import { jugadoresNecesarios } from "../config";

export class LobbyRoom extends Room<LobbyState> {
  override maxClients = MAX_JUGADORES;
  override state = new LobbyState();
  private countdown?: { clear(): void };

  override async onCreate(options: { solo?: boolean }): Promise<void> {
    this.roomId = await this.codigoUnico();
    this.state.codigo = this.roomId;
    // Una partida en solitario nunca espera a nadie más.
    this.state.necesarios = options?.solo ? 1 : jugadoresNecesarios();
    this.maxClients = options?.solo ? 1 : MAX_JUGADORES;
    await this.setPrivate(true);

    this.onMessage("elegir", (client, msg: PickMsg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || this.state.estado !== "esperando" || !isAlienKind(msg?.alien)) return;
      let ocupado = false;
      this.state.jugadores.forEach((o, id) => {
        if (id !== client.sessionId && o.alien === msg.alien) ocupado = true;
      });
      if (ocupado) return;
      p.alien = msg.alien;
      p.listo = p.anfitrion;
    });

    this.onMessage("listo", (client, msg: ReadyMsg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || this.state.estado !== "esperando") return;
      p.listo = Boolean(msg?.ready) && p.alien !== "";
    });

    this.onMessage("empezar", (client) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || !p.anfitrion || this.state.estado !== "esperando") return;
      if (p.alien) p.listo = true;
      this.revisar();
    });

    this.onMessage("skin", (client) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || !p.alien || this.state.estado !== "esperando") return;
      p.skin = p.skin === 0 ? 1 : 0;
    });

    this.onMessage("mover", (client, msg: LobbyMoveMsg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || !p.alien || this.state.estado !== "esperando") return;
      if (!Number.isFinite(msg?.x) || !Number.isFinite(msg?.y)) return;
      p.x = Math.min(LOBBY_BOUNDS.maxX, Math.max(LOBBY_BOUNDS.minX, msg.x));
      p.y = Math.min(LOBBY_BOUNDS.maxY, Math.max(LOBBY_BOUNDS.minY, msg.y));
    });

    this.onMessage("nombre", (client, nombre: string) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (p) p.nombre = limpiarNombre(nombre);
    });
  }

  override onJoin(client: Client, options: { nombre?: string }): void {
    const p = new LobbyPlayer();
    p.nombre = limpiarNombre(options?.nombre);
    p.anfitrion = this.state.jugadores.size === 0;
    p.x = 0.2 + 0.15 * this.state.jugadores.size;
    p.y = 0.7;
    this.state.jugadores.set(client.sessionId, p);
  }

  override onLeave(client: Client): void {
    const p = this.state.jugadores.get(client.sessionId);
    this.state.jugadores.delete(client.sessionId);
    if (this.state.estado === "empezando" && this.countdown) {
      this.countdown.clear();
      this.countdown = undefined;
      this.state.estado = "esperando";
      this.state.cuenta = 0;
      this.unlock();
    }
    if (p?.anfitrion) {
      const next = [...this.state.jugadores.values()][0];
      if (next) next.anfitrion = true;
    }
  }

  private revisar(): void {
    const lista = [...this.state.jugadores.values()];
    const aliens = new Set(lista.map((p) => p.alien));
    const listos = lista.length >= this.state.necesarios && lista.every((p) => p.listo && p.alien) && aliens.size === lista.length;
    if (!listos || this.state.estado !== "esperando") {
      this.broadcast("error", "Para empezar, cada jugador debe elegir un alien distinto y marcar «Listo».");
      return;
    }
    this.state.estado = "empezando";
    this.state.cuenta = 3;
    this.lock();
    const tick = this.clock.setInterval(() => {
      this.state.cuenta--;
      if (this.state.cuenta <= 0) {
        tick.clear();
        this.countdown = undefined;
        void this.empezar();
      }
    }, 1000);
    this.countdown = tick;
  }

  private async empezar(): Promise<void> {
    const roster = [...this.state.jugadores.entries()].map(([id, p]) => ({ id, nombre: p.nombre, alien: p.alien, skin: p.skin, token: randomUUID() }));
    try {
      const sala = await matchMaker.createRoom("partida", { roster: roster.map(({ nombre, alien, skin, token }) => ({ nombre, alien, skin, token })), codigo: this.state.codigo });
      for (const r of roster) {
        const client = this.clients.find((c) => c.sessionId === r.id);
        if (!client) continue;
        const reserva = await matchMaker.reserveSeatFor(sala, { token: r.token });
        // Solo lo que el cliente necesita (el objeto de sala del servidor no se puede serializar).
        client.send("empezar", {
          sessionId: reserva.sessionId,
          room: { roomId: sala.roomId, processId: sala.processId, name: sala.name, publicAddress: sala.publicAddress },
        });
      }
    } catch (e) {
      console.error("No se pudo crear la partida", e);
      this.state.estado = "esperando";
      this.state.cuenta = 0;
      this.unlock();
      this.broadcast("error", "No se pudo crear la partida. Inténtalo otra vez.");
    }
  }

  private async codigoUnico(): Promise<string> {
    for (let i = 0; i < 50; i++) {
      let code = "";
      for (let k = 0; k < ROOM_CODE_LENGTH; k++) code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      const existing = await matchMaker.query({ roomId: code });
      if (!existing.length) return code;
    }
    throw new Error("Sin códigos libres");
  }
}

export function limpiarNombre(n: unknown): string {
  const s = String(n ?? "").replace(/[<>]/g, "").trim().slice(0, 14);
  return s || "Alien";
}
