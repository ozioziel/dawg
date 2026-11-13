// Paso de movimiento del jugador: idéntico en servidor y cliente (predicción).
import { GHOST_SPEED, PLAYER_RADIUS, TILE } from "./constants";
import { clamp, type Circle, type World } from "./world";

export type PlayerStatus = "ok" | "congelado" | "red" | "aturdido" | "agarrado";

export interface MoverState {
  x: number;
  y: number;
  /** Velocidad actual (la calcula el servidor con mejoras y efectos). */
  speed: number;
  status: string;
  confused: number;
  ghost: boolean;
  /** Bloqueado en una consola o controlando a otro cuerpo. */
  locked: boolean;
  /** Escarabajo bajo tierra: atraviesa contenedores y objetos. */
  under?: boolean;
}

export function canMove(p: MoverState): boolean {
  if (p.ghost) return true;
  return p.status === "ok" && !p.locked;
}

export function stepPlayer(
  world: World,
  p: MoverState,
  mx: number,
  my: number,
  dt: number,
  extra?: readonly Circle[],
): { x: number; y: number } {
  if (!canMove(p)) return { x: p.x, y: p.y };
  let ix = clamp(mx, -1, 1);
  let iy = clamp(my, -1, 1);
  if (p.confused > 0 && !p.ghost) {
    ix = -ix;
    iy = -iy;
  }
  const len = Math.hypot(ix, iy);
  if (len < 0.01) return { x: p.x, y: p.y };
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  if (p.ghost) {
    return {
      x: clamp(p.x + ix * GHOST_SPEED * dt, TILE, (world.w - 1) * TILE),
      y: clamp(p.y + iy * GHOST_SPEED * dt, TILE, (world.h - 1) * TILE),
    };
  }
  return world.moveCircle(p.x, p.y, ix * p.speed * dt, iy * p.speed * dt, PLAYER_RADIUS, extra, p.under ? 2 : 1);
}
