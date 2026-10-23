// Inteligencia de enemigos, torretas, sensores y pulpos aliados.
import { ENEMIES, ENEMY_TUNING, TRANSMUTAR, angleDiff, dist, type Circle, type EnemyType } from "@dawg/shared";
import type { Player, Unit } from "../schema/GameState";
import type { Partida } from "./Partida";

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
  /** Vida restante (pulpos). */
  life: number;
  /** Jugador dueño (pulpos) o que lo transmutó. */
  owner: string;
  /** Etiqueta del encuentro que lo generó. */
  tag: string;
  shieldT: number;
  t2: number;
  kinds: number;
  devices: string[];
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

  for (const [uid, u, b] of entries) {
    if (!g.state.unidades.has(uid)) continue;
    // Sincronizar si algo movió la unidad desde fuera (telequinesis).
    if (Math.round(b.x) !== u.x || Math.round(b.y) !== u.y) {
      b.x = u.x;
      b.y = u.y;
    }
    if (b.shieldT > 0) b.shieldT -= dt;
    u.blindado = b.shieldT > 0;
    u.moviendo = false;
    if (b.stun > 0) {
      b.stun -= dt;
      u.st = "aturdido";
      b.aimT = 0;
      continue;
    }
    if (u.st === "aturdido") u.st = "";
    b.cd -= dt;

    if (u.team === "aliens") {
      updatePulpo(g, uid, u, b, dt, solids);
      continue;
    }
    switch (u.t as EnemyType) {
      case "torreta":
        updateTorreta(g, u, b, dt);
        break;
      case "sensor":
        updateSensor(g, u, b, dt);
        break;
      case "medico":
        updateMedico(g, uid, u, b, dt, solids, entries);
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
    if (!p.vivo || p.fantasma) return;
    if (p.disfrazado && !ignoreDisguise) return;
    consider({ id, x: p.x, y: p.y, player: p });
  });
  g.state.unidades.forEach((o, id) => {
    if (o.team === "aliens") consider({ id, x: o.x, y: o.y }, 60);
  });
  if (best) b.target = (best as Target).id;
  return best;
}

function move(g: Partida, u: Unit, b: Brain, dx: number, dy: number, speed: number, dt: number, solids: Circle[], r: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.01 || speed <= 0) return;
  const pos = g.world.moveCircle(b.x, b.y, (dx / len) * speed * dt, (dy / len) * speed * dt, r, solids);
  if (Math.abs(pos.x - b.x) + Math.abs(pos.y - b.y) > 0.3) u.moviendo = true;
  b.x = pos.x;
  b.y = pos.y;
  u.x = Math.round(pos.x);
  u.y = Math.round(pos.y);
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

function separate(g: Partida, entries: [string, Unit, Brain][]): void {
  for (let i = 0; i < entries.length; i++) {
    const [ia, a, ba] = entries[i];
    if (!g.state.unidades.has(ia) || ENEMIES_SPEED(a) === 0) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const [ib, c, bc] = entries[j];
      if (!g.state.unidades.has(ib)) continue;
      const ra = radius(a);
      const rb = radius(c);
      const dx = ba.x - bc.x;
      const dy = ba.y - bc.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (ENEMIES_SPEED(a) > 0 && !g.world.blocksMoveAt(ba.x + nx * push, ba.y + ny * push)) {
          ba.x += nx * push;
          ba.y += ny * push;
          a.x = Math.round(ba.x);
          a.y = Math.round(ba.y);
        }
        if (ENEMIES_SPEED(c) > 0 && !g.world.blocksMoveAt(bc.x - nx * push, bc.y - ny * push)) {
          bc.x -= nx * push;
          bc.y -= ny * push;
          c.x = Math.round(bc.x);
          c.y = Math.round(bc.y);
        }
      }
    }
  }
}

function radius(u: Unit): number {
  return u.t === "pulpo" ? 16 : ENEMIES[u.t as EnemyType].radius;
}

function ENEMIES_SPEED(u: Unit): number {
  return u.t === "pulpo" ? TRANSMUTAR.pulpoSpeed : ENEMIES[u.t as EnemyType].speed;
}

