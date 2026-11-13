// Retos (puzzles) del mundo y planificador de la partida.
// - Cada alien tiene una TAREA propia en cada sector (24 en total, del catálogo de diseño).
// - Además hay EXTRAS: retos genéricos que cualquier equipo puede resolver y retos clásicos
//   del laboratorio que necesitan aliens concretos (memoria, cara, rayos, puente, válvulas…).
// - El planificador reparte retos entre las salas de cada sector según el equipo elegido,
//   sin repetir ningún reto ni patrón de solución en toda la partida.
import { ALIEN_KINDS, LETRA, claveRoster, kindDeLetra, type AlienKind } from "./aliens";
import { CATALOGO, COMPLICACIONES_TEXTO, OBJETIVO_SECTOR, SALAS_SECTOR, TAREA_TEXTO } from "./catalogo";

export type Sector = 1 | 2 | 3;
export const SECTORES: Sector[] = [1, 2, 3];

export const NOMBRE_SECTOR: Record<Sector, string> = {
  1: "Sector I · Incubadoras",
  2: "Sector II · Complejo de Xenogenética",
  3: "Sector III · Protocolo de fuga",
};

export interface RetoDef {
  id: string;
  tipo: "tarea" | "extra" | "legado";
  nombre: string;
  /** Aliens que deben estar en el equipo. */
  requiere: AlienKind[];
  /** Sectores donde puede aparecer. */
  sectores: Sector[];
  /** Si solo puede ir en ciertas salas. */
  salas?: string[];
  /** Patrón de solución: nunca se repite en una partida. */
  patron: string;
  /** Instrucciones cortas para el HUD. */
  instrucciones: string;
  /** Texto de diseño (catálogo) para las tareas. */
  texto?: string;
  /** Minijuego de interfaz que abre (si tiene). */
  minijuego?: string;
}

const T = (id: string, alien: AlienKind, sector: Sector, nombre: string, patron: string, instrucciones: string, minijuego?: string): RetoDef => ({
  id,
  tipo: "tarea",
  nombre,
  requiere: [alien],
  sectores: [sector],
  patron,
  instrucciones,
  texto: TAREA_TEXTO[`${sector}${LETRA[alien]}`],
  minijuego,
});

export const RETOS: Record<string, RetoDef> = {};
const add = (r: RetoDef) => (RETOS[r.id] = r);

