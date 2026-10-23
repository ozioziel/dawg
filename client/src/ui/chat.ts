// Chat de texto (Enter para escribir). Sirve para coordinar los puzzles de dúo.
import type { ChatEvent } from "@dawg/shared";
import { ALIENS, isAlienKind } from "@dawg/shared";
import type { SalaJuego } from "../net/conexion";
import { h, ui } from "./dom";

export class Chat {
  readonly el: HTMLDivElement;
  private log: HTMLDivElement;
  private input: HTMLInputElement;
  abierto = false;

  constructor(private room: SalaJuego) {
    this.log = h("div", {});
    this.input = h("input", { type: "text", maxlength: 140, placeholder: "Escribe y pulsa Enter (Esc para cancelar)", style: "display:none" });
    this.el = h("div", { class: "chat" }, this.log, this.input);
    ui().append(this.el);
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const t = this.input.value.trim();
        if (t) this.room.send("chat", { texto: t });
        this.cerrar();
      } else if (e.key === "Escape") this.cerrar();
    });
    this.input.addEventListener("blur", () => this.cerrar());
    room.onMessage("chat", (m: ChatEvent) => {
      const color = isAlienKind(m.alien) ? ALIENS[m.alien].colorCss : "#fff";
      this.linea(m.nombre, m.texto, color);
    });
  }

  linea(nombre: string, texto: string, color = "#fff"): void {
    const l = h("div", { class: "linea" }, h("b", { style: `color:${color}` }, nombre + ":"), texto);
    this.log.append(l);
    while (this.log.children.length > 7) this.log.firstElementChild?.remove();
    setTimeout(() => (l.style.opacity = "0"), 12000);
    setTimeout(() => l.remove(), 13000);
  }

  sistema(texto: string, color = "#8fb0c8"): void {
    const l = h("div", { class: "linea", style: `color:${color}` }, texto);
    this.log.append(l);
    while (this.log.children.length > 7) this.log.firstElementChild?.remove();
    setTimeout(() => (l.style.opacity = "0"), 8000);
    setTimeout(() => l.remove(), 9000);
  }

  abrir(): void {
    this.abierto = true;
    this.input.style.display = "block";
    this.input.value = "";
    setTimeout(() => this.input.focus(), 0);
  }

  cerrar(): void {
    if (!this.abierto) return;
    this.abierto = false;
    this.input.style.display = "none";
    this.input.blur();
  }

  destruir(): void {
    this.el.remove();
  }
}
