// Orbe inestable (Inteligente): guía el orbe con telequinesis entre láseres hasta los enchufes.
import Phaser from "phaser";
import { TEXTO } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

interface Laser {
  tipo: "giro" | "barrido";
  cx: number;
  cy: number;
  largo: number;
  ang: number;
  vel: number;
  vertical?: boolean;
  fase?: number;
}

const X0 = 24;
const Y0 = 66;
const X1 = 656;
const Y1 = 420;
const R_ORBE = 12;

export class MgOrbe extends Minijuego {
  private orbe = { x: 100, y: 240 };
  private enchufe = { x: 500, y: 240 };
  private carga = 0;
  private conc = 100;
  private invuln = 0;
  private hechos = 0;
  private lasers: Laser[] = [];
  private ayuda!: Phaser.GameObjects.Text;

  constructor() {
    super("MgOrbe");
    this.ph = 476;
  }

  protected crear(): void {
    this.orbe = { x: X0 + 60, y: (Y0 + Y1) / 2 };
    this.carga = 0;
    this.conc = 100;
    this.hechos = 0;
    this.lasers = [
      { tipo: "giro", cx: 260, cy: 170, largo: 190, ang: 0, vel: 1.1 },
      { tipo: "giro", cx: 440, cy: 320, largo: 210, ang: 1.2, vel: -0.9 },
      { tipo: "barrido", cx: 0, cy: 0, largo: 0, ang: 0, vel: 0.55, vertical: false, fase: 0 },
      { tipo: "barrido", cx: 0, cy: 0, largo: 0, ang: 0, vel: 0.4, vertical: true, fase: 1.7 },
    ];
    this.nuevoEnchufe();
    this.ayuda = this.add.text(this.pw / 2, this.ph - 16, "Mueve el ratón: el orbe te sigue. Llévalo al enchufe brillante y aguanta hasta cargarlo. ¡No toques los láseres!", {
      ...TEXTO,
      fontSize: "13px",
      color: "#a9c6db",
      align: "center",
      wordWrap: { width: this.pw - 40 },
    });
    this.ayuda.setOrigin(0.5, 1);
    this.cont.add(this.ayuda);
  }

