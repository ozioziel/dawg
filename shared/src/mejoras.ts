// Mejoras temporales (roguelike): solo duran la partida actual.
// Cada alien tiene tres ramas combinables. Tras cada reto o jefe, el equipo recibe una
// recompensa cuya calidad depende del desempeño de TODO el equipo (no de las bajas):
// tiempo, daño recibido, caídas, curación, rescates, control y apoyo en puzzles.
import type { AlienKind } from "./aliens";

export type Rareza = "comun" | "rara" | "epica";
export const RAREZAS: Rareza[] = ["comun", "rara", "epica"];
export const MULT_RAREZA: Record<Rareza, number> = { comun: 1, rara: 1.6, epica: 2.4 };
export const NOMBRE_RAREZA: Record<Rareza, string> = { comun: "Común", rara: "Rara", epica: "Épica" };
export const COLOR_RAREZA: Record<Rareza, string> = { comun: "#cfe6ff", rara: "#3ef0ff", epica: "#ffb13e" };

/** Estadísticas que modifican las mejoras. Los valores son por acumulación de rareza común. */
export type Stat =
  // genéricas
  | "dano"
  | "cadencia"
  | "vida"
  | "velocidad"
  | "enfriamiento"
  | "cargaUlti"
  | "duracionUlti"
  | "resistencia"
  // Cambiaformas
  | "sospecha"
  | "energiaDisfraz"
  | "sorpresa"
  | "berserkDano"
  | "berserkRobo"
  // Del Mar
  | "pulpoVida"
  | "pulpoDano"
  | "coberturaVida"
  | "ecoRadio"
  | "krakenDano"
  // Telequinesis
  | "controlEnergia"
  | "escudoPsi"
  | "roboVida"
  | "lanzamiento"
  | "singularidadRadio"
  // Curandera
  | "curacion"
  | "veneno"
  | "captura"
  | "jardinCura"
  | "jardinPlantas"
  // Vesper
  | "punalada"
  | "pasoAlcance"
  | "salidaSombra"
  | "eclipseVelocidad"
  // Freeze
  | "frio"
  | "congelacion"
  | "muroVida"
  | "muroDuracion"
  | "ceroDuracion"
  // Escarabajo
  | "mordida"
  | "mordidaCd"
  | "excavar"
  | "tunelDuracion"
  // Simbionte
  | "infeccion"
  | "huesped"
  | "coloniaMax"
  | "fusionTentaculos";

export interface MejoraDef {
  id: string;
  alien: AlienKind;
  rama: number;
  nombre: string;
  /** Descripción con {v} = valor según la rareza. */
  desc: string;
  efectos: Partial<Record<Stat, number>>;
  /** Acumulaciones máximas. */
  max: number;
}

export const RAMAS: Record<AlienKind, [string, string, string]> = {
  cambiaformas: ["Infiltración", "Combate", "Berserk"],
  delmar: ["Evolución biológica", "Arquitectura coralina", "Dominio abisal"],
  inteligente: ["Dominio mental", "Defensa psíquica", "Manipulación avanzada"],
  curandera: ["Nutrición biológica", "Jardín depredador", "Depredadora"],
  vesper: ["Asesinato", "Desplazamiento sombrío", "Eclipse"],
  freeze: ["Criogenia", "Arquitectura glacial", "Cero Absoluto"],
  escarabajo: ["Depredador", "Excavador", "Arquitecto subterráneo"],
  simbionte: ["Infección", "Colmena", "Fusión Colosal"],
};

const M = (id: string, alien: AlienKind, rama: number, nombre: string, desc: string, efectos: Partial<Record<Stat, number>>, max = 3): MejoraDef => ({ id, alien, rama, nombre, desc, efectos, max });

