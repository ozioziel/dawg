// Memoria psíquica (Inteligente): las zonas del cerebro se iluminan en orden y hay que repetirlas.
// Empieza con 3 y cada acierto añade una zona más (hasta 8).
import Phaser from "phaser";
import { TEXTO } from "../contexto";
import { Minijuego } from "./Minijuego";

const NODOS = [
  { x: 205, y: 205, c: 0x3ef0ff },
  { x: 340, y: 172, c: 0xff5ad1 },
  { x: 475, y: 205, c: 0xffd23e },
  { x: 205, y: 318, c: 0x7dff6a },
  { x: 340, y: 350, c: 0xff8a3a },
  { x: 475, y: 318, c: 0xb18cff },
];
const R = 46;

type Fase = "mostrar" | "repetir" | "pausa";

export class MgMemoria extends Minijuego {
  private secuencia: number[] = [];
  private fase: Fase = "pausa";
  private paso = 0;
  private reloj = 0;
  private encendido = -1;
  private pulsado = -1;
  private pulsadoHasta = 0;
  private hechas = 0;
  private estado!: Phaser.GameObjects.Text;

  constructor() {
    super("MgMemoria");
    this.ph = 470;
  }

  protected crear(): void {
    this.secuencia = [];
    this.hechas = 0;
    this.numeros = undefined;
    this.pulsado = -1;
    this.agregar(3);
    this.empezarPausa(1.2);
    // Cerebro de fondo
    const b = this.add.graphics();
    b.fillStyle(0xf5a8c4, 0.22).fillEllipse(340, 262, 470, 300).lineStyle(4, 0xf5a8c4, 0.5).strokeEllipse(340, 262, 470, 300);
    b.lineStyle(3, 0xd06f97, 0.35).lineBetween(340, 118, 340, 410);
    for (let i = 0; i < 7; i++) {
      const x = 150 + i * 62;
      b.beginPath().moveTo(x, 140).lineTo(x + 18, 170).lineTo(x - 6, 200).lineTo(x + 14, 230).strokePath();
    }
    this.cont.addAt(b, 1);
    this.estado = this.add.text(this.pw / 2, 96, "", { ...TEXTO, fontSize: "20px", color: "#ffd23e" }).setOrigin(0.5);
    const ayuda = this.add
      .text(this.pw / 2, this.ph - 14, "Mira qué zonas se iluminan y repítelas en el mismo orden (clic o teclas 1-6).", {
        ...TEXTO,
        fontSize: "14px",
        color: "#a9c6db",
        align: "center",
        wordWrap: { width: this.pw - 40 },
      })
      .setOrigin(0.5, 1);
    this.cont.add([this.estado, ayuda]);
    this.input.on("pointerdown", () => {
      const p = this.puntero();
      const i = NODOS.findIndex((n) => Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y) <= R);
      if (i >= 0) this.pulsar(i);
    });
    ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"].forEach((k, i) => this.input.keyboard!.on(`keydown-${k}`, () => this.pulsar(i)));
  }

  private agregar(n: number): void {
    for (let i = 0; i < n; i++) {
      let s: number;
      do s = Phaser.Math.Between(0, NODOS.length - 1);
      while (s === this.secuencia[this.secuencia.length - 1]);
      this.secuencia.push(s);
    }
  }

  private empezarPausa(seg: number): void {
    this.fase = "pausa";
    this.reloj = seg;
    this.encendido = -1;
  }

  /** Tiempo encendida cada zona al mostrar la secuencia (algo más rápido al avanzar). */
  private get tEncendido(): number {
    return (this.corto ? 0.5 : 0.62) - this.progreso * 0.15;
  }

  private pulsar(i: number): void {
    if (this.terminado || this.fase !== "repetir") return;
    this.pulsado = i;
    this.pulsadoHasta = this.time.now + 220;
    if (this.secuencia[this.paso] !== i) {
      this.error("Zona equivocada. Mira otra vez.");
      this.empezarPausa(1);
      return;
    }
    this.paso++;
    if (this.paso >= this.secuencia.length) {
      this.acierto();
      this.hechas++;
      if (this.secuencia.length < 8) this.agregar(1);
      this.empezarPausa(1);
    }
  }

  protected tick(dt: number): void {
    if (!this.terminado) {
      this.reloj -= dt;
      if (this.fase === "pausa" && this.reloj <= 0) {
        this.fase = "mostrar";
        this.paso = 0;
        this.reloj = 0.35;
        this.encendido = -1;
      } else if (this.fase === "mostrar" && this.reloj <= 0) {
        if (this.encendido >= 0) {
          // Apagar y pasar a la siguiente
          this.encendido = -1;
          this.paso++;
          this.reloj = 0.22;
          if (this.paso >= this.secuencia.length) {
            this.fase = "repetir";
            this.paso = 0;
          }
        } else {
          this.encendido = this.secuencia[this.paso];
          this.reloj = this.tEncendido;
        }
      }
    }
    this.estado.setText(
      this.terminado
        ? ""
        : this.fase === "repetir"
          ? `¡Repítela! ${this.paso}/${this.secuencia.length}`
          : this.fase === "mostrar"
            ? `Mira la secuencia… (${this.secuencia.length} zonas)`
            : this.hechas
              ? `¡Bien! Secuencias completadas: ${this.hechas}`
              : "Prepárate…",
    );
    this.dibujar();
  }

  private dibujar(): void {
    const g = this.g.clear();
    const pulsado = this.time.now < this.pulsadoHasta ? this.pulsado : -1;
    NODOS.forEach((n, i) => {
      const on = i === this.encendido || i === pulsado;
      if (on) g.fillStyle(n.c, 0.35).fillCircle(n.x, n.y, R + 16);
      g.fillStyle(n.c, on ? 1 : 0.32).fillCircle(n.x, n.y, R);
      g.lineStyle(4, on ? 0xffffff : 0x0a0a0c).strokeCircle(n.x, n.y, R);
    });
    // Números para el teclado
    if (!this.numeros) {
      this.numeros = NODOS.map((n, i) => this.add.text(n.x, n.y, String(i + 1), { ...TEXTO, fontSize: "22px" }).setOrigin(0.5));
      this.cont.add(this.numeros);
    }
  }

  private numeros?: Phaser.GameObjects.Text[];
}
