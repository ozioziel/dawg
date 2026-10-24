// Copia la cara (Cambiaformas): arma tu disfraz igual al científico que pide el escáner.
// Pelo, gafas, boca y color de placa; luego "¡Escanear!".
import Phaser from "phaser";
import { TEXTO, TITULO } from "../contexto";
import { Minijuego } from "./Minijuego";

const CATEGORIAS = [
  { nombre: "Pelo", ops: ["Castaño", "Rubio", "Calvo"] },
  { nombre: "Ojos", ops: ["Sin gafas", "Redondas", "Cuadradas"] },
  { nombre: "Boca", ops: ["Bigote", "Sonrisa", "Seria"] },
  { nombre: "Placa", ops: ["Azul", "Verde", "Roja"] },
];
const PLACAS = [0x3e8ee0, 0x6be04a, 0xe0393e];

interface Boton {
  x: number;
  y: number;
  w: number;
  h: number;
  cat: number;
  op: number;
}

export class MgCara extends Minijuego {
  private objetivo: number[] = [0, 0, 0, 0];
  private mio: number[] = [0, 0, 0, 0];
  private botones: Boton[] = [];
  private textos: Phaser.GameObjects.Text[] = [];
  private malas = new Set<number>();
  private malasHasta = 0;
  private limite = 14;
  private resta = 14;
  private hechas = 0;
  private estado!: Phaser.GameObjects.Text;
  private escanear = { x: 470, y: 392, w: 190, h: 50 };

  constructor() {
    super("MgCara");
    this.pw = 700;
    this.ph = 480;
  }

  protected crear(): void {
    this.hechas = 0;
    this.botones = [];
    this.textos = [];
    this.mio = [0, 0, 0, 0];
    this.nuevoCientifico();
    const t = (x: number, y: number, s: string, size = 16, color = "#eaf6ff") => {
      const o = this.add.text(x, y, s, { ...TEXTO, fontSize: `${size}px`, color }).setOrigin(0.5);
      this.cont.add(o);
      return o;
    };
    t(110, 92, "BUSCADO", 18, "#ffd23e");
    t(290, 92, "TU DISFRAZ", 18, "#7fb24a");
    CATEGORIAS.forEach((c, ci) => {
      const y = 112 + ci * 66;
      t(470, y, c.nombre, 14, "#a9c6db");
      c.ops.forEach((op, oi) => {
        const b = { x: 392 + oi * 98, y: y + 12, w: 92, h: 36, cat: ci, op: oi };
        this.botones.push(b);
        this.textos.push(t(b.x + b.w / 2, b.y + b.h / 2, op, 13));
      });
    });
    t(this.escanear.x + this.escanear.w / 2, this.escanear.y + this.escanear.h / 2, "¡ESCANEAR!", 20).setStyle({ ...TITULO, fontSize: "24px", color: "#0a0a0c", strokeThickness: 0 });
    this.estado = t(this.pw / 2, 448, "", 15, "#ffd23e");
    this.input.on("pointerdown", () => this.clic());
    this.input.keyboard!.on("keydown-ENTER", () => this.comprobar());
  }

  private nuevoCientifico(): void {
    let nuevo: number[];
    do nuevo = CATEGORIAS.map(() => Phaser.Math.Between(0, 2));
    while (nuevo.every((v, i) => v === this.objetivo[i]));
    this.objetivo = nuevo;
    this.limite = this.corto ? 9 : Math.max(8, 15 - this.hechas * 1.2);
    this.resta = this.limite;
  }

