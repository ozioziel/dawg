// Salas-puzzle del Área 1 y qué puertas abren.
import type { AlienKind } from "./aliens";
import { CORE_STATION_DURATION, MINIGAME_DURATION } from "./constants";

export type MinigameKind = "orbe" | "identidad" | "tuberias" | "rayos" | "puente" | "esclusa";
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
    nombre: "Orbe inestable",
    sala: "Cámara de contención",
    tipo: "individual",
    roles: ["inteligente"],
    minijuego: "orbe",
    duracion: MINIGAME_DURATION,
    descripcion: "Guía el orbe con telequinesis entre los láseres. Si te pegan, pierdes concentración.",
  },
  p2: {
    id: "p2",
    nombre: "Control de identidad",
    sala: "Archivo de seguridad",
    tipo: "individual",
    roles: ["cambiaformas"],
    minijuego: "identidad",
    duracion: MINIGAME_DURATION,
    descripcion: "Disfrazado, pasa el escáner: credencial, pulso y preguntas. Si te pegan, se rompe el disfraz.",
  },
  p3: {
    id: "p3",
    nombre: "Flujo alienígena",
    sala: "Sala de tuberías",
    tipo: "individual",
    roles: ["delmar"],
    minijuego: "tuberias",
    duracion: MINIGAME_DURATION,
    descripcion: "Transmuta las tuberías para llevar el líquido a la cerradura antes del desagüe.",
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
    nombre: "Esclusa doble",
    sala: "Esclusa",
    tipo: "duo",
    roles: ["cambiaformas", "delmar"],
    minijuego: "esclusa",
    duracion: MINIGAME_DURATION,
    descripcion: "Cada uno ve la mitad del ritmo; las notas dobles se pulsan a la vez. El del mar transmuta el agua entre rondas.",
  },
  n1: {
    id: "n1",
    nombre: "Estación psíquica",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["inteligente"],
    minijuego: "orbe",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta del orbe. Rompe un depósito del jefe.",
  },
  n2: {
    id: "n2",
    nombre: "Estación de identidad",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["cambiaformas"],
    minijuego: "identidad",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta del escáner. Rompe un depósito del jefe.",
  },
  n3: {
    id: "n3",
    nombre: "Estación de flujo",
    sala: "Núcleo",
    tipo: "nucleo",
    roles: ["delmar"],
    minijuego: "tuberias",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versión corta de las tuberías. Rompe un depósito del jefe.",
  },
};

/** Qué necesita cada puerta para abrirse. */
export const DOOR_RULES: Record<string, { requiere: string[]; texto: string }> = {
  D0: { requiere: ["tutorial"], texto: "Acaba con los guardias de las incubadoras" },
  D1: { requiere: ["p1"], texto: "Resuelve el Orbe inestable" },
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
  sinkTime: 9,
  slots: 6,
};

export const ESCLUSA = {
  rounds: 3,
  roundTime: 20,
  pause: 10,
  maxMisses: 4,
  maxWater: 9,
  hitWindow: 0.16,
};

export function puzzleFor(id: string): PuzzleDef | undefined {
  return PUZZLES[id];
}
