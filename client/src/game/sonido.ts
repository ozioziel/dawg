// Efectos de sonido sintetizados con WebAudio (sin archivos de audio).
import { guardarLocal, leerLocal } from "../ui/dom";

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let mudo = leerLocal("dawg:mudo") === "1";
const ultimo = new Map<string, number>();

function ctx(): AudioContext | null {
  if (mudo) return null;
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    } catch {
      return null;
    }
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

export function alternarSonido(): boolean {
  mudo = !mudo;
  guardarLocal("dawg:mudo", mudo ? "1" : "0");
  if (master) master.gain.value = mudo ? 0 : 0.35;
  return !mudo;
}

function limitar(clave: string, ms: number): boolean {
  const now = performance.now();
  if (now - (ultimo.get(clave) ?? 0) < ms) return true;
  ultimo.set(clave, now);
  return false;
}

function tono(f0: number, f1: number, dur: number, tipo: OscillatorType, vol: number, delay = 0): void {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(dur: number, vol: number, filtro = 1200, delay = 0): void {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filtro;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  disparo(k: string, cerca = 1): void {
    if (limitar("d" + k, 45)) return;
    const v = 0.12 * cerca;
    if (k === "bala") tono(900, 220, 0.08, "square", v);
    else if (k === "energia") tono(420, 900, 0.14, "sawtooth", v);
    else if (k === "psiquico") tono(1200, 600, 0.1, "sine", v * 1.4);
    else if (k === "bala_roja") tono(700, 180, 0.07, "square", v * 0.7);
    else if (k === "rayo_franco") tono(1800, 100, 0.25, "sawtooth", v * 1.5);
    else if (k === "red_proy") ruido(0.2, v, 600);
    else if (k.startsWith("frasco")) tono(500, 900, 0.12, "triangle", v);
    else if (k === "espina") tono(1400, 700, 0.06, "triangle", v);
    else if (k === "fragmento") tono(300, 150, 0.08, "sine", v * 1.4);
    else if (k === "rayo_laser") tono(2800, 200, 0.35, "sawtooth", v * 1.6);
    else if (k === "misil" || k === "granada") tono(300, 600, 0.3, "sawtooth", v);
  },
  impacto(): void {
    if (limitar("imp", 50)) return;
    ruido(0.06, 0.12, 2500);
  },
  explosion(): void {
    if (limitar("exp", 80)) return;
    ruido(0.6, 0.5, 500);
    tono(120, 40, 0.5, "sine", 0.4);
  },
  hielo(vol = 1, delay = 0): void {
    if (limitar("hielo" + delay, 60)) return;
    tono(2000, 3000, 0.25, "triangle", 0.12 * vol, delay);
    tono(2600, 1800, 0.3, "sine", 0.08 * vol, 0.05 + delay);
  },
  tajo(): void {
    if (limitar("tajo", 60)) return;
    ruido(0.08, 0.14, 4000);
    tono(1800, 600, 0.07, "sawtooth", 0.06);
  },
  /** Mordida húmeda y crujiente. */
  mordida(): void {
    ruido(0.12, 0.22, 1400);
    tono(160, 70, 0.18, "square", 0.12, 0.02);
  },
  teleport(): void {
    tono(1600, 200, 0.22, "sine", 0.14);
    tono(200, 1600, 0.18, "triangle", 0.08, 0.12);
  },
  /** Escarabajo: chasquidos irregulares y crujidos incómodos. */
  escarabajo(fuerte = false): void {
    if (limitar("esc", 90)) return;
    for (let i = 0; i < (fuerte ? 7 : 4); i++) {
      const d = i * (0.03 + Math.random() * 0.05);
      tono(2600 + Math.random() * 1800, 900, 0.025, "square", 0.07, d);
      ruido(0.03, 0.1, 3000 + Math.random() * 3000, d + 0.01);
    }
    if (fuerte) tono(90, 45, 0.4, "sawtooth", 0.18);
  },
  /** Simbionte: sonido viscoso y burbujeante. */
  simbionte(fuerte = false): void {
    if (limitar("sim", 110)) return;
    for (let i = 0; i < 3; i++) tono(180 + Math.random() * 120, 60 + Math.random() * 40, 0.12, "sine", fuerte ? 0.2 : 0.11, i * 0.06);
    ruido(0.18, 0.08, 500);
  },
  curar(): void {
    [523, 784, 1046].forEach((f, i) => tono(f, f * 1.02, 0.18, "sine", 0.1, i * 0.06));
  },
  escaneo(): void {
    tono(900, 1800, 0.6, "sine", 0.08);
  },
  rugido(): void {
    ruido(0.5, 0.25, 700);
    tono(110, 60, 0.6, "sawtooth", 0.2);
  },
  singularidad(): void {
    tono(60, 400, 1.6, "sine", 0.2);
    tono(800, 60, 2.2, "triangle", 0.08, 0.2);
  },
  eclipse(): void {
    tono(220, 55, 1.4, "sawtooth", 0.14);
    tono(330, 82, 1.4, "sine", 0.12, 0.1);
  },
  laser(): void {
    tono(3000, 200, 0.4, "sawtooth", 0.16);
  },
  /** Robot cazador: zumbido metálico rápido. */
  cazador(): void {
    for (let i = 0; i < 6; i++) tono(400 + i * 120, 300, 0.04, "square", 0.08, i * 0.04);
  },
  chapoteo(): void {
    ruido(0.25, 0.15, 900);
  },
  transmutar(): void {
    tono(300, 1200, 0.25, "sine", 0.18);
    tono(450, 1600, 0.25, "triangle", 0.1, 0.05);
  },
  telequinesis(): void {
    tono(200, 900, 0.35, "sine", 0.18);
  },
  muerte(): void {
    tono(400, 60, 0.6, "sawtooth", 0.18);
  },
  alma(): void {
    [660, 880, 1320].forEach((f, i) => tono(f, f, 0.15, "sine", 0.12, i * 0.07));
  },
  aviso(tipo: string): void {
    if (limitar("av" + tipo, 300)) return;
    if (tipo === "peligro") tono(300, 200, 0.25, "square", 0.12);
    else if (tipo === "exito") [523, 659, 784].forEach((f, i) => tono(f, f, 0.14, "triangle", 0.14, i * 0.08));
    else if (tipo === "rescate") tono(880, 440, 0.3, "square", 0.1);
    else tono(700, 700, 0.08, "sine", 0.08);
  },
  ping(): void {
    tono(1046, 1046, 0.1, "sine", 0.15);
    tono(1568, 1568, 0.12, "sine", 0.12, 0.08);
  },
  ladrido(): void {
    tono(300, 150, 0.12, "sawtooth", 0.2);
    tono(320, 160, 0.12, "sawtooth", 0.2, 0.18);
  },
  nota(ok: boolean): void {
    if (ok) tono(880, 1320, 0.08, "triangle", 0.15);
    else tono(200, 120, 0.15, "square", 0.12);
  },
  clic(): void {
    tono(1500, 1200, 0.04, "square", 0.06);
  },
  llamas(): void {
    if (limitar("ll", 140)) return;
    ruido(0.15, 0.08, 1800);
  },
};
