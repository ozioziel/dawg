// Flujo alienígena (Del mar): transmuta las tuberías para llevar el líquido a la cerradura.
import Phaser from "phaser";
import { TEXTO } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

const COLS = 8;
const FILAS = 5;
const C = 60;
const BX = 100;
const BY = 92;
// Direcciones: 0 N, 1 E, 2 S, 3 O
const TIPOS: number[][] = [
  [1, 3], // ─
  [0, 2], // │
  [0, 1], // └
  [1, 2], // ┌
  [2, 3], // ┐
  [3, 0], // ┘
  [0, 1, 2, 3], // ┼
];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const opuesta = (d: number) => (d + 2) % 4;

export class MgTuberias extends Minijuego {
  private celdas: number[] = [];
  private bloqueadas = new Set<number>();
  private llenas: { i: number; de: number; a: number }[] = [];
  private filaIn = 2;
  private filaOut = 2;
  private ronda = 1;
  private rondas = 3;
  private espera = 0;
  private flujo: { cx: number; cy: number; de: number; a: number; prog: number } | null = null;
  private paso = 1.6;
  private terminadoRondas = false;
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super("MgTuberias");
    this.ph = 470;
  }

  protected crear(): void {
    this.ronda = 1;
    this.rondas = this.corto ? 1 : 3;
    this.terminadoRondas = false;
    this.msg = this.add.text(this.pw / 2, 64, "", { ...TEXTO, fontSize: "18px", color: "#ffd23e" }).setOrigin(0.5);
    const ayuda = this.add
      .text(this.pw / 2, this.ph - 14, "Haz clic en una tubería para transmutarla (─ │ └ ┌ ┐ ┘ ┼). Lleva el líquido verde de la entrada a la cerradura antes de que caiga al desagüe.", {
        ...TEXTO,
        fontSize: "13px",
        color: "#a9c6db",
        align: "center",
        wordWrap: { width: this.pw - 40 },
      })
      .setOrigin(0.5, 1);
    this.cont.add([this.msg, ayuda]);
    this.input.on("pointerdown", () => this.clic());
    this.nuevaRonda();
  }

  private nuevaRonda(): void {
    this.celdas = Array.from({ length: COLS * FILAS }, () => Phaser.Math.Between(0, 6));
    this.bloqueadas.clear();
    this.llenas = [];
    this.filaIn = Phaser.Math.Between(0, FILAS - 1);
    this.filaOut = Phaser.Math.Between(0, FILAS - 1);
    this.paso = this.corto ? 1.05 : [1.6, 1.25, 1.0][this.ronda - 1];
    this.espera = this.corto ? 4 : this.ronda === 1 ? 7 : 4;
    this.flujo = null;
  }

  private clic(): void {
    if (this.terminado || this.terminadoRondas) return;
    const p = this.puntero();
    const cx = Math.floor((p.x - BX) / C);
    const cy = Math.floor((p.y - BY) / C);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= FILAS) return;
    const i = cy * COLS + cx;
    if (this.bloqueadas.has(i)) return;
    this.celdas[i] = (this.celdas[i] + 1) % TIPOS.length;
    sfx.clic();
  }

  /** El líquido entra en la celda (cx,cy) viniendo desde la dirección `de`. */
  private entrar(cx: number, cy: number, de: number): boolean {
    if (cx >= COLS) {
      if (cy === this.filaOut && de === 3) return this.ganarRonda();
      this.fallar("El líquido cayó al desagüe.");
      return false;
    }
    if (cx < 0 || cy < 0 || cy >= FILAS) {
      this.fallar("El líquido cayó al desagüe.");
      return false;
    }
    const i = cy * COLS + cx;
    const t = TIPOS[this.celdas[i]];
    if (!t.includes(de)) {
      this.fallar("La tubería no conectaba: ¡fuga!");
      return false;
    }
    const a = t.length === 4 ? opuesta(de) : t.find((d) => d !== de)!;
    this.bloqueadas.add(i);
    this.flujo = { cx, cy, de, a, prog: 0 };
    return true;
  }

  private ganarRonda(): boolean {
    sfx.nota(true);
    this.flujo = null;
    if (this.ronda >= this.rondas) {
      this.terminadoRondas = true;
      return true;
    }
    this.ronda++;
    this.nuevaRonda();
    return true;
  }

  protected tick(dt: number): void {
    if (!this.terminado && !this.terminadoRondas) {
      if (!this.flujo && this.espera > 0) {
        this.espera -= dt;
        if (this.espera <= 0) this.entrar(0, this.filaIn, 3);
      } else if (this.flujo) {
        this.flujo.prog += dt / this.paso;
        if (this.flujo.prog >= 1) {
          const f = this.flujo;
          this.llenas.push({ i: f.cy * COLS + f.cx, de: f.de, a: f.a });
          this.flujo = null;
          this.entrar(f.cx + DX[f.a], f.cy + DY[f.a], opuesta(f.a));
        }
      }
    }
    this.msg.setText(
      this.terminadoRondas
        ? "¡Cerradura llena! Presurizando… aguanta hasta que termine el tiempo."
        : this.flujo || this.espera <= 0
          ? `Ronda ${this.ronda}/${this.rondas} · ¡el líquido avanza!`
          : `Ronda ${this.ronda}/${this.rondas} · el líquido sale en ${Math.ceil(this.espera)} s`,
    );
    this.dibujar();
  }

  private dibujar(): void {
    const g = this.g.clear();
    g.fillStyle(0x0d1f2a).fillRoundedRect(BX - 8, BY - 8, COLS * C + 16, FILAS * C + 16, 10);
    // Entrada y cerradura
    g.fillStyle(0x7dff6a).fillRoundedRect(BX - 60, BY + this.filaIn * C + 18, 52, 24, 6).lineStyle(3, 0x0a0a0c).strokeRoundedRect(BX - 60, BY + this.filaIn * C + 18, 52, 24, 6);
    g.fillStyle(0xffd23e).fillRoundedRect(BX + COLS * C + 8, BY + this.filaOut * C + 10, 44, 40, 8).lineStyle(3, 0x0a0a0c).strokeRoundedRect(BX + COLS * C + 8, BY + this.filaOut * C + 10, 44, 40, 8);
    g.fillStyle(0x0a0a0c).fillCircle(BX + COLS * C + 30, BY + this.filaOut * C + 26, 5).fillRect(BX + COLS * C + 27, BY + this.filaOut * C + 28, 6, 12);
    for (let cy = 0; cy < FILAS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = cy * COLS + cx;
        const x = BX + cx * C;
        const y = BY + cy * C;
        const bloq = this.bloqueadas.has(i);
        g.fillStyle(bloq ? 0x2a3f4a : 0x24456b).fillRoundedRect(x + 4, y + 4, C - 8, C - 8, 8).lineStyle(2, bloq ? 0x0a0a0c : 0x3ef0ff, bloq ? 1 : 0.35).strokeRoundedRect(x + 4, y + 4, C - 8, C - 8, 8);
        const t = TIPOS[this.celdas[i]];
        for (const d of t) {
          const ex = x + C / 2 + DX[d] * (C / 2 - 3);
          const ey = y + C / 2 + DY[d] * (C / 2 - 3);
          g.lineStyle(16, 0x0a0a0c).lineBetween(x + C / 2, y + C / 2, ex, ey);
          g.lineStyle(10, 0x8d97a8).lineBetween(x + C / 2, y + C / 2, ex, ey);
        }
      }
    }
    // Líquido
    const verde = (x0: number, y0: number, x1: number, y1: number) => g.lineStyle(7, 0x7dff6a).lineBetween(x0, y0, x1, y1);
    for (const l of this.llenas) {
      const x = BX + (l.i % COLS) * C + C / 2;
      const y = BY + Math.floor(l.i / COLS) * C + C / 2;
      verde(x + DX[l.de] * (C / 2), y + DY[l.de] * (C / 2), x, y);
      verde(x, y, x + DX[l.a] * (C / 2), y + DY[l.a] * (C / 2));
    }
    if (this.flujo) {
      const f = this.flujo;
      const x = BX + f.cx * C + C / 2;
      const y = BY + f.cy * C + C / 2;
      const p = f.prog;
      if (p < 0.5) verde(x + DX[f.de] * (C / 2), y + DY[f.de] * (C / 2), x + DX[f.de] * (C / 2) * (1 - p * 2), y + DY[f.de] * (C / 2) * (1 - p * 2));
      else {
        verde(x + DX[f.de] * (C / 2), y + DY[f.de] * (C / 2), x, y);
        verde(x, y, x + DX[f.a] * (C / 2) * ((p - 0.5) * 2), y + DY[f.a] * (C / 2) * ((p - 0.5) * 2));
      }
    }
  }
}
