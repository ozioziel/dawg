// Lógica de los ocho aliens: ataque básico, habilidad activa, definitiva y recursos.
// Se aplica según la FORMA actual del jugador (su alien o el de un alma prestada).
import {
  ALIENS,
  HAB,
  TILE,
  angleDiff,
  dist,
  enemyDef,
  isConvertible,
  rangoDe,
  unitRadius,
  type AlienKind,
  type InputMsg,
} from "@dawg/shared";
import type { Player, Unit } from "../schema/GameState";
import type { Brain } from "./enemigos";
import type { Partida, PData } from "./Partida";

export interface LogicaAlien {
  habilidad(g: Partida, id: string, p: Player, x: number, y: number): void;
  /** Al soltar la habilidad (las que se mantienen). */
  soltar?(g: Partida, id: string, p: Player, x: number, y: number): void;
  /** Activa la definitiva. Devuelve true si se gastó. */
  ulti(g: Partida, id: string, p: Player, x: number, y: number): boolean;
  /** Pulsaciones de definitiva que continúan una ya activa (2.º extremo del túnel). */
  ultiContinua?(g: Partida, id: string, p: Player, x: number, y: number): boolean;
  /** E propio del alien (absorber del Simbionte). */
  interactuar?(g: Partida, id: string, p: Player): boolean;
  moverControlado?(g: Partida, id: string, p: Player, inp: InputMsg, dt: number): void;
  infectar?(g: Partida, owner: string, uid: string, u: Unit, amount: number): void;
}

const pd = (g: Partida, id: string): PData => g.pdata.get(id)!;
const enf = (g: Partida, id: string, p: Player, base: number) => base * (1 - Math.min(0.5, g.st(id, p, "enfriamiento")));
const setCd = (g: Partida, id: string, p: Player, base: number) => {
  p.enfriamiento = enf(g, id, p, base);
  p.enfMax = Math.max(0.1, p.enfriamiento);
};
const esGuardia = (u: Unit) => u.team === "humanos" && rangoDe(u.t) !== "dispositivo";
const forma = (p: Player) => p.forma as AlienKind;

/** Zonas de definitivas con dueño (para curar, atraer, explotar…). */
const zonasDueno = new Map<string, { owner: string; detonada?: boolean }>();

// ================================================================== ataque básico
export function ataqueBasico(g: Partida, id: string, p: Player, d: PData, dt: number): void {
  if (p.controla || p.bajoTierra) return;
  const f = forma(p);
  const def = ALIENS[f];
  const s = g.stats(id, p);
  if (f === "curandera" && p.cautivo) {
    g.aviso("Tienes la boca llena: digiere al cautivo (habilidad) para volver a atacar.", "info", id);
    return;
  }
  // Mutación Berserk: garras cuerpo a cuerpo en lugar de la pistola.
  if (f === "cambiaformas" && p.ultiT > 0) {
    if (d.shootCd > 0) return;
    const bz = HAB.cambiaformas.berserk;
    d.shootCd = bz.cooldown;
    const dano = bz.damage * (1 + (s.dano ?? 0)) * (1 + (s.berserkDano ?? 0));
    const golpes = golpeCuerpo(g, id, p, bz.range, 110, 3, () => dano);
    if (golpes > 0) g.curarJugador(id, p, dano * golpes * (bz.lifesteal + (s.berserkRobo ?? 0)), "");
    g.fx("tajo", p.x + Math.cos(p.aim) * 40, p.y + Math.sin(p.aim) * 40, { c: 0x9cff5a, r: p.aim });
    return;
  }
  const a = def.ataque;
  if (a.tipo === "proyectil") {
    if (d.shootCd > 0) return;
    d.shootCd = 1 / (a.fireRate * (1 + (s.cadencia ?? 0)));
    let dano = a.damage * (1 + (s.dano ?? 0));
    if (f === "cambiaformas" && p.disfrazado) {
      dano *= HAB.cambiaformas.surpriseBonus + (s.sorpresa ?? 0);
      g.revelar(id, p, "Disparaste: tu disfraz se rompió (golpe sorpresa).");
    }
    let ox = p.x + Math.cos(p.aim) * 24;
    let oy = p.y + Math.sin(p.aim) * 24;
    if (!g.world.lineOfSight(p.x, p.y, ox, oy)) {
      ox = p.x;
      oy = p.y;
    }
    g.spawnProjectile(a.projectile, "aliens", ox, oy, p.aim, a.bulletSpeed, {
      damage: dano,
      pierce: a.pierce,
      owner: id,
      range: a.range,
      infecta: f === "simbionte" ? HAB.simbionte.infectPerHit * (1 + (s.infeccion ?? 0)) : undefined,
      veneno: f === "curandera" && s.veneno ? s.veneno : undefined,
      robo: f === "inteligente" && s.roboVida ? s.roboVida : undefined,
    });
    return;
  }
  if (a.tipo === "melee") {
    if (d.shootCd > 0) return;
    if (f === "escarabajo") {
      d.shootCd = Math.max(3, a.cooldown * (1 - (s.mordidaCd ?? 0)));
      const n = golpeCuerpo(g, id, p, a.range, a.arco, 1, (u) => {
        const r = rangoDe(u.t);
        if (r === "normal" || r === "npc") return u.hp + 999; // ejecuta
        return (r === "jefe" ? HAB.escarabajo.biteBoss : HAB.escarabajo.biteElite) * (1 + (s.mordida ?? 0));
      });
      g.fx("mordida", p.x + Math.cos(p.aim) * 44, p.y + Math.sin(p.aim) * 44, { c: n ? 0xff3b3b : 0xa8c84a, r: p.aim });
      if (!n) d.shootCd = 0.6; // fallar no castiga tanto
      return;
    }
    // Vesper: cuchillo
    d.shootCd = a.cooldown * (1 - Math.min(0.4, s.cadencia ?? 0));
    const base = a.damage * (1 + (s.dano ?? 0));
    golpeCuerpo(g, id, p, a.range, a.arco, 1, (u) => {
      if (p.punal > 0) {
        p.punal = 0;
        g.fx("texto", u.x, u.y, { s: "¡PUÑALADA!", c: 0xb37bff });
        return base * HAB.vesper.backstabMul * (1 + (s.punalada ?? 0));
      }
      const desdeAtras = Math.abs(angleDiff(u.ang, Math.atan2(p.y - u.y, p.x - u.x))) > (2 * Math.PI) / 3;
      return desdeAtras ? base * HAB.vesper.behindMul * (1 + (s.punalada ?? 0) * 0.5) : base;
    });
    g.fx("tajo", p.x + Math.cos(p.aim) * 36, p.y + Math.sin(p.aim) * 36, { c: 0xb37bff, r: p.aim });
    return;
  }
  // Chorro de hielo de Freeze
  p.disparando = true;
  const dano = a.dps * (1 + (s.dano ?? 0)) * dt;
  const cone = (a.cono * Math.PI) / 180;
  g.state.unidades.forEach((u, uid) => {
    if (u.team !== "humanos") return;
    const dd = dist(p.x, p.y, u.x, u.y) - unitRadius(u.t) * 0.6;
    if (dd > a.range || Math.abs(angleDiff(p.aim, Math.atan2(u.y - p.y, u.x - p.x))) > cone) return;
    if (!g.world.lineOfSight(p.x, p.y, u.x, u.y)) return;
    enfriar(g, id, p, uid, u, (a.frio / 100) * (1 + (s.frio ?? 0)) * dt);
    g.hitUnit(uid, u, dano, null, id);
  });
  g.sectores.chorro(id, p, dt);
  d.chorroFx -= dt;
  if (d.chorroFx <= 0) {
    d.chorroFx = 0.25;
    g.mejoras.registrar("control", 0.25);
  }
}

