// Simulación autoritativa de una partida: un mundo continuo de tres sectores.
// Aquí viven los jugadores (formas, almas, daño, muerte), las unidades, los proyectiles,
// las zonas y el fin de la partida. Las habilidades de cada alien están en aliens.ts,
// la IA en enemigos.ts / jefes.ts, la progresión y los retos en sectores.ts.
import {
  ALIENS,
  BOTIQUIN_CURA,
  CARGA_ULTI,
  ENEMY_TUNING,
  ESCALA_EQUIPO,
  FREEZE_AUTO_THAW,
  HAB,
  INTERACT_RANGE,
  MUERTE,
  NET_AUTO_FREE,
  PROP_RADIUS,
  TICK_DT,
  World,
  angleDiff,
  dist,
  enemyDef,
  isAlienKind,
  rangoDe,
  statsDe,
  stepPlayer,
  unitRadius,
  type AlienKind,
  type AvisoTipo,
  type Circle,
  type FxEvent,
  type FxTipo,
  type InputMsg,
  type Stat,
  type TiledMap,
  type UnitType,
} from "@dawg/shared";
import mapa from "../../../maps/area51.json";
import { Door, GameState, Player, Projectile, Prop, Soul, Unit, Zone } from "../schema/GameState";
import { ALIEN_LOGICA, alSalirDeForma, ataqueBasico, tickForma } from "./aliens";
import { Director } from "./director";
import { updateUnits, type Brain, nuevoCerebro } from "./enemigos";
import { FlowField } from "./flujo";
import { Mejoras } from "./mejoras";
import { Sectores } from "./sectores";

export type Emit = (type: string, msg: unknown, to?: string) => void;

export interface FormaGuardada {
  cd: number;
  ulti: number;
  energia: number;
}

export interface PData {
  inputs: InputMsg[];
  shootCd: number;
  shoot: boolean;
  interact: boolean;
  interactPrev: boolean;
  lastHitAt: number;
  rescuedAt: number;
  noticeAt: Map<string, number>;
  /** Habilidad mantenida (Telequinesis) */
  habDown: boolean;
  habDownAt: number;
  habX: number;
  habY: number;
  habObjetivo: string;
  formas: Map<string, FormaGuardada>;
  canal: { tipo: string; t: number; dur: number; objetivo: string } | null;
  /** Guardia original copiado por el Cambiaformas. */
  copia: string;
  sorpresa: boolean;
  tunelA: { x: number; y: number } | null;
  tunelT: number;
  ultimoTunel: number;
  intocable: number;
  /** Para puntuar el desempeño. */
  danoRecibido: number;
  struggle: number;
  ordenIdx: number;
  ofertas: string[][];
  stats: Record<Stat, number>;
  statsKey: string;
  chorroFx: number;
  fusionT: number;
  fusionN: number;
  aimX: number;
  aimY: number;
}

export interface ProjData {
  px: number;
  py: number;
  t: number;
  life: number;
  damage: number;
  pierce: number;
  owner: string;
  hits: Set<string>;
  /** Para objetos lanzados con telequinesis: 'barril' explota. */
  carga?: string;
  /** Fuego amigo entre guardias (Eclipse). */
  ff?: boolean;
  /** Unidad que disparó (para no darse a sí misma). */
  shooter?: string;
  infecta?: number;
  veneno?: number;
  robo?: number;
  radio?: number;
  /** Granada / misil: explota al llegar. */
  explota?: { r: number; dmg: number };
}

const PROJ_RADIUS: Record<string, number> = { red_proy: 14, tq: 18, espina: 6, fragmento: 7 };

export class Partida {
  readonly world: World;
  readonly pdata = new Map<string, PData>();
  readonly brains = new Map<string, Brain>();
  readonly projData = new Map<string, ProjData>();
  readonly flags = new Set<string>();
  readonly flows = new Map<string, FlowField>();
  readonly director: Director;
  readonly sectores: Sectores;
  readonly mejoras: Mejoras;
  private nextId = 1;
  private flowTimer = 0;
  private votos = new Map<string, "sector" | "todo">();
  /** Equipo inicial para poder reiniciar. */
  roster: { id: string; nombre: string; kind: AlienKind; skin: number }[] = [];
  semilla = Math.floor(Math.random() * 1e9);
  /** Tiempo hasta reanimar en solitario. */
  private esperaSolo = -1;

  constructor(
    readonly state: GameState,
    readonly emit: Emit,
  ) {
    this.world = new World(mapa as unknown as TiledMap);
    this.director = new Director(this);
    this.mejoras = new Mejoras(this);
    this.sectores = new Sectores(this);
    this.initWorld();
  }

  get time(): number {
    return this.state.tiempo;
  }

  get k(): number {
    return Math.max(1, Math.min(5, this.roster.length || this.state.jugadores.size || 1));
  }

  id(prefix: string): string {
    return prefix + this.nextId++;
  }

  // ------------------------------------------------------------------ montaje
  private initWorld(): void {
    const s = this.state;
    for (const o of this.world.find("door")) {
      const d = new Door();
      d.abierta = false;
      s.puertas.set(o.name, d);
      this.world.setDoor(o.name, false);
    }
    for (const o of this.world.find("prop")) this.addProp(String(o.props.kind), o.x, o.y);
  }

  addProp(k: string, x: number, y: number, o: { hp?: number; t?: number; dueno?: string; st?: string } = {}): string {
    const p = new Prop();
    p.k = k;
    p.x = Math.round(x);
    p.y = Math.round(y);
    p.hp = o.hp ?? (k === "barril" ? 30 : k === "caja" ? 45 : 1);
    p.t = o.t ?? 0;
    p.dueno = o.dueno ?? "";
    p.st = o.st ?? "";
    const id = this.id("o");
    this.state.objetos.set(id, p);
    return id;
  }

  addPlayer(id: string, nombre: string, kind: AlienKind, skin = 0): void {
    const p = new Player();
    p.nombre = nombre;
    p.kind = kind;
    p.forma = kind;
    p.skin = skin;
    const def = ALIENS[kind];
    p.hp = p.maxHp = def.hp;
    p.velocidad = def.speed;
    p.energia = 100;
    p.ultiMax = def.ulti.duracion;
    const sp = this.spawnPoint(this.state.jugadores.size);
    p.x = sp.x;
    p.y = sp.y;
    this.state.jugadores.set(id, p);
    this.pdata.set(id, this.nuevoPData());
    if (!this.roster.find((r) => r.id === id)) this.roster.push({ id, nombre, kind, skin });
    this.state.equipo = this.roster.length;
  }

