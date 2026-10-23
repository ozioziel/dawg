// Campos de flujo: distancia (en casillas) desde cada casilla hasta un objetivo.
// Los enemigos bajan por el campo para llegar a un jugador rodeando paredes.
import { TILE, type World } from "@dawg/shared";

const DIRS: [number, number, number][] = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [1, -1, 14],
  [-1, 1, 14],
  [-1, -1, 14],
];

export class FlowField {
  readonly dist: Int32Array;
  constructor(readonly world: World) {
    this.dist = new Int32Array(world.w * world.h).fill(-1);
  }

  build(x: number, y: number): void {
    const { world, dist } = this;
    dist.fill(-1);
    const sx = Math.floor(x / TILE);
    const sy = Math.floor(y / TILE);
    if (!world.inBounds(sx, sy)) return;
    // Dijkstra simple con cola por cubetas (costes 10/14).
    const buckets: number[][] = [];
    const push = (i: number, d: number) => {
      (buckets[d] ??= []).push(i);
    };
    dist[world.idx(sx, sy)] = 0;
    push(world.idx(sx, sy), 0);
    for (let d = 0; d < buckets.length; d++) {
      const b = buckets[d];
      if (!b) continue;
      for (const i of b) {
        if (dist[i] !== d) continue;
        const cx = i % world.w;
        const cy = (i - cx) / world.w;
        for (const [dx, dy, c] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (world.blocksMove(nx, ny)) continue;
          if (dx !== 0 && dy !== 0 && (world.blocksMove(cx + dx, cy) || world.blocksMove(cx, cy + dy))) continue;
          const ni = world.idx(nx, ny);
          const nd = d + c;
          if (dist[ni] === -1 || nd < dist[ni]) {
            dist[ni] = nd;
            push(ni, nd);
          }
        }
      }
      buckets[d] = [];
      if (d > 8000) break;
    }
  }

  /** Distancia en casillas (aprox.) desde la posición, o -1 si no hay camino. */
  at(x: number, y: number): number {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (!this.world.inBounds(cx, cy)) return -1;
    const d = this.dist[this.world.idx(cx, cy)];
    return d < 0 ? -1 : d / 10;
  }

  /** Dirección normalizada hacia la siguiente casilla del camino. */
  direction(x: number, y: number): { x: number; y: number } | null {
    const { world, dist } = this;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (!world.inBounds(cx, cy)) return null;
    const here = dist[world.idx(cx, cy)];
    if (here < 0) return null;
    let best = here;
    let bx = -1;
    let by = -1;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (world.blocksMove(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (world.blocksMove(cx + dx, cy) || world.blocksMove(cx, cy + dy))) continue;
      const d = dist[world.idx(nx, ny)];
      if (d >= 0 && d < best) {
        best = d;
        bx = nx;
        by = ny;
      }
    }
    if (bx < 0) return null;
    const tx = (bx + 0.5) * TILE - x;
    const ty = (by + 0.5) * TILE - y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }
}
