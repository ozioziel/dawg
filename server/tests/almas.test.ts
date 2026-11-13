// Muerte, almas, transformación completa, reaparición y reinicio.
process.env.DIRECTOR_APAGADO = "1";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ALIENS, HAB } from "@dawg/shared";
import { crearPartida } from "./comun";
import { Banco } from "./resolutores";

test("el alma de un caído permite transformarse por completo y vuelve a su dueño al revivir", () => {
  const { g, st, ids } = crearPartida(["delmar", "inteligente"]);
  const b = new Banco(g);
  const [d, t] = ids;
  b.seg(0.5);
  const pd = b.p(d);
  g.killPlayer(d, pd);
  assert.ok(!pd.vivo && pd.fantasma);
  assert.equal(st.almas.size, 1);
  const alma = [...st.almas.values()][0];
  assert.equal(alma.kind, "delmar");
  assert.equal(alma.dueno, d);
  // Telequinesis la recoge con E
  b.junto(t, alma.x, alma.y, 0, 30);
  b.E(t);
  const pt = b.p(t);
  assert.equal(st.almas.size, 0);
  assert.ok(pt.almas.includes("delmar"));
  // Q: transformación completa (forma, vida máxima, velocidad, habilidad y definitiva propias)
  g.cambiarForma(t);
  assert.equal(pt.forma, "delmar");
  assert.equal(pt.kind, "inteligente", "el alien original no cambia");
  assert.equal(pt.maxHp, ALIENS.delmar.hp);
  b.tick(2);
  assert.equal(pt.velocidad, ALIENS.delmar.speed);
  assert.equal(pt.ultiMax, ALIENS.delmar.ulti.duracion);
  // Usa la habilidad de Del Mar: transmutar un guardia en pulpo propio
  const uid = g.spawnUnit("fusilero", pt.x + 150, pt.y);
  b.hab(t, pt.x + 150, pt.y);
  let pulpo = false;
  st.unidades.forEach((u) => u.t === "pulpo" && u.dueno === t && (pulpo = true));
  assert.ok(pulpo, "con la forma de Del Mar transmuta");
  assert.ok(!st.unidades.has(uid));
  // Revive el dueño: recupera su alma y el portador pierde la transformación
  g.revivir(d, pt.x, pt.y);
  assert.ok(pd.vivo);
  assert.equal(pd.forma, "delmar");
  assert.equal(pt.forma, "inteligente");
  assert.ok(!pt.almas.includes("delmar"));
});

test("pasar un alma a un compañero (G)", () => {
  const { g, ids } = crearPartida(["vesper", "freeze", "escarabajo"]);
  const b = new Banco(g);
  const [v, f, e] = ids;
  g.killPlayer(v, b.p(v));
  const alma = [...g.state.almas.values()][0];
  b.junto(f, alma.x, alma.y, 0, 30);
  b.E(f);
  assert.ok(b.p(f).almas.includes("vesper"));
  b.tp(e, b.p(f).x + 60, b.p(f).y);
  g.darAlma(f);
  assert.ok(!b.p(f).almas.includes("vesper"));
  assert.ok(b.p(e).almas.includes("vesper"));
  g.cambiarForma(e);
  assert.equal(b.p(e).forma, "vesper");
});

test("al morir con un alma prestada caen las dos", () => {
  const { g, ids } = crearPartida(["curandera", "simbionte"]);
  const b = new Banco(g);
  const [h, s] = ids;
  g.killPlayer(h, b.p(h));
  const alma = [...g.state.almas.values()][0];
  b.junto(s, alma.x, alma.y, 0, 30);
  b.E(s);
  g.cambiarForma(s);
  assert.equal(b.p(s).forma, "curandera");
  g.killPlayer(s, b.p(s));
  assert.equal(g.state.almas.size, 2);
  assert.equal(b.p(s).forma, "simbionte");
});

test("en solitario hay una reanimación por sector y luego derrota", () => {
  const { g, st, ids } = crearPartida(["freeze"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  assert.equal(p.vidasSolo, 1);
  g.killPlayer(ids[0], p);
  // El banco cura a los vivos: no interfiere mientras está muerto.
  b.seg(3.5);
  assert.ok(p.vivo, "reaparece en el punto de control");
  assert.equal(p.vidasSolo, 0);
  g.killPlayer(ids[0], p);
  b.seg(1);
  assert.equal(st.fase, "derrota");
});

test("un equipo entero caído pierde y puede reintentar el sector o desde cero", () => {
  const { g, st, ids } = crearPartida(["cambiaformas", "delmar"]);
  const b = new Banco(g);
  // Ganar una mejora y avanzar al sector II
  g.mejoras.otorgar("prueba");
  b.tick(2);
  g.elegirMejora(ids[0], 0);
  assert.equal(b.p(ids[0]).mejoras.length, 1);
  for (const r of g.sectores.retos.values()) if (r.st.estado !== "inactivo") r.resolver();
  b.tick(2);
  g.flags.add("jefe1");
  const e2 = g.world.rooms.find((r) => r.id === "e2")!;
  b.tp(ids[0], e2.x + e2.w / 2, e2.y + e2.h / 2);
  b.seg(1);
  assert.equal(st.sector, 2);
  // Mejora conseguida dentro del sector II
  g.mejoras.otorgar("prueba 2");
  b.tick(2);
  g.elegirMejora(ids[0], 0);
  assert.equal(b.p(ids[0]).mejoras.length, 2);
  ids.forEach((id) => g.killPlayer(id, b.p(id)));
  b.tick(2);
  assert.equal(st.fase, "derrota");
  // Reintento del sector: vuelve al inicio del sector II con las mejoras que tenía al entrar
  ids.forEach((id) => g.votarReinicio(id, "sector"));
  assert.equal(st.fase, "jugando");
  assert.equal(st.sector, 2);
  assert.equal(b.p(ids[0]).mejoras.length, 1);
  assert.ok(st.puertas.get("D8")!.abierta, "el sector I queda superado");
  ids.forEach((id) => assert.ok(b.p(id).vivo));
  // Reinicio total: todo desde cero
  ids.forEach((id) => g.killPlayer(id, b.p(id)));
  b.tick(2);
  ids.forEach((id) => g.votarReinicio(id, "todo"));
  assert.equal(st.sector, 1);
  assert.equal(b.p(ids[0]).mejoras.length, 0, "la progresión temporal se pierde");
  assert.equal(g.flags.size, 0);
  assert.ok(!st.puertas.get("D8")!.abierta);
  assert.equal(st.almas.size, 0);
});

test("las mejoras tienen efecto real", () => {
  const { g, ids } = crearPartida(["escarabajo"]);
  const b = new Banco(g);
  const p = b.p(ids[0]);
  const vida = p.maxHp;
  p.mejoras.push("e-caparazon:epica");
  b.tick(1);
  assert.ok(p.maxHp > vida);
  p.mejoras.push("e-patas:rara");
  b.tick(1);
  assert.ok(p.velocidad > ALIENS.escarabajo.speed);
  p.bajoTierra = true;
  b.tick(1);
  assert.ok(p.velocidad > ALIENS.escarabajo.speed * HAB.escarabajo.burrowSpeedMul);
});
