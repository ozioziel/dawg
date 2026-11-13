// Los ocho aliens jugables: identidad, ataque básico, habilidad activa y definitiva.
// Los números de balance de cada habilidad están en HAB (servidor y cliente los comparten).

export const ALIEN_KINDS = ["cambiaformas", "delmar", "inteligente", "curandera", "vesper", "freeze", "escarabajo", "simbionte"] as const;
export type AlienKind = (typeof ALIEN_KINDS)[number];

/** Letra de cada alien en el catálogo de equipos (orden canónico C, D, T, H, V, F, E, S). */
export const LETRA: Record<AlienKind, string> = {
  cambiaformas: "C",
  delmar: "D",
  inteligente: "T",
  curandera: "H",
  vesper: "V",
  freeze: "F",
  escarabajo: "E",
  simbionte: "S",
};
export const ORDEN_LETRAS = "CDTHVFES";

export function kindDeLetra(l: string): AlienKind | undefined {
  return ALIEN_KINDS.find((k) => LETRA[k] === l);
}

/** Clave canónica de un equipo: letras sin repetir en orden C-D-T-H-V-F-E-S (p. ej. "C-T-S"). */
export function claveRoster(kinds: readonly string[]): string {
  const letras = [...new Set(kinds.filter(isAlienKind).map((k) => LETRA[k]))];
  letras.sort((a, b) => ORDEN_LETRAS.indexOf(a) - ORDEN_LETRAS.indexOf(b));
  return letras.join("-");
}

export type Ataque =
  | { tipo: "proyectil"; nombre: string; damage: number; fireRate: number; bulletSpeed: number; range: number; pierce: number; projectile: string }
  | { tipo: "melee"; nombre: string; damage: number; cooldown: number; range: number; arco: number }
  | { tipo: "chorro"; nombre: string; dps: number; range: number; cono: number; frio: number };

export interface AlienDef {
  kind: AlienKind;
  letra: string;
  nombre: string;
  rol: string;
  descripcion: string;
  color: number;
  colorCss: string;
  hp: number;
  speed: number;
  ataque: Ataque;
  habilidad: { nombre: string; desc: string; cooldown: number };
  ulti: { nombre: string; desc: string; carga: number; duracion: number };
  /** Recurso propio que se ve en el HUD (energía del disfraz, psíquica, de excavación…). */
  recurso?: string;
}

