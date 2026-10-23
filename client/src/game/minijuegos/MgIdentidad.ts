// Control de identidad (Cambiaformas disfrazado): credencial de memoria, pulso al ritmo y preguntas.
import Phaser from "phaser";
import { TEXTO, TITULO } from "../contexto";
import { sfx } from "../sonido";
import { Minijuego } from "./Minijuego";

const PREGUNTAS: [string, string, string, string][] = [
  ["¿Qué desayunas normalmente?", "Pan con huevo", "Tornillos tibios", "Luz solar concentrada"],
  ["¿Cuántos ojos tienes?", "Dos", "Los necesarios", "Depende del día"],
  ["¿Qué haces cuando llueve?", "Abro el paraguas", "Absorbo el agua por los poros", "Llamo a la nave nodriza"],
  ["¿Dónde naciste?", "En un hospital", "En una incubadora rota", "En Kepler-22b"],
  ["¿Cómo duermes?", "Acostado en una cama", "Colgado del techo", "No duermo, me recargo"],
  ["¿Qué es un perro?", "Una mascota", "Un depredador natural", "Comida de emergencia"],
  ["¿De qué color es tu sangre?", "Roja", "Verde fosforito", "¿Sangre?"],
  ["Di algo muy humano:", "Qué sueño tengo", "SALUDOS, TERRÍCOLA", "Bip bup"],
  ["¿Para qué sirven tus gafas?", "Para ver mejor", "Para tapar el tercer ojo", "Son antenas"],
  ["¿Qué hora es?", "No sé, como las tres", "Ciclo 4 del sol amarillo", "La hora de la invasión"],
  ["¿Cuál es tu comida favorita?", "La pizza", "Los metales blandos", "Las vacas (enteras)"],
  ["¿Qué haces los domingos?", "Descanso y veo series", "Abduzco ganado", "Mudo de piel"],
];

const CELDA = 50;
const GX = 60;
const GY = 110;

