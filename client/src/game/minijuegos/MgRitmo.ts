// Calibración rítmica del bio-reactor (Del Mar): notas que caen por cuatro carriles y hay que
// pulsar al llegar a la línea (D F J K, clic o toque). Inspirado en juegos de ritmo, con contenido propio.
import { RITMO } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO, TITULO, tiempoServidor } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

const COLORES = [0xff8a3a, 0x3ec0ff, 0x7dff6a, 0xffd23e];
const TECLAS = ["D", "F", "J", "K"];

interface Nota {
  t: number;
  l: number;
  hecha: boolean;
}

export class MgRitmo extends Minijuego {
  private notas: Nota[] = [];
  private inicio = 0;
  private caida = RITMO.caida;
  private aciertos = 0;
  private fallos = 0;
  private enviado = false;
  private marcador!: Phaser.GameObjects.Text;
  private destello: number[] = [0, 0, 0, 0];
  private raw = "";

  constructor() {
    super("MgRitmo");
    this.cuentaGolpes = false;
    this.muestraErrores = false;
    this.pw = 520;
    this.ph = 520;
  }

  protected crear(): void {
    this.titulo.setText("Calibración rítmica");
    this.marcador = this.add.text(this.pw / 2, this.ph - 26, "", { ...TEXTO, fontSize: "16px", color: "#ffd23e" }).setOrigin(0.5);
    this.cont.add(this.marcador);
    this.aciertos = 0;
    this.fallos = 0;
    this.enviado = false;
    this.raw = "";
    TECLAS.forEach((k, i) => {
      this.input.keyboard!.on(`keydown-${k}`, () => this.pulsar(i));
      const x = this.carrilX(i);
      const zona = this.add.rectangle(x, this.lineaY(), 96, 90, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      zona.on("pointerdown", () => this.pulsar(i));
      const t = this.add.text(x, this.lineaY() + 52, k, { ...TITULO, fontSize: "26px", color: "#" + COLORES[i].toString(16) }).setOrigin(0.5);
      this.cont.add([zona, t]);
    });
  }

  private carrilX(i: number): number {
    return this.pw / 2 + (i - 1.5) * 104;
  }

  private lineaY(): number {
    return this.ph - 120;
  }

  private cargar(pz: PuzzleS): void {
    if (pz.datos === this.raw) return;
    this.raw = pz.datos;
    try {
      const d = JSON.parse(pz.datos) as { semilla: number; notas: number; inicio: number; caida: number };
      this.inicio = d.inicio;
      this.caida = d.caida;
      // Secuencia reproducible a partir de la semilla del servidor.
      let s = d.semilla >>> 0 || 1;
      const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
      const n = d.notas;
      const span = RITMO.duracion - 6;
      this.notas = [];
      let t = 1;
      for (let i = 0; i < n; i++) {
        t += span / n + (rnd() - 0.5) * 0.25;
        this.notas.push({ t, l: Math.floor(rnd() * 4), hecha: false });
      }
    } catch {
      this.notas = [];
    }
  }

  private pulsar(l: number): void {
    if (this.enviado) return;
    const ahora = tiempoServidor() - this.inicio;
    const n = this.notas.find((x) => !x.hecha && x.l === l && Math.abs(x.t - ahora) <= RITMO.ventana);
    this.destello[l] = 0.2;
    if (n) {
      n.hecha = true;
      this.aciertos++;
      sfx.nota(true);
    } else {
      this.fallos++;
      sfx.nota(false);
    }
  }

  protected tick(dt: number, pz: PuzzleS): void {
    this.cargar(pz);
    const ahora = tiempoServidor() - this.inicio;
    const g = this.g.clear();
    const y0 = 80;
    const yL = this.lineaY();
    for (let i = 0; i < 4; i++) {
      const x = this.carrilX(i);
      g.fillStyle(0x0c1c28, 1).fillRect(x - 46, y0, 92, yL - y0 + 40);
      this.destello[i] = Math.max(0, this.destello[i] - dt);
      g.lineStyle(4, COLORES[i], 0.5 + this.destello[i] * 2.5).strokeCircle(x, yL, 34);
    }
    g.lineStyle(3, 0xffffff, 0.6).lineBetween(this.carrilX(0) - 50, yL, this.carrilX(3) + 50, yL);
    for (const n of this.notas) {
      if (n.hecha) continue;
      if (ahora - n.t > RITMO.ventana) {
        n.hecha = true;
        this.fallos++;
        continue;
      }
      const k = 1 - (n.t - ahora) / this.caida;
      if (k < 0) continue;
      const y = y0 + (yL - y0) * k;
      g.fillStyle(COLORES[n.l], 1).fillCircle(this.carrilX(n.l), y, 24).lineStyle(3, 0x0a0a0c).strokeCircle(this.carrilX(n.l), y, 24);
    }
    const total = this.notas.length;
    this.marcador.setText(ahora < 0 ? "¡Prepárate!" : `Aciertos ${this.aciertos}/${total} · hace falta ${Math.round(RITMO.minimo * 100)}%`);
    if (!this.enviado && total && this.notas.every((n) => n.hecha) && ahora > this.notas[total - 1].t + 0.5) {
      this.enviado = true;
      this.c.room.send("mg", { id: this.id, ev: "ritmo", aciertos: this.aciertos, total });
    }
  }
}
