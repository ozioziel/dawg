import { MAX_JUGADORES, MIN_JUGADORES } from "@dawg/shared";

/**
 * Jugadores mínimos para empezar: 1 (se puede jugar en solitario).
 * Para obligar a esperar a más gente en pruebas: JUGADORES_MINIMOS=3 en el entorno.
 */
export function jugadoresNecesarios(): number {
  const n = Number(process.env.JUGADORES_MINIMOS);
  return Number.isInteger(n) && n >= MIN_JUGADORES && n <= MAX_JUGADORES ? n : MIN_JUGADORES;
}

export const PORT = Number(process.env.PORT ?? 2567);

/** Orígenes permitidos para CORS (itch.io + dominio propio). Vacío = cualquiera. */
export const ORIGENES = (process.env.ORIGENES_PERMITIDOS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Carpeta del cliente compilado para servir la página propia (opcional). */
export const CLIENTE_DIR = process.env.CLIENTE_DIR ?? "";
