// Menú principal y sala de espera (lobby).
import { ALIENS, ALIEN_KINDS, type AlienKind } from "@dawg/shared";
import type { SeatReservation } from "colyseus.js";
import { cliente, guardarReconexion, mensajeError, type SalaJuego, type SalaLobby } from "../net/conexion";
import type { GameStateS } from "../net/tipos";
import { conPortada, guardarLocal, h, leerLocal, limpiar, ui } from "./dom";
import { ayudaControles } from "./ayuda";

type AlEmpezar = (room: SalaJuego) => void;

export function mostrarMenu(alEmpezar: AlEmpezar, error = ""): void {
  limpiar();
  const nombre = h("input", { type: "text", maxlength: 14, placeholder: "Tu nombre", value: leerLocal("dawg:nombre") });
  const codigo = h("input", { type: "text", maxlength: 4, placeholder: "ABCD", style: "text-transform:uppercase;letter-spacing:.3em;text-align:center" });
  const err = h("div", { class: "error" }, error);
  const ocupado = (b: boolean) => {
    crear.disabled = b;
    unirse.disabled = b;
  };
  const nombreValido = () => {
    const n = nombre.value.trim();
    guardarLocal("dawg:nombre", n);
    return n || "Alien";
  };

  const crear = h(
    "button",
    {
      onclick: async () => {
        ocupado(true);
        err.textContent = "Creando sala…";
        try {
          const room = await cliente.create<never>("lobby", { nombre: nombreValido() });
          mostrarLobby(room as unknown as SalaLobby, alEmpezar);
        } catch (e) {
          err.textContent = mensajeError(e);
          ocupado(false);
        }
      },
    },
    "Crear sala",
  );
  const unirse = h(
    "button",
    {
      class: "sec",
      onclick: async () => {
        const c = codigo.value.trim().toUpperCase();
        if (c.length !== 4) {
          err.textContent = "El código tiene 4 letras.";
          return;
        }
        ocupado(true);
        err.textContent = "Entrando…";
        try {
          const room = await cliente.joinById<never>(c, { nombre: nombreValido() });
          mostrarLobby(room as unknown as SalaLobby, alEmpezar);
        } catch (e) {
          err.textContent = mensajeError(e);
          ocupado(false);
        }
      },
    },
    "Unirse",
  );
  codigo.addEventListener("keydown", (e) => e.key === "Enter" && unirse.click());

  const pantalla = conPortada(
    h(
      "div",
      { class: "pantalla" },
      h(
        "div",
        { class: "caja" },
        h("h1", { class: "titulo logo" }, "DAWG"),
        h("p", { class: "titulo subtitulo" }, "Tres aliens. Un Área 51. Ninguna salida fácil."),
        h("label", {}, "Nombre"),
        nombre,
        h("div", { style: "margin-top:18px" }, crear),
        h("label", {}, "¿Te pasaron un código?"),
        h("div", { class: "fila" }, codigo, unirse),
        err,
        h(
          "p",
          { class: "ayuda" },
          "Cooperativo online para 3 jugadores. Uno crea la sala y comparte el código de 4 letras. ",
          h("button", { class: "enlace", onclick: () => ayudaControles() }, "Ver controles"),
        ),
      ),
    ),
  );
  ui().append(pantalla);
  nombre.focus();
}

function mostrarLobby(room: SalaLobby, alEmpezar: AlEmpezar): void {
  limpiar();
  let salir = false;
  const err = h("div", { class: "error" });
  const codigoEl = h("span", { class: "titulo" }, "····");
  const copiar = h(
    "button",
    {
      class: "gris",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(room.state.codigo);
          copiar.textContent = "¡Copiado!";
        } catch {
          copiar.textContent = room.state.codigo;
        }
      },
    },
    "Copiar",
  );
  const tarjetas = new Map<AlienKind, HTMLElement>();
  const grid = h("div", { class: "aliens" });
  for (const k of ALIEN_KINDS) {
    const def = ALIENS[k];
    const quien = h("div", { class: "quien" });
    const card = h(
      "div",
      { class: "alien", onclick: () => room.send("elegir", { alien: k }) },
      h("img", { src: `assets/personajes/retrato_${k}.png`, alt: def.nombre }),
      h("h3", { style: `color:${def.colorCss}` }, def.nombre),
      h("p", {}, def.descripcion),
      quien,
    );
    tarjetas.set(k, card);
    grid.append(card);
  }
  const chips = h("div", { class: "jugadores" });
  const listo = h("button", { onclick: () => room.send("listo", { ready: !(room.state.jugadores.get(room.sessionId)?.listo ?? false) }) }, "¡Listo!");
  const salirBtn = h(
    "button",
    {
      class: "gris",
      onclick: () => {
        salir = true;
        void room.leave(true);
        mostrarMenu(alEmpezar);
      },
    },
    "Salir",
  );
  const estado = h("p", { class: "ayuda", style: "text-align:center" });
  const cuenta = h("div", { class: "cuenta titulo", style: "display:none" });

  const pantalla = conPortada(
    h(
      "div",
      { class: "pantalla" },
      h(
        "div",
        { class: "caja lobby" },
        h("div", { class: "codigo" }, h("span", { class: "ayuda" }, "CÓDIGO DE SALA"), codigoEl, copiar),
        grid,
        chips,
        estado,
        h("div", { class: "fila", style: "max-width:420px;margin:0 auto" }, salirBtn, listo),
        err,
      ),
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
    listo.textContent = yo?.listo ? "Cancelar" : "¡Listo!";
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
