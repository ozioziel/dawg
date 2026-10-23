// Enemigos de la demo del Área 1 (lista cerrada) y aliados (pulpos, coberturas).

export const ENEMY_TYPES = [
  "fusilero",
  "escudo",
  "lanzarredes",
  "lanzallamas",
  "francotirador",
  "perro",
  "criogenista",
  "quimico",
  "bioquimico",
  "medico",
  "ingeniero",
  "jefe",
  "torreta",
  "sensor",
] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export type UnitType = EnemyType | "pulpo";

export interface EnemyDef {
  nombre: string;
  hp: number;
  speed: number;
  radius: number;
  /** Se puede convertir en pulpo. */
  convertible: boolean;
  /** Distancia preferida al objetivo [mín, máx]. */
  range: [number, number];
  /** Es científico (se aleja si te acercas). */
  cientifico: boolean;
  /** Puntos de amenaza para el Director. */
  amenaza: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  fusilero: { nombre: "Fusilero", hp: 45, speed: 150, radius: 18, convertible: true, range: [220, 430], cientifico: false, amenaza: 1 },
  escudo: { nombre: "Escudo antidisturbios", hp: 90, speed: 120, radius: 20, convertible: true, range: [0, 60], cientifico: false, amenaza: 2 },
  lanzarredes: { nombre: "Lanzarredes", hp: 40, speed: 140, radius: 18, convertible: true, range: [220, 380], cientifico: false, amenaza: 2 },
  lanzallamas: { nombre: "Lanzallamas", hp: 160, speed: 115, radius: 22, convertible: true, range: [60, 150], cientifico: false, amenaza: 3 },
  francotirador: { nombre: "Francotirador", hp: 35, speed: 120, radius: 18, convertible: true, range: [480, 850], cientifico: false, amenaza: 2 },
  perro: { nombre: "Perro K9", hp: 32, speed: 285, radius: 16, convertible: false, range: [0, 40], cientifico: false, amenaza: 1 },
  criogenista: { nombre: "Criogenista", hp: 32, speed: 135, radius: 17, convertible: true, range: [300, 470], cientifico: true, amenaza: 2 },
  quimico: { nombre: "Químico", hp: 32, speed: 135, radius: 17, convertible: true, range: [280, 450], cientifico: true, amenaza: 1 },
  bioquimico: { nombre: "Bioquímico", hp: 32, speed: 135, radius: 17, convertible: true, range: [260, 420], cientifico: true, amenaza: 2 },
  medico: { nombre: "Médico de campo", hp: 65, speed: 140, radius: 17, convertible: true, range: [200, 360], cientifico: true, amenaza: 2 },
  ingeniero: { nombre: "Ingeniero", hp: 65, speed: 130, radius: 17, convertible: true, range: [300, 480], cientifico: true, amenaza: 2 },
  jefe: { nombre: "Jefe de laboratorio", hp: 1100, speed: 85, radius: 40, convertible: false, range: [260, 480], cientifico: true, amenaza: 10 },
  torreta: { nombre: "Torreta", hp: 70, speed: 0, radius: 22, convertible: false, range: [0, 520], cientifico: false, amenaza: 1 },
  sensor: { nombre: "Sensor", hp: 25, speed: 0, radius: 14, convertible: false, range: [0, 0], cientifico: false, amenaza: 0 },
};

/** Ajustes de cada comportamiento. */
export const ENEMY_TUNING = {
  fusilero: { burst: 3, burstGap: 0.12, cooldown: 2.1, damage: 4, bulletSpeed: 680 },
  escudo: { meleeRange: 62, meleeDamage: 9, stun: 0.5, cooldown: 1.6, shieldArc: 70 },
  lanzarredes: { cooldown: 6, netSpeed: 520, damage: 4 },
  lanzallamas: { cone: 32, range: 175, dps: 22, firePatchEvery: 0.6, patchLife: 3.5, patchDps: 8, backMultiplier: 3, explosionDamage: 70, explosionRadius: 120 },
  francotirador: { aimTime: 1.5, lockAt: 1.1, damage: 34, bulletSpeed: 1900, cooldown: 3.6 },
  perro: { biteDamage: 6, cooldown: 1.1, sniffRange: 210 },
  criogenista: { cooldown: 4.2, flight: 0.9, radius: 58 },
  quimico: { cooldown: 4, flight: 0.85, radius: 66, life: 4.5, dps: 12 },
  bioquimico: { cooldown: 4.5, flight: 0.85, radius: 85, life: 5, confuse: 4 },
  medico: { healRange: 170, healPerSec: 16, shieldTime: 5, cooldown: 4 },
  ingeniero: { cooldown: 9, sensorRange: 230 },
  jefe: { cooldown: 2.4, angryCooldown: 1.5, reinforceEvery: 20, tanks: 3, armoredMultiplier: 0.2 },
  torreta: { cooldown: 0.9, damage: 4, bulletSpeed: 680 },
};

export function isConvertible(t: UnitType): boolean {
  return t !== "pulpo" && ENEMIES[t].convertible;
}
