// Inteligencia de enemigos, dispositivos, NPC de los retos y unidades aliadas
// (pulpos, krakens, huéspedes del Simbionte, plantas del Jardín y el terminal a proteger).
import { ALLIES, ENEMY_TUNING, HAB, angleDiff, dist, enemyDef, rangoDe, unitRadius, type Circle, type EnemyType } from "@dawg/shared";
import type { Player, Unit } from "../schema/GameState";
import type { Partida } from "./Partida";
import { tickJefe } from "./jefes";
import { zonasAliadas } from "./aliens";

export interface Brain {
  x: number;
  y: number;
  cd: number;
  burst: number;
  burstT: number;
  target: string;
  stun: number;
  strafe: number;
  strafeT: number;
  aimT: number;
  lockAng: number;
  flameT: number;
  patchT: number;
  /** Vida restante (pulpos, krakens). */
  life: number;
  /** Jugador dueño (aliados) o que lo transmutó. */
  owner: string;
  /** Etiqueta del encuentro que lo generó. */
  tag: string;
  shieldT: number;
  t2: number;
  kinds: number;
  devices: string[];
  veneno: number;
  venenoT: number;
  venenoDe: string;
  /** Congelado por Freeze (s restantes). */
  hielo: number;
  ultimoFrio: number;
  /** Ralentizado por el Ecosistema (multiplicador de velocidad). */
  lento: number;
  /** Huésped del Simbionte: punto al que se le ordenó ir. */
  orden: { x: number; y: number } | null;
  /** Tiempo como huésped (para transformarse en criatura). */
  hostT: number;
  /** No transformarse (reto «conservar poseído»). */
  mantener: boolean;
  /** Ruta de patrulla (NPC y patrullas). */
  ruta: { x: number; y: number }[];
  rutaI: number;
  /** Punto de deambular. */
  vaga: { x: number; y: number } | null;
  vagaT: number;
  /** Cazador: jugador agarrado. */
  agarre: string;
  /** Ya alertó a los demás. */
  alertado: boolean;
  /** No se mueve de su puesto (centinelas de los retos). */
  fijo: boolean;
  /** Para jefes y casos especiales: datos libres. */
  j: Record<string, number>;
}

export function nuevoCerebro(x: number, y: number, tag: string): Brain {
  return {
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
    veneno: 0,
    venenoT: 0,
    venenoDe: "",
    hielo: 0,
    ultimoFrio: -99,
    lento: 1,
    orden: null,
    hostT: 0,
    mantener: false,
    ruta: [],
    rutaI: 0,
    vaga: null,
    vagaT: 0,
    agarre: "",
    alertado: false,
    fijo: false,
    j: {},
  };
}

interface Target {
  id: string;
  x: number;
  y: number;
  player?: Player;
}

const AGGRO = 1500;

export function updateUnits(g: Partida, dt: number): void {
  const solids: Circle[] = g.solidProps();
  const entries: [string, Unit, Brain][] = [];
  g.state.unidades.forEach((u, id) => {
    const b = g.brains.get(id);
    if (b) entries.push([id, u, b]);
  });
  zonasAliadas(g, dt, entries);

  for (const [uid, u, b] of entries) {
    if (!g.state.unidades.has(uid)) continue;
    // Sincronizar si algo movió la unidad desde fuera (telequinesis, singularidad).
    if (Math.round(b.x) !== u.x || Math.round(b.y) !== u.y) {
      b.x = u.x;
      b.y = u.y;
    }
    if (b.shieldT > 0) b.shieldT -= dt;
    if (u.t !== "director" && u.t !== "centinela") u.blindado = b.shieldT > 0;
    u.moviendo = false;
    // Veneno de la Curandera
    if (b.venenoT > 0) {
      b.venenoT -= dt;
      g.hitUnit(uid, u, b.veneno * dt, null, b.venenoDe);
      if (!g.state.unidades.has(uid)) continue;
    }
    // Frío de Freeze: se disipa si no le siguen disparando.
    if (u.frio > 0 && g.time - b.ultimoFrio > 0.4) u.frio = Math.max(0, u.frio - (HAB.freeze.frioDecay / 100) * dt);
    if (b.hielo > 0) {
      b.hielo -= dt;
      u.st = "congelado";
      b.aimT = 0;
      if (b.hielo <= 0) {
        u.st = "";
        u.frio = 0;
      }
      continue;
    }
    if (u.st === "infectado") {
      u.stT -= dt;
      if (u.stT <= 0) {
        u.st = "";
        u.infeccion = 0.5;
      } else continue;
    }
    if (b.stun > 0) {
      b.stun -= dt;
      u.st = "aturdido";
      b.aimT = 0;
      if (b.agarre) soltarAgarre(g, uid, u, b);
      continue;
    }
    if (u.st === "aturdido" || u.st === "congelado") u.st = "";
    b.cd -= dt;

    if (u.team === "aliens") {
      if (u.poseido === "T") continue; // lo mueve el jugador
      if (u.t === "pulpo" || u.t === "kraken") updatePulpo(g, uid, u, b, dt, solids);
      else if (u.t === "planta") updatePlanta(g, uid, u, b);
      else if (u.t === "terminal") continue;
      else updateHuesped(g, uid, u, b, dt, solids);
      continue;
    }
    const r = rangoDe(u.t);
    if (r === "jefe") {
      tickJefe(g, uid, u, b, dt, solids);
      continue;
    }
    switch (u.t as EnemyType) {
      case "torreta":
        updateTorreta(g, uid, u, b, dt);
        break;
      case "sensor":
        updateSensor(g, u, b, dt);
        break;
      case "generador":
      case "nodo":
      case "pilon":
        break;
      case "medico":
        updateMedico(g, uid, u, b, dt, solids, entries);
        break;
      case "inspector":
      case "tecnico":
        updateNpc(g, u, b, dt, solids);
        break;
      case "cazador":
        updateCazador(g, uid, u, b, dt, solids);
        break;
      case "dron":
        updateDron(g, uid, u, b, dt);
        break;
      default:
        updateSoldado(g, uid, u, b, dt, solids);
    }
  }
  separate(g, entries);
}