export const MEJORAS: MejoraDef[] = [
  // Cambiaformas
  M("c-sigilo", "cambiaformas", 0, "Rostro convincente", "La sospecha sube un {v}% más despacio.", { sospecha: 0.18 }),
  M("c-bateria", "cambiaformas", 0, "Membrana elástica", "El disfraz gasta un {v}% menos de energía.", { energiaDisfraz: 0.2 }),
  M("c-escaneo", "cambiaformas", 0, "Escaneo rápido", "Habilidad un {v}% más rápida.", { enfriamiento: 0.12 }),
  M("c-sorpresa", "cambiaformas", 1, "Golpe sorpresa", "El primer disparo al salir del disfraz hace +{v}% de daño.", { sorpresa: 0.5 }),
  M("c-gatillo", "cambiaformas", 1, "Gatillo nervioso", "+{v}% de cadencia.", { cadencia: 0.1 }),
  M("c-balas", "cambiaformas", 1, "Munición robada", "+{v}% de daño.", { dano: 0.1 }),
  M("c-furia", "cambiaformas", 2, "Furia mutante", "Berserk hace +{v}% de daño.", { berserkDano: 0.18 }),
  M("c-sangre", "cambiaformas", 2, "Hambre de mutante", "Berserk roba +{v}% de vida.", { berserkRobo: 0.06 }),
  M("c-larga", "cambiaformas", 2, "Mutación prolongada", "Definitiva dura un {v}% más.", { duracionUlti: 0.15 }),
  // Del Mar
  M("d-pulpo", "delmar", 0, "Tentáculos reforzados", "Pulpos con +{v}% de vida.", { pulpoVida: 0.25 }),
  M("d-ventosa", "delmar", 0, "Ventosas ácidas", "Pulpos con +{v}% de daño.", { pulpoDano: 0.2 }),
  M("d-mutacion", "delmar", 0, "Mutación acelerada", "Transmutar se recarga un {v}% antes.", { enfriamiento: 0.1 }),
  M("d-coral", "delmar", 1, "Coral denso", "Coberturas con +{v}% de vida.", { coberturaVida: 0.3 }),
  M("d-arrecife", "delmar", 1, "Arrecife vivo", "+{v} de vida máxima.", { vida: 15 }),
  M("d-escamas", "delmar", 1, "Escamas de coral", "Recibes un {v}% menos de daño.", { resistencia: 0.06 }),
  M("d-marea", "delmar", 2, "Marea creciente", "Ecosistema con +{v}% de radio.", { ecoRadio: 0.15 }),
  M("d-kraken", "delmar", 2, "Kraken abisal", "Krakens con +{v}% de daño.", { krakenDano: 0.25 }),
  M("d-abismo", "delmar", 2, "Llamada del abismo", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  // Telequinesis
  M("t-voluntad", "inteligente", 0, "Voluntad férrea", "El control mental gasta un {v}% menos.", { controlEnergia: 0.18 }),
  M("t-titiritero", "inteligente", 0, "Titiritero", "Los guardias controlados hacen +{v}% de daño.", { dano: 0.12 }),
  M("t-foco", "inteligente", 0, "Foco mental", "Telequinesis se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("t-escudo", "inteligente", 1, "Coraza psíquica", "Escudo del cuerpo +{v}%.", { escudoPsi: 0.3 }),
  M("t-robo", "inteligente", 1, "Sifón vital", "El rayo psíquico roba un {v}% del daño como vida.", { roboVida: 0.06 }),
  M("t-calma", "inteligente", 1, "Calma interior", "Recibes un {v}% menos de daño.", { resistencia: 0.06 }),
  M("t-impulso", "inteligente", 2, "Impulso cinético", "Lanzamientos con +{v}% de daño.", { lanzamiento: 0.25 }),
  M("t-horizonte", "inteligente", 2, "Horizonte de sucesos", "Singularidad con +{v}% de radio.", { singularidadRadio: 0.15 }),
  M("t-masa", "inteligente", 2, "Masa crítica", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  // Curandera
  M("h-savia", "curandera", 0, "Savia nutritiva", "Curas un {v}% más al digerir.", { curacion: 0.2 }),
  M("h-raiz", "curandera", 0, "Raíz profunda", "+{v} de vida máxima.", { vida: 15 }),
  M("h-digestion", "curandera", 0, "Digestión rápida", "Devorar se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("h-jardin", "curandera", 1, "Jardín frondoso", "El jardín cura un {v}% más.", { jardinCura: 0.2 }),
  M("h-brote", "curandera", 1, "Brotes extra", "+{v} planta en el jardín.", { jardinPlantas: 1 }, 2),
  M("h-polen", "curandera", 1, "Polen fértil", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  M("h-veneno", "curandera", 2, "Espinas venenosas", "Las espinas envenenan: {v} de daño por segundo.", { veneno: 4 }),
  M("h-fauces", "curandera", 2, "Fauces anchas", "Captura un {v}% más lejos y traga élites más sanas.", { captura: 0.15 }),
  M("h-espinas", "curandera", 2, "Espinas aserradas", "+{v}% de daño.", { dano: 0.1 }),
  // Vesper
  M("v-filo", "vesper", 0, "Filo del vacío", "Puñalada por la espalda +{v}%.", { punalada: 0.25 }),
  M("v-rapidez", "vesper", 0, "Mano rápida", "Cuchillo un {v}% más rápido.", { cadencia: 0.1 }),
  M("v-hoja", "vesper", 0, "Hoja negra", "+{v}% de daño.", { dano: 0.1 }),
  M("v-alcance", "vesper", 1, "Sombra larga", "Paso sombrío llega un {v}% más lejos.", { pasoAlcance: 0.15 }),
  M("v-salida", "vesper", 1, "Salida protegida", "Tras el paso sombrío eres intocable {v} s.", { salidaSombra: 0.4 }),
  M("v-paso", "vesper", 1, "Paso ligero", "Paso sombrío se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("v-noche", "vesper", 2, "Noche eterna", "Eclipse dura un {v}% más.", { duracionUlti: 0.15 }),
  M("v-caos", "vesper", 2, "Caos nocturno", "Durante el Eclipse vas un {v}% más rápido.", { eclipseVelocidad: 0.12 }),
  M("v-luna", "vesper", 2, "Luna nueva", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  // Freeze
  M("f-escarcha", "freeze", 0, "Escarcha mordiente", "Congelas un {v}% más rápido.", { frio: 0.18 }),
  M("f-glaciar", "freeze", 0, "Corazón glaciar", "Las congelaciones duran un {v}% más.", { congelacion: 0.15 }),
  M("f-chorro", "freeze", 0, "Chorro a presión", "+{v}% de daño.", { dano: 0.12 }),
  M("f-muro", "freeze", 1, "Hielo compacto", "Muros con +{v}% de vida.", { muroVida: 0.3 }),
  M("f-permafrost", "freeze", 1, "Permafrost", "Muros duran un {v}% más.", { muroDuracion: 0.2 }),
  M("f-cristal", "freeze", 1, "Cristalización", "Muro de hielo se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("f-cero", "freeze", 2, "Cero más profundo", "Cero Absoluto congela un {v}% más.", { ceroDuracion: 0.2 }),
  M("f-invierno", "freeze", 2, "Invierno largo", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  M("f-coraza", "freeze", 2, "Coraza de hielo", "Recibes un {v}% menos de daño.", { resistencia: 0.06 }),
  // Escarabajo
  M("e-fauces", "escarabajo", 0, "Mandíbulas de acero", "Mordida +{v}% contra élites y jefes.", { mordida: 0.2 }),
  M("e-hambre", "escarabajo", 0, "Hambre voraz", "Mordida se recarga un {v}% antes (nunca menos de 3 s).", { mordidaCd: 0.06 }),
  M("e-caparazon", "escarabajo", 0, "Caparazón", "+{v} de vida máxima.", { vida: 18 }),
  M("e-excavar", "escarabajo", 1, "Garras excavadoras", "Bajo tierra vas un {v}% más rápido y gastas menos.", { excavar: 0.12 }),
  M("e-galeria", "escarabajo", 1, "Galerías", "Excavación se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("e-patas", "escarabajo", 1, "Patas inquietas", "+{v}% de velocidad.", { velocidad: 0.05 }),
  M("e-tunel", "escarabajo", 2, "Túnel estable", "El túnel dura un {v}% más.", { tunelDuracion: 0.25 }),
  M("e-colonia", "escarabajo", 2, "Instinto de colonia", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
  M("e-red", "escarabajo", 2, "Red subterránea", "Recibes un {v}% menos de daño.", { resistencia: 0.06 }),
  // Simbionte
  M("s-esporas", "simbionte", 0, "Esporas virulentas", "Infectas un {v}% más por impacto.", { infeccion: 0.2 }),
  M("s-fragmentos", "simbionte", 0, "Fragmentos afilados", "+{v}% de daño.", { dano: 0.12 }),
  M("s-lluvia", "simbionte", 0, "Lluvia parasitaria", "+{v}% de cadencia.", { cadencia: 0.1 }),
  M("s-huesped", "simbionte", 1, "Huéspedes robustos", "Huéspedes con +{v}% de vida y daño.", { huesped: 0.2 }),
  M("s-colmena", "simbionte", 1, "Colmena", "+{v} huésped máximo.", { coloniaMax: 1 }, 2),
  M("s-vinculo", "simbionte", 1, "Vínculo", "Asimilar se recarga un {v}% antes.", { enfriamiento: 0.12 }),
  M("s-tentaculos", "simbionte", 2, "Tentáculos largos", "La Fusión agarra un {v}% más lejos y más rápido.", { fusionTentaculos: 0.15 }),
  M("s-coloso", "simbionte", 2, "Coloso", "La Fusión dura un {v}% más.", { duracionUlti: 0.15 }),
  M("s-hambre", "simbionte", 2, "Hambre colosal", "Definitiva se carga un {v}% más rápido.", { cargaUlti: 0.12 }),
];

export const MEJORA_POR_ID: Record<string, MejoraDef> = Object.fromEntries(MEJORAS.map((m) => [m.id, m]));

/** Mejora tomada: "id:rareza". */
export function parseMejora(s: string): { def: MejoraDef; rareza: Rareza } | null {
  const [id, r] = s.split(":");
  const def = MEJORA_POR_ID[id];
  if (!def || !RAREZAS.includes(r as Rareza)) return null;
  return { def, rareza: r as Rareza };
}

/** Suma de efectos de las mejoras del jugador aplicables a su forma actual. */
export function statsDe(mejoras: Iterable<string>, forma: string): Record<Stat, number> {
  const out = {} as Record<Stat, number>;
  for (const s of mejoras) {
    const m = parseMejora(s);
    if (!m || m.def.alien !== forma) continue;
    for (const [k, v] of Object.entries(m.def.efectos)) out[k as Stat] = (out[k as Stat] ?? 0) + (v as number) * MULT_RAREZA[m.rareza];
  }
  return out;
}

export function textoMejora(def: MejoraDef, rareza: Rareza): string {
  const v = Object.values(def.efectos)[0] ?? 0;
  const val = v * MULT_RAREZA[rareza];
  const shown = Math.abs(val) < 1 ? Math.round(val * 100) : Math.round(val * 10) / 10;
  return def.desc.replace("{v}", String(shown));
}

/** Desempeño del equipo (0..1) a partir de lo ocurrido en un reto o jefe. */
export interface Desempeno {
  segundos: number;
  esperado: number;
  danoRecibido: number;
  vidaEquipo: number;
  caidas: number;
  curacion: number;
  rescates: number;
  control: number;
  apoyo: number;
}

export function puntuarDesempeno(d: Desempeno): number {
  const tiempo = Math.max(0, Math.min(1, 1.4 - d.segundos / Math.max(1, d.esperado)));
  const dano = Math.max(0, 1 - d.danoRecibido / Math.max(1, d.vidaEquipo * 1.2));
  const vivos = d.caidas === 0 ? 1 : Math.max(0, 1 - d.caidas * 0.35);
  // El apoyo (curar, rescatar, controlar, ayudar en puzzles) cuenta tanto como lo demás.
  const apoyo = Math.min(1, d.curacion / 120 + d.rescates * 0.25 + d.control / 30 + d.apoyo * 0.2);
  return Math.max(0, Math.min(1, tiempo * 0.3 + dano * 0.25 + vivos * 0.25 + apoyo * 0.2));
}

/** Probabilidades de rareza según la puntuación del equipo. */
export function tirarRareza(puntuacion: number, r: () => number): Rareza {
  const pe = 0.04 + 0.36 * puntuacion;
  const pr = 0.22 + 0.25 * puntuacion;
  const x = r();
  if (x < pe) return "epica";
  if (x < pe + pr) return "rara";
  return "comun";
}

/** Ofrece 3 mejoras distintas del alien (de ramas distintas si se puede), sin superar el máximo. */
export function ofrecerMejoras(alien: AlienKind, tomadas: string[], puntuacion: number, r: () => number): string[] {
  const cuenta = new Map<string, number>();
  for (const t of tomadas) {
    const id = t.split(":")[0];
    cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }
  const disponibles = MEJORAS.filter((m) => m.alien === alien && (cuenta.get(m.id) ?? 0) < m.max);
  const out: string[] = [];
  const ramas = [0, 1, 2].sort(() => r() - 0.5);
  for (const rama of ramas) {
    const op = disponibles.filter((m) => m.rama === rama && !out.some((o) => o.startsWith(m.id + ":")));
    if (!op.length) continue;
    const m = op[Math.floor(r() * op.length)];
    out.push(`${m.id}:${tirarRareza(puntuacion, r)}`);
  }
  while (out.length < 3) {
    const op = disponibles.filter((m) => !out.some((o) => o.startsWith(m.id + ":")));
    if (!op.length) break;
    const m = op[Math.floor(r() * op.length)];
    out.push(`${m.id}:${tirarRareza(puntuacion, r)}`);
  }
  return out;
}