/** Golpe cuerpo a cuerpo en arco: devuelve cuántos enemigos alcanzó. */
function golpeCuerpo(g: Partida, id: string, p: Player, range: number, arcoDeg: number, max: number, dano: (u: Unit) => number): number {
  const arco = (arcoDeg * Math.PI) / 360;
  const cand: [string, Unit, number][] = [];
  g.state.unidades.forEach((u, uid) => {
    if (u.team !== "humanos" || u.t === "nodo") return;
    const d = dist(p.x, p.y, u.x, u.y) - unitRadius(u.t);
    if (d > range) return;
    if (Math.abs(angleDiff(p.aim, Math.atan2(u.y - p.y, u.x - p.x))) > arco && d > 12) return;
    cand.push([uid, u, d]);
  });
  cand.sort((a, b) => a[2] - b[2]);
  let n = 0;
  for (const [uid, u] of cand.slice(0, max)) {
    g.hitUnit(uid, u, dano(u), { vx: Math.cos(p.aim), vy: Math.sin(p.aim) }, id);
    n++;
  }
  return n;
}

/** Acumula frío; al llenarse, congela. */
export function enfriar(g: Partida, id: string, p: Player, uid: string, u: Unit, cantidad: number): void {
  const b = g.brains.get(uid);
  if (!b) return;
  const jefe = rangoDe(u.t) === "jefe";
  b.ultimoFrio = g.time;
  if (b.hielo > 0) return;
  u.frio = Math.min(1, u.frio + cantidad * (jefe ? HAB.freeze.bossFrioMul : 1));
  if (u.frio >= 1) {
    const s = g.stats(id, p);
    b.hielo = (jefe ? HAB.freeze.bossFreezeTime : HAB.freeze.freezeTime) * (1 + (s.congelacion ?? 0));
    u.frio = 1;
    g.fx("congelar", u.x, u.y);
    g.mejoras.registrar("control", b.hielo);
  }
}

// ================================================================== tick de forma
export function tickForma(g: Partida, id: string, p: Player, dt: number): void {
  const d = pd(g, id);
  const f = forma(p);
  if (p.ultiT > 0) {
    p.ultiT -= dt;
    if (p.ultiT <= 0) finUlti(g, id, p);
  }
  switch (f) {
    case "cambiaformas":
      tickCambiaformas(g, id, p, d, dt);
      break;
    case "inteligente":
      tickTelequinesis(g, id, p, d, dt);
      break;
    case "escarabajo":
      tickEscarabajo(g, id, p, d, dt);
      break;
    case "simbionte":
      tickSimbionte(g, id, p, d, dt);
      break;
    default:
      if (p.energia < 100) p.energia = Math.min(100, p.energia + 20 * dt);
  }
}

function finUlti(g: Partida, id: string, p: Player): void {
  p.ultiT = 0;
  switch (forma(p)) {
    case "cambiaformas":
      g.fx("berserk", p.x, p.y, { c: 0x7fb24a });
      g.aviso("La mutación termina: vuelves a tu forma.", "info", id);
      break;
    case "delmar":
      revertirKrakens(g, id);
      break;
    case "simbionte":
      p.escudo = 0;
      g.fx("fusion", p.x, p.y, { r: 0 });
      g.aviso("La Fusión Colosal terminó: toda la colonia se consumió. Empiezas de cero.", "info", id);
      break;
    case "escarabajo":
      break;
  }
}

/** Limpia los estados propios de una forma al cambiar de forma o al morir. */
export function alSalirDeForma(g: Partida, id: string, p: Player): void {
  const d = pd(g, id);
  if (p.disfrazado) p.disfrazado = false;
  p.sospecha = 0;
  if (p.controla) soltarControl(g, id, p);
  if (p.cautivo) {
    // Escupe al cautivo, aturdido.
    const uid = g.spawnUnit(p.cautivo as never, p.x + Math.cos(p.aim) * 50, p.y + Math.sin(p.aim) * 50, "humanos", "escupido");
    const b = g.brains.get(uid);
    if (b) b.stun = 2;
    p.cautivo = "";
  }
  if (p.bajoTierra) {
    p.bajoTierra = false;
    const pos = g.lugarLibre(p.x, p.y, p.x, p.y);
    p.x = pos.x;
    p.y = pos.y;
  }
  if (p.forma === "delmar" && p.ultiT > 0) revertirKrakens(g, id);
  if (p.forma === "simbionte" && p.ultiT > 0) p.escudo = 0;
  p.tunel = 0;
  d.tunelA = null;
  p.ultiT = 0;
  p.escudo = 0;
  p.canal = 0;
  p.canalTipo = "";
  d.canal = null;
  d.habObjetivo = "";
  p.disparando = false;
  p.punal = 0;
  // La colonia muere con su huésped original.
  if (!p.vivo) {
    g.state.unidades.forEach((u, uid) => {
      if (u.dueno === id && (u.poseido === "S" || u.t === "cria")) g.killUnit(uid, u, "");
    });
  }
}

// ================================================================== Cambiaformas
function tickCambiaformas(g: Partida, id: string, p: Player, d: PData, dt: number): void {
  const H = HAB.cambiaformas;
  const s = g.stats(id, p);
  // Escaneo en curso
  if (d.canal && d.canal.tipo === "escanear") {
    const u = g.state.unidades.get(d.canal.objetivo);
    if (!u || u.team !== "humanos" || dist(p.x, p.y, u.x, u.y) > H.scanRange * 1.7 || p.estado !== "ok") {
      d.canal = null;
      p.canal = 0;
      p.canalTipo = "";
      g.aviso("Escaneo interrumpido: quédate cerca del guardia.", "info", id);
    } else {
      d.canal.t += dt;
      p.canal = Math.min(1, d.canal.t / d.canal.dur);
      if (d.canal.t >= d.canal.dur) {
        p.identidad = u.t;
        d.copia = d.canal.objetivo;
        d.canal = null;
        p.canal = 0;
        p.canalTipo = "";
        setCd(g, id, p, ALIENS.cambiaformas.habilidad.cooldown);
        g.fx("disfraz", p.x, p.y, { c: 0x7fb24a });
        if (p.energia >= H.minToActivate) {
          p.disfrazado = true;
          p.sospecha = 0;
          d.sorpresa = true;
        }
        g.aviso(`Identidad copiada: ${enemyDef(u.t)?.nombre ?? u.t}. ${p.disfrazado ? "Vas disfrazado: disparar te delata." : "Recarga energía para disfrazarte."}`, "exito", id);
        g.sectores.onEscaneo(id, p, u);
      }
    }
  }
  if (p.disfrazado) {
    p.energia -= H.drainPerSec * (1 - Math.min(0.6, s.energiaDisfraz ?? 0)) * dt;
    // Sospecha progresiva: cerca de guardias, junto al original, en zonas restringidas.
    const mul = 1 - Math.min(0.7, s.sospecha ?? 0);
    let cerca = false;
    g.state.unidades.forEach((u, uid) => {
      if (u.team !== "humanos" || rangoDe(u.t) === "dispositivo") return;
      const dd = dist(p.x, p.y, u.x, u.y);
      if (dd > H.suspicionRange || !g.world.lineOfSight(p.x, p.y, u.x, u.y)) return;
      cerca = true;
      p.sospecha += H.suspicionNear * mul * dt * (1 - dd / H.suspicionRange + 0.4);
      if (uid === d.copia) p.sospecha += H.suspicionOriginal * mul * dt;
    });
    const sala = g.world.roomAt(p.x, p.y)?.id ?? "";
    if (["r7", "arena2", "hangar"].includes(sala) && cerca) p.sospecha += H.suspicionRestricted * mul * dt;
    if (!cerca) p.sospecha = Math.max(0, p.sospecha - H.suspicionDecay * dt);
    if (p.sospecha >= 1) g.revelar(id, p, "¡Sospecharon de ti y te descubrieron!");
    else if (p.energia <= 0) g.revelar(id, p, "Se agotó la energía del disfraz.");
  } else {
    p.sospecha = Math.max(0, p.sospecha - dt);
    p.energia = Math.min(H.maxEnergy, p.energia + H.rechargePerSec * dt);
  }
}