// ------------------------------------------------------------------ objetivos
function findTarget(g: Partida, u: Unit, b: Brain, ignoreDisguise: boolean): Target | null {
  let best: Target | null = null;
  let bd = AGGRO;
  const consider = (t: Target, extra = 0) => {
    const flow = t.player ? g.flows.get(t.id) : undefined;
    let d = flow ? flow.at(u.x, u.y) * 64 : -1;
    if (d < 0) d = dist(u.x, u.y, t.x, t.y) * 1.6;
    d += extra;
    if (t.id === b.target) d *= 0.75;
    if (d < bd) {
      bd = d;
      best = t;
    }
  };
  g.state.jugadores.forEach((p, id) => {
    if (!p.vivo || p.fantasma || p.bajoTierra) return;
    if (p.disfrazado && !ignoreDisguise) return;
    const pd = g.pdata.get(id);
    if (pd && pd.intocable > 0) return;
    consider({ id, x: p.x, y: p.y, player: p });
  });
  g.state.unidades.forEach((o, id) => {
    if (o.team === "aliens" && o.t !== "planta") consider({ id, x: o.x, y: o.y }, o.t === "terminal" ? -200 : 60);
  });
  if (best) {
    const t = best as Target;
    if (b.target !== t.id && !b.alertado) {
      b.alertado = true;
      alertar(g, u, t.id);
    }
    b.target = t.id;
  }
  return best;
}

/** Al ver a un alien, avisa a los guardias cercanos (comportamiento de grupo). */
function alertar(g: Partida, u: Unit, objetivo: string): void {
  g.brains.forEach((ob, oid) => {
    const o = g.state.unidades.get(oid);
    if (!o || o === u || o.team !== "humanos" || ob.target) return;
    if (dist(o.x, o.y, u.x, u.y) < 450 && g.world.lineOfSight(o.x, o.y, u.x, u.y)) ob.target = objetivo;
  });
}

function move(g: Partida, u: Unit, b: Brain, dx: number, dy: number, speed: number, dt: number, solids: Circle[], r: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.01 || speed <= 0) return;
  speed *= b.lento;
  const pos = g.world.moveCircle(b.x, b.y, (dx / len) * speed * dt, (dy / len) * speed * dt, r, solids);
  if (Math.abs(pos.x - b.x) + Math.abs(pos.y - b.y) > 0.3) u.moviendo = true;
  b.x = pos.x;
  b.y = pos.y;
  u.x = Math.round(pos.x);
  u.y = Math.round(pos.y);
}

export function moverUnidad(g: Partida, u: Unit, b: Brain, dx: number, dy: number, speed: number, dt: number): void {
  move(g, u, b, dx, dy, speed, dt, g.solidProps(), unitRadius(u.t));
}

/** Dirección para acercarse a un objetivo rodeando paredes. */
function approachDir(g: Partida, u: Unit, t: Target, los: boolean): { x: number; y: number } {
  if (!los && t.player) {
    const f = g.flows.get(t.id);
    const d = f?.direction(u.x, u.y);
    if (d) return d;
  }
  const len = dist(u.x, u.y, t.x, t.y) || 1;
  return { x: (t.x - u.x) / len, y: (t.y - u.y) / len };
}

