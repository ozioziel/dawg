import { ALIENS, ALIEN_KINDS } from "@dawg/shared";
import { h, ui } from "./dom";

const CONTROLES: [string, string][] = [
  ["W A S D / flechas", "Moverse"],
  ["Ratón", "Apuntar · clic izquierdo ataca (360°)"],
  ["Espacio / clic derecho", "Habilidad activa hacia el ratón (algunas se mantienen pulsadas)"],
  ["R", "Definitiva cuando está cargada"],
  ["E", "Interactuar · mantener para rescatar, nutrir, sabotear…"],
  ["Q", "Transformarte en el alien de un alma que llevas"],
  ["G", "Pasar un alma al compañero más cercano"],
  ["7 8 9", "Elegir mejora"],
  ["1 2 3 4", "Pings: ¡Ayuda! · Aquí · ¡Defiendan! · Voy"],
  ["Enter", "Chat"],
  ["M · H · N", "Mapa grande · ayuda · sonido"],
  ["Móvil", "Joystick izquierdo moverse · derecho apuntar y atacar · botones de habilidad, definitiva, E, forma y alma"],
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
  const aliens = h("div", { class: "ayuda-aliens" });
  for (const k of ALIEN_KINDS) {
    const d = ALIENS[k];
    aliens.append(
      h(
        "div",
        { class: "ayuda-alien" },
        h("strong", { style: `color:${d.colorCss}` }, d.nombre),
        h("span", {}, `Ataque: ${d.ataque.nombre} · Habilidad: ${d.habilidad.nombre} — ${d.habilidad.desc} · Definitiva: ${d.ulti.nombre} — ${d.ulti.desc}`),
      ),
    );
  }
  const modal: HTMLDivElement = h(
    "div",
    { class: "modal", onclick: (e: Event) => e.target === modal && cerrar() },
    h(
      "div",
      { class: "caja ayuda-caja" },
      h("h2", { class: "titulo", style: "font-size:40px;color:var(--cian)" }, "Controles"),
      lista,
      h(
        "p",
        { class: "ayuda" },
        "Escapen del Área 51 a través de tres sectores. Cada sala tiene un reto elegido para su equipo: algunos los resuelve un alien concreto y otros cualquiera. Si alguien cae, recojan su alma (E) y transfórmense en él (Q) para hacer su parte; volverá en el siguiente punto de control.",
      ),
      h("h3", { class: "titulo", style: "font-size:26px;color:var(--cian)" }, "Los ocho aliens"),
      aliens,
      h("button", { onclick: cerrar }, "Regresar"),
    ),
  );
  ui().append(modal);
  window.addEventListener("keydown", tecla, true);
}