const cambiaformas: LogicaAlien = {
  habilidad(g, id, p) {
    const H = HAB.cambiaformas;
    const d = pd(g, id);
    if (p.ultiT > 0) return g.aviso("En forma Berserk no puedes disfrazarte.", "info", id);
    if (d.canal) return;
    const objetivo = g.unitNear(p.x, p.y, H.scanRange, (u) => esGuardia(u) && rangoDe(u.t) !== "jefe" && u.st !== "infectado" && u.poseido === "");
    if (objetivo && objetivo[0] !== d.copia) {
      if (p.enfriamiento > 0) return;
      d.canal = { tipo: "escanear", t: 0, dur: H.scanTime * (1 - Math.min(0.5, g.st(id, p, "enfriamiento"))), objetivo: objetivo[0] };
      p.canalTipo = "escanear";
      g.fx("escaneo", objetivo[1].x, objetivo[1].y, { x2: p.x, y2: p.y });
      return;
    }
    if (!p.identidad) return g.aviso("Acércate a un guardia VIVO y pulsa la habilidad para escanear su identidad.", "info", id);
    if (p.disfrazado) {
      p.disfrazado = false;
      p.sospecha = 0;
      g.fx("disfraz", p.x, p.y, { c: 0x7fb24a });
    } else if (p.energia >= H.minToActivate) {
      p.disfrazado = true;
      p.sospecha = 0;
      pd(g, id).sorpresa = true;
      g.fx("disfraz", p.x, p.y, { c: 0x7fb24a });
    } else g.aviso("El disfraz se está recargando…", "info", id);
    p.enfriamiento = 0.4;
    p.enfMax = 0.4;
  },
  ulti(g, id, p) {
    if (p.disfrazado) g.revelar(id, p, "");
    p.ultiT = p.ultiMax = ALIENS.cambiaformas.ulti.duracion * (1 + g.st(id, p, "duracionUlti"));
    g.fx("berserk", p.x, p.y, { c: 0x9cff5a, r: 1 });
    g.aviso(`¡${p.nombre} muta en Berserk!`, "info");
    return true;
  },
};

// ================================================================== Del Mar
function contarTransmutaciones(g: Partida, id: string): number {
  let n = 0;
  g.state.objetos.forEach((o) => {
    if (o.k === "cobertura" && o.dueno === id) n++;
  });
  g.brains.forEach((b, uid) => {
    const u = g.state.unidades.get(uid);
    if (b.owner === id && u && (u.t === "pulpo" || u.t === "kraken")) n++;
  });
  return n;
}

function revertirKrakens(g: Partida, id: string): void {
  g.state.unidades.forEach((u, uid) => {
    const b = g.brains.get(uid);
    if (u.t !== "kraken" || !b || b.owner !== id) return;
    if (b.life > 0.5) {
      const frac = u.hp / u.maxHp;
      u.t = "pulpo";
      u.maxHp = HAB.delmar.pulpoHp;
      u.hp = Math.max(1, Math.round(u.maxHp * frac));
      g.fx("transmutar", u.x, u.y, { c: 0xff8a3a });
    }
  });
}

const delmar: LogicaAlien = {
  habilidad(g, id, p, x, y) {
    const H = HAB.delmar;
    if (p.enfriamiento > 0) return;
    if (dist(p.x, p.y, x, y) > H.range + 40) return g.aviso("Demasiado lejos para transmutar.", "info", id);
    if (contarTransmutaciones(g, id) >= H.maxActive) return g.aviso(`Máximo ${H.maxActive} transmutaciones a la vez (pulpos y coberturas).`, "info", id);
    const s = g.stats(id, p);
    const u = g.unitNear(x, y, 70, (u) => u.team === "humanos" && (isConvertible(u.t as never) || u.t === "torreta"));
    if (u) {
      const [uid, unit] = u;
      if (unit.poseido || unit.st === "infectado") return g.aviso("Ese guardia ya está infectado o poseído: no se puede transmutar.", "info", id);
      if (rangoDe(unit.t) === "elite" && unit.hp > unit.maxHp * H.eliteThreshold) return g.aviso("Es una élite: debilítala primero (menos de 40% de vida).", "info", id);
      g.removeUnit(uid);
      g.sectores.onUnidadMuere(uid, unit, id);
      if (unit.t === "torreta") g.addProp("cobertura", unit.x, unit.y, { hp: H.coverHp * (1 + (s.coberturaVida ?? 0)), t: H.coverLife, dueno: id });
      else {
        const pul = g.spawnUnit("pulpo", unit.x, unit.y, "aliens");
        const pu = g.state.unidades.get(pul)!;
        pu.maxHp = pu.hp = Math.round(H.pulpoHp * (1 + (s.pulpoVida ?? 0)));
        pu.dueno = id;
        const b = g.brains.get(pul)!;
        b.life = H.pulpoLife;
        b.owner = id;
        // Durante el Ecosistema, los pulpos nuevos también son krakens.
        if (p.ultiT > 0) hacerKraken(g, pul, pu, b, p.ultiT);
      }
      g.fx("transmutar", unit.x, unit.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
      setCd(g, id, p, ALIENS.delmar.habilidad.cooldown);
      g.mejoras.registrar("control", 2);
      return;
    }
    const prop = g.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      g.state.objetos.delete(oid);
      g.addProp("cobertura", o.x, o.y, { hp: H.coverHp * (1 + (s.coberturaVida ?? 0)), t: H.coverLife, dueno: id });
      g.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
      setCd(g, id, p, ALIENS.delmar.habilidad.cooldown);
      return;
    }
    g.aviso("Nada que transmutar ahí (apunta a un guardia, barril, caja o torreta).", "info", id);
  },
  ulti(g, id, p) {
    const H = HAB.delmar.eco;
    const dur = ALIENS.delmar.ulti.duracion * (1 + g.st(id, p, "duracionUlti"));
    const r = H.radius * (1 + g.st(id, p, "ecoRadio"));
    const z = g.addZone("eco", p.x, p.y, r, dur);
    zonasDueno.set(z, { owner: id });
    p.ultiT = p.ultiMax = dur;
    let n = 0;
    g.state.unidades.forEach((u, uid) => {
      const b = g.brains.get(uid);
      if (u.t === "pulpo" && b && b.owner === id) {
        hacerKraken(g, uid, u, b, dur);
        n++;
      }
    });
    g.fx("kraken", p.x, p.y, { r });
    g.aviso(n ? `¡Ecosistema Mutante! ${n} pulpo${n > 1 ? "s se convierten" : " se convierte"} en kraken.` : "Ecosistema Mutante: sin pulpos no aparece ningún kraken, pero la zona ralentiza a los enemigos.", "info");
    return true;
  },
};

