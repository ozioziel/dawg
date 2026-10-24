// Salas-puzzle del Área 1 y qué puertas abren.
import type { AlienKind } from "./aliens";
import { CORE_STATION_DURATION, MINIGAME_DURATION } from "./constants";

export type MinigameKind = "memoria" | "cara" | "transmutacion" | "rayos" | "puente" | "valvulas";

/** Errores permitidos en un minijuego; con uno más, falla. */
export const ERRORES_PERMITIDOS = 4;
export type PuzzleTipo = "individual" | "duo" | "nucleo";

export interface PuzzleDef {
  id: string;
  nombre: string;
  sala: string;
  tipo: PuzzleTipo;
  /** Quién puede hacerlo. En los dúos, el primero es el rol A y el segundo el rol B. */
  roles: AlienKind[];
  minijuego: MinigameKind;
  /** Segundos que dura (individuales) o tiempo límite (dúos). */
  duracion: number;
  descripcion: string;
}

export const PUZZLES: Record<string, PuzzleDef> = {
  p1: {
    id: "p1",
    nombre: "Memoria psíquica",
    sala: "Cámara de contención",
    tipo: "individual",
    roles: ["inteligente"],
    minijuego: "memoria",
    duracion: MINIGAME_DURATION,
    descripcion: "Las zonas del cerebro se iluminan en orden: repítelas. Cada acierto alarga la secuencia.",
  },
  p2: {
    id: "p2",
    nombre: "Copia la cara",
    sala: "Archivo de seguridad",
    tipo: "individual",
    roles: ["cambiaformas"],
    minijuego: "cara",
    duracion: MINIGAME_DURATION,
    descripcion: "Disfrazado, arma la cara del científico que pide el escáner: pelo, gafas, boca y placa.",
  },
  p3: {
    id: "p3",
    nombre: "Transmutación",
    sala: "Sala de tuberías",
    tipo: "individual",
    roles: ["delmar"],
    minijuego: "transmutacion",
    duracion: MINIGAME_DURATION,
    descripcion: "Por la cinta pasan objetos: conviértelos en lo que pide su cartel (coral, pulpo o burbuja).",
  },
  p4: {
    id: "p4",
    nombre: "Sala de rayos",
    sala: "Sala de rayos",
    tipo: "duo",
    roles: ["cambiaformas", "inteligente"],
    minijuego: "rayos",
    duracion: MINIGAME_DURATION,
    descripcion: "El cambiaformas lee el código en la consola; el inteligente activa los interruptores con telequinesis en ese orden.",
  },
  p5: {
    id: "p5",
    nombre: "Puente sobre el ácido",
    sala: "Piscina de ácido",
    tipo: "duo",
    roles: ["inteligente", "delmar"],
    minijuego: "puente",
    duracion: MINIGAME_DURATION,
    descripcion: "El inteligente coloca bloques con telequinesis y el del mar los transmuta en puente antes de que se hundan.",
  },
  p6: {
    id: "p6",
    nombre: "Válvulas a la vez",
    sala: "Esclusa",
    tipo: "duo",
    roles: ["cambiaformas", "delmar"],
    minijuego: "valvulas",
    duracion: MINIGAME_DURATION,
    descripcion: "Sigan las órdenes de la pantalla: «solo A», «solo B» o «¡AMBOS!». Cumplirlas rápido acorta el tiempo.",
  },
  n1: {
    id: "n1",
    nombre: "Estación psíquica",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["inteligente"],
    minijuego: "memoria",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta de la memoria psíquica. Rompe un depósito del jefe.",
  },
  n2: {
    id: "n2",
    nombre: "Estación del disfraz",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["cambiaformas"],
    minijuego: "cara",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta de copia la cara. Rompe un depósito del jefe.",
  },
  n3: {
    id: "n3",
    nombre: "Estación de transmutación",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["delmar"],
    minijuego: "transmutacion",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta de la transmutación. Rompe un depósito del jefe.",
  },
};

/** Qué necesita cada puerta para abrirse. */
export const DOOR_RULES: Record<string, { requiere: string[]; texto: string }> = {
  D0: { requiere: ["tutorial"], texto: "Acaba con los guardias de las incubadoras" },
  D1: { requiere: ["p1"], texto: "Resuelve la Memoria psíquica" },
  D4: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D5: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D6: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D7: { requiere: ["p4", "p5", "p6"], texto: "Resuelve las tres salas de dúo" },
  D8: { requiere: ["n1", "n2", "n3", "jefe"], texto: "Destruye el núcleo y derrota al jefe" },
};

/** Símbolos de los interruptores de la Sala de rayos. */
export const RAYOS_SIMBOLOS = [
  { id: 0, nombre: "Espiral", color: "#3ef0ff" },
  { id: 1, nombre: "Tridente", color: "#ff5ad1" },
  { id: 2, nombre: "Ojo", color: "#ffd23e" },
  { id: 3, nombre: "Luna", color: "#7dff6a" },
  { id: 4, nombre: "Rayo", color: "#ff7a3e" },
  { id: 5, nombre: "Gota", color: "#9b7bff" },
];

export const PUENTE = {
  sinkTime: 16,
  slots: 6,
};

/** Válvulas a la vez: órdenes una tras otra durante 30-60 s. */
export const ESCLUSA = {
  /** Al llegar a este número de fallos, se falla (se permiten ERRORES_PERMITIDOS). */
  maxMisses: ERRORES_PERMITIDOS + 1,
  /** Cada cuántos segundos llega una orden y cuántos dura para pulsar. */
  cada: 3.2,
  dura: 2.3,
  /** Una orden cuenta como rápida si se cumple en esta fracción de su tiempo. */
  rapida: 0.55,
};

export function puzzleFor(id: string): PuzzleDef | undefined {
  return PUZZLES[id];
}
