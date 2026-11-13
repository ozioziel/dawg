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

  /** Tierra que levanta el Escarabajo bajo el suelo. */
  tierra(x: number, y: number): void {
    this.chispas(x + (Math.random() - 0.5) * 30, y, 0x8a6a3a, 3, 90, 380, 0.35);
  }

  /** Partículas del chorro de hielo de Freeze. */
  chorro(x: number, y: number, ang: number): void {
    for (let i = 0; i < 2; i++) {
      const a = ang + (Math.random() - 0.5) * 0.45;
      const largo = 160 + Math.random() * 60;
      const p = this.s.add
        .image(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30, "particula")
        .setTint(Math.random() < 0.5 ? 0xbfeaff : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.6)
        .setDepth(prof(y + ALTURA) + 60);
      this.s.tweens.add({ targets: p, x: x + Math.cos(a) * largo, y: y + Math.sin(a) * largo, scale: 2.2, alpha: 0, duration: 320, onComplete: () => p.destroy() });
    }
    if (Math.random() < 0.3) sfx.hielo(0.35);
  }

  private linea(x: number, y: number, x2: number, y2: number, color: number, ancho: number, dur: number): void {
    const g = this.s.add.graphics().setDepth(prof(Math.max(y, y2)) + 300).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(ancho * 2.4, color, 0.3).lineBetween(x, y - ALTURA, x2, y2 - ALTURA);
    g.lineStyle(ancho, color, 1).lineBetween(x, y - ALTURA, x2, y2 - ALTURA);
    this.s.tweens.add({ targets: g, alpha: 0, duration: dur, onComplete: () => g.destroy() });
  }

  private arco(x: number, y: number, ang: number, color: number, r = 46): void {
    const g = this.s.add.graphics().setDepth(prof(y) + 300).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(7, color, 0.9).beginPath().arc(x, y - ALTURA, r, ang - 0.9, ang + 0.9).strokePath();
    this.s.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
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
      case "tajo":
        this.arco(e.x, e.y, e.r ?? 0, c, 40);
        if (v > 0) sfx.tajo();
        break;
      case "mordida":
        this.arco(e.x, e.y, e.r ?? 0, c, 30);
        this.chispas(e.x, e.y - ALTURA, c, 10, 160, 300, 0.4);
        if (v > 0) sfx.mordida();
        break;
      case "teleport":
        this.chispas(e.x, e.y - 30, 0x7a5cff, 18, 200, 420, 0.6);
        if (e.x2 !== undefined && e.y2 !== undefined) {
          this.chispas(e.x2, e.y2 - 30, 0x7a5cff, 18, 200, 420, 0.6);
          this.linea(e.x, e.y, e.x2, e.y2, c, 3, 220);
        }
        if (v > 0) sfx.teleport();
        break;
      case "excavar":
        this.chispas(e.x, e.y, 0x8a6a3a, 18, 200, 500, 0.6);
        if (v > 0) sfx.escarabajo();
        break;
      case "emerger":
        this.chispas(e.x, e.y, 0x8a6a3a, 26, 280, 600, 0.8);
        this.anillo(e.x, e.y, 0xa8c84a, e.r ?? 90);
        this.s.cameras.main.shake(140, 0.004 * v);
        if (v > 0) sfx.escarabajo(true);
        break;
      case "congelar":
        this.chispas(e.x, e.y - 30, 0xbfeaff, 14, 160, 500, 0.5);
        this.texto(e.x, e.y, "¡CONGELADO!", "#bfeaff");
        if (v > 0) sfx.hielo();
        break;
      case "devorar":
        this.chispas(e.x, e.y - 20, 0x5fd068, 18, 180, 500, 0.6);
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0x7dff6a, 4, 260);
        if (v > 0) sfx.mordida();
        break;
      case "curar":
        this.anillo(e.x, e.y, 0x7dff6a, e.r ?? 60);
        this.chispas(e.x, e.y - 40, 0x7dff6a, 10, 120, 600, 0.45);
        if (v > 0) sfx.curar();
        break;
      case "infectar":
        this.chispas(e.x, e.y - 30, 0xd36be8, 16, 160, 500, 0.5);
        this.texto(e.x, e.y, "INFECTADO", "#e6a8ff");
        if (v > 0) sfx.simbionte();
        break;
      case "asimilar":
      case "absorber":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0xd36be8, 5, 320);
        this.chispas(e.x, e.y - 30, 0xd36be8, 20, 200, 500, 0.6);
        if (v > 0) sfx.simbionte(true);
        break;
      case "escaneo":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x2, e.y2, e.x, e.y, 0x7fb24a, 3, 1000);
        if (v > 0) sfx.escaneo();
        break;
      case "disfraz":
        this.chispas(e.x, e.y - 40, 0x7fb24a, 22, 200, 500, 0.6);
        if (v > 0) sfx.transmutar();
        break;
      case "berserk":
        this.anillo(e.x, e.y, 0x9cff5a, 120);
        this.chispas(e.x, e.y - 40, 0x9cff5a, 30, 260, 600, 0.8);
        if (e.r) this.s.cameras.main.shake(260, 0.008 * v);
        if (v > 0) sfx.rugido();
        break;
      case "singularidad":
        this.anillo(e.x, e.y, 0xc08bff, e.r ?? 300, 900);
        if (v > 0) sfx.singularidad();
        break;
      case "kraken":
        this.anillo(e.x, e.y, 0x3ec0ff, e.r ?? 120, 700);
        this.chispas(e.x, e.y - 20, 0x7dd8ff, 24, 220, 700, 0.6);
        if (v > 0) sfx.chapoteo();
        break;
      case "jardin":
        this.anillo(e.x, e.y, 0x5fd068, e.r ?? 300, 800);
        this.chispas(e.x, e.y, 0x7dff6a, 30, 260, 800, 0.7);
        if (v > 0) sfx.curar();
        break;
      case "eclipse":
        this.s.cameras.main.flash(500, 40, 10, 80);
        sfx.eclipse();
        break;
      case "cero":
        this.s.cameras.main.flash(400, 190, 240, 255);
        this.anillo(e.x, e.y, 0xbfeaff, Math.min(1400, e.r ?? 700), 700);
        sfx.hielo();
        sfx.hielo(1, 0.15);
        break;
      case "fusion":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0xd36be8, 6, 400);
        this.chispas(e.x, e.y - 40, 0xd36be8, 30, 260, 700, 0.8);
        if (e.r) {
          this.s.cameras.main.shake(300, 0.008 * v);
          sfx.simbionte(true);
        }
        break;
      case "tentaculo":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, c, 7, 260);
        if (v > 0.2) sfx.simbionte();
        break;
      case "tunel":
        this.chispas(e.x, e.y, 0x8a6a3a, 16, 200, 500, 0.6);
        if (e.x2 !== undefined && e.y2 !== undefined) this.chispas(e.x2, e.y2, 0x8a6a3a, 16, 200, 500, 0.6);
        if (v > 0) sfx.escarabajo();
        break;
      case "laser":
        this.s.cameras.main.flash(250, 120, 255, 120);
        this.texto(e.x, e.y, "¡1 HP!", "#7dff6a");
        sfx.laser();
        break;
      case "agarre":
        this.texto(e.x, e.y, "¡ATRAPADO!", "#ff4a4a");
        if (v > 0) sfx.cazador();
        break;
      case "texto":
        this.texto(e.x, e.y, e.s ?? "", "#" + (e.c ?? 0xffffff).toString(16).padStart(6, "0"));
        break;
      case "reaparecer":
        this.anillo(e.x, e.y, c, 90);
        this.chispas(e.x, e.y - 40, 0xffffff, 26, 200, 700, 0.6);
        sfx.alma();
        break;
      case "mejora":
        this.texto(e.x, e.y - 30, e.s ?? "¡Mejora!", "#ffd23e");
        sfx.aviso("exito");
        break;
      case "alarma":
        this.anillo(e.x, e.y, 0xff3030, 140);
        if (v > 0) sfx.aviso("peligro");
        break;
    }
  }
}
