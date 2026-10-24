// Mensajes entre cliente y servidor.
import type { AlienKind } from "./aliens";
import type { PingType } from "./constants";

// ---- Lobby (cliente → servidor) ----
export interface PickMsg {
  alien: AlienKind;
}
export interface ReadyMsg {
  ready: boolean;
}

// ---- Juego (cliente → servidor) ----
export interface InputMsg {
  seq: number;
  /** Dirección de movimiento normalizada (-1..1). */
  mx: number;
  my: number;
  /** Ángulo de apuntado en radianes. */
  aim: number;
  shoot: boolean;
}
export interface AbilityMsg {
  x: number;
  y: number;
}
export interface InteractMsg {
  down: boolean;
}
export interface PingMsg {
  tipo: PingType;
  x: number;
  y: number;
}
export interface ChatMsg {
  texto: string;
}
/** Eventos de minijuego que el cliente reporta. */
export interface MinigameMsg {
  id: string;
  ev: "fallo" | "acierto" | "nota";
  nota?: number;
  /** Carril de la esclusa cuando una sola persona maneja las dos palancas. */
  lane?: "A" | "B";
  ok?: boolean;
  /** Acierto hecho bien y rápido: resta tiempo al minijuego. */
  rapido?: boolean;
  razon?: string;
}

// ---- Servidor → cliente ----
export type AvisoTipo = "info" | "peligro" | "exito" | "alma" | "rescate";
export interface AvisoMsg {
  texto: string;
  tipo: AvisoTipo;
  /** Si existe, solo lo ve este jugador. */
  para?: string;
}
export interface PingEvent {
  de: string;
  tipo: PingType;
  x: number;
  y: number;
}
export interface ChatEvent {
  de: string;
  nombre: string;
  alien: AlienKind | "";
  texto: string;
}
export type FxTipo =
  | "explosion"
  | "impacto"
  | "llamas"
  | "hielo"
  | "acido"
  | "gas"
  | "transmutar"
  | "telequinesis"
  | "muerte"
  | "alma"
  | "rescate"
  | "chispa"
  | "ladrido"
  | "revelado"
  | "nucleo";
export interface FxEvent {
  t: FxTipo;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  c?: number;
}
/** Secuencia de la consola de la Sala de rayos (solo para quien la mira). */
export interface RayosSeqMsg {
  ronda: number;
  secuencia: number[];
  indice: number;
}