/** Sin objetivo: patrulla su ruta o deambula cerca de donde apareció. */
function patrullar(g: Partida, u: Unit, b: Brain, dt: number, solids: Circle[], speed: number): void {
  if (b.ruta.length) {
    const wp = b.ruta[b.rutaI % b.ruta.length];
    if (dist(u.x, u.y, wp.x, wp.y) < 30) b.rutaI++;
    else {
      move(g, u, b, wp.x - u.x, wp.y - u.y, speed * 0.55, dt, solids, unitRadius(u.t));
      u.ang = Math.atan2(wp.y - u.y, wp.x - u.x);
    }
    return;
  }
  b.vagaT -= dt;
  if (!b.vaga || b.vagaT <= 0) {
    b.vagaT = 2.5 + Math.random() * 3;
    const a = Math.random() * Math.PI * 2;
    const px = u.x + Math.cos(a) * 160;
    const py = u.y + Math.sin(a) * 160;
    b.vaga = g.world.blocksMoveAt(px, py) ? null : { x: px, y: py };
  }
  if (b.vaga && dist(u.x, u.y, b.vaga.x, b.vaga.y) > 20) {
    move(g, u, b, b.vaga.x - u.x, b.vaga.y - u.y, speed * 0.35, dt, solids, unitRadius(u.t));
    u.ang = Math.atan2(b.vaga.y - u.y, b.vaga.x - u.x);
  }
}

function separate(g: Partida, entries: [string, Unit, Brain][]): void {
  for (let i = 0; i < entries.length; i++) {
    const [ia, a, ba] = entries[i];
    if (!g.state.unidades.has(ia) || velocidad(a) === 0) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const [ib, c, bc] = entries[j];
      if (!g.state.unidades.has(ib)) continue;
      const ra = unitRadius(a.t);
      const rb = unitRadius(c.t);
      const dx = ba.x - bc.x;
      const dy = ba.y - bc.y;
      if (Math.abs(dx) > ra + rb || Math.abs(dy) > ra + rb) continue;
      const d = Math.hypot(dx, dy);
      const min = ra + rb;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (velocidad(a) > 0 && !g.world.blocksMoveAt(ba.x + nx * push, ba.y + ny * push)) {
          ba.x += nx * push;
          ba.y += ny * push;
          a.x = Math.round(ba.x);
          a.y = Math.round(ba.y);
        }
        if (velocidad(c) > 0 && !g.world.blocksMoveAt(bc.x - nx * push, bc.y - ny * push)) {
          bc.x -= nx * push;
          bc.y -= ny * push;
          c.x = Math.round(bc.x);
          c.y = Math.round(bc.y);
        }
      }
    }
  }
}

function velocidad(u: Unit): number {
  const e = enemyDef(u.t);
  if (e) return e.speed;
  return (ALLIES as Record<string, { speed: number }>)[u.t]?.speed ?? 0;
}

/** Ángulo de disparo: durante el Eclipse los guardias disparan a ciegas. */
function apuntar(g: Partida, u: Unit, base: number, spread: number): number {
  if (g.state.eclipse > 0) {
    const jefe = rangoDe(u.t) === "jefe";
    return base + (Math.random() - 0.5) * (jefe ? 0.5 : HAB.vesper.eclipseSpread * 2);
  }
  return base + (Math.random() - 0.5) * spread;
}

function disparar(g: Partida, uid: string, u: Unit, ang: number, k: string, speed: number, damage: number, range = 800): void {
  g.spawnProjectile(k, "humanos", u.x + Math.cos(ang) * 26, u.y + Math.sin(ang) * 26, ang, speed, { damage, range, shooter: uid, ff: g.state.eclipse > 0 });
}

// ------------------------------------------------------------------ comportamientos
function updateSoldado(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const def = enemyDef(u.t)!;
  const t = findTarget(g, u, b, u.t === "perro");
  if (u.t === "perro") sniff(g, u, b, dt);
  if (!t) {
    if (u.st === "apuntando") u.st = "";
    if (!b.fijo) patrullar(g, u, b, dt, solids, def.speed);
    return;
  }
  const d = dist(u.x, u.y, t.x, t.y);
  const los = d < 1100 && g.world.lineOfSight(u.x, u.y, t.x, t.y);
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  const [minR, maxR] = def.range;

  // Francotirador y guardia láser apuntando: quietos, con láser visible.
  if ((u.t === "francotirador" || u.t === "laser") && b.aimT > 0) {
    if (!los) {
      b.aimT = 0;
      u.st = "";
    } else {
      const tn = u.t === "laser" ? ENEMY_TUNING.laser : ENEMY_TUNING.francotirador;
      b.aimT += dt;
      if (b.aimT < tn.lockAt) u.ang = turn(u.ang, toT, (u.t === "laser" ? 2.5 : 4) * dt);
      u.stT = Math.min(1, b.aimT / tn.aimTime);
      if (b.aimT >= tn.aimTime) {
        const ang = g.state.eclipse > 0 ? apuntar(g, u, u.ang, 0) : u.ang;
        if (u.t === "laser") {
          g.spawnProjectile("rayo_laser", "humanos", u.x + Math.cos(ang) * 30, u.y + Math.sin(ang) * 30, ang, ENEMY_TUNING.laser.bulletSpeed, { damage: 0, range: 1500, shooter: uid, ff: g.state.eclipse > 0 });
          b.cd = ENEMY_TUNING.laser.cooldown;
        } else {
          g.spawnProjectile("rayo_franco", "humanos", u.x + Math.cos(ang) * 30, u.y + Math.sin(ang) * 30, ang, ENEMY_TUNING.francotirador.bulletSpeed, { damage: ENEMY_TUNING.francotirador.damage, range: 1400, shooter: uid, ff: g.state.eclipse > 0 });
          b.cd = ENEMY_TUNING.francotirador.cooldown;
        }
        b.aimT = 0;
        u.st = "";
      }
      return;
    }
  }

  // Movimiento
  let dir = { x: 0, y: 0 };
  let speed = def.speed;
  if (!los || d > maxR) {
    dir = approachDir(g, u, t, los);
  } else if (d < minR || (def.cientifico && d < 200)) {
    dir = { x: (u.x - t.x) / (d || 1), y: (u.y - t.y) / (d || 1) };
    if (def.cientifico) speed *= 1.1;
  } else {
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe *= -1;
      b.strafeT = 1.2 + Math.random() * 2;
    }
    dir = { x: -Math.sin(toT) * b.strafe, y: Math.cos(toT) * b.strafe };
    speed *= 0.45;
  }
  // Heridos: los guardias normales se retiran un poco para curarse cerca de médicos.
  if (def.rango === "normal" && u.hp < u.maxHp * 0.25 && los && d < maxR) {
    dir = { x: (u.x - t.x) / (d || 1), y: (u.y - t.y) / (d || 1) };
    speed *= 0.9;
  }
  if (u.t === "lanzallamas" && los && d < ENEMY_TUNING.lanzallamas.range) speed *= 0.4;
  if (!b.fijo) move(g, u, b, dir.x, dir.y, speed, dt, solids, def.radius);
  if (b.fijo) {
    if (los) u.ang = turn(u.ang, toT, 4 * dt);
  } else u.ang = los ? turn(u.ang, toT, 6 * dt) : Math.atan2(dir.y, dir.x) || u.ang;

  if (!los) return;
  attack(g, uid, u, b, t, d, toT, dt);
}

