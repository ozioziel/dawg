// Menú principal y sala de espera (lobby).
import { ALIENS, ALIEN_KINDS, type AlienKind } from "@dawg/shared";
import type { SeatReservation } from "colyseus.js";
import { cliente, guardarReconexion, mensajeError, type SalaJuego, type SalaLobby } from "../net/conexion";
import type { GameStateS } from "../net/tipos";
import { guardarLocal, h, leerLocal, limpiar, ui } from "./dom";
import { ayudaControles } from "./ayuda";
import { crearCuarto } from "./cuarto";

type AlEmpezar = (room: SalaJuego) => void;

export function mostrarMenu(alEmpezar: AlEmpezar, error = ""): void {
  limpiar();
  const nombre = h("input", { type: "text", maxlength: 14, placeholder: "Tu nombre", value: leerLocal("dawg:nombre") });
  const codigo = h("input", { type: "text", maxlength: 4, placeholder: "ABCD", style: "text-transform:uppercase;letter-spacing:.3em;text-align:center" });
  nombre.id = "menu-name";
  codigo.id = "menu-code";
  const estado = h("div", { class: "menu-status", role: "status" }, error);
  const err = h("div", { class: "error", role: "alert" });
  const nombreValido = () => {
    const n = nombre.value.trim();
    guardarLocal("dawg:nombre", n);
    return n || "Alien";
  };
  const crear = h(
    "button",
    {
      class: "menu-action",
      onclick: async () => {
        crear.disabled = true;
        err.textContent = "Creando sala…";
        try {
          const room = await cliente.create<never>("lobby", { nombre: nombreValido() });
          mostrarLobby(room as unknown as SalaLobby, alEmpezar);
        } catch (e) {
          err.textContent = mensajeError(e);
          crear.disabled = false;
        }
      },
    },
    "CREAR SALA",
  );
  const unirse = h(
    "button",
    {
      class: "menu-action",
      onclick: async () => {
        const c = codigo.value.trim().toUpperCase();
        if (c.length !== 4) {
          err.textContent = "El código tiene 4 letras.";
          return;
        }
        unirse.disabled = true;
        err.textContent = "Entrando…";
        try {
          const room = await cliente.joinById<never>(c, { nombre: nombreValido() });
          mostrarLobby(room as unknown as SalaLobby, alEmpezar);
        } catch (e) {
          err.textContent = mensajeError(e);
          unirse.disabled = false;
        }
      },
    },
    "UNIRSE",
  );
  codigo.addEventListener("keydown", (e) => e.key === "Enter" && unirse.click());

  const panelTitulo = h("h2", { class: "menu-panel-title" });
  const campoCodigo = h(
    "div",
    { class: "menu-code-field" },
    h("label", { for: "menu-code" }, "Código de sala"),
    codigo,
  );
  const regresar = h("button", { class: "menu-action menu-back", onclick: () => (panel.hidden = true) }, "REGRESAR");
  const panel = h(
    "section",
    { class: "menu-panel", hidden: true, "aria-labelledby": "menu-panel-title" },
    panelTitulo,
    h("label", { for: "menu-name" }, "Nombre del jugador"),
    nombre,
    campoCodigo,
    h("div", { class: "menu-panel-actions" }, crear, unirse, regresar),
    err,
  );
  panelTitulo.id = "menu-panel-title";
  const abrirPanel = (modo: "crear" | "unirse") => {
    panel.hidden = false;
    panelTitulo.textContent = modo === "crear" ? "Nueva partida" : "Unirse a una partida";
    campoCodigo.hidden = modo !== "unirse";
    crear.hidden = modo !== "crear";
    unirse.hidden = modo !== "unirse";
    err.textContent = "";
    nombre.focus();
  };
  nombre.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (crear.hidden ? unirse : crear).click();
  });
  const pantalla = h(
      "div",
      { class: "pantalla menu-screen" },
      h(
        "main",
        { class: "menu-content" },
        h("img", { class: "menu-logo", src: "assets/logo.png", alt: "DAWG" }),
        h("p", { class: "menu-tagline" }, "ÁREA 51 · PROTOCOLO DE CONTENCIÓN"),
        h(
          "nav",
          { class: "menu-options", "aria-label": "Menú principal" },
          h("button", { class: "menu-action", onclick: () => abrirPanel("crear") }, "CREAR SALA"),
          h("button", { class: "menu-action", onclick: () => abrirPanel("unirse") }, "UNIRSE"),
          h("button", { class: "menu-action", onclick: () => ayudaControles() }, "CONTROLES"),
          h("button", { class: "menu-action", onclick: () => { window.close(); estado.textContent = "Cierra esta pestaña para salir."; } }, "SALIR"),
        ),
        estado,
        panel,
      ),
    );
  pantalla.style.backgroundImage =
    "linear-gradient(90deg, rgba(3,6,10,.82) 0%, rgba(3,6,10,.66) 42%, rgba(3,6,10,.91) 100%), linear-gradient(0deg, rgba(3,6,10,.5), rgba(3,6,10,.14)), url(assets/portada_itch.png)";
  ui().append(pantalla);
}

