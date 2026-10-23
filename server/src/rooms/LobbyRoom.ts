// Sala de espera: código de 4 letras, cada jugador elige un alien distinto y marca "listo".
// Con todos listos se crea la partida y se reserva un asiento para cada uno.
import { Room, matchMaker, type Client } from "@colyseus/core";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isAlienKind, type PickMsg, type ReadyMsg } from "@dawg/shared";
import { randomUUID } from "node:crypto";
import { LobbyPlayer, LobbyState } from "../schema/LobbyState";
import { jugadoresNecesarios } from "../config";

export class LobbyRoom extends Room<LobbyState> {
  override maxClients = 3;
  override state = new LobbyState();
  private countdown?: { clear(): void };

  override async onCreate(): Promise<void> {
    this.roomId = await this.codigoUnico();
    this.state.codigo = this.roomId;
    this.state.necesarios = jugadoresNecesarios();
    this.maxClients = Math.max(this.state.necesarios, 1);
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
      p.listo = false;
    });

    this.onMessage("listo", (client, msg: ReadyMsg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || this.state.estado !== "esperando") return;
      p.listo = Boolean(msg?.ready) && p.alien !== "";
      this.revisar();
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
    const listos = lista.length >= this.state.necesarios && lista.every((p) => p.listo && p.alien);
    if (!listos || this.state.estado !== "esperando") return;
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
    const roster = [...this.state.jugadores.entries()].map(([id, p]) => ({ id, nombre: p.nombre, alien: p.alien, token: randomUUID() }));
    try {
      const sala = await matchMaker.createRoom("partida", { roster: roster.map(({ nombre, alien, token }) => ({ nombre, alien, token })), codigo: this.state.codigo });
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