function attack(g: Partida, uid: string, u: Unit, b: Brain, t: Target, d: number, toT: number, dt: number): void {
  const def = enemyDef(u.t)!;
  switch (u.t as EnemyType) {
    case "fusilero":
    case "robot":
    case "oficial": {
      const tn = u.t === "robot" ? ENEMY_TUNING.robot : u.t === "oficial" ? ENEMY_TUNING.oficial : ENEMY_TUNING.fusilero;
      if (b.burst <= 0 && b.cd <= 0 && d < def.range[1] + 120) {
        b.burst = tn.burst;
        b.burstT = 0;
        b.cd = tn.cooldown + Math.random() * 0.8;
      }
      if (b.burst > 0) {
        b.burstT -= dt;
        if (b.burstT <= 0) {
          disparar(g, uid, u, apuntar(g, u, u.ang, 0.12), "bala_roja", tn.bulletSpeed, tn.damage);
          b.burst--;
          b.burstT = tn.burstGap;
        }
      }
      break;
    }
    case "escudo": {
      const tn = ENEMY_TUNING.escudo;
      if (d < tn.meleeRange + 10 && b.cd <= 0) {
        b.cd = tn.cooldown;
        hitTarget(g, t, tn.meleeDamage);
        if (t.player) {
          g.setEstado(t.id, t.player, "aturdido", tn.stun);
          const pos = g.world.moveCircle(t.player.x, t.player.y, Math.cos(toT) * 50, Math.sin(toT) * 50, 18, g.solidProps(), 1);
          t.player.x = pos.x;
          t.player.y = pos.y;
        }
        g.fx("impacto", t.x, t.y, { c: 0xffffff });
      }
      break;
    }
    case "lanzarredes": {
      const tn = ENEMY_TUNING.lanzarredes;
      if (b.cd <= 0 && d < def.range[1] + 100 && t.player) {
        b.cd = tn.cooldown;
        const a = apuntar(g, u, u.ang, 0);
        g.spawnProjectile("red_proy", "humanos", u.x + Math.cos(a) * 26, u.y + Math.sin(a) * 26, a, tn.netSpeed, { damage: 0, range: 700, shooter: uid });
      }
      break;
    }
    case "lanzallamas": {
      const tn = ENEMY_TUNING.lanzallamas;
      if (d > tn.range) break;
      u.st = "lanzando";
      const cone = (tn.cone * Math.PI) / 180;
      g.state.jugadores.forEach((p, id) => {
        if (!p.vivo || p.fantasma) return;
        const dd = dist(u.x, u.y, p.x, p.y);
        if (dd < tn.range && Math.abs(angleDiff(u.ang, Math.atan2(p.y - u.y, p.x - u.x))) < cone) g.damagePlayer(id, p, tn.dps * dt);
      });
      g.state.unidades.forEach((o, oid) => {
        if (o.team !== "aliens") return;
        if (dist(u.x, u.y, o.x, o.y) < tn.range && Math.abs(angleDiff(u.ang, Math.atan2(o.y - u.y, o.x - u.x))) < cone) g.danarAliado(oid, o, tn.dps * dt);
      });
      b.flameT -= dt;
      if (b.flameT <= 0) {
        b.flameT = 0.12;
        g.fx("llamas", u.x + Math.cos(u.ang) * 30, u.y + Math.sin(u.ang) * 30, { x2: u.x + Math.cos(u.ang) * tn.range, y2: u.y + Math.sin(u.ang) * tn.range });
      }
      b.patchT -= dt;
      if (b.patchT <= 0) {
        b.patchT = tn.firePatchEvery;
        const px = u.x + Math.cos(u.ang) * tn.range * 0.7;
        const py = u.y + Math.sin(u.ang) * tn.range * 0.7;
        if (!g.world.blocksMoveAt(px, py)) g.addZone("fuego", px, py, 42, tn.patchLife);
      }
      break;
    }
    case "francotirador":
    case "laser": {
      if (b.cd <= 0 && d < 1050) {
        b.aimT = 0.001;
        u.st = "apuntando";
        u.stT = 0;
      }
      break;
    }
    case "perro": {
      const tn = ENEMY_TUNING.perro;
      if (d < def.radius + 26 && b.cd <= 0) {
        b.cd = tn.cooldown;
        hitTarget(g, t, tn.biteDamage);
      }
      break;
    }
    case "criogenista":
    case "quimico":
    case "bioquimico": {
      const tn = ENEMY_TUNING[u.t as "criogenista"];
      if (b.cd <= 0 && d < 560) {
        b.cd = tn.cooldown + Math.random();
        const k = u.t === "criogenista" ? "frasco_azul" : u.t === "quimico" ? "frasco_verde" : "frasco_morado";
        const err = g.state.eclipse > 0 ? 260 : 40;
        g.throwFlask(k, u.x, u.y - 10, t.x + (Math.random() - 0.5) * err, t.y + (Math.random() - 0.5) * err, tn.flight, uid);
        u.st = "lanzando";
        u.stT = 0.3;
      } else if (u.st === "lanzando" && b.cd < tn.cooldown - 0.4) u.st = "";
      break;
    }
    case "ingeniero": {
      const tn = ENEMY_TUNING.ingeniero;
      b.devices = b.devices.filter((id) => g.state.unidades.has(id));
      if (b.cd <= 0) {
        b.cd = tn.cooldown;
        const hasT = b.devices.some((id) => g.state.unidades.get(id)?.t === "torreta");
        const hasS = b.devices.some((id) => g.state.unidades.get(id)?.t === "sensor");
        const ox = u.x + Math.cos(u.ang + Math.PI / 2) * 50;
        const oy = u.y + Math.sin(u.ang + Math.PI / 2) * 50;
        if (g.world.blocksMoveAt(ox, oy)) break;
        if (!hasT) b.devices.push(g.spawnUnit("torreta", ox, oy, "humanos", b.tag));
        else if (!hasS) b.devices.push(g.spawnUnit("sensor", ox, oy, "humanos", b.tag));
        g.fx("chispa", ox, oy);
      }
      break;
    }
    default:
      break;
  }
}

