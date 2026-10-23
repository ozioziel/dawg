// Representación visual de personajes (aliens, enemigos, pulpos) con sombra, arma y barra de vida.
import Phaser from "phaser";
import { ALTURA, PROF_UI_MUNDO, TEXTO, prof } from "./contexto";

export const ESCALA = 0.74;
const PIES = 118 / 128;

const ARMAS: Record<string, { k: string; dist: number; escala: number }> = {
  cambiaformas: { k: "pistola", dist: 10, escala: 0.8 },
  cambiaformas_humano: { k: "pistola", dist: 10, escala: 0.8 },
  delmar: { k: "lanza", dist: -8, escala: 0.72 },
  fusilero: { k: "rifle", dist: 6, escala: 0.8 },
  lanzarredes: { k: "arma_red", dist: 6, escala: 0.8 },
  lanzallamas: { k: "arma_llamas", dist: 6, escala: 0.85 },
  francotirador: { k: "rifle_franco", dist: 0, escala: 0.8 },
};

type Dir = "down" | "up" | "side";

export class VistaPersonaje {
  readonly sombra: Phaser.GameObjects.Image;
  readonly cuerpo: Phaser.GameObjects.Sprite;
  arma?: Phaser.GameObjects.Image;
  escudo?: Phaser.GameObjects.Image;
  etiqueta?: Phaser.GameObjects.Text;
  readonly barra: Phaser.GameObjects.Graphics;
  overlay?: Phaser.GameObjects.Image;
  aura?: Phaser.GameObjects.Image;
  private sheet = "";
  private dir: Dir = "down";
  private anim = "";
  rx = 0;
  ry = 0;
  private px = 0;
  private py = 0;
  private flash = 0;
  private ultimoHp = -1;
  readonly escala: number;

  constructor(
    private s: Phaser.Scene,
    sheet: string,
    x: number,
    y: number,
    opts: { nombre?: string; color?: number; escala?: number } = {},
  ) {
    this.escala = (opts.escala ?? 1) * ESCALA;
    this.rx = this.px = x;
    this.ry = this.py = y;
    this.sombra = s.add.image(x, y, "sombra").setScale(this.escala * 0.75, this.escala * 0.8).setAlpha(0.8);
    this.cuerpo = s.add.sprite(x, y, sheet, 0).setOrigin(0.5, PIES).setScale(this.escala);
    this.barra = s.add.graphics();
    if (opts.nombre) {
      const col = opts.color !== undefined ? "#" + opts.color.toString(16).padStart(6, "0") : "#ffffff";
      this.etiqueta = s.add.text(x, y, opts.nombre, { ...TEXTO, fontSize: "14px", color: col }).setOrigin(0.5, 1);
    }
    this.setSheet(sheet);
  }

  setSheet(sheet: string): void {
    if (sheet === this.sheet) return;
    this.sheet = sheet;
    this.anim = "";
    this.cuerpo.setTexture(sheet, 0);
    this.arma?.destroy();
    this.arma = undefined;
    const a = ARMAS[sheet];
    if (a) this.arma = this.s.add.image(0, 0, a.k).setOrigin(0.18, 0.5).setScale(a.escala);
    if (sheet === "escudo" && !this.escudo) this.escudo = this.s.add.image(0, 0, "escudo_frontal").setScale(0.75);
  }

  quitarEscudo(): void {
    this.escudo?.destroy();
    this.escudo = undefined;
  }

  /** Suaviza la posición hacia el objetivo (para entidades remotas). */
  seguir(tx: number, ty: number, dt: number): void {
    if (Math.abs(tx - this.rx) + Math.abs(ty - this.ry) > 160) {
      this.rx = tx;
      this.ry = ty;
    } else {
      const k = Math.min(1, dt * 14);
      this.rx += (tx - this.rx) * k;
      this.ry += (ty - this.ry) * k;
    }
  }

  golpe(): void {
    this.flash = 0.12;
  }

