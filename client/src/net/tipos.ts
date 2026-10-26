// Forma del estado que llega del servidor (espejo de server/src/schema/GameState.ts).

export interface MapLike<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(cb: (value: T, key: string) => void): void;
  readonly size: number;
}

export interface ArrayLike2<T> {
  readonly length: number;
  includes(v: T): boolean;
  forEach(cb: (value: T, i: number) => void): void;
  toArray(): T[];
}

export interface PlayerS {
  nombre: string;
  kind: string;
  x: number;
  y: number;
  aim: number;
  hp: number;
  maxHp: number;
  vivo: boolean;
  fantasma: boolean;
  conectado: boolean;
  estado: string;
  estadoT: number;
  confuso: number;
  disfrazado: boolean;
  energia: number;
  enfriamiento: number;
  habilidad: string;
  almas: ArrayLike2<string>;
  seq: number;
  ocupado: string;
  rescate: number;
  bajas: number;
}

export interface UnitS {
  t: string;
  team: string;
  x: number;
  y: number;
  ang: number;
  hp: number;
  maxHp: number;
  st: string;
  stT: number;
  blindado: boolean;
  escudo: boolean;
  tanques: number;
  moviendo: boolean;
}

export interface ProjectileS {
  k: string;
  team: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  vuelo: number;
}

export interface ZoneS {
  k: string;
  x: number;
  y: number;
  r: number;
  vida: number;
}

export interface PropS {
  k: string;
  x: number;
  y: number;
  hp: number;
  st: string;
  t: number;
  dueno: string;
}

export interface DoorS {
  abierta: boolean;
}

export interface PuzzleS {
  estado: string;
  tiempo: number;
  total: number;
  actores: string;
  solo: boolean;
  datos: string;
}

export interface SoulS {
  kind: string;
  de: string;
  x: number;
  y: number;
}

export interface GameStateS {
  fase: string;
  tiempo: number;
  objetivo: string;
  jefe: string;
  jugadores: MapLike<PlayerS>;
  unidades: MapLike<UnitS>;
  proyectiles: MapLike<ProjectileS>;
  zonas: MapLike<ZoneS>;
  objetos: MapLike<PropS>;
  puertas: MapLike<DoorS>;
  puzzles: MapLike<PuzzleS>;
  almas: MapLike<SoulS>;
}

export interface LobbyPlayerS {
  nombre: string;
  alien: string;
  skin: number;
  listo: boolean;
  anfitrion: boolean;
  x: number;
  y: number;
}

export interface LobbyStateS {
  codigo: string;
  estado: string;
  cuenta: number;
  necesarios: number;
  jugadores: MapLike<LobbyPlayerS>;
}