  private nuevoEnchufe(): void {
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(X0 + 40, X1 - 40);
      const y = Phaser.Math.Between(Y0 + 40, Y1 - 60);
      if (Phaser.Math.Distance.Between(x, y, this.orbe.x, this.orbe.y) > 260) {
        this.enchufe = { x, y };
        return;
      }
    }
    this.enchufe = { x: (X0 + X1) / 2, y: (Y0 + Y1) / 2 };
  }

  private segmentos(t: number): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const l of this.lasers) {
      if (l.tipo === "giro") {
        const dx = (Math.cos(l.ang) * l.largo) / 2;
        const dy = (Math.sin(l.ang) * l.largo) / 2;
        out.push([l.cx - dx, l.cy - dy, l.cx + dx, l.cy + dy]);
      } else if (l.vertical) {
        if (this.progreso < 0.3 && !this.corto) continue;
        const x = X0 + ((Math.sin(t * l.vel + (l.fase ?? 0)) + 1) / 2) * (X1 - X0);
        const hueco = Y0 + ((Math.sin(t * 0.7 + 1) + 1) / 2) * (Y1 - Y0 - 110) + 55;
        out.push([x, Y0, x, hueco - 55], [x, hueco + 55, x, Y1]);
      } else {
        const y = Y0 + ((Math.sin(t * l.vel + (l.fase ?? 0)) + 1) / 2) * (Y1 - Y0);
        const hueco = X0 + ((Math.sin(t * 0.5) + 1) / 2) * (X1 - X0 - 120) + 60;
        out.push([X0, y, hueco - 60, y], [hueco + 60, y, X1, y]);
      }
    }
    return out;
  }

  protected tick(dt: number): void {
    const t = this.time.now / 1000;
    const dif = this.corto ? 1.7 : 1 + this.progreso * 0.9;
    for (const l of this.lasers) if (l.tipo === "giro") l.ang += l.vel * dt * dif;
    if (!this.terminado) {
      const p = this.puntero();
      const tx = Phaser.Math.Clamp(p.x, X0 + R_ORBE, X1 - R_ORBE);
      const ty = Phaser.Math.Clamp(p.y, Y0 + R_ORBE, Y1 - R_ORBE);
      const k = Math.min(1, dt * 5.5);
      this.orbe.x += (tx - this.orbe.x) * k;
      this.orbe.y += (ty - this.orbe.y) * k;
    }
    const segs = this.segmentos(t * dif);
    this.invuln -= dt;
    if (!this.terminado) {
      for (const [ax, ay, bx, by] of segs) {
        const d = Phaser.Math.Distance.Between(this.orbe.x, this.orbe.y, ...cercano(ax, ay, bx, by, this.orbe.x, this.orbe.y));
        if (d < R_ORBE + 3 && this.invuln <= 0) {
          this.conc -= 24;
          this.invuln = 0.9;
          sfx.nota(false);
          this.cameras.main.shake(120, 0.006);
        }
      }
      const golpe = this.golpeRecibido();
      if (golpe > 0) this.conc -= 12 + golpe * 0.5;
      this.conc = Math.min(100, this.conc + 3 * dt);
      if (Phaser.Math.Distance.Between(this.orbe.x, this.orbe.y, this.enchufe.x, this.enchufe.y) < 26) {
        this.carga += dt / 2.2;
        if (this.carga >= 1) {
          this.carga = 0;
          this.hechos++;
          sfx.nota(true);
          this.nuevoEnchufe();
        }
      } else this.carga = Math.max(0, this.carga - dt * 0.5);
      if (this.conc <= 0) this.fallar("Perdió la concentración.");
    }

    // Dibujo
    const g = this.g.clear();
    g.fillStyle(0x0d1f2a, 1).fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.lineStyle(1, 0x1f4a55, 0.6);
    for (let x = X0; x <= X1; x += 32) g.lineBetween(x, Y0, x, Y1);
    for (let y = Y0; y <= Y1; y += 32) g.lineBetween(X0, y, X1, y);
    // Enchufe
    g.fillStyle(0x7dff6a, 0.2 + 0.15 * Math.sin(t * 6)).fillCircle(this.enchufe.x, this.enchufe.y, 30);
    g.lineStyle(4, 0x7dff6a).strokeCircle(this.enchufe.x, this.enchufe.y, 26);
    if (this.carga > 0) g.lineStyle(6, 0xffffff).beginPath().arc(this.enchufe.x, this.enchufe.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.carga).strokePath();
    // Láseres
    for (const [ax, ay, bx, by] of segs) {
      g.lineStyle(9, 0xff2a2a, 0.25).lineBetween(ax, ay, bx, by);
      g.lineStyle(3, 0xffb0b0, 1).lineBetween(ax, ay, bx, by);
    }
    for (const l of this.lasers) if (l.tipo === "giro") g.fillStyle(0x5d6678).fillCircle(l.cx, l.cy, 9).lineStyle(2, 0x0a0a0c).strokeCircle(l.cx, l.cy, 9);
    // Orbe
    const parpadeo = this.invuln > 0 && Math.floor(t * 20) % 2 === 0;
    g.fillStyle(0xc08bff, 0.25).fillCircle(this.orbe.x, this.orbe.y, R_ORBE * 2.2);
    g.fillStyle(parpadeo ? 0xffffff : 0xe0c8ff, 1).fillCircle(this.orbe.x, this.orbe.y, R_ORBE);
    g.lineStyle(3, 0x0a0a0c).strokeCircle(this.orbe.x, this.orbe.y, R_ORBE);
    // Concentración
    g.fillStyle(0x000000, 0.8).fillRect(X1 - 220, 46, 220, 10);
    g.fillStyle(this.conc > 35 ? 0xc08bff : 0xff4a4a).fillRect(X1 - 220, 46, 2.2 * Math.max(0, this.conc), 10);
    g.lineStyle(2, 0x0a0a0c).strokeRect(X1 - 220, 46, 220, 10);
    this.info.setText(`Concentración · enchufes ${this.hechos} · ${Math.ceil(this.pz?.tiempo ?? 0)} s`);
  }
}

function cercano(ax: number, ay: number, bx: number, by: number, px: number, py: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return [ax + dx * t, ay + dy * t];
}
