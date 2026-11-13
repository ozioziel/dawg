// Recorrido completo de los tres sectores para equipos de 1 a 5: puertas, jefes, puntos de
// control, reaparición por fases y victoria SOLO tras el tercer jefe y la huida.
process.env.DIRECTOR_APAGADO = "1";
import assert from "node:assert/strict";
import { test } from "node:test";
import { slotDef, type AlienKind } from "@dawg/shared";
import type { Partida } from "../src/game/Partida";
import { crearPartida } from "./comun";
import { Banco } from "./resolutores";

function sala(g: Partida, id: string): { x: number; y: number } {
  const r = g.world.rooms.find((x) => x.id === id)!;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function todosA(b: Banco, ids: string[], x: number, y: number): void {
  ids.forEach((id, i) => {
    const p = b.p(id);
    if (p.vivo) b.junto(id, x + (i % 3) * 50 - 50, y + Math.floor(i / 3) * 50, 0, 0);
  });
}

function resolverSector(g: Partida, s: number): void {
  for (const [slot, r] of g.sectores.retos) if (slotDef(slot)?.sector === s && !r.resuelto) r.resolver();
}

function enSalida(b: Banco, ids: string[]): void {
  const e = b.g.world.findOne("exit")!;
  ids.forEach((id, i) => b.p(id).vivo && b.tp(id, e.x + 100 + i * 60, e.y + 150));
}

/** Avanza el tiempo como haría el equipo: re-estabiliza estaciones perturbadas. */
function esperarApertura(b: Banco, ids: string[], segundos: number, hasta: () => boolean): void {
  for (let t = 0; t < segundos * 30 && !hasta(); t++) {
    let parche: { x: number; y: number } | null = null;
    b.g.state.pz.forEach((o) => o.k === "parche" && (parche = o));
    if (parche) {
      const pa = parche as { x: number; y: number };
      b.junto(ids[0], pa.x, pa.y, 0, 50);
      b.Emantener(ids[0], 2.7);
    } else b.tick(1);
  }
}

function recorrido(kinds: AlienKind[]): void {
  const { g, st, ids } = crearPartida(kinds);
  const b = new Banco(g);
  const puerta = (id: string) => st.puertas.get(id)!.abierta;
  b.seg(1);
  assert.equal(st.sector, 1);
  assert.ok(puerta("D0"), "D0 abre tras el tutorial");
  assert.ok(!puerta("D7"), "el núcleo empieza cerrado");
  // Salas selladas cuando no se usan
  for (const s of g.sectores.plan!.sectores[0].sellados) {
    const d = { r2: "D2", r3: "D3", r4: "D4", r5: "D5", r6: "D6" }[s as "r2"];
    if (d) assert.ok(st.puertas.get(d)!.sellada && !puerta(d), `${s} debería estar sellada`);
  }
  resolverSector(g, 1);
  b.tick(2);
  assert.ok(puerta("D7"), "resolver el sector I abre el núcleo");
  // Victoria imposible antes de tiempo
  enSalida(b, ids);
  b.tick(3);
  assert.equal(st.fase, "jugando");
  // Jefe I
  const r7 = sala(g, "r7");
  todosA(b, ids, r7.x, r7.y + 300);
  b.seg(1);
  const jefe = st.unidades.get(st.jefe)!;
  assert.equal(jefe.t, "jefe");
  for (const n of g.world.find("sabotaje")) {
    b.junto(ids[0], n.x, n.y, 0, 50);
    b.Emantener(ids[0], 5.3);
  }
  assert.equal(jefe.tanques, 0, "las estaciones rompen los depósitos");
  g.hitUnit(st.jefe, jefe, 1e6, null, ids[0]);
  b.tick(2);
  assert.ok(g.flags.has("jefe1") && puerta("D8"));
  // Una muerte antes del punto de control: reaparece al empezar el sector II
  if (ids.length > 1) {
    g.killPlayer(ids[1], b.p(ids[1]));
    assert.ok(!b.p(ids[1]).vivo);
  }
  const e2 = sala(g, "e2");
  todosA(b, ids, e2.x, e2.y);
  b.seg(1);
  assert.equal(st.sector, 2, "entrar en la esclusa empieza el sector II");
  ids.forEach((id) => assert.ok(b.p(id).vivo, "los caídos vuelven en el punto de control"));
  assert.equal(st.almas.size, 0, "el alma vuelve a su dueño");
  resolverSector(g, 2);
  b.tick(2);
  assert.ok(puerta("D10"));
  const a2 = sala(g, "arena2");
  todosA(b, ids, a2.x, a2.y + 300);
  b.seg(1);
  const cent = st.unidades.get(st.jefe)!;
  assert.equal(cent.t, "centinela");
  b.seg(17);
  const v = g.world.findOne("refrigerante", "v1")!;
  b.junto(ids[0], v.x, v.y, 0, 50);
  b.Emantener(ids[0], 2.2);
  assert.equal(st.unidades.get(st.jefe)?.st, "enfriado", "la válvula enfría al Centinela recalentado");
  g.hitUnit(st.jefe, cent, 1e6, null, ids[0]);
  b.tick(2);
  assert.ok(g.flags.has("jefe2") && puerta("D11"));
  const e3 = sala(g, "e3");
  todosA(b, ids, e3.x, e3.y);
  b.seg(1);
  assert.equal(st.sector, 3);
  assert.ok(puerta("D12"));
  resolverSector(g, 3);
  b.tick(2);
  const h = sala(g, "hangar");
  todosA(b, ids, h.x, h.y + 600);
  esperarApertura(b, ids, 90, () => Boolean(st.jefe));
  assert.ok(st.jefe, "el Director llega durante la apertura");
  const dir = st.unidades.get(st.jefe)!;
  assert.equal(dir.t, "director");
  esperarApertura(b, ids, 60, () => false);
  assert.ok(st.compuerta <= 0.7001, "el jefe bloquea la apertura por encima del 70%");
  enSalida(b, ids);
  b.tick(3);
  assert.equal(st.fase, "jugando", "sin derrotar al jefe final no hay victoria");
  todosA(b, ids, h.x, h.y + 600);
  st.unidades.forEach((u, uid) => u.t === "pilon" && g.hitUnit(uid, u, 1e6, null, ids[0]));
  b.tick(2);
  assert.ok(!st.unidades.get(st.jefe)?.blindado, "sin pilones no hay escudo");
  g.hitUnit(st.jefe, st.unidades.get(st.jefe)!, 1e6, null, ids[0]);
  esperarApertura(b, ids, 30, () => g.flags.has("compuerta"));
  b.tick(2);
  assert.ok(g.flags.has("jefe3") && g.flags.has("compuerta") && puerta("DF"));
  assert.equal(st.fase, "jugando", "hay que salir físicamente");
  enSalida(b, ids);
  b.tick(3);
  assert.equal(st.fase, "victoria");
}

const muestras: AlienKind[][] = [
  ["cambiaformas"],
  ["delmar"],
  ["inteligente"],
  ["curandera"],
  ["vesper"],
  ["freeze"],
  ["escarabajo"],
  ["simbionte"],
  ["vesper", "escarabajo"],
  ["cambiaformas", "inteligente"],
  ["delmar", "curandera", "simbionte"],
  ["inteligente", "delmar", "freeze"],
  ["cambiaformas", "vesper", "freeze", "escarabajo"],
  ["delmar", "inteligente", "curandera", "simbionte"],
  ["cambiaformas", "delmar", "inteligente", "curandera", "vesper"],
  ["curandera", "vesper", "freeze", "escarabajo", "simbionte"],
];

for (const kinds of muestras) {
  test(`recorrido completo (${kinds.length} jugador${kinds.length > 1 ? "es" : ""}: ${kinds.join(", ")})`, () => recorrido(kinds));
}
