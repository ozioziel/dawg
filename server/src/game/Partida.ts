// Simulación autoritativa de una partida del Área 1.
import {
  ABILITY_NAMES,
  ABILITY_OF,
  ALIENS,
  BOTIQUIN_CURA,
  DISFRAZ,
  DOOR_RULES,
  ENEMIES,
  ENEMY_TUNING,
  FREEZE_AUTO_THAW,
  INTERACT_RANGE,
  NET_AUTO_FREE,
  PROP_RADIUS,
  TELEQUINESIS,
  TICK_DT,
  TRANSMUTAR,
  World,
  angleDiff,
  dist,
  isAlienKind,
  isConvertible,
  stepPlayer,
  type AbilityKind,
  type AlienKind,
  type AvisoTipo,
  type Circle,
  type EnemyType,
  type FxEvent,
  type FxTipo,
  type InputMsg,
  type TiledMap,
  type UnitType,
} from "@dawg/shared";
import mapa from "../../../maps/area1.json";
import { Door, GameState, Player, Projectile, Prop, Soul, Unit, Zone } from "../schema/GameState";
import { Director } from "./director";
import { updateUnits, type Brain } from "./enemigos";
import { FlowField } from "./flujo";
import { Puzzles } from "./puzzles";

export type Emit = (type: string, msg: unknown, to?: string) => void;

interface PData {
  inputs: InputMsg[];
  shootCd: number;
  shoot: boolean;
  interact: boolean;
  interactPrev: boolean;
  lastHitAt: number;
  rescuedAt: number;
  noticeAt: Map<string, number>;
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
}

const PROJ_RADIUS: Record<string, number> = { red_proy: 14, tq: 18 };

export class Partida {
  readonly world: World;
  readonly pdata = new Map<string, PData>();
  readonly brains = new Map<string, Brain>();
  readonly projData = new Map<string, ProjData>();
  readonly flags = new Set<string>();
  readonly flows = new Map<string, FlowField>();
  readonly director: Director;
  readonly puzzles: Puzzles;
  private nextId = 1;
  private flowTimer = 0;
  private spawnIndex = 0;
  private votos = new Set<string>();
  /** Equipo inicial para poder reiniciar. */
  private roster: { id: string; nombre: string; kind: AlienKind }[] = [];

  constructor(
    readonly state: GameState,
    readonly emit: Emit,
  ) {
    this.world = new World(mapa as unknown as TiledMap);
    this.director = new Director(this);
    this.puzzles = new Puzzles(this);
    this.initWorld();
  }

  get time(): number {
    return this.state.tiempo;
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
    for (const o of this.world.find("prop")) {
      const p = new Prop();
      p.k = String(o.props.kind);
      p.x = Math.round(o.x);
      p.y = Math.round(o.y);
      p.hp = p.k === "barril" ? 30 : p.k === "caja" ? 45 : 1;
      s.objetos.set("m" + o.id, p);
    }
    this.puzzles.init();
  }

  addPlayer(id: string, nombre: string, kind: AlienKind): void {
    const p = new Player();
    p.nombre = nombre;
    p.kind = kind;
    const def = ALIENS[kind];
    p.hp = p.maxHp = def.hp;
    p.habilidad = def.ability;
    p.energia = DISFRAZ.maxEnergy;
    const spawns = this.world.find("player_spawn");
    const sp = spawns[this.spawnIndex++ % spawns.length];
    p.x = sp.x;
    p.y = sp.y;
    this.state.jugadores.set(id, p);
    this.pdata.set(id, {
      inputs: [],
      shootCd: 0,
      shoot: false,
      interact: false,
      interactPrev: false,
      lastHitAt: -99,
      rescuedAt: -99,
      noticeAt: new Map(),
    });
    if (!this.roster.find((r) => r.id === id)) this.roster.push({ id, nombre, kind });
  }

  start(): void {
    this.state.fase = "jugando";
    this.aviso("¡Despertaron en las incubadoras! Escapen del Área 51.", "info");
    this.director.start();
    this.updateObjective();
  }

