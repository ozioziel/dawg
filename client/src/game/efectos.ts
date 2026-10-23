// Efectos visuales que el servidor anuncia (explosiones, hielo, transmutar…).
import type { FxEvent } from "@dawg/shared";
import Phaser from "phaser";
import { ALTURA, TITULO, prof } from "./contexto";
import { sfx } from "./sonido";

export class Efectos {
  constructor(private s: Phaser.Scene) {}

  private cerca(x: number, y: number): number {
    const cam = this.s.cameras.main;
    const d = Phaser.Math.Distance.Between(x, y, cam.midPoint.x, cam.midPoint.y);
    return Phaser.Math.Clamp(1.4 - d / 900, 0, 1);
  }

  private chispas(x: number, y: number, color: number, n: number, vel = 220, vida = 400, tam = 0.5): void {
    const e = this.s.add.particles(x, y, "particula", {
      speed: { min: vel * 0.3, max: vel },
      angle: { min: 0, max: 360 },
      lifespan: vida,
      scale: { start: tam, end: 0 },
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    e.setDepth(prof(y) + 500);
    e.explode(n);
    this.s.time.delayedCall(vida + 100, () => e.destroy());
  }

  private anillo(x: number, y: number, color: number, r: number, dur = 450): void {
    const c = this.s.add.circle(x, y, 10).setStrokeStyle(5, color).setDepth(prof(y) + 400);
    this.s.tweens.add({ targets: c, radius: r, alpha: 0, duration: dur, ease: "Cubic.Out", onComplete: () => c.destroy() });
  }

  private texto(x: number, y: number, t: string, color: string): void {
    const tx = this.s.add.text(x, y - 60, t, { ...TITULO, fontSize: "28px", color }).setOrigin(0.5).setDepth(prof(y) + 900);
    this.s.tweens.add({ targets: tx, y: y - 110, alpha: 0, duration: 1200, ease: "Cubic.Out", onComplete: () => tx.destroy() });
  }

  private rayo(x: number, y: number, x2: number, y2: number, color: number): void {
    const g = this.s.add.graphics().setDepth(prof(Math.max(y, y2)) + 300).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10, color, 0.35).lineBetween(x, y - ALTURA, x2, y2 - ALTURA);
    g.lineStyle(4, 0xffffff, 0.9).lineBetween(x, y - ALTURA, x2, y2 - ALTURA);
    this.s.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
  }

  play(e: FxEvent): void {
    const v = this.cerca(e.x, e.y);
    const c = e.c ?? 0xffffff;
    switch (e.t) {
      case "explosion": {
        const r = e.r ?? 110;
        const img = this.s.add.image(e.x, e.y - 10, "chispa").setTint(0xffb020).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(e.y) + 600).setScale(1);
        this.s.tweens.add({ targets: img, scale: r / 6, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => img.destroy() });
        this.chispas(e.x, e.y - 10, 0xff7a1a, 26, r * 3, 600, 0.9);
        this.anillo(e.x, e.y, 0xffd23e, r);
        if (v > 0) {
          this.s.cameras.main.shake(220, 0.006 * v);
          sfx.explosion();
        }
        break;
      }
      case "impacto":
        this.chispas(e.x, e.y - ALTURA, c, 6, 160, 220, 0.35);
        if (v > 0.3) sfx.impacto();
        break;
      case "chispa":
        this.chispas(e.x, e.y - 10, 0xfff4a0, 10, 200, 300, 0.4);
        break;
      case "llamas": {
        const x2 = e.x2 ?? e.x;
        const y2 = e.y2 ?? e.y;
        for (let i = 0; i < 4; i++) {
          const k = Math.random();
          const f = this.s.add.image(e.x + (x2 - e.x) * k * 0.3, e.y - ALTURA + (y2 - e.y) * k * 0.3, "llama").setDepth(prof(e.y) + 200).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
          this.s.tweens.add({ targets: f, x: e.x + (x2 - e.x) * (0.7 + k * 0.4) + Phaser.Math.Between(-20, 20), y: e.y - ALTURA + (y2 - e.y) * (0.7 + k * 0.4) + Phaser.Math.Between(-20, 20), scale: 1.3, alpha: 0, duration: 380, onComplete: () => f.destroy() });
        }
        if (v > 0.3) sfx.llamas();
        break;
      }
      case "hielo":
        this.chispas(e.x, e.y, 0xbfeaff, 18, 260, 500, 0.6);
        this.anillo(e.x, e.y, 0x6fd6ff, e.r ?? 60);
        if (v > 0) sfx.hielo();
        break;
      case "acido":
        this.chispas(e.x, e.y, 0x8dff4a, 14, 180, 450, 0.5);
        if (v > 0) sfx.chapoteo();
        break;
      case "gas":
        this.chispas(e.x, e.y, 0xc08bff, 14, 140, 600, 0.7);
        if (v > 0) sfx.chapoteo();
        break;
      case "transmutar":
        if (e.x2 !== undefined && e.y2 !== undefined) this.rayo(e.x2, e.y2, e.x, e.y, c);
        this.chispas(e.x, e.y - 20, c, 22, 200, 550, 0.6);
        this.anillo(e.x, e.y, c, 70);
        if (v > 0) sfx.transmutar();
        break;
      case "telequinesis":
        if (e.x2 !== undefined && e.y2 !== undefined) this.rayo(e.x, e.y, e.x2, e.y2, 0xc08bff);
        this.anillo(e.x, e.y, 0xc08bff, 60);
        if (v > 0) sfx.telequinesis();
        break;
      case "muerte":
        this.chispas(e.x, e.y - 30, c, 20, 240, 500, 0.6);
        if (v > 0) sfx.muerte();
        break;
      case "alma":
        this.chispas(e.x, e.y - 30, 0xffffff, 20, 180, 700, 0.5);
        this.anillo(e.x, e.y, 0xffffff, 60);
        if (v > 0) sfx.alma();
        break;
      case "rescate":
        this.anillo(e.x, e.y, c === 0xffffff ? 0x7dff6a : c, 70);
        this.chispas(e.x, e.y - 30, c === 0xffffff ? 0x7dff6a : c, 10, 140, 500, 0.4);
        break;
      case "ladrido":
        this.texto(e.x, e.y, "¡GUAU!", "#ffd23e");
        if (v > 0) sfx.ladrido();
        break;
      case "revelado":
        this.texto(e.x, e.y, "¡DESCUBIERTO!", "#ff4a4a");
        this.chispas(e.x, e.y - 30, 0x7fb24a, 16, 200, 500, 0.5);
        break;
      case "nucleo":
        this.s.cameras.main.flash(400, 255, 140, 60);
        this.s.cameras.main.shake(500, 0.01);
        sfx.explosion();
        break;
    }
  }
}
