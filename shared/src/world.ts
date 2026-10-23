// Mapa (formato Tiled JSON), colisiones y línea de visión.
// Lo usan el servidor (autoridad) y el cliente (predicción del movimiento propio).
import { TILE } from "./constants";

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
}

export interface TiledLayer {
  id: number;
  name: string;
  type: "tilelayer" | "objectgroup";
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

export interface MapObject {
  id: number;
  type: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, string | number | boolean>;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface RoomInfo {
  id: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class World {
  readonly w: number;
  readonly h: number;
  readonly tile = TILE;
  /** Pared o vacío: bloquea movimiento y disparos. */
  readonly solid: Uint8Array;
  /** Ácido o agua: bloquea movimiento, no disparos. */
  readonly liquid: Uint8Array;
  /** Celdas de líquido que se volvieron caminables (puente). */
  readonly bridged: Uint8Array;
  /** Contador de puertas cerradas sobre la celda. */
  readonly closedDoor: Uint8Array;
  readonly doorCells = new Map<string, number[]>();
  readonly doorOpen = new Map<string, boolean>();
  readonly objects: MapObject[] = [];
  readonly obstacles: Circle[] = [];
  readonly rooms: RoomInfo[] = [];

  constructor(map: TiledMap) {
    this.w = map.width;
    this.h = map.height;
    const n = this.w * this.h;
    this.solid = new Uint8Array(n);
    this.liquid = new Uint8Array(n);
    this.bridged = new Uint8Array(n);
    this.closedDoor = new Uint8Array(n);

    const tileProps = new Map<number, Record<string, unknown>>();
    for (const ts of map.tilesets) {
      for (const t of ts.tiles ?? []) {
        tileProps.set(ts.firstgid + t.id, propsOf(t.properties));
      }
    }

    for (const layer of map.layers) {
      if (layer.type === "tilelayer" && layer.data) {
        layer.data.forEach((gid, i) => {
          const p = tileProps.get(gid);
          if (!p) return;
          if (p.solido) this.solid[i] = 1;
          if (p.liquido) this.liquid[i] = 1;
        });
      } else if (layer.type === "objectgroup" && layer.objects) {
        for (const o of layer.objects) {
          this.objects.push({
            id: o.id,
            type: o.type,
            name: o.name,
            x: o.x,
            y: o.y,
            w: o.width,
            h: o.height,
            props: propsOf(o.properties) as MapObject["props"],
          });
        }
      }
    }

    for (const o of this.objects) {
      if (o.type === "door") {
        const cells: number[] = [];
        for (let cy = Math.floor(o.y / TILE); cy < Math.ceil((o.y + o.h) / TILE); cy++) {
          for (let cx = Math.floor(o.x / TILE); cx < Math.ceil((o.x + o.w) / TILE); cx++) {
            cells.push(this.idx(cx, cy));
          }
        }
        this.doorCells.set(o.name, cells);
        this.doorOpen.set(o.name, true);
        this.setDoor(o.name, Boolean(o.props.abierta));
      } else if (o.type === "decor" && Number(o.props.radio) > 0) {
        this.obstacles.push({ x: o.x, y: o.y, r: Number(o.props.radio) });
      } else if (o.type === "room") {
        this.rooms.push({ id: o.name, nombre: String(o.props.nombre ?? o.name), x: o.x, y: o.y, w: o.w, h: o.h });
      }
    }
  }

  idx(cx: number, cy: number): number {
    return cy * this.w + cx;
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h;
  }

  blocksMove(cx: number, cy: number): boolean {
    if (!this.inBounds(cx, cy)) return true;
    const i = this.idx(cx, cy);
    if (this.solid[i] || this.closedDoor[i]) return true;
    return this.liquid[i] === 1 && this.bridged[i] === 0;
  }

  blocksShot(cx: number, cy: number): boolean {
    if (!this.inBounds(cx, cy)) return true;
    const i = this.idx(cx, cy);
    return this.solid[i] === 1 || this.closedDoor[i] > 0;
  }

  blocksMoveAt(x: number, y: number): boolean {
    return this.blocksMove(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  blocksShotAt(x: number, y: number): boolean {
    return this.blocksShot(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  setDoor(id: string, open: boolean): void {
    const cells = this.doorCells.get(id);
    if (!cells || this.doorOpen.get(id) === open) return;
    this.doorOpen.set(id, open);
    for (const i of cells) this.closedDoor[i] += open ? -1 : 1;
  }

  setBridge(cx: number, cy: number, on: boolean): void {
    if (this.inBounds(cx, cy)) this.bridged[this.idx(cx, cy)] = on ? 1 : 0;
  }

  /** Mueve un círculo deslizándose contra paredes y obstáculos. */
  moveCircle(x: number, y: number, dx: number, dy: number, r: number, extra?: readonly Circle[]): { x: number; y: number } {
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
    let px = x;
    let py = y;
    for (let s = 0; s < steps; s++) {
      px += dx / steps;
      py += dy / steps;
      const res = this.resolve(px, py, r, extra);
      px = res.x;
      py = res.y;
    }
    return { x: px, y: py };
  }

  resolve(x: number, y: number, r: number, extra?: readonly Circle[]): { x: number; y: number } {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const x0 = Math.floor((x - r) / TILE);
      const x1 = Math.floor((x + r) / TILE);
      const y0 = Math.floor((y - r) / TILE);
      const y1 = Math.floor((y + r) / TILE);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (!this.blocksMove(cx, cy)) continue;
          const rx0 = cx * TILE;
          const ry0 = cy * TILE;
          const px = clamp(x, rx0, rx0 + TILE);
          const py = clamp(y, ry0, ry0 + TILE);
          let ddx = x - px;
          let ddy = y - py;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            x += (ddx / d) * (r - d);
            y += (ddy / d) * (r - d);
          } else {
            // Centro dentro de la celda: salir por el borde más cercano.
            const left = x - rx0;
            const right = rx0 + TILE - x;
            const top = y - ry0;
            const bottom = ry0 + TILE - y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) x = rx0 - r;
            else if (m === right) x = rx0 + TILE + r;
            else if (m === top) y = ry0 - r;
            else y = ry0 + TILE + r;
            ddx = ddy = 0;
          }
          moved = true;
        }
      }
      const pushOut = (c: Circle) => {
        const ddx = x - c.x;
        const ddy = y - c.y;
        const min = r + c.r;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.001;
        x = c.x + (ddx / d) * min;
        y = c.y + (ddy / d) * min;
        moved = true;
      };
      for (const c of this.obstacles) pushOut(c);
      if (extra) for (const c of extra) pushOut(c);
      if (!moved) break;
    }
    return { x, y };
  }

  /** ¿Hay visión directa (sin paredes ni puertas cerradas) entre dos puntos? */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.raycast(x0, y0, x1, y1) === null;
  }

  /** Devuelve el primer punto donde la línea choca con una pared, o null si llega. */
  raycast(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
    let cx = Math.floor(x0 / TILE);
    let cy = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE);
    const ey = Math.floor(y1 / TILE);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((stepX > 0 ? (cx + 1) * TILE : cx * TILE) - x0) / dx : Infinity;
    let tMaxY = dy !== 0 ? ((stepY > 0 ? (cy + 1) * TILE : cy * TILE) - y0) / dy : Infinity;
    let guard = 0;
    while ((cx !== ex || cy !== ey) && guard++ < 512) {
      let t: number;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        cy += stepY;
      }
      if (t > 1) break;
      if (this.blocksShot(cx, cy)) return { x: x0 + dx * t, y: y0 + dy * t };
    }
    return null;
  }

  roomAt(x: number, y: number): RoomInfo | undefined {
    return this.rooms.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
  }

  find(type: string): MapObject[] {
    return this.objects.filter((o) => o.type === type);
  }

  findOne(type: string, name?: string): MapObject | undefined {
    return this.objects.find((o) => o.type === type && (name === undefined || o.name === name));
  }
}

function propsOf(list?: TiledProperty[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of list ?? []) out[p.name] = p.value;
  return out;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