function hacerKraken(g: Partida, uid: string, u: Unit, b: Brain, dur: number): void {
  const frac = u.hp / u.maxHp;
  u.t = "kraken";
  u.maxHp = HAB.delmar.eco.krakenHp;
  u.hp = Math.max(1, Math.round(u.maxHp * frac));
  b.life = Math.max(b.life, dur + 0.5);
  g.fx("kraken", u.x, u.y, { r: 60 });
  void uid;
}

// ================================================================== Telequinesis
function tickTelequinesis(g: Partida, id: string, p: Player, d: PData, dt: number): void {
  const H = HAB.inteligente;
  if (p.controla) {
    const u = g.state.unidades.get(p.controla);
    if (!u) {
      soltarControl(g, id, p);
      return;
    }
    p.energia -= H.controlDrain * (1 - Math.min(0.6, g.st(id, p, "controlEnergia"))) * dt;
    if (p.energia <= 0) {
      soltarControl(g, id, p);
      g.aviso("Se agotó tu energía psíquica: sueltas al guardia.", "info", id);
    }
    return;
  }
  p.energia = Math.min(H.maxEnergy, p.energia + H.rechargePerSec * dt);
  // Mantener sobre un guardia → control mental.
  if (d.habDown && d.habObjetivo && g.time - d.habDownAt >= H.holdTime) {
    const uid = d.habObjetivo;
    d.habObjetivo = "";
    p.canal = 0;
    p.canalTipo = "";
    const u = g.state.unidades.get(uid);
    if (!u || u.team !== "humanos") return;
    const def = enemyDef(u.t);
    if (!def?.controlable || def.rango === "jefe") return g.aviso("No puedes controlar la mente de esa unidad.", "info", id);
    if (p.energia < H.minToControl) return g.aviso("Te falta energía psíquica para controlar a un guardia.", "info", id);
    u.poseido = "T";
    u.team = "aliens";
    u.dueno = id;
    u.st = "";
    const b = g.brains.get(uid);
    if (b) {
      b.target = "";
      b.aimT = 0;
      b.burst = 0;
    }
    p.controla = uid;
    p.escudo = H.shield * (1 + g.st(id, p, "escudoPsi"));
    g.fx("telequinesis", p.x, p.y, { x2: u.x, y2: u.y });
    g.aviso(`Controlas a un ${def.nombre}: muévelo y dispara con su arma. Tu cuerpo queda protegido por un escudo psíquico. Habilidad para soltarlo.`, "exito", id);
  } else if (d.habDown && d.habObjetivo) {
    p.canal = Math.min(1, (g.time - d.habDownAt) / H.holdTime);
    p.canalTipo = "control";
  }
}

export function soltarControl(g: Partida, id: string, p: Player): void {
  const u = g.state.unidades.get(p.controla);
  if (u && u.poseido === "T") {
    u.poseido = "";
    u.team = "humanos";
    u.dueno = "";
    const b = g.brains.get(p.controla);
    if (b) b.stun = 1.5;
  }
  p.controla = "";
  p.escudo = 0;
  setCd(g, id, p, ALIENS.inteligente.habilidad.cooldown);
}

const ARMA_CONTROLADA: Record<string, { dmg: number; cd: number; vel: number; k: string }> = {
  francotirador: { dmg: 30, cd: 1.3, vel: 1600, k: "rayo_franco" },
  laser: { dmg: 24, cd: 1.1, vel: 1800, k: "rayo_franco" },
  lanzarredes: { dmg: 10, cd: 0.6, vel: 700, k: "bala" },
  oficial: { dmg: 11, cd: 0.22, vel: 760, k: "bala" },
};

const inteligente: LogicaAlien = {
  habilidad(g, id, p, x, y) {
    const H = HAB.inteligente;
    const d = pd(g, id);
    if (p.controla) {
      soltarControl(g, id, p);
      g.aviso("Sueltas al guardia.", "info", id);
      return;
    }
    if (p.enfriamiento > 0) return;
    if (dist(p.x, p.y, x, y) > H.range * (1 + g.st(id, p, "lanzamiento") * 0.2) + 40) return g.aviso("Demasiado lejos para la telequinesis.", "info", id);
    const u = g.unitNear(x, y, 70, (u) => u.team === "humanos" && rangoDe(u.t) !== "jefe" && !["sensor", "nodo", "generador", "pilon"].includes(u.t) && u.poseido === "");
    if (u) {
      d.habObjetivo = u[0];
      p.canalTipo = "control";
      p.canal = 0;
      return;
    }
    const prop = g.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      g.state.objetos.delete(oid);
      g.fx("telequinesis", o.x, o.y);
      g.spawnProjectile("tq_" + o.k, "aliens", o.x, o.y, p.aim, H.throwSpeed, { damage: H.throwDamage * (1 + g.st(id, p, "lanzamiento")), pierce: 0, owner: id, range: 700, carga: o.k });
      setCd(g, id, p, ALIENS.inteligente.habilidad.cooldown);
      return;
    }
    g.aviso("Nada que mover ahí (apunta a un guardia, barril, caja o interruptor).", "info", id);
  },
  soltar(g, id, p) {
    const d = pd(g, id);
    if (!d.habObjetivo || p.controla) return;
    // Pulsación corta: levantar y lanzar.
    const uid = d.habObjetivo;
    d.habObjetivo = "";
    p.canal = 0;
    p.canalTipo = "";
    const unit = g.state.unidades.get(uid);
    if (!unit || unit.team !== "humanos") return;
    const H = HAB.inteligente;
    if (unit.t === "escudo" && unit.escudo) {
      unit.escudo = false;
      g.aviso("¡Le quitaste el escudo!", "exito", id);
    }
    const pos = g.world.moveCircle(unit.x, unit.y, Math.cos(p.aim) * 170, Math.sin(p.aim) * 170, unitRadius(unit.t));
    g.fx("telequinesis", unit.x, unit.y, { x2: pos.x, y2: pos.y });
    unit.x = Math.round(pos.x);
    unit.y = Math.round(pos.y);
    const b = g.brains.get(uid);
    if (b) b.stun = H.stun;
    g.hitUnit(uid, unit, H.throwDamage * (1 + g.st(id, p, "lanzamiento")), null, id);
    g.mejoras.registrar("control", H.stun);
    setCd(g, id, p, ALIENS.inteligente.habilidad.cooldown);
  },
  moverControlado(g, id, p, inp, dt) {
    const u = g.state.unidades.get(p.controla);
    if (!u) return soltarControl(g, id, p);
    const b = g.brains.get(p.controla)!;
    const def = enemyDef(u.t);
    const sp = (def?.speed ?? 140) * 1.15;
    const len = Math.hypot(inp.mx, inp.my);
    if (len > 0.01) {
      // Las unidades humanas atraviesan las vallas láser (quien = 0).
      const pos = g.world.moveCircle(b.x, b.y, (inp.mx / Math.max(1, len)) * sp * dt, (inp.my / Math.max(1, len)) * sp * dt, unitRadius(u.t), g.solidProps(), 0);
      b.x = pos.x;
      b.y = pos.y;
      u.x = Math.round(pos.x);
      u.y = Math.round(pos.y);
      u.moviendo = true;
    }
    u.ang = inp.aim;
    b.cd -= dt;
    if (inp.shoot && b.cd <= 0) {
      const arma = ARMA_CONTROLADA[u.t] ?? { dmg: 9, cd: 0.32, vel: 760, k: "bala" };
      b.cd = arma.cd;
      p.energia -= HAB.inteligente.controlShotCost;
      const dano = arma.dmg * (1 + g.st(id, p, "dano"));
      g.spawnProjectile(arma.k, "aliens", u.x + Math.cos(u.ang) * 26, u.y + Math.sin(u.ang) * 26, u.ang, arma.vel, { damage: dano, range: 750, owner: id, shooter: p.controla });
    }
  },
  ulti(g, id, p, x, y) {
    const H = HAB.inteligente.singularidad;
    const dmax = 640;
    const dd = dist(p.x, p.y, x, y);
    if (dd > dmax) {
      x = p.x + ((x - p.x) / dd) * dmax;
      y = p.y + ((y - p.y) / dd) * dmax;
    }
    const z = g.addZone("singularidad", x, y, H.radius * (1 + g.st(id, p, "singularidadRadio")), H.pull);
    zonasDueno.set(z, { owner: id });
    p.ultiT = p.ultiMax = H.pull;
    g.fx("singularidad", x, y, { r: H.radius });
    return true;
  },
};

