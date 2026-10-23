// Esclusa doble: cada uno ve su mitad del ritmo; las notas dobles hay que pulsarlas a la vez.
import { ESCLUSA } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO, TITULO, tiempoServidor } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

interface Datos {
  ronda: number;
  fase: "ritmo" | "pausa" | "espera";
  inicio: number;
  pausa: number;
  notas: { t: number; l: "A" | "B" | "AB" }[];
  fallos: number;
  max: number;
  opA: string;
  opB: string;
}

const HIT_X = 110;
const VEL = 320;

export class MgEsclusa extends Minijuego {
  private d: Datos | null = null;
  private raw = "";
  private pulsadas = new Set<string>();
  private carriles: ("A" | "B")[] = ["A"];
  private texto!: Phaser.GameObjects.Text;
  private aviso!: Phaser.GameObjects.Text;
  private teclas: Phaser.Input.Keyboard.Key[] = [];
  private ultimoError = 0;
  private flash: { carril: number; ok: boolean; hasta: number }[] = [];

  constructor() {
    super("MgEsclusa");
    this.bloquea = false;
    this.pw = 760;
    this.ph = 220;
  }

  protected override colocar(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = Math.min(1, (W - 32) / this.pw);
    this.cont.setScale(s).setPosition(W / 2 - (this.pw * s) / 2, H - this.ph * s - 140);
  }

  protected crear(): void {
    this.titulo.setText("Esclusa doble").setFontSize(24);
    this.texto = this.add.text(20, 46, "", { ...TEXTO, fontSize: "14px", color: "#a9c6db" });
    this.aviso = this.add.text(this.pw / 2, this.ph / 2 + 20, "", { ...TITULO, fontSize: "30px", color: "#ffd23e", align: "center" }).setOrigin(0.5);
    this.cont.add([this.texto, this.aviso]);
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
    this.carriles = pz.solo ? ["A", "B"] : [this.miCarril()];
    const ritmo = d.fase === "ritmo";
    this.c.ui.minijuego = ritmo ? this.scene.key : "";
    const ahora = tiempoServidor() - d.inicio;
    this.texto.setText(
      `Ronda ${d.ronda}/${ESCLUSA.rounds} · fallos ${d.fallos}/${d.max} · ${pz.solo ? "F = palanca A · J = palanca B" : `ESPACIO = palanca ${this.carriles[0]}`} · amarillas = ¡A LA VEZ!`,
    );
    if (!ritmo) {
      this.aviso.setText(d.fase === "pausa" && d.pausa > 0 ? `Pausa ${Math.ceil(d.pausa)} s\n¡Del mar: transmuta el agua!` : "¡Vuelvan a las palancas!");
    } else this.aviso.setText(ahora < 0 ? "¡Prepárense!" : "");

    // Pulsaciones
    if (ritmo && !this.terminado) {
      const keyIdx = pz.solo ? [1, 2] : [0];
      keyIdx.forEach((k, ci) => {
        if (!Phaser.Input.Keyboard.JustDown(this.teclas[k])) return;
        const carril = this.carriles[ci];
        let mejor = -1;
        let md = 1e9;
        d.notas.forEach((n, i) => {
          if (!(n.l === carril || n.l === "AB") || this.pulsadas.has(`${i}${carril}`)) return;
          const dd = Math.abs(n.t - ahora);
          if (dd < md) {
            md = dd;
            mejor = i;
          }
        });
        const ok = mejor >= 0 && md <= ESCLUSA.hitWindow + 0.05;
        this.flash.push({ carril: ci, ok, hasta: this.time.now + 180 });
        sfx.nota(ok);
        if (ok) {
          this.pulsadas.add(`${mejor}${carril}`);
          this.c.room.send("mg", { id: this.id, ev: "nota", nota: mejor, ok: true, lane: carril });
        } else if (this.time.now - this.ultimoError > 350) {
          this.ultimoError = this.time.now;
          this.c.room.send("mg", { id: this.id, ev: "nota", nota: -1, ok: false });
        }
      });
    }
    this.dibujar(d, ahora, ritmo);
  }

  private dibujar(d: Datos, ahora: number, ritmo: boolean): void {
    const g = this.g.clear();
    const n = this.carriles.length;
    const alto = n === 1 ? 70 : 52;
    const y0 = 76;
    this.carriles.forEach((carril, ci) => {
      const y = y0 + ci * (alto + 10);
      g.fillStyle(0x0d1f2a).fillRoundedRect(20, y, this.pw - 40, alto, 10).lineStyle(2, 0x0a0a0c).strokeRoundedRect(20, y, this.pw - 40, alto, 10);
      const fl = this.flash.find((f) => f.carril === ci && f.hasta > this.time.now);
      g.lineStyle(6, fl ? (fl.ok ? 0x7dff6a : 0xff4a4a) : 0xffffff, 1).lineBetween(HIT_X, y + 4, HIT_X, y + alto - 4);
      if (!ritmo) return;
      d.notas.forEach((nota, i) => {
        if (!(nota.l === carril || nota.l === "AB")) return;
        const x = HIT_X + (nota.t - ahora) * VEL;
        if (x < 20 || x > this.pw - 20) return;
        const hecha = this.pulsadas.has(`${i}${carril}`);
        const pasada = !hecha && nota.t < ahora - ESCLUSA.hitWindow;
        const col = hecha ? 0x7dff6a : pasada ? 0x555555 : nota.l === "AB" ? 0xffd23e : carril === "A" ? 0x7fb24a : 0xf08a24;
        const cy = y + alto / 2;
        g.fillStyle(col).fillCircle(x, cy, alto * 0.32).lineStyle(3, 0x0a0a0c).strokeCircle(x, cy, alto * 0.32);
        if (nota.l === "AB") g.lineStyle(3, 0xffffff).strokeCircle(x, cy, alto * 0.42);
      });
    });
    this.flash = this.flash.filter((f) => f.hasta > this.time.now);
  }
}