// ---------------------------------------------------------------- tareas (alien × sector)
add(T("t1C", "cambiaformas", 1, "Credencial del inspector", "credencial", "Escanea vivo al Inspector (habilidad junto a él), disfrázate de él, lee el código en su consola (E) y márcalo en el teclado (E).", "codigo"));
add(T("t2C", "cambiaformas", 2, "Control de identidad", "control-identidad", "Copia al Técnico de auditoría, cruza los arcos de control disfrazado de él, toma la clave (E) y llévala al terminal (E)."));
add(T("t3C", "cambiaformas", 3, "Sello de evacuación", "sello", "Escanea al Oficial de evacuación (está armado), disfrázate de él y mantén E en el terminal de emergencia sin que te descubran."));
add(T("t1D", "delmar", 1, "Cinta de incubación", "cinta", "Transmuta (habilidad) los componentes de la cinta que coinciden con el símbolo de cada hueco del conducto."));
add(T("t2D", "delmar", 2, "Calibración rítmica", "ritmo", "Ejecuta la secuencia rítmica en el bio-reactor (E) y luego transmuta el depósito inerte en soporte.", "ritmo"));
add(T("t3D", "delmar", 3, "Juntas orgánicas", "juntas", "Las válvulas se deterioran: transmútalas (habilidad) en juntas orgánicas para mantener la presión hasta llenar el medidor."));
add(T("t1T", "inteligente", 1, "Celda energética", "celda", "Mira la pauta del proyector (E). Toma la celda con telequinesis y colócala en las ranuras tras el blindaje en ese orden."));
add(T("t2T", "inteligente", 2, "Guardia títere", "titere", "La valla láser solo deja pasar humanos: controla la mente de un guardia (mantén la habilidad) y llévalo hasta el interruptor (E)."));
add(T("t3T", "inteligente", 3, "Regulador flotante", "regulador", "Sujeta el regulador con telequinesis (mantén la habilidad) dentro del anillo mientras se sincroniza el cierre."));
add(T("t1H", "curandera", 1, "Raíces de nutrición", "raices", "Desde la barrera biológica (E) lleva una raíz hasta cada uno de los tres nodos de nutrición (E) sin que te aturdan."));
add(T("t2H", "curandera", 2, "Síntesis de enzima", "enzima", "Recoge las dos muestras que pide el sintetizador, devora a un guardia y digiérelo junto al sintetizador como catalizador."));
add(T("t3H", "curandera", 3, "Bomba de drenaje", "drenaje", "Siembra raíces en la primera rejilla (E) y nutre cada tramo (mantén E) hasta llegar a la bomba de emergencia."));
add(T("t1V", "vesper", 1, "Anclas de sombra", "anclas", "El terminal está en una plataforma aislada: salta detrás de los centinelas de cada plataforma (habilidad) hasta llegar y pulsa E."));
add(T("t2V", "vesper", 2, "Corredor de focos", "focos", "Cruza el corredor sin pisar la luz: salta detrás de las patrullas que van en sombra y pulsa el control umbrío (E)."));
add(T("t3V", "vesper", 3, "Cierres en cadena", "cierres", "Al tocar el primer cierre empieza la cuenta: encadena saltos detrás de los centinelas y acciona los cuatro cierres (E) a tiempo."));
add(T("t1F", "freeze", 1, "Tubería sobrecargada", "tuberia", "Enfría la tubería con tu chorro hasta vaciar el calor, coloca un muro de hielo en la marca para desviar el vapor y cierra la válvula (E)."));
add(T("t2F", "freeze", 2, "Pasarela helada", "pasarela", "Pon un muro de hielo sobre el hueco para crear una pasarela, crúzala y enfría la célula de contención con el chorro."));
add(T("t3F", "freeze", 3, "Cierres helados", "cierres-frio", "Mantén fríos los tres cierres con el chorro y tapa la fuga con un muro de hielo hasta completar la sincronización."));
add(T("t1E", "escarabajo", 1, "Interruptor sísmico", "sismico", "Excava (habilidad) bajo los contenedores sin cruzar el suelo agrietado y pulsa E bajo el interruptor sísmico."));
add(T("t2E", "escarabajo", 2, "Galería secreta", "galeria", "Bajo tierra se ven las placas numeradas: pásalas enterrado y pulsa E en cada una en orden."));
add(T("t3E", "escarabajo", 3, "Ruta bajo el cerrojo", "ruta-tunel", "Enterrado, mantén E sobre el suelo blando para abrir un túnel bajo el muro; cualquiera puede cruzarlo y tirar de la palanca (E)."));
add(T("t1S", "simbionte", 1, "Lector de seguridad", "lector", "Infecta a un guardia con tus fragmentos, asimílalo (habilidad) y ordénale (habilidad en el suelo) que se quede sobre el lector."));
add(T("t2S", "simbionte", 2, "Estaciones biométricas", "biometria", "Envía dos huéspedes a las dos estaciones biométricas y, con ambas ocupadas, infecta el nodo secundario con tus fragmentos."));
add(T("t3S", "simbionte", 3, "Seguros de la compuerta", "seguros", "Envía huéspedes a cada seguro hasta estabilizarlo. Junto a un seguro, E sacrifica un huésped para estabilizarlo al instante."));

// ---------------------------------------------------------------- extras genéricos (cualquier equipo)
const G = (id: string, nombre: string, patron: string, instrucciones: string): RetoDef => ({ id, tipo: "extra", nombre, requiere: [], sectores: [1, 2, 3], patron, instrucciones });
add(G("x-fusibles", "Fusibles de emergencia", "fusibles", "Encuentra los tres fusibles de la sala (pasa por encima) y llévalos al panel (E)."));
add(G("x-terminal", "Pirateo del terminal", "terminal", "Quédense dentro del círculo del terminal: cuantos más dentro, más rápido avanza. Si se vacía, retrocede."));
add(G("x-generadores", "Generadores de escudo", "generadores", "Destruyan los generadores. Cuando cae uno, los demás se blindan unos segundos."));
add(G("x-espejos", "Espejos del láser", "espejos", "Gira los espejos (E) para llevar el rayo hasta el receptor."));
add(G("x-carro", "Carro de muestras", "carro", "Escolta el carro: avanza si hay un alien cerca y se detiene si hay guardias encima."));
add(G("x-saboteador", "El saboteador", "saboteador", "Un técnico huye con la tarjeta hacia la alarma: atrápalo, recoge la tarjeta y llévala al lector (E)."));
add(G("x-purga", "Purga de gas", "purga", "Cierra las cuatro válvulas de purga (mantén E) mientras el gas se extiende."));
add(G("x-luces", "Rejilla de luces", "luces", "Pisa las baldosas: cada una cambia ella y sus vecinas. Enciende las nueve."));

