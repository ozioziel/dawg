// Controles táctiles para móvil: joystick izquierdo (moverse), joystick derecho (apuntar y
// atacar) y botones de habilidad, definitiva, interactuar, forma, pasar alma, ping, mapa y chat.
// Funcionan con varios dedos a la vez (pointer events) y se adaptan al alien actual.
import { ALIENS, isAlienKind } from "@dawg/shared";
import type { Ctx } from "../game/contexto";
import { h, ui } from "./dom";

export interface AccionesTactiles {
  ulti(): void;
  interactuar(down: boolean): void;
  forma(): void;
  dar(): void;
  ping(): void;
  mapa(): void;
  chat(): void;
  mejora(): void;
}

interface Stick {
  id: number;
  x0: number;
  y0: number;
  base: HTMLElement;
  punta: HTMLElement;
}

const RADIO = 56;

export class ControlesTactiles {
  readonly el: HTMLElement;
  private izq: Stick | null = null;
  private der: Stick | null = null;
  private botones = new Map<string, HTMLElement>();
  private etiquetaHab: HTMLElement;
  private etiquetaUlti: HTMLElement;
  private cargaUlti: HTMLElement;
  private cdHab: HTMLElement;

  constructor(
    private c: Ctx,
    private acc: AccionesTactiles,
  ) {
    this.el = h("div", { class: "tactil" });
    const zonaIzq = h("div", { class: "tactil-zona izq" });
    const zonaDer = h("div", { class: "tactil-zona der" });
    this.el.append(zonaIzq, zonaDer);
    this.engancharStick(zonaIzq, "izq");
    this.engancharStick(zonaDer, "der");

    const boton = (clave: string, texto: string, clase: string, down: () => void, up?: () => void) => {
      const b = h("button", { class: `tactil-btn t-${clase}` }, texto);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        b.classList.add("pulsado");
        down();
      });
      const fin = (e: PointerEvent) => {
        e.preventDefault();
        b.classList.remove("pulsado");
        up?.();
      };
      b.addEventListener("pointerup", fin);
      b.addEventListener("pointercancel", fin);
      this.botones.set(clave, b);
      this.el.append(b);
      return b;
    };
    const hab = boton("hab", "", "hab", () => (this.c.tactil.habilidad = "down"), () => (this.c.tactil.habilidad = "up"));
    this.etiquetaHab = h("span", { class: "tactil-txt" });
    this.cdHab = h("span", { class: "tactil-cd" });
    hab.append(this.cdHab, this.etiquetaHab);
    const ulti = boton("ulti", "", "ulti", () => this.acc.ulti());
    this.cargaUlti = h("span", { class: "tactil-cd ulti" });
    this.etiquetaUlti = h("span", { class: "tactil-txt" });
    ulti.append(this.cargaUlti, this.etiquetaUlti);
    boton("e", "E", "e", () => this.acc.interactuar(true), () => this.acc.interactuar(false));
    boton("q", "Q · forma", "q", () => this.acc.forma());
    boton("g", "G · alma", "g", () => this.acc.dar());
    boton("ping", "📍", "ping", () => this.acc.ping());
    boton("mapa", "🗺", "mapa", () => this.acc.mapa());
    boton("chat", "💬", "chat", () => this.acc.chat());
    boton("mejora", "🎁", "mejora", () => this.acc.mejora());
    ui().append(this.el);
  }

  private engancharStick(zona: HTMLElement, lado: "izq" | "der"): void {
    zona.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if ((lado === "izq" ? this.izq : this.der) !== null) return;
      zona.setPointerCapture(e.pointerId);
      const base = h("div", { class: "stick-base" });
      const punta = h("div", { class: "stick-punta" });
      base.append(punta);
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      this.el.append(base);
      const st: Stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base, punta };
      if (lado === "izq") this.izq = st;
      else this.der = st;
    });
    zona.addEventListener("pointermove", (e) => {
      const st = lado === "izq" ? this.izq : this.der;
      if (!st || st.id !== e.pointerId) return;
      let dx = e.clientX - st.x0;
      let dy = e.clientY - st.y0;
      const d = Math.hypot(dx, dy);
      if (d > RADIO) {
        dx = (dx / d) * RADIO;
        dy = (dy / d) * RADIO;
      }
      st.punta.style.transform = `translate(${dx}px, ${dy}px)`;
      if (lado === "izq") {
        this.c.tactil.mx = d > 8 ? dx / RADIO : 0;
        this.c.tactil.my = d > 8 ? dy / RADIO : 0;
      } else if (d > 10) {
        this.c.tactil.aim = Math.atan2(dy, dx);
        this.c.tactil.disparo = d > RADIO * 0.45;
      } else this.c.tactil.disparo = false;
    });
    const fin = (e: PointerEvent) => {
      const st = lado === "izq" ? this.izq : this.der;
      if (!st || st.id !== e.pointerId) return;
      st.base.remove();
      if (lado === "izq") {
        this.izq = null;
        this.c.tactil.mx = 0;
        this.c.tactil.my = 0;
      } else {
        this.der = null;
        this.c.tactil.disparo = false;
      }
    };
    zona.addEventListener("pointerup", fin);
    zona.addEventListener("lostpointercapture", fin);
    zona.addEventListener("pointercancel", fin);
  }

  /** Actualiza nombres, enfriamientos y visibilidad según la forma actual. */
  actualizar(forma: string, enfFrac: number, ulti: number, ultiActiva: boolean, almas: number, oferta: boolean): void {
    const def = isAlienKind(forma) ? ALIENS[forma] : undefined;
    this.etiqueta(this.etiquetaHab, def?.habilidad.nombre ?? "Habilidad");
    this.etiqueta(this.etiquetaUlti, def?.ulti.nombre ?? "Definitiva");
    this.cdHab.style.height = `${Math.round(Math.max(0, Math.min(1, enfFrac)) * 100)}%`;
    this.cargaUlti.style.height = `${Math.round((1 - Math.max(0, Math.min(1, ulti))) * 100)}%`;
    this.botones.get("ulti")!.classList.toggle("lista", ulti >= 1 || ultiActiva);
    this.botones.get("q")!.style.display = almas > 0 ? "" : "none";
    this.botones.get("g")!.style.display = almas > 0 ? "" : "none";
    this.botones.get("mejora")!.style.display = oferta ? "" : "none";
    if (def) this.botones.get("hab")!.style.borderColor = def.colorCss;
  }

  /** Pone el nombre y reduce la letra si la palabra más larga no cabe en el botón redondo. */
  private etiqueta(el: HTMLElement, texto: string): void {
    const ancho = (el.parentElement?.clientWidth ?? 80) - 10;
    const clave = `${texto}|${ancho}`;
    if (el.dataset.k === clave) return;
    el.dataset.k = clave;
    el.textContent = texto;
    const larga = Math.max(...texto.split(/\s+/).map((w) => w.length));
    el.style.fontSize = `${Math.max(8, Math.min(11, Math.floor(ancho / (larga * 0.62))))}px`;
  }

  destruir(): void {
    this.el.remove();
  }
}
