// Progresión del mundo continuo: plan de retos según el equipo, puertas, puntos de control,
// reaparición por fases (estilo Left 4 Dead), jefes, complicaciones del catálogo y el
// protocolo de fuga del sector III (estaciones, crisis, apertura de la Gran Compuerta y huida).
import {
  ALIENS,
  COMPLICACIONES_ID,
  DYN_DISPARO,
  DYN_TODOS,
  ENEMY_TUNING,
  MUERTE,
  NOMBRE_SECTOR,
  TILE,
  dist,
  isAlienKind,
  planificarRun,
  retoDef,
  slotDef,
  type MinigameMsg,
  type PlanRun,
  type Sector,
} from "@dawg/shared";
import { Bloqueo, PzObj, type Player, type Unit } from "../schema/GameState";
import { enfriarCentinela } from "./jefes";
import type { Partida } from "./Partida";
import type { RetoBase, Zona } from "./retos/base";
import { CLASES_RETO } from "./retos";

const PUERTA_SLOT: Record<string, string> = { r2: "D2", r3: "D3", r4: "D4", r5: "D5", r6: "D6", s2a: "E1", s2b: "E2", s2c: "E3", s2d: "E4", s2e: "E5" };

export class Sectores {
  plan: PlanRun | null = null;
  readonly retos = new Map<string, RetoBase>();
  private zonas = new Map<string, Zona>();
  private especiales = new Map<string, string>();
  private protocolo: "estaciones" | "apertura" | "jefe" | "huida" = "estaciones";
  private crisisT = 30;
  private compT = 10;
  private enPeligro = false;
  private terminalId = "";
  private terminalT = 0;
  private dronT = 10;
  private patrullaT = 30;
  private puertasT = 30;
  private puertasCerradas: string[] = [];
  private sobrecarga = 0;
  private perturbadas = new Set<string>();
  private bloqueosHangar: string[] = [];
  private bloqueoHangarT = 0;
  private primerIntento = false;
  private valvulasCd = new Map<string, number>();

  constructor(private g: Partida) {
    for (const o of g.world.find("slot")) {
      const z: Zona = { x: o.x, y: o.y, w: o.w, h: o.h };
      if (o.props.z2w) z.z2 = { x: Number(o.props.z2x) * TILE, y: Number(o.props.z2y) * TILE, w: Number(o.props.z2w) * TILE, h: Number(o.props.z2h) * TILE };
      this.zonas.set(o.name, z);
    }
  }

  get sector(): Sector {
    return this.g.state.sector as Sector;
  }

  get complicacion(): string {
    const ps = this.plan?.sectores[this.sector - 1];
    return ps ? COMPLICACIONES_ID[this.sector][ps.complicacion] : "";
  }

  // ================================================================== montaje
  iniciarPartida(): void {
    this.montar();
    this.iniciarSector(1, false);
  }

  /** Reinicio: monta todo de nuevo y salta al sector indicado (sectores anteriores ya superados). */
  reiniciar(sector: number): void {
    this.montar();
    for (let s = 1; s < sector; s++) {
      for (const [slot, r] of this.retos) if (slotDef(slot)?.sector === s) r.marcarResuelto();
      if (s === 1) this.g.flags.add("tutorial").add("jefe1");
      if (s === 2) this.g.flags.add("jefe2");
    }
    this.g.director.saltarHasta(sector);
    this.iniciarSector(sector as Sector, false);
    // Todos empiezan juntos en el punto de control.
    let i = 0;
    this.g.state.jugadores.forEach((p) => {
      const sp = this.g.spawnPoint(i++);
      p.x = sp.x;
      p.y = sp.y;
    });
    this.updatePuertas();
  }

  private montar(): void {
    const kinds = this.g.roster.map((r) => r.kind).filter(isAlienKind);
    this.plan = planificarRun(kinds.length ? kinds : ["cambiaformas"], this.g.semilla);
    this.retos.clear();
    this.especiales.clear();
    this.protocolo = "estaciones";
    this.crisisT = 30;
    this.compT = 10;
    this.terminalId = "";
    this.perturbadas.clear();
    this.bloqueosHangar = [];
    this.primerIntento = false;
    this.valvulasCd.clear();
    this.puertasCerradas = [];
    for (const ps of this.plan.sectores) {
      for (const a of ps.asignaciones) {
        const Clase = CLASES_RETO[a.reto];
        const zona = this.zonas.get(a.slot);
        if (!Clase || !zona) throw new Error(`Reto sin implementar o sala sin zona: ${a.reto} en ${a.slot}`);
        this.retos.set(a.slot, new Clase(this.g, a.reto, a.slot, zona));
      }
      for (const s of ps.sellados) {
        const puerta = PUERTA_SLOT[s];
        const d = puerta ? this.g.state.puertas.get(puerta) : undefined;
        if (d) d.sellada = true;
      }
    }
    // Estaciones de los jefes y cápsulas
    for (const o of this.g.world.find("sabotaje")) this.especiales.set(o.name, this.obj("sabotaje", o.x, o.y, { v: 0, txt: "Estación de sabotaje", st: "off" }));
    for (const o of this.g.world.find("refrigerante")) this.especiales.set(o.name, this.obj("refrigerante", o.x, o.y, { v: 0, txt: "Válvula de refrigerante", st: "off" }));
    for (const o of this.g.world.find("capsula")) this.especiales.set("capsula" + o.name, this.obj("capsula", o.x, o.y, { txt: "Cápsula de reanimación", st: "lista" }));
    const comp = this.g.world.findOne("compuerta");
    if (comp) this.especiales.set("compuerta", this.obj("consola_compuerta", comp.x, comp.y, { v: 0, txt: "Gran Compuerta", st: "off" }));
    this.g.state.plan = JSON.stringify({
      clave: this.plan.clave,
      sectores: this.plan.sectores.map((s) => ({ s: s.sector, id: s.id, sala: s.sala, comp: s.complicacionTexto, obj: s.objetivo, retos: s.asignaciones })),
    });
  }