  /** Vuelve a empezar el Área 1 con el mismo equipo. */
  reset(): void {
    const s = this.state;
    s.unidades.clear();
    s.proyectiles.clear();
    s.zonas.clear();
    s.objetos.clear();
    s.puertas.clear();
    s.puzzles.clear();
    s.almas.clear();
    s.jefe = "";
    s.tiempo = 0;
    this.brains.clear();
    this.projData.clear();
    this.flags.clear();
    this.votos.clear();
    for (const id of this.world.doorCells.keys()) this.world.setDoor(id, true);
    this.world.bridged.fill(0);
    this.initWorld();
    const conectados = new Map<string, boolean>();
    s.jugadores.forEach((p, id) => conectados.set(id, p.conectado));
    s.jugadores.clear();
    this.pdata.clear();
    this.spawnIndex = 0;
    for (const r of this.roster) {
      this.addPlayer(r.id, r.nombre, r.kind);
      const p = s.jugadores.get(r.id)!;
      p.conectado = conectados.get(r.id) ?? false;
      if (!p.conectado) this.killPlayer(r.id, p, true);
    }
    this.director.reset();
    this.start();
  }

  votarReinicio(id: string): void {
    if (this.state.fase !== "victoria" && this.state.fase !== "derrota") return;
    this.votos.add(id);
    let faltan = 0;
    this.state.jugadores.forEach((p, pid) => {
      if (p.conectado && !this.votos.has(pid)) faltan++;
    });
    if (faltan === 0) this.reset();
    else this.aviso(`${this.state.jugadores.get(id)?.nombre ?? "Alguien"} quiere reintentar (faltan ${faltan}).`, "info");
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

  cambiarHabilidad(id: string): void {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo) return;
    const list = this.abilitiesOf(p);
    const i = list.indexOf(p.habilidad as AbilityKind);
    p.habilidad = list[(i + 1) % list.length];
    if (p.habilidad !== "disfraz" && p.disfrazado && !this.qualifies(p, "cambiaformas")) p.disfrazado = false;
  }

  abilitiesOf(p: Player): AbilityKind[] {
    const set = new Set<AbilityKind>([ABILITY_OF[p.kind as AlienKind]]);
    p.almas.forEach((k) => isAlienKind(k) && set.add(ABILITY_OF[k]));
    return [...set];
  }

  /** ¿Puede hacer el papel de este alien (por ser él o por llevar su alma)? */
  qualifies(p: Player, kind: AlienKind): boolean {
    return p.vivo && (p.kind === kind || p.almas.includes(kind));
  }

  usarHabilidad(id: string, x: number, y: number): void {
    const p = this.state.jugadores.get(id);
    if (!p || !this.canAct(p)) return;
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    switch (p.habilidad as AbilityKind) {
      case "disfraz":
        if (p.disfrazado) {
          p.disfrazado = false;
        } else if (p.energia >= DISFRAZ.minToActivate) {
          p.disfrazado = true;
          this.fx("transmutar", p.x, p.y, { c: 0x7fb24a });
        } else {
          this.aviso("El disfraz se está recargando…", "info", id);
        }
        return;
      case "transmutar": {
        if (p.enfriamiento > 0) return;
        if (dist(p.x, p.y, x, y) > TRANSMUTAR.range + 40) return this.aviso("Demasiado lejos para transmutar.", "info", id);
        const cd = this.puzzles.transmutar(id, p, x, y);
        if (cd !== null) p.enfriamiento = cd;
        else if (this.transmutar(id, p, x, y)) p.enfriamiento = TRANSMUTAR.cooldown;
        return;
      }
      case "telequinesis": {
        if (p.enfriamiento > 0) return;
        if (dist(p.x, p.y, x, y) > TELEQUINESIS.range + 40) return this.aviso("Demasiado lejos para la telequinesis.", "info", id);
        const cd = this.puzzles.telequinesis(id, p, x, y);
        if (cd !== null) p.enfriamiento = cd;
        else if (this.telequinesis(id, p, x, y)) p.enfriamiento = TELEQUINESIS.cooldown;
        return;
      }
    }
  }

