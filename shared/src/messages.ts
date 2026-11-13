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
/** Posición del alien en el cuarto de espera (fracción 0..1 de la imagen). */
export interface LobbyMoveMsg {
  x: number;
  y: number;
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
/** Habilidad activa: "down" al pulsar y "up" al soltar (para las que se mantienen). */
export interface AbilityMsg {
  x: number;
  y: number;
  fase?: "down" | "up";
}
export interface UltiMsg {
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
export interface MejoraMsg {
  /** Índice de la opción elegida (0..2). */
  i: number;
}
export interface ReiniciarMsg {
  /** "sector": volver al inicio del sector actual. "todo": empezar desde cero. */
  modo?: "sector" | "todo";
}
/** Eventos de minijuego que el cliente reporta. */
export interface MinigameMsg {
  id: string;
  ev: "fallo" | "acierto" | "nota" | "codigo" | "ritmo";
  nota?: number;
  /** Carril de la esclusa cuando una sola persona maneja las dos palancas. */
  lane?: "A" | "B";
  ok?: boolean;
  /** Acierto hecho bien y rápido: resta tiempo al minijuego. */
  rapido?: boolean;
  razon?: string;
  /** Código introducido (consola del inspector). */
  codigo?: number[];
  /** Aciertos/total del ritmo. */
  aciertos?: number;
  total?: number;
}

// ---- Servidor → cliente ----
export type AvisoTipo = "info" | "peligro" | "exito" | "alma" | "rescate" | "sector";
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
  | "nucleo"
  | "tajo"
  | "mordida"
  | "teleport"
  | "excavar"
  | "emerger"
  | "chorro"
  | "congelar"
  | "devorar"
  | "curar"
  | "infectar"
  | "asimilar"
  | "absorber"
  | "escaneo"
  | "disfraz"
  | "berserk"
  | "singularidad"
  | "kraken"
  | "jardin"
  | "eclipse"
  | "cero"
  | "fusion"
  | "tentaculo"
  | "tunel"
  | "laser"
  | "agarre"
  | "texto"
  | "reaparecer"
  | "mejora"
  | "alarma";
export interface FxEvent {
  t: FxTipo;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  c?: number;
  /** Texto (para "texto"). */
  s?: string;
}
/** Código que la consola del inspector muestra solo al Cambiaformas. */
export interface CodigoMsg {
  reto: string;
  codigo: number[];
  hasta: number;
}
