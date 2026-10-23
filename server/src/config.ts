import { PLAYERS_PER_ROOM } from "@dawg/shared";

/**
 * Jugadores necesarios para empezar. Siempre 3 en el juego real;
 * para probar solo en local se puede poner JUGADORES_MINIMOS=1 en el entorno.
 */
export function jugadoresNecesarios(): number {
  const n = Number(process.env.JUGADORES_MINIMOS);
  return Number.isInteger(n) && n >= 1 && n <= PLAYERS_PER_ROOM ? n : PLAYERS_PER_ROOM;
}

export const PORT = Number(process.env.PORT ?? 2567);

/** Orígenes permitidos para CORS (itch.io + dominio propio). Vacío = cualquiera. */
export const ORIGENES = (process.env.ORIGENES_PERMITIDOS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Carpeta del cliente compilado para servir la página propia (opcional). */
export const CLIENTE_DIR = process.env.CLIENTE_DIR ?? "";
