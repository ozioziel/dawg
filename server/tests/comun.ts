// Utilidades comunes de las pruebas.
import { SLOTS, RETOS, type AlienKind, type RetoDef } from "@dawg/shared";
import { GameState } from "../src/schema/GameState";
import { Partida } from "../src/game/Partida";
import type { RetoBase, Zona } from "../src/game/retos/base";
import { CLASES_RETO } from "../src/game/retos";

export interface Evento {
  t: string;
  m: unknown;
  to?: string;
}

export function crearPartida(kinds: AlienKind[], semilla = 7): { g: Partida; st: GameState; eventos: Evento[]; ids: string[] } {
  const st = new GameState();
  const eventos: Evento[] = [];
  const g = new Partida(st, (t, m, to) => eventos.push({ t, m, to }));
  g.semilla = semilla;
  const ids = kinds.map((k, i) => {
    const id = `p${i}`;
    g.addPlayer(id, `Jugador${i}`, k);
    return id;
  });
  g.start();
  return { g, st, eventos, ids };
}

/** Todas las combinaciones (reto, sala) que el planificador puede producir. */
export function paresPosibles(): { reto: RetoDef; slot: string }[] {
  const out: { reto: RetoDef; slot: string }[] = [];
  for (const reto of Object.values(RETOS)) {
    for (const s of SLOTS) {
      if (!reto.sectores.includes(s.sector)) continue;
      if (s.soloRetos && !s.soloRetos.includes(reto.id)) continue;
      if (reto.salas && !reto.salas.includes(s.id)) continue;
      out.push({ reto, slot: s.id });
    }
  }
  return out;
}

/** Monta un único reto en una sala concreta, sin complicaciones ni otros retos. */
export function montarReto(g: Partida, id: string, slot: string): RetoBase {
  const sec = g.sectores as unknown as { retos: Map<string, RetoBase>; zonas: Map<string, Zona>; plan: { sectores: { complicacion: number }[] } };
  for (const r of sec.retos.values()) r.limpiar();
  sec.retos.clear();
  g.state.retos.clear();
  g.state.pz.clear();
  g.state.bloqueos.clear();
  g.world.clearDyn();
  for (const s of sec.plan.sectores) s.complicacion = -1;
  const slotDef = SLOTS.find((s) => s.id === slot)!;
  g.state.sector = slotDef.sector;
  const Clase = CLASES_RETO[id];
  const r = new Clase(g, id, slot, sec.zonas.get(slot)!);
  sec.retos.set(slot, r);
  r.abrir();
  return r;
}
