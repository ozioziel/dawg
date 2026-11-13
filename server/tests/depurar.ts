process.env.DIRECTOR_APAGADO = "1";
import type { AlienKind } from "@dawg/shared";
import { RETOS } from "@dawg/shared";
import { crearPartida, montarReto } from "./comun";
import { Banco, RESOLUTORES } from "./resolutores";
const [reto, slot] = process.argv.slice(2);
const def = RETOS[reto];
const kinds: AlienKind[] = def.requiere.length ? [...def.requiere] : ["freeze"];
const { g, ids, eventos } = crearPartida(kinds);
const r = montarReto(g, reto, slot);
const b = new Banco(g);
b.tick(5);
try {
  RESOLUTORES[reto](b, r, (k) => { const i = k ? kinds.indexOf(k) : 0; const id = ids[Math.max(0, i)]; if (k) b.forma(id, k); return id; });
} catch (e) { console.log("EXC", e); }
b.tick(3);
console.log(reto, slot, r.st.estado, r.st.progreso.toFixed(2), r.st.texto);
const avisos = eventos.filter((e) => e.t === "aviso").map((e) => (e.m as { texto: string }).texto);
console.log(avisos.slice(-12).join("\n"));
const p = g.state.jugadores.get(ids[0])!;
console.log("jugador", Math.round(p.x), Math.round(p.y), p.forma, p.bajoTierra, p.hp);
