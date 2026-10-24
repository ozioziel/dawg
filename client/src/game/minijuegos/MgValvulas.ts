// Válvulas a la vez (dúo Cambiaformas + Del mar): la pantalla da órdenes de una en una
// («solo A», «solo B» o «¡AMBOS!») y cada uno pulsa su válvula cuando le toca.
import { ESCLUSA, ERRORES_PERMITIDOS } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO, TITULO, tiempoServidor } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

interface Nota {
  t: number;
  d: number;
  l: "A" | "B" | "AB";
}

interface Datos {
  ronda: number;
  fase: "ritmo" | "pausa" | "espera";
  inicio: number;
  pausa: number;
  notas: Nota[];
  fallos: number;
  max: number;
  opA: string;
  opB: string;
}

const TEXTO_ORDEN: Record<Nota["l"], string> = {
  A: "SOLO A · Cambiaformas",
  B: "SOLO B · Del mar",
  AB: "¡AMBOS AHORA!",
};
const COLOR_ORDEN: Record<Nota["l"], number> = { A: 0x7fb24a, B: 0xf08a24, AB: 0xffd23e };

export class MgValvulas extends Minijuego {
  private d: Datos | null = null;
  private raw = "";
  private pulsadas = new Set<string>();
  private teclas: Phaser.Input.Keyboard.Key[] = [];
  private orden!: Phaser.GameObjects.Text;
  private accion!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private feedback = "";
  private feedbackOk = true;
  private feedbackHasta = 0;

  constructor() {
    super("MgValvulas");
    this.bloquea = false;
    this.cuentaGolpes = false;
    this.muestraErrores = false;
    this.pw = 640;
    this.ph = 250;
  }

  protected override colocar(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = Math.min(1, (W - 32) / this.pw);
    this.cont.setScale(s).setPosition(W / 2 - (this.pw * s) / 2, H - this.ph * s - 140);
  }

  protected crear(): void {
    this.d = null;
    this.raw = "";
    this.pulsadas.clear();
    this.orden = this.add.text(this.pw / 2, 104, "", { ...TITULO, fontSize: "40px" }).setOrigin(0.5);
    this.accion = this.add.text(this.pw / 2, 160, "", { ...TEXTO, fontSize: "22px" }).setOrigin(0.5);
    this.sub = this.add.text(this.pw / 2, this.ph - 20, "", { ...TEXTO, fontSize: "14px", color: "#a9c6db" }).setOrigin(0.5);
    this.cont.add([this.orden, this.accion, this.sub]);
    const kb = this.input.keyboard!;
    this.teclas = [kb.addKey("SPACE"), kb.addKey("F"), kb.addKey("J")];
  }

  private miCarril(): "A" | "B" {
    return this.d?.opB === this.c.room.sessionId && this.d?.opA !== this.c.room.sessionId ? "B" : "A";
  }