function hitTarget(g: Partida, t: Target, dmg: number): void {
  if (t.player) {
    g.damagePlayer(t.id, t.player, dmg);
    return;
  }
  const o = g.state.unidades.get(t.id);
  if (o) g.danarAliado(t.id, o, dmg);
}

function sniff(g: Partida, u: Unit, b: Brain, dt: number): void {
  b.t2 -= dt;
  if (b.t2 > 0) return;
  g.state.jugadores.forEach((p, id) => {
    if (!p.disfrazado || !p.vivo) return;
    if (dist(u.x, u.y, p.x, p.y) < ENEMY_TUNING.perro.sniffRange) {
      b.t2 = 6;
      g.fx("ladrido", u.x, u.y);
      g.revelar(id, p, "¡Un perro te olió y ladró! Se rompió tu disfraz.");
      b.target = id;
    }
  });
}

function updateTorreta(g: Partida, uid: string, u: Unit, b: Brain, dt: number): void {
  const tn = ENEMY_TUNING.torreta;
  const t = findTarget(g, u, b, false);
  if (!t) return;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d > enemyDef("torreta")!.range[1] || !g.world.lineOfSight(u.x, u.y, t.x, t.y)) return;
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  u.ang = turn(u.ang, toT, 5 * dt);
  if (b.cd <= 0 && Math.abs(angleDiff(u.ang, toT)) < 0.2) {
    b.cd = tn.cooldown;
    disparar(g, uid, u, apuntar(g, u, u.ang, 0.05), "bala_roja", tn.bulletSpeed, tn.damage, 700);
  }
}

function updateSensor(g: Partida, u: Unit, b: Brain, dt: number): void {
  b.t2 -= dt;
  u.ang += dt * 2;
  if (b.t2 > 0) return;
  g.state.jugadores.forEach((p, id) => {
    if (!p.disfrazado || !p.vivo) return;
    if (dist(u.x, u.y, p.x, p.y) < ENEMY_TUNING.ingeniero.sensorRange && g.world.lineOfSight(u.x, u.y, p.x, p.y)) {
      b.t2 = 2;
      g.revelar(id, p, "¡Un sensor detectó tu disfraz! Destrúyelo.");
      g.fx("revelado", u.x, u.y);
    }
  });
}

