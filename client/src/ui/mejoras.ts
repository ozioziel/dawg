// Panel de recompensas roguelike: tres cartas con mejoras del propio alien. Se elige con un clic,
// un toque o las teclas 7, 8 y 9. No pausa la partida (es cooperativo en tiempo real).
import { COLOR_RAREZA, NOMBRE_RAREZA, RAMAS, parseMejora, textoMejora, isAlienKind } from "@dawg/shared";
import type { Ctx } from "../game/contexto";
import type { PlayerS } from "../net/tipos";
import { h, ui } from "./dom";

export class PanelMejoras {
  private el: HTMLElement;
  private actual = "";

  constructor(private c: Ctx) {
    this.el = h("div", { class: "mejoras", hidden: true });
    ui().append(this.el);
  }

  actualizar(me: PlayerS | undefined): void {
    const oferta = me?.oferta ?? "";
    const bloqueado = this.c.ui.tactil && (Boolean(this.c.ui.minijuego) || this.c.chat.abierto);
    if (oferta === this.actual) {
      this.el.hidden = !oferta || bloqueado || (this.c.ui.tactil && !this.c.ui.mostrarMejoras);
      return;
    }
    this.actual = oferta;
    this.el.replaceChildren();
    if (!oferta || !me) {
      this.el.hidden = true;
      return;
    }
    this.c.ui.mostrarMejoras = true;
    this.el.hidden = bloqueado;
    const titulo = h("div", { class: "mejoras-titulo" }, `🎁 Elige una mejora${me.ofertasPendientes ? ` (+${me.ofertasPendientes} más)` : ""}`);
    this.el.append(titulo);
    oferta.split(",").forEach((s, i) => {
      const m = parseMejora(s);
      if (!m) return;
      const rama = isAlienKind(m.def.alien) ? RAMAS[m.def.alien][m.def.rama] : "";
      const carta = h(
        "button",
        { class: "mejora-carta", style: `border-color:${COLOR_RAREZA[m.rareza]}`, onclick: () => this.c.room.send("mejora", { i }) },
        h("span", { class: "mejora-tecla" }, String(7 + i)),
        h("span", { class: "mejora-rama" }, rama),
        h("strong", {}, m.def.nombre),
        h("span", { class: "mejora-rareza", style: `color:${COLOR_RAREZA[m.rareza]}` }, NOMBRE_RAREZA[m.rareza]),
        h("span", { class: "mejora-desc" }, textoMejora(m.def, m.rareza)),
      );
      this.el.append(carta);
    });
  }

  destruir(): void {
    this.el.remove();
  }
}
