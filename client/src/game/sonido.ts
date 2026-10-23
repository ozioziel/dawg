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
  hielo(): void {
    tono(2000, 3000, 0.25, "triangle", 0.12);
    tono(2600, 1800, 0.3, "sine", 0.08, 0.05);
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
