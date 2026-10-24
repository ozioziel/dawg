// Prueba automática con bots.
//
//  - 3 bots solos:            npm run prueba:bots
//  - Rellenar tu sala:        npm run prueba:bots -- ws://localhost:2567 300 ABCD
//    (creas la sala en el navegador y 2 bots entran con el código ABCD y eligen los aliens libres)
//
// Los bots se mueven hacia el enemigo más cercano, disparan y rescatan compañeros.
import { Client } from "colyseus.js";

const URL = process.argv[2] ?? "ws://localhost:2567";
const SEGUNDOS = Number(process.argv[3] ?? 30);
const CODIGO = process.argv[4];
const ALIENS = ["cambiaformas", "delmar", "inteligente"];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let lobbies = [];
  let clientes = [];
  if (CODIGO) {
    for (let i = 0; i < 2; i++) {
      const c = new Client(URL);
      clientes.push(c);
      lobbies.push(await c.joinById(CODIGO.toUpperCase(), { nombre: `Bot${i + 1}` }));
    }
    log(`2 bots entraron a la sala ${CODIGO.toUpperCase()}`);
  } else {
    clientes = ALIENS.map(() => new Client(URL));
    const lobby0 = await clientes[0].create("lobby", { nombre: "Bot1" });
    await sleep(300);
    log("Lobby creado con código", lobby0.state.codigo);
    lobbies = [lobby0];
    for (let i = 1; i < 3; i++) lobbies.push(await clientes[i].joinById(lobby0.state.codigo, { nombre: `Bot${i + 1}` }));
  }

  const partidas = await new Promise((resolve, reject) => {
    const out = [];
    lobbies.forEach((l, i) => {
      l.onMessage("empezar", async (reserva) => {
        try {
          const room = await clientes[i].consumeSeatReservation(reserva);
          room.send("cargado");
          out[i] = room;
          if (out.filter(Boolean).length === lobbies.length) resolve(out);
        } catch (e) {
          reject(e);
        }
      });
      l.onMessage("error", (m) => reject(new Error(m)));
    });
    // Elegir aliens libres
    setTimeout(() => {
      const tomados = new Set();
      lobbies[0].state.jugadores.forEach((p) => p.alien && tomados.add(p.alien));
      const libres = ALIENS.filter((a) => !tomados.has(a));
      lobbies.forEach((l, i) => {
        l.send("elegir", { alien: libres[i] });
        setTimeout(() => l.send("listo", { ready: true }), 300);
      });
    }, 500);
    setTimeout(() => reject(new Error("La partida no empezó a tiempo")), CODIGO ? 300000 : 15000);
  });
  log("Partida iniciada:", partidas[0].roomId);
  partidas[0].onMessage("aviso", (m) => log("AVISO:", m.texto));
  for (const r of partidas.slice(1)) r.onMessage("aviso", () => {});
  for (const r of partidas) {
    r.onMessage("fx", () => {});
    r.onMessage("ping", () => {});
    r.onMessage("chat", () => {});
  }

  const seqs = partidas.map(() => 0);
  const timer = setInterval(() => {
    partidas.forEach((room, i) => {
      const st = room.state;
      if (!st?.jugadores) return; // el estado aún no llegó
      const yo = st.jugadores.get(room.sessionId);
      if (!yo || !yo.vivo) return;
      let best = null;
      let bd = 1e9;
      st.unidades.forEach((u) => {
        if (u.team !== "humanos") return;
        const d = Math.hypot(u.x - yo.x, u.y - yo.y);
        if (d < bd) {
          bd = d;
          best = u;
        }
      });
      let mx = 0;
      let my = 0;
      let aim = 0;
      if (best && bd < 1200) {
        aim = Math.atan2(best.y - yo.y, best.x - yo.x);
        if (bd > 350) {
          mx = Math.cos(aim);
          my = Math.sin(aim);
        }
      }
      room.send("input", { seq: ++seqs[i], mx, my, aim, shoot: Boolean(best) && bd < 700 });
      let rescatar = false;
      st.jugadores.forEach((o, id) => {
        if (id !== room.sessionId && o.vivo && (o.estado === "congelado" || o.estado === "red") && Math.hypot(o.x - yo.x, o.y - yo.y) < 90) rescatar = true;
      });
      room.send("interactuar", { down: rescatar });
    });
  }, 1000 / 30);

  for (let s = 0; s < SEGUNDOS; s += 5) {
    await sleep(5000);
    const st = partidas[0].state;
    if (!st?.jugadores) continue;
    const js = [];
    st.jugadores.forEach((p) => js.push(`${p.nombre}(${p.kind}) hp=${Math.round(p.hp)} ${p.vivo ? "" : "MUERTO"} ${p.estado} @${Math.round(p.x)},${Math.round(p.y)}`));
    const abiertas = [];
    st.puertas.forEach((d, id) => d.abierta && abiertas.push(id));
    log(`t=${st.tiempo.toFixed(1)} fase=${st.fase} unidades=${st.unidades.size} proyectiles=${st.proyectiles.size} puertas abiertas=[${abiertas}]`);
    log("  " + js.join(" | "));
  }
  clearInterval(timer);
  for (const r of partidas) await r.leave(true);
  log("Fin de la prueba.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error en la prueba:", e);
  process.exit(1);
});