function updateMedico(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[], entries: [string, Unit, Brain][]): void {
  const tn = ENEMY_TUNING.medico;
  let ally: Unit | null = null;
  let ad = 700;
  for (const [oid, o, ob] of entries) {
    if (oid === uid || o.team !== "humanos" || rangoDe(o.t) === "dispositivo" || !g.state.unidades.has(oid)) continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < tn.healRange && o.hp < o.maxHp && rangoDe(o.t) !== "jefe") o.hp = Math.min(o.maxHp, o.hp + tn.healPerSec * dt);
    if (d < ad) {
      ad = d;
      ally = o;
    }
    if (b.cd <= 0 && d < tn.healRange) ob.shieldT = tn.shieldTime;
  }
  if (b.cd <= 0) {
    b.cd = tn.cooldown;
    g.fx("rescate", u.x, u.y, { c: 0x3ef0ff });
  }
  const t = findTarget(g, u, b, false);
  let dir = { x: 0, y: 0 };
  if (t && dist(u.x, u.y, t.x, t.y) < 260) {
    const d = dist(u.x, u.y, t.x, t.y) || 1;
    dir = { x: (u.x - t.x) / d, y: (u.y - t.y) / d };
  } else if (ally && ad > tn.healRange * 0.6) {
    const a = ally as Unit;
    dir = { x: a.x - u.x, y: a.y - u.y };
  } else if (!ally && t) {
    dir = approachDir(g, u, t, g.world.lineOfSight(u.x, u.y, t.x, t.y));
  } else if (!t) {
    patrullar(g, u, b, dt, solids, enemyDef("medico")!.speed);
    return;
  }
  move(g, u, b, dir.x, dir.y, enemyDef("medico")!.speed, dt, solids, enemyDef("medico")!.radius);
  if (t) u.ang = Math.atan2(t.y - u.y, t.x - u.x);
}

/** NPC de retos (inspector, técnico): recorren su ruta y huyen si les disparan. */
function updateNpc(g: Partida, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const def = enemyDef(u.t)!;
  if (b.j.saboteador) {
    patrullar(g, u, b, dt, solids, def.speed * 3.2);
    if (b.rutaI >= b.ruta.length) b.rutaI = b.ruta.length - 1;
    return;
  }
  if (u.hp < u.maxHp && b.t2 <= 0) b.t2 = 3;
  if (b.t2 > 0) {
    b.t2 -= dt;
    // Asustado: corre lejos del alien más cercano.
    let near: Player | null = null;
    let nd = 500;
    g.state.jugadores.forEach((p) => {
      if (p.vivo && dist(p.x, p.y, u.x, u.y) < nd) {
        nd = dist(p.x, p.y, u.x, u.y);
        near = p;
      }
    });
    if (near) {
      const n = near as Player;
      move(g, u, b, u.x - n.x, u.y - n.y, def.speed * 1.4, dt, solids, def.radius);
      return;
    }
  }
  patrullar(g, u, b, dt, solids, def.speed * 1.6);
}

/** Robot cazador: aparece fuera de la vista, corre hacia un alien, lo agarra y le quita vida hasta que lo rescaten. */
function updateCazador(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const tn = ENEMY_TUNING.cazador;
  const def = enemyDef("cazador")!;
  if (b.agarre) {
    const p = g.state.jugadores.get(b.agarre);
    if (!p || !p.vivo || p.estado !== "agarrado") {
      soltarAgarre(g, uid, u, b);
      return;
    }
    u.st = "agarrando";
    u.x = Math.round(p.x + Math.cos(u.ang + Math.PI) * 30);
    u.y = Math.round(p.y + Math.sin(u.ang + Math.PI) * 30);
    b.x = u.x;
    b.y = u.y;
    g.damagePlayer(b.agarre, p, tn.grabDps * dt);
    return;
  }
  if (u.st === "agarrando") u.st = "";
  const t = findTarget(g, u, b, false);
  if (!t || !t.player) {
    patrullar(g, u, b, dt, solids, def.speed);
    return;
  }
  const d = dist(u.x, u.y, t.x, t.y);
  const los = g.world.lineOfSight(u.x, u.y, t.x, t.y);
  const dir = approachDir(g, u, t, los);
  // Movimiento inquietante: zigzag a tirones.
  const tir = Math.sin(g.time * 9 + u.x) * 0.5;
  move(g, u, b, dir.x - dir.y * tir, dir.y + dir.x * tir, def.speed * (0.75 + Math.abs(Math.sin(g.time * 4)) * 0.5), dt, solids, def.radius);
  u.ang = Math.atan2(t.y - u.y, t.x - u.x);
  if (d < tn.grabRange && b.cd <= 0 && t.player.estado === "ok" && !t.player.bajoTierra) {
    b.agarre = t.id;
    b.cd = tn.cooldown;
    g.setEstado(t.id, t.player, "agarrado");
    g.fx("agarre", t.x, t.y);
  }
}

