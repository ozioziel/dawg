// Representación visual de personajes (aliens, enemigos, aliados) con animación completa:
//  - Hojas animadas (quieto, caminar, atacar, habilidad, golpe) cuando el arte las tiene.
//  - Animación por código encima de cualquier hoja: respiración, paso con balanceo y aplastamiento,
//    retroceso al disparar, estocadas, mordiscos, preparación y descarga de habilidades, definitivas,
//    sacudida al recibir daño y muerte. Cada tipo de cuerpo se mueve distinto (masa, planta, máquina…).
import Phaser from "phaser";
import { ALTURA, PROF_UI_MUNDO, TEXTO, prof } from "./contexto";

export const ESCALA = 0.74;
const PIES = 118 / 128;

const ARMAS: Record<string, { k: string; dist: number; escala: number; cuerpo?: boolean }> = {
  cambiaformas: { k: "pistola", dist: 10, escala: 0.8 },
  skin1cambiaformas: { k: "pistola", dist: 10, escala: 0.8 },
  cambiaformas_humano: { k: "pistola", dist: 10, escala: 0.8 },
  delmar: { k: "lanza", dist: -8, escala: 0.72 },
  skin1delmar: { k: "lanza", dist: -8, escala: 0.72 },
  vesper: { k: "cuchillo", dist: 12, escala: 0.75, cuerpo: true },
  skin1vesper: { k: "cuchillo", dist: 12, escala: 0.75, cuerpo: true },
  freeze: { k: "lanzahielo", dist: 8, escala: 0.8 },
  skin1freeze: { k: "lanzahielo", dist: 8, escala: 0.8 },
  laser: { k: "rifle_laser", dist: 4, escala: 0.85 },
  oficial: { k: "rifle", dist: 6, escala: 0.8 },
  fusilero: { k: "rifle", dist: 6, escala: 0.8 },
  lanzarredes: { k: "arma_red", dist: 6, escala: 0.8 },
  lanzallamas: { k: "arma_llamas", dist: 6, escala: 0.85 },
  francotirador: { k: "rifle_franco", dist: 0, escala: 0.8 },
};

/** Cómo se mueve cada tipo de cuerpo. */
export type Perfil = "bipedo" | "cuadrupedo" | "masa" | "planta" | "maquina" | "flotante" | "tentaculos" | "pesado";
const PERFIL: Record<string, Perfil> = {
  simbionte: "masa",
  skin1simbionte: "masa",
  simbionte_coloso: "masa",
  cria: "masa",
  curandera: "planta",
  skin1curandera: "planta",
  planta: "planta",
  escarabajo: "cuadrupedo",
  skin1escarabajo: "cuadrupedo",
  perro: "cuadrupedo",
  cazador: "cuadrupedo",
  dron: "flotante",
  robot: "maquina",
  centinela: "maquina",
  pulpo: "tentaculos",
  kraken: "tentaculos",
  jefe: "pesado",
  director: "pesado",
  cambiaformas_berserk: "pesado",
};
export const perfilDe = (sheet: string): Perfil => PERFIL[sheet] ?? "bipedo";

/** Qué animación de la hoja usa cada acción que anuncia el servidor. */
const ANIM_ACCION: Record<string, string> = {
  disparo: "atacar",
  lanzar: "atacar",
  misil: "atacar",
  tajo: "atacar",
  garra: "atacar",
  mordida: "atacar",
  embestida: "atacar",
  agarre: "atacar",
  golpe: "atacar",
  carga: "atacar",
  hab: "habilidad",
  ulti: "habilidad",
  rugido: "habilidad",
  pisoton: "habilidad",
};
/** Duración de la animación por código de cada acción (s). */
const DUR: Record<string, number> = { disparo: 0.13, lanzar: 0.32, misil: 0.4, tajo: 0.24, garra: 0.26, mordida: 0.3, embestida: 0.3, agarre: 0.32, golpe: 0.26, carga: 0.55, hab: 0.45, ulti: 0.85, rugido: 0.7, pisoton: 0.55 };