  private clic(): void {
    if (this.terminado) return;
    const p = this.puntero();
    const b = this.botones.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (b) {
      this.mio[b.cat] = b.op;
      this.malas.delete(b.cat);
      return;
    }
    const e = this.escanear;
    if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) this.comprobar();
  }

  private comprobar(): void {
    if (this.terminado) return;
    this.malas.clear();
    this.mio.forEach((v, i) => v !== this.objetivo[i] && this.malas.add(i));
    if (this.malas.size) {
      this.malasHasta = this.time.now + 1500;
      this.error(`No coincide: revisa ${[...this.malas].map((i) => CATEGORIAS[i].nombre.toLowerCase()).join(", ")}.`);
      return;
    }
    this.acierto();
    this.hechas++;
    this.nuevoCientifico();
  }

  protected tick(dt: number): void {
    if (!this.terminado) {
      this.resta -= dt;
      if (this.resta <= 0) {
        this.error("Se acabó el tiempo para ese científico.");
        this.nuevoCientifico();
      }
    }
    this.estado.setText(this.terminado ? "" : `Disfraces aprobados: ${this.hechas}`);
    this.dibujar();
  }

  private dibujar(): void {
    const g = this.g.clear();
    // Tarjeta del buscado y espejo del disfraz
    g.fillStyle(0xffd23e).fillRoundedRect(30, 108, 160, 250, 12).lineStyle(3, 0x0a0a0c).strokeRoundedRect(30, 108, 160, 250, 12);
    g.fillStyle(0x1c3350).fillRoundedRect(210, 108, 160, 250, 12).lineStyle(3, 0x7fb24a).strokeRoundedRect(210, 108, 160, 250, 12);
    cara(g, 110, 210, this.objetivo);
    cara(g, 290, 210, this.mio);
    // Tiempo para este científico
    const frac = Math.max(0, this.resta / this.limite);
    g.fillStyle(0x000000, 0.7).fillRect(30, 370, 340, 10).fillStyle(frac > 0.3 ? 0x7dff6a : 0xff4a4a).fillRect(30, 370, 340 * frac, 10);
    // Opciones
    const parpadeo = this.time.now < this.malasHasta;
    for (const b of this.botones) {
      const sel = this.mio[b.cat] === b.op;
      const mala = parpadeo && this.malas.has(b.cat) && sel;
      g.fillStyle(mala ? 0xff4a4a : sel ? 0x7fb24a : 0x24456b).fillRoundedRect(b.x, b.y, b.w, b.h, 8);
      g.lineStyle(2, sel ? 0xffffff : 0x0a0a0c).strokeRoundedRect(b.x, b.y, b.w, b.h, 8);
      if (b.cat === 3) g.fillStyle(PLACAS[b.op]).fillCircle(b.x + 12, b.y + b.h / 2, 6);
    }
    const e = this.escanear;
    g.fillStyle(0x7dff6a).fillRoundedRect(e.x, e.y, e.w, e.h, 12).lineStyle(3, 0x0a0a0c).strokeRoundedRect(e.x, e.y, e.w, e.h, 12);
  }
}

/** Dibuja una cara de científico con los rasgos [pelo, ojos, boca, placa]. */
function cara(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number[]): void {
  const [pelo, ojos, boca, placa] = r;
  // Hombros con bata y placa
  g.fillStyle(0xeef3f5).fillRoundedRect(cx - 62, cy + 62, 124, 70, 24).lineStyle(3, 0x0a0a0c).strokeRoundedRect(cx - 62, cy + 62, 124, 70, 24);
  g.fillStyle(PLACAS[placa]).fillRoundedRect(cx + 18, cy + 84, 26, 18, 4).lineStyle(2, 0x0a0a0c).strokeRoundedRect(cx + 18, cy + 84, 26, 18, 4);
  // Pelo largo (detrás de la cabeza)
  if (pelo === 1) g.fillStyle(0xf2cf4a).fillRoundedRect(cx - 50, cy - 46, 100, 112, 30).lineStyle(3, 0x0a0a0c).strokeRoundedRect(cx - 50, cy - 46, 100, 112, 30);
  // Cabeza
  g.fillStyle(0xf3cf9f).fillEllipse(cx, cy + 6, 84, 100).lineStyle(3, 0x0a0a0c).strokeEllipse(cx, cy + 6, 84, 100);
  // Pelo de arriba
  if (pelo === 0) {
    g.fillStyle(0x6b3f1f).fillEllipse(cx, cy - 30, 88, 44).lineStyle(3, 0x0a0a0c).strokeEllipse(cx, cy - 30, 88, 44);
  } else if (pelo === 1) {
    g.fillStyle(0xf2cf4a).fillEllipse(cx, cy - 32, 90, 40).lineStyle(3, 0x0a0a0c).strokeEllipse(cx, cy - 32, 90, 40);
  } else {
    g.fillStyle(0xffffff, 0.7).fillEllipse(cx - 14, cy - 28, 18, 8);
  }
  // Ojos y gafas
  g.fillStyle(0x0a0a0c).fillCircle(cx - 16, cy + 2, 4).fillCircle(cx + 16, cy + 2, 4);
  g.lineStyle(4, 0x0a0a0c);
  if (ojos === 1) g.strokeCircle(cx - 16, cy + 2, 12).strokeCircle(cx + 16, cy + 2, 12).lineBetween(cx - 4, cy + 2, cx + 4, cy + 2);
  if (ojos === 2) g.strokeRect(cx - 30, cy - 8, 26, 20).strokeRect(cx + 4, cy - 8, 26, 20);
  // Boca
  g.lineStyle(4, 0x0a0a0c);
  if (boca === 0) {
    g.fillStyle(0x4a2a12).fillEllipse(cx, cy + 24, 40, 12);
    g.lineBetween(cx - 10, cy + 36, cx + 10, cy + 36);
  } else if (boca === 1) {
    g.beginPath().arc(cx, cy + 26, 14, 0.2, Math.PI - 0.2).strokePath();
  } else {
    g.lineBetween(cx - 14, cy + 34, cx + 14, cy + 34);
  }
}