// ================================================================== Curandera
const curandera: LogicaAlien = {
  habilidad(g, id, p) {
    const H = HAB.curandera;
    if (p.enfriamiento > 0) return;
    const s = g.stats(id, p);
    if (p.cautivo) {
      const cura = H.heal * (1 + (s.curacion ?? 0));
      let n = 0;
      g.state.jugadores.forEach((o, oid) => {
        if (o.vivo && dist(p.x, p.y, o.x, o.y) <= H.healRadius) {
          if (g.curarJugador(oid, o, cura, oid === id ? "" : id) > 0 || oid === id) n++;
          g.fx("curar", o.x, o.y);
        }
      });
      g.fx("devorar", p.x, p.y, { r: H.healRadius });
      g.aviso(`Digieres al cautivo y curas a ${n} alien${n === 1 ? "" : "s"} a tu alrededor.`, "exito", id);
      p.cautivo = "";
      setCd(g, id, p, ALIENS.curandera.habilidad.cooldown);
      return;
    }
    const alcance = H.captureRange * (1 + (s.captura ?? 0));
    const t = g.unitNear(p.x, p.y, alcance, (u) => esGuardia(u) && u.poseido === "" && u.t !== "nodo");
    if (!t) return g.aviso("Acércate a un guardia para atraparlo.", "info", id);
    const [uid, u] = t;
    const r = rangoDe(u.t);
    if (r === "jefe" || (r === "elite" && u.hp > u.maxHp * (H.eliteThreshold + (s.captura ?? 0)))) {
      g.hitUnit(uid, u, H.biteBoss * (1 + (s.dano ?? 0)), null, id);
      g.fx("mordida", u.x, u.y, { c: 0x5fd068 });
      g.aviso(r === "jefe" ? "Demasiado grande para tragarlo: solo lo muerdes." : "Es demasiado resistente: debilítalo antes de tragarlo.", "info", id);
      setCd(g, id, p, 1.2);
      return;
    }
    g.removeUnit(uid);
    g.sectores.onUnidadMuere(uid, u, id);
    g.director.onUnidadMuere(uid, u);
    p.cautivo = u.t;
    g.fx("devorar", u.x, u.y, { x2: p.x, y2: p.y });
    g.aviso("¡Lo atrapaste! Puedes moverte, pero no atacar. Habilidad otra vez para digerirlo y curar.", "exito", id);
    p.enfriamiento = p.enfMax = 0.6;
    g.mejoras.registrar("control", 3);
  },
  ulti(g, id, p) {
    const H = HAB.curandera.jardin;
    const dur = ALIENS.curandera.ulti.duracion * (1 + g.st(id, p, "duracionUlti"));
    const z = g.addZone("jardin", p.x, p.y, H.radius, dur);
    zonasDueno.set(z, { owner: id });
    p.ultiT = p.ultiMax = dur;
    const n = H.plants + Math.round(g.st(id, p, "jardinPlantas"));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = p.x + Math.cos(a) * H.radius * 0.55;
      const py = p.y + Math.sin(a) * H.radius * 0.55;
      if (g.world.blocksMoveAt(px, py)) continue;
      const uid = g.spawnUnit("planta", px, py, "aliens");
      const b = g.brains.get(uid)!;
      b.owner = id;
      b.life = dur;
      b.cd = 0.3 + i * 0.2;
      g.state.unidades.get(uid)!.dueno = id;
    }
    g.fx("jardin", p.x, p.y, { r: H.radius });
    return true;
  },
};

// ================================================================== Vesper
const vesper: LogicaAlien = {
  habilidad(g, id, p, x, y) {
    const H = HAB.vesper;
    if (p.enfriamiento > 0) return;
    const alcance = H.range * (1 + g.st(id, p, "pasoAlcance"));
    const t = g.unitNear(x, y, 100, (u) => esGuardia(u) && dist(p.x, p.y, u.x, u.y) <= alcance + 20);
    if (!t) return g.aviso(`Apunta a un guardia a menos de ${Math.round(alcance / TILE)} m para aparecer a su espalda.`, "info", id);
    const [, u] = t;
    const r = unitRadius(u.t) + 32;
    let destino: { x: number; y: number } | null = null;
    for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = u.ang + Math.PI + off;
      const px = u.x + Math.cos(a) * r;
      const py = u.y + Math.sin(a) * r;
      if (!g.world.blocksMoveAt(px, py, 1) && !g.world.blocksMoveAt(px + 14, py, 1) && !g.world.blocksMoveAt(px - 14, py, 1)) {
        destino = { x: px, y: py };
        break;
      }
    }
    if (!destino) return g.aviso("No hay sombra libre detrás de ese guardia.", "info", id);
    g.fx("teleport", p.x, p.y, { x2: destino.x, y2: destino.y, c: 0x7a5cff });
    p.x = destino.x;
    p.y = destino.y;
    p.aim = Math.atan2(u.y - p.y, u.x - p.x);
    p.punal = H.backstabWindow;
    pd(g, id).intocable = g.st(id, p, "salidaSombra");
    setCd(g, id, p, ALIENS.vesper.habilidad.cooldown);
    g.sectores.onTeleport(id, p, t[0]);
  },
  ulti(g, id, p) {
    const dur = ALIENS.vesper.ulti.duracion * (1 + g.st(id, p, "duracionUlti"));
    g.state.eclipse = Math.max(g.state.eclipse, dur);
    p.ultiT = p.ultiMax = dur;
    g.brains.forEach((b, uid) => {
      const u = g.state.unidades.get(uid);
      if (u && u.team === "humanos" && rangoDe(u.t) !== "jefe") {
        b.target = "";
        b.aimT = 0;
        if (u.st === "apuntando") u.st = "";
      }
    });
    g.fx("eclipse", p.x, p.y);
    g.aviso("¡ECLIPSE! Los guardias disparan a ciegas y se hieren entre ellos.", "info");
    g.mejoras.registrar("control", 8);
    return true;
  },
};

