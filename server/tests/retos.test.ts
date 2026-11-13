// Cada reto, en cada sala donde el planificador puede ponerlo, se resuelve con acciones de juego.
// También se prueban los dúos clásicos en modo solitario (un alien que lleva el alma del otro).
process.env.DIRECTOR_APAGADO = "1";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AlienKind } from "@dawg/shared";
import { crearPartida, montarReto, paresPosibles } from "./comun";
import { Banco, RESOLUTORES } from "./resolutores";

for (const { reto, slot } of paresPosibles()) {
  test(`reto ${reto.id} se resuelve en la sala ${slot}`, () => {
    const kinds: AlienKind[] = reto.requiere.length ? [...reto.requiere] : ["freeze"];
    const { g, ids } = crearPartida(kinds);
    const r = montarReto(g, reto.id, slot);
    const b = new Banco(g);
    const quien = (k?: AlienKind) => {
      const i = k ? kinds.indexOf(k) : 0;
      const id = ids[Math.max(0, i)];
      if (k) b.forma(id, k);
      return id;
    };
    b.tick(5);
    assert.equal(r.st.estado, "libre", "el reto debe empezar libre");
    const resolver = RESOLUTORES[reto.id];
    assert.ok(resolver, `falta resolutor para ${reto.id}`);
    resolver(b, r, quien);
    b.tick(3);
    assert.equal(r.st.estado, "resuelto", `${reto.id} en ${slot}: quedó «${r.st.estado}» (${r.st.texto})`);
  });
}

for (const [id, roles] of [
  ["l-rayos", ["cambiaformas", "inteligente"]],
  ["l-puente", ["inteligente", "delmar"]],
  ["l-valvulas", ["cambiaformas", "delmar"]],
] as [string, AlienKind[]][]) {
  test(`dúo clásico ${id} en solitario (lleva el alma del otro)`, () => {
    const { g, ids } = crearPartida([roles[0]]);
    const p = g.state.jugadores.get(ids[0])!;
    p.almas.push(roles[1]);
    const slot = id === "l-puente" ? "r5" : "r6";
    const r = montarReto(g, id, slot);
    const b = new Banco(g);
    b.tick(3);
    RESOLUTORES[id](b, r, (k) => {
      if (k) b.forma(ids[0], k);
      return ids[0];
    });
    b.tick(3);
    assert.equal(r.st.estado, "resuelto", `${id} solo: ${r.st.texto}`);
    assert.equal(r.st.solo, true);
  });
}