  darAlma(id: string): void {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo || p.almas.length === 0) return;
    let best: Player | null = null;
    let bd = 140;
    this.state.jugadores.forEach((o, oid) => {
      if (oid === id || !o.vivo) return;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    if (!best) return this.aviso("Acércate a un compañero para pasarle el alma (G).", "info", id);
    const target = best as Player;
    const kind = p.almas.pop()!;
    target.almas.push(kind);
    if (!this.abilitiesOf(p).includes(p.habilidad as AbilityKind)) p.habilidad = ABILITY_OF[p.kind as AlienKind];
    this.aviso(`${p.nombre} le pasó el alma de ${ALIENS[kind as AlienKind].nombre} a ${target.nombre}. Ahora ${target.nombre} hace los dos papeles.`, "alma");
    this.fx("alma", target.x, target.y);
  }

  // ------------------------------------------------------------------ bucle
  tick(dt: number): void {
    if (this.state.fase !== "jugando") return;
    this.state.tiempo += dt;
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
    this.puzzles.update(dt);
    this.director.update(dt);
    this.updateDoors();
    this.updateObjective();
    this.checkEnd();
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

  /** Círculos que bloquean el paso (barriles, cajas, coberturas). */
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
      if (p.vivo && p.estado !== "ok") {
        p.estadoT -= dt;
        if (p.estadoT <= 0) this.freePlayer(p, null);
      }
      if (p.rescate > 0 && this.time - d.rescuedAt > 0.25) p.rescate = Math.max(0, p.rescate - dt * 0.8);
      // Disfraz
      if (p.disfrazado) {
        if (!p.ocupado) p.energia -= DISFRAZ.drainPerSec * dt;
        if (p.energia <= 0) this.revelar(id, p, "Se acabó tu disfraz.");
      } else {
        p.energia = Math.min(DISFRAZ.maxEnergy, p.energia + DISFRAZ.rechargePerSec * dt);
      }
      // Movimiento (mismo paso que la predicción del cliente)
      let n = 0;
      while (d.inputs.length && n < 4) {
        const inp = d.inputs.shift()!;
        const pos = stepPlayer(
          this.world,
          { x: p.x, y: p.y, kind: p.kind as AlienKind, status: p.estado, confused: p.confuso, ghost: p.fantasma, locked: p.ocupado !== "" },
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
        n++;
      }
      if (!p.vivo) return;
      // Disparo
      d.shootCd -= dt;
      if (d.shoot && this.canAct(p) && d.shootCd <= 0) this.disparar(id, p, d);
      this.updateInteract(id, p, d, dt);
      // Botiquines
      if (p.hp < p.maxHp) {
        this.state.objetos.forEach((o, oid) => {
          if (o.k === "botiquin" && dist(p.x, p.y, o.x, o.y) < 44) {
            p.hp = Math.min(p.maxHp, p.hp + BOTIQUIN_CURA);
            this.state.objetos.delete(oid);
            this.fx("rescate", o.x, o.y, { c: 0x7dff6a });
          }
        });
      }
    });
  }

  private disparar(id: string, p: Player, d: PData): void {
    const w = ALIENS[p.kind as AlienKind].weapon;
    d.shootCd = 1 / w.fireRate;
    let ox = p.x + Math.cos(p.aim) * 24;
    let oy = p.y + Math.sin(p.aim) * 24;
    if (!this.world.lineOfSight(p.x, p.y, ox, oy)) {
      ox = p.x;
      oy = p.y;
    }
    this.spawnProjectile(w.projectile, "aliens", ox, oy, p.aim, w.bulletSpeed, { damage: w.damage, pierce: w.pierce, owner: id, range: w.range });
    if (p.disfrazado) {
      p.energia -= DISFRAZ.shotCost;
      if (p.energia <= 0) this.revelar(id, p, "Disparar gastó tu disfraz.");
    }
  }

