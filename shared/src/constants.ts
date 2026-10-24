// Reglas generales del juego. Cambiar aquí balancea cliente y servidor a la vez.

export const TILE = 64;

/** Simulación del servidor (ticks por segundo). El cliente envía inputs al mismo ritmo. */
export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
/** Envíos de estado por segundo. */
export const PATCH_RATE = 20;

export const PLAYERS_PER_ROOM = 3;
export const PLAYER_RADIUS = 18;
export const GHOST_SPEED = 260;

/** Distancia para interactuar (rescatar, recoger almas, consolas). */
export const INTERACT_RANGE = 90;
/** Segundos manteniendo E para descongelar o cortar una red. */
export const RESCUE_TIME = 1.4;
/** Si nadie te rescata, te liberas solo tras estos segundos (evita partidas atascadas). */
export const FREEZE_AUTO_THAW = 15;
export const NET_AUTO_FREE = 12;

/** Minijuegos. */
/** Los minijuegos duran como mucho esto (si se hacen mal)… */
export const MINIGAME_DURATION = 60;
/** …y como poco esto (si se hacen muy bien). */
export const MINIGAME_MIN = 30;
/** Segundos que se restan por cada orden cumplida bien y rápido. */
export const MINIGAME_BONUS = 5;
export const MINIGAME_LOCK = 30;
export const CORE_STATION_DURATION = MINIGAME_DURATION;
/** Con un aliado caído, el que hace los dos papeles tiene más tiempo en los dúos. */
export const SOLO_TIME_FACTOR = 1.5;

export const MAX_ENEMIES_ALIVE = 28;

/** Objetos que bloquean el paso (radio de colisión). El resto se atraviesa. */
export const PROP_RADIUS: Record<string, number> = {
  barril: 20,
  caja: 24,
  cobertura: 34,
};

export const BOTIQUIN_CURA = 45;

export const PING_TYPES = ["ayuda", "aqui", "defiendan", "voy"] as const;
export type PingType = (typeof PING_TYPES)[number];

export const PING_LABELS: Record<PingType, string> = {
  ayuda: "¡Ayuda!",
  aqui: "Aquí",
  defiendan: "¡Defiendan!",
  voy: "Voy",
};

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