export function soltarAgarre(g: Partida, uid: string, u: Unit, b: Brain): void {
  const p = b.agarre ? g.state.jugadores.get(b.agarre) : undefined;
  if (p && p.estado === "agarrado") {
    p.estado = "ok";
    p.estadoT = 0;
    p.rescate = 0;
  }
  b.agarre = "";
  u.st = "";
  b.stun = Math.max(b.stun, ENEMY_TUNING.cazador.stunOnFree);
  void uid;
}

/** Dron de control: vuela sobre todo, dispara poco y molesta los retos. */
function updateDron(g: Partida, uid: string, u: Unit, b: Brain, dt: number): void {
  const def = enemyDef("dron")!;
  const t = findTarget(g, u, b, false);
  const objetivo = t ?? (b.ruta.length ? { id: "", ...b.ruta[b.rutaI % b.ruta.length] } : null);
  if (!objetivo) return;
  const d = dist(u.x, u.y, objetivo.x, objetivo.y);
  const ang = Math.atan2(objetivo.y - u.y, objetivo.x - u.x);
  const orbita = ang + Math.PI / 2;
  const want = d > 260 ? ang : orbita;
  const nx = u.x + Math.cos(want) * def.speed * b.lento * dt;
  const ny = u.y + Math.sin(want) * def.speed * b.lento * dt;
  if (!g.world.blocksMoveAt(nx, ny)) {
    b.x = nx;
    b.y = ny;
    u.x = Math.round(nx);
    u.y = Math.round(ny);
    u.moviendo = true;
  }
  u.ang = ang;
  if (!t && d < 30) b.rutaI++;
  if (t && b.cd <= 0 && d < 420 && g.world.lineOfSight(u.x, u.y, t.x, t.y)) {
    b.cd = ENEMY_TUNING.dron.cooldown;
    disparar(g, uid, u, apuntar(g, u, ang, 0.1), "bala_roja", ENEMY_TUNING.dron.bulletSpeed, ENEMY_TUNING.dron.damage, 600);
  }
}

// ------------------------------------------------------------------ aliados
function enemigoCercano(g: Partida, u: Unit, r: number, los = true): [string, Unit, number] | null {
  let best: [string, Unit, number] | null = null;
  let bd = r;
  g.state.unidades.forEach((o, oid) => {
    if (o.team !== "humanos" || o.t === "sensor" || o.t === "nodo") return;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bd && (!los || g.world.lineOfSight(u.x, u.y, o.x, o.y))) {
      bd = d;
      best = [oid, o, d];
    }
  });
  return best;
}

function updatePulpo(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  b.life -= dt;
  if (b.life <= 0) {
    g.killUnit(uid, u, "");
    return;
  }
  const kraken = u.t === "kraken";
  const owner = g.state.jugadores.get(b.owner);
  const dueno = owner ? g.stats(b.owner, owner) : undefined;
  const dano = kraken ? HAB.delmar.eco.krakenDamage * (1 + (dueno?.krakenDano ?? 0)) : HAB.delmar.pulpoDamage * (1 + (dueno?.pulpoDano ?? 0));
  const alcance = kraken ? HAB.delmar.eco.krakenRange : 28;
  const vel = kraken ? HAB.delmar.eco.krakenSpeed : HAB.delmar.pulpoSpeed;
  const best = enemigoCercano(g, u, 900);
  if (best) {
    const [oid, o, bd] = best;
    const r = unitRadius(o.t);
    if (bd > r + alcance - 8) move(g, u, b, o.x - u.x, o.y - u.y, vel, dt, solids, unitRadius(u.t));
    u.ang = Math.atan2(o.y - u.y, o.x - u.x);
    if (bd < r + alcance && b.cd <= 0) {
      b.cd = kraken ? 0.7 : 0.5;
      g.hitUnit(oid, o, dano, null, b.owner);
      g.fx(kraken ? "tentaculo" : "impacto", kraken ? u.x : o.x, kraken ? u.y : o.y, { x2: o.x, y2: o.y, c: 0xff6b3d });
    }
    return;
  }
  if (owner && owner.vivo && dist(u.x, u.y, owner.x, owner.y) > 90) {
    const f = g.flows.get(b.owner);
    const d = f?.direction(u.x, u.y) ?? { x: owner.x - u.x, y: owner.y - u.y };
    move(g, u, b, d.x, d.y, vel * 0.8, dt, solids, unitRadius(u.t));
  }
}

