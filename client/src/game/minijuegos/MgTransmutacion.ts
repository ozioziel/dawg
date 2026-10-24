// Transmutación (Del mar): por la cinta pasan objetos; cuando uno está en el transmutador,
// pulsa en qué hay que convertirlo según su cartel (coral, pulpo o burbuja).
import Phaser from "phaser";
import { TEXTO } from "../contexto";
import { Minijuego } from "./Minijuego";

const RESULTADOS = [
  { nombre: "Coral", color: 0xff8a3a },
  { nombre: "Pulpo", color: 0xff6b3d },
  { nombre: "Burbuja", color: 0x5ab8ff },
];
const OBJETOS = ["barril", "caja", "frasco_verde", "bloque"];
const CINTA_Y = 210;
const ZONA = { x0: 420, x1: 560 };
/** Los objetos entran y salen por los extremos de la cinta. */
const ENTRADA = 52;
const BOTON_Y = 330;

interface Item {
  x: number;
  pide: number;
  estado: "pendiente" | "hecho" | "fallado";
  img: Phaser.GameObjects.Image;
  cartel: Phaser.GameObjects.Text;
}

export class MgTransmutacion extends Minijuego {
  private items: Item[] = [];
  private proximo = 1;
  private hechos = 0;
  private desplaz = 0;
  private flashBoton = -1;
  private flashHasta = 0;
  private estado!: Phaser.GameObjects.Text;

  constructor() {
    super("MgTransmutacion");
    this.pw = 700;
    this.ph = 470;
  }

  protected crear(): void {
    this.items = [];
    this.proximo = 1;
    this.hechos = 0;
    const t = (x: number, y: number, s: string, size: number, color = "#eaf6ff") => {
      const o = this.add.text(x, y, s, { ...TEXTO, fontSize: `${size}px`, color }).setOrigin(0.5);
      this.cont.add(o);
      return o;
    };
    t((ZONA.x0 + ZONA.x1) / 2, CINTA_Y - 92, "TRANSMUTADOR", 15, "#3ef0ff");
    RESULTADOS.forEach((r, i) => t(130 + i * 220, BOTON_Y + 38, `${i + 1} · ${r.nombre}`, 20));
    this.estado = t(this.pw / 2, 96, "", 17, "#ffd23e");
    t(this.pw / 2, this.ph - 22, "Cuando un objeto esté dentro del TRANSMUTADOR, pulsa lo que pide su cartel (clic o teclas 1, 2, 3).", 13, "#a9c6db");
    this.input.on("pointerdown", () => {
      const p = this.puntero();
      if (p.y < BOTON_Y || p.y > BOTON_Y + 76) return;
      const i = Math.floor((p.x - 20) / 220);
      if (i >= 0 && i < 3) this.pulsar(i);
    });
    ["ONE", "TWO", "THREE"].forEach((k, i) => this.input.keyboard!.on(`keydown-${k}`, () => this.pulsar(i)));
  }

  private get velocidad(): number {
    return this.corto ? 135 : 90 + this.progreso * 65;
  }

  private nuevoItem(): void {
    const pide = Phaser.Math.Between(0, 2);
    const img = this.add.image(ENTRADA, CINTA_Y, OBJETOS[Phaser.Math.Between(0, OBJETOS.length - 1)]).setDisplaySize(58, 58);
    const cartel = this.add
      .text(ENTRADA, CINTA_Y - 58, `→ ${RESULTADOS[pide].nombre}`, { ...TEXTO, fontSize: "15px", color: "#" + RESULTADOS[pide].color.toString(16), backgroundColor: "#0a1622", padding: { x: 6, y: 2 } })
      .setOrigin(0.5);
    this.cont.add([img, cartel]);
    this.items.push({ x: ENTRADA, pide, estado: "pendiente", img, cartel });
  }

  /** El objeto pendiente que está ahora dentro del transmutador. */
  private activo(): Item | undefined {
    return this.items.find((it) => it.estado === "pendiente" && it.x >= ZONA.x0 && it.x <= ZONA.x1);
  }

