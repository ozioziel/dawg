// Base de los minijuegos: panel centrado, título, tiempo restante y aviso de fallo.
import { PUZZLES, type PuzzleDef } from "@dawg/shared";
import Phaser from "phaser";
import type { PuzzleS } from "../../net/tipos";
import { TEXTO, TITULO, ctx, type Ctx } from "../contexto";
import { sfx } from "../sonido";

export abstract class Minijuego extends Phaser.Scene {
  c!: Ctx;
  id = "";
  def!: PuzzleDef;
  /** Tamaño lógico del panel (se escala para caber en pantalla). */
  protected pw = 680;
  protected ph = 440;
  /** Si captura ratón y teclado (los paneles informativos no). */
  protected bloquea = true;
  protected cont!: Phaser.GameObjects.Container;
  protected fondo!: Phaser.GameObjects.Graphics;
  protected g!: Phaser.GameObjects.Graphics;
  protected titulo!: Phaser.GameObjects.Text;
  protected info!: Phaser.GameObjects.Text;
  protected terminado = false;
  private hpPrev = -1;

  init(data: { id: string }): void {
    this.id = data.id;
    this.def = PUZZLES[data.id];
    this.terminado = false;
    this.hpPrev = -1;
  }

  create(): void {
    this.c = ctx(this);
    if (this.bloquea) this.c.ui.minijuego = this.scene.key;
    this.cont = this.add.container(0, 0);
    this.fondo = this.add.graphics();
    this.g = this.add.graphics();
    this.titulo = this.add.text(20, 12, this.def.nombre, { ...TITULO, fontSize: "30px", color: "#3ef0ff" });
    this.info = this.add.text(this.pw - 20, 18, "", { ...TEXTO, fontSize: "16px", align: "right" }).setOrigin(1, 0);
    this.cont.add([this.fondo, this.g, this.titulo, this.info]);
    this.dibujarFondo();
    this.crear();
    this.colocar();
    this.scale.on("resize", this.colocar, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.colocar, this);
      if (this.c.ui.minijuego === this.scene.key) this.c.ui.minijuego = "";
    });
  }

  protected dibujarFondo(): void {
    this.fondo
      .clear()
      .fillStyle(0x07121c, 1)
      .fillRoundedRect(0, 0, this.pw, this.ph, 18)
      .lineStyle(4, 0x0a0a0c)
      .strokeRoundedRect(0, 0, this.pw, this.ph, 18)
      .lineStyle(2, 0x3ef0ff, 0.6)
      .strokeRoundedRect(5, 5, this.pw - 10, this.ph - 10, 14);
  }

  protected colocar(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = Math.min(1, (W - 32) / this.pw, (H - 150) / this.ph);
    this.cont.setScale(s).setPosition(W / 2 - (this.pw * s) / 2, Math.max(70, H / 2 - (this.ph * s) / 2));
  }

  /** Puntero en coordenadas del panel. */
  protected puntero(): { x: number; y: number } {
    const p = this.input.activePointer;
    return { x: (p.x - this.cont.x) / this.cont.scaleX, y: (p.y - this.cont.y) / this.cont.scaleY };
  }

  protected get pz(): PuzzleS | undefined {
    return this.c.room.state.puzzles.get(this.id);
  }

  /** 0..1 del tiempo transcurrido del puzzle. */
  protected get progreso(): number {
    const pz = this.pz;
    if (!pz || !pz.total) return 0;
    return Math.max(0, Math.min(1, 1 - pz.tiempo / pz.total));
  }

  protected get corto(): boolean {
    return this.def.tipo === "nucleo";
  }

  /** Vida perdida desde el último cuadro (para castigar golpes recibidos). */
  protected golpeRecibido(): number {
    const me = this.c.room.state.jugadores.get(this.c.room.sessionId);
    if (!me) return 0;
    const d = this.hpPrev >= 0 ? Math.max(0, this.hpPrev - me.hp) : 0;
    this.hpPrev = me.hp;
    return d;
  }

  protected fallar(razon: string): void {
    if (this.terminado) return;
    this.terminado = true;
    this.c.room.send("mg", { id: this.id, ev: "fallo", razon });
    sfx.nota(false);
    const t = this.add.text(this.pw / 2, this.ph / 2, "¡FALLO!", { ...TITULO, fontSize: "72px", color: "#ff4a4a" }).setOrigin(0.5);
    this.cont.add(t);
  }

  override update(_t: number, delta: number): void {
    const pz = this.pz;
    if (!pz) return;
    if (pz.estado === "activo") this.info.setText(`${Math.ceil(pz.tiempo)} s`);
    this.tick(Math.min(delta, 50) / 1000, pz);
  }

  protected abstract crear(): void;
  protected abstract tick(dt: number, pz: PuzzleS): void;
}