  private updateInteract(id: string, p: Player, d: PData, dt: number): void {
    const pressed = d.interact && !d.interactPrev;
    d.interactPrev = d.interact;
    if (!p.vivo || p.estado !== "ok") return;
    if (d.interact && !p.ocupado) {
      // 1. Rescatar a un compañero congelado o atrapado
      let mate: Player | null = null;
      let mateId = "";
      this.state.jugadores.forEach((o, oid) => {
        if (oid === id || !o.vivo || (o.estado !== "congelado" && o.estado !== "red")) return;
        if (dist(p.x, p.y, o.x, o.y) <= INTERACT_RANGE) {
          mate = o;
          mateId = oid;
        }
      });
      if (mate) {
        const m = mate as Player;
        m.rescate += dt / (m.estado === "red" ? 1.0 : 1.4);
        this.pdata.get(mateId)!.rescuedAt = this.time;
        if (m.rescate >= 1) this.freePlayer(m, p);
        return;
      }
    }
    if (!pressed) return;
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
    if (soulId && !p.ocupado) {
      const s = this.state.almas.get(soulId)!;
      p.almas.push(s.kind);
      this.state.almas.delete(soulId);
      this.fx("alma", p.x, p.y);
      this.aviso(`${p.nombre} recogió el alma de ${s.de}: ahora tiene sus habilidades (Q para cambiar) y hará los dos papeles.`, "alma");
      return;
    }
    // 3. Consolas, palancas, botones
    this.puzzles.interact(id, p);
  }

  freePlayer(p: Player, by: Player | null): void {
    const era = p.estado;
    p.estado = "ok";
    p.estadoT = 0;
    p.rescate = 0;
    if (by) {
      this.aviso(`${by.nombre} ${era === "red" ? "cortó la red de" : "descongeló a"} ${p.nombre}.`, "rescate");
      this.fx("rescate", p.x, p.y);
    }
  }

  setEstado(id: string, p: Player, estado: "congelado" | "red" | "aturdido", t?: number): void {
    if (!p.vivo || p.fantasma) return;
    if (estado === "aturdido") {
      if (p.estado === "ok") {
        p.estado = "aturdido";
        p.estadoT = t ?? 0.6;
      }
      return;
    }
    if (p.estado === "congelado" || p.estado === "red") return;
    p.estado = estado;
    p.estadoT = estado === "congelado" ? FREEZE_AUTO_THAW : NET_AUTO_FREE;
    p.rescate = 0;
    if (p.disfrazado && estado === "red") this.revelar(id, p, "");
    this.aviso(estado === "congelado" ? `¡${p.nombre} está congelado! Ve a descongelarlo (mantén E).` : `¡${p.nombre} está atrapado en una red! Ve a cortarla (mantén E).`, "rescate");
    this.puzzles.onPlayerStatus(id);
  }

  revelar(id: string, p: Player, motivo: string): void {
    if (!p.disfrazado) return;
    p.disfrazado = false;
    p.energia = Math.max(0, p.energia);
    this.fx("revelado", p.x, p.y);
    if (motivo) this.aviso(motivo, "peligro", id);
    this.puzzles.onPlayerStatus(id);
  }

  damagePlayer(id: string, p: Player, amount: number): void {
    if (!p.vivo || p.fantasma || amount <= 0) return;
    const d = this.pdata.get(id);
    if (d) d.lastHitAt = this.time;
    if (p.disfrazado) {
      p.energia -= amount * DISFRAZ.damageDrain;
      if (p.energia <= 0) this.revelar(id, p, "¡Te descubrieron!");
    }
    p.hp -= amount;
    this.puzzles.onPlayerHit(id, amount);
    if (p.hp <= 0) this.killPlayer(id, p);
  }

  lastHitAt(id: string): number {
    return this.pdata.get(id)?.lastHitAt ?? -99;
  }