  private nuevoPData(): PData {
    return {
      inputs: [],
      shootCd: 0,
      shoot: false,
      interact: false,
      interactPrev: false,
      lastHitAt: -99,
      rescuedAt: -99,
      noticeAt: new Map(),
      habDown: false,
      habDownAt: 0,
      habX: 0,
      habY: 0,
      habObjetivo: "",
      formas: new Map(),
      canal: null,
      copia: "",
      sorpresa: false,
      tunelA: null,
      tunelT: 0,
      ultimoTunel: -99,
      intocable: 0,
      danoRecibido: 0,
      struggle: 0,
      ordenIdx: 0,
      ofertas: [],
      stats: {} as Record<Stat, number>,
      statsKey: "",
      chorroFx: 0,
      fusionT: 0,
      fusionN: 0,
      aimX: 0,
      aimY: 0,
    };
  }

  spawnPoint(i: number): { x: number; y: number } {
    const sector = this.state.sector || 1;
    if (sector <= 1) {
      const spawns = this.world.find("player_spawn");
      const sp = spawns[i % spawns.length];
      return { x: sp.x, y: sp.y };
    }
    const cp = this.world.findOne("checkpoint", String(sector))!;
    const a = (i / 5) * Math.PI * 2;
    return { x: cp.x + Math.cos(a) * 50, y: cp.y + Math.sin(a) * 40 };
  }

  start(): void {
    this.state.fase = "jugando";
    this.sectores.iniciarPartida();
    this.aviso("¡Despertaron en las incubadoras! Escapen del Área 51.", "sector");
  }

  /** Reinicio: "todo" empieza de cero (mejoras incluidas); "sector" vuelve al inicio del sector actual. */
  reset(modo: "sector" | "todo" = "todo"): void {
    const s = this.state;
    const sector = modo === "sector" ? s.sector : 1;
    const snapshot = modo === "sector" ? this.mejoras.snapshot(sector) : null;
    s.unidades.clear();
    s.proyectiles.clear();
    s.zonas.clear();
    s.objetos.clear();
    s.puertas.clear();
    s.retos.clear();
    s.pz.clear();
    s.bloqueos.clear();
    s.almas.clear();
    s.jefe = "";
    s.eclipse = 0;
    s.apagon = 0;
    s.compuerta = 0;
    s.crisis = "";
    s.tiempo = 0;
    this.brains.clear();
    this.projData.clear();
    this.flags.clear();
    this.votos.clear();
    this.esperaSolo = -1;
    for (const id of this.world.doorCells.keys()) this.world.setDoor(id, true);
    this.world.bridged.fill(0);
    this.world.clearDyn();
    if (modo === "todo") this.semilla = Math.floor(Math.random() * 1e9);
    this.initWorld();
    const conectados = new Map<string, boolean>();
    s.jugadores.forEach((p, id) => conectados.set(id, p.conectado));
    s.jugadores.clear();
    this.pdata.clear();
    s.sector = sector;
    for (const r of this.roster) {
      this.addPlayer(r.id, r.nombre, r.kind, r.skin);
      const p = s.jugadores.get(r.id)!;
      p.conectado = conectados.get(r.id) ?? false;
      if (snapshot) {
        for (const m of snapshot.get(r.id) ?? []) p.mejoras.push(m);
      }
    }
    this.director.reset();
    this.mejoras.reset(snapshot !== null);
    s.fase = "jugando";
    this.sectores.reiniciar(sector);
    s.jugadores.forEach((p, id) => {
      if (!p.conectado) this.killPlayer(id, p, true);
    });
    this.aviso(modo === "sector" ? `Reintentan desde el inicio del ${["", "Sector I", "Sector II", "Sector III"][sector]}.` : "Nueva partida: vuelven a despertar en las incubadoras.", "sector");
  }

  votarReinicio(id: string, modo: "sector" | "todo" = "todo"): void {
    if (this.state.fase !== "victoria" && this.state.fase !== "derrota") return;
    if (this.state.fase === "victoria") modo = "todo";
    this.votos.set(id, modo === "sector" ? "sector" : "todo");
    let faltan = 0;
    this.state.jugadores.forEach((p, pid) => {
      if (p.conectado && !this.votos.has(pid)) faltan++;
    });
    if (faltan === 0) {
      const todos = [...this.votos.values()];
      this.reset(todos.every((v) => v === "sector") ? "sector" : "todo");
    } else this.aviso(`${this.state.jugadores.get(id)?.nombre ?? "Alguien"} quiere reintentar (faltan ${faltan}).`, "info");
  }

  // ------------------------------------------------------------------ mensajes
  input(id: string, msg: InputMsg): void {
    const d = this.pdata.get(id);
    if (!d || typeof msg?.seq !== "number") return;
    d.inputs.push({
      seq: msg.seq >>> 0,
      mx: Number(msg.mx) || 0,
      my: Number(msg.my) || 0,
      aim: Number(msg.aim) || 0,
      shoot: Boolean(msg.shoot),
    });
    if (d.inputs.length > 12) d.inputs.splice(0, d.inputs.length - 12);
  }

  setInteract(id: string, down: boolean): void {
    const d = this.pdata.get(id);
    if (d) d.interact = Boolean(down);
  }