/** Huésped del Simbionte (guardia poseído con su arma) o criatura simbionte. */
function updateHuesped(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const owner = g.state.jugadores.get(u.dueno);
  if (!owner) {
    g.killUnit(uid, u, "");
    return;
  }
  const s = g.stats(u.dueno, owner);
  // Transformación progresiva: guardia poseído → criatura simbionte.
  if (u.t !== "cria" && !b.mantener) {
    b.hostT += dt;
    if (b.hostT >= HAB.simbionte.hostStageTime) {
      u.t = "cria";
      u.fase = 1;
      u.maxHp = Math.round(HAB.simbionte.criaHp * (1 + (s.huesped ?? 0)));
      u.hp = Math.max(u.hp, u.maxHp * 0.7);
      g.fx("asimilar", u.x, u.y);
    }
  }
  const def = enemyDef(u.t);
  const vel = u.t === "cria" ? HAB.simbionte.criaSpeed : (def?.speed ?? 150) * 1.1;
  const r = unitRadius(u.t);
  // Orden: ir a un punto y quedarse.
  if (b.orden) {
    const d = dist(u.x, u.y, b.orden.x, b.orden.y);
    if (d > 16) {
      move(g, u, b, b.orden.x - u.x, b.orden.y - u.y, vel, dt, solids, r);
      u.ang = Math.atan2(b.orden.y - u.y, b.orden.x - u.x);
    }
  }
  const best = enemigoCercano(g, u, b.orden ? 360 : 520);
  if (best) {
    const [oid, o, bd] = best;
    u.ang = Math.atan2(o.y - u.y, o.x - u.x);
    if (u.t === "cria") {
      if (!b.orden && bd > unitRadius(o.t) + 22) move(g, u, b, o.x - u.x, o.y - u.y, vel, dt, solids, r);
      if (bd < unitRadius(o.t) + 30 && b.cd <= 0) {
        b.cd = 0.6;
        g.hitUnit(oid, o, HAB.simbionte.criaDamage * (1 + (s.huesped ?? 0)), null, u.dueno);
        if (g.state.unidades.has(oid)) {
          // Los simbiontes aliados infectan más rápido.
          const p = g.state.jugadores.get(u.dueno);
          if (p) {
            const logic = g.state.unidades.get(oid);
            if (logic) infectarDesdeAliado(g, u.dueno, oid, logic);
          }
        }
        g.fx("impacto", o.x, o.y, { c: 0xd36be8 });
      }
    } else if (b.cd <= 0 && bd < 520) {
      // Guardia poseído: dispara con su arma a sus antiguos compañeros.
      b.cd = 0.9 + Math.random() * 0.4;
      const a = u.ang + (Math.random() - 0.5) * 0.1;
      g.spawnProjectile("bala", "aliens", u.x + Math.cos(a) * 26, u.y + Math.sin(a) * 26, a, 760, { damage: 7 * (1 + (s.huesped ?? 0)), range: 650, owner: u.dueno, shooter: uid });
    }
    if (!b.orden && u.t !== "cria" && bd < 200) move(g, u, b, u.x - o.x, u.y - o.y, vel * 0.5, dt, solids, r);
    return;
  }
  if (!b.orden && owner.vivo && dist(u.x, u.y, owner.x, owner.y) > 110) {
    const f = g.flows.get(u.dueno);
    const d = f?.direction(u.x, u.y) ?? { x: owner.x - u.x, y: owner.y - u.y };
    move(g, u, b, d.x, d.y, vel * 0.9, dt, solids, r);
  }
}

function infectarDesdeAliado(g: Partida, owner: string, oid: string, o: Unit): void {
  if (o.st === "infectado") return;
  const def = enemyDef(o.t);
  if (!def || def.rango === "jefe" || def.rango === "dispositivo" || !def.controlable) return;
  o.infeccion = Math.min(1, o.infeccion + HAB.simbionte.infectAura * (def.rango === "elite" ? HAB.simbionte.eliteInfectMul : 1));
  if (o.infeccion >= 1) {
    o.st = "infectado";
    o.stT = 6;
    o.dueno = owner;
    g.fx("infectar", o.x, o.y);
  }
  void oid;
}

/** Planta carnívora del Jardín: muerde y sujeta a los enemigos cercanos. */
function updatePlanta(g: Partida, uid: string, u: Unit, b: Brain): void {
  b.life -= 1 / 30;
  if (b.life <= 0) {
    g.removeUnit(uid);
    return;
  }
  if (b.cd > 0) return;
  const owner = g.state.jugadores.get(b.owner);
  const best = enemigoCercano(g, u, HAB.curandera.jardin.plantRange, false);
  if (!best) return;
  const [oid, o] = best;
  b.cd = 1.5;
  u.ang = Math.atan2(o.y - u.y, o.x - u.x);
  const ob = g.brains.get(oid);
  const jefe = rangoDe(o.t) === "jefe";
  if (ob && !jefe) ob.stun = Math.max(ob.stun, HAB.curandera.jardin.root);
  g.hitUnit(oid, o, HAB.curandera.jardin.plantDamage * (owner ? 1 + g.st(b.owner, owner, "dano") : 1), null, b.owner);
  g.fx("mordida", o.x, o.y, { c: 0x5fd068 });
}

function turn(a: number, target: number, maxStep: number): number {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

export { turn, findTarget, approachDir, move as moverConColision, patrullar, disparar, apuntar, hitTarget };
export type { Target };
