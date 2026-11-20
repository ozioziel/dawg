// Efectos visuales: partículas, destellos, ondas, cortes, humo y marcas en el suelo.
// Las texturas se generan aquí (sin archivos) y los emisores son compartidos para rendir bien en móvil.
import type { FxEvent } from "@dawg/shared";
import Phaser from "phaser";
import { ALTURA, TITULO, prof } from "./contexto";
import { sfx } from "./sonido";

const PROF_FX = 15000;
const PROF_HUMO = 14000;
const PROF_SUELO = 3;

// ------------------------------------------------------------------ texturas
function lienzo(s: Phaser.Scene, key: string, w: number, h: number, dibujar: (c: CanvasRenderingContext2D) => void): void {
  if (s.textures.exists(key)) return;
  const t = s.textures.createCanvas(key, w, h);
  if (!t) return;
  dibujar(t.getContext());
  t.refresh();
}

/** Crea (una sola vez) las texturas de efectos. */
export function crearTexturasFx(s: Phaser.Scene): void {
  lienzo(s, "fx_brillo", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.75)");
    g.addColorStop(0.6, "rgba(255,255,255,0.2)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  lienzo(s, "fx_punto", 16, 16, (c) => {
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
  });
  lienzo(s, "fx_chispa", 40, 8, (c) => {
    const g = c.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 4);
    c.lineTo(34, 1);
    c.quadraticCurveTo(40, 4, 34, 7);
    c.closePath();
    c.fill();
  });
  lienzo(s, "fx_humo", 64, 64, (c) => {
    const blobs = [[32, 34, 22], [22, 30, 14], [42, 28, 15], [30, 22, 13], [40, 40, 12]];
    for (const [x, y, r] of blobs) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  lienzo(s, "fx_gota", 22, 22, (c) => {
    c.fillStyle = "#ffffff";
    c.strokeStyle = "rgba(10,10,12,0.9)";
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(11, 12, 7.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.arc(8.5, 9.5, 2.2, 0, Math.PI * 2);
    c.fill();
  });
  lienzo(s, "fx_esquirla", 18, 18, (c) => {
    c.fillStyle = "#ffffff";
    c.strokeStyle = "rgba(10,10,12,0.9)";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(9, 1);
    c.lineTo(16, 13);
    c.lineTo(5, 16);
    c.closePath();
    c.fill();
    c.stroke();
  });
  lienzo(s, "fx_anillo", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 44, 64, 64, 62);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(255,255,255,0.95)");
    g.addColorStop(0.75, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  lienzo(s, "fx_tajo", 128, 72, (c) => {
    // Media luna: borde delantero brillante que se afina en las puntas
    const g = c.createLinearGradient(0, 0, 0, 72);
    g.addColorStop(0, "rgba(255,255,255,0.15)");
    g.addColorStop(0.6, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0.4)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(4, 30);
    c.quadraticCurveTo(64, 82, 124, 30);
    c.quadraticCurveTo(64, 58, 4, 30);
    c.closePath();
    c.fill();
  });
  lienzo(s, "fx_estrella", 24, 24, (c) => {
    c.fillStyle = "#ffffff";
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 2.6 : 11.5;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
  lienzo(s, "fx_hoja", 20, 12, (c) => {
    c.fillStyle = "#ffffff";
    c.strokeStyle = "rgba(10,10,12,0.9)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(1, 6);
    c.quadraticCurveTo(10, -2, 19, 6);
    c.quadraticCurveTo(10, 14, 1, 6);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(3, 6);
    c.lineTo(17, 6);
    c.stroke();
  });
  lienzo(s, "fx_cruz", 20, 20, (c) => {
    c.fillStyle = "#ffffff";
    c.strokeStyle = "rgba(10,10,12,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.rect(7, 1.5, 6, 17);
    c.rect(1.5, 7, 17, 6);
    c.fill();
    c.stroke();
    c.fillRect(8, 3, 4, 14);
    c.fillRect(3, 8, 14, 4);
  });
  lienzo(s, "fx_quemado", 96, 96, (c) => {
    for (let i = 0; i < 9; i++) {
      const x = 48 + (Math.random() - 0.5) * 30;
      const y = 48 + (Math.random() - 0.5) * 30;
      const r = 14 + Math.random() * 20;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(20,14,10,0.55)");
      g.addColorStop(1, "rgba(20,14,10,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  lienzo(s, "fx_charco", 64, 40, (c) => {
    c.fillStyle = "#ffffff";
    c.strokeStyle = "rgba(10,10,12,0.75)";
    c.lineWidth = 2;
    c.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + 1) * 0.12 + Math.sin(a * 5) * 0.08;
      c.lineTo(32 + Math.cos(a) * 26 * r, 20 + Math.sin(a) * 14 * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.ellipse(24, 15, 7, 3, -0.3, 0, Math.PI * 2);
    c.fill();
  });
}

// ------------------------------------------------------------------ efectos
export class Efectos {
  private pChispa: Phaser.GameObjects.Particles.ParticleEmitter;
  private pBrillo: Phaser.GameObjects.Particles.ParticleEmitter;
  private pHumo: Phaser.GameObjects.Particles.ParticleEmitter;
  private pPolvo: Phaser.GameObjects.Particles.ParticleEmitter;
  private pGota: Phaser.GameObjects.Particles.ParticleEmitter;
  private pEsquirla: Phaser.GameObjects.Particles.ParticleEmitter;
  private pEstrella: Phaser.GameObjects.Particles.ParticleEmitter;
  private pHoja: Phaser.GameObjects.Particles.ParticleEmitter;
  private pCruz: Phaser.GameObjects.Particles.ParticleEmitter;
  private pEstela: Phaser.GameObjects.Particles.ParticleEmitter;
  private marcas: Phaser.GameObjects.Image[] = [];

  constructor(private s: Phaser.Scene) {
    crearTexturasFx(s);
    const alinear = { onEmit: () => 0, onUpdate: (p: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) };
    this.pChispa = s.add.particles(0, 0, "fx_chispa", { emitting: false, blendMode: Phaser.BlendModes.ADD, lifespan: { min: 180, max: 420 }, speed: { min: 120, max: 420 }, scaleX: { start: 1, end: 0.2 }, scaleY: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, rotate: alinear, gravityY: 240 }).setDepth(PROF_FX);
    this.pBrillo = s.add.particles(0, 0, "fx_brillo", { emitting: false, blendMode: Phaser.BlendModes.ADD, lifespan: 260, speed: 0, scale: { start: 0.6, end: 1.6 }, alpha: { start: 0.9, end: 0 } }).setDepth(PROF_FX + 1);
    this.pHumo = s.add.particles(0, 0, "fx_humo", { emitting: false, lifespan: { min: 600, max: 1100 }, speed: { min: 10, max: 60 }, angle: { min: 200, max: 340 }, scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.55, end: 0 }, rotate: { min: 0, max: 360 } }).setDepth(PROF_HUMO);
    this.pPolvo = s.add.particles(0, 0, "fx_humo", { emitting: false, lifespan: { min: 300, max: 520 }, speed: { min: 8, max: 40 }, angle: { min: 180, max: 360 }, scale: { start: 0.18, end: 0.5 }, alpha: { start: 0.45, end: 0 }, tint: 0xc8b89a }).setDepth(PROF_SUELO + 1);
    this.pGota = s.add.particles(0, 0, "fx_gota", { emitting: false, lifespan: { min: 380, max: 650 }, speed: { min: 80, max: 260 }, angle: { min: 200, max: 340 }, gravityY: 700, scale: { start: 0.7, end: 0.25 }, alpha: { start: 1, end: 0.6 } }).setDepth(PROF_FX - 2);
    this.pEsquirla = s.add.particles(0, 0, "fx_esquirla", { emitting: false, lifespan: { min: 400, max: 750 }, speed: { min: 120, max: 340 }, angle: { min: 190, max: 350 }, gravityY: 650, scale: { start: 0.9, end: 0.4 }, rotate: { start: 0, end: 540 }, alpha: { start: 1, end: 0 } }).setDepth(PROF_FX - 1);
    this.pEstrella = s.add.particles(0, 0, "fx_estrella", { emitting: false, blendMode: Phaser.BlendModes.ADD, lifespan: { min: 400, max: 800 }, speed: { min: 30, max: 150 }, scale: { start: 0.8, end: 0 }, rotate: { start: 0, end: 180 }, alpha: { start: 1, end: 0 } }).setDepth(PROF_FX + 2);
    this.pHoja = s.add.particles(0, 0, "fx_hoja", { emitting: false, lifespan: { min: 700, max: 1200 }, speed: { min: 50, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 160, scale: { start: 1, end: 0.6 }, rotate: { start: 0, end: 720 }, alpha: { start: 1, end: 0 } }).setDepth(PROF_FX - 1);
    this.pCruz = s.add.particles(0, 0, "fx_cruz", { emitting: false, lifespan: { min: 600, max: 1000 }, speedY: { min: -90, max: -40 }, speedX: { min: -25, max: 25 }, scale: { start: 0.9, end: 0.3 }, alpha: { start: 1, end: 0 } }).setDepth(PROF_FX);
    this.pEstela = s.add.particles(0, 0, "fx_punto", { emitting: false, blendMode: Phaser.BlendModes.ADD, lifespan: 220, speed: { min: 0, max: 20 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 } }).setDepth(PROF_FX - 3);
  }

  private cerca(x: number, y: number): number {
    const cam = this.s.cameras.main;
    const d = Phaser.Math.Distance.Between(x, y, cam.midPoint.x, cam.midPoint.y);
    return Phaser.Math.Clamp(1.4 - d / 900, 0, 1);
  }

  private visible(x: number, y: number, margen = 200): boolean {
    const v = this.s.cameras.main.worldView;
    return x > v.x - margen && x < v.right + margen && y > v.y - margen && y < v.bottom + margen;
  }

  // ---------------------------------------------------------------- piezas
  private chispas(x: number, y: number, color: number, n: number, vel = 300, ang?: number, abanico = 360, vida = 380): void {
    const e = this.pChispa;
    e.setParticleTint(color);
    e.setParticleSpeed(vel * 0.35, vel);
    e.setParticleLifespan(vida);
    if (ang === undefined) e.updateConfig({ angle: { min: 0, max: 360 } });
    else {
      const a = Phaser.Math.RadToDeg(ang);
      e.updateConfig({ angle: { min: a - abanico / 2, max: a + abanico / 2 } });
    }
    e.explode(n, x, y);
  }

  private destello(x: number, y: number, color: number, escala = 1, vida = 260): void {
    this.pBrillo.setParticleTint(color);
    this.pBrillo.setParticleLifespan(vida);
    this.pBrillo.setParticleScale(0.5 * escala, 1.6 * escala);
    this.pBrillo.explode(1, x, y);
  }

  private humo(x: number, y: number, n: number, color = 0x9a9a9a, escala = 1): void {
    this.pHumo.setParticleTint(color);
    this.pHumo.setParticleScale(0.5 * escala, 1.6 * escala);
    this.pHumo.explode(n, x, y);
  }

  private gotas(x: number, y: number, color: number, n: number, vel = 220): void {
    this.pGota.setParticleTint(color);
    this.pGota.setParticleSpeed(vel * 0.35, vel);
    this.pGota.explode(n, x, y);
  }

  private esquirlas(x: number, y: number, color: number, n: number, vel = 300): void {
    this.pEsquirla.setParticleTint(color);
    this.pEsquirla.setParticleSpeed(vel * 0.4, vel);
    this.pEsquirla.explode(n, x, y);
  }

  private estrellas(x: number, y: number, color: number, n: number): void {
    this.pEstrella.setParticleTint(color);
    this.pEstrella.explode(n, x, y);
  }

  private onda(x: number, y: number, color: number, r: number, dur = 450, grosor = 1): void {
    const img = this.s.add.image(x, y, "fx_anillo").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(y) + 400).setScale(0.1).setAlpha(0.95);
    img.setScale(0.15, 0.15 * 0.62);
    this.s.tweens.add({ targets: img, scaleX: (r * 2) / 110, scaleY: ((r * 2) / 110) * 0.62, alpha: 0, duration: dur, ease: "Cubic.Out", onComplete: () => img.destroy() });
    if (grosor > 1) {
      const img2 = this.s.add.image(x, y, "fx_anillo").setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(y) + 401).setScale(0.1, 0.062).setAlpha(0.7);
      this.s.tweens.add({ targets: img2, scaleX: (r * 1.6) / 110, scaleY: ((r * 1.6) / 110) * 0.62, alpha: 0, duration: dur * 0.7, ease: "Cubic.Out", onComplete: () => img2.destroy() });
    }
  }

  private texto(x: number, y: number, t: string, color: string): void {
    const tx = this.s.add.text(x, y - 60, t, { ...TITULO, fontSize: "28px", color }).setOrigin(0.5).setDepth(prof(y) + 900).setScale(0.3);
    this.s.tweens.add({ targets: tx, scale: 1, duration: 180, ease: "Back.Out" });
    this.s.tweens.add({ targets: tx, y: y - 118, alpha: 0, delay: 500, duration: 900, ease: "Cubic.In", onComplete: () => tx.destroy() });
  }

  private linea(x: number, y: number, x2: number, y2: number, color: number, ancho: number, dur: number, alto = ALTURA): void {
    const g = this.s.add.graphics().setDepth(prof(Math.max(y, y2)) + 300).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(ancho * 3, color, 0.25).lineBetween(x, y - alto, x2, y2 - alto);
    g.lineStyle(ancho * 1.4, color, 0.8).lineBetween(x, y - alto, x2, y2 - alto);
    g.lineStyle(Math.max(1, ancho * 0.45), 0xffffff, 1).lineBetween(x, y - alto, x2, y2 - alto);
    this.s.tweens.add({ targets: g, alpha: 0, duration: dur, ease: "Quad.In", onComplete: () => g.destroy() });
  }

  /** Rayo quebrado (eléctrico/psíquico) entre dos puntos. */
  private rayo(x: number, y: number, x2: number, y2: number, color: number, dur = 300): void {
    const g = this.s.add.graphics().setDepth(prof(Math.max(y, y2)) + 300).setBlendMode(Phaser.BlendModes.ADD);
    const n = Math.max(4, Math.round(Phaser.Math.Distance.Between(x, y, x2, y2) / 40));
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const off = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 26;
      const nx = -(y2 - y);
      const ny = x2 - x;
      const l = Math.hypot(nx, ny) || 1;
      pts.push(new Phaser.Math.Vector2(x + (x2 - x) * k + (nx / l) * off, y - ALTURA + (y2 - y) * k + (ny / l) * off));
    }
    g.lineStyle(10, color, 0.25).strokePoints(pts);
    g.lineStyle(4, color, 0.9).strokePoints(pts);
    g.lineStyle(1.6, 0xffffff, 1).strokePoints(pts);
    this.s.tweens.add({ targets: g, alpha: 0, duration: dur, onComplete: () => g.destroy() });
  }

  private tajoSprite(x: number, y: number, ang: number, color: number, escala = 1, dur = 200): void {
    const img = this.s.add.image(x, y - ALTURA, "fx_tajo").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(y) + 300).setRotation(ang + Math.PI / 2).setScale(0.45 * escala, 0.6 * escala).setAlpha(1);
    this.s.tweens.add({ targets: img, scaleX: 0.85 * escala, scaleY: 0.8 * escala, alpha: 0, rotation: img.rotation + 0.5, duration: dur, ease: "Quad.Out", onComplete: () => img.destroy() });
  }

  /** Marca en el suelo que se desvanece (quemaduras, charcos, escarcha, trozos de goo). */
  marca(x: number, y: number, k: string, color: number, escala = 1, vida = 6000, frame?: number): void {
    if (!this.visible(x, y, 400)) return;
    const img = this.s.add.image(x, y, k, frame).setTint(color).setDepth(PROF_SUELO).setScale(escala * 0.4).setAlpha(0.9).setRotation((Math.random() - 0.5) * 0.6);
    this.s.tweens.add({ targets: img, scale: escala, duration: 160, ease: "Back.Out" });
    this.s.tweens.add({ targets: img, alpha: 0, delay: vida * 0.6, duration: vida * 0.4, onComplete: () => img.destroy() });
    this.marcas.push(img);
    if (this.marcas.length > 90) this.marcas.shift()?.destroy();
    this.marcas = this.marcas.filter((m) => m.active);
  }

  // ---------------------------------------------------------------- API para el mundo
  /** Fogonazo del arma al disparar. */
  fogonazo(x: number, y: number, ang: number, color: number): void {
    if (!this.visible(x, y)) return;
    const fx = x + Math.cos(ang) * 30;
    const fy = y - ALTURA + Math.sin(ang) * 18;
    this.destello(fx, fy, color, 0.45, 110);
    this.chispas(fx, fy, color, 3, 260, ang, 40, 140);
  }

  /** Efecto extra al hacer una acción (habilidad, definitiva, rugido…). */
  accion(tipo: string, x: number, y: number, color: number): void {
    if (!this.visible(x, y)) return;
    switch (tipo) {
      case "hab":
        this.onda(x, y, color, 70, 380);
        this.estrellas(x, y - 50, color, 5);
        break;
      case "ulti":
        this.onda(x, y, color, 200, 700, 2);
        this.destello(x, y - 40, color, 2.4, 420);
        this.chispas(x, y - 40, color, 26, 520, undefined, 360, 520);
        this.estrellas(x, y - 60, 0xffffff, 10);
        this.s.cameras.main.shake(220, 0.006 * this.cerca(x, y));
        break;
      case "rugido":
        this.onda(x, y, 0xff6a4a, 180, 600, 2);
        this.s.cameras.main.shake(260, 0.006 * this.cerca(x, y));
        break;
      case "pisoton":
        this.onda(x, y, 0xffd23e, 160, 500, 2);
        this.humo(x, y, 6, 0xb8a888, 1.2);
        this.s.cameras.main.shake(200, 0.007 * this.cerca(x, y));
        break;
      case "carga":
        this.humo(x, y, 5, 0xb8a888, 1);
        break;
      case "lanzar":
        this.pPolvo.explode(2, x, y);
        break;
    }
  }

  /** Polvo de las pisadas. */
  pisada(x: number, y: number, fuerte = false): void {
    if (!this.visible(x, y, 50)) return;
    this.pPolvo.setParticleScale(fuerte ? 0.35 : 0.16, fuerte ? 0.9 : 0.45);
    this.pPolvo.explode(fuerte ? 4 : 2, x + (Math.random() - 0.5) * 14, y + 2);
    if (fuerte) this.s.cameras.main.shake(60, 0.0015 * this.cerca(x, y));
  }

  /** Trozos de chicle que el Simbionte va dejando al arrastrarse. */
  rastroGoo(x: number, y: number, color = 0xb9501a, escala = 1): void {
    this.marca(x + (Math.random() - 0.5) * 20 * escala, y + (Math.random() - 0.5) * 8, "goo_trozo", color, (0.55 + Math.random() * 0.35) * escala, 7000, Math.floor(Math.random() * 4));
    if (Math.random() < 0.5) this.gotas(x, y - 10, color, 2, 90);
  }

  /** Tierra y raíces de la Curandera al moverse. */
  raices(x: number, y: number): void {
    if (!this.visible(x, y, 50)) return;
    this.pPolvo.setParticleScale(0.14, 0.4);
    this.pPolvo.explode(2, x + (Math.random() - 0.5) * 30, y + 3);
    if (Math.random() < 0.25) {
      this.pHoja.setParticleTint(0x62bf4a);
      this.pHoja.explode(1, x, y - 40);
    }
  }

  /** Tierra que levanta el Escarabajo bajo el suelo. */
  tierra(x: number, y: number): void {
    this.gotas(x + (Math.random() - 0.5) * 30, y, 0x7a5a30, 2, 120);
    this.pPolvo.setParticleScale(0.2, 0.6);
    this.pPolvo.explode(1, x, y);
  }

  /** Chorro de hielo de Freeze: niebla fría, cristales y esquirlas. */
  chorro(x: number, y: number, ang: number): void {
    for (let i = 0; i < 2; i++) {
      const a = ang + (Math.random() - 0.5) * 0.45;
      const largo = 170 + Math.random() * 60;
      const p = this.s.add
        .image(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30, "fx_humo")
        .setTint(Math.random() < 0.5 ? 0xbfeaff : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.25)
        .setAlpha(0.9)
        .setRotation(Math.random() * 6)
        .setDepth(prof(y + ALTURA) + 60);
      this.s.tweens.add({ targets: p, x: x + Math.cos(a) * largo, y: y + Math.sin(a) * largo, scale: 1.3, alpha: 0, duration: 340, onComplete: () => p.destroy() });
    }
    if (Math.random() < 0.35) {
      this.pEsquirla.setParticleTint(0xdff6ff);
      this.pEsquirla.setParticleSpeed(200, 420);
      const a = Phaser.Math.RadToDeg(ang);
      this.pEsquirla.updateConfig({ angle: { min: a - 14, max: a + 14 } });
      this.pEsquirla.explode(1, x + Math.cos(ang) * 30, y + Math.sin(ang) * 30);
      this.pEsquirla.updateConfig({ angle: { min: 190, max: 350 } });
    }
    if (Math.random() < 0.3) sfx.hielo(0.35);
  }

  /** Estela de los proyectiles en vuelo. */
  estela(k: string, x: number, y: number): void {
    const col: Record<string, number> = { bala: 0xffe08a, bala_roja: 0xff5a4a, energia: 0x6fd6ff, psiquico: 0xc08bff, fragmento: 0xe8823a, espina: 0x7dff6a, rayo_franco: 0xfff4a0, misil: 0xffb020, cuchillo: 0xb37bff };
    const c = col[k];
    if (c === undefined) return;
    if (k === "fragmento") {
      if (Math.random() < 0.35) this.gotas(x, y, 0xb9501a, 1, 60);
      this.pEstela.setParticleTint(c);
      this.pEstela.explode(1, x, y);
      return;
    }
    if (k === "misil") {
      this.humo(x, y, 1, 0x8a8a8a, 0.5);
      this.pEstela.setParticleTint(c);
      this.pEstela.explode(1, x, y);
      return;
    }
    this.pEstela.setParticleTint(c);
    this.pEstela.explode(1, x, y);
  }

  /** Muerte de una unidad según su cuerpo. */
  muerte(x: number, y: number, perfil: string, color = 0xffffff): void {
    if (!this.visible(x, y)) return;
    const v = this.cerca(x, y);
    if (perfil === "maquina" || perfil === "flotante") {
      this.s.time.delayedCall(260, () => {
        this.destello(x, y - 30, 0xffb020, 1.6, 300);
        this.chispas(x, y - 30, 0xffd23e, 18, 420);
        this.esquirlas(x, y - 30, 0x8a96a8, 10, 320);
        this.humo(x, y - 20, 6, 0x606060, 1.3);
        this.marca(x, y, "fx_quemado", 0xffffff, 1, 9000);
        if (v > 0) this.s.cameras.main.shake(120, 0.004 * v);
      });
      return;
    }
    if (perfil === "masa") {
      this.gotas(x, y - 20, 0xb9501a, 14, 280);
      this.marca(x, y, "fx_charco", 0xb9501a, 1.2, 9000);
      return;
    }
    if (perfil === "planta") {
      this.pHoja.setParticleTint(0x62bf4a);
      this.pHoja.explode(8, x, y - 40);
      return;
    }
    if (perfil === "tentaculos") {
      this.gotas(x, y - 20, 0xff8a5a, 10, 220);
      this.marca(x, y, "fx_charco", 0x3ec0ff, 0.8, 5000);
      return;
    }
    this.humo(x, y - 10, 4, 0xb8a888, 0.8);
    this.estrellas(x, y - 60, 0xffe25a, 4);
    this.chispas(x, y - 30, color, 8, 220);
  }

  // ---------------------------------------------------------------- eventos del servidor
  play(e: FxEvent): void {
    const v = this.cerca(e.x, e.y);
    const c = e.c ?? 0xffffff;
    if (!this.visible(e.x, e.y, 600) && !["eclipse", "cero", "nucleo", "texto"].includes(e.t)) return;
    switch (e.t) {
      case "explosion": {
        const r = e.r ?? 110;
        this.destello(e.x, e.y - 20, 0xffffff, r / 70, 160);
        this.destello(e.x, e.y - 20, 0xff9a2a, r / 45, 420);
        const bola = this.s.add.image(e.x, e.y - 20, "fx_humo").setTint(0xff7a1a).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(e.y) + 600).setScale(0.3);
        this.s.tweens.add({ targets: bola, scale: r / 30, alpha: 0, duration: 520, ease: "Cubic.Out", onComplete: () => bola.destroy() });
        this.chispas(e.x, e.y - 20, 0xffc04a, 22, r * 4.5, undefined, 360, 520);
        this.esquirlas(e.x, e.y - 10, 0x5a4a3a, 8, r * 3);
        this.humo(e.x, e.y - 10, 9, 0x4a4a4a, r / 70);
        this.onda(e.x, e.y, 0xffd23e, r * 1.1, 420, 2);
        this.marca(e.x, e.y, "fx_quemado", 0xffffff, r / 55, 12000);
        if (v > 0) {
          this.s.cameras.main.shake(260, 0.008 * v);
          sfx.explosion();
        }
        break;
      }
      case "impacto":
        this.chispas(e.x, e.y - ALTURA, c, 7, 320, undefined, 360, 240);
        this.destello(e.x, e.y - ALTURA, c, 0.35, 120);
        if (v > 0.3) sfx.impacto();
        break;
      case "chispa":
        this.chispas(e.x, e.y - 10, 0xfff4a0, 12, 360);
        this.destello(e.x, e.y - 10, 0xfff4a0, 0.5, 140);
        break;
      case "llamas": {
        const x2 = e.x2 ?? e.x;
        const y2 = e.y2 ?? e.y;
        for (let i = 0; i < 4; i++) {
          const k = Math.random();
          const f = this.s.add.image(e.x + (x2 - e.x) * k * 0.3, e.y - ALTURA + (y2 - e.y) * k * 0.3, "llama").setDepth(prof(e.y) + 200).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
          this.s.tweens.add({ targets: f, x: e.x + (x2 - e.x) * (0.7 + k * 0.4) + Phaser.Math.Between(-20, 20), y: e.y - ALTURA + (y2 - e.y) * (0.7 + k * 0.4) + Phaser.Math.Between(-20, 20), scale: 1.3, alpha: 0, duration: 380, onComplete: () => f.destroy() });
        }
        if (Math.random() < 0.3) this.humo(x2, y2 - 20, 1, 0x505050, 0.6);
        if (v > 0.3) sfx.llamas();
        break;
      }
      case "hielo":
        this.esquirlas(e.x, e.y - 20, 0xdff6ff, 14, 320);
        this.destello(e.x, e.y - 20, 0x9fe3ff, (e.r ?? 60) / 60, 300);
        this.onda(e.x, e.y, 0x6fd6ff, e.r ?? 60, 450);
        this.marca(e.x, e.y, "fx_charco", 0xbfeaff, (e.r ?? 60) / 40, 8000);
        if (v > 0) sfx.hielo();
        break;
      case "acido":
        this.gotas(e.x, e.y - 10, 0x8dff4a, 12, 240);
        this.marca(e.x, e.y, "fx_charco", 0x8dff4a, 1.4, 6000);
        if (v > 0) sfx.chapoteo();
        break;
      case "gas":
        this.humo(e.x, e.y - 10, 8, 0xc08bff, 1.2);
        if (v > 0) sfx.chapoteo();
        break;
      case "transmutar":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x2, e.y2, e.x, e.y, c, 4, 320);
        this.destello(e.x, e.y - 30, c, 1.4, 360);
        this.estrellas(e.x, e.y - 30, c, 10);
        this.chispas(e.x, e.y - 30, c, 14, 260);
        this.onda(e.x, e.y, c, 80, 450, 2);
        if (v > 0) sfx.transmutar();
        break;
      case "telequinesis":
        if (e.x2 !== undefined && e.y2 !== undefined) this.rayo(e.x, e.y, e.x2, e.y2, 0xc08bff, 260);
        this.onda(e.x, e.y, 0xc08bff, 60, 380);
        this.estrellas(e.x2 ?? e.x, (e.y2 ?? e.y) - 30, 0xd9b8ff, 3);
        if (v > 0) sfx.telequinesis();
        break;
      case "muerte":
        this.chispas(e.x, e.y - 30, c, 12, 260);
        this.humo(e.x, e.y - 10, 3, 0xb8a888, 0.8);
        if (v > 0) sfx.muerte();
        break;
      case "alma": {
        this.destello(e.x, e.y - 40, 0xffffff, 1.4, 500);
        this.estrellas(e.x, e.y - 40, 0xffffff, 10);
        this.onda(e.x, e.y, 0xffffff, 70, 500);
        const w = this.s.add.image(e.x, e.y - 30, "fx_brillo").setBlendMode(Phaser.BlendModes.ADD).setDepth(PROF_FX).setScale(0.8);
        this.s.tweens.add({ targets: w, y: e.y - 140, alpha: 0, scale: 0.3, duration: 1100, ease: "Sine.In", onComplete: () => w.destroy() });
        if (v > 0) sfx.alma();
        break;
      }
      case "rescate": {
        const col = c === 0xffffff ? 0x7dff6a : c;
        this.onda(e.x, e.y, col, 80, 500, 2);
        this.pCruz.setParticleTint(col);
        this.pCruz.explode(5, e.x, e.y - 30);
        break;
      }
      case "ladrido":
        this.texto(e.x, e.y, "¡GUAU!", "#ffd23e");
        if (v > 0) sfx.ladrido();
        break;
      case "revelado":
        this.texto(e.x, e.y, "¡DESCUBIERTO!", "#ff4a4a");
        this.humo(e.x, e.y - 30, 6, 0x7fb24a, 1);
        this.estrellas(e.x, e.y - 50, 0x9cff5a, 6);
        break;
      case "nucleo":
        this.s.cameras.main.flash(400, 255, 140, 60);
        this.s.cameras.main.shake(500, 0.01);
        this.onda(e.x, e.y, 0xff8a3a, 400, 900, 2);
        sfx.explosion();
        break;
      case "tajo":
        this.tajoSprite(e.x, e.y, e.r ?? 0, c, 1.1);
        this.chispas(e.x, e.y - ALTURA, c, 5, 260, e.r ?? 0, 70, 200);
        if (v > 0) sfx.tajo();
        break;
      case "mordida": {
        // Dos fauces que se cierran sobre el punto
        const a = e.r ?? 0;
        for (const lado of [-1, 1]) {
          const img = this.s.add.image(e.x, e.y - ALTURA, "fx_tajo").setTint(c).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof(e.y) + 300).setRotation(a + (lado < 0 ? 0 : Math.PI)).setScale(0.35, 0.45 * lado);
          this.s.tweens.add({ targets: img, scaleY: 0.12 * lado, alpha: 0, duration: 220, ease: "Quad.In", onComplete: () => img.destroy() });
        }
        this.gotas(e.x, e.y - ALTURA, c === 0xff3b3b ? 0xd02a2a : c, 6, 200);
        this.estrellas(e.x, e.y - ALTURA - 10, 0xffffff, 3);
        if (v > 0) sfx.mordida();
        break;
      }
      case "teleport":
        for (const [x, y] of [[e.x, e.y], [e.x2 ?? e.x, e.y2 ?? e.y]] as const) {
          const n = this.s.add.image(x, y - 40, "fx_humo").setTint(0x2a1a4a).setDepth(prof(y) + 200).setScale(1.4).setAlpha(0.9);
          this.s.tweens.add({ targets: n, scale: 0.2, alpha: 0, rotation: 2, duration: 380, ease: "Back.In", onComplete: () => n.destroy() });
          this.chispas(x, y - 40, 0x7a5cff, 10, 260);
        }
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0x7a5cff, 2, 220);
        if (v > 0) sfx.teleport();
        break;
      case "excavar":
        this.gotas(e.x, e.y, 0x7a5a30, 14, 280);
        this.humo(e.x, e.y, 5, 0xa88a5a, 1);
        this.marca(e.x, e.y, "fx_quemado", 0xd8b878, 0.9, 6000);
        if (v > 0) sfx.escarabajo();
        break;
      case "emerger":
        this.gotas(e.x, e.y, 0x7a5a30, 22, 380);
        this.esquirlas(e.x, e.y, 0x8a6a3a, 10, 360);
        this.humo(e.x, e.y, 8, 0xa88a5a, 1.4);
        this.onda(e.x, e.y, 0xa8c84a, e.r ?? 90, 450, 2);
        this.s.cameras.main.shake(160, 0.005 * v);
        if (v > 0) sfx.escarabajo(true);
        break;
      case "congelar":
        this.esquirlas(e.x, e.y - 30, 0xdff6ff, 10, 260);
        this.destello(e.x, e.y - 30, 0x9fe3ff, 1, 300);
        this.texto(e.x, e.y, "¡CONGELADO!", "#bfeaff");
        if (v > 0) sfx.hielo();
        break;
      case "devorar":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0x7dff6a, 5, 300);
        this.pHoja.setParticleTint(0x62bf4a);
        this.pHoja.explode(5, e.x, e.y - 30);
        this.gotas(e.x, e.y - 20, 0xe8486a, 6, 200);
        if (v > 0) sfx.mordida();
        break;
      case "curar":
        this.onda(e.x, e.y, 0x7dff6a, e.r ?? 60, 500, 2);
        this.pCruz.setParticleTint(0x7dff6a);
        this.pCruz.explode(6, e.x, e.y - 30);
        this.pHoja.setParticleTint(0x9cff7a);
        this.pHoja.explode(3, e.x, e.y - 40);
        if (v > 0) sfx.curar();
        break;
      case "infectar":
        this.gotas(e.x, e.y - 30, 0xe8823a, 12, 240);
        this.destello(e.x, e.y - 30, 0xff7a1a, 1, 300);
        this.texto(e.x, e.y, "INFECTADO", "#ffb26a");
        if (v > 0) sfx.simbionte();
        break;
      case "asimilar":
      case "absorber":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0xe8823a, 6, 360);
        this.gotas(e.x, e.y - 30, 0xb9501a, 16, 260);
        this.marca(e.x, e.y, "fx_charco", 0xb9501a, 1, 8000);
        if (v > 0) sfx.simbionte(true);
        break;
      case "escaneo":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x2, e.y2, e.x, e.y, 0x7fb24a, 2, 900);
        this.onda(e.x, e.y, 0x7fb24a, 50, 600);
        if (v > 0) sfx.escaneo();
        break;
      case "disfraz":
        this.humo(e.x, e.y - 30, 8, 0x9fd27a, 1.1);
        this.estrellas(e.x, e.y - 50, 0x9cff5a, 6);
        if (v > 0) sfx.transmutar();
        break;
      case "berserk":
        this.onda(e.x, e.y, 0x9cff5a, 140, 600, 2);
        this.destello(e.x, e.y - 40, 0x9cff5a, 2.2, 400);
        this.chispas(e.x, e.y - 40, 0x9cff5a, 24, 420);
        if (e.r) this.s.cameras.main.shake(260, 0.008 * v);
        if (v > 0) sfx.rugido();
        break;
      case "singularidad":
        this.onda(e.x, e.y, 0xc08bff, e.r ?? 300, 900, 2);
        this.estrellas(e.x, e.y - 30, 0xd9b8ff, 12);
        if (v > 0) sfx.singularidad();
        break;
      case "kraken":
        this.onda(e.x, e.y, 0x3ec0ff, e.r ?? 120, 700, 2);
        this.gotas(e.x, e.y - 20, 0x7dd8ff, 18, 300);
        this.marca(e.x, e.y, "fx_charco", 0x3ec0ff, 1.6, 7000);
        if (v > 0) sfx.chapoteo();
        break;
      case "jardin":
        this.onda(e.x, e.y, 0x5fd068, e.r ?? 300, 800, 2);
        this.pHoja.setParticleTint(0x7dff6a);
        this.pHoja.explode(18, e.x, e.y - 20);
        this.pCruz.setParticleTint(0x7dff6a);
        this.pCruz.explode(8, e.x, e.y - 20);
        if (v > 0) sfx.curar();
        break;
      case "eclipse":
        this.s.cameras.main.flash(500, 40, 10, 80);
        this.onda(e.x, e.y, 0x7a5cff, 600, 900, 2);
        sfx.eclipse();
        break;
      case "cero":
        this.s.cameras.main.flash(400, 190, 240, 255);
        this.onda(e.x, e.y, 0xbfeaff, Math.min(1400, e.r ?? 700), 800, 2);
        this.esquirlas(e.x, e.y - 30, 0xdff6ff, 24, 520);
        sfx.hielo();
        sfx.hielo(1, 0.15);
        break;
      case "fusion":
        if (e.x2 !== undefined && e.y2 !== undefined) this.linea(e.x, e.y, e.x2, e.y2, 0xe8823a, 7, 420);
        this.gotas(e.x, e.y - 40, 0xb9501a, 20, 320);
        this.destello(e.x, e.y - 40, 0xff7a1a, 1.6, 380);
        if (e.r) {
          this.onda(e.x, e.y, 0xff7a1a, 200, 700, 2);
          this.s.cameras.main.shake(300, 0.008 * v);
          sfx.simbionte(true);
        }
        break;
      case "tentaculo":
        if (e.x2 !== undefined && e.y2 !== undefined) {
          this.linea(e.x, e.y, e.x2, e.y2, c, 8, 260, 20);
          this.gotas(e.x2, e.y2 - 20, c, 4, 160);
        }
        if (v > 0.2) sfx.simbionte();
        break;
      case "tunel":
        for (const [x, y] of [[e.x, e.y], [e.x2 ?? e.x, e.y2 ?? e.y]] as const) {
          this.gotas(x, y, 0x7a5a30, 10, 260);
          this.humo(x, y, 4, 0xa88a5a, 1);
        }
        if (v > 0) sfx.escarabajo();
        break;
      case "laser":
        this.s.cameras.main.flash(250, 120, 255, 120);
        this.destello(e.x, e.y - 30, 0x7dff6a, 1.6, 300);
        this.texto(e.x, e.y, "¡1 HP!", "#7dff6a");
        sfx.laser();
        break;
      case "agarre":
        this.texto(e.x, e.y, "¡ATRAPADO!", "#ff4a4a");
        this.chispas(e.x, e.y - 30, 0xff4a4a, 8, 240);
        if (v > 0) sfx.cazador();
        break;
      case "texto":
        this.texto(e.x, e.y, e.s ?? "", "#" + (e.c ?? 0xffffff).toString(16).padStart(6, "0"));
        break;
      case "reaparecer":
        this.onda(e.x, e.y, c, 100, 600, 2);
        this.destello(e.x, e.y - 40, 0xffffff, 2, 500);
        this.estrellas(e.x, e.y - 40, 0xffffff, 12);
        sfx.alma();
        break;
      case "mejora":
        this.texto(e.x, e.y - 30, e.s ?? "¡Mejora!", "#ffd23e");
        this.estrellas(e.x, e.y - 50, 0xffd23e, 8);
        sfx.aviso("exito");
        break;
      case "alarma":
        this.onda(e.x, e.y, 0xff3030, 160, 600, 2);
        if (v > 0) sfx.aviso("peligro");
        break;
    }
  }
}
