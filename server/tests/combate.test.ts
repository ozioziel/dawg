// Interacciones de combate de los ocho aliens y rendimiento con muchas unidades.
process.env.DIRECTOR_APAGADO = "1";
import assert from "node:assert/strict";
import { test } from "node:test";
import { HAB } from "@dawg/shared";
import { crearPartida } from "./comun";
import { Banco } from "./resolutores";

test("Escarabajo: la mordida ejecuta guardias normales pero no élites ni jefes", () => {
  const { g, st, ids } = crearPartida(["escarabajo"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const normal = g.spawnUnit("fusilero", p.x + 50, p.y);
  b.dispararA(ids[0], normal, 0.2);
  assert.ok(!st.unidades.has(normal));
  b.seg(5);
  const elite = g.spawnUnit("robot", p.x + 50, p.y);
  b.dispararA(ids[0], elite, 0.2);
  const u = st.unidades.get(elite);
  assert.ok(u && u.hp < u.maxHp, "la élite aguanta la mordida");
});

test("Freeze: el chorro congela poco a poco y Cero Absoluto congela la sala", () => {
  const { g, st, ids } = crearPartida(["freeze"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const uid = g.spawnUnit("escudo", p.x + 120, p.y);
  b.dispararA(ids[0], uid, 2.5);
  assert.equal(st.unidades.get(uid)?.st, "congelado");
  const otra = g.spawnUnit("fusilero", p.x - 200, p.y + 100);
  p.ulti = 1;
  g.usarUlti(ids[0], p.x, p.y);
  b.tick(1);
  assert.equal(st.unidades.get(otra)?.st, "congelado");
});

test("Vesper: paso sombrío a la espalda y Eclipse con fuego amigo entre guardias", () => {
  const { g, st, ids } = crearPartida(["vesper"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const uid = g.spawnUnit("fusilero", p.x + 300, p.y);
  const u = st.unidades.get(uid)!;
  u.ang = Math.PI;
  b.hab(ids[0], u.x, u.y);
  assert.ok(p.x > u.x, "aparece detrás del guardia");
  assert.ok(p.punal > 0);
  p.ulti = 1;
  g.usarUlti(ids[0], p.x, p.y);
  assert.ok(st.eclipse > 0);
  // Una bala enemiga durante el Eclipse puede herir a otro guardia
  const a = g.spawnUnit("fusilero", p.x + 500, p.y + 400);
  const c = g.spawnUnit("fusilero", p.x + 700, p.y + 400);
  const ua = st.unidades.get(a)!;
  const uc = st.unidades.get(c)!;
  const antes = uc.hp;
  g.spawnProjectile("bala_roja", "humanos", ua.x + 30, ua.y, 0, 700, { damage: 5, range: 600, shooter: a, ff: true });
  b.seg(0.5);
  assert.ok(uc.hp < antes);
});

test("Curandera: atrapa, no puede atacar con la boca llena y al digerir cura cerca", () => {
  const { g, st, ids } = crearPartida(["curandera", "freeze"]);
  const b = new Banco(g);
  const [h, f] = ids;
  const ph = b.p(h);
  b.tp(f, ph.x + 60, ph.y);
  b.p(f).hp = 40;
  const uid = g.spawnUnit("fusilero", ph.x + 80, ph.y + 40);
  b.hab(h, ph.x + 80, ph.y + 40);
  assert.ok(!st.unidades.has(uid));
  assert.equal(ph.cautivo, "fusilero");
  const balas = st.proyectiles.size;
  b.disparar(h, ph.x + 300, ph.y, 0.5);
  assert.equal(st.proyectiles.size, balas, "no dispara con un cautivo");
  b.p(f).hp = 40;
  ph.enfriamiento = 0;
  g.usarHabilidad(h, ph.x, ph.y, "down");
  assert.ok(b.p(f).hp > 40);
  assert.equal(ph.cautivo, "");
});

test("Telequinesis: control mental con el cuerpo inmóvil y protegido", () => {
  const { g, st, ids } = crearPartida(["inteligente"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const uid = g.spawnUnit("fusilero", p.x + 150, p.y);
  b.habMantener(ids[0], p.x + 150, p.y, 0.7);
  assert.equal(p.controla, uid);
  assert.ok(p.escudo > 0);
  assert.equal(st.unidades.get(uid)!.poseido, "T");
  const x0 = p.x;
  g.input(ids[0], { seq: p.seq + 1, mx: 1, my: 0, aim: 0, shoot: false });
  b.tick(2);
  assert.equal(p.x, x0, "el cuerpo no se mueve");
  g.damagePlayer(ids[0], p, 30);
  assert.equal(p.hp, p.maxHp, "el escudo absorbe el daño");
  g.usarHabilidad(ids[0], 0, 0, "down");
  assert.equal(p.controla, "");
});

test("Del Mar: máximo 3 transmutaciones y Ecosistema convierte pulpos en krakens", () => {
  const { g, st, ids } = crearPartida(["delmar"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  for (let i = 0; i < 4; i++) {
    g.spawnUnit("fusilero", p.x + 120, p.y + i * 10);
    b.hab(ids[0], p.x + 120, p.y + i * 10);
  }
  let pulpos = 0;
  st.unidades.forEach((u) => u.t === "pulpo" && pulpos++);
  assert.equal(pulpos, HAB.delmar.maxActive);
  p.ulti = 1;
  g.usarUlti(ids[0], p.x, p.y);
  let krakens = 0;
  st.unidades.forEach((u) => u.t === "kraken" && krakens++);
  assert.equal(krakens, 3);
});

test("Simbionte: infecta, asimila, la colonia crece y la Fusión la consume entera", () => {
  const { g, st, ids } = crearPartida(["simbionte"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  for (let i = 0; i < 2; i++) {
    const uid = g.spawnUnit("fusilero", p.x + 160, p.y + i * 80);
    b.dispararA(ids[0], uid, 1.4);
    const u = st.unidades.get(uid)!;
    assert.equal(u.st, "infectado");
    b.hab(ids[0], u.x, u.y);
    assert.equal(st.unidades.get(uid)?.poseido, "S");
  }
  b.tick(2);
  assert.equal(p.colonia, 2);
  p.ulti = 1;
  g.usarUlti(ids[0], p.x, p.y);
  b.tick(2);
  assert.equal(p.colonia, 0, "toda la colonia se consume");
  assert.ok(p.ultiT > 0 && p.escudo > 0);
});

test("Cambiaformas: escaneo de un guardia vivo, disfraz y disparar lo rompe", () => {
  const { g, st, ids } = crearPartida(["cambiaformas"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const uid = g.spawnUnit("medico", p.x + 90, p.y);
  b.escanear(ids[0], uid);
  assert.equal(p.identidad, "medico");
  assert.ok(p.disfrazado);
  b.disparar(ids[0], p.x + 300, p.y, 0.3);
  assert.ok(!p.disfrazado);
  void st;
});

test("rendimiento: colonia grande, krakens, plantas y 36 enemigos", () => {
  const { g, st, ids } = crearPartida(["simbionte", "delmar", "curandera", "freeze", "vesper"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  for (let i = 0; i < 36; i++) g.spawnUnit(i % 3 ? "fusilero" : "robot", p.x + 300 + (i % 6) * 60, p.y - 200 + Math.floor(i / 6) * 60);
  for (let i = 0; i < 8; i++) {
    const uid = g.spawnUnit("cria", p.x - 80, p.y + i * 30, "aliens");
    const u = st.unidades.get(uid)!;
    u.dueno = ids[0];
    u.poseido = "S";
  }
  const t0 = performance.now();
  b.seg(30);
  const ms = (performance.now() - t0) / 900;
  assert.ok(ms < 8, `tick medio ${ms.toFixed(2)} ms (presupuesto 33 ms)`);
  console.log(`  tick medio con ~50 unidades: ${ms.toFixed(2)} ms`);
});