// ------------------------------------------------------------------ comportamientos
function updateSoldado(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const def = ENEMIES[u.t as EnemyType];
  const t = findTarget(g, u, b, u.t === "perro");
  if (u.t === "perro") sniff(g, u, b, dt);
  if (u.t === "jefe") bossTick(g, uid, u, b, dt);
  if (!t) {
    u.st = u.st === "apuntando" ? "" : u.st;
    return;
  }
  const d = dist(u.x, u.y, t.x, t.y);
  const los = d < 1100 && g.world.lineOfSight(u.x, u.y, t.x, t.y);
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  const [minR, maxR] = def.range;

  // Francotirador apuntando: quieto, con láser visible.
  if (u.t === "francotirador" && b.aimT > 0) {
    if (!los) {
      b.aimT = 0;
      u.st = "";
    } else {
      const tn = ENEMY_TUNING.francotirador;
      b.aimT += dt;
      if (b.aimT < tn.lockAt) u.ang = turn(u.ang, toT, 4 * dt);
      u.stT = Math.min(1, b.aimT / tn.aimTime);
      if (b.aimT >= tn.aimTime) {
        g.spawnProjectile("rayo_franco", "humanos", u.x + Math.cos(u.ang) * 30, u.y + Math.sin(u.ang) * 30, u.ang, tn.bulletSpeed, { damage: tn.damage, range: 1400 });
        b.aimT = 0;
        b.cd = tn.cooldown;
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
  } else if (u.t !== "torreta") {
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe *= -1;
      b.strafeT = 1.2 + Math.random() * 2;
    }
    dir = { x: -Math.sin(toT) * b.strafe, y: Math.cos(toT) * b.strafe };
    speed *= 0.45;
  }
  if (u.t === "lanzallamas" && los && d < ENEMY_TUNING.lanzallamas.range) speed *= 0.4;
  move(g, u, b, dir.x, dir.y, speed, dt, solids, def.radius);
  u.ang = los ? turn(u.ang, toT, 6 * dt) : Math.atan2(dir.y, dir.x) || u.ang;

  if (!los) return;
  attack(g, uid, u, b, t, d, toT, dt);
}

function attack(g: Partida, uid: string, u: Unit, b: Brain, t: Target, d: number, toT: number, dt: number): void {
  const def = ENEMIES[u.t as EnemyType];
  switch (u.t as EnemyType) {
    case "fusilero": {
      const tn = ENEMY_TUNING.fusilero;
      if (b.burst <= 0 && b.cd <= 0 && d < def.range[1] + 120) {
        b.burst = tn.burst;
        b.burstT = 0;
        b.cd = tn.cooldown + Math.random() * 0.8;
      }
      if (b.burst > 0) {
        b.burstT -= dt;
        if (b.burstT <= 0) {
          const a = u.ang + (Math.random() - 0.5) * 0.12;
          g.spawnProjectile("bala_roja", "humanos", u.x + Math.cos(a) * 26, u.y + Math.sin(a) * 26, a, tn.bulletSpeed, { damage: tn.damage, range: 800 });
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
        hitTarget(g, t, tn.meleeDamage, uid);
        if (t.player) {
          g.setEstado(t.id, t.player, "aturdido", tn.stun);
          const pos = g.world.moveCircle(t.player.x, t.player.y, Math.cos(toT) * 50, Math.sin(toT) * 50, 18, g.solidProps());
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
        g.spawnProjectile("red_proy", "humanos", u.x + Math.cos(u.ang) * 26, u.y + Math.sin(u.ang) * 26, u.ang, tn.netSpeed, { damage: 0, range: 700 });
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
        if (dist(u.x, u.y, o.x, o.y) < tn.range && Math.abs(angleDiff(u.ang, Math.atan2(o.y - u.y, o.x - u.x))) < cone) {
          o.hp -= tn.dps * dt;
          if (o.hp <= 0) g.killUnit(oid, o, "");
        }
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
    case "francotirador": {
      if (b.cd <= 0 && d < 1000) {
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
        hitTarget(g, t, tn.biteDamage, uid);
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
        g.throwFlask(k, u.x, u.y - 10, t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 40, tn.flight, uid);
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
    case "jefe": {
      const tn = ENEMY_TUNING.jefe;
      if (b.cd <= 0 && d < 700) {
        b.cd = u.tanques > 0 ? tn.cooldown : tn.angryCooldown;
        const kinds = ["frasco_azul", "frasco_verde", "frasco_morado"] as const;
        const k = kinds[b.kinds++ % 3];
        for (const off of [-80, 0, 80]) {
          const px = t.x + Math.cos(toT + Math.PI / 2) * off;
          const py = t.y + Math.sin(toT + Math.PI / 2) * off;
          g.throwFlask(k, u.x, u.y - 30, px, py, 1.0, uid);
        }
        u.st = "lanzando";
        u.stT = 0.4;
      }
      break;
    }
    default:
      break;
  }
}

function hitTarget(g: Partida, t: Target, dmg: number, from: string): void {
  if (t.player) {
    g.damagePlayer(t.id, t.player, dmg);
    return;
  }
  const o = g.state.unidades.get(t.id);
  if (!o) return;
  o.hp -= dmg;
  if (o.hp <= 0) g.killUnit(t.id, o, "");
  void from;
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

function bossTick(g: Partida, uid: string, u: Unit, b: Brain, dt: number): void {
  b.t2 += dt;
  if (b.t2 >= ENEMY_TUNING.jefe.reinforceEvery) {
    b.t2 = 0;
    g.director.spawnNear(["fusilero", "escudo", "medico"], u.x, u.y, "jefe");
    g.aviso("¡El Jefe llamó refuerzos!", "peligro");
  }
  void uid;
}

function updateTorreta(g: Partida, u: Unit, b: Brain, dt: number): void {
  const tn = ENEMY_TUNING.torreta;
  const t = findTarget(g, u, b, false);
  if (!t) return;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d > ENEMIES.torreta.range[1] || !g.world.lineOfSight(u.x, u.y, t.x, t.y)) return;
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  u.ang = turn(u.ang, toT, 5 * dt);
  if (b.cd <= 0 && Math.abs(angleDiff(u.ang, toT)) < 0.2) {
    b.cd = tn.cooldown;
    g.spawnProjectile("bala_roja", "humanos", u.x + Math.cos(u.ang) * 26, u.y + Math.sin(u.ang) * 26, u.ang, tn.bulletSpeed, { damage: tn.damage, range: 700 });
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
  // Curar a los humanos cercanos
  let ally: Unit | null = null;
  let ad = 700;
  for (const [oid, o, ob] of entries) {
    if (oid === uid || o.team !== "humanos" || o.t === "torreta" || o.t === "sensor" || !g.state.unidades.has(oid)) continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < tn.healRange && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + tn.healPerSec * dt);
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
  }
  move(g, u, b, dir.x, dir.y, ENEMIES.medico.speed, dt, solids, ENEMIES.medico.radius);
  if (t) u.ang = Math.atan2(t.y - u.y, t.x - u.x);
}

function updatePulpo(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  b.life -= dt;
  if (b.life <= 0) {
    g.killUnit(uid, u, "");
    return;
  }
  let best: [string, Unit] | null = null;
  let bd = 900;
  g.state.unidades.forEach((o, oid) => {
    if (o.team !== "humanos" || o.t === "sensor") return;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bd && g.world.lineOfSight(u.x, u.y, o.x, o.y)) {
      bd = d;
      best = [oid, o];
    }
  });
  if (best) {
    const [oid, o] = best as [string, Unit];
    const r = ENEMIES[o.t as EnemyType].radius;
    if (bd > r + 20) move(g, u, b, o.x - u.x, o.y - u.y, TRANSMUTAR.pulpoSpeed, dt, solids, 16);
    u.ang = Math.atan2(o.y - u.y, o.x - u.x);
    if (bd < r + 28 && b.cd <= 0) {
      b.cd = 0.5;
      g.hitUnit(oid, o, TRANSMUTAR.pulpoDamage, null, b.owner);
      g.fx("impacto", o.x, o.y, { c: 0xff6b3d });
    }
    return;
  }
  const owner = g.state.jugadores.get(b.owner);
  if (owner && owner.vivo && dist(u.x, u.y, owner.x, owner.y) > 90) {
    const f = g.flows.get(b.owner);
    const d = f?.direction(u.x, u.y) ?? { x: owner.x - u.x, y: owner.y - u.y };
    move(g, u, b, d.x, d.y, TRANSMUTAR.pulpoSpeed * 0.8, dt, solids, 16);
  }
}

function turn(a: number, target: number, maxStep: number): number {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}