function mostrarLobby(room: SalaLobby, alEmpezar: AlEmpezar): void {
  limpiar();
  let salir = false;
  const err = h("div", { class: "error" });
  const codigoEl = h("span", { class: "lobby-codigo" }, "····");
  const cuarto = crearCuarto(room);
  const copiar = h(
    "button",
    {
      class: "menu-action lobby-copiar",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(room.state.codigo);
          copiar.textContent = "COPIADO";
        } catch {
          copiar.textContent = room.state.codigo;
        }
      },
    },
    "COPIAR",
  );
  const tarjetas = new Map<AlienKind, HTMLElement>();
  const grid = h("div", { class: "lobby-opciones" });
  for (const k of ALIEN_KINDS) {
    const def = ALIENS[k];
    const quien = h("div", { class: "quien" });
    const card = h(
      "div",
      { class: "opcion", onclick: () => room.send("elegir", { alien: k }) },
      h("img", { src: `assets/personajes/retrato_${k}.png`, alt: def.nombre }),
      h("div", { class: "opcion-texto" }, h("h3", { style: `color:${def.colorCss}` }, def.nombre), h("p", {}, def.descripcion), quien),
    );
    tarjetas.set(k, card);
    grid.append(card);
  }
  const chips = h("div", { class: "jugadores" });
  const listo = h("button", { class: "menu-action", onclick: () => room.send("listo", { ready: !(room.state.jugadores.get(room.sessionId)?.listo ?? false) }) }, "LISTO");
  const salirBtn = h(
    "button",
    {
      class: "menu-action menu-back",
      onclick: () => {
        salir = true;
        cuarto.destroy();
        void room.leave(true);
        mostrarMenu(alEmpezar);
      },
    },
    "SALIR",
  );
  const estado = h("p", { class: "lobby-estado" });
  const cuenta = h("div", { class: "cuenta titulo", style: "display:none" });

  const pantalla = h(
    "div",
    { class: "pantalla menu-screen lobby-screen" },
    h(
      "main",
      { class: "lobby-layout" },
      h(
        "section",
        { class: "lobby-izq" },
        h("img", { class: "lobby-logo", src: "assets/logo.png", alt: "DAWG" }),
        h("div", { class: "lobby-codigo-fila" }, h("span", { class: "lobby-etiqueta" }, "CÓDIGO DE SALA"), codigoEl, copiar),
        h("h2", { class: "lobby-titulo" }, "ELIGE TU ALIEN"),
        grid,
        chips,
        estado,
        h("div", { class: "menu-panel-actions" }, salirBtn, listo),
        err,
      ),
      h("section", { class: "lobby-der" }, cuarto.el, h("p", { class: "lobby-ayuda" }, "Mueve a tu alien por el cuarto con W A S D o las flechas.")),
    ),
  );
  ui().append(pantalla, cuenta);

  const render = () => {
    const st = room.state;
    if (!st?.jugadores) return; // el estado aún no llegó
    codigoEl.textContent = st.codigo || "····";
    const yo = st.jugadores.get(room.sessionId);
    const dueños = new Map<string, string>();
    st.jugadores.forEach((p, id) => p.alien && dueños.set(p.alien, id));
    for (const [k, card] of tarjetas) {
      const id = dueños.get(k);
      const p = id ? st.jugadores.get(id) : undefined;
      card.classList.toggle("mio", id === room.sessionId);
      card.classList.toggle("tomado", Boolean(id) && id !== room.sessionId);
      card.querySelector(".quien")!.textContent = p ? `${p.nombre}${p.listo ? " ✔" : ""}` : "Libre";
    }
    chips.replaceChildren();
    st.jugadores.forEach((p, id) => {
      chips.append(h("span", { class: `chip ${p.listo ? "listo" : ""}` }, `${p.nombre}${id === room.sessionId ? " (tú)" : ""}${p.anfitrion ? " ★" : ""}`));
    });
    for (let i = st.jugadores.size; i < st.necesarios; i++) chips.append(h("span", { class: "chip", style: "opacity:.5" }, "Esperando…"));
    listo.textContent = yo?.listo ? "CANCELAR" : "LISTO";
    listo.disabled = !yo?.alien;
    const faltan = st.necesarios - st.jugadores.size;
    estado.textContent =
      faltan > 0
        ? `Comparte el código. Faltan ${faltan} jugador${faltan > 1 ? "es" : ""} (la partida necesita ${st.necesarios}).`
        : !yo?.alien
          ? "Elige tu alien."
          : `Cuando los ${st.necesarios} estén listos, empieza la partida.`;
    if (st.estado === "empezando" && st.cuenta > 0) {
      cuenta.style.display = "grid";
      cuenta.textContent = String(st.cuenta);
    } else cuenta.style.display = "none";
  };
  room.onMessage("error", (m: string) => (err.textContent = m));
  room.onMessage("empezar", async (reserva: SeatReservation) => {
    try {
      const juego = await cliente.consumeSeatReservation<GameStateS>(reserva);
      salir = true;
      cuarto.destroy();
      guardarReconexion(juego);
      void room.leave(true);
      alEmpezar(juego);
    } catch (e) {
      err.textContent = mensajeError(e);
    }
  });
  room.onLeave(() => {
    if (!salir) mostrarMenu(alEmpezar, "Se perdió la conexión con la sala.");
  });
  room.onStateChange(render);
  render();
}