  killPlayer(id: string, p: Player, silencioso = false): void {
    if (!p.vivo) return;
    p.vivo = false;
    p.fantasma = true;
    p.hp = 0;
    p.estado = "ok";
    p.disfrazado = false;
    p.ocupado = "";
    p.rescate = 0;
    const kinds = [p.kind, ...p.almas];
    p.almas.clear();
    kinds.forEach((k, i) => {
      const s = new Soul();
      s.kind = k;
      s.de = k === p.kind ? p.nombre : ALIENS[k as AlienKind].nombre;
      s.x = Math.round(p.x + (i ? Math.cos(i * 2.1) * 34 : 0));
      s.y = Math.round(p.y + (i ? Math.sin(i * 2.1) * 34 : 0));
      this.state.almas.set(this.id("a"), s);
    });
    this.fx("muerte", p.x, p.y);
    if (!silencioso) this.aviso(`☠ ${p.nombre} cayó. Recojan su alma (E) para usar sus habilidades. Volverá en el Área 2.`, "peligro");
    this.puzzles.onPlayerDown(id);
    this.flows.delete(id);
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

  // ------------------------------------------------------------------ habilidades
  private transmutar(id: string, p: Player, x: number, y: number): boolean {
    if (this.countConversions(id) >= TRANSMUTAR.maxActive) {
      this.aviso(`Máximo ${TRANSMUTAR.maxActive} transmutaciones activas.`, "info", id);
      return false;
    }
    // Soldado o científico → pulpo
    const u = this.unitNear(x, y, 70, (u) => u.team === "humanos" && (isConvertible(u.t as UnitType) || u.t === "torreta"));
    if (u) {
      const [uid, unit] = u;
      if (unit.t === "torreta") {
        this.removeUnit(uid);
        this.addCover(unit.x, unit.y, id);
      } else {
        this.removeUnit(uid);
        const pul = this.spawnUnit("pulpo", unit.x, unit.y, "aliens");
        const b = this.brains.get(pul)!;
        b.life = TRANSMUTAR.pulpoLife;
        b.owner = id;
      }
      this.fx("transmutar", unit.x, unit.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
      return true;
    }
    // Barril o caja → cobertura
    const prop = this.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      this.state.objetos.delete(oid);
      this.addCover(o.x, o.y, id);
      this.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
      return true;
    }
    this.aviso("Nada que transmutar ahí (apunta a un soldado, barril, caja o torreta).", "info", id);
    return false;
  }

  private countConversions(id: string): number {
    let n = 0;
    this.state.objetos.forEach((o) => {
      if (o.k === "cobertura" && o.dueno === id) n++;
    });
    this.brains.forEach((b, uid) => {
      if (b.owner === id && this.state.unidades.get(uid)?.t === "pulpo") n++;
    });
    return n;
  }

  private addCover(x: number, y: number, owner: string): void {
    const c = new Prop();
    c.k = "cobertura";
    c.x = x;
    c.y = y;
    c.hp = TRANSMUTAR.coverHp;
    c.t = TRANSMUTAR.coverLife;
    c.dueno = owner;
    this.state.objetos.set(this.id("o"), c);
  }

  private telequinesis(id: string, p: Player, x: number, y: number): boolean {
    const throwAng = p.aim;
    const u = this.unitNear(x, y, 70, (u) => u.team === "humanos" && u.t !== "jefe" && u.t !== "sensor");
    if (u) {
      const [uid, unit] = u;
      if (unit.t === "escudo" && unit.escudo) {
        unit.escudo = false;
        this.aviso("¡Le quitaste el escudo!", "exito", id);
      }
      const pos = this.world.moveCircle(unit.x, unit.y, Math.cos(throwAng) * 170, Math.sin(throwAng) * 170, ENEMIES[unit.t as EnemyType].radius);
      this.fx("telequinesis", unit.x, unit.y, { x2: pos.x, y2: pos.y });
      unit.x = Math.round(pos.x);
      unit.y = Math.round(pos.y);
      const b = this.brains.get(uid);
      if (b) b.stun = TELEQUINESIS.stun;
      this.hitUnit(uid, unit, TELEQUINESIS.throwDamage, null, id);
      return true;
    }
    const prop = this.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      this.state.objetos.delete(oid);
      this.fx("telequinesis", o.x, o.y);
      this.spawnProjectile("tq_" + o.k, "aliens", o.x, o.y, throwAng, TELEQUINESIS.throwSpeed, {
        damage: TELEQUINESIS.throwDamage,
        pierce: 0,
        owner: id,
        range: 700,
        carga: o.k,
      });
      return true;
    }
    this.aviso("Nada que mover ahí (apunta a un enemigo, barril o caja).", "info", id);
    return false;
  }