// ================================================================== Freeze
const freeze: LogicaAlien = {
  habilidad(g, id, p, x, y) {
    const H = HAB.freeze;
    if (p.enfriamiento > 0) return;
    const s = g.stats(id, p);
    const dd = dist(p.x, p.y, x, y);
    if (dd > H.wallRange) {
      x = p.x + ((x - p.x) / dd) * H.wallRange;
      y = p.y + ((y - p.y) / dd) * H.wallRange;
    }
    if (colocarMuro(g, id, x, y, Math.atan2(y - p.y, x - p.x), H.wallBlocks, H.wallHp * (1 + (s.muroVida ?? 0)), H.wallLife * (1 + (s.muroDuracion ?? 0))) === 0)
      return g.aviso("No cabe un muro ahí.", "info", id);
    setCd(g, id, p, ALIENS.freeze.habilidad.cooldown);
  },
  ulti(g, id, p) {
    const s = g.stats(id, p);
    const sala = g.world.roomAt(p.x, p.y);
    let n = 0;
    g.state.unidades.forEach((u, uid) => {
      if (u.team !== "humanos") return;
      const dentro = sala ? u.x >= sala.x && u.y >= sala.y && u.x < sala.x + sala.w && u.y < sala.y + sala.h : dist(p.x, p.y, u.x, u.y) < 700;
      if (!dentro) return;
      const b = g.brains.get(uid);
      if (!b) return;
      const jefe = rangoDe(u.t) === "jefe";
      b.hielo = (jefe ? HAB.freeze.ceroBoss : ALIENS.freeze.ulti.duracion) * (1 + (s.ceroDuracion ?? 0));
      u.frio = 1;
      u.st = "congelado";
      n++;
    });
    p.ultiT = p.ultiMax = 0.6;
    g.fx("cero", p.x, p.y, { r: sala ? Math.max(sala.w, sala.h) : 700 });
    g.aviso(`¡CERO ABSOLUTO! ${n} enemigo${n === 1 ? "" : "s"} congelado${n === 1 ? "" : "s"} en ${sala?.nombre ?? "la zona"}.`, "info");
    g.mejoras.registrar("control", n * 3);
    return true;
  },
};

/** Coloca un muro de hielo perpendicular a la dirección; no encierra aliados. Devuelve cuántos bloques puso. */
export function colocarMuro(g: Partida, id: string, x: number, y: number, ang: number, bloques: number, hp: number, vida: number): number {
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  let n = 0;
  for (let i = 0; i < bloques; i++) {
    const o = i - (bloques - 1) / 2;
    const bx = x + px * o * 50;
    const by = y + py * o * 50;
    if (g.world.blocksMoveAt(bx, by)) continue;
    let ocupado = false;
    g.state.jugadores.forEach((q) => {
      if (q.vivo && dist(q.x, q.y, bx, by) < 46) ocupado = true;
    });
    if (ocupado) continue;
    g.addProp("muro_hielo", bx, by, { hp, t: vida, dueno: id });
    g.fx("hielo", bx, by, { r: 36 });
    n++;
  }
  return n;
}

// ================================================================== Escarabajo
function tickEscarabajo(g: Partida, id: string, p: Player, d: PData, dt: number): void {
  const H = HAB.escarabajo;
  const s = g.stats(id, p);
  if (p.bajoTierra) {
    p.energia -= H.burrowDrain * (1 - Math.min(0.5, (s.excavar ?? 0) * 0.6)) * dt;
    if (p.energia <= 0) {
      p.energia = 0;
      emerger(g, id, p, true);
    }
  } else p.energia = Math.min(H.maxEnergy, p.energia + H.rechargePerSec * dt);
  if (p.tunel === 1) {
    d.tunelT -= dt;
    if (d.tunelT <= 0) {
      p.tunel = 0;
      d.tunelA = null;
      p.ulti = Math.max(p.ulti, 0.5);
      g.aviso("No marcaste la salida a tiempo: el túnel se derrumba (recuperas la mitad de la carga).", "info", id);
    }
  }
}

function emerger(g: Partida, id: string, p: Player, forzado: boolean): boolean {
  // No se puede salir dentro de contenedores o escombros.
  if (g.world.blocksMoveAt(p.x, p.y, 1)) {
    if (!forzado) {
      g.aviso("No puedes salir aquí: hay algo encima.", "info", id);
      return false;
    }
    const pos = g.lugarLibre(p.x, p.y, p.x, p.y);
    p.x = pos.x;
    p.y = pos.y;
  }
  p.bajoTierra = false;
  const H = HAB.escarabajo;
  g.state.unidades.forEach((u, uid) => {
    if (u.team === "humanos" && dist(p.x, p.y, u.x, u.y) < H.emergeRadius + unitRadius(u.t)) {
      g.hitUnit(uid, u, H.emergeDamage * (1 + g.st(id, p, "dano")), null, id);
      const b = g.brains.get(uid);
      if (b && rangoDe(u.t) !== "jefe") b.stun = Math.max(b.stun, 0.6);
    }
  });
  g.fx("emerger", p.x, p.y, { r: H.emergeRadius });
  setCd(g, id, p, ALIENS.escarabajo.habilidad.cooldown);
  return true;
}

/** ¿Se puede ir a pie de A a B (sin atravesar puertas cerradas ni contenedores)? */
export function alcanzable(g: Partida, ax: number, ay: number, bx: number, by: number, maxCasillas: number): boolean {
  const w = g.world;
  const sx = Math.floor(ax / TILE);
  const sy = Math.floor(ay / TILE);
  const ex = Math.floor(bx / TILE);
  const ey = Math.floor(by / TILE);
  if (w.blocksMove(ex, ey, 1) || w.blocksMove(sx, sy, 1)) return false;
  const vistos = new Set<number>([w.idx(sx, sy)]);
  let frontera = [[sx, sy]];
  for (let paso = 0; paso < maxCasillas && frontera.length; paso++) {
    const sig: number[][] = [];
    for (const [cx, cy] of frontera) {
      if (cx === ex && cy === ey) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const i = w.idx(nx, ny);
        if (vistos.has(i) || w.blocksMove(nx, ny, 1)) continue;
        vistos.add(i);
        sig.push([nx, ny]);
      }
    }
    frontera = sig;
  }
  return false;
}