// ---------------------------------------------------------------- retos clásicos del laboratorio (necesitan aliens concretos)
const L = (id: string, nombre: string, requiere: AlienKind[], patron: string, instrucciones: string, sectores: Sector[], minijuego?: string, salas?: string[]): RetoDef => ({ id, tipo: "legado", nombre, requiere, sectores, patron, instrucciones, minijuego, salas });
add(L("l-memoria", "Memoria psíquica", ["inteligente"], "memoria", "Telequinesis: E en la consola y repite el orden en que se iluminan las zonas del cerebro.", [1, 2], "memoria"));
add(L("l-cara", "Copia la cara", ["cambiaformas"], "cara", "Cambiaformas disfrazado: E en el escáner y arma la cara que pide.", [1, 2], "cara"));
add(L("l-transmutacion", "Transmutación", ["delmar"], "transmutacion", "Del Mar: E en la consola y convierte cada objeto en lo que pide su cartel.", [1, 2], "transmutacion"));
add(L("l-rayos", "Sala de rayos", ["cambiaformas", "inteligente"], "rayos", "El Cambiaformas disfrazado lee el código en la consola; Telequinesis activa los interruptores en ese orden.", [1, 2], "rayos"));
add(L("l-puente", "Puente sobre el ácido", ["inteligente", "delmar"], "puente", "Telequinesis coloca bloques sobre el ácido y Del Mar los transmuta en puente antes de que se hundan.", [1], undefined, ["r5"]));
add(L("l-valvulas", "Válvulas a la vez", ["cambiaformas", "delmar"], "valvulas", "Cada uno en su palanca (E): sigan las órdenes «solo A», «solo B» o «¡AMBOS!».", [1, 2], "valvulas"));

export function retoDef(id: string): RetoDef | undefined {
  return RETOS[id];
}

export function tareaDe(sector: Sector, alien: AlienKind): RetoDef {
  return RETOS[`t${sector}${LETRA[alien]}`];
}

// ---------------------------------------------------------------- salas
export interface SlotDef {
  id: string;
  sector: Sector;
  nombre: string;
  /** Siempre activa (está en el camino principal). */
  obligatoria?: boolean;
  /** Solo admite estos retos (salas con geometría especial). */
  soloRetos?: string[];
  /** Puerta que la sella si no se usa. */
  puerta?: string;
}

export const SLOTS: SlotDef[] = [
  { id: "r1", sector: 1, nombre: "Cámara de contención", obligatoria: true },
  { id: "r2", sector: 1, nombre: "Archivo de seguridad", puerta: "D2" },
  { id: "r3", sector: 1, nombre: "Sala de tuberías", puerta: "D3" },
  { id: "r4", sector: 1, nombre: "Sala de rayos", puerta: "D4" },
  { id: "r6", sector: 1, nombre: "Esclusa", puerta: "D6" },
  { id: "r5", sector: 1, nombre: "Piscina de ácido", puerta: "D5", soloRetos: ["l-puente"] },
  { id: "s2a", sector: 2, nombre: "Invernadero de mutágenos", puerta: "E1" },
  { id: "s2b", sector: 2, nombre: "Criobanco", puerta: "E2" },
  { id: "s2c", sector: 2, nombre: "Laboratorio de clonación", puerta: "E3" },
  { id: "s2d", sector: 2, nombre: "Sala de pruebas", puerta: "E4" },
  { id: "s2e", sector: 2, nombre: "Archivo genético", puerta: "E5" },
  { id: "s3a", sector: 3, nombre: "Control de compuerta" },
  { id: "s3b", sector: 3, nombre: "Sala de presión" },
  { id: "s3c", sector: 3, nombre: "Anillo de alarmas" },
  { id: "s3d", sector: 3, nombre: "Drenaje del hangar" },
  { id: "s3e", sector: 3, nombre: "Plataforma de carga" },
  { id: "s3f", sector: 3, nombre: "Pasarela de mantenimiento" },
  { id: "s3g", sector: 3, nombre: "Almacén de evacuación" },
];

