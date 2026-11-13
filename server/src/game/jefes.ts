// Los tres jefes de la demo, con dificultad creciente:
//  I.  Jefe de laboratorio: lanza frascos y llama refuerzos; sus tres depósitos lo blindan
//      hasta que el equipo sabotea las tres estaciones del núcleo.
//  II. Centinela MK-II: robot gigante con láser giratorio, misiles y drones. Su blindaje solo
//      cae cuando se recalienta y alguien abre una válvula de refrigerante.
//  III. Director Kessler en el exotraje OMEGA: escudo alimentado por pilones, ráfagas, granadas,
//      rejillas eléctricas, embestidas y refuerzos; tres fases y se vuelve más agresivo.
import { ENEMY_TUNING, ESCALA_EQUIPO, angleDiff, dist, enemyDef, type Circle } from "@dawg/shared";
import type { Unit } from "../schema/GameState";
import type { Partida } from "./Partida";
import { approachDir, disparar, findTarget, moverConColision, turn, type Brain, type Target } from "./enemigos";

export function tickJefe(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  if (u.t === "jefe") jefeLaboratorio(g, uid, u, b, dt, solids);
  else if (u.t === "centinela") centinela(g, uid, u, b, dt, solids);
  else if (u.t === "director") director(g, uid, u, b, dt, solids);
}

function moverAdistancia(g: Partida, u: Unit, b: Brain, t: Target, dt: number, solids: Circle[], speedMul = 1): { d: number; los: boolean; toT: number } {
  const def = enemyDef(u.t)!;
  const d = dist(u.x, u.y, t.x, t.y);
  const los = g.world.lineOfSight(u.x, u.y, t.x, t.y);
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  let dir = { x: 0, y: 0 };
  if (!los || d > def.range[1]) dir = approachDir(g, u, t, los);
  else if (d < def.range[0]) dir = { x: (u.x - t.x) / (d || 1), y: (u.y - t.y) / (d || 1) };
  else {
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe *= -1;
      b.strafeT = 2 + Math.random() * 2;
    }
    dir = { x: -Math.sin(toT) * b.strafe * 0.6, y: Math.cos(toT) * b.strafe * 0.6 };
  }
  moverConColision(g, u, b, dir.x, dir.y, def.speed * speedMul, dt, solids, def.radius);
  u.ang = turn(u.ang, toT, 3 * dt);
  return { d, los, toT };
}

const intervalo = (g: Partida, base: number) => base * ESCALA_EQUIPO.intervalo[g.k];

// ------------------------------------------------------------------ I. Jefe de laboratorio
function jefeLaboratorio(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const tn = ENEMY_TUNING.jefe;
  b.t2 += dt;
  if (b.t2 >= intervalo(g, tn.reinforceEvery)) {
    b.t2 = 0;
    g.animar(uid, "rugido");
    g.director.spawnNear(g.k >= 3 ? ["fusilero", "escudo", "medico"] : ["fusilero", "medico"], u.x, u.y, "jefe");
    g.aviso("¡El Jefe llamó refuerzos!", "peligro");
  }
  const t = findTarget(g, u, b, true);
  if (!t) return;
  const { d, los, toT } = moverAdistancia(g, u, b, t, dt, solids);
  if (!los) return;
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
}

