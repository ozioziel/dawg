// Base de los minijuegos: panel centrado, título, tiempo restante y contador de errores.
// Reglas comunes: se permiten ERRORES_PERMITIDOS errores; con uno más, falla.
// Recibir un golpe cuenta como un error (como mucho uno cada 1,5 s).
import { ERRORES_PERMITIDOS, PUZZLES, type PuzzleDef } from "@dawg/shared";
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
  /** Si los golpes recibidos cuentan como error. */
  protected cuentaGolpes = true;
  /** Si se dibuja el contador de errores del propio minijuego. */
  protected muestraErrores = true;
  protected cont!: Phaser.GameObjects.Container;
  protected fondo!: Phaser.GameObjects.Graphics;
  protected g!: Phaser.GameObjects.Graphics;
  protected titulo!: Phaser.GameObjects.Text;
  protected info!: Phaser.GameObjects.Text;
  protected terminado = false;
  protected errores = 0;
  private gErr!: Phaser.GameObjects.Graphics;
  private avisoErr!: Phaser.GameObjects.Text;
  private avisoHasta = 0;
  private hpPrev = -1;
  private ultimoGolpe = -99;

  init(data: { id: string }): void {
    this.id = data.id;
    this.def = PUZZLES[data.id];
    this.terminado = false;
    this.errores = 0;
    this.hpPrev = -1;
    this.ultimoGolpe = -99;
  }

  create(): void {
    this.c = ctx(this);
    if (this.bloquea) this.c.ui.minijuego = this.scene.key;
    this.cont = this.add.container(0, 0);
    this.fondo = this.add.graphics();
    this.g = this.add.graphics();
    this.gErr = this.add.graphics();
    this.titulo = this.add.text(20, 12, this.def.nombre, { ...TITULO, fontSize: "30px", color: "#3ef0ff" });
    this.info = this.add.text(this.pw - 20, 14, "", { ...TEXTO, fontSize: "16px", align: "right" }).setOrigin(1, 0);
    this.avisoErr = this.add.text(this.pw / 2, 58, "", { ...TEXTO, fontSize: "18px", color: "#ff6a6a" }).setOrigin(0.5);
    this.cont.add([this.fondo, this.g, this.gErr, this.titulo, this.info, this.avisoErr]);
    this.dibujarFondo();
    this.crear();
    this.cont.bringToTop(this.avisoErr);
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

  /** Versión corta (estaciones del núcleo). */
  protected get corto(): boolean {
    return this.def.tipo === "nucleo";
  }

  /** Vida perdida desde el último cuadro. */
  private golpeRecibido(): number {
    const me = this.c.room.state.jugadores.get(this.c.room.sessionId);
    if (!me) return 0;
    const d = this.hpPrev >= 0 ? Math.max(0, this.hpPrev - me.hp) : 0;
    this.hpPrev = me.hp;
    return d;
  }

  /** Suma un error; con más de ERRORES_PERMITIDOS, el minijuego falla. */
  protected error(motivo: string): void {
    if (this.terminado) return;
    this.errores++;
    sfx.nota(false);
    this.cameras.main.shake(110, 0.004);
    if (this.errores > ERRORES_PERMITIDOS) {
      this.fallar(motivo);
      return;
    }
    this.avisoErr.setText(`✖ ${motivo}`);
    this.avisoHasta = this.time.now + 1600;
  }

  protected acierto(): void {
    sfx.nota(true);
  }

  protected fallar(razon: string): void {
    if (this.terminado) return;
    this.terminado = true;
    this.c.room.send("mg", { id: this.id, ev: "fallo", razon });
    sfx.nota(false);
    this.avisoErr.setText("");
    const t = this.add.text(this.pw / 2, this.ph / 2, "¡FALLO!", { ...TITULO, fontSize: "72px", color: "#ff4a4a" }).setOrigin(0.5);
    this.cont.add(t);
  }

  override update(_t: number, delta: number): void {
    const pz = this.pz;
    if (!pz) return;
    if (pz.estado === "activo") this.info.setText(`${Math.ceil(pz.tiempo)} s`);
    if (this.cuentaGolpes && this.golpeRecibido() > 0 && this.time.now - this.ultimoGolpe > 1500) {
      this.ultimoGolpe = this.time.now;
      this.error("¡Te golpearon! Que te defiendan.");
    }
    if (this.avisoHasta && this.time.now > this.avisoHasta) {
      this.avisoErr.setText("");
      this.avisoHasta = 0;
    }
    if (this.muestraErrores) this.dibujarErrores();
    this.tick(Math.min(delta, 50) / 1000, pz);
  }

  /** Corazones: los que quedan antes de fallar. */
  private dibujarErrores(): void {
    const g = this.gErr.clear();
    const x0 = this.pw - 22 - ERRORES_PERMITIDOS * 22;
    for (let i = 0; i < ERRORES_PERMITIDOS; i++) {
      const vivo = i >= this.errores;
      g.fillStyle(vivo ? 0x7dff6a : 0x3a2a2a, 1).fillCircle(x0 + i * 22 + 10, 46, 7).lineStyle(2, 0x0a0a0c).strokeCircle(x0 + i * 22 + 10, 46, 7);
    }
  }

  protected abstract crear(): void;
  protected abstract tick(dt: number, pz: PuzzleS): void;
}
