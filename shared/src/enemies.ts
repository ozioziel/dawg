// Enemigos (soldados, científicos, robots, dispositivos, NPC de puzzles y jefes) y unidades aliadas.

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
  "robot",
  "cazador",
  "laser",
  "dron",
  "inspector",
  "tecnico",
  "oficial",
  "centinela",
  "director",
  "generador",
  "nodo",
  "pilon",
] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export const ALLY_TYPES = ["pulpo", "kraken", "cria", "planta", "terminal"] as const;
export type AllyType = (typeof ALLY_TYPES)[number];

export type UnitType = EnemyType | AllyType;

/** normal: la mordida del Escarabajo lo mata y se puede tragar. élite: aguanta. jefe: nunca se convierte ni se traga. */
export type Rango = "normal" | "elite" | "jefe" | "dispositivo" | "npc";

export interface EnemyDef {
  nombre: string;
  hp: number;
  speed: number;
  radius: number;
  /** Del Mar puede convertirlo en pulpo. */
  convertible: boolean;
  /** Distancia preferida al objetivo [mín, máx]. */
  range: [number, number];
  /** Científico: se aleja si te acercas. */
  cientifico: boolean;
  /** Puntos de amenaza para el Director. */
  amenaza: number;
  rango: Rango;
  /** Telequinesis puede controlarlo; Simbionte puede infectarlo. */
  controlable: boolean;
}

const D = (o: Partial<EnemyDef> & Pick<EnemyDef, "nombre" | "hp" | "speed" | "radius" | "range">): EnemyDef => ({
  convertible: true,
  cientifico: false,
  amenaza: 1,
  rango: "normal",
  controlable: true,
  ...o,
});

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  fusilero: D({ nombre: "Fusilero", hp: 45, speed: 150, radius: 18, range: [220, 430] }),
  escudo: D({ nombre: "Escudo antidisturbios", hp: 90, speed: 120, radius: 20, range: [0, 60], amenaza: 2, rango: "elite" }),
  lanzarredes: D({ nombre: "Lanzarredes", hp: 40, speed: 140, radius: 18, range: [220, 380], amenaza: 2 }),
  lanzallamas: D({ nombre: "Lanzallamas", hp: 160, speed: 115, radius: 22, range: [60, 150], amenaza: 3, rango: "elite" }),
  francotirador: D({ nombre: "Francotirador", hp: 35, speed: 120, radius: 18, range: [480, 850], amenaza: 2 }),
  perro: D({ nombre: "Perro K9", hp: 32, speed: 285, radius: 16, range: [0, 40], convertible: false, controlable: false }),
  criogenista: D({ nombre: "Criogenista", hp: 32, speed: 135, radius: 17, range: [300, 470], cientifico: true, amenaza: 2 }),
  quimico: D({ nombre: "Químico", hp: 32, speed: 135, radius: 17, range: [280, 450], cientifico: true }),
  bioquimico: D({ nombre: "Bioquímico", hp: 32, speed: 135, radius: 17, range: [260, 420], cientifico: true, amenaza: 2 }),
  medico: D({ nombre: "Médico de campo", hp: 65, speed: 140, radius: 17, range: [200, 360], cientifico: true, amenaza: 2 }),
  ingeniero: D({ nombre: "Ingeniero", hp: 65, speed: 130, radius: 17, range: [300, 480], cientifico: true, amenaza: 2 }),
  jefe: D({ nombre: "Jefe de laboratorio", hp: 1100, speed: 85, radius: 40, range: [260, 480], cientifico: true, amenaza: 10, convertible: false, rango: "jefe", controlable: false }),
  torreta: D({ nombre: "Torreta", hp: 70, speed: 0, radius: 22, range: [0, 520], convertible: false, rango: "dispositivo", controlable: false }),
  sensor: D({ nombre: "Sensor", hp: 25, speed: 0, radius: 14, range: [0, 0], convertible: false, amenaza: 0, rango: "dispositivo", controlable: false }),
  robot: D({ nombre: "Robot de seguridad", hp: 230, speed: 95, radius: 24, range: [180, 380], amenaza: 3, convertible: false, rango: "elite", controlable: false }),
  cazador: D({ nombre: "Robot cazador", hp: 150, speed: 330, radius: 20, range: [0, 40], amenaza: 3, convertible: false, rango: "elite", controlable: false }),
  laser: D({ nombre: "Guardia láser", hp: 50, speed: 110, radius: 18, range: [520, 900], amenaza: 3 }),
  dron: D({ nombre: "Dron de control", hp: 60, speed: 190, radius: 16, range: [200, 340], amenaza: 2, convertible: false, rango: "dispositivo", controlable: false }),
  inspector: D({ nombre: "Inspector", hp: 60, speed: 120, radius: 17, range: [0, 0], amenaza: 0, rango: "npc", convertible: false }),
  tecnico: D({ nombre: "Técnico de auditoría", hp: 60, speed: 125, radius: 17, range: [0, 0], amenaza: 0, rango: "npc", convertible: false }),
  oficial: D({ nombre: "Oficial de evacuación", hp: 160, speed: 135, radius: 19, range: [200, 380], amenaza: 3, rango: "elite", convertible: false }),
  centinela: D({ nombre: "Centinela MK-II", hp: 2600, speed: 70, radius: 52, range: [240, 520], amenaza: 14, convertible: false, rango: "jefe", controlable: false }),
  director: D({ nombre: "Director Kessler · Exotraje OMEGA", hp: 4200, speed: 105, radius: 48, range: [260, 520], amenaza: 20, convertible: false, rango: "jefe", controlable: false }),
  generador: D({ nombre: "Generador de escudo", hp: 160, speed: 0, radius: 26, range: [0, 0], amenaza: 0, convertible: false, rango: "dispositivo", controlable: false }),
  nodo: D({ nombre: "Nodo de vigilancia", hp: 9999, speed: 0, radius: 24, range: [0, 0], amenaza: 0, convertible: false, rango: "dispositivo", controlable: false }),
  pilon: D({ nombre: "Pilón de energía", hp: 260, speed: 0, radius: 26, range: [0, 0], amenaza: 0, convertible: false, rango: "dispositivo", controlable: false }),
};