// ------------------------------------------------------------------ II. Centinela MK-II
function centinela(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const tn = ENEMY_TUNING.centinela;
  const j = b.j;
  j.calor = j.calor ?? 0;
  j.barrido = j.barrido ?? 0;
  j.misil = j.misil ?? 2;
  j.drones = j.drones ?? 8;
  j.carga = j.carga ?? 0;
  const fase2 = u.hp < u.maxHp * 0.5;
  if (fase2 && !j.avisoF2) {
    j.avisoF2 = 1;
    g.aviso("¡El Centinela se sobrecarga! Ahora embiste. Sigan enfriándolo con las válvulas.", "peligro");
  }
  // Enfriado: blindaje abierto y quieto.
  if (u.st === "enfriado") {
    u.stT -= dt;
    if (u.stT <= 0) {
      u.st = "";
      j.calor = 0;
      g.aviso("El Centinela vuelve a blindarse.", "peligro");
    }
    return;
  }
  // El calor sube con el combate: por encima del 70 % las válvulas sirven.
  j.calor = Math.min(1, j.calor + dt / (fase2 ? 16 : 22));
  u.stT = j.calor;
  const t = findTarget(g, u, b, true);
  if (!t) return;
  // Embestida (fase 2)
  if (j.carga > 0) {
    j.carga -= dt;
    const ang = j.cargaAng;
    const pos = g.world.moveCircle(u.x, u.y, Math.cos(ang) * tn.chargeSpeed * dt, Math.sin(ang) * tn.chargeSpeed * dt, enemyDef("centinela")!.radius, solids);
    const choca = Math.abs(pos.x - u.x) + Math.abs(pos.y - u.y) < 1;
    u.x = Math.round(pos.x);
    u.y = Math.round(pos.y);
    b.x = pos.x;
    b.y = pos.y;
    u.moviendo = true;
    g.state.jugadores.forEach((p, id) => {
      if (p.vivo && dist(p.x, p.y, u.x, u.y) < 70) g.damagePlayer(id, p, tn.chargeDamage * dt * 3);
    });
    if (Math.random() < dt * 6) g.addZone("fuego", u.x, u.y, 40, 3);
    if (choca || j.carga <= 0) {
      j.carga = 0;
      u.st = "";
      g.fx("explosion", u.x, u.y, { r: 90 });
    }
    return;
  }
  const { d, los, toT } = moverAdistancia(g, u, b, t, dt, solids, 0.8);
  // Láser giratorio: barre en círculo y quema lo que toca.
  j.barrido += dt * tn.sweepSpeed * (fase2 ? 1.5 : 1);
  const ang = j.barrido;
  u.ang = ang;
  g.state.jugadores.forEach((p, id) => {
    if (!p.vivo || p.bajoTierra) return;
    const dd = dist(u.x, u.y, p.x, p.y);
    if (dd > tn.sweepRange || dd < 50) return;
    if (Math.abs(angleDiff(ang, Math.atan2(p.y - u.y, p.x - u.x))) < 0.09 && g.world.lineOfSight(u.x, u.y, p.x, p.y)) g.damagePlayer(id, p, tn.sweepDps * dt);
  });
  // Misiles telegrafiados
  j.misil -= dt;
  if (j.misil <= 0) {
    j.misil = intervalo(g, tn.missileEvery);
    const objetivos: { x: number; y: number }[] = [];
    g.state.jugadores.forEach((p) => p.vivo && !p.bajoTierra && objetivos.push({ x: p.x, y: p.y }));
    for (const o of objetivos.slice(0, Math.min(objetivos.length, fase2 ? 3 : 2))) {
      g.throwFlask("misil", u.x, u.y - 50, o.x + (Math.random() - 0.5) * 60, o.y + (Math.random() - 0.5) * 60, 1.3, uid, { r: tn.missileRadius, dmg: tn.missileDamage });
    }
  }
  // Drones de apoyo
  j.drones -= dt;
  if (j.drones <= 0) {
    j.drones = intervalo(g, tn.droneEvery);
    g.animar(uid, "rugido");
    g.director.spawnNear(g.k >= 3 ? ["dron", "dron"] : ["dron"], u.x, u.y, "jefe");
  }
  // Embestida
  if (fase2 && b.cd <= 0 && los && d > 180) {
    b.cd = 7;
    j.carga = 1.1;
    j.cargaAng = toT;
    u.st = "cargando";
    g.animar(uid, "carga");
    g.fx("texto", u.x, u.y, { s: "¡EMBISTE!", c: 0xff4a4a });
  }
}

/** Una válvula de refrigerante abierta junto al Centinela recalentado lo deja vulnerable. */
export function enfriarCentinela(g: Partida): boolean {
  const id = g.state.jefe;
  const u = id ? g.state.unidades.get(id) : undefined;
  if (!u || u.t !== "centinela") return false;
  const b = g.brains.get(id)!;
  if (u.st === "enfriado") return false;
  if ((b.j.calor ?? 0) < 0.7) return false;
  u.st = "enfriado";
  u.stT = ENEMY_TUNING.centinela.ventTime;
  b.j.carga = 0;
  g.fx("hielo", u.x, u.y, { r: 140 });
  g.aviso("¡Refrigerante! El Centinela está expuesto unos segundos: ¡a por él!", "exito");
  return true;
}