export const ALIENS: Record<AlienKind, AlienDef> = {
  cambiaformas: {
    kind: "cambiaformas",
    letra: "C",
    nombre: "Cambiaformas",
    rol: "Infiltración y daño oportunista",
    descripcion: "Escanea guardias vivos para copiar su identidad y colarse. Disparar rompe el disfraz. Definitiva: Mutación Berserk.",
    color: 0x7fb24a,
    colorCss: "#7fb24a",
    hp: 120,
    speed: 215,
    ataque: { tipo: "proyectil", nombre: "Pistola robada", damage: 14, fireRate: 4, bulletSpeed: 950, range: 700, pierce: 0, projectile: "bala" },
    habilidad: { nombre: "Escanear identidad", desc: "Junto a un guardia vivo: copia su identidad. Sin guardia cerca: ponte o quítate el disfraz.", cooldown: 1.5 },
    ulti: { nombre: "Mutación Berserk", desc: "Forma salvaje cuerpo a cuerpo: más daño, velocidad y resistencia.", carga: 70, duracion: 10 },
    recurso: "Disfraz",
  },
  delmar: {
    kind: "delmar",
    letra: "D",
    nombre: "Del Mar",
    rol: "Apoyo, transmutación y control del terreno",
    descripcion: "Organismo marino experimental. Transmuta guardias en pulpos aliados y objetos en coberturas (máx. 3). Definitiva: Ecosistema Mutante.",
    color: 0xf08a24,
    colorCss: "#f08a24",
    hp: 150,
    speed: 195,
    ataque: { tipo: "proyectil", nombre: "Lanza de energía", damage: 22, fireRate: 2.5, bulletSpeed: 780, range: 650, pierce: 1, projectile: "energia" },
    habilidad: { nombre: "Transmutación", desc: "Guardia → pulpo aliado. Barril, caja o torreta → cobertura. Máximo 3 a la vez.", cooldown: 5 },
    ulti: { nombre: "Ecosistema Mutante", desc: "La zona se vuelve marina: ralentiza enemigos y todos tus pulpos se vuelven krakens.", carga: 80, duracion: 10 },
  },
  inteligente: {
    kind: "inteligente",
    letra: "T",
    nombre: "Telequinesis",
    rol: "Control psíquico a distancia",
    descripcion: "Mueve y lanza objetos y guardias, acciona mecanismos lejanos y controla la mente de un guardia. Definitiva: Singularidad Psíquica.",
    color: 0xa58cf0,
    colorCss: "#a58cf0",
    hp: 110,
    speed: 205,
    ataque: { tipo: "proyectil", nombre: "Rayo psíquico", damage: 10, fireRate: 6, bulletSpeed: 1050, range: 620, pierce: 0, projectile: "psiquico" },
    habilidad: { nombre: "Telequinesis", desc: "Toque: lanzar objeto o guardia / accionar interruptor. Mantener sobre un guardia: control mental.", cooldown: 4 },
    ulti: { nombre: "Singularidad Psíquica", desc: "Atrae enemigos y objetos a un punto, los suspende y los expulsa con daño.", carga: 75, duracion: 2.4 },
    recurso: "Psique",
  },
  curandera: {
    kind: "curandera",
    letra: "H",
    nombre: "Curandera",
    rol: "Sanación, captura y apoyo",
    descripcion: "Planta carnívora alienígena. Atrapa a un guardia vivo y lo digiere para curar a quien esté muy cerca. Definitiva: Jardín Carnívoro.",
    color: 0x5fd068,
    colorCss: "#5fd068",
    hp: 135,
    speed: 200,
    ataque: { tipo: "proyectil", nombre: "Espinas orgánicas", damage: 12, fireRate: 3.2, bulletSpeed: 760, range: 520, pierce: 0, projectile: "espina" },
    habilidad: { nombre: "Devorar y curar", desc: "1.º: atrapa a un guardia vivo (no puedes atacar). 2.º: lo digieres y curas a los aliados muy cerca.", cooldown: 3 },
    ulti: { nombre: "Jardín Carnívoro", desc: "Brotan plantas que atrapan y muerden enemigos; el jardín cura sin parar a los aliados dentro.", carga: 85, duracion: 10 },
  },
  vesper: {
    kind: "vesper",
    letra: "V",
    nombre: "Vesper",
    rol: "Asesino de sombras",
    descripcion: "Vesper/Void: un solo asesino. Cuchillo cuerpo a cuerpo y teletransporte detrás de un guardia. Definitiva: Eclipse.",
    color: 0x7a5cff,
    colorCss: "#9a7cff",
    hp: 105,
    speed: 235,
    ataque: { tipo: "melee", nombre: "Cuchillo", damage: 26, cooldown: 0.38, range: 74, arco: 100 },
    habilidad: { nombre: "Paso sombrío", desc: "Apunta a un guardia: apareces a su espalda. Tu siguiente puñalada hace mucho más daño.", cooldown: 6 },
    ulti: { nombre: "Eclipse", desc: "Oscurece el mapa: los guardias disparan a ciegas y sus balas hieren a otros guardias.", carga: 65, duracion: 9 },
  },
  freeze: {
    kind: "freeze",
    letra: "F",
    nombre: "Freeze",
    rol: "Congelación y defensa",
    descripcion: "Lanzallamas de hielo: poco daño, pero congela poco a poco. Coloca muros de hielo. Definitiva: Cero Absoluto.",
    color: 0x6fd6ff,
    colorCss: "#6fd6ff",
    hp: 140,
    speed: 190,
    ataque: { tipo: "chorro", nombre: "Lanzallamas de hielo", dps: 11, range: 220, cono: 28, frio: 55 },
    habilidad: { nombre: "Muro de hielo", desc: "Coloca un muro de hielo donde apuntas: cobertura que bloquea rutas y disparos.", cooldown: 7 },
    ulti: { nombre: "Cero Absoluto", desc: "Congela al instante a todos los enemigos de la sala actual.", carga: 80, duracion: 5 },
  },
  escarabajo: {
    kind: "escarabajo",
    letra: "E",
    nombre: "Escarabajo",
    rol: "Ejecución y movilidad bajo tierra",
    descripcion: "Inquietante. Mordida letal contra guardias normales con un enfriamiento enorme. Excava y viaja bajo el suelo. Definitiva: Túnel de Escape.",
    color: 0x8fae3a,
    colorCss: "#a8c84a",
    hp: 145,
    speed: 215,
    ataque: { tipo: "melee", nombre: "Mordida letal", damage: 150, cooldown: 4.5, range: 78, arco: 80 },
    habilidad: { nombre: "Excavación", desc: "Te entierras y te mueves muy rápido bajo el suelo (las balas no te alcanzan). Repite para salir.", cooldown: 6 },
    ulti: { nombre: "Túnel de Escape", desc: "1.º marca la entrada, 2.º la salida: el equipo viaja al instante de un extremo al otro.", carga: 80, duracion: 14 },
    recurso: "Excavar",
  },
  simbionte: {
    kind: "simbionte",
    letra: "S",
    nombre: "Simbionte",
    rol: "Infección, colonia y dominación",
    descripcion: "Parásito. Sus fragmentos infectan; con la barra llena absorbe (E) o asimila (habilidad) al guardia. Definitiva: Fusión Colosal.",
    color: 0xc04fd8,
    colorCss: "#d36be8",
    hp: 125,
    speed: 205,
    ataque: { tipo: "proyectil", nombre: "Fragmentos parasitarios", damage: 6, fireRate: 3.5, bulletSpeed: 820, range: 560, pierce: 0, projectile: "fragmento" },
    habilidad: { nombre: "Asimilación / órdenes", desc: "Sobre un infectado: lo vuelves huésped aliado. En el suelo: envías un huésped a ese punto. Sobre ti: reagrupar.", cooldown: 1.2 },
    ulti: { nombre: "Fusión Colosal", desc: "Toda la colonia se fusiona en un monstruo gigante con tentáculos. Al acabar, la colonia se pierde.", carga: 90, duracion: 6 },
  },
};