  private obj(k: string, x: number, y: number, o: { v?: number; txt?: string; st?: string } = {}): string {
    const ob = new PzObj();
    ob.k = k;
    ob.x = Math.round(x);
    ob.y = Math.round(y);
    ob.v = o.v ?? -1;
    ob.txt = o.txt ?? "";
    ob.st = o.st ?? "";
    const id = this.g.id("pz");
    this.g.state.pz.set(id, ob);
    return id;
  }

  private esp(k: string): PzObj | undefined {
    const id = this.especiales.get(k);
    return id ? this.g.state.pz.get(id) : undefined;
  }

  iniciarSector(n: Sector, revivirMuertos = true): void {
    this.g.state.sector = n;
    this.primerIntento = false;
    for (const [slot, r] of this.retos) if (slotDef(slot)?.sector === n) r.abrir();
    // Vidas de emergencia en solitario: una por sector.
    if (this.g.k === 1) this.g.state.jugadores.forEach((p) => (p.vidasSolo = MUERTE.vidasSoloPorSector));
    this.g.mejoras.guardar(n);
    const ps = this.plan!.sectores[n - 1];
    if (revivirMuertos) {
      const cp = this.puntoControl();
      this.g.state.jugadores.forEach((p, id) => {
        if (!p.vivo && p.conectado) {
          this.g.revivir(id, cp.x, cp.y);
          this.g.aviso(`${p.nombre} vuelve a la vida en el punto de control y recupera su alma.`, "alma");
        }
      });
    }
    // Complicación con terminal a proteger (sector I)
    if (n === 1 && this.complicacion === "terminal") {
      this.terminalT = 0.1;
    }
    this.g.aviso(`${NOMBRE_SECTOR[n]} — Protocolo ${ps.id}: «${ps.sala}». Objetivo: ${ps.objetivo}. Complicación: ${ps.complicacionTexto}.`, "sector");
  }

  puntoControl(): { x: number; y: number } {
    const cp = this.g.world.findOne("checkpoint", String(this.sector));
    return cp ? { x: cp.x, y: cp.y } : { x: 13 * TILE, y: 82 * TILE };
  }

  salaSellada(slot: string): boolean {
    return Boolean(this.plan?.sectores.some((s) => s.sellados.includes(slot)));
  }

  private retosDelSector(s = this.sector): RetoBase[] {
    return [...this.retos.entries()].filter(([slot]) => slotDef(slot)?.sector === s).map(([, r]) => r);
  }

  private sectorResuelto(s: number): boolean {
    return this.retosDelSector(s as Sector).every((r) => r.resuelto);
  }

  // ================================================================== bucle
  update(dt: number): void {
    for (const r of this.retosDelSector()) r.tick(dt);
    this.updatePuertas();
    this.updateComplicaciones(dt);
    this.updateJefes(dt);
    if (this.sector === 3) this.updateFuga(dt);
    this.updateObjetivo();
  }

  private abrir(id: string, abierta: boolean): void {
    const d = this.g.state.puertas.get(id);
    if (!d || d.abierta === abierta) return;
    d.abierta = abierta;
    this.g.world.setDoor(id, abierta);
    if (abierta) {
      const o = this.g.world.findOne("door", id);
      if (o) this.g.fx("chispa", o.x + o.w / 2, o.y + o.h / 2);
      if (!["D2", "D3", "E1", "E2", "E3", "E4", "E5"].includes(id) || this.g.time > 2) this.g.aviso(id === "DF" ? "¡LA GRAN COMPUERTA ESTÁ ABIERTA! ¡Corran afuera!" : "Se abrió una puerta.", "exito");
    }
  }

  private activo(slot: string): RetoBase | undefined {
    return this.retos.get(slot);
  }