export interface AllyDef {
  nombre: string;
  radius: number;
  speed: number;
}
export const ALLIES: Record<AllyType, AllyDef> = {
  pulpo: { nombre: "Pulpo", radius: 16, speed: 270 },
  kraken: { nombre: "Kraken", radius: 26, speed: 210 },
  cria: { nombre: "Simbionte", radius: 17, speed: 250 },
  planta: { nombre: "Planta carnívora", radius: 22, speed: 0 },
  terminal: { nombre: "Terminal", radius: 26, speed: 0 },
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
  robot: { burst: 5, burstGap: 0.09, cooldown: 2.6, damage: 5, bulletSpeed: 720, frontArmor: 0.5 },
  cazador: { grabDps: 9, grabRange: 46, struggle: 0.12, freeAfter: 9, cooldown: 6, stunOnFree: 2.5 },
  laser: { aimTime: 2.3, lockAt: 1.8, bulletSpeed: 2400, cooldown: 6 },
  dron: { cooldown: 1.6, damage: 3, bulletSpeed: 600 },
  oficial: { burst: 4, burstGap: 0.1, cooldown: 2, damage: 5, bulletSpeed: 700 },
  centinela: { sweepSpeed: 1.1, sweepDps: 26, sweepRange: 620, missileEvery: 4, missileDamage: 32, missileRadius: 95, droneEvery: 14, armorMul: 0.15, ventTime: 6, chargeSpeed: 520, chargeDamage: 30 },
  director: { burst: 6, burstGap: 0.08, damage: 6, bulletSpeed: 760, grenadeEvery: 5, grenadeDamage: 36, grenadeRadius: 105, shieldMul: 0.1, reinforceEvery: 18, gridEvery: 9, gridDps: 30, dashSpeed: 640 },
};

export function enemyDef(t: string): EnemyDef | undefined {
  return (ENEMIES as Record<string, EnemyDef>)[t];
}

export function isConvertible(t: UnitType): boolean {
  const d = enemyDef(t);
  return Boolean(d?.convertible);
}

export function rangoDe(t: string): Rango {
  return enemyDef(t)?.rango ?? "npc";
}

export function unitRadius(t: string): number {
  const e = enemyDef(t);
  if (e) return e.radius;
  return (ALLIES as Record<string, AllyDef>)[t]?.radius ?? 18;
}