  // ------------------------------------------------------------------ unidades
  spawnUnit(t: UnitType, x: number, y: number, team: "humanos" | "aliens" = "humanos", tag = ""): string {
    const u = new Unit();
    u.t = t;
    u.team = team;
    u.x = Math.round(x);
    u.y = Math.round(y);
    const hp = t === "pulpo" ? TRANSMUTAR.pulpoHp : ENEMIES[t].hp;
    u.hp = u.maxHp = hp;
    if (t === "jefe") u.tanques = ENEMY_TUNING.jefe.tanks;
    if (t === "escudo") u.escudo = true;
    const id = this.id("u");
    this.state.unidades.set(id, u);
    this.brains.set(id, {
      x,
      y,
      cd: 1 + Math.random() * 1.5,
      burst: 0,
      burstT: 0,
      target: "",
      stun: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: 1 + Math.random() * 2,
      aimT: 0,
      lockAng: 0,
      flameT: 0,
      patchT: 0,
      life: 0,
      owner: "",
      tag,
      shieldT: 0,
      t2: 0,
      kinds: 0,
      devices: [],
    });
    if (t === "jefe") this.state.jefe = id;
    return id;
  }

  removeUnit(id: string): void {
    this.state.unidades.delete(id);
    this.brains.delete(id);
  }

