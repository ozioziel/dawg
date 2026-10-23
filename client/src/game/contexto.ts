import type { World } from "@dawg/shared";
import type Phaser from "phaser";
import type { SalaJuego } from "../net/conexion";
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

export const COLOR_ALIEN: Record<string, number> = {
  cambiaformas: 0x7fb24a,
  delmar: 0xf08a24,
  inteligente: 0xa58cf0,
};

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