  private updatePuertas(): void {
    const f = this.g.flags;
    const r = (slot: string) => this.activo(slot);
    const hecho = (slot: string) => !r(slot) || r(slot)!.resuelto;
    this.abrir("D0", f.has("tutorial"));
    this.abrir("D1", hecho("r1"));
    for (const s of ["r2", "r3"]) this.abrir(PUERTA_SLOT[s], Boolean(r(s)) && f.has("tutorial"));
    const hubHecho = hecho("r1") && hecho("r2") && hecho("r3");
    for (const s of ["r4", "r5", "r6"]) this.abrir(PUERTA_SLOT[s], Boolean(r(s)) && hubHecho);
    this.abrir("D7", this.sectorResuelto(1));
    this.abrir("D8", f.has("jefe1"));
    for (const s of ["s2a", "s2b", "s2c", "s2d", "s2e"]) {
      const cerradaTemporal = this.puertasCerradas.includes(PUERTA_SLOT[s]);
      this.abrir(PUERTA_SLOT[s], Boolean(r(s)) && this.sector >= 2 && !cerradaTemporal);
    }
    this.abrir("D10", this.sector >= 2 && this.sectorResuelto(2));
    this.abrir("D11", f.has("jefe2"));
    this.abrir("D12", this.sector >= 3);
    this.abrir("DF", f.has("compuerta"));
  }

  // ================================================================== jefes y estaciones especiales
  onSalaVisitada(room: string): void {
    if (room === "r7" && !this.g.flags.has("jefe1") && !this.g.state.jefe) {
      const o = this.g.world.findOne("boss_spawn", "jefe")!;
      this.g.spawnUnit("jefe", o.x, o.y, "humanos", "jefe");
      for (const n of ["n1", "n2", "n3"]) this.esp(n) && (this.esp(n)!.st = "");
      this.g.aviso("¡El JEFE DE LABORATORIO! Sus depósitos lo blindan: saboteen las 3 estaciones (mantén E) y acaben con él.", "peligro");
    }
    if (room === "e2" && this.g.flags.has("jefe1") && this.sector < 2) this.iniciarSector(2);
    if (room === "arena2" && this.sector === 2 && !this.g.flags.has("jefe2") && !this.g.state.jefe) {
      const o = this.g.world.findOne("boss_spawn", "centinela")!;
      this.g.spawnUnit("centinela", o.x, o.y, "humanos", "jefe");
      for (const n of ["v1", "v2", "v3"]) this.esp(n) && (this.esp(n)!.st = "");
      this.g.aviso("¡CENTINELA MK-II! Su blindaje solo cae cuando se recalienta: abran una válvula de refrigerante (mantén E) y castíguenlo.", "peligro");
    }
    if (room === "e3" && this.g.flags.has("jefe2") && this.sector < 3) this.iniciarSector(3);
  }

  private updateJefes(dt: number): void {
    for (const [k, v] of this.valvulasCd) this.valvulasCd.set(k, v - dt);
    // Calor del Centinela en las válvulas
    const jefe = this.g.state.jefe ? this.g.state.unidades.get(this.g.state.jefe) : undefined;
    for (const n of ["v1", "v2", "v3"]) {
      const o = this.esp(n);
      if (!o || o.st === "off") continue;
      const cd = this.valvulasCd.get(n) ?? 0;
      o.st = cd > 0 ? "cd" : jefe?.t === "centinela" && jefe.stT >= 0.7 && jefe.st !== "enfriado" ? "lista" : "";
    }
  }

  onUnidadMuere(uid: string, u: Unit, owner: string): void {
    for (const r of this.retosDelSector()) r.onUnidadMuere(uid, u, owner);
    if (u.t === "jefe") {
      this.g.flags.add("jefe1");
      this.g.state.jefe = "";
      this.g.fx("explosion", u.x, u.y, { r: 180 });
      this.g.aviso("¡El Jefe de laboratorio cayó! Se abre el paso al Complejo de Xenogenética (este).", "exito");
      this.g.mejoras.otorgar("derrotar al Jefe de laboratorio", 150);
    } else if (u.t === "centinela") {
      this.g.flags.add("jefe2");
      this.g.state.jefe = "";
      this.g.fx("explosion", u.x, u.y, { r: 220 });
      this.g.aviso("¡El Centinela MK-II quedó hecho chatarra! El túnel de carga hacia el hangar está abierto.", "exito");
      this.g.mejoras.otorgar("destruir al Centinela MK-II", 160);
    } else if (u.t === "director") {
      this.g.flags.add("jefe3");
      this.g.state.jefe = "";
      this.g.fx("explosion", u.x, u.y, { r: 260 });
      this.g.aviso("¡EL DIRECTOR KESSLER HA CAÍDO! La compuerta termina de abrirse…", "exito");
      this.protocolo = "huida";
      this.g.mejoras.otorgar("derrotar al Director", 200);
    } else if (u.t === "terminal" && uid === this.terminalId) {
      this.terminalId = "";
      this.terminalT = 12;
      for (const r of this.retosDelSector()) if (r.st.estado === "activo") r.fallar("¡Destruyeron el terminal que había que proteger!");
    }
  }

