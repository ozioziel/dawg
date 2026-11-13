// Reglas generales del juego. Cambiar aquí balancea cliente y servidor a la vez.

export const TILE = 64;

/** Simulación del servidor (ticks por segundo). El cliente envía inputs al mismo ritmo. */
export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
/** Envíos de estado por segundo. */
export const PATCH_RATE = 20;

/** De 1 a 5 jugadores por partida, cada uno con un alien distinto. */
export const MIN_JUGADORES = 1;
export const MAX_JUGADORES = 5;
/** Compatibilidad con código antiguo: tamaño máximo de la sala. */
export const PLAYERS_PER_ROOM = MAX_JUGADORES;
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
/** Bloqueo tras fallar un reto del mundo (no minijuego). */
export const RETO_LOCK = 12;
export const CORE_STATION_DURATION = MINIGAME_DURATION;
/** Con un aliado caído, el que hace los dos papeles tiene más tiempo en los dúos. */
export const SOLO_TIME_FACTOR = 1.5;

/** Enemigos vivos como máximo según el tamaño del equipo (1..5). */
export const MAX_ENEMIES_ALIVE = 30;
export const MAX_ENEMIGOS_POR_EQUIPO = [0, 16, 22, 28, 32, 36];

/** Escalado de la amenaza por tamaño del equipo (índice = jugadores). No es solo vida: también cantidad y ritmo. */
export const ESCALA_EQUIPO = {
  cantidad: [0, 0.55, 0.8, 1, 1.2, 1.4],
  vida: [0, 0.85, 0.95, 1, 1.12, 1.25],
  vidaJefe: [0, 0.6, 0.8, 1, 1.2, 1.4],
  intervalo: [0, 1.35, 1.15, 1, 0.92, 0.85],
  tiempoReto: [0, 1.25, 1.1, 1, 1, 1],
  /** Daño que hacen los enemigos: un alien solo no puede cubrirse las espaldas. */
  dano: [0, 0.72, 0.88, 1, 1, 1.05],
};

/** Objetos que bloquean el paso (radio de colisión). El resto se atraviesa. */
export const PROP_RADIUS: Record<string, number> = {
  barril: 20,
  caja: 24,
  cobertura: 34,
  muro_hielo: 26,
  contenedor: 30,
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

/** Zona caminable del cuarto de espera, en fracción (0..1) de la imagen del cuarto. */
export const LOBBY_BOUNDS = { minX: 0.12, maxX: 0.88, minY: 0.42, maxY: 0.84 } as const;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Muertes y reaparición. */
export const MUERTE = {
  /** En solitario: reanimaciones de emergencia por sector. */
  vidasSoloPorSector: 1,
  /** Segundos hasta reanimar en la cápsula (solo). */
  esperaSolo: 3,
  /** Vida con la que se reaparece (fracción). */
  vidaReaparicion: 0.6,
};