  actualizar(ang: number, moviendo: boolean | null, dt: number, hp?: number, maxHp?: number): void {
    const x = this.rx;
    const y = this.ry;
    const mov = moviendo ?? Math.hypot(x - this.px, y - this.py) > 0.4;
    this.px = x;
    this.py = y;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const dir: Dir = Math.abs(c) > Math.abs(sn) * 0.9 ? "side" : sn > 0 ? "down" : "up";
    this.dir = dir;
    const d = dir === "down" ? 0 : dir === "up" ? 1 : 2;
    this.cuerpo.setFlipX(dir === "side" && c < 0);
    const key = `${this.sheet}-${dir}-caminar`;
    if (mov) {
      if (this.anim !== key) {
        this.cuerpo.play(key);
        this.anim = key;
      }
    } else if (this.anim !== "" || Number(this.cuerpo.frame.name) !== d * 3) {
      this.cuerpo.stop();
      this.anim = "";
      this.cuerpo.setFrame(d * 3);
    }
    this.cuerpo.setPosition(x, y).setDepth(prof(y));
    this.sombra.setPosition(x, y + 2).setDepth(prof(y) - 30);
    if (this.flash > 0) {
      this.flash -= dt;
      this.cuerpo.setTintFill(0xffffff);
      if (this.flash <= 0) this.cuerpo.clearTint();
    }
    if (this.arma) {
      const a = ARMAS[this.sheet];
      const ox = x + c * a.dist;
      const oy = y - ALTURA * (this.escala / ESCALA) + sn * a.dist * 0.6;
      this.arma.setPosition(ox, oy).setRotation(ang).setFlipY(c < 0);
      this.arma.setDepth(prof(y) + (sn < -0.35 ? -0.5 : 0.5));
    }
    if (this.escudo) {
      this.escudo.setPosition(x + c * 22, y - ALTURA + sn * 14).setRotation(ang).setDepth(prof(y) + (sn < -0.2 ? -0.6 : 0.6));
    }
    const top = y - 92 * this.escala;
    this.etiqueta?.setPosition(x, top - 8).setDepth(PROF_UI_MUNDO + y);
    this.barra.clear().setDepth(PROF_UI_MUNDO + y);
    if (hp !== undefined && maxHp && hp < maxHp && hp > 0) {
      const w = 44 * (this.escala / ESCALA);
      this.barra.fillStyle(0x0a0a0c, 0.9).fillRect(x - w / 2 - 2, top - 4, w + 4, 8);
      this.barra.fillStyle(hp / maxHp > 0.35 ? 0x7dff6a : 0xff4a4a, 1).fillRect(x - w / 2, top - 2, (w * Math.max(0, hp)) / maxHp, 4);
    }
    if (hp !== undefined) {
      if (this.ultimoHp >= 0 && hp < this.ultimoHp) this.golpe();
      this.ultimoHp = hp;
    }
    this.overlay?.setPosition(x, y + 4).setDepth(prof(y) + 1);
    this.aura?.setPosition(x, y - ALTURA).setDepth(prof(y) - 1);
  }

  setOverlay(k: string | null): void {
    if (!k) {
      this.overlay?.destroy();
      this.overlay = undefined;
      return;
    }
    if (this.overlay?.texture.key === k) return;
    this.overlay?.destroy();
    this.overlay = this.s.add.image(this.rx, this.ry, k).setOrigin(0.5, 0.95).setScale(this.escala * 1.05).setAlpha(0.9);
  }

  setAura(on: boolean, color = 0x3ef0ff): void {
    if (!on) {
      this.aura?.destroy();
      this.aura = undefined;
      return;
    }
    if (!this.aura) this.aura = this.s.add.image(this.rx, this.ry, "chispa").setScale(4).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setTint(color);
  }

  setVisible(v: boolean): void {
    this.cuerpo.setVisible(v);
    this.sombra.setVisible(v);
    this.arma?.setVisible(v);
    this.escudo?.setVisible(v);
    this.etiqueta?.setVisible(v);
    this.barra.setVisible(v);
  }

  destruir(): void {
    this.sombra.destroy();
    this.cuerpo.destroy();
    this.arma?.destroy();
    this.escudo?.destroy();
    this.etiqueta?.destroy();
    this.barra.destroy();
    this.overlay?.destroy();
    this.aura?.destroy();
  }
}
