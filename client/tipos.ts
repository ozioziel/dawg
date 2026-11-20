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
  forma: string;
  skin: number;
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
  velocidad: number;
  energia: number;
  enfriamiento: number;
  enfMax: number;
  ulti: number;
  ultiT: number;
  ultiMax: number;
  disparando: boolean;
  disfrazado: boolean;
  identidad: string;
  sospecha: number;
  cautivo: string;
  bajoTierra: boolean;
  tunel: number;
  controla: string;
  escudo: number;
  punal: number;
  colonia: number;
  canal: number;
  canalTipo: string;
  almas: ArrayLike2<string>;
  mejoras: ArrayLike2<string>;
  oferta: string;
  ofertasPendientes: number;
  seq: number;
  ocupado: string;
  rescate: number;
  vidasSolo: number;
  bajas: number;
  curado: number;
  rescates: number;
  apoyo: number;
  cdBasico: number;
  cdBasicoMax: number;
  anim: string;
  animN: number;
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
  poseido: string;
  dueno: string;
  infeccion: number;
  frio: number;
  fase: number;
  etiqueta: string;
  anim: string;
  animN: number;
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
  total: number;
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
  sellada: boolean;
}

export interface RetoS {
  def: string;
  slot: string;
  estado: string;
  tiempo: number;
  total: number;
  progreso: number;
  actores: string;
  solo: boolean;
  datos: string;
  texto: string;
}

/** Alias: los minijuegos de consola leen el reto de su sala. */
export type PuzzleS = RetoS;

export interface PzObjS {
  k: string;
  x: number;
  y: number;
  st: string;
  v: number;
  txt: string;
  c: number;
  ang: number;
  f: number;
  reto: string;
  r: number;
}

export interface BloqueoS {
  k: string;
  x: number;
  y: number;
  w: number;
  h: number;
  m: number;
}

export interface SoulS {
  kind: string;
  de: string;
  dueno: string;
  x: number;
  y: number;
}

export interface GameStateS {
  fase: string;
  tiempo: number;
  objetivo: string;
  sector: number;
  jefe: string;
  eclipse: number;
  apagon: number;
  compuerta: number;
  plan: string;
  crisis: string;
  equipo: number;
  jugadores: MapLike<PlayerS>;
  unidades: MapLike<UnitS>;
  proyectiles: MapLike<ProjectileS>;
  zonas: MapLike<ZoneS>;
  objetos: MapLike<PropS>;
  puertas: MapLike<DoorS>;
  retos: MapLike<RetoS>;
  pz: MapLike<PzObjS>;
  bloqueos: MapLike<BloqueoS>;
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