type Dir = "down" | "up" | "side";
const ease = (u: number) => 1 - (1 - u) * (1 - u);

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
  private animActual = "";
  rx = 0;
  ry = 0;
  private px = 0;
  private py = 0;
  private flash = 0;
  private dolor = 0;
  private ultimoHp = -1;
  private ultimoFlash = -9;
  readonly escala: number;
  perfil: Perfil = "bipedo";
  /** Reloj propio (desfasado para que no respiren todos a la vez). */
  private t = Math.random() * 10;
  private paso = 0;
  private velX = 0;
  private velY = 0;
  private acc: { tipo: string; t: number; dur: number; ang: number } | null = null;
  /** Bloqueo de la animación de la hoja mientras dura una acción. */
  private animAccionHasta = 0;
  /** Congelado / aturdido: sin respiración ni paso. */
  quieto = false;
  aturdido = false;
  /** Escala extra (definitiva del Simbionte, etc.). */
  extraEscala = 1;
  /** Desplazamiento vertical extra (fantasmas). */
  extraY = 0;
  private aparecerT = 0;
  muriendo = false;

  constructor(
    private s: Phaser.Scene,
    sheet: string,
    x: number,
    y: number,
    opts: { nombre?: string; color?: number; escala?: number; aparecer?: boolean } = {},
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
    if (opts.aparecer) this.aparecerT = 0.35;
    this.setSheet(sheet);
  }

  private tieneAnim(anim: string, dir: Dir = this.dir): boolean {
    return this.s.anims.exists(`${this.sheet}-${dir}-${anim}`);
  }

  setSheet(sheet: string): void {
    if (sheet === this.sheet) return;
    if (!this.s.textures.exists(sheet)) return;
    this.sheet = sheet;
    this.animActual = "";
    this.perfil = perfilDe(sheet);
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
    this.dolor = 0.28;
    // Destello blanco como mucho cada 0,35 s (si te disparan seguido no se queda blanco)
    if (this.t - this.ultimoFlash > 0.35) {
      this.flash = 0.07;
      this.ultimoFlash = this.t;
    }
    if (!this.acc && this.tieneAnim("golpe")) {
      this.reproducir("golpe", true);
      this.animAccionHasta = this.t + 0.2;
    }
  }

  /** Acción anunciada por el servidor (o por el propio cliente) con su dirección. */
  accion(tipo: string, ang: number): void {
    if (this.muriendo) return;
    this.acc = { tipo, t: 0, dur: DUR[tipo] ?? 0.3, ang };
    const anim = ANIM_ACCION[tipo];
    if (anim && this.tieneAnim(anim)) {
      this.reproducir(anim, true);
      this.animAccionHasta = this.t + Math.max(0.18, (DUR[tipo] ?? 0.3) * (tipo === "disparo" ? 1.6 : 1));
    }
  }

  private reproducir(anim: string, forzar = false): void {
    const key = `${this.sheet}-${this.dir}-${anim}`;
    if (!forzar && this.animActual === key) return;
    if (!this.s.anims.exists(key)) return;
    this.cuerpo.play(key, !forzar);
    this.animActual = key;
  }

  actualizar(ang: number, moviendo: boolean | null, dt: number, hp?: number, maxHp?: number): void {
    if (this.muriendo) return;
    this.t += dt;
    const x = this.rx;
    const y = this.ry;
    const dx = x - this.px;
    const dy = y - this.py;
    const mov = moviendo ?? Math.hypot(dx, dy) > 0.4;
    if (dt > 0) {
      const k = Math.min(1, dt * 10);
      this.velX += (dx / Math.max(dt, 0.001) - this.velX) * k;
      this.velY += (dy / Math.max(dt, 0.001) - this.velY) * k;
    }
    this.px = x;
    this.py = y;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const dir: Dir = Math.abs(c) > Math.abs(sn) * 0.9 ? "side" : sn > 0 ? "down" : "up";
    const cambioDir = dir !== this.dir;
    this.dir = dir;
    const d = dir === "down" ? 0 : dir === "up" ? 1 : 2;
    this.cuerpo.setFlipX(dir === "side" && c < 0);

    // --- Animación de la hoja
    const enAccion = this.t < this.animAccionHasta && this.cuerpo.anims.isPlaying;
    if (this.quieto) {
      this.cuerpo.anims.pause();
    } else {
      if (this.cuerpo.anims.isPaused) this.cuerpo.anims.resume();
      if (enAccion) {
        if (cambioDir) {
          const base = this.animActual.split("-").pop() ?? "";
          this.reproducir(base, true);
        }
      } else if (mov) {
        this.reproducir("caminar");
        const vel = Math.hypot(this.velX, this.velY);
        this.cuerpo.anims.timeScale = Phaser.Math.Clamp(vel / 190, 0.6, 1.6);
      } else if (this.tieneAnim("quieto")) {
        this.cuerpo.anims.timeScale = 1;
        this.reproducir("quieto");
      } else if (this.animActual !== "" || Number(this.cuerpo.frame.name) !== d * 3) {
        this.cuerpo.stop();
        this.animActual = "";
        this.cuerpo.setFrame(d * 3);
      }
    }

    // --- Animación por código
    let ox = 0;
    let oy = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    const vivo = !this.quieto;
    const p = this.perfil;
    if (vivo) {
      if (mov) {
        const vel = Math.hypot(this.velX, this.velY);
        this.paso += dt * (p === "cuadrupedo" ? 16 : p === "masa" ? 7 : p === "maquina" ? 7.5 : 10.5) * Phaser.Math.Clamp(vel / 200, 0.6, 1.5);
        const s1 = Math.sin(this.paso);
        const a = Math.abs(s1);
        // Inclinación hacia donde avanza (más de lado que de frente)
        const lean = Phaser.Math.Clamp(this.velX / 600, -0.12, 0.12);
        switch (p) {
          case "masa":
            // Se estira hacia delante y tira del resto: aplastamiento grande y lento
            sx = 1 + Math.sin(this.paso * 2) * 0.09;
            sy = 1 - Math.sin(this.paso * 2) * 0.08;
            rot = lean * 0.5;
            break;
          case "planta":
            rot = s1 * 0.07 + lean * 0.4;
            oy = -a * 2;
            sy = 1 + a * 0.03;
            break;
          case "cuadrupedo":
            oy = -a * 1.6;
            rot = Math.sin(this.paso * 2) * 0.04 + lean * 0.3;
            break;
          case "maquina":
            oy = -a * 2.2;
            sy = 1 - (1 - a) * 0.035;
            rot = s1 * 0.02;
            break;
          case "flotante":
            oy = -10 + Math.sin(this.t * 4) * 3;
            rot = lean * 1.6;
            break;
          case "tentaculos":
            sx = 1 + Math.sin(this.paso * 2) * 0.06;
            sy = 1 - Math.sin(this.paso * 2) * 0.06;
            oy = -a * 1.5;
            break;
          case "pesado":
            oy = -a * 2;
            sy = 1 - (1 - a) * 0.05;
            sx = 1 + (1 - a) * 0.03;
            rot = s1 * 0.025 + lean * 0.4;
            break;
          default:
            oy = -a * 3.2;
            sy = 1 + a * 0.035 - (1 - a) * 0.03;
            sx = 1 - a * 0.02 + (1 - a) * 0.02;
            rot = lean + s1 * 0.025;
        }
      } else {
        const r = Math.sin(this.t * (p === "masa" ? 3.1 : 2.2));
        switch (p) {
          case "masa":
            sx = 1 + r * 0.045;
            sy = 1 - r * 0.05;
            break;
          case "planta":
            rot = Math.sin(this.t * 1.3) * 0.045;
            sy = 1 + r * 0.02;
            break;
          case "flotante":
            oy = -10 + Math.sin(this.t * 3) * 4;
            rot = Math.sin(this.t * 2.1) * 0.05;
            break;
          case "maquina":
            sy = 1 + r * 0.006;
            break;
          case "tentaculos":
            sx = 1 + r * 0.04;
            sy = 1 - r * 0.04;
            break;
          default:
            sy = 1 + r * 0.018;
            sx = 1 - r * 0.009;
        }
      }
      // Acción en curso
      if (this.acc) {
        const A = this.acc;
        A.t += dt;
        const u = Math.min(1, A.t / A.dur);
        const ca = Math.cos(A.ang);
        const sa = Math.sin(A.ang) * 0.6;
        const ida = Math.sin(Math.PI * u);
        switch (A.tipo) {
          case "disparo": {
            const k = (1 - u) * (1 - u);
            ox -= ca * 5 * k;
            oy -= sa * 5 * k;
            sx *= 1 + 0.05 * k;
            sy *= 1 - 0.04 * k;
            break;
          }
          case "lanzar":
          case "misil": {
            const atras = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
            rot += (u < 0.4 ? -1 : 1) * atras * 0.16 * Math.sign(ca || 1);
            sy *= 1 + atras * 0.05;
            break;
          }
          case "tajo":
          case "garra":
          case "golpe":
          case "embestida":
          case "agarre":
          case "mordida": {
            const L = A.tipo === "mordida" ? 18 : A.tipo === "agarre" ? 22 : A.tipo === "embestida" ? 20 : 15;
            const prep = u < 0.25 ? -(u / 0.25) * 0.35 : Math.sin(Math.PI * ((u - 0.25) / 0.75));
            ox += ca * L * prep;
            oy += sa * L * prep;
            sx *= 1 + Math.max(0, prep) * 0.12;
            sy *= 1 - Math.max(0, prep) * 0.08;
            rot += Math.max(0, prep) * 0.1 * (ca >= 0 ? 1 : -1);
            break;
          }
          case "carga": {
            ox += ca * 10 * ida;
            oy += sa * 10 * ida;
            sx *= 1 + ida * 0.12;
            sy *= 1 - ida * 0.1;
            rot += ida * 0.14 * (ca >= 0 ? 1 : -1);
            break;
          }
          case "hab":
          case "rugido":
          case "pisoton": {
            if (u < 0.3) {
              const k = u / 0.3;
              sy *= 1 - 0.13 * k;
              sx *= 1 + 0.09 * k;
            } else {
              const k = Math.sin(Math.PI * ((u - 0.3) / 0.7));
              sy *= 1 + 0.12 * k;
              sx *= 1 - 0.07 * k;
              if (A.tipo !== "hab") ox += Math.sin(this.t * 70) * 2.5 * k;
            }
            break;
          }
          case "ulti": {
            oy -= 14 * ida;
            const k = Math.sin(Math.PI * Math.min(1, u * 1.4));
            sx *= 1 + 0.18 * k;
            sy *= 1 + 0.22 * k;
            rot += Math.sin(u * Math.PI * 6) * 0.06 * (1 - u);
            break;
          }
        }
        if (u >= 1) this.acc = null;
      }
    }
    // Dolor: sacudida y encogimiento
    if (this.dolor > 0) {
      this.dolor -= dt;
      const k = Math.max(0, this.dolor / 0.28);
      ox += Math.sin(this.t * 90) * 3.2 * k;
      sx *= 1 + 0.07 * k;
      sy *= 1 - 0.09 * k;
    }
    if (this.aturdido) rot += Math.sin(this.t * 9) * 0.08;
    if (this.aparecerT > 0) {
      this.aparecerT -= dt;
      const k = 1 - Math.max(0, this.aparecerT / 0.35);
      const b = Phaser.Math.Easing.Back.Out(k);
      sx *= b;
      sy *= b;
    }
    sx *= this.extraEscala;
    sy *= this.extraEscala;
    const bx = x + ox;
    const by = y + oy + this.extraY;
    this.cuerpo.setPosition(bx, by).setScale(this.escala * sx, this.escala * sy).setRotation(rot).setDepth(prof(y));
    // Sombra: se encoge si el cuerpo se eleva
    const elev = Math.max(0, -(oy + this.extraY));
    const ks = 1 / (1 + elev / 40);
    this.sombra
      .setPosition(x + ox * 0.6, y + 2)
      .setScale(this.escala * 0.75 * sx * ks * this.extraEscala, this.escala * 0.8 * ks * this.extraEscala)
      .setAlpha(0.8 * ks)
      .setDepth(prof(y) - 30);
    if (this.flash > 0) {
      this.flash -= dt;
      this.cuerpo.setTintFill(0xffffff);
      if (this.flash <= 0) this.cuerpo.clearTint();
    }
    if (this.arma) {
      const a = ARMAS[this.sheet];
      let dist = a.dist;
      let r = ang;
      if (this.acc?.tipo === "disparo") dist -= 6 * (1 - Math.min(1, this.acc.t / this.acc.dur));
      if (this.acc && (this.acc.tipo === "tajo" || this.acc.tipo === "garra")) {
        const u = Math.min(1, this.acc.t / this.acc.dur);
        r += (u < 0.25 ? -1.1 * (u / 0.25) : -1.1 + 2.3 * ease((u - 0.25) / 0.75)) * (c >= 0 ? 1 : -1);
        dist += 8 * Math.sin(Math.PI * u);
      }
      const ox2 = bx + Math.cos(r) * dist;
      const oy2 = by - ALTURA * (this.escala / ESCALA) * sy + Math.sin(r) * dist * 0.6;
      this.arma.setPosition(ox2, oy2).setRotation(r).setFlipY(Math.cos(r) < 0);
      this.arma.setDepth(prof(y) + (Math.sin(r) < -0.35 ? -0.5 : 0.5));
    }
    if (this.escudo) {
      this.escudo.setPosition(bx + c * 22, by - ALTURA + sn * 14).setRotation(ang).setDepth(prof(y) + (sn < -0.2 ? -0.6 : 0.6));
    }
    const top = y - 92 * this.escala * this.extraEscala;
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
    this.aura?.setPosition(bx, by - ALTURA).setDepth(prof(y) - 1);
  }

  /** Barra extra bajo la de vida (infección del Simbionte, etc.). */
  barraExtra(frac: number, color: number, fila = 1, latido = false): void {
    const w = 52 * (this.escala / ESCALA);
    const top = this.ry - 92 * this.escala * this.extraEscala + 6 + (fila - 1) * 9;
    const x = this.rx - w / 2;
    const g = this.barra;
    if (latido) g.fillStyle(color, 0.35 + 0.25 * Math.sin(Date.now() / 90)).fillRect(x - 4, top - 3, w + 8, 12);
    g.fillStyle(0x0a0a0c, 0.95).fillRect(x - 2, top - 1, w + 4, 8);
    g.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(45).color, 1).fillRect(x, top + 1, w, 4);
    g.fillStyle(color, 1).fillRect(x, top + 1, w * Phaser.Math.Clamp(frac, 0, 1), 4);
    g.fillStyle(0xffffff, 0.5).fillRect(x, top + 1, w * Phaser.Math.Clamp(frac, 0, 1), 1);
    // Gota de goo como icono
    g.fillStyle(color, 1).fillCircle(x - 8, top + 3, 4).fillTriangle(x - 11, top + 2, x - 5, top + 2, x - 8, top - 4);
    g.lineStyle(1.5, 0x0a0a0c, 1).strokeCircle(x - 8, top + 3, 4);
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
    if (!this.aura) this.aura = this.s.add.image(this.rx, this.ry, "fx_brillo").setScale(2.2).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setTint(color).setScale(2.1 + Math.sin(Date.now() / 160) * 0.15);
  }

  setVisible(v: boolean): void {
    this.cuerpo.setVisible(v);
    this.sombra.setVisible(v);
    this.arma?.setVisible(v);
    this.escudo?.setVisible(v);
    this.etiqueta?.setVisible(v);
    this.barra.setVisible(v);
  }

  /** Muerte animada: según el cuerpo se desploma, se deshace en un charco, se marchita o revienta. */
  morir(): void {
    if (this.muriendo) return;
    this.muriendo = true;
    this.barra.destroy();
    this.etiqueta?.destroy();
    this.overlay?.destroy();
    this.aura?.destroy();
    this.arma?.destroy();
    this.escudo?.destroy();
    this.cuerpo.anims.stop();
    if (this.tieneAnim("golpe")) this.cuerpo.play(`${this.sheet}-${this.dir}-golpe`);
    this.cuerpo.clearTint();
    const s = this.s;
    const base = { sx: this.cuerpo.scaleX, sy: this.cuerpo.scaleY };
    const lado = this.cuerpo.flipX ? -1 : 1;
    const fin = () => {
      this.cuerpo.destroy();
      this.sombra.destroy();
    };
    s.tweens.add({ targets: this.sombra, alpha: 0, duration: 900, delay: 300 });
    if (this.perfil === "masa") {
      s.tweens.add({ targets: this.cuerpo, scaleX: base.sx * 1.7, scaleY: base.sy * 0.12, alpha: 0.2, duration: 700, ease: "Quad.In", onComplete: fin });
    } else if (this.perfil === "planta") {
      s.tweens.add({ targets: this.cuerpo, rotation: 0.9 * lado, scaleY: base.sy * 0.55, alpha: 0, duration: 800, ease: "Sine.In", onComplete: fin });
    } else if (this.perfil === "maquina" || this.perfil === "flotante") {
      s.tweens.add({
        targets: this.cuerpo,
        x: { from: this.cuerpo.x - 3, to: this.cuerpo.x + 3 },
        duration: 50,
        yoyo: true,
        repeat: 4,
        onComplete: () => s.tweens.add({ targets: this.cuerpo, scaleX: base.sx * 1.25, scaleY: base.sy * 0.2, alpha: 0, duration: 220, ease: "Quad.In", onComplete: fin }),
      });
    } else if (this.perfil === "tentaculos") {
      s.tweens.add({ targets: this.cuerpo, scaleX: base.sx * 1.4, scaleY: base.sy * 0.3, alpha: 0, duration: 500, ease: "Quad.In", onComplete: fin });
    } else {
      // Se desploma de lado, rebota un poco y se desvanece
      s.tweens.add({ targets: this.cuerpo, scaleY: base.sy * 1.08, duration: 90, yoyo: true });
      s.tweens.add({
        targets: this.cuerpo,
        rotation: 1.45 * lado,
        y: this.cuerpo.y + 6,
        duration: 380,
        delay: 80,
        ease: "Bounce.Out",
        onComplete: () => s.tweens.add({ targets: this.cuerpo, alpha: 0, duration: 650, delay: 250, onComplete: fin }),
      });
    }
  }

  destruir(): void {
    this.sombra.destroy();
    this.cuerpo.destroy();
    this.arma?.destroy();
    this.escudo?.destroy();
    this.etiqueta?.destroy();
    if (this.barra.active) this.barra.destroy();
    this.overlay?.destroy();
    this.aura?.destroy();
  }
}
