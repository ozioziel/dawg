// Pantalla de victoria / derrota con estadísticas del equipo.
import { ALIENS, isAlienKind } from "@dawg/shared";
import type { Ctx } from "../game/contexto";
import { borrarReconexion } from "../net/conexion";
import { h, ui } from "./dom";

let actual: HTMLElement | null = null;

export function mostrarFin(c: Ctx, fase: string): void {
  ocultarFin();
  const gano = fase === "victoria";
  const tabla = h("table", { class: "tabla" });
  c.room.state.jugadores.forEach((p) => {
    const color = isAlienKind(p.kind) ? ALIENS[p.kind].colorCss : "#fff";
    tabla.append(
      h(
        "tr",
        {},
        h("td", { style: `color:${color};font-weight:700;text-align:left` }, p.nombre),
        h("td", {}, isAlienKind(p.kind) ? ALIENS[p.kind].nombre : p.kind),
        h("td", {}, `${p.bajas} bajas`),
        h("td", {}, p.vivo ? "✔ escapó" : "☠ cayó"),
      ),
    );
  });
  const reintentar = h(
    "button",
    {
      onclick: () => {
        c.room.send("reiniciar");
        reintentar.disabled = true;
        reintentar.textContent = "Esperando al equipo…";
      },
    },
    "Reintentar (R)",
  );
  const salir = h(
    "button",
    {
      class: "gris",
      onclick: () => {
        borrarReconexion();
        c.salir();
      },
    },
    "Volver al menú",
  );
  actual = h(
    "div",
    { class: "fin" },
    h(
      "div",
      { class: "caja" },
      h("h1", { class: "titulo", style: `color:${gano ? "var(--verde)" : "var(--rojo)"}` }, gano ? "¡ESCAPARON!" : "CAPTURADOS"),
      h("p", { class: "ayuda", style: "font-size:17px" }, gano ? "Superaron el Área 1 del Área 51. Demo completada: el Área 2 los espera…" : "El Área 51 se quedó con sus muestras. Reintenten con el mismo equipo."),
      tabla,
      h("div", { class: "fila" }, salir, reintentar),
    ),
  );
  ui().append(actual);
}

export function ocultarFin(): void {
  actual?.remove();
  actual = null;
}
