// Los tres aliens jugables: stats, arma y habilidad.

export const ALIEN_KINDS = ["cambiaformas", "delmar", "inteligente"] as const;
export type AlienKind = (typeof ALIEN_KINDS)[number];

export type AbilityKind = "disfraz" | "transmutar" | "telequinesis";

export interface WeaponDef {
  nombre: string;
  damage: number;
  /** Disparos por segundo. */
  fireRate: number;
  bulletSpeed: number;
  /** Alcance en píxeles. */
  range: number;
  /** Atraviesa enemigos. */
  pierce: number;
  projectile: "bala" | "energia" | "psiquico";
}

export interface AlienDef {
  kind: AlienKind;
  nombre: string;
  descripcion: string;
  color: number;
  colorCss: string;
  hp: number;
  speed: number;
  weapon: WeaponDef;
  ability: AbilityKind;
}

export const ALIENS: Record<AlienKind, AlienDef> = {
  cambiaformas: {
    kind: "cambiaformas",
    nombre: "Cambiaformas",
    descripcion: "Se disfraza de humano: los soldados no lo atacan mientras dure el disfraz.",
    color: 0x7fb24a,
    colorCss: "#7fb24a",
    hp: 120,
    speed: 215,
    weapon: { nombre: "Pistola robada", damage: 14, fireRate: 4, bulletSpeed: 950, range: 700, pierce: 0, projectile: "bala" },
    ability: "disfraz",
  },
  delmar: {
    kind: "delmar",
    nombre: "Del mar",
    descripcion: "Transmuta: convierte objetos en cobertura y soldados en pulpos (máx. 3).",
    color: 0xf08a24,
    colorCss: "#f08a24",
    hp: 150,
    speed: 195,
    weapon: { nombre: "Lanza de energía", damage: 22, fireRate: 2.5, bulletSpeed: 780, range: 650, pierce: 1, projectile: "energia" },
    ability: "transmutar",
  },
  inteligente: {
    kind: "inteligente",
    nombre: "Inteligente",
    descripcion: "Telequinesis: levanta y lanza enemigos u objetos, activa cosas a distancia.",
    color: 0xa58cf0,
    colorCss: "#a58cf0",
    hp: 110,
    speed: 205,
    weapon: { nombre: "Rayo psíquico", damage: 10, fireRate: 6, bulletSpeed: 1050, range: 620, pierce: 0, projectile: "psiquico" },
    ability: "telequinesis",
  },
};

export const ABILITY_OF: Record<AlienKind, AbilityKind> = {
  cambiaformas: "disfraz",
  delmar: "transmutar",
  inteligente: "telequinesis",
};

export const ABILITY_NAMES: Record<AbilityKind, string> = {
  disfraz: "Disfraz",
  transmutar: "Transmutar",
  telequinesis: "Telequinesis",
};

/** Disfraz: barra de energía que se gasta mientras está activo. */
export const DISFRAZ = {
  maxEnergy: 100,
  drainPerSec: 2.2,
  /** Cada punto de daño recibido gasta este múltiplo de energía. */
  damageDrain: 2,
  shotCost: 7,
  rechargePerSec: 9,
  minToActivate: 25,
};

/** Transmutar: enfriamiento entre usos y máximo de conversiones activas. */
export const TRANSMUTAR = {
  cooldown: 5,
  range: 420,
  maxActive: 3,
  pulpoHp: 45,
  pulpoLife: 18,
  pulpoDamage: 14,
  pulpoSpeed: 270,
  coverHp: 170,
  coverLife: 25,
};

/** Telequinesis: levantar y lanzar. */
export const TELEQUINESIS = {
  cooldown: 4,
  range: 460,
  throwDamage: 45,
  throwSpeed: 900,
  stun: 1.2,
};

export function isAlienKind(v: unknown): v is AlienKind {
  return typeof v === "string" && (ALIEN_KINDS as readonly string[]).includes(v);
}