  onRetoEmpieza(r: RetoBase): void {
    if (!this.primerIntento) {
      this.primerIntento = true;
      if (this.sector === 1 && this.complicacion === "patrulla-inicial") {
        this.g.aviso("¡La seguridad detectó el primer intento! Se libera una patrulla.", "peligro");
        this.g.director.spawnWave(["fusilero", "fusilero", "perro", "lanzarredes"], this.g.director.salaDeSlot(r.slot), "patrulla");
      }
    }
  }

  onRetoResuelto(_r: RetoBase): void {
    if (this.sector === 3 && this.protocolo === "estaciones" && this.sectorResuelto(3)) {
      this.protocolo = "apertura";
      this.g.aviso("¡Protocolo de fuga completo! La Gran Compuerta empieza a abrirse. ¡Defiendan la consola!", "sector");
      const c = this.esp("compuerta");
      if (c) c.st = "";
      // Refuerzo de reanimación: los caídos vuelven para la huida.
      this.g.state.jugadores.forEach((p, id) => {
        if (!p.vivo && p.conectado && c) {
          this.g.revivir(id, c.x, c.y + 120);
          this.g.aviso(`${p.nombre} se reincorpora para la huida.`, "alma");
        }
      });
    }
  }

  onRetoFalla(r: RetoBase): void {
    if (this.sector === 3 && this.complicacion === "refuerzos") {
      this.g.aviso("¡La interrupción activó refuerzos de seguridad!", "peligro");
      this.g.director.spawnWave(["robot", "fusilero", "laser"], this.g.director.salaDeSlot(r.slot), "refuerzos");
    }
  }

  onRetoError(r: RetoBase, _id: string): void {
    const c = this.complicacion;
    if (this.sector === 1 && c === "sensor-orden") {
      this.g.aviso("El sensor invalidó la acción fuera de orden: ¡alarma!", "peligro");
      this.g.director.spawnWave(["fusilero", "perro"], this.g.director.salaDeSlot(r.slot), "sensor");
    } else if (this.sector === 2 && c === "recalentado") {
      if (r.st.estado === "activo" || r.st.estado === "libre") {
        r.st.estado = "bloqueado";
        r.st.tiempo = r.st.total = 8;
        const z = r.zona;
        this.g.addZone("fuego", z.x + z.w / 2, z.y + z.h / 2, 70, 4);
        this.g.aviso("¡Mecanismo recalentado por ir fuera de secuencia! Bloqueado 8 s.", "peligro");
      }
    } else if (this.sector === 3 && c === "refuerzos") {
      this.g.director.spawnWave(["fusilero", "robot"], this.g.director.salaDeSlot(r.slot), "refuerzos");
    }
  }

  /** Un paso correcto dentro de un reto: cuenta como apoyo para las recompensas. */
  paso(_r: RetoBase, id: string): void {
    this.g.mejoras.registrar("apoyo", 1);
    const p = id ? this.g.state.jugadores.get(id) : undefined;
    if (p) p.apoyo++;
  }

  /** Multiplicador de desgaste por la alarma del sector III. */
  factorAlarma(progreso = false): number {
    if (progreso) return 1;
    return this.sector === 3 && this.complicacion === "alarma" ? 1.35 : 1;
  }

  /** ¿Una complicación impide ahora mismo interactuar con este reto? */
  bloqueoComplicacion(r: RetoBase, _id: string): string {
    const c = this.complicacion;
    if (this.sector === 1 && c === "reactor" && this.enPeligro) return "¡Luz del reactor en modo PELIGROSO! Espera a la luz verde.";
    if (this.sector === 1 && c === "sensor-orden") {
      const orden = this.plan!.sectores[0].asignaciones.map((a) => a.slot).sort((a, b) => (a === "r1" ? -1 : b === "r1" ? 1 : 0));
      for (const slot of orden) {
        if (slot === r.slot) break;
        const otro = this.retos.get(slot);
        if (otro && !otro.resuelto) return `El sensor exige seguir el orden: primero «${otro.def.nombre}» (${slotDef(slot)?.nombre}).`;
      }
    }
    if (this.sector === 2 && c === "dron-control") {
      let dron = false;
      this.g.state.unidades.forEach((u) => u.t === "dron" && u.etiqueta === "Unidad de control" && (dron = true));
      if (dron) return "La unidad de control interfiere: ¡destrúyanla primero!";
    }
    if (this.sector === 3 && c === "sobrecarga" && this.sobrecarga > 0) return "¡Sobrecarga! Las estaciones no responden: defiéndanlas.";
    if (this.g.state.apagon > 0 && this.sector === 3) return "Apagón: espera a que vuelva la energía.";
    return "";
  }

