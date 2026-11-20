import { Client, type Room } from "colyseus.js";
import { SERVER_URL } from "../config";
import type { GameStateS, LobbyStateS } from "./tipos";

export const cliente = new Client(SERVER_URL);

export type SalaJuego = Room<GameStateS>;
export type SalaLobby = Room<LobbyStateS>;

const CLAVE = "dawg:reconexion";

export function guardarReconexion(room: SalaJuego): void {
  try {
    sessionStorage.setItem(CLAVE, room.reconnectionToken);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function borrarReconexion(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Si se recargó la página en plena partida, intenta volver a ella. */
export async function intentarReconectar(): Promise<SalaJuego | null> {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(CLAVE);
  } catch {
    return null;
  }
  if (!token) return null;
  // El servidor tarda un momento en notar que la conexión anterior se cerró.
  for (let i = 0; i < 4; i++) {
    try {
      const room = await cliente.reconnect<GameStateS>(token);
      guardarReconexion(room);
      return room;
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  borrarReconexion();
  return null;
}

export function mensajeError(e: unknown): string {
  // Si el servidor está apagado, el navegador devuelve un evento de red (no un Error).
  if (typeof ProgressEvent !== "undefined" && e instanceof ProgressEvent) return `No se pudo conectar con el servidor del juego (${SERVER_URL}). ¿Está encendido?`;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/not found|no rooms found|not exist/i.test(msg)) return "No existe una sala con ese código.";
  if (/locked|full|maxClients/i.test(msg)) return "Esa sala ya está llena o empezando.";
  if (/ECONNREFUSED|Failed to fetch|NetworkError|network|xhr|Load failed/i.test(msg) || msg === "") return `No se pudo conectar con el servidor (${SERVER_URL}).`;
  return msg;
}
