import { h, ui } from "./dom";

const CONTROLES: [string, string][] = [
  ["W A S D", "Moverse"],
  ["Ratón", "Apuntar · clic izquierdo dispara (360°)"],
  ["Espacio", "Habilidad (disfraz, transmutar, telequinesis) hacia el ratón"],
  ["E", "Interactuar: consolas, palancas, recoger almas · mantener para rescatar"],
  ["Q", "Cambiar de habilidad si llevas un alma"],
  ["G", "Pasar un alma al compañero más cercano"],
  ["1 2 3 4", "Pings: ¡Ayuda! · Aquí · ¡Defiendan! · Voy"],
  ["Enter", "Chat"],
  ["M", "Mapa grande"],
  ["H", "Esta ayuda"],
  ["N", "Silenciar / activar sonido"],
];

export function ayudaControles(onClose?: () => void): void {
  const cerrar = () => {
    modal.remove();
    window.removeEventListener("keydown", tecla, true);
    onClose?.();
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "h" || e.key === "H") {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    }
  };
  const lista = h("div", { class: "controles" });
  for (const [k, v] of CONTROLES) lista.append(h("kbd", {}, k), h("span", {}, v));
  const modal: HTMLDivElement = h(
    "div",
    { class: "modal", onclick: (e: Event) => e.target === modal && cerrar() },
    h(
      "div",
      { class: "caja" },
      h("h2", { class: "titulo", style: "font-size:44px;color:var(--cian)" }, "Controles"),
      lista,
      h(
        "p",
        { class: "ayuda" },
        "Escapen juntos: cada sala tiene un puzzle que solo puede resolver cierto alien mientras los demás lo defienden. Si alguien cae, recojan su alma (E) para tener sus habilidades y hacer los dos papeles.",
      ),
      h("button", { onclick: cerrar }, "Entendido"),
    ),
  );
  ui().append(modal);
  window.addEventListener("keydown", tecla, true);
}
