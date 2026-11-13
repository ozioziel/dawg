// Prueba automática con bots contra un servidor real (lobby → partida → juego).
//
//  - Equipos de 1 a 5 bots:   npm run prueba:bots -- ws://localhost:2567 20 5
//    (3.er argumento: número de bots; por defecto 3)
//  - Rellenar tu sala:        npm run prueba:bots -- ws://localhost:2567 300 ABCD 2
//    (creas la sala en el navegador y N bots entran con el código y eligen aliens libres)
//
// Los bots se mueven hacia el enemigo más cercano, disparan, usan la habilidad y rescatan.
import { Client } from "colyseus.js";

const URL = process.argv[2] ?? "ws://localhost:2567";
const SEGUNDOS = Number(process.argv[3] ?? 30);
const arg4 = process.argv[4];
const CODIGO = arg4 && /^[A-Za-z]{4}$/.test(arg4) ? arg4 : undefined;
const N = Math.max(1, Math.min(5, Number(CODIGO ? process.argv[5] ?? 2 : arg4 ?? 3)));
const ALIENS = ["cambiaformas", "delmar", "inteligente", "curandera", "vesper", "freeze", "escarabajo", "simbionte"];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let lobbies = [];
  const clientes = Array.from({ length: N }, () => new Client(URL));
  if (CODIGO) {
    for (let i = 0; i < N; i++) lobbies.push(await clientes[i].joinById(CODIGO.toUpperCase(), { nombre: `Bot${i + 1}` }));
    log(`${N} bots entraron a la sala ${CODIGO.toUpperCase()}`);
  } else {
    const lobby0 = await clientes[0].create("lobby", { nombre: "Bot1" });
    await sleep(300);
    log(`Lobby ${lobby0.state.codigo} creado; entran ${N - 1} bots más`);
    lobbies = [lobby0];
    for (let i = 1; i < N; i++) lobbies.push(await clientes[i].joinById(lobby0.state.codigo, { nombre: `Bot${i + 1}` }));
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
      l.onMessage("error", (m) => log("lobby:", m));
    });
    setTimeout(() => {
      const tomados = new Set();
      lobbies[0].state.jugadores.forEach((p) => p.alien && tomados.add(p.alien));
      const libres = ALIENS.filter((a) => !tomados.has(a)).sort(() => Math.random() - 0.5);
      lobbies.forEach((l, i) => {
        l.send("elegir", { alien: libres[i] });
        setTimeout(() => l.send("listo", { ready: true }), 300);
      });
      // El anfitrión empieza cuando todos están listos.
      if (!CODIGO) setTimeout(() => lobbies[0].send("empezar", {}), 1200);
    }, 500);
    setTimeout(() => reject(new Error("La partida no empezó a tiempo")), CODIGO ? 300000 : 20000);
  });
  log(`Partida ${partidas[0].roomId} con ${N} jugador${N > 1 ? "es" : ""}`);
  partidas[0].onMessage("aviso", (m) => log("AVISO:", m.texto));
  for (const r of partidas.slice(1)) r.onMessage("aviso", () => {});
  for (const r of partidas) for (const t of ["fx", "ping", "chat", "codigo"]) r.onMessage(t, () => {});

  const seqs = partidas.map(() => 0);
  let habT = 0;
  const timer = setInterval(() => {
    habT++;
    partidas.forEach((room, i) => {
      const st = room.state;
      if (!st?.jugadores) return;
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
      let aim = yo.aim;
      if (best) {
        aim = Math.atan2(best.y - yo.y, best.x - yo.x);
        if (bd > 260) {
          mx = Math.cos(aim);
          my = Math.sin(aim);
        }
      } else {
        mx = Math.cos(i + Date.now() / 3000);
        my = Math.sin(i + Date.now() / 3000);
      }
      room.send("input", { seq: ++seqs[i], mx, my, aim, shoot: Boolean(best) && bd < 600 });
      if (best && habT % 40 === i * 7) {
        room.send("habilidad", { x: best.x, y: best.y, fase: "down" });
        room.send("habilidad", { x: best.x, y: best.y, fase: "up" });
      }
      if (yo.ulti >= 1 && best && bd < 400) room.send("ulti", { x: best.x, y: best.y });
      if (yo.oferta) room.send("mejora", { i: 0 });
      let rescatar = false;
      st.jugadores.forEach((o, id) => id !== room.sessionId && o.vivo && o.estado !== "ok" && Math.hypot(o.x - yo.x, o.y - yo.y) < 90 && (rescatar = true));
      room.send("interactuar", { down: rescatar });
    });
  }, 1000 / 30);

  await sleep(SEGUNDOS * 1000);
  clearInterval(timer);
  const st = partidas[0].state;
  const resumen = [];
  st.jugadores.forEach((p) => resumen.push(`${p.nombre}/${p.kind}:${p.vivo ? "vivo" : "caído"} hp=${p.hp} bajas=${p.bajas}`));
  log(`Fase: ${st.fase} · sector ${st.sector} · unidades ${st.unidades.size} · ${resumen.join(" · ")}`);
  for (const r of partidas) await r.leave(true);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e?.type || e);
  process.exit(1);
});