export function slotDef(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

/** Cuántas salas se usan en cada sector según el tamaño del equipo (más equipo, más retos). */
export function salasActivas(sector: Sector, k: number): number {
  if (sector === 1) return Math.min(6, 3 + k);
  if (sector === 2) return Math.min(5, 2 + k);
  return Math.min(7, k + 2);
}

// ---------------------------------------------------------------- plan de la partida
export interface Asignacion {
  slot: string;
  reto: string;
}

export interface PlanSector {
  sector: Sector;
  /** Identificador del reto compuesto del catálogo: {sector}-{clave}. */
  id: string;
  /** Nombre de la sala del catálogo para este equipo. */
  sala: string;
  complicacion: number;
  complicacionTexto: string;
  objetivo: string;
  asignaciones: Asignacion[];
  /** Salas del sector que quedan selladas. */
  sellados: string[];
}

export interface PlanRun {
  clave: string;
  semilla: number;
  roster: AlienKind[];
  sectores: PlanSector[];
  /** Todos los retos usados (registro anti-repetición). */
  usados: string[];
}

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normaliza un equipo: sin repetidos, solo aliens válidos, orden canónico. */
export function normalizarRoster(kinds: readonly string[]): AlienKind[] {
  const clave = claveRoster(kinds);
  return clave ? clave.split("-").map((l) => kindDeLetra(l)!) : [];
}

export function planificarRun(rosterIn: readonly string[], semilla = 1): PlanRun {
  const roster = normalizarRoster(rosterIn);
  const k = roster.length;
  if (k < 1 || k > 5) throw new Error(`Equipo inválido (${k} aliens)`);
  const clave = claveRoster(roster);
  const cat = CATALOGO[clave];
  if (!cat) throw new Error(`Equipo sin entrada en el catálogo: ${clave}`);
  const r = rng(semilla * 7919 + k * 31 + clave.length);
  const usados = new Set<string>();
  const patrones = new Set<string>();
  const sectores: PlanSector[] = [];

  for (const sector of SECTORES) {
    const slots = SLOTS.filter((s) => s.sector === sector);
    const tareas = roster.map((a) => tareaDe(sector, a).id);
    const cabe = (id: string) => {
      const d = RETOS[id];
      return d && !usados.has(id) && !patrones.has(d.patron) && d.sectores.includes(sector) && d.requiere.every((a) => roster.includes(a));
    };
    const total = capacidadSector(sector, roster, cabe);
    if (total < tareas.length) throw new Error(`Faltan salas para ${clave} en el sector ${sector}`);
    // Extras: primero los clásicos que aprovechan al equipo, luego los genéricos.
    const legados = barajar(Object.values(RETOS).filter((d) => d.tipo === "legado" && cabe(d.id)), r);
    const genericos = barajar(Object.values(RETOS).filter((d) => d.tipo === "extra" && cabe(d.id)), r);
    const necesarios = Math.max(0, total - tareas.length);
    const extras: string[] = [];
    // Sala especial (piscina de ácido): solo si el reto que la usa está disponible.
    const especiales = slots.filter((s) => s.soloRetos);
    const usadosEspeciales: Asignacion[] = [];
    for (const s of especiales) {
      const op = s.soloRetos!.find((id) => cabe(id));
      if (op && extras.length < necesarios) {
        extras.push(op);
        usadosEspeciales.push({ slot: s.id, reto: op });
      }
    }
    for (const d of [...legados, ...genericos]) {
      if (extras.length >= necesarios) break;
      if (d.salas || extras.includes(d.id)) continue;
      extras.push(d.id);
    }
    if (extras.length < necesarios) throw new Error(`Sin retos suficientes para ${clave} en el sector ${sector}`);
    // Reparto en salas: obligatorias primero, el resto barajado.
    const libres = slots.filter((s) => !s.soloRetos);
    const obligatorias = libres.filter((s) => s.obligatoria);
    const opcionales = barajar(
      libres.filter((s) => !s.obligatoria),
      r,
    );
    const elegidas = [...obligatorias, ...opcionales].slice(0, total - usadosEspeciales.length);
    const porAsignar = barajar([...tareas, ...extras.filter((e) => !usadosEspeciales.some((u) => u.reto === e))], r);
    const asignaciones: Asignacion[] = [...usadosEspeciales];
    elegidas.forEach((s, i) => asignaciones.push({ slot: s.id, reto: porAsignar[i] }));
    for (const a of asignaciones) {
      usados.add(a.reto);
      patrones.add(RETOS[a.reto].patron);
    }
    const base = (sector - 1) * 2;
    sectores.push({
      sector,
      id: `${sector}-${clave}`,
      sala: SALAS_SECTOR[sector][cat[base]],
      complicacion: cat[base + 1],
      complicacionTexto: COMPLICACIONES_TEXTO[sector][cat[base + 1]],
      objetivo: OBJETIVO_SECTOR[sector],
      asignaciones,
      sellados: slots.filter((s) => !asignaciones.some((a) => a.slot === s.id)).map((s) => s.id),
    });
  }
  return { clave, semilla, roster, sectores, usados: [...usados] };
}

/** Salas que se pueden usar en un sector: las genéricas más las especiales cuyo reto cabe en el equipo. */
export function capacidadSector(sector: Sector, roster: AlienKind[], cabe?: (id: string) => boolean): number {
  const slots = SLOTS.filter((s) => s.sector === sector);
  const ok = cabe ?? ((id: string) => (RETOS[id]?.requiere ?? []).every((a) => roster.includes(a)));
  const libres = slots.filter((s) => !s.soloRetos).length;
  const especiales = slots.filter((s) => s.soloRetos?.some((id) => ok(id))).length;
  return Math.min(salasActivas(sector, roster.length), libres + especiales);
}

/** Comprueba las reglas del diseño; devuelve la lista de problemas (vacía si todo está bien). */
export function validarPlan(plan: PlanRun): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();
  const patrones = new Set<string>();
  for (const ps of plan.sectores) {
    const tareasEsperadas = plan.roster.map((a) => tareaDe(ps.sector, a).id);
    for (const t of tareasEsperadas) if (!ps.asignaciones.some((a) => a.reto === t)) errores.push(`${ps.id}: falta la tarea ${t}`);
    const esperadas = capacidadSector(ps.sector, plan.roster);
    if (ps.asignaciones.length !== esperadas) errores.push(`${ps.id}: ${ps.asignaciones.length} salas en vez de ${esperadas}`);
    if (ps.asignaciones.length < plan.roster.length) errores.push(`${ps.id}: menos salas que aliens`);
    for (const a of ps.asignaciones) {
      const d = RETOS[a.reto];
      const s = slotDef(a.slot);
      if (!d) {
        errores.push(`${ps.id}: reto desconocido ${a.reto}`);
        continue;
      }
      if (!s || s.sector !== ps.sector) errores.push(`${ps.id}: sala ${a.slot} fuera del sector`);
      if (s?.soloRetos && !s.soloRetos.includes(a.reto)) errores.push(`${ps.id}: ${a.reto} no cabe en ${a.slot}`);
      if (d.salas && !d.salas.includes(a.slot)) errores.push(`${ps.id}: ${a.reto} debe ir en ${d.salas.join("/")}`);
      if (!d.sectores.includes(ps.sector)) errores.push(`${ps.id}: ${a.reto} no es del sector ${ps.sector}`);
      if (!d.requiere.every((k) => plan.roster.includes(k))) errores.push(`${ps.id}: ${a.reto} necesita aliens ausentes`);
      if (vistos.has(a.reto)) errores.push(`${ps.id}: reto repetido ${a.reto}`);
      if (patrones.has(d.patron)) errores.push(`${ps.id}: patrón repetido ${d.patron}`);
      vistos.add(a.reto);
      patrones.add(d.patron);
    }
    const slotsUsados = new Set(ps.asignaciones.map((a) => a.slot));
    if (slotsUsados.size !== ps.asignaciones.length) errores.push(`${ps.id}: sala con dos retos`);
    for (const s of SLOTS.filter((x) => x.sector === ps.sector && x.obligatoria)) if (!slotsUsados.has(s.id)) errores.push(`${ps.id}: la sala obligatoria ${s.id} quedó sin reto`);
  }
  return errores;
}

/** Todos los equipos posibles (1 a 5 de 8 aliens): 218 claves. */
export function todosLosRosters(): AlienKind[][] {
  const out: AlienKind[][] = [];
  const n = ALIEN_KINDS.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const sel = ALIEN_KINDS.filter((_, i) => mask & (1 << i));
    if (sel.length >= 1 && sel.length <= 5) out.push(sel);
  }
  return out;
}

export const COMPLICACIONES_ID: Record<Sector, string[]> = {
  1: ["reactor", "patrulla-inicial", "sensor-orden", "terminal"],
  2: ["patrulla-rutas", "recalentado", "dron-control", "puertas"],
  3: ["alarma", "sobrecarga", "perturbacion", "refuerzos"],
};
