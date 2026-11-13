// Pantalla de victoria / derrota con la contribución de cada alien (no solo bajas).
import { ALIENS, MEJORA_POR_ID, isAlienKind } from "@dawg/shared";
import type { Ctx } from "../game/contexto";
import { borrarReconexion } from "../net/conexion";
import { h, ui } from "./dom";

let actual: HTMLElement | null = null;

export function mostrarFin(c: Ctx, fase: string): void {
  ocultarFin();
  const gano = fase === "victoria";
  const tabla = h("table", { class: "tabla" });
  tabla.append(h("tr", {}, ...["Alien", "", "Bajas", "Curación", "Rescates", "Retos", "Mejoras", ""].map((t) => h("th", {}, t))));
  c.room.state.jugadores.forEach((p) => {
    const color = isAlienKind(p.kind) ? ALIENS[p.kind].colorCss : "#fff";
    tabla.append(
      h(
        "tr",
        {},
        h("td", { style: `color:${color};font-weight:700;text-align:left` }, p.nombre),
        h("td", {}, isAlienKind(p.kind) ? ALIENS[p.kind].nombre : p.kind),
        h("td", {}, String(p.bajas)),
        h("td", {}, String(p.curado)),
        h("td", {}, String(p.rescates)),
        h("td", {}, String(p.apoyo)),
        h("td", { title: p.mejoras.toArray().map((m) => MEJORA_POR_ID[m.split(":")[0]]?.nombre ?? m).join(", ") }, String(p.mejoras.length)),
        h("td", {}, p.vivo ? (gano ? "✔ escapó" : "en pie") : "☠ cayó"),
      ),
    );
  });
  const botones: HTMLButtonElement[] = [];
  const votar = (modo: "sector" | "todo", b: HTMLButtonElement) => {
    c.room.send("reiniciar", { modo });
    for (const x of botones) x.disabled = true;
    b.textContent = "Esperando al equipo…";
  };
  const sector = h("button", { onclick: () => votar("sector", sector) }, `Reintentar el sector ${["", "I", "II", "III"][c.room.state.sector] ?? ""}`);
  const todo = h("button", { class: "sec", onclick: () => votar("todo", todo) }, gano ? "Jugar otra vez" : "Reiniciar desde cero");
  if (!gano) botones.push(sector);
  botones.push(todo);
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
      h("h1", { class: "titulo", style: `color:${gano ? "var(--verde)" : "var(--rojo)"}` }, gano ? "¡ESCAPARON DEL ÁREA 51!" : "CAPTURADOS"),
      h(
        "p",
        { class: "ayuda", style: "font-size:17px" },
        gano
          ? "Derrotaron al Director Kessler, abrieron la Gran Compuerta y salieron al desierto de Nevada. Demo completada."
          : "El Área 51 se quedó con sus muestras. Reintenten el sector con las mejoras que tenían al entrar, o empiecen de cero.",
      ),
      tabla,
      h("div", { class: "fila" }, salir, ...botones),
    ),
  );
  ui().append(actual);
}

export function ocultarFin(): void {
  actual?.remove();
  actual = null;
}