const escarabajo: LogicaAlien = {
  habilidad(g, id, p) {
    const H = HAB.escarabajo;
    if (p.bajoTierra) {
      emerger(g, id, p, false);
      return;
    }
    if (p.enfriamiento > 0) return;
    if (p.energia < H.minToBurrow) return g.aviso("Te falta energía para excavar.", "info", id);
    if (g.world.liquid[g.world.idx(Math.floor(p.x / TILE), Math.floor(p.y / TILE))]) return;
    p.bajoTierra = true;
    g.fx("excavar", p.x, p.y);
  },
  ulti(g, id, p) {
    const d = pd(g, id);
    if (g.world.blocksMoveAt(p.x, p.y, 1)) {
      g.aviso("No se puede abrir un túnel aquí.", "info", id);
      return false;
    }
    d.tunelA = { x: p.x, y: p.y };
    d.tunelT = HAB.escarabajo.tunnelPlaceTime;
    p.tunel = 1;
    g.fx("excavar", p.x, p.y, { r: 60 });
    g.aviso("Entrada del túnel marcada. Ve hasta la salida y pulsa la definitiva otra vez (10 s).", "exito", id);
    return true;
  },
  ultiContinua(g, id, p) {
    if (p.tunel !== 1) return false;
    const d = pd(g, id);
    const a = d.tunelA;
    if (!a) {
      p.tunel = 0;
      return false;
    }
    const H = HAB.escarabajo;
    if (dist(a.x, a.y, p.x, p.y) < 160) {
      g.aviso("Aléjate más de la entrada para marcar la salida.", "info", id);
      return true;
    }
    if (dist(a.x, a.y, p.x, p.y) > H.tunnelMaxDist) {
      g.aviso("Demasiado lejos de la entrada.", "info", id);
      return true;
    }
    // Sin atajos: la salida tiene que estar en zona accesible a pie desde la entrada.
    if (!alcanzable(g, a.x, a.y, p.x, p.y, 80)) {
      g.aviso("Ese suelo no se puede perforar desde la entrada: el túnel no puede saltarse puertas ni zonas selladas.", "info", id);
      return true;
    }
    const dur = ALIENS.escarabajo.ulti.duracion * (1 + g.st(id, p, "tunelDuracion"));
    const clave = id + ":" + Math.floor(g.time * 10);
    g.addProp("tunel", a.x, a.y, { t: dur, dueno: clave });
    g.addProp("tunel", p.x, p.y, { t: dur, dueno: clave });
    p.tunel = 0;
    d.tunelA = null;
    d.ultimoTunel = g.time;
    p.ultiT = p.ultiMax = dur;
    g.fx("tunel", a.x, a.y, { x2: p.x, y2: p.y });
    g.aviso(`¡Túnel de Escape abierto ${Math.round(dur)} s! Cualquier alien que entre en un extremo sale por el otro.`, "exito");
    return true;
  },
};

// ================================================================== Simbionte
function colonia(g: Partida, id: string): [string, Unit][] {
  const out: [string, Unit][] = [];
  g.state.unidades.forEach((u, uid) => {
    if (u.dueno === id && u.team === "aliens" && (u.poseido === "S" || u.t === "cria")) out.push([uid, u]);
  });
  return out;
}

function tickSimbionte(g: Partida, id: string, p: Player, d: PData, dt: number): void {
  const col = colonia(g, id);
  p.colonia = col.length;
  if (p.energia < 100) p.energia = Math.min(100, p.energia + 20 * dt);
  if (p.ultiT <= 0) return;
  // Fusión Colosal: tentáculos que agarran, atraen y devoran.
  const F = HAB.simbionte.fusion;
  const n = d.fusionN;
  const s = g.stats(id, p);
  d.fusionT -= dt;
  if (d.fusionT > 0) return;
  d.fusionT = Math.max(0.3, (F.grabEvery - F.perUnitGrab * n) * (1 - Math.min(0.5, s.fusionTentaculos ?? 0)));
  const alcance = (F.range + F.perUnitRange * n) * (1 + (s.fusionTentaculos ?? 0));
  const t = g.unitNear(p.x, p.y, alcance, (u) => u.team === "humanos" && u.t !== "nodo" && rangoDe(u.t) !== "dispositivo");
  if (!t) return;
  const [uid, u] = t;
  const r = rangoDe(u.t);
  const dano = F.damage + F.perUnitDamage * n;
  g.fx("tentaculo", p.x, p.y, { x2: u.x, y2: u.y, c: 0xd36be8 });
  if (r === "normal" || r === "npc") {
    g.hitUnit(uid, u, u.hp + 999, null, id);
    g.curarJugador(id, p, 10, "");
  } else {
    g.hitUnit(uid, u, r === "jefe" ? dano : dano * 2, null, id);
    // Atrae a la élite hacia el coloso.
    const b = g.brains.get(uid);
    if (b && r === "elite" && g.state.unidades.has(uid)) {
      const pos = g.world.moveCircle(u.x, u.y, (p.x - u.x) * 0.4, (p.y - u.y) * 0.4, unitRadius(u.t));
      u.x = Math.round(pos.x);
      u.y = Math.round(pos.y);
      b.stun = Math.max(b.stun, 0.8);
    }
  }
}