  protected tick(_dt: number, pz: PuzzleS): void {
    if (pz.datos !== this.raw) {
      this.raw = pz.datos;
      try {
        const nuevo = JSON.parse(pz.datos) as Datos;
        if (!this.d || nuevo.ronda !== this.d.ronda || nuevo.inicio !== this.d.inicio) this.pulsadas.clear();
        this.d = nuevo;
      } catch {
        return;
      }
    }
    const d = this.d;
    if (!d) return;
    const solo = pz.solo;
    const ritmo = d.fase === "ritmo";
    this.c.ui.minijuego = ritmo ? this.scene.key : "";
    const ahora = tiempoServidor() - d.inicio;
    const actual = ritmo ? d.notas.findIndex((n) => ahora >= n.t && ahora <= n.t + n.d) : -1;
    const siguiente = ritmo ? d.notas.find((n) => n.t > ahora) : undefined;

    // Pulsaciones
    if (ritmo && !this.terminado) {
      const usadas: [number, "A" | "B"][] = solo ? [[1, "A"], [2, "B"]] : [[0, this.miCarril()]];
      for (const [k, carril] of usadas) {
        if (!Phaser.Input.Keyboard.JustDown(this.teclas[k])) continue;
        const n = actual >= 0 ? d.notas[actual] : undefined;
        const toca = n && (n.l === carril || n.l === "AB");
        if (toca && !this.pulsadas.has(`${actual}${carril}`)) {
          this.pulsadas.add(`${actual}${carril}`);
          this.c.room.send("mg", { id: this.id, ev: "nota", nota: actual, ok: true, lane: carril });
          sfx.nota(true);
          this.aviso(n.l === "AB" && !solo ? "¡Bien! Ahora tu compañero también." : "¡Bien!", true);
        } else if (!toca) {
          this.c.room.send("mg", { id: this.id, ev: "nota", nota: -1, ok: false, lane: carril });
          sfx.nota(false);
          this.aviso(n ? "¡Esa orden no era para ti!" : "Espera la orden.", false);
        }
      }
    }

    // Textos
    if (!ritmo) {
      this.orden.setText(d.fase === "pausa" && d.pausa > 0 ? `Pausa ${Math.ceil(d.pausa)} s` : "¡A las palancas!").setColor("#3ef0ff");
      this.accion.setText(d.fase === "pausa" ? "Del mar: transmuta los charcos de agua (ESPACIO sobre ellos)." : "Vuelvan junto a su palanca para seguir.").setColor("#eaf6ff");
    } else if (actual >= 0) {
      const n = d.notas[actual];
      this.orden.setText(TEXTO_ORDEN[n.l]).setColor("#" + COLOR_ORDEN[n.l].toString(16).padStart(6, "0"));
      const meToca = solo ? true : n.l === "AB" || n.l === this.miCarril();
      const tecla = solo ? (n.l === "AB" ? "F y J" : n.l === "A" ? "F" : "J") : "ESPACIO";
      const hecho = solo ? (n.l === "AB" ? this.pulsadas.has(`${actual}A`) && this.pulsadas.has(`${actual}B`) : this.pulsadas.has(`${actual}${n.l}`)) : this.pulsadas.has(`${actual}${this.miCarril()}`);
      this.accion.setText(hecho ? "✔ Hecho" : meToca ? `¡PULSA ${tecla}!` : "No pulses: le toca a tu compañero").setColor(hecho ? "#7dff6a" : meToca ? "#ffffff" : "#8fb0c8");
    } else {
      this.orden.setText(ahora < 0 ? "¡Prepárense!" : "…").setColor("#eaf6ff");
      this.accion.setText(siguiente ? `Siguiente: ${TEXTO_ORDEN[siguiente.l]}` : "").setColor("#8fb0c8");
    }
    if (this.time.now < this.feedbackHasta) this.accion.setText(this.feedback).setColor(this.feedbackOk ? "#7dff6a" : "#ff6a6a");
    this.sub.setText(`Ronda ${d.ronda}/${ESCLUSA.rounds} · ${solo ? "F = válvula A · J = válvula B" : `Tú eres la válvula ${this.miCarril()} (ESPACIO)`}`);

    // Barra de tiempo de la orden y errores (los cuenta el servidor para los dos)
    const g = this.g.clear();
    if (actual >= 0) {
      const n = d.notas[actual];
      const frac = Math.max(0, 1 - (ahora - n.t) / n.d);
      g.fillStyle(0x000000, 0.7).fillRect(60, 190, this.pw - 120, 10).fillStyle(COLOR_ORDEN[n.l]).fillRect(60, 190, (this.pw - 120) * frac, 10);
    }
    for (let i = 0; i < ERRORES_PERMITIDOS; i++) {
      const x = this.pw - 22 - (ERRORES_PERMITIDOS - i) * 22 + 10;
      g.fillStyle(i >= d.fallos ? 0x7dff6a : 0x3a2a2a).fillCircle(x, 46, 7).lineStyle(2, 0x0a0a0c).strokeCircle(x, 46, 7);
    }
  }

  private aviso(t: string, ok: boolean): void {
    this.feedback = t;
    this.feedbackOk = ok;
    this.feedbackHasta = this.time.now + 700;
  }
}
