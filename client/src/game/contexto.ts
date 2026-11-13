import { ALIENS, ALIEN_KINDS, type World } from "@dawg/shared";
import type Phaser from "phaser";
import type { SalaJuego } from "../net/conexion";
import type { PlayerS } from "../net/tipos";
import type { Chat } from "../ui/chat";

/** Lo que comparten todas las escenas del juego. */
export interface Ctx {
  room: SalaJuego;
  chat: Chat;
  world: World;
  ui: {
    mapaGrande: boolean;
    /** Minijuego abierto que captura ratón/teclado ('' si ninguno). */
    minijuego: string;
    /** Texto de interacción para el HUD. */
    prompt: string;
    /** Pings activos para dibujar en HUD/minimapa. */
    pings: { de: string; tipo: string; x: number; y: number; hasta: number }[];
    /** Controles táctiles activos. */
    tactil: boolean;
    /** Código de colores que solo ve este jugador (consola del inspector). */
    codigo: { codigo: number[]; hasta: number } | null;
  };
  /** Entrada táctil: la escena del mundo la lee en cada paso. */
  tactil: {
    mx: number;
    my: number;
    aim: number | null;
    disparo: boolean;
    habilidad: "" | "down" | "up";
  };
  salir(msg?: string): void;
}

export function ctx(scene: Phaser.Scene): Ctx {
  return scene.registry.get("ctx") as Ctx;
}

// ---- Reloj del servidor estimado (para minijuegos sincronizados)
let ultimoServidor = 0;
let ultimoLocal = 0;

export function actualizarReloj(t: number): void {
  if (t !== ultimoServidor) {
    ultimoServidor = t;
    ultimoLocal = performance.now();
  }
}

export function tiempoServidor(): number {
  return ultimoServidor + Math.min(0.25, (performance.now() - ultimoLocal) / 1000);
}

export const COLOR_ALIEN: Record<string, number> = Object.fromEntries(ALIEN_KINDS.map((k) => [k, ALIENS[k].color]));

/** Hoja de sprites de un jugador según su forma actual, su skin y sus estados. */
export function hojaJugador(p: PlayerS, skinDe: (forma: string) => number): string {
  if (p.forma === "cambiaformas") {
    if (p.ultiT > 0) return "cambiaformas_berserk";
    if (p.disfrazado) return p.identidad ? SPRITE_DE[p.identidad] ?? p.identidad : "cambiaformas_humano";
  }
  if (p.forma === "simbionte" && p.ultiT > 0) return "simbionte_coloso";
  const skin = skinDe(p.forma);
  return skin ? `skin${skin}${p.forma}` : p.forma;
}

/** Unidades que se dibujan con la hoja de otra. */
export const SPRITE_DE: Record<string, string> = {};

export const TEXTO = {
  fontFamily: '"Chakra Petch", system-ui, sans-serif',
  fontStyle: "700",
  color: "#eaf6ff",
  stroke: "#0a0a0c",
  strokeThickness: 4,
} as const;

export const TITULO = {
  fontFamily: '"Bangers", Impact, sans-serif',
  color: "#eaf6ff",
  stroke: "#0a0a0c",
  strokeThickness: 6,
} as const;

/** Profundidad de dibujo por altura en el mapa (lo de abajo tapa a lo de arriba). */
export const prof = (y: number) => 1000 + y;
export const PROF_UI_MUNDO = 20000;
/** Altura visual del pecho: balas y armas se dibujan a esta altura sobre los pies. */
export const ALTURA = 30;

/** ¿Pantalla táctil? */
export function esTactil(): boolean {
  try {
    return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  } catch {
    return false;
  }
}