// ------------------------------------------------------------------ III. Director Kessler · OMEGA
function director(g: Partida, uid: string, u: Unit, b: Brain, dt: number, solids: Circle[]): void {
  const tn = ENEMY_TUNING.director;
  const j = b.j;
  j.granada = j.granada ?? 3;
  j.refuerzo = j.refuerzo ?? 10;
  j.rejilla = j.rejilla ?? 6;
  j.fase = j.fase ?? 1;
  // El escudo depende de los pilones vivos.
  let pilones = 0;
  g.state.unidades.forEach((o) => o.t === "pilon" && pilones++);
  u.blindado = pilones > 0;
  const frac = u.hp / u.maxHp;
  if (j.fase === 1 && frac < 0.6) {
    j.fase = 2;
    u.fase = 2;
    g.aviso("¡PROTOCOLO OMEGA! El Director bloquea el hangar y suelta a los cazadores.", "peligro");
    g.sectores.bloqueoHangar(14);
    g.director.spawnCazador(2);
  }
  if (j.fase === 2 && frac < 0.28) {
    j.fase = 3;
    u.fase = 3;
    g.aviso("¡El exotraje se recalienta! El Director levanta dos pilones nuevos: destrúyanlos.", "peligro");
    g.sectores.levantarPilones(2);
  }
  const rapido = j.fase === 3 ? 0.65 : j.fase === 2 ? 0.8 : 1;
  const t = findTarget(g, u, b, true);
  if (!t) return;
  // Embestida (fases 2 y 3)
  if (j.dash > 0) {
    j.dash -= dt;
    const pos = g.world.moveCircle(u.x, u.y, Math.cos(j.dashAng) * tn.dashSpeed * dt, Math.sin(j.dashAng) * tn.dashSpeed * dt, enemyDef("director")!.radius, solids);
    u.x = Math.round(pos.x);
    u.y = Math.round(pos.y);
    b.x = pos.x;
    b.y = pos.y;
    u.moviendo = true;
    g.state.jugadores.forEach((p, id) => {
      if (p.vivo && dist(p.x, p.y, u.x, u.y) < 75) {
        g.damagePlayer(id, p, 35 * dt * 3);
        g.setEstado(id, p, "aturdido", 0.5);
      }
    });
    if (j.dash <= 0) u.st = "";
    return;
  }
  const { d, los, toT } = moverAdistancia(g, u, b, t, dt, solids, j.fase === 3 ? 1.3 : 1);
  // Ráfagas
  if (los && b.burst <= 0 && b.cd <= 0 && d < 750) {
    b.burst = tn.burst + (j.fase - 1) * 2;
    b.burstT = 0;
    b.cd = 2.2 * rapido;
  }
  if (b.burst > 0) {
    b.burstT -= dt;
    if (b.burstT <= 0) {
      const base = toT + (Math.random() - 0.5) * (g.state.eclipse > 0 ? 0.6 : 0.1);
      disparar(g, uid, u, base, "bala_roja", tn.bulletSpeed, tn.damage);
      if (j.fase >= 2) {
        disparar(g, uid, u, base + 0.25, "bala_roja", tn.bulletSpeed, tn.damage);
        disparar(g, uid, u, base - 0.25, "bala_roja", tn.bulletSpeed, tn.damage);
      }
      b.burst--;
      b.burstT = tn.burstGap;
    }
  }
  // Granadas telegrafiadas
  j.granada -= dt;
  if (j.granada <= 0) {
    j.granada = intervalo(g, tn.grenadeEvery) * rapido;
    const n = j.fase === 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = toT + (i - (n - 1) / 2) * 0.5;
      g.throwFlask("granada", u.x, u.y - 40, t.x + Math.cos(a + Math.PI / 2) * 90 * (i - 1), t.y + Math.sin(a + Math.PI / 2) * 90 * (i - 1), 1.1, uid, { r: tn.grenadeRadius, dmg: tn.grenadeDamage });
    }
  }
  // Rejilla eléctrica: franjas del suelo que se electrifican tras un aviso.
  j.rejilla -= dt;
  if (j.rejilla <= 0) {
    j.rejilla = intervalo(g, tn.gridEvery) * rapido;
    g.animar(uid, "pisoton");
    const sala = g.world.roomAt(u.x, u.y);
    if (sala) {
      const horizontal = Math.random() < 0.5;
      const franjas = 3 + j.fase;
      for (let i = 0; i < franjas; i++) {
        const k = (i + 0.5 + Math.random() * 0.5) / (franjas + 0.5);
        for (let s = 0; s < 6; s++) {
          const x = horizontal ? sala.x + (s + 0.5) * (sala.w / 6) : sala.x + sala.w * k;
          const y = horizontal ? sala.y + sala.h * k : sala.y + (s + 0.5) * (sala.h / 6);
          g.addZone("electrico", x, y, 70, 3.2);
        }
      }
    }
  }
  // Refuerzos
  j.refuerzo -= dt;
  if (j.refuerzo <= 0) {
    j.refuerzo = intervalo(g, tn.reinforceEvery);
    g.animar(uid, "rugido");
    const ola: string[] = j.fase === 1 ? ["fusilero", "robot"] : j.fase === 2 ? ["robot", "laser", "escudo"] : ["robot", "cazador", "laser"];
    g.director.spawnNear(ola as never, u.x, u.y, "jefe");
  }
  // Embestida
  if (j.fase >= 2 && los && d > 200 && Math.random() < dt * 0.25) {
    j.dash = 0.8;
    j.dashAng = toT;
    u.st = "cargando";
    g.animar(uid, "carga");
    g.fx("texto", u.x, u.y, { s: "¡CARGA OMEGA!", c: 0xff4a4a });
  }
}
