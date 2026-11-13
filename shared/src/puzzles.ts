// Constantes de los minijuegos de interfaz (los retos del mundo están en retos.ts).
import { MINIGAME_DURATION } from "./constants";

export type MinigameKind = "memoria" | "cara" | "transmutacion" | "rayos" | "puente" | "valvulas" | "codigo" | "ritmo";

/** Errores permitidos en un minijuego; con uno más, falla. */
export const ERRORES_PERMITIDOS = 4;

/** Duración por defecto de los minijuegos de consola. */
export const DURACION_MINIJUEGO = MINIGAME_DURATION;

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

/** Ritmo de Del Mar (inspirado en juegos de guitarra, con contenido propio). */
export const RITMO = {
  carriles: 4,
  /** Segundos que tarda una nota en caer hasta la línea. */
  caida: 1.6,
  /** Ventana de acierto (s). */
  ventana: 0.16,
  notas: 34,
  duracion: 40,
  /** Aciertos mínimos (fracción) para superar la calibración. */
  minimo: 0.7,
};

/** Código de colores del Cambiaformas (consola del inspector). */
export const CODIGO_COLORES = [
  { id: 0, nombre: "Rojo", color: "#ff4a4a" },
  { id: 1, nombre: "Verde", color: "#7dff6a" },
  { id: 2, nombre: "Azul", color: "#3ec0ff" },
  { id: 3, nombre: "Amarillo", color: "#ffd23e" },
  { id: 4, nombre: "Morado", color: "#b37bff" },
];