  /** Q: alterna entre la forma propia y las de las almas que lleva. */
  cambiarForma(id: string): void {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo || p.ocupado || p.estado !== "ok") return;
    const formas = [p.kind, ...p.almas.filter((a) => a !== p.kind)];
    if (formas.length < 2) return this.aviso("No llevas almas de otros aliens.", "info", id);
    const i = formas.indexOf(p.forma);
    this.ponerForma(id, p, formas[(i + 1) % formas.length]);
  }

  ponerForma(id: string, p: Player, forma: string): void {
    if (!isAlienKind(forma) || forma === p.forma) return;
    const d = this.pdata.get(id)!;
    alSalirDeForma(this, id, p);
    d.formas.set(p.forma, { cd: p.enfriamiento, ulti: p.ulti, energia: p.energia });
    const frac = p.maxHp ? p.hp / p.maxHp : 1;
    p.forma = forma;
    const prev = d.formas.get(forma);
    p.enfriamiento = prev?.cd ?? 0;
    p.ulti = prev?.ulti ?? 0;
    p.energia = prev?.energia ?? 100;
    p.ultiT = 0;
    p.ultiMax = ALIENS[forma].ulti.duracion;
    this.recalcular(id, p);
    p.hp = Math.max(1, Math.round(p.maxHp * frac));
    this.fx("alma", p.x, p.y, { c: ALIENS[forma].color });
    this.aviso(forma === p.kind ? `${p.nombre} vuelve a su forma de ${ALIENS[forma].nombre}.` : `${p.nombre} se transforma en ${ALIENS[forma].nombre}.`, "alma");
  }

  darAlma(id: string): void {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo) return;
    const prestadas = p.almas.filter((k) => k !== p.kind);
    if (!prestadas.length) return;
    let best: [string, Player] | null = null;
    let bd = 140;
    this.state.jugadores.forEach((o, oid) => {
      if (oid === id || !o.vivo) return;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = [oid, o];
      }
    });
    if (!best) return this.aviso("Acércate a un compañero para pasarle el alma (G).", "info", id);
    const [, target] = best as [string, Player];
    const kind = p.forma !== p.kind && prestadas.includes(p.forma) ? p.forma : prestadas[prestadas.length - 1];
    if (p.forma === kind) this.ponerForma(id, p, p.kind);
    const i = p.almas.indexOf(kind);
    if (i >= 0) p.almas.splice(i, 1);
    if (target.kind !== kind && !target.almas.includes(kind)) target.almas.push(kind);
    this.aviso(`${p.nombre} le pasó el alma de ${ALIENS[kind as AlienKind].nombre} a ${target.nombre} (Q para transformarse).`, "alma");
    this.fx("alma", target.x, target.y);
  }

  usarHabilidad(id: string, x: number, y: number, fase: "down" | "up" = "down"): void {
    const p = this.state.jugadores.get(id);
    if (!p) return;
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const d = this.pdata.get(id)!;
    d.aimX = x;
    d.aimY = y;
    if (fase === "up") {
      d.habDown = false;
      ALIEN_LOGICA[p.forma as AlienKind]?.soltar?.(this, id, p, x, y);
      return;
    }
    if (!p.vivo || p.fantasma || p.ocupado) return;
    if (p.estado !== "ok" && !(p.estado === "agarrado")) return;
    d.habDown = true;
    d.habDownAt = this.time;
    d.habX = x;
    d.habY = y;
    // Primero los retos (interruptores, celdas, muros sobre marcas…)
    if (this.sectores.habilidad(id, p, x, y)) return;
    ALIEN_LOGICA[p.forma as AlienKind]?.habilidad(this, id, p, x, y);
  }

  usarUlti(id: string, x: number, y: number): void {
    const p = this.state.jugadores.get(id);
    if (!p || !this.canAct(p)) return;
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const logica = ALIEN_LOGICA[p.forma as AlienKind];
    if (!logica) return;
    if (logica.ultiContinua?.(this, id, p, x, y)) return;
    if (p.ultiT > 0) return;
    if (p.ulti < 1) return this.aviso(`${ALIENS[p.forma as AlienKind].ulti.nombre} aún no está lista (${Math.floor(p.ulti * 100)}%).`, "info", id);
    if (logica.ulti(this, id, p, x, y)) {
      p.ulti = 0;
      this.flags.add("ulti-usada");
    }
  }

  elegirMejora(id: string, i: number): void {
    this.mejoras.elegir(id, Number(i) | 0);
  }

  // ------------------------------------------------------------------ bucle
  tick(dt: number): void {
    if (this.state.fase !== "jugando") return;
    this.state.tiempo += dt;
    if (this.state.eclipse > 0) this.state.eclipse = Math.max(0, this.state.eclipse - dt);
    if (this.state.apagon > 0) this.state.apagon = Math.max(0, this.state.apagon - dt);
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.45;
      this.rebuildFlows();
    }
    this.updatePlayers(dt);
    updateUnits(this, dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateProps(dt);
    this.sectores.update(dt);
    this.director.update(dt);
    this.mejoras.update(dt);
    this.checkEnd(dt);
  }

  private rebuildFlows(): void {
    this.state.jugadores.forEach((p, id) => {
      if (!p.vivo) {
        this.flows.delete(id);
        return;
      }
      let f = this.flows.get(id);
      if (!f) this.flows.set(id, (f = new FlowField(this.world)));
      f.build(p.x, p.y);
    });
  }

  canAct(p: Player): boolean {
    return p.vivo && !p.fantasma && p.estado === "ok" && p.ocupado === "";
  }

  /** Estadísticas de mejoras aplicables a la forma actual. */
  stats(id: string, p: Player): Record<Stat, number> {
    const d = this.pdata.get(id);
    if (!d) return {} as Record<Stat, number>;
    const key = p.forma + "|" + p.mejoras.join(",");
    if (key !== d.statsKey) {
      d.statsKey = key;
      d.stats = statsDe(p.mejoras, p.forma);
    }
    return d.stats;
  }

  st(id: string, p: Player, k: Stat): number {
    return this.stats(id, p)[k] ?? 0;
  }

  /** Recalcula vida máxima y velocidad a partir de la forma, mejoras y efectos. */
  recalcular(id: string, p: Player): void {
    const def = ALIENS[p.forma as AlienKind];
    if (!def) return;
    const s = this.stats(id, p);
    const max = Math.round(def.hp + (s.vida ?? 0));
    if (max !== p.maxHp) {
      const frac = p.maxHp ? p.hp / p.maxHp : 1;
      p.maxHp = max;
      if (p.vivo) p.hp = Math.max(1, Math.min(max, Math.round(max * frac)));
    }
    let v = def.speed * (1 + (s.velocidad ?? 0));
    if (p.forma === "cambiaformas" && p.ultiT > 0) v *= HAB.cambiaformas.berserk.speedMul;
    if (p.bajoTierra) v *= HAB.escarabajo.burrowSpeedMul * (1 + (s.excavar ?? 0));
    if (p.forma === "vesper" && this.state.eclipse > 0) v *= 1 + (s.eclipseVelocidad ?? 0);
    if (p.forma === "simbionte" && p.ultiT > 0) v *= 0.85;
    p.velocidad = Math.round(v);
  }

  /** Círculos que bloquean el paso (barriles, cajas, coberturas, muros de hielo). */
  solidProps(): Circle[] {
    const out: Circle[] = [];
    this.state.objetos.forEach((o) => {
      const r = PROP_RADIUS[o.k];
      if (r) out.push({ x: o.x, y: o.y, r });
    });
    return out;
  }

  private updatePlayers(dt: number): void {
    const extra = this.solidProps();
    this.state.jugadores.forEach((p, id) => {
      const d = this.pdata.get(id)!;
      if (p.confuso > 0) p.confuso = Math.max(0, p.confuso - dt);
      if (p.enfriamiento > 0) p.enfriamiento = Math.max(0, p.enfriamiento - dt);
      if (p.punal > 0) p.punal = Math.max(0, p.punal - dt);
      if (d.intocable > 0) d.intocable -= dt;
      if (p.vivo && p.estado !== "ok") {
        p.estadoT -= dt;
        if (p.estadoT <= 0) this.freePlayer(id, p, null);
      }
      if (p.rescate > 0 && this.time - d.rescuedAt > 0.25) p.rescate = Math.max(0, p.rescate - dt * 0.8);
      if (p.vivo) {
        // Carga de la definitiva por tiempo
        const def = ALIENS[p.forma as AlienKind];
        if (def && p.ultiT <= 0 && p.ulti < 1) p.ulti = Math.min(1, p.ulti + (dt / def.ulti.carga) * (1 + this.st(id, p, "cargaUlti")));
        tickForma(this, id, p, dt);
        this.recalcular(id, p);
      }
      // Movimiento (mismo paso que la predicción del cliente). Si controla a un guardia, el cuerpo no se mueve.
      let n = 0;
      while (d.inputs.length && n < 4) {
        const inp = d.inputs.shift()!;
        const locked = p.ocupado !== "" || p.controla !== "" || p.canalTipo === "fijo";
        const pos = stepPlayer(
          this.world,
          { x: p.x, y: p.y, speed: p.velocidad, status: p.estado, confused: p.confuso, ghost: p.fantasma, locked, under: p.bajoTierra },
          inp.mx,
          inp.my,
          TICK_DT,
          extra,
        );
        p.x = pos.x;
        p.y = pos.y;
        if (p.estado === "ok") p.aim = inp.aim;
        d.shoot = inp.shoot;
        p.seq = inp.seq;
        if (p.controla) ALIEN_LOGICA.inteligente.moverControlado?.(this, id, p, inp, TICK_DT);
        n++;
      }
      if (!p.vivo) return;
      // Disparo / ataque básico
      d.shootCd -= dt;
      p.disparando = false;
      if (d.shoot && this.canAct(p)) ataqueBasico(this, id, p, d, dt);
      this.updateInteract(id, p, d, dt);
      // Botiquines
      if (p.hp < p.maxHp && !p.bajoTierra) {
        this.state.objetos.forEach((o, oid) => {
          if (o.k === "botiquin" && dist(p.x, p.y, o.x, o.y) < 44) {
            this.curarJugador(id, p, BOTIQUIN_CURA, "");
            this.state.objetos.delete(oid);
            this.fx("rescate", o.x, o.y, { c: 0x7dff6a });
          }
        });
      }
    });
  }

  private updateInteract(id: string, p: Player, d: PData, dt: number): void {
    const pressed = d.interact && !d.interactPrev;
    d.interactPrev = d.interact;
    if (!p.vivo) return;
    // Agarrado por un cazador: forcejear con E
    if (p.estado === "agarrado") {
      if (pressed) {
        p.estadoT -= ENEMY_TUNING.cazador.struggle * 6;
        this.fx("texto", p.x, p.y, { s: "¡Forcejea!", c: 0xffd23e });
      }
      return;
    }
    if (p.estado !== "ok") return;
    if (d.interact && !p.ocupado) {
      // 1. Rescatar a un compañero congelado, atrapado o agarrado
      let mate: [string, Player] | null = null;
      this.state.jugadores.forEach((o, oid) => {
        if (oid === id || !o.vivo || (o.estado !== "congelado" && o.estado !== "red" && o.estado !== "agarrado")) return;
        if (dist(p.x, p.y, o.x, o.y) <= INTERACT_RANGE) mate = [oid, o];
      });
      if (mate) {
        const [mid, m] = mate as [string, Player];
        m.rescate += dt / (m.estado === "red" ? 1.0 : 1.4);
        this.pdata.get(mid)!.rescuedAt = this.time;
        if (m.rescate >= 1) this.freePlayer(mid, m, p, id);
        return;
      }
      // Interacciones que se mantienen (retos, cápsulas, sabotajes)
      if (this.sectores.interactMantener(id, p, dt)) return;
    }
    if (!pressed || p.ocupado) return;
    // 2. Recoger un alma
    let soulId = "";
    let sd = INTERACT_RANGE;
    this.state.almas.forEach((s, sid) => {
      const dd = dist(p.x, p.y, s.x, s.y);
      if (dd < sd) {
        sd = dd;
        soulId = sid;
      }
    });
    if (soulId) {
      const s = this.state.almas.get(soulId)!;
      if (s.kind !== p.kind && !p.almas.includes(s.kind)) p.almas.push(s.kind);
      this.state.almas.delete(soulId);
      this.fx("alma", p.x, p.y);
      this.aviso(
        `${p.nombre} recogió el alma de ${s.de} (${ALIENS[s.kind as AlienKind]?.nombre ?? s.kind}). Q para transformarse por completo; G para pasársela a otro.`,
        "alma",
      );
      return;
    }
    // 3. Absorber (Simbionte) y retos
    if (ALIEN_LOGICA[p.forma as AlienKind]?.interactuar?.(this, id, p)) return;
    this.sectores.interact(id, p);
  }

  freePlayer(id: string, p: Player, by: Player | null, byId = ""): void {
    const era = p.estado;
    p.estado = "ok";
    p.estadoT = 0;
    p.rescate = 0;
    if (era === "agarrado") this.director.soltarAgarre(id);
    if (by) {
      this.aviso(`${by.nombre} ${era === "red" ? "cortó la red de" : era === "agarrado" ? "liberó a" : "descongeló a"} ${p.nombre}.`, "rescate");
      this.fx("rescate", p.x, p.y);
      by.rescates++;
      this.mejoras.registrar("rescate", 1);
      const bd = this.pdata.get(byId);
      if (bd) by.ulti = Math.min(1, by.ulti + CARGA_ULTI.porRescate);
    }
  }

  setEstado(id: string, p: Player, estado: "congelado" | "red" | "aturdido" | "agarrado", t?: number): void {
    if (!p.vivo || p.fantasma || p.bajoTierra) return;
    const d = this.pdata.get(id);
    if (d && d.intocable > 0) return;
    if (estado === "aturdido") {
      if (p.estado === "ok") {
        p.estado = "aturdido";
        p.estadoT = t ?? 0.6;
      }
      return;
    }
    if (p.estado === "congelado" || p.estado === "red" || p.estado === "agarrado") return;
    p.estado = estado;
    p.estadoT = t ?? (estado === "congelado" ? FREEZE_AUTO_THAW : estado === "agarrado" ? ENEMY_TUNING.cazador.freeAfter : NET_AUTO_FREE);
    p.rescate = 0;
    if (p.disfrazado && estado !== "congelado") this.revelar(id, p, "");
    if (p.controla) ALIEN_LOGICA.inteligente.soltar?.(this, id, p, p.x, p.y);
    const extra = this.k === 1 ? (estado === "agarrado" ? " ¡Pulsa E repetidamente para soltarte!" : " Te liberarás en unos segundos.") : "";
    this.aviso(
      estado === "congelado"
        ? `¡${p.nombre} está congelado! Mantén E junto a él para descongelarlo.${extra}`
        : estado === "agarrado"
          ? `¡Un robot cazador atrapó a ${p.nombre}! Disparadle o mantened E junto a él.${extra}`
          : `¡${p.nombre} está atrapado en una red! Mantén E junto a él para cortarla.${extra}`,
      "rescate",
    );
  }

  revelar(id: string, p: Player, motivo: string): void {
    if (!p.disfrazado) return;
    p.disfrazado = false;
    p.sospecha = 0;
    p.energia = Math.max(0, p.energia);
    this.fx("revelado", p.x, p.y);
    if (motivo) this.aviso(motivo, "peligro", id);
    // Los guardias cercanos se ponen en alerta contra él.
    this.brains.forEach((b, uid) => {
      const u = this.state.unidades.get(uid);
      if (u && u.team === "humanos" && dist(u.x, u.y, p.x, p.y) < 500) b.target = id;
    });
  }

  damagePlayer(id: string, p: Player, amount: number, src = ""): void {
    if (!p.vivo || p.fantasma || amount <= 0 || p.bajoTierra) return;
    const d = this.pdata.get(id);
    if (d && d.intocable > 0) return;
    if (d) d.lastHitAt = this.time;
    amount *= ESCALA_EQUIPO.dano[this.k] * (1 - Math.min(0.5, this.st(id, p, "resistencia")));
    if (p.forma === "cambiaformas" && p.ultiT > 0) amount *= HAB.cambiaformas.berserk.damageTaken;
    if (p.escudo > 0) {
      const abs = Math.min(p.escudo, amount);
      p.escudo -= abs;
      amount -= abs;
      if (amount <= 0) return;
    }
    if (p.disfrazado) {
      p.energia -= amount * 1.5;
      p.sospecha = Math.min(1, p.sospecha + amount * HAB.cambiaformas.suspicionPerDamage);
      if (p.energia <= 0 || p.sospecha >= 1) this.revelar(id, p, "¡Te descubrieron!");
    }
    p.hp -= amount;
    if (d) d.danoRecibido += amount;
    this.mejoras.registrar("dano", amount);
    void src;
    if (p.hp <= 0) this.killPlayer(id, p);
  }

  curarJugador(id: string, p: Player, amount: number, porId: string): number {
    if (!p.vivo || amount <= 0) return 0;
    const antes = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    const real = p.hp - antes;
    if (real > 0 && porId) {
      const curador = this.state.jugadores.get(porId);
      if (curador) {
        curador.curado += Math.round(real);
        curador.ulti = Math.min(1, curador.ulti + real * CARGA_ULTI.porCuracion);
      }
      this.mejoras.registrar("curacion", real);
    }
    void id;
    return real;
  }

  lastHitAt(id: string): number {
    return this.pdata.get(id)?.lastHitAt ?? -99;
  }

  killPlayer(id: string, p: Player, silencioso = false): void {
    if (!p.vivo) return;
    alSalirDeForma(this, id, p);
    p.vivo = false;
    p.fantasma = true;
    p.hp = 0;
    p.estado = "ok";
    p.disfrazado = false;
    p.ocupado = "";
    p.rescate = 0;
    p.ultiT = 0;
    p.canal = 0;
    p.canalTipo = "";
    // Suelta su alma y las que llevaba.
    const kinds = [p.kind, ...p.almas.filter((k) => k !== p.kind)];
    p.almas.clear();
    p.forma = p.kind;
    kinds.forEach((k, i) => {
      const s = new Soul();
      s.kind = k;
      const dueno = this.roster.find((r) => r.kind === k);
      s.dueno = dueno?.id ?? "";
      s.de = dueno?.nombre ?? ALIENS[k as AlienKind]?.nombre ?? k;
      const pos = this.lugarLibre(p.x + (i ? Math.cos(i * 2.1) * 40 : 0), p.y + (i ? Math.sin(i * 2.1) * 40 : 0), p.x, p.y);
      s.x = Math.round(pos.x);
      s.y = Math.round(pos.y);
      this.state.almas.set(this.id("a"), s);
    });
    this.fx("muerte", p.x, p.y);
    this.mejoras.registrar("caida", 1);
    if (!silencioso) {
      const vuelve = this.k > 1 ? " Volverá en el próximo punto de control." : "";
      this.aviso(`☠ ${p.nombre} cayó. Recojan su alma (E) para transformarse en ${ALIENS[p.kind as AlienKind].nombre}.${vuelve}`, "peligro");
    }
    this.sectores.onPlayerDown(id);
    this.flows.delete(id);
  }

  /** Reaparece un jugador caído: recupera su alma (y quien la llevaba la pierde). */
  revivir(id: string, x: number, y: number): void {
    const p = this.state.jugadores.get(id);
    if (!p || p.vivo || !p.conectado) return;
    // El alma vuelve a su dueño.
    this.state.almas.forEach((s, sid) => {
      if (s.kind === p.kind) this.state.almas.delete(sid);
    });
    this.state.jugadores.forEach((o, oid) => {
      if (oid === id) return;
      const i = o.almas.indexOf(p.kind);
      if (i < 0) return;
      if (o.forma === p.kind) this.ponerForma(oid, o, o.kind);
      o.almas.splice(i, 1);
      this.aviso(`El alma de ${ALIENS[p.kind as AlienKind].nombre} vuelve a ${p.nombre}: ${o.nombre} pierde esa transformación.`, "alma");
    });
    p.vivo = true;
    p.fantasma = false;
    p.forma = p.kind;
    p.estado = "ok";
    p.ulti = Math.max(p.ulti, 0.25);
    this.recalcular(id, p);
    p.hp = Math.round(p.maxHp * MUERTE.vidaReaparicion);
    const pos = this.lugarLibre(x, y, x, y);
    p.x = pos.x;
    p.y = pos.y;
    this.fx("reaparecer", p.x, p.y, { c: ALIENS[p.kind as AlienKind].color });
  }

  /** Un sitio caminable cerca de (x, y). */
  lugarLibre(x: number, y: number, fx: number, fy: number): { x: number; y: number } {
    if (!this.world.blocksMoveAt(x, y, 1)) return { x, y };
    for (let r = 32; r < 260; r += 32)
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos((a / 8) * Math.PI * 2) * r;
        const py = y + Math.sin((a / 8) * Math.PI * 2) * r;
        if (!this.world.blocksMoveAt(px, py, 1)) return { x: px, y: py };
      }
    return { x: fx, y: fy };
  }

  playerLeft(id: string): void {
    const p = this.state.jugadores.get(id);
    if (!p) return;
    p.conectado = false;
    if (p.vivo) {
      this.aviso(`${p.nombre} se desconectó.`, "peligro");
      this.killPlayer(id, p, true);
    }
  }

  // ------------------------------------------------------------------ unidades
  spawnUnit(t: UnitType, x: number, y: number, team: "humanos" | "aliens" = "humanos", tag = ""): string {
    const u = new Unit();
    u.t = t;
    u.team = team;
    u.x = Math.round(x);
    u.y = Math.round(y);
    const def = enemyDef(t);
    let hp = def?.hp ?? 60;
    if (t === "pulpo") hp = HAB.delmar.pulpoHp;
    if (t === "kraken") hp = HAB.delmar.eco.krakenHp;
    if (t === "cria") hp = HAB.simbionte.criaHp;
    if (t === "planta") hp = 9999;
    if (t === "terminal") hp = 400;
    if (team === "humanos" && def) {
      const k = this.k;
      hp *= def.rango === "jefe" ? ESCALA_EQUIPO.vidaJefe[k] : def.rango === "dispositivo" || def.rango === "npc" ? 1 : ESCALA_EQUIPO.vida[k];
      // Dificultad progresiva por sector
      if (def.rango === "normal" || def.rango === "elite") hp *= 1 + (this.state.sector - 1) * 0.15;
    }
    u.hp = u.maxHp = Math.round(hp);
    if (t === "jefe") u.tanques = ENEMY_TUNING.jefe.tanks;
    if (t === "escudo") u.escudo = true;
    const id = this.id("u");
    this.state.unidades.set(id, u);
    this.brains.set(id, nuevoCerebro(x, y, tag));
    if (rangoDe(t) === "jefe") this.state.jefe = id;
    return id;
  }

  removeUnit(id: string): void {
    const u = this.state.unidades.get(id);
    if (u?.poseido === "T") {
      const ctl = this.state.jugadores.get(u.dueno);
      if (ctl && ctl.controla === id) ctl.controla = "";
    }
    this.state.unidades.delete(id);
    this.brains.delete(id);
    if (this.state.jefe === id) this.state.jefe = "";
  }

  esEnemigo(u: Unit): boolean {
    return u.team === "humanos";
  }

  hitUnit(uid: string, u: Unit, dmg: number, from: { vx: number; vy: number } | null, owner: string): "bloqueado" | "ok" {
    if (dmg <= 0) return "ok";
    if (from && u.t === "escudo" && u.escudo) {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) < (ENEMY_TUNING.escudo.shieldArc * Math.PI) / 180) {
        this.fx("chispa", u.x + Math.cos(u.ang) * 22, u.y + Math.sin(u.ang) * 22);
        return "bloqueado";
      }
    }
    if (from && u.t === "robot") {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) < Math.PI / 3) dmg *= ENEMY_TUNING.robot.frontArmor;
    }
    if (from && u.t === "lanzallamas") {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) > (120 * Math.PI) / 180) dmg *= ENEMY_TUNING.lanzallamas.backMultiplier;
    }
    if (u.t === "jefe" && u.tanques > 0) dmg *= ENEMY_TUNING.jefe.armoredMultiplier;
    if (u.t === "centinela" && u.st !== "enfriado") dmg *= ENEMY_TUNING.centinela.armorMul;
    if (u.t === "director" && u.blindado) dmg *= ENEMY_TUNING.director.shieldMul;
    if (u.t === "cazador" && u.st === "agarrando") dmg *= 2;
    if (u.t === "nodo") return "ok";
    const b = this.brains.get(uid);
    if (b && b.shieldT > 0) dmg *= 0.5;
    if (u.team === "aliens" && u.poseido === "T") {
      // Daño al guardia controlado: lo sufre él.
    }
    u.hp -= Math.round(dmg);
    if (owner) {
      const p = this.state.jugadores.get(owner);
      if (p && u.team === "humanos") p.ulti = Math.min(1, p.ulti + dmg * CARGA_ULTI.porDanio);
    }
    if (b && u.team === "humanos" && owner && this.state.jugadores.has(owner)) b.target = b.target || owner;
    if (u.hp <= 0) this.killUnit(uid, u, owner);
    return "ok";
  }

  killUnit(uid: string, u: Unit, owner: string): void {
    if (!this.state.unidades.has(uid)) return;
    this.removeUnit(uid);
    this.fx("muerte", u.x, u.y, { c: u.team === "aliens" ? 0xff6b3d : 0xff3b3b });
    const p = owner ? this.state.jugadores.get(owner) : undefined;
    if (p && u.team === "humanos") p.bajas++;
    if (u.team === "humanos") this.mejoras.registrar("baja", 1);
    if (u.t === "lanzallamas") {
      const t = ENEMY_TUNING.lanzallamas;
      this.explode(u.x, u.y, t.explosionRadius, t.explosionDamage, owner);
    }
    this.sectores.onUnidadMuere(uid, u, owner);
    this.director.onUnidadMuere(uid, u);
  }

  explode(x: number, y: number, r: number, dmg: number, owner: string, hierePlayers = false): void {
    this.fx("explosion", x, y, { r });
    this.state.unidades.forEach((u, uid) => {
      if (u.team !== "humanos") return;
      const d = dist(x, y, u.x, u.y);
      if (d < r) this.hitUnit(uid, u, dmg * (1 - (d / r) * 0.5), null, owner);
    });
    if (hierePlayers) {
      this.state.jugadores.forEach((p, id) => {
        const d = dist(x, y, p.x, p.y);
        if (p.vivo && d < r) this.damagePlayer(id, p, dmg * (1 - (d / r) * 0.5));
      });
    }
    // Reacción en cadena con barriles cercanos
    const chain: string[] = [];
    this.state.objetos.forEach((o, oid) => {
      if (o.k === "barril" && dist(x, y, o.x, o.y) < r * 0.8) chain.push(oid);
    });
    for (const oid of chain) {
      const o = this.state.objetos.get(oid);
      if (!o) continue;
      this.state.objetos.delete(oid);
      this.explode(o.x, o.y, 100, 55, owner);
    }
  }

  unitNear(x: number, y: number, r: number, filter: (u: Unit, id: string) => boolean): [string, Unit] | null {
    let best: [string, Unit] | null = null;
    let bd = r;
    this.state.unidades.forEach((u, uid) => {
      if (!filter(u, uid)) return;
      const d = dist(x, y, u.x, u.y) - Math.max(0, unitRadius(u.t) - 20);
      if (d < bd) {
        bd = d;
        best = [uid, u];
      }
    });
    return best;
  }

  propNear(x: number, y: number, r: number, filter: (o: Prop) => boolean): [string, Prop] | null {
    let best: [string, Prop] | null = null;
    let bd = r;
    this.state.objetos.forEach((o, oid) => {
      if (!filter(o)) return;
      const d = dist(x, y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = [oid, o];
      }
    });
    return best;
  }

  // ------------------------------------------------------------------ proyectiles
  spawnProjectile(
    k: string,
    team: "aliens" | "humanos",
    x: number,
    y: number,
    ang: number,
    speed: number,
    o: Partial<ProjData> & { damage: number; range: number },
  ): string {
    const pr = new Projectile();
    pr.k = k;
    pr.team = team;
    pr.x = Math.round(x);
    pr.y = Math.round(y);
    pr.vx = Math.cos(ang) * speed;
    pr.vy = Math.sin(ang) * speed;
    const id = this.id("b");
    this.state.proyectiles.set(id, pr);
    this.projData.set(id, {
      px: x,
      py: y,
      t: 0,
      life: o.range / speed,
      damage: o.damage,
      pierce: o.pierce ?? 0,
      owner: o.owner ?? "",
      hits: new Set(),
      carga: o.carga,
      ff: o.ff,
      shooter: o.shooter,
      infecta: o.infecta,
      veneno: o.veneno,
      robo: o.robo,
      radio: o.radio,
    });
    return id;
  }

  /** Frascos, granadas y misiles: vuelan en arco hasta el destino. */
  throwFlask(k: string, x: number, y: number, tx: number, ty: number, flight: number, owner: string, explota?: { r: number; dmg: number }): void {
    const pr = new Projectile();
    pr.k = k;
    pr.team = "humanos";
    pr.x = Math.round(x);
    pr.y = Math.round(y);
    pr.tx = Math.round(tx);
    pr.ty = Math.round(ty);
    pr.vuelo = flight;
    const id = this.id("b");
    this.state.proyectiles.set(id, pr);
    this.projData.set(id, { px: x, py: y, t: 0, life: flight, damage: 0, pierce: 0, owner, hits: new Set(), explota });
    if (explota) this.addZone("aviso", tx, ty, explota.r, flight);
  }

  private flaskPos(pr: Projectile, d: ProjData): { x: number; y: number } {
    const k = Math.min(1, d.t / pr.vuelo);
    return { x: pr.x + (pr.tx - pr.x) * k, y: pr.y + (pr.ty - pr.y) * k };
  }

  private flaskBurst(pr: Projectile, d: ProjData, x: number, y: number): void {
    if (d.explota) {
      this.fx("explosion", x, y, { r: d.explota.r });
      this.state.jugadores.forEach((p, id) => {
        if (p.vivo && dist(x, y, p.x, p.y) < d.explota!.r + 14) this.damagePlayer(id, p, d.explota!.dmg);
      });
      this.state.unidades.forEach((u, uid) => {
        if (u.team === "aliens" && dist(x, y, u.x, u.y) < d.explota!.r) this.danarAliado(uid, u, d.explota!.dmg);
      });
      return;
    }
    if (pr.k === "frasco_azul") {
      const r = ENEMY_TUNING.criogenista.radius;
      this.fx("hielo", x, y, { r });
      this.state.jugadores.forEach((p, id) => {
        if (p.vivo && dist(x, y, p.x, p.y) < r + 16) this.setEstado(id, p, "congelado");
      });
      this.state.unidades.forEach((u, uid) => {
        if (u.team === "humanos" && rangoDe(u.t) !== "jefe" && dist(x, y, u.x, u.y) < r + 16) {
          const b = this.brains.get(uid);
          if (b) b.stun = 4;
        }
      });
    } else if (pr.k === "frasco_verde") {
      const t = ENEMY_TUNING.quimico;
      this.addZone("acido", x, y, t.radius, t.life);
      this.fx("acido", x, y, { r: t.radius });
    } else {
      const t = ENEMY_TUNING.bioquimico;
      this.addZone("gas", x, y, t.radius, t.life);
      this.fx("gas", x, y, { r: t.radius });
    }
  }

  /** Daño a un aliado no jugador (pulpo, huésped, planta, terminal). */
  danarAliado(uid: string, u: Unit, dmg: number): void {
    if (u.t === "planta") return;
    u.hp -= dmg;
    if (u.hp <= 0) this.killUnit(uid, u, "");
  }

  addZone(k: string, x: number, y: number, r: number, vida: number): string {
    const z = new Zone();
    z.k = k;
    z.x = Math.round(x);
    z.y = Math.round(y);
    z.r = r;
    z.vida = z.total = vida;
    const id = this.id("z");
    this.state.zonas.set(id, z);
    return id;
  }

  private updateProjectiles(dt: number): void {
    const remove: string[] = [];
    const flasks: [string, Projectile, ProjData][] = [];
    this.state.proyectiles.forEach((pr, id) => {
      if (pr.vuelo > 0) flasks.push([id, pr, this.projData.get(id)!]);
    });
    this.state.proyectiles.forEach((pr, id) => {
      const d = this.projData.get(id);
      if (!d) return void remove.push(id);
      d.t += dt;
      if (pr.vuelo > 0) {
        if (d.t >= pr.vuelo) {
          this.flaskBurst(pr, d, pr.tx, pr.ty);
          remove.push(id);
        }
        return;
      }
      let nx = d.px + pr.vx * dt;
      let ny = d.py + pr.vy * dt;
      const wall = this.world.raycast(d.px, d.py, nx, ny);
      if (wall) {
        nx = wall.x;
        ny = wall.y;
      }
      const rad = d.radio ?? PROJ_RADIUS[pr.k] ?? (pr.k.startsWith("tq_") ? PROJ_RADIUS.tq : 5);
      let dead = false;
      if (pr.team === "aliens") {
        // Interceptar frascos en el aire
        for (const [fid, f, fd] of flasks) {
          if (remove.includes(fid) || fd.explota) continue;
          const fp = this.flaskPos(f, fd);
          if (segDist(d.px, d.py, nx, ny, fp.x, fp.y) < 18 + rad) {
            this.flaskBurst(f, fd, fp.x, fp.y);
            remove.push(fid);
            dead = true;
            break;
          }
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || u.team !== "humanos" || d.hits.has(uid) || uid === d.shooter) return;
            // Los fragmentos del Simbionte atraviesan a sus propios infectados (para poder asimilarlos).
            if (d.infecta && u.st === "infectado" && u.dueno === d.owner) return;
            const r = unitRadius(u.t);
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < r + rad) {
              d.hits.add(uid);
              this.alImpactar(uid, u, d);
              const res = this.hitUnit(uid, u, d.damage, pr, d.owner);
              this.fx("impacto", u.x, u.y, { c: pr.k === "fragmento" ? 0xd36be8 : pr.k === "espina" ? 0x7dff6a : 0xffd23e });
              if (res === "bloqueado" || d.pierce-- <= 0) dead = true;
            }
          });
        }
      } else {
        // Coberturas y muros de hielo
        this.state.objetos.forEach((o, oid) => {
          if (dead || (o.k !== "cobertura" && o.k !== "muro_hielo")) return;
          if (segDist(d.px, d.py, nx, ny, o.x, o.y) < (o.k === "cobertura" ? 34 : 28)) {
            o.hp -= d.damage;
            dead = true;
            this.fx(o.k === "muro_hielo" ? "hielo" : "chispa", o.x, o.y, { r: 20 });
            if (o.hp <= 0) this.state.objetos.delete(oid);
          }
        });
        if (!dead) {
          this.state.jugadores.forEach((p, pid) => {
            if (dead || !p.vivo || p.fantasma || p.bajoTierra) return;
            if (segDist(d.px, d.py, nx, ny, p.x, p.y) < 18 + rad) {
              const pd = this.pdata.get(pid);
              if (pd && pd.intocable > 0) return;
              dead = true;
              if (pr.k === "red_proy") {
                this.damagePlayer(pid, p, ENEMY_TUNING.lanzarredes.damage);
                if (p.vivo) this.setEstado(pid, p, "red");
              } else if (pr.k === "rayo_laser") {
                // Láser: deja al alien con 1 de vida (si ya tenía 1, hiere de verdad).
                if (p.hp > 1) {
                  this.damagePlayer(pid, p, Math.max(0, p.hp - 1 - p.escudo) + p.escudo);
                  if (p.vivo) p.hp = Math.min(p.hp, 1);
                } else this.damagePlayer(pid, p, 30);
                this.fx("laser", p.x, p.y);
                this.aviso(`¡Un láser dejó a ${p.nombre} con 1 de vida!`, "peligro");
              } else {
                this.damagePlayer(pid, p, d.damage);
              }
              this.fx("impacto", p.x, p.y, { c: 0xff3b3b });
            }
          });
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || uid === d.shooter) return;
            const enemigoFF = d.ff && u.team === "humanos" && !d.hits.has(uid);
            if (u.team !== "aliens" && !enemigoFF) return;
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < unitRadius(u.t) + rad) {
              dead = true;
              if (u.team === "aliens") this.danarAliado(uid, u, d.damage);
              else {
                d.hits.add(uid);
                this.hitUnit(uid, u, d.damage, pr, "");
                this.fx("impacto", u.x, u.y, { c: 0xb37bff });
              }
            }
          });
        }
      }
      if (wall) dead = true;
      if (d.t > d.life) dead = true;
      d.px = nx;
      d.py = ny;
      if (dead) {
        if (d.carga === "barril") this.explode(nx, ny, 110, 60, d.owner);
        else if (wall) this.fx("impacto", nx, ny, { c: pr.team === "aliens" ? 0xffd23e : 0xff3b3b });
        remove.push(id);
      }
    });
    for (const id of remove) {
      this.state.proyectiles.delete(id);
      this.projData.delete(id);
    }
  }

  /** Efectos especiales de proyectiles aliens (infección, veneno, robo de vida). */
  private alImpactar(uid: string, u: Unit, d: ProjData): void {
    if (d.infecta) ALIEN_LOGICA.simbionte.infectar?.(this, d.owner, uid, u, d.infecta);
    if (d.veneno) {
      const b = this.brains.get(uid);
      if (b) {
        b.veneno = d.veneno;
        b.venenoT = 3;
        b.venenoDe = d.owner;
      }
    }
    if (d.robo && d.owner) {
      const p = this.state.jugadores.get(d.owner);
      if (p) this.curarJugador(d.owner, p, d.damage * d.robo, "");
    }
  }

  private updateZones(dt: number): void {
    const remove: string[] = [];
    this.state.zonas.forEach((z, zid) => {
      z.vida -= dt;
      if (z.vida <= 0) return void remove.push(zid);
      if (z.k === "acido" || z.k === "fuego" || z.k === "gas" || z.k === "electrico" || z.k === "vapor") {
        this.state.jugadores.forEach((p, id) => {
          if (!p.vivo || p.fantasma || p.bajoTierra || dist(z.x, z.y, p.x, p.y) > z.r) return;
          if (z.k === "acido") this.damagePlayer(id, p, ENEMY_TUNING.quimico.dps * dt);
          else if (z.k === "fuego") this.damagePlayer(id, p, ENEMY_TUNING.lanzallamas.patchDps * dt);
          else if (z.k === "electrico") {
            if (z.total - z.vida > 1.2) this.damagePlayer(id, p, ENEMY_TUNING.director.gridDps * dt);
          } else if (z.k === "vapor") this.damagePlayer(id, p, 10 * dt);
          else {
            if (p.confuso <= 0) this.aviso("¡Gas! Tus controles están invertidos.", "peligro", id);
            p.confuso = Math.max(p.confuso, ENEMY_TUNING.bioquimico.confuse);
          }
        });
      }
    });
    for (const id of remove) this.state.zonas.delete(id);
  }

  private updateProps(dt: number): void {
    const remove: string[] = [];
    this.state.objetos.forEach((o, oid) => {
      if (o.k === "cobertura" || o.k === "muro_hielo" || o.k === "tunel") {
        o.t -= dt;
        if (o.t <= 0) remove.push(oid);
      }
    });
    for (const id of remove) {
      const o = this.state.objetos.get(id)!;
      this.fx(o.k === "muro_hielo" ? "hielo" : o.k === "tunel" ? "excavar" : "transmutar", o.x, o.y, { c: 0xffc28f, r: 30 });
      this.state.objetos.delete(id);
    }
    // Túneles: viajar al otro extremo al entrar
    const tuneles: [string, Prop][] = [];
    this.state.objetos.forEach((o, oid) => o.k === "tunel" && tuneles.push([oid, o]));
    if (tuneles.length >= 2) {
      this.state.jugadores.forEach((p, id) => {
        if (!p.vivo || p.estado !== "ok" || p.controla) return;
        const d = this.pdata.get(id)!;
        if (this.time - d.ultimoTunel < 1.4) return;
        for (const [, a] of tuneles) {
          if (dist(p.x, p.y, a.x, a.y) > 38) continue;
          const b = tuneles.find(([, o]) => o !== a && o.dueno === a.dueno)?.[1];
          if (!b) continue;
          d.ultimoTunel = this.time;
          this.fx("tunel", p.x, p.y, { x2: b.x, y2: b.y });
          const pos = this.lugarLibre(b.x + 44, b.y, b.x, b.y);
          p.x = pos.x;
          p.y = pos.y;
          break;
        }
      });
    }
  }

  // ------------------------------------------------------------------ fin
  private checkEnd(dt: number): void {
    let vivos = 0;
    this.state.jugadores.forEach((p) => p.vivo && vivos++);
    if (vivos === 0) {
      // En solitario hay una reanimación de emergencia por sector.
      const solo = [...this.state.jugadores.values()].find((p) => p.conectado && p.vidasSolo > 0);
      if (solo) {
        if (this.esperaSolo < 0) {
          this.esperaSolo = MUERTE.esperaSolo;
          this.aviso("Reanimación de emergencia: la cápsula del punto de control te devolverá a la vida…", "alma");
        }
        this.esperaSolo -= dt;
        if (this.esperaSolo <= 0) {
          this.esperaSolo = -1;
          this.state.jugadores.forEach((p, id) => {
            if (!p.conectado || p.vidasSolo <= 0) return;
            p.vidasSolo--;
            const cp = this.sectores.puntoControl();
            this.revivir(id, cp.x, cp.y);
            this.aviso(`${p.nombre} reapareció en el punto de control. ${p.vidasSolo > 0 ? "" : "No quedan reanimaciones en este sector."}`, "alma");
          });
        }
        return;
      }
      this.state.fase = "derrota";
      this.aviso("Los atraparon a todos… Pueden reintentar desde el inicio del sector o desde cero.", "peligro");
      return;
    }
    if (this.sectores.escapados(vivos)) {
      this.state.fase = "victoria";
      this.aviso("¡ESCAPARON DEL ÁREA 51! Demo completada.", "exito");
    }
  }

  // ------------------------------------------------------------------ eventos
  aviso(texto: string, tipo: AvisoTipo, para?: string): void {
    if (para) {
      const d = this.pdata.get(para);
      if (d) {
        const last = d.noticeAt.get(texto) ?? -99;
        if (this.time - last < 2) return;
        d.noticeAt.set(texto, this.time);
      }
    }
    this.emit("aviso", { texto, tipo }, para);
  }

  fx(t: FxTipo, x: number, y: number, extra: Partial<FxEvent> = {}): void {
    this.emit("fx", { t, x: Math.round(x), y: Math.round(y), ...extra });
  }
}

/** Distancia de un punto a un segmento. */
export function segDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}