  hitUnit(uid: string, u: Unit, dmg: number, from: { vx: number; vy: number } | null, owner: string): "bloqueado" | "ok" {
    if (from && u.t === "escudo" && u.escudo) {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) < (ENEMY_TUNING.escudo.shieldArc * Math.PI) / 180) {
        this.fx("chispa", u.x + Math.cos(u.ang) * 22, u.y + Math.sin(u.ang) * 22);
        return "bloqueado";
      }
    }
    if (from && u.t === "lanzallamas") {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) > (120 * Math.PI) / 180) dmg *= ENEMY_TUNING.lanzallamas.backMultiplier;
    }
    if (u.t === "jefe" && u.tanques > 0) dmg *= ENEMY_TUNING.jefe.armoredMultiplier;
    const b = this.brains.get(uid);
    if (b && b.shieldT > 0) dmg *= 0.5;
    u.hp -= Math.round(dmg);
    if (b && u.team === "humanos" && owner) b.target = b.target || owner;
    if (u.hp <= 0) this.killUnit(uid, u, owner);
    return "ok";
  }

  killUnit(uid: string, u: Unit, owner: string): void {
    this.removeUnit(uid);
    this.fx("muerte", u.x, u.y, { c: u.team === "aliens" ? 0xff6b3d : 0xff3b3b });
    const p = owner ? this.state.jugadores.get(owner) : undefined;
    if (p && u.team === "humanos") p.bajas++;
    if (u.t === "lanzallamas") {
      const t = ENEMY_TUNING.lanzallamas;
      this.explode(u.x, u.y, t.explosionRadius, t.explosionDamage, owner);
    }
    if (u.t === "jefe") {
      this.state.jefe = "";
      this.flags.add("jefe");
      this.aviso("¡El Jefe de laboratorio cayó!", "exito");
      this.fx("explosion", u.x, u.y, { r: 160 });
    }
  }

  explode(x: number, y: number, r: number, dmg: number, owner: string): void {
    this.fx("explosion", x, y, { r });
    this.state.unidades.forEach((u, uid) => {
      if (u.team !== "humanos") return;
      const d = dist(x, y, u.x, u.y);
      if (d < r) this.hitUnit(uid, u, dmg * (1 - (d / r) * 0.5), null, owner);
    });
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

  unitNear(x: number, y: number, r: number, filter: (u: Unit) => boolean): [string, Unit] | null {
    let best: [string, Unit] | null = null;
    let bd = r;
    this.state.unidades.forEach((u, uid) => {
      if (!filter(u)) return;
      const d = dist(x, y, u.x, u.y) - (u.t === "jefe" ? 30 : 0);
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
    o: { damage: number; pierce?: number; owner?: string; range: number; carga?: string },
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
    this.projData.set(id, { px: x, py: y, t: 0, life: o.range / speed, damage: o.damage, pierce: o.pierce ?? 0, owner: o.owner ?? "", hits: new Set(), carga: o.carga });
    return id;
  }

  throwFlask(k: "frasco_azul" | "frasco_verde" | "frasco_morado", x: number, y: number, tx: number, ty: number, flight: number, owner: string): void {
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
    this.projData.set(id, { px: x, py: y, t: 0, life: flight, damage: 0, pierce: 0, owner, hits: new Set() });
  }

  private flaskPos(pr: Projectile, d: ProjData): { x: number; y: number } {
    const k = Math.min(1, d.t / pr.vuelo);
    return { x: pr.x + (pr.tx - pr.x) * k, y: pr.y + (pr.ty - pr.y) * k };
  }

  private flaskBurst(pr: Projectile, x: number, y: number): void {
    if (pr.k === "frasco_azul") {
      const r = ENEMY_TUNING.criogenista.radius;
      this.fx("hielo", x, y, { r });
      this.state.jugadores.forEach((p, id) => {
        if (p.vivo && dist(x, y, p.x, p.y) < r + 16) this.setEstado(id, p, "congelado");
      });
      // Si revienta cerca de humanos, también los congela (aturdidos un rato).
      this.state.unidades.forEach((u, uid) => {
        if (u.team === "humanos" && u.t !== "jefe" && dist(x, y, u.x, u.y) < r + 16) {
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

  addZone(k: string, x: number, y: number, r: number, vida: number): void {
    const z = new Zone();
    z.k = k;
    z.x = Math.round(x);
    z.y = Math.round(y);
    z.r = r;
    z.vida = vida;
    this.state.zonas.set(this.id("z"), z);
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
          this.flaskBurst(pr, pr.tx, pr.ty);
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
      const rad = PROJ_RADIUS[pr.k] ?? (pr.k.startsWith("tq_") ? PROJ_RADIUS.tq : 5);
      let dead = false;
      if (pr.team === "aliens") {
        // Interceptar frascos en el aire
        for (const [fid, f, fd] of flasks) {
          if (remove.includes(fid)) continue;
          const fp = this.flaskPos(f, fd);
          if (segDist(d.px, d.py, nx, ny, fp.x, fp.y) < 18 + rad) {
            this.flaskBurst(f, fp.x, fp.y);
            remove.push(fid);
            dead = true;
            break;
          }
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || u.team !== "humanos" || d.hits.has(uid)) return;
            const r = ENEMIES[u.t as EnemyType].radius;
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < r + rad) {
              d.hits.add(uid);
              const res = this.hitUnit(uid, u, d.damage, pr, d.owner);
              this.fx("impacto", u.x, u.y, { c: 0xffd23e });
              if (res === "bloqueado" || d.pierce-- <= 0) dead = true;
            }
          });
        }
      } else {
        // Coberturas del del mar
        this.state.objetos.forEach((o, oid) => {
          if (dead || o.k !== "cobertura") return;
          if (segDist(d.px, d.py, nx, ny, o.x, o.y) < 34) {
            o.hp -= d.damage;
            dead = true;
            this.fx("chispa", o.x, o.y);
            if (o.hp <= 0) this.state.objetos.delete(oid);
          }
        });
        if (!dead) {
          this.state.jugadores.forEach((p, pid) => {
            if (dead || !p.vivo || p.fantasma) return;
            if (segDist(d.px, d.py, nx, ny, p.x, p.y) < 18 + rad) {
              dead = true;
              if (pr.k === "red_proy") {
                this.damagePlayer(pid, p, ENEMY_TUNING.lanzarredes.damage);
                if (p.vivo) this.setEstado(pid, p, "red");
              } else {
                this.damagePlayer(pid, p, d.damage);
              }
              this.fx("impacto", p.x, p.y, { c: 0xff3b3b });
            }
          });
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || u.team !== "aliens") return;
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < 18 + rad) {
              dead = true;
              u.hp -= d.damage;
              if (u.hp <= 0) this.killUnit(uid, u, "");
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

  private updateZones(dt: number): void {
    const remove: string[] = [];
    this.state.zonas.forEach((z, zid) => {
      z.vida -= dt;
      if (z.vida <= 0) return void remove.push(zid);
      this.state.jugadores.forEach((p, id) => {
        if (!p.vivo || p.fantasma || dist(z.x, z.y, p.x, p.y) > z.r) return;
        if (z.k === "acido") this.damagePlayer(id, p, ENEMY_TUNING.quimico.dps * dt);
        else if (z.k === "fuego") this.damagePlayer(id, p, ENEMY_TUNING.lanzallamas.patchDps * dt);
        else if (z.k === "gas") {
          if (p.confuso <= 0) this.aviso("¡Gas! Tus controles están invertidos.", "peligro", id);
          p.confuso = Math.max(p.confuso, ENEMY_TUNING.bioquimico.confuse);
        }
      });
    });
    for (const id of remove) this.state.zonas.delete(id);
  }

  private updateProps(dt: number): void {
    const remove: string[] = [];
    this.state.objetos.forEach((o, oid) => {
      if (o.k === "cobertura") {
        o.t -= dt;
        if (o.t <= 0) remove.push(oid);
      }
    });
    for (const id of remove) {
      const o = this.state.objetos.get(id)!;
      this.fx("transmutar", o.x, o.y, { c: 0xffc28f });
      this.state.objetos.delete(id);
    }
  }

  // ------------------------------------------------------------------ puertas y objetivos
  private updateDoors(): void {
    this.state.puertas.forEach((door, id) => {
      if (door.abierta) return;
      const rule = DOOR_RULES[id];
      if (!rule || !rule.requiere.every((f) => this.flags.has(f))) return;
      door.abierta = true;
      this.world.setDoor(id, true);
      const o = this.world.findOne("door", id);
      if (o) this.fx("chispa", o.x + o.w / 2, o.y + o.h / 2);
      this.aviso(id === "D8" ? "¡La salida está abierta! Corran a la SALIDA." : "Se abrió una puerta.", "exito");
    });
  }

  updateObjective(): void {
    const f = this.flags;
    const faltan = (ids: string[], nombres: Record<string, string>) =>
      ids
        .filter((i) => !f.has(i))
        .map((i) => nombres[i])
        .join(" · ");
    let t: string;
    if (!f.has("tutorial")) t = "Sobrevivan a los guardias de las incubadoras.";
    else if (!f.has("p1")) t = "Cámara de contención: el Inteligente resuelve la Memoria psíquica (E en la consola). Los demás, ¡defiéndanlo!";
    else if (!f.has("p2") || !f.has("p3"))
      t = "Desde el hub: " + faltan(["p2", "p3"], { p2: "Archivo de seguridad (Cambiaformas disfrazado, al oeste)", p3: "Sala de tuberías (Del mar, al este)" });
    else if (!f.has("p4") || !f.has("p5") || !f.has("p6"))
      t = "Pasillo norte, salas de dúo: " + faltan(["p4", "p5", "p6"], { p4: "Sala de rayos", p5: "Piscina de ácido", p6: "Válvulas (esclusa)" });
    else if (!f.has("n1") || !f.has("n2") || !f.has("n3") || !f.has("jefe"))
      t = "Núcleo (al sur del hub): activen las 3 estaciones para romper los depósitos del Jefe y derrótenlo.";
    else t = "¡Lleguen a la SALIDA al este del núcleo!";
    if (this.state.objetivo !== t) this.state.objetivo = t;
  }

  private checkEnd(): void {
    let vivos = 0;
    let enSalida = 0;
    const exit = this.world.findOne("exit");
    this.state.jugadores.forEach((p) => {
      if (!p.vivo) return;
      vivos++;
      if (exit && p.x >= exit.x && p.y >= exit.y && p.x <= exit.x + exit.w && p.y <= exit.y + exit.h) enSalida++;
    });
    if (vivos === 0) {
      this.state.fase = "derrota";
      this.aviso("Los atraparon a todos… Pulsen R para reintentar.", "peligro");
    } else if (this.state.puertas.get("D8")?.abierta && enSalida === vivos) {
      this.state.fase = "victoria";
      this.aviso("¡Escaparon del Área 1! Demo completada.", "exito");
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

  abilityName(a: string): string {
    return ABILITY_NAMES[a as AbilityKind] ?? a;
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
