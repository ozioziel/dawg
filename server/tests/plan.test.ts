// Selección de retos para los 218 equipos posibles (1 a 5 aliens de 8, sin repetir).
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOGO, RETOS, claveRoster, planificarRun, todosLosRosters, validarPlan } from "@dawg/shared";
import { CLASES_RETO } from "../src/game/retos";
import { paresPosibles } from "./comun";

const rosters = todosLosRosters();

test("hay exactamente 218 equipos y todos están en el catálogo", () => {
  assert.equal(rosters.length, 218);
  const claves = new Set(rosters.map((r) => claveRoster(r)));
  assert.equal(claves.size, 218);
  for (const c of claves) assert.ok(CATALOGO[c], `falta ${c} en el catálogo`);
  assert.equal(Object.keys(CATALOGO).length, 218);
});

test("todos los retos del catálogo tienen implementación", () => {
  for (const id of Object.keys(RETOS)) assert.ok(CLASES_RETO[id], `falta la clase de ${id}`);
});

test("cada equipo recibe un plan válido en los 3 sectores (60 semillas por equipo)", () => {
  let planes = 0;
  for (const r of rosters) {
    for (let semilla = 1; semilla <= 60; semilla++) {
      const plan = planificarRun(r, semilla);
      const errores = validarPlan(plan);
      assert.deepEqual(errores, [], `${plan.clave} (semilla ${semilla}): ${errores.join("; ")}`);
      assert.equal(plan.sectores.length, 3);
      plan.sectores.forEach((s, i) => {
        assert.equal(s.id, `${i + 1}-${plan.clave}`);
        // Sala y complicación salen del catálogo del equipo.
        assert.ok(s.sala && s.complicacionTexto);
      });
      // Registro de usados sin repetir
      assert.equal(new Set(plan.usados).size, plan.usados.length);
      planes++;
    }
  }
  assert.equal(planes, 218 * 60);
});

test("ningún reto obligatorio necesita un alien ausente ni dos personas a la vez en solitario", () => {
  for (const r of rosters) {
    const plan = planificarRun(r, 3);
    for (const s of plan.sectores)
      for (const a of s.asignaciones) {
        const d = RETOS[a.reto];
        assert.ok(d.requiere.every((k) => r.includes(k)), `${plan.clave}: ${a.reto} requiere ${d.requiere}`);
        if (r.length === 1) assert.ok(d.requiere.length <= 1, `${plan.clave}: dúo ${a.reto} en solitario`);
      }
  }
});

test("las tareas de cada alien aparecen en su sector y nunca se repite un patrón de solución", () => {
  for (const r of rosters) {
    const plan = planificarRun(r, 11);
    const patrones = plan.sectores.flatMap((s) => s.asignaciones.map((a) => RETOS[a.reto].patron));
    assert.equal(new Set(patrones).size, patrones.length, `${plan.clave}: patrón repetido`);
  }
});

test("cada combinación (reto, sala) que puede salir está cubierta por las pruebas de resolución", () => {
  const cubiertos = new Set(paresPosibles().map((p) => `${p.reto.id}@${p.slot}`));
  for (const r of rosters)
    for (let semilla = 1; semilla <= 20; semilla++)
      for (const s of planificarRun(r, semilla).sectores) for (const a of s.asignaciones) assert.ok(cubiertos.has(`${a.reto}@${a.slot}`), `${a.reto}@${a.slot} sin probar`);
});
