// Teclado de seguridad del Inspector (Cambiaformas): marca el código de colores que viste
// en su consola. Funciona con clic, toque o las teclas 1-5.
import { CODIGO_COLORES } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

export class MgCodigo extends Minijuego {
  private entrada: number[] = [];
  private largo = 4;
  private enviado = false;

  constructor() {
    super("MgCodigo");
    this.cuentaGolpes = false;
    this.muestraErrores = false;
    this.pw = 560;
    this.ph = 360;
  }

  protected crear(): void {
    this.entrada = [];
    this.enviado = false;
    this.titulo.setText("Teclado de seguridad");
    try {
      this.largo = JSON.parse(this.pz?.datos || "{}").largo ?? 4;
    } catch {
      this.largo = 4;
    }
    this.add
      .text(this.pw / 2, 70, "Marca el código de colores de la consola del Inspector", { ...TEXTO, fontSize: "16px", color: "#a9c6db" })
      .setOrigin(0.5)
      .setDepth(1);
    const ancho = 88;
    CODIGO_COLORES.forEach((c, i) => {
      const x = this.pw / 2 + (i - (CODIGO_COLORES.length - 1) / 2) * (ancho + 10);
      const col = Phaser.Display.Color.HexStringToColor(c.color).color;
      const b = this.add.rectangle(x, 250, ancho, 70, col).setStrokeStyle(4, 0x0a0a0c).setInteractive({ useHandCursor: true });
      const t = this.add.text(x, 250, `${i + 1}`, { ...TEXTO, fontSize: "22px" }).setOrigin(0.5);
      b.on("pointerdown", () => this.pulsar(i));
      this.cont.add([b, t]);
    });
    const borrar = this.add.text(this.pw / 2 - 90, 322, "BORRAR", { ...TEXTO, fontSize: "16px", backgroundColor: "#3a2a2a", padding: { x: 12, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    borrar.on("pointerdown", () => (this.entrada = []));
    const salir = this.add.text(this.pw / 2 + 90, 322, "SALIR", { ...TEXTO, fontSize: "16px", backgroundColor: "#2a2a3a", padding: { x: 12, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    salir.on("pointerdown", () => this.c.room.send("mg", { id: this.id, ev: "fallo", razon: "Saliste del teclado." }));
    this.cont.add([borrar, salir]);
    ["ONE", "TWO", "THREE", "FOUR", "FIVE"].forEach((k, i) => this.input.keyboard!.on(`keydown-${k}`, () => this.pulsar(i)));
    this.input.keyboard!.on("keydown-BACKSPACE", () => this.entrada.pop());
  }

  private pulsar(i: number): void {
    if (this.enviado || this.entrada.length >= this.largo) return;
    this.entrada.push(i);
    sfx.clic();
    if (this.entrada.length === this.largo) {
      this.enviado = true;
      this.c.room.send("mg", { id: this.id, ev: "codigo", codigo: this.entrada });
    }
  }

  protected tick(_dt: number, _pz: PuzzleS): void {
    const g = this.g.clear();
    const w = 64;
    for (let i = 0; i < this.largo; i++) {
      const x = this.pw / 2 + (i - (this.largo - 1) / 2) * (w + 14) - w / 2;
      g.fillStyle(0x000000, 0.6).fillRoundedRect(x, 110, w, 64, 10).lineStyle(3, 0x3ef0ff, 0.7).strokeRoundedRect(x, 110, w, 64, 10);
      const k = this.entrada[i];
      if (k !== undefined) g.fillStyle(Phaser.Display.Color.HexStringToColor(CODIGO_COLORES[k].color).color, 1).fillRoundedRect(x + 6, 116, w - 12, 52, 8);
    }
  }
}
