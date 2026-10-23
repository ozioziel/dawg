// Consola de la Sala de rayos: muestra el código solo al Cambiaformas disfrazado.
// No bloquea el movimiento: es un panel informativo al lado de la pantalla.
import { RAYOS_SIMBOLOS } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO } from "../contexto";
import { Minijuego } from "./Minijuego";

export class MgRayos extends Minijuego {
  private iconos: Phaser.GameObjects.Image[] = [];
  private nombres: Phaser.GameObjects.Text[] = [];
  private estado!: Phaser.GameObjects.Text;
  private ultimo = "";

  constructor() {
    super("MgRayos");
    this.bloquea = false;
    this.pw = 360;
    this.ph = 300;
  }

  protected override colocar(): void {
    const W = this.scale.width;
    const s = Math.min(1, (W * 0.4) / this.pw);
    this.cont.setScale(s).setPosition(W - this.pw * s - 16, 230);
  }

  protected crear(): void {
    this.titulo.setText("Código (solo humanos)").setFontSize(24);
    this.estado = this.add.text(this.pw / 2, this.ph - 14, "", { ...TEXTO, fontSize: "13px", color: "#a9c6db", align: "center", wordWrap: { width: this.pw - 30 } }).setOrigin(0.5, 1);
    this.cont.add(this.estado);
  }

  protected tick(_dt: number, pz: PuzzleS): void {
    if (pz.datos === this.ultimo) return;
    this.ultimo = pz.datos;
    let d: { ronda: number; sec: number[]; idx: number };
    try {
      d = JSON.parse(pz.datos);
    } catch {
      return;
    }
    for (const i of this.iconos) i.destroy();
    for (const t of this.nombres) t.destroy();
    this.iconos = [];
    this.nombres = [];
    const n = d.sec.length;
    const porFila = Math.min(n, 4);
    d.sec.forEach((s, k) => {
      const fila = Math.floor(k / porFila);
      const col = k % porFila;
      const enFila = Math.min(porFila, n - fila * porFila);
      const x = this.pw / 2 + (col - (enFila - 1) / 2) * 80;
      const y = 92 + fila * 92;
      const img = this.add.image(x, y, "interruptor", s).setScale(0.9).setAlpha(k < d.idx ? 0.3 : 1);
      const t = this.add
        .text(x, y + 34, `${k + 1}. ${RAYOS_SIMBOLOS[s].nombre}${k < d.idx ? " ✔" : ""}`, { ...TEXTO, fontSize: "13px", color: RAYOS_SIMBOLOS[s].color })
        .setOrigin(0.5, 0);
      if (k === d.idx) img.setScale(1.05);
      this.iconos.push(img);
      this.nombres.push(t);
      this.cont.add([img, t]);
    });
    this.estado.setText(
      `Ronda ${d.ronda}/3 · ${pz.solo ? "Memorízalo y actívalo tú con telequinesis en los interruptores." : "Díctale el orden a tu compañero (Enter para chatear)."}`,
    );
  }
}