export class MgIdentidad extends Minijuego {
  private fallos = 0;
  private fase = -1;
  // Credencial
  private patron = new Set<number>();
  private hallados = new Set<number>();
  private mostrarHasta = 0;
  private tam = 4;
  private errorCelda = -1;
  private errorT = 0;
  // Pulso
  private pulso = 45;
  private marcador = 0;
  private periodo = 1.15;
  private pulsado = false;
  private flashPulso = 0;
  private flashColor = 0xffffff;
  // Preguntas
  private preguntas: [string, string, string, string][] = [];
  private qi = 0;
  private qT = 0;
  private qTiempo = 10;
  private botones: Phaser.GameObjects.Text[] = [];
  private qTexto!: Phaser.GameObjects.Text;
  private faseTxt!: Phaser.GameObjects.Text;
  private ayuda!: Phaser.GameObjects.Text;
  private espacio!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("MgIdentidad");
  }

  protected crear(): void {
    this.fallos = 0;
    this.fase = -1;
    this.titulo.setText("Control de identidad");
    this.faseTxt = this.add.text(this.pw / 2, 72, "", { ...TITULO, fontSize: "26px", color: "#ffd23e" }).setOrigin(0.5);
    this.ayuda = this.add.text(this.pw / 2, this.ph - 16, "", { ...TEXTO, fontSize: "14px", color: "#a9c6db", align: "center", wordWrap: { width: this.pw - 40 } }).setOrigin(0.5, 1);
    this.qTexto = this.add.text(this.pw / 2, 150, "", { ...TEXTO, fontSize: "22px", align: "center", wordWrap: { width: this.pw - 80 } }).setOrigin(0.5);
    this.cont.add([this.faseTxt, this.ayuda, this.qTexto]);
    this.espacio = this.input.keyboard!.addKey("SPACE");
    this.input.on("pointerdown", () => this.clic());
    this.preguntas = Phaser.Utils.Array.Shuffle([...PREGUNTAS]).slice(0, 3);
  }

  private get nFase(): number {
    return Math.min(2, Math.floor(this.progreso * 3));
  }

  private entrarFase(f: number): void {
    this.fase = f;
    for (const b of this.botones) b.destroy();
    this.botones = [];
    this.qTexto.setText("");
    if (f === 0) {
      this.faseTxt.setText("1 · Credencial");
      this.ayuda.setText("Memoriza las casillas iluminadas de la credencial y luego márcalas con clic.");
      this.nuevoPatron();
    } else if (f === 1) {
      this.faseTxt.setText("2 · Detector de mentiras");
      this.ayuda.setText("Pulsa ESPACIO cuando la marca pase por la zona verde para mantener el pulso tranquilo.");
      this.pulso = 45;
      this.marcador = 0;
      this.periodo = this.corto ? 0.95 : 1.15;
    } else {
      this.faseTxt.setText("3 · Preguntas de seguridad");
      this.ayuda.setText("Elige la respuesta más HUMANA (clic o teclas 1, 2, 3).");
      this.qi = 0;
      const n = this.corto ? 1 : 3;
      this.qTiempo = (this.def.duracion / 3 - 1) / n;
      this.preguntas = this.preguntas.slice(0, n);
      this.mostrarPregunta();
      this.input.keyboard!.on("keydown-ONE", () => this.responder(0));
      this.input.keyboard!.on("keydown-TWO", () => this.responder(1));
      this.input.keyboard!.on("keydown-THREE", () => this.responder(2));
    }
  }

  private error(msg: string): void {
    this.fallos++;
    sfx.nota(false);
    this.cameras.main.shake(100, 0.005);
    if (this.fallos >= 3) this.fallar(msg);
  }

  // ------------------------------------------------ credencial
  private nuevoPatron(): void {
    this.patron.clear();
    this.hallados.clear();
    const n = Math.min(8, this.tam + 1);
    while (this.patron.size < n) this.patron.add(Phaser.Math.Between(0, 15));
    this.tam++;
    this.mostrarHasta = this.time.now + (this.corto ? 2200 : 3000);
  }

  private clic(): void {
    if (this.terminado) return;
    const p = this.puntero();
    if (this.fase === 0) {
      if (this.time.now < this.mostrarHasta) return;
      const cx = Math.floor((p.x - GX) / CELDA);
      const cy = Math.floor((p.y - GY) / CELDA);
      if (cx < 0 || cy < 0 || cx > 3 || cy > 3) return;
      const i = cy * 4 + cx;
      if (this.hallados.has(i)) return;
      if (this.patron.has(i)) {
        this.hallados.add(i);
        sfx.nota(true);
        if (this.hallados.size === this.patron.size) this.nuevoPatron();
      } else {
        this.errorCelda = i;
        this.errorT = this.time.now + 400;
        this.error("La credencial no coincide.");
      }
    } else if (this.fase === 2) {
      const i = this.botones.findIndex((b) => b.getBounds().contains(p.x * this.cont.scaleX + this.cont.x, p.y * this.cont.scaleY + this.cont.y));
      if (i >= 0) this.responder(i);
    }
  }

  // ------------------------------------------------ preguntas
  private orden: number[] = [];

  private mostrarPregunta(): void {
    for (const b of this.botones) b.destroy();
    this.botones = [];
    if (this.qi >= this.preguntas.length) {
      this.qTexto.setText("Verificando…");
      return;
    }
    const [q, ...ops] = this.preguntas[this.qi];
    this.qTexto.setText(q);
    this.orden = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    this.orden.forEach((o, k) => {
      const b = this.add
        .text(this.pw / 2, 220 + k * 56, `${k + 1}. ${ops[o]}`, { ...TEXTO, fontSize: "20px", backgroundColor: "#1c3350", padding: { x: 16, y: 8 } })
        .setOrigin(0.5);
      this.cont.add(b);
      this.botones.push(b);
    });
    this.qT = this.qTiempo;
  }

  private responder(k: number): void {
    if (this.fase !== 2 || this.terminado || this.qi >= this.preguntas.length || !this.botones[k]) return;
    if (this.orden[k] === 0) sfx.nota(true);
    else this.error("Respuesta sospechosa.");
    this.qi++;
    this.mostrarPregunta();
  }

  // ------------------------------------------------ bucle
  protected tick(dt: number): void {
    if (this.terminado) return;
    const f = this.nFase;
    if (f !== this.fase) this.entrarFase(f);
    const g = this.g.clear();
    const now = this.time.now;
    // Fallos
    for (let i = 0; i < 3; i++) g.fillStyle(i < this.fallos ? 0xff4a4a : 0x2a3a4a).fillCircle(this.pw - 40 - i * 26, 56, 9).lineStyle(2, 0x0a0a0c).strokeCircle(this.pw - 40 - i * 26, 56, 9);

    if (this.fase === 0) {
      const mostrando = now < this.mostrarHasta;
      g.fillStyle(0xeef3f5).fillRoundedRect(GX - 20, GY - 20, CELDA * 4 + 40, CELDA * 4 + 40, 12).lineStyle(4, 0x0a0a0c).strokeRoundedRect(GX - 20, GY - 20, CELDA * 4 + 40, CELDA * 4 + 40, 12);
      for (let i = 0; i < 16; i++) {
        const x = GX + (i % 4) * CELDA;
        const y = GY + Math.floor(i / 4) * CELDA;
        let col = 0xc8d1d6;
        if (mostrando && this.patron.has(i)) col = 0x2f6fd6;
        if (this.hallados.has(i)) col = 0x7dff6a;
        if (i === this.errorCelda && now < this.errorT) col = 0xff4a4a;
        g.fillStyle(col).fillRoundedRect(x + 3, y + 3, CELDA - 6, CELDA - 6, 6).lineStyle(2, 0x0a0a0c).strokeRoundedRect(x + 3, y + 3, CELDA - 6, CELDA - 6, 6);
      }
      g.fillStyle(0xffd23e).fillRoundedRect(330, 130, 300, 170, 12).lineStyle(3, 0x0a0a0c).strokeRoundedRect(330, 130, 300, 170, 12);
      g.fillStyle(0xf3cf9f).fillCircle(390, 200, 34).lineStyle(3, 0x0a0a0c).strokeCircle(390, 200, 34);
      g.fillStyle(0x6b3f1f).fillRect(358, 166, 64, 18);
      g.lineStyle(4, 0x0a0a0c).lineBetween(450, 180, 600, 180).lineBetween(450, 210, 580, 210).lineBetween(450, 240, 560, 240);
      this.qTexto.setText(mostrando ? "¡Memoriza!" : `Marca ${this.patron.size - this.hallados.size} casilla(s)`).setPosition(480, 330).setFontSize(20);
    } else if (this.fase === 1) {
      const dif = this.corto ? 1.3 : 1;
      const antes = this.marcador;
      this.marcador = (this.marcador + dt / (this.periodo / dif)) % 1;
      if (this.marcador < antes) {
        if (!this.pulsado) this.cambioPulso(+11);
        this.pulsado = false;
      }
      this.pulso += 3.5 * dt;
      if (Phaser.Input.Keyboard.JustDown(this.espacio)) {
        const enZona = Math.abs(this.marcador - 0.5) < 0.09;
        if (enZona && !this.pulsado) {
          this.pulsado = true;
          this.cambioPulso(-10);
          sfx.nota(true);
        } else {
          this.cambioPulso(+14);
          sfx.nota(false);
        }
      }
      if (this.pulso >= 100) this.fallar("Su pulso se disparó: ¡es un impostor!");
      this.pulso = Math.max(30, this.pulso);
      // Monitor
      const mx = 80;
      const my = 140;
      const mw = 520;
      g.fillStyle(0x0a1a12).fillRoundedRect(mx, my, mw, 130, 10).lineStyle(3, 0x0a0a0c).strokeRoundedRect(mx, my, mw, 130, 10);
      g.lineStyle(3, this.pulso > 75 ? 0xff4a4a : 0x7dff6a, 1).beginPath();
      for (let i = 0; i <= 100; i++) {
        const x = mx + 10 + (i / 100) * (mw - 20);
        const fase = (i / 100 + now / 1000) % 0.25;
        const pico = fase > 0.1 && fase < 0.14 ? -50 * (this.pulso / 100) : fase > 0.14 && fase < 0.16 ? 25 : 0;
        if (i === 0) g.moveTo(x, my + 65 + pico);
        else g.lineTo(x, my + 65 + pico);
      }
      g.strokePath();
      // Pista de ritmo
      const py = 320;
      g.fillStyle(0x1c3350).fillRoundedRect(mx, py, mw, 34, 10);
      g.fillStyle(0x7dff6a, 0.6).fillRect(mx + mw * 0.41, py, mw * 0.18, 34);
      g.fillStyle(0xffffff).fillRect(mx + mw * this.marcador - 4, py - 6, 8, 46);
      g.lineStyle(3, 0x0a0a0c).strokeRoundedRect(mx, py, mw, 34, 10);
      if (this.flashPulso > 0) {
        this.flashPulso -= dt;
        g.lineStyle(6, this.flashColor, this.flashPulso * 3).strokeRoundedRect(mx - 4, py - 4, mw + 8, 42, 12);
      }
      this.qTexto.setText(`Pulso: ${Math.round(this.pulso)} (máx. 100)`).setPosition(this.pw / 2, 118).setFontSize(18);
    } else if (this.fase === 2 && this.qi < this.preguntas.length) {
      this.qTexto.setPosition(this.pw / 2, 150).setFontSize(22);
      this.qT -= dt;
      g.fillStyle(0x000000, 0.7).fillRect(this.pw / 2 - 150, 380, 300, 8).fillStyle(0xffd23e).fillRect(this.pw / 2 - 150, 380, 300 * Math.max(0, this.qT / this.qTiempo), 8);
      if (this.qT <= 0) {
        this.error("No respondió a tiempo.");
        this.qi++;
        this.mostrarPregunta();
      }
    }
    if (this.golpeRecibido() > 0) this.fallar("¡Le pegaron y se rompió el disfraz!");
  }

  private cambioPulso(d: number): void {
    this.pulso += d;
    this.flashPulso = 0.3;
    this.flashColor = d < 0 ? 0x7dff6a : 0xff4a4a;
  }
}