  private updateComplicaciones(dt: number): void {
    const c = this.complicacion;
    const activos = this.retosDelSector().filter((r) => r.st.estado === "activo");
    // I · Reactor que alterna modo seguro/peligroso
    if (this.sector === 1 && c === "reactor") {
      const ciclo = this.g.time % 15;
      const peligro = ciclo > 11;
      if (peligro !== this.enPeligro) {
        this.enPeligro = peligro;
        this.g.state.crisis = peligro ? "reactor" : "";
        if (peligro && activos.length) this.g.aviso("⚠ La luz del reactor pasa a modo PELIGROSO (4 s).", "peligro");
      }
      if (peligro && activos.length) {
        this.g.state.jugadores.forEach((p, id) => {
          if (!p.vivo) return;
          if (activos.some((r) => r.cercaDe(p.x, p.y, -64))) this.g.damagePlayer(id, p, 5 * dt);
        });
      }
    } else if (this.g.state.crisis === "reactor") this.g.state.crisis = "";
    // I · Terminal a proteger
    if (this.sector === 1 && c === "terminal") {
      if (!this.terminalId && this.terminalT > 0) {
        this.terminalT -= dt;
        if (this.terminalT <= 0) {
          const hub = this.g.world.rooms.find((r) => r.id === "hub")!;
          this.terminalId = this.g.spawnUnit("terminal", hub.x + hub.w / 2 + 120, hub.y + hub.h / 2 + 60, "aliens", "terminal");
          this.g.state.unidades.get(this.terminalId)!.etiqueta = "Terminal de seguridad";
          this.g.aviso("Complicación: protejan el Terminal de seguridad del hub mientras resuelven los retos.", "info");
        }
      }
    }
    // II · Patrullas que cambian de ruta
    if (this.sector === 2 && c === "patrulla-rutas") {
      this.patrullaT -= dt;
      if (this.patrullaT <= 0) {
        this.patrullaT = 35;
        const salas = ["hub2", ...activos.map((r) => r.slot)];
        const ruta = salas.map((s) => {
          const room = this.g.world.rooms.find((r) => r.id === s);
          return room ? { x: room.x + room.w / 2, y: room.y + room.h / 2 } : null;
        }).filter(Boolean) as { x: number; y: number }[];
        const hub = this.g.world.rooms.find((r) => r.id === "hub2")!;
        for (const t of ["fusilero", "robot"] as const) {
          const uid = this.g.spawnUnit(t, hub.x + 60, hub.y + hub.h / 2, "humanos", "patrulla");
          const b = this.g.brains.get(uid)!;
          b.ruta = ruta.sort(() => Math.random() - 0.5);
        }
        this.g.aviso("Una patrulla cambia de ruta por el complejo.", "peligro");
      }
    }
    // II · Unidad de control
    if (this.sector === 2 && c === "dron-control" && activos.length) {
      this.dronT -= dt;
      if (this.dronT <= 0) {
        this.dronT = 40;
        let hay = false;
        this.g.state.unidades.forEach((u) => u.t === "dron" && u.etiqueta === "Unidad de control" && (hay = true));
        if (!hay) {
          const r = activos[Math.floor(Math.random() * activos.length)];
          const uid = this.g.spawnUnit("dron", r.zona.x + 40, r.zona.y + 40, "humanos", "control");
          this.g.state.unidades.get(uid)!.etiqueta = "Unidad de control";
          this.g.aviso("¡Una unidad de control interrumpe los retos! Destrúyanla.", "peligro");
        }
      }
    }
    // II · Puertas auxiliares que se cierran
    if (this.sector === 2 && c === "puertas") {
      this.puertasT -= dt;
      if (this.puertasCerradas.length && this.puertasT <= 24) this.puertasCerradas = [];
      if (this.puertasT <= 0) {
        this.puertasT = 30;
        this.puertasCerradas = activos.map((r) => PUERTA_SLOT[r.slot]).filter(Boolean);
        if (this.puertasCerradas.length) this.g.aviso("⚠ Las puertas auxiliares se cierran 6 s.", "peligro");
      }
    }
    // III · Sobrecarga
    if (this.sector === 3 && c === "sobrecarga" && this.protocolo === "estaciones") {
      if (this.sobrecarga > 0) this.sobrecarga -= dt;
      this.compT -= dt;
      if (this.compT <= 0 && activos.length) {
        this.compT = 28;
        this.sobrecarga = 8;
        this.g.aviso("⚡ ¡Sobrecarga! Las estaciones se apagan 8 s: defiéndanlas.", "peligro");
        this.g.director.spawnWave(["robot", "fusilero", "fusilero"], "hangar", "sobrecarga");
      }
    }
    // III · Perturbación: drones que desestabilizan estaciones resueltas
    if (this.sector === 3 && c === "perturbacion" && this.protocolo !== "huida") {
      this.compT -= dt;
      if (this.compT <= 0) {
        this.compT = 30;
        const resueltos = this.retosDelSector().filter((r) => r.resuelto && !this.perturbadas.has(r.slot));
        if (resueltos.length) {
          const r = resueltos[Math.floor(Math.random() * resueltos.length)];
          this.perturbadas.add(r.slot);
          const z = r.zona;
          this.especiales.set("parche-" + r.slot, this.obj("parche", z.x + z.w / 2, z.y + z.h / 2, { v: 0, txt: "Estación perturbada: mantén E" }));
          this.g.aviso(`Los sistemas del Director perturban «${r.def.nombre}»: re-estabilízala (mantén E).`, "peligro");
        }
      }
    }
  }