/** Parámetros de las habilidades (balance inicial). */
export const HAB = {
  cambiaformas: {
    scanRange: 130,
    scanTime: 1.1,
    maxEnergy: 100,
    drainPerSec: 1.4,
    rechargePerSec: 9,
    minToActivate: 20,
    /** Sospecha por segundo cerca de guardias (a menos de suspicionRange). */
    suspicionNear: 0.09,
    suspicionRange: 230,
    /** Extra si el guardia original copiado está cerca. */
    suspicionOriginal: 0.25,
    suspicionRestricted: 0.12,
    suspicionDecay: 0.06,
    suspicionPerDamage: 0.012,
    surpriseBonus: 1.6,
    berserk: { damage: 38, cooldown: 0.36, range: 84, speedMul: 1.35, damageTaken: 0.65, lifesteal: 0.15 },
  },
  delmar: {
    range: 420,
    maxActive: 3,
    pulpoHp: 45,
    pulpoLife: 18,
    pulpoDamage: 14,
    pulpoSpeed: 270,
    coverHp: 170,
    coverLife: 25,
    /** Las élites deben estar por debajo de esta fracción de vida para transmutarlas. */
    eliteThreshold: 0.4,
    eco: { radius: 430, slow: 0.5, krakenHp: 140, krakenDamage: 30, krakenRange: 130, krakenSpeed: 210 },
  },
  inteligente: {
    range: 460,
    throwDamage: 45,
    throwSpeed: 900,
    stun: 1.2,
    holdTime: 0.45,
    maxEnergy: 100,
    controlDrain: 6.5,
    controlShotCost: 2.5,
    rechargePerSec: 7,
    minToControl: 25,
    shield: 70,
    controlRange: 1400,
    singularidad: { radius: 330, pull: 2.2, damage: 60, stun: 2, knock: 220 },
  },
  curandera: {
    captureRange: 115,
    heal: 50,
    healRadius: 170,
    eliteThreshold: 0.4,
    biteBoss: 45,
    jardin: { radius: 300, healPerSec: 9, plants: 5, plantDamage: 18, root: 1.2, plantRange: 140 },
  },
  vesper: {
    range: 480,
    backstabWindow: 3,
    backstabMul: 3,
    behindMul: 1.5,
    eclipseSpread: 2.6,
  },
  freeze: {
    freezeAt: 100,
    freezeTime: 2.6,
    bossFrioMul: 0.25,
    bossFreezeTime: 0.9,
    frioDecay: 30,
    wallRange: 320,
    wallBlocks: 3,
    wallHp: 140,
    wallLife: 9,
    wallRadius: 26,
    ceroBoss: 1.5,
  },
  escarabajo: {
    maxEnergy: 100,
    burrowDrain: 18,
    rechargePerSec: 14,
    minToBurrow: 30,
    burrowSpeedMul: 2.1,
    emergeDamage: 20,
    emergeRadius: 95,
    biteElite: 150,
    biteBoss: 120,
    tunnelMaxDist: 1100,
    tunnelPlaceTime: 10,
  },
  simbionte: {
    infectPerHit: 0.34,
    eliteInfectMul: 0.5,
    absorbHeal: 35,
    absorbRange: 120,
    colonyMax: 6,
    hostStageTime: 20,
    hostHp: 70,
    criaHp: 80,
    criaDamage: 12,
    criaSpeed: 250,
    infectAura: 0.08,
    fusion: { baseTime: 6, perUnitTime: 1.2, range: 360, perUnitRange: 22, damage: 70, perUnitDamage: 12, grabEvery: 0.9, perUnitGrab: 0.08, shield: 60, perUnitShield: 25 },
  },
} as const;

/** Carga de definitiva extra por acción (se suma a la carga por tiempo). */
export const CARGA_ULTI = { porDanio: 0.0009, porCuracion: 0.002, porReto: 0.18, porRescate: 0.08 };

export function isAlienKind(v: unknown): v is AlienKind {
  return typeof v === "string" && (ALIEN_KINDS as readonly string[]).includes(v);
}