  private pulsar(i: number): void {
    if (this.terminado) return;
    this.flashBoton = i;
    this.flashHasta = this.time.now + 180;
    const it = this.activo();
    if (!it) return;
    if (it.pide !== i) {
      this.error(`Ese pedía ${RESULTADOS[it.pide].nombre.toLowerCase()}.`);
      return;
    }
    it.estado = "hecho";
    this.hechos++;
    this.acierto();
    if (i === 0) it.img.setTexture("cobertura").setDisplaySize(70, 58);
    else if (i === 1) it.img.setTexture("pulpo", 0).setDisplaySize(66, 66);
    else it.img.setVisible(false);
    it.cartel.setText("✔").setColor("#7dff6a");
  }

  protected tick(dt: number): void {
    const v = this.velocidad;
    this.desplaz = (this.desplaz + v * dt) % 40;
    if (!this.terminado) {
      this.proximo -= dt;
      const ultimo = this.items[this.items.length - 1];
      if (this.proximo <= 0 && (!ultimo || ultimo.x > ENTRADA + 130)) {
        this.nuevoItem();
        this.proximo = this.corto ? 1.6 : Math.max(1.4, 2.6 - this.progreso * 1.2);
      }
      for (const it of this.items) {
        it.x += v * dt;
        if (it.estado === "pendiente" && it.x > ZONA.x1) {
          it.estado = "fallado";
          it.img.setTint(0x666666);
          it.cartel.setText("✖").setColor("#ff4a4a");
          this.error("Se te pasó un objeto sin transmutar.");
        }
      }
    }
    const fin = this.pw - ENTRADA;
    for (const it of this.items) {
      // Aparecen y desaparecen suavemente en los extremos de la cinta
      const alfa = Math.min(1, (it.x - ENTRADA) / 30 + 0.2, (fin - it.x) / 40);
      it.img.setX(it.x).setAlpha(Math.max(0, alfa));
      it.cartel.setX(it.x).setAlpha(Math.max(0, alfa));
    }
    this.items = this.items.filter((it) => {
      if (it.x < fin) return true;
      it.img.destroy();
      it.cartel.destroy();
      return false;
    });
    this.estado.setText(this.terminado ? "" : `Transmutados: ${this.hechos}`);
    this.dibujar();
  }

  private dibujar(): void {
    const g = this.g.clear();
    // Cinta
    g.fillStyle(0x2c3240).fillRect(20, CINTA_Y - 36, this.pw - 40, 72).lineStyle(3, 0x0a0a0c).strokeRect(20, CINTA_Y - 36, this.pw - 40, 72);
    g.lineStyle(3, 0x4a5262);
    for (let x = 20 + this.desplaz; x < this.pw - 20; x += 40) g.lineBetween(x, CINTA_Y - 34, x, CINTA_Y + 34);
    // Transmutador
    const activo = this.activo();
    const brillo = activo ? 0.35 + 0.2 * Math.sin(this.time.now / 90) : 0.15;
    g.fillStyle(0x3ef0ff, brillo).fillRect(ZONA.x0, CINTA_Y - 70, ZONA.x1 - ZONA.x0, 140);
    g.lineStyle(4, 0x3ef0ff).strokeRect(ZONA.x0, CINTA_Y - 70, ZONA.x1 - ZONA.x0, 140);
    // Burbujas ya hechas
    for (const it of this.items) {
      if (it.estado === "hecho" && it.pide === 2) {
        g.fillStyle(0x5ab8ff, 0.5).fillCircle(it.x, CINTA_Y - 6, 26).lineStyle(3, 0xd8f5ff).strokeCircle(it.x, CINTA_Y - 6, 26);
        g.fillStyle(0xffffff, 0.8).fillCircle(it.x - 9, CINTA_Y - 16, 6);
      }
    }
    // Botones
    RESULTADOS.forEach((r, i) => {
      const x = 20 + i * 220;
      const flash = i === this.flashBoton && this.time.now < this.flashHasta;
      g.fillStyle(flash ? 0xffffff : r.color, activo ? 1 : 0.55).fillRoundedRect(x, BOTON_Y, 210, 76, 14);
      g.lineStyle(3, 0x0a0a0c).strokeRoundedRect(x, BOTON_Y, 210, 76, 14);
    });
  }
}