  // ================================================================== protocolo de fuga (sector III)
  private updateFuga(dt: number): void {
    const s = this.g.state;
    const consola = this.esp("compuerta");
    // Crisis progresivas mientras no se haya escapado.
    if (this.protocolo !== "huida") {
      this.crisisT -= dt;
      if (this.crisisT <= 0) {
        this.crisisT = 26 + Math.random() * 12;
        this.crisis();
      }
    }
    if (this.bloqueoHangarT > 0) {
      this.bloqueoHangarT -= dt;
      if (this.bloqueoHangarT <= 0) this.quitarBloqueosHangar();
    }
    if (this.protocolo === "apertura" || this.protocolo === "jefe" || this.protocolo === "huida") {
      let enemigosCerca = 0;
      if (consola) s.unidades.forEach((u) => u.team === "humanos" && dist(u.x, u.y, consola.x, consola.y) < 260 && enemigosCerca++);
      const tope = this.protocolo === "huida" ? 1 : this.g.flags.has("jefe3") ? 1 : 0.7;
      const pausa = this.perturbadas.size > 0 || enemigosCerca > 0 || s.apagon > 0;
      if (!pausa || this.protocolo === "huida") s.compuerta = Math.min(tope, s.compuerta + dt / (this.protocolo === "huida" ? 10 : 75));
      if (consola) {
        consola.v = s.compuerta;
        consola.st = pausa && this.protocolo !== "huida" ? "mal" : "on";
      }
      if (this.protocolo === "apertura" && s.compuerta >= 0.35) {
        this.protocolo = "jefe";
        const o = this.g.world.findOne("boss_spawn", "director")!;
        this.g.spawnUnit("director", o.x, o.y, "humanos", "jefe");
        this.levantarPilones(4);
        this.g.aviso("¡El DIRECTOR KESSLER llega con el exotraje OMEGA! Sus pilones de energía lo protegen: destrúyanlos.", "peligro");
      }
      if (s.compuerta >= 1 && !this.g.flags.has("compuerta")) {
        this.g.flags.add("compuerta");
        s.crisis = "";
      }
    }
  }

  private crisis(): void {
    const opciones = ["alarma", "apagon", "bloqueo", "electrico", "refuerzos"];
    const t = opciones[Math.floor(Math.random() * opciones.length)];
    const s = this.g.state;
    const hangar = this.g.world.rooms.find((r) => r.id === "hangar")!;
    s.crisis = t;
    switch (t) {
      case "alarma":
        this.g.aviso("🚨 ALARMA GENERAL: llegan guardias por todos lados.", "peligro");
        this.g.director.spawnWave(["fusilero", "fusilero", "robot", "perro"], "hangar", "crisis");
        break;
      case "apagon":
        s.apagon = 7;
        this.g.aviso("⚡ ¡Fallo de energía! Apagón de 7 s: las estaciones no responden.", "peligro");
        break;
      case "bloqueo":
        this.bloqueoHangar(12);
        this.g.aviso("🔒 ¡Bloqueo de seguridad! Se cierran mamparas dentro del hangar 12 s.", "peligro");
        break;
      case "electrico":
        for (let i = 0; i < 7; i++) this.g.addZone("electrico", hangar.x + 200 + Math.random() * (hangar.w - 400), hangar.y + 200 + Math.random() * (hangar.h - 400), 90, 4.5);
        this.g.aviso("⚠ ¡El suelo se electrifica! Aléjense de las placas que chisporrotean.", "peligro");
        break;
      case "refuerzos":
        this.g.aviso("🚁 Refuerzos aerotransportados en el hangar.", "peligro");
        this.g.director.spawnWave(["robot", "laser", "escudo"], "hangar", "crisis");
        this.g.director.spawnCazador(1);
        break;
    }
  }