const simbionte: LogicaAlien = {
  habilidad(g, id, p, x, y) {
    const H = HAB.simbionte;
    if (p.enfriamiento > 0) return;
    const s = g.stats(id, p);
    const inf = g.unitNear(x, y, 90, (u) => u.team === "humanos" && u.st === "infectado");
    if (inf && dist(p.x, p.y, inf[1].x, inf[1].y) < 380) {
      const [uid, u] = inf;
      const max = H.colonyMax + Math.round(s.coloniaMax ?? 0);
      if (colonia(g, id).length >= max) return g.aviso(`Colonia llena (${max}). Absorbe (E) o usa la Fusión.`, "info", id);
      u.team = "aliens";
      u.poseido = "S";
      u.dueno = id;
      u.st = "";
      u.infeccion = 0;
      const hp = Math.round(H.hostHp * (1 + (s.huesped ?? 0)));
      u.maxHp = Math.max(u.maxHp, hp);
      u.hp = Math.max(u.hp, hp);
      const b = g.brains.get(uid);
      if (b) {
        b.target = "";
        b.orden = null;
        b.hostT = 0;
        b.owner = id;
        b.stun = 0;
      }
      g.fx("asimilar", u.x, u.y, { x2: p.x, y2: p.y });
      g.aviso("Nuevo huésped en la colonia. Habilidad en el suelo: enviarlo a un punto · sobre ti: reagrupar.", "exito", id);
      setCd(g, id, p, ALIENS.simbionte.habilidad.cooldown);
      g.sectores.onAsimilar(id, uid, u);
      return;
    }
    const col = colonia(g, id);
    if (!col.length) return g.aviso("Infecta a un guardia con tus fragmentos hasta llenar su barra y luego asimílalo aquí.", "info", id);
    if (dist(p.x, p.y, x, y) < 70) {
      for (const [uid] of col) {
        const b = g.brains.get(uid);
        if (b) b.orden = null;
      }
      g.fx("asimilar", p.x, p.y, { r: 1 });
      g.aviso("La colonia se reagrupa contigo.", "info", id);
      p.enfriamiento = p.enfMax = 0.4;
      return;
    }
    // Envía al huésped más cercano a ese punto que no tenga orden (o rota entre todos).
    const d = pd(g, id);
    const libres = col.filter(([uid]) => !g.brains.get(uid)?.orden);
    const lista = libres.length ? libres : col;
    lista.sort((a, b) => dist(a[1].x, a[1].y, x, y) - dist(b[1].x, b[1].y, x, y));
    const [uid] = libres.length ? lista[0] : lista[d.ordenIdx++ % lista.length];
    const b = g.brains.get(uid);
    if (b) b.orden = { x, y };
    g.fx("asimilar", x, y, { r: 2 });
    p.enfriamiento = p.enfMax = 0.3;
  },
  interactuar(g, id, p) {
    const H = HAB.simbionte;
    const inf = g.unitNear(p.x, p.y, H.absorbRange, (u) => u.team === "humanos" && u.st === "infectado");
    if (inf) {
      const [uid, u] = inf;
      g.hitUnit(uid, u, u.hp + 999, null, id);
      g.curarJugador(id, p, H.absorbHeal, "");
      g.fx("absorber", u.x, u.y, { x2: p.x, y2: p.y });
      return true;
    }
    if (p.hp < p.maxHp) {
      const propio = g.unitNear(p.x, p.y, H.absorbRange, (u) => u.dueno === id && u.team === "aliens" && (u.poseido === "S" || u.t === "cria"));
      if (propio) {
        const [uid, u] = propio;
        g.killUnit(uid, u, "");
        g.curarJugador(id, p, 25, "");
        g.fx("absorber", u.x, u.y, { x2: p.x, y2: p.y });
        g.aviso("Absorbes a un huésped para curarte.", "info", id);
        return true;
      }
    }
    return false;
  },
  infectar(g, owner, uid, u, amount) {
    if (u.st === "infectado" || u.poseido) return;
    const def = enemyDef(u.t);
    if (!def) return;
    if (u.t === "nodo") {
      u.infeccion = Math.min(1, u.infeccion + amount * 0.5);
      return;
    }
    if (def.rango === "jefe" || def.rango === "dispositivo" || !def.controlable) return;
    u.infeccion = Math.min(1, u.infeccion + amount * (def.rango === "elite" ? HAB.simbionte.eliteInfectMul : 1));
    if (u.infeccion >= 1) {
      u.st = "infectado";
      u.stT = 6;
      u.dueno = owner;
      const b = g.brains.get(uid);
      if (b) b.aimT = 0;
      g.fx("infectar", u.x, u.y);
      g.aviso("¡Infectado! Habilidad sobre él: asimilarlo como huésped · E junto a él: absorberlo y curarte.", "exito", owner);
    }
  },
  ulti(g, id, p) {
    const col = colonia(g, id);
    const F = HAB.simbionte.fusion;
    const n = col.length;
    for (const [uid, u] of col) {
      g.fx("fusion", u.x, u.y, { x2: p.x, y2: p.y });
      g.removeUnit(uid);
    }
    const d = pd(g, id);
    d.fusionN = n;
    d.fusionT = 0.4;
    p.ultiT = p.ultiMax = (F.baseTime + F.perUnitTime * n) * (1 + g.st(id, p, "duracionUlti"));
    p.escudo = F.shield + F.perUnitShield * n;
    p.colonia = 0;
    g.fx("fusion", p.x, p.y, { r: 1 });
    g.aviso(n ? `¡FUSIÓN COLOSAL con ${n} simbionte${n > 1 ? "s" : ""}! Al terminar, la colonia se perderá.` : "Fusión Colosal sin colonia: un coloso débil y breve.", "info");
    return true;
  },
};

export const ALIEN_LOGICA: Record<AlienKind, LogicaAlien> = {
  cambiaformas,
  delmar,
  inteligente,
  curandera,
  vesper,
  freeze,
  escarabajo,
  simbionte,
};

// ================================================================== zonas de definitivas
export function zonasAliadas(g: Partida, dt: number, entries: [string, Unit, Brain][]): void {
  for (const [, , b] of entries) b.lento = 1;
  g.state.zonas.forEach((z, zid) => {
    const info = zonasDueno.get(zid);
    if (z.k === "eco") {
      for (const [, u, b] of entries) {
        if (u.team !== "humanos" || dist(z.x, z.y, u.x, u.y) > z.r) continue;
        b.lento = Math.min(b.lento, 1 - HAB.delmar.eco.slow * (rangoDe(u.t) === "jefe" ? 0.5 : 1));
      }
    } else if (z.k === "jardin" && info) {
      const owner = g.state.jugadores.get(info.owner);
      const cura = HAB.curandera.jardin.healPerSec * (1 + (owner ? g.st(info.owner, owner, "jardinCura") : 0)) * dt;
      g.state.jugadores.forEach((p, id) => {
        if (p.vivo && dist(z.x, z.y, p.x, p.y) <= z.r) g.curarJugador(id, p, cura, id === info.owner ? "" : info.owner);
      });
    } else if (z.k === "singularidad" && info) {
      const H = HAB.inteligente.singularidad;
      for (const [uid, u, b] of entries) {
        if (u.team !== "humanos" || rangoDe(u.t) === "dispositivo") continue;
        const d = dist(z.x, z.y, u.x, u.y);
        if (d > z.r) continue;
        if (rangoDe(u.t) === "jefe") {
          b.lento = Math.min(b.lento, 0.5);
          continue;
        }
        if (d > 24) {
          const pos = g.world.moveCircle(u.x, u.y, ((z.x - u.x) / d) * 280 * dt, ((z.y - u.y) / d) * 280 * dt, unitRadius(u.t));
          u.x = Math.round(pos.x);
          u.y = Math.round(pos.y);
        }
        b.stun = Math.max(b.stun, 0.2);
        void uid;
      }
      g.state.objetos.forEach((o) => {
        if ((o.k === "barril" || o.k === "caja") && dist(z.x, z.y, o.x, o.y) < z.r && dist(z.x, z.y, o.x, o.y) > 20) {
          const d = dist(z.x, z.y, o.x, o.y);
          o.x = Math.round(o.x + ((z.x - o.x) / d) * 200 * dt);
          o.y = Math.round(o.y + ((z.y - o.y) / d) * 200 * dt);
        }
      });
      if (z.vida <= dt * 1.5 && !info.detonada) {
        info.detonada = true;
        const owner = g.state.jugadores.get(info.owner);
        const dano = H.damage * (1 + (owner ? g.st(info.owner, owner, "lanzamiento") : 0));
        for (const [uid, u, b] of entries) {
          if (u.team !== "humanos" || !g.state.unidades.has(uid)) continue;
          const d = dist(z.x, z.y, u.x, u.y);
          if (d > z.r) continue;
          g.hitUnit(uid, u, dano, null, info.owner);
          if (!g.state.unidades.has(uid)) continue;
          if (rangoDe(u.t) !== "jefe") {
            b.stun = Math.max(b.stun, H.stun);
            const a = Math.atan2(u.y - z.y, u.x - z.x);
            const pos = g.world.moveCircle(u.x, u.y, Math.cos(a) * H.knock, Math.sin(a) * H.knock, unitRadius(u.t));
            u.x = Math.round(pos.x);
            u.y = Math.round(pos.y);
          }
        }
        g.fx("explosion", z.x, z.y, { r: z.r, c: 0xb37bff });
        g.mejoras.registrar("control", 6);
      }
    }
  });
  for (const zid of [...zonasDueno.keys()]) if (!g.state.zonas.has(zid)) zonasDueno.delete(zid);
}