  /** Mamparas temporales en el hangar (crisis y fase 2 del Director). */
  bloqueoHangar(t: number): void {
    this.quitarBloqueosHangar();
    const h = this.g.world.rooms.find((r) => r.id === "hangar")!;
    const tx0 = Math.floor(h.x / TILE);
    const ty0 = Math.floor(h.y / TILE);
    const tw = Math.floor(h.w / TILE);
    const th = Math.floor(h.h / TILE);
    // Dos mamparas horizontales con huecos en sitios distintos.
    for (const fy of [0.3, 0.7]) {
      const ty = ty0 + Math.floor(th * fy);
      const hueco = tx0 + 4 + Math.floor(Math.random() * (tw - 10));
      for (const [a, b] of [[tx0 + 1, hueco], [hueco + 3, tx0 + tw - 1]]) {
        if (b - a < 1) continue;
        const bq = new Bloqueo();
        bq.k = "mampara";
        bq.x = a;
        bq.y = ty;
        bq.w = b - a;
        bq.h = 1;
        bq.m = DYN_TODOS | DYN_DISPARO;
        const id = this.g.id("bq");
        this.g.state.bloqueos.set(id, bq);
        this.g.world.addDyn(bq.x, bq.y, bq.w, bq.h, bq.m, 1);
        this.bloqueosHangar.push(id);
      }
    }
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo && this.g.world.blocksMoveAt(p.x, p.y, 1)) {
        const pos = this.g.lugarLibre(p.x, p.y + 70, p.x, p.y);
        p.x = pos.x;
        p.y = pos.y;
      }
    });
    this.bloqueoHangarT = t;
  }

  private quitarBloqueosHangar(): void {
    for (const id of this.bloqueosHangar) {
      const b = this.g.state.bloqueos.get(id);
      if (!b) continue;
      this.g.world.addDyn(b.x, b.y, b.w, b.h, b.m, -1);
      this.g.state.bloqueos.delete(id);
    }
    this.bloqueosHangar = [];
  }

  levantarPilones(n: number): void {
    const puntos = this.g.world.find("pilon").sort(() => Math.random() - 0.5).slice(0, n);
    for (const o of puntos) {
      const uid = this.g.spawnUnit("pilon", o.x, o.y, "humanos", "jefe");
      this.g.state.unidades.get(uid)!.etiqueta = "Pilón de energía";
      this.g.fx("chispa", o.x, o.y);
    }
  }

  // ================================================================== interacción
  /** Habilidad: primero los retos cercanos al punto apuntado. */
  habilidad(id: string, p: Player, x: number, y: number): boolean {
    for (const r of this.retosDelSector()) {
      if (!r.disponible && r.st.estado !== "bloqueado") continue;
      if (!r.cercaDe(x, y) && !r.cercaDe(p.x, p.y)) continue;
      if (r.habilidad(id, p, x, y)) return true;
    }
    return false;
  }

  chorro(id: string, p: Player, dt: number): void {
    for (const r of this.retosDelSector()) if (r.disponible && r.cercaDe(p.x, p.y)) r.chorro(id, p, dt);
  }

  private retosCerca(p: Player): RetoBase[] {
    let x = p.x;
    let y = p.y;
    if (p.controla) {
      const u = this.g.state.unidades.get(p.controla);
      if (u) {
        x = u.x;
        y = u.y;
      }
    }
    return this.retosDelSector().filter((r) => (r.disponible || r.st.estado === "bloqueado") && r.cercaDe(x, y, 40));
  }

  interact(id: string, p: Player): void {
    for (const r of this.retosCerca(p)) if (r.interact(id, p)) return;
  }

  interactMantener(id: string, p: Player, dt: number): boolean {
    // Cápsulas de reanimación
    for (const k of ["capsula2", "capsula3"]) {
      const o = this.esp(k);
      if (!o || o.st !== "lista" || dist(p.x, p.y, o.x, o.y) > 100) continue;
      const muertos = [...this.g.state.jugadores.entries()].filter(([, q]) => !q.vivo && q.conectado);
      if (!muertos.length) continue;
      o.v = Math.max(0, o.v) + dt / 3;
      if (o.v >= 1) {
        o.st = "usada";
        o.v = -1;
        for (const [mid, q] of muertos) {
          this.g.revivir(mid, o.x + 60, o.y + 40);
          this.g.aviso(`${p.nombre} reanimó a ${q.nombre} en la cápsula.`, "alma");
        }
        p.rescates += muertos.length;
        this.g.mejoras.registrar("rescate", muertos.length);
      }
      return true;
    }
    // Sabotaje del Jefe de laboratorio
    for (const n of ["n1", "n2", "n3"]) {
      const o = this.esp(n);
      if (!o || dist(p.x, p.y, o.x, o.y) > 100 || o.st === "ok") continue;
      if (o.st === "off") {
        this.g.aviso("La estación no responde hasta que aparezca el Jefe en el núcleo.", "info", id);
        return true;
      }
      o.v = Math.max(0, o.v) + dt / 5;
      if (o.v >= 1) {
        o.st = "ok";
        const jefe = this.g.state.jefe ? this.g.state.unidades.get(this.g.state.jefe) : undefined;
        if (jefe && jefe.tanques > 0) jefe.tanques--;
        const quedan = ["n1", "n2", "n3"].filter((k) => this.esp(k)?.st !== "ok").length;
        this.g.fx("nucleo", o.x, o.y);
        this.g.aviso(quedan ? `¡Depósito del Jefe destruido! Quedan ${quedan}.` : "¡Los tres depósitos rotos! El Jefe ya no tiene blindaje: ¡acábenlo!", "exito");
        this.g.mejoras.registrar("apoyo", 2);
      }
      return true;
    }
    // Válvulas de refrigerante del Centinela
    for (const n of ["v1", "v2", "v3"]) {
      const o = this.esp(n);
      if (!o || dist(p.x, p.y, o.x, o.y) > 100 || o.st === "off") continue;
      if ((this.valvulasCd.get(n) ?? 0) > 0) return true;
      const jefe = this.g.state.jefe ? this.g.state.unidades.get(this.g.state.jefe) : undefined;
      if (!jefe || jefe.t !== "centinela" || jefe.stT < 0.7) {
        o.v = 0;
        this.g.aviso(`El Centinela aún no está recalentado (${Math.round((jefe?.stT ?? 0) * 100)}% de calor; hace falta 70%).`, "info", id);
        return true;
      }
      o.v = Math.max(0, o.v) + dt / 2;
      if (o.v >= 1) {
        o.v = 0;
        if (enfriarCentinela(this.g)) this.valvulasCd.set(n, 12);
        this.g.mejoras.registrar("apoyo", 2);
      }
      return true;
    }
    // Estaciones perturbadas (sector III)
    for (const slot of [...this.perturbadas]) {
      const o = this.esp("parche-" + slot);
      if (!o || dist(p.x, p.y, o.x, o.y) > 110) continue;
      o.v = Math.max(0, o.v) + dt / 2.5;
      if (o.v >= 1) {
        this.perturbadas.delete(slot);
        const pid = this.especiales.get("parche-" + slot)!;
        this.g.state.pz.delete(pid);
        this.especiales.delete("parche-" + slot);
        this.g.aviso("Estación re-estabilizada.", "exito");
      }
      return true;
    }
    for (const r of this.retosCerca(p)) if (r.mantener(id, p, dt)) return true;
    return false;
  }

  mensajeMinijuego(id: string, msg: MinigameMsg): void {
    if (!msg || typeof msg.id !== "string") return;
    this.retos.get(msg.id)?.mensaje(id, msg);
  }

  onEscaneo(id: string, p: Player, u: Unit): void {
    for (const r of this.retosDelSector()) r.onEscaneo(id, p, u);
  }

  onTeleport(id: string, p: Player, uid: string): void {
    for (const r of this.retosDelSector()) r.onTeleport(id, p, uid);
  }

  onAsimilar(id: string, uid: string, u: Unit): void {
    for (const r of this.retosDelSector()) r.onAsimilar(id, uid, u);
  }

  onPlayerDown(id: string): void {
    for (const r of this.retosDelSector()) {
      r.onPlayerDown(id);
      if (r.st.estado === "activo" && r.st.actores.split(",").includes(id) && retoDef(r.id)?.minijuego) r.fallar("Cayó quien hacía el reto.");
    }
  }

  // ================================================================== objetivo y victoria
  private updateObjetivo(): void {
    const f = this.g.flags;
    const s = this.sector;
    const pend = this.retosDelSector()
      .filter((r) => !r.resuelto)
      .map((r) => `${slotDef(r.slot)?.nombre}: ${r.def.nombre}${r.def.requiere.length ? ` (${r.def.requiere.map((k) => ALIENS[k].nombre).join(" + ")})` : ""}`);
    let t = "";
    const resumen = (n: number) => `${pend[0]}${n > 1 ? ` (+${n - 1} reto${n > 2 ? "s" : ""} más)` : ""}`;
    if (s === 1) {
      if (!f.has("tutorial")) t = "Sobrevivan a los guardias de las incubadoras.";
      else if (pend.length) t = `Sector I · Restaurar la seguridad: ${resumen(pend.length)}`;
      else if (!f.has("jefe1")) t = "Núcleo (sur del hub): saboteen las 3 estaciones (mantén E) y derroten al Jefe de laboratorio.";
      else t = "¡Avancen al este, a la Esclusa de descontaminación!";
    } else if (s === 2) {
      if (pend.length) t = `Sector II · Calibración cruzada: ${resumen(pend.length)}`;
      else if (!f.has("jefe2")) t = "Cámara del Centinela (sur del atrio): enfríenlo con las válvulas cuando se recaliente y destrúyanlo.";
      else t = "¡Sigan al este por el túnel de carga hasta el hangar!";
    } else {
      const total = this.retosDelSector().length;
      if (this.protocolo === "estaciones") t = `Protocolo de fuga · estaciones ${total - pend.length}/${total}: ${resumen(pend.length)}`;
      else if (!f.has("jefe3")) t = `Defiendan la consola de la Gran Compuerta (${Math.round(this.g.state.compuerta * 100)}%)${this.g.state.jefe ? " y derroten al DIRECTOR (destruyan sus pilones)" : ""}.${this.perturbadas.size ? " ¡Hay estaciones perturbadas!" : ""}`;
      else if (!f.has("compuerta")) t = `La compuerta termina de abrirse (${Math.round(this.g.state.compuerta * 100)}%)…`;
      else t = "¡CORRAN AFUERA! Todos los aliens vivos deben salir al desierto.";
    }
    if (this.g.state.objetivo !== t) this.g.state.objetivo = t;
  }

  escapados(vivos: number): boolean {
    if (!this.g.flags.has("jefe3") || !this.g.flags.has("compuerta")) return false;
    const exit = this.g.world.findOne("exit");
    if (!exit) return false;
    let fuera = 0;
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo && p.x >= exit.x && p.y >= exit.y && p.x <= exit.x + exit.w && p.y <= exit.y + exit.h) fuera++;
    });
    return fuera === vivos && vivos > 0;
  }
}

void ENEMY_TUNING;
