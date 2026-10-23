// Director de oleadas (estilo Left 4 Dead): encuentros por sala, oleadas durante los
// minijuegos, castigo al fallar y patrullas para mantener la presión.
// La dificultad NO baja aunque muera un alien.
import { MAX_ENEMIES_ALIVE, PUZZLES, dist, type EnemyType } from "@dawg/shared";
import type { Partida } from "./Partida";

type Oleada = EnemyType[];

/** Primera vez que alguien entra en la sala. */
const ENCUENTROS: Record<string, Oleada> = {
  almacen: ["fusilero", "fusilero", "quimico"],
  r1: ["fusilero", "fusilero", "perro"],
  hub: ["fusilero", "escudo", "medico", "fusilero"],
  r2: ["ingeniero", "perro", "fusilero"],
  r3: ["fusilero", "fusilero", "bioquimico"],
  pasillo: ["francotirador", "criogenista", "fusilero"],
  r4: ["escudo", "medico", "fusilero"],
  r5: ["francotirador", "francotirador", "fusilero"],
  r6: ["lanzallamas", "lanzarredes", "fusilero"],
  r7: ["escudo", "escudo", "medico"],
};

/** Oleadas que llegan mientras se resuelve cada puzzle (se repiten en ciclo). */
const OLEADAS: Record<string, Oleada[]> = {
  p1: [
    ["fusilero", "fusilero", "perro"],
    ["fusilero", "lanzarredes", "criogenista"],
    ["perro", "perro", "fusilero", "quimico"],
    ["escudo", "medico", "fusilero"],
    ["lanzarredes", "lanzallamas", "fusilero"],
  ],
  p2: [
    ["fusilero", "fusilero"],
    ["perro", "ingeniero", "fusilero"],
    ["quimico", "fusilero", "fusilero"],
    ["escudo", "medico", "fusilero"],
    ["perro", "perro", "francotirador"],
  ],
  p3: [
    ["lanzarredes", "fusilero", "fusilero"],
    ["bioquimico", "fusilero", "perro"],
    ["lanzallamas", "lanzarredes"],
    ["criogenista", "francotirador", "fusilero"],
    ["escudo", "medico", "quimico"],
  ],
  p4: [
    ["fusilero", "fusilero", "perro"],
    ["ingeniero", "perro", "fusilero"],
    ["escudo", "medico", "criogenista"],
    ["lanzarredes", "lanzallamas", "fusilero"],
  ],
  p5: [
    ["fusilero", "fusilero", "criogenista"],
    ["francotirador", "fusilero", "quimico"],
    ["escudo", "medico", "bioquimico"],
    ["lanzallamas", "lanzarredes", "perro"],
  ],
  p6: [
    ["fusilero", "fusilero", "perro"],
    ["lanzarredes", "lanzallamas"],
    ["criogenista", "francotirador", "fusilero"],
    ["escudo", "medico", "quimico", "fusilero"],
  ],
  nucleo: [
    ["fusilero", "fusilero", "perro"],
    ["criogenista", "quimico", "fusilero"],
    ["escudo", "medico", "bioquimico"],
    ["lanzarredes", "lanzallamas", "francotirador"],
  ],
};

const SALA_DE: Record<string, string> = { p1: "r1", p2: "r2", p3: "r3", p4: "r4", p5: "r5", p6: "r6", n1: "r7", n2: "r7", n3: "r7" };

interface Activa {
  timer: number;
  idx: number;
  clave: string;
  sala: string;
  intervalo: number;
}

export class Director {
  private visitadas = new Set<string>();
  private activas = new Map<string, Activa>();
  private tutorial = 0;
  private tutorialT = 3;
  private roomCheck = 0;
  private patrulla = 30;

  constructor(private g: Partida) {}

  reset(): void {
    this.visitadas.clear();
    this.activas.clear();
    this.tutorial = 0;
    this.tutorialT = 3;
    this.patrulla = 30;
  }

  start(): void {
    this.visitadas.add("r0");
  }

  update(dt: number): void {
    // Solo para pruebas locales: DIRECTOR_APAGADO=1 quita los enemigos.
    if (process.env.DIRECTOR_APAGADO === "1") {
      this.g.flags.add("tutorial");
      return;
    }
    this.updateTutorial(dt);
    this.roomCheck -= dt;
    if (this.roomCheck <= 0) {
      this.roomCheck = 0.5;
      this.checkRooms();
    }
    for (const [id, a] of this.activas) {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = a.intervalo;
        const lista = OLEADAS[a.clave];
        this.spawnWave(lista[a.idx++ % lista.length], a.sala, id);
      }
    }
    this.patrulla -= dt;
    if (this.patrulla <= 0) {
      this.patrulla = 24;
      this.patrol();
    }
  }

  // ---------------------------------------------------------------- tutorial (sala 0)
  private updateTutorial(dt: number): void {
    if (this.g.flags.has("tutorial")) return;
    if (this.tutorial === 0) {
      this.tutorialT -= dt;
      if (this.tutorialT <= 0) {
        this.tutorial = 1;
        this.g.aviso("¡Guardias! WASD para moverte, ratón para apuntar y disparar, ESPACIO para tu habilidad.", "peligro");
        this.spawnWave(["fusilero", "fusilero", "perro"], "r0", "tutorial");
      }
      return;
    }
    if (this.aliveWithTag("tutorial") > 0) return;
    if (this.tutorial === 1) {
      this.tutorial = 2;
      this.g.aviso("Llegan más… Si un compañero queda congelado, acércate y mantén E.", "peligro");
      this.spawnWave(["fusilero", "fusilero", "criogenista"], "almacen", "tutorial");
    } else if (this.tutorial === 2) {
      this.tutorial = 3;
      this.g.flags.add("tutorial");
      this.g.aviso("¡Despejado! La puerta hacia la Cámara de contención se abrió.", "exito");
    }
  }

  private aliveWithTag(tag: string): number {
    let n = 0;
    this.g.brains.forEach((b, id) => {
      const u = this.g.state.unidades.get(id);
      if (b.tag === tag && u && u.team === "humanos" && u.t !== "torreta" && u.t !== "sensor") n++;
    });
    return n;
  }

  // ---------------------------------------------------------------- salas
  private checkRooms(): void {
    this.g.state.jugadores.forEach((p) => {
      if (!p.vivo) return;
      const room = this.g.world.roomAt(p.x, p.y);
      if (!room || this.visitadas.has(room.id)) return;
      this.visitadas.add(room.id);
      if (room.id === "r7") this.spawnBoss();
      const enc = ENCUENTROS[room.id];
      if (enc) this.spawnWave(enc, room.id, "sala-" + room.id);
    });
  }

  private spawnBoss(): void {
    const o = this.g.world.findOne("boss_spawn");
    if (!o || this.g.state.jefe) return;
    this.g.spawnUnit("jefe", o.x, o.y, "humanos", "jefe");
    this.g.aviso("¡El JEFE DE LABORATORIO! Activen las 3 estaciones para romper sus depósitos.", "peligro");
  }

  // ---------------------------------------------------------------- puzzles
  onPuzzleStart(id: string): void {
    const def = PUZZLES[id];
    const clave = def.tipo === "nucleo" ? "nucleo" : id;
    if (def.tipo === "nucleo" && [...this.activas.values()].some((a) => a.clave === "nucleo")) return;
    const intervalo = def.tipo === "individual" ? 15 : def.tipo === "duo" ? 18 : 16;
    this.activas.set(def.tipo === "nucleo" ? "nucleo" : id, { timer: 4, idx: 0, clave, sala: SALA_DE[id], intervalo });
  }

  onPuzzleEnd(id: string): void {
    const def = PUZZLES[id];
    if (def.tipo === "nucleo") {
      const otras = ["n1", "n2", "n3"].some((n) => this.g.state.puzzles.get(n)?.estado === "activo");
      if (!otras) this.activas.delete("nucleo");
    } else this.activas.delete(id);
  }

  onPuzzleFail(id: string): void {
    const def = PUZZLES[id];
    const lista = OLEADAS[def.tipo === "nucleo" ? "nucleo" : id];
    const castigo = [...lista[Math.floor(Math.random() * lista.length)], ...lista[Math.floor(Math.random() * lista.length)]];
    this.spawnWave(castigo, SALA_DE[id], "castigo");
    this.onPuzzleEnd(id);
  }

  // ---------------------------------------------------------------- patrullas
  private patrol(): void {
    if (this.countEnemies() >= 6) return;
    const vivos: { x: number; y: number }[] = [];
    this.g.state.jugadores.forEach((p) => p.vivo && vivos.push({ x: p.x, y: p.y }));
    if (!vivos.length) return;
    const p = vivos[Math.floor(Math.random() * vivos.length)];
    const room = this.g.world.roomAt(p.x, p.y);
    if (!room || room.id === "r0" || room.id === "salida") return;
    const grupos: Oleada[] = [
      ["fusilero", "perro"],
      ["fusilero", "quimico"],
      ["fusilero", "fusilero", "criogenista"],
      ["perro", "perro"],
    ];
    this.spawnWave(grupos[Math.floor(Math.random() * grupos.length)], room.id, "patrulla");
  }

  // ---------------------------------------------------------------- aparición
  countEnemies(): number {
    let n = 0;
    this.g.state.unidades.forEach((u) => {
      if (u.team === "humanos" && u.t !== "torreta" && u.t !== "sensor") n++;
    });
    return n;
  }

  spawnWave(tipos: Oleada, sala: string, tag: string): void {
    if (process.env.DIRECTOR_APAGADO === "1") return;
    let puntos = this.g.world.find("spawn").filter((o) => o.name === sala);
    if (!puntos.length) return;
    const jugadores: { x: number; y: number }[] = [];
    this.g.state.jugadores.forEach((p) => p.vivo && jugadores.push({ x: p.x, y: p.y }));
    // Preferir puntos que no estén encima de los jugadores.
    const lejos = puntos.filter((o) => jugadores.every((p) => dist(p.x, p.y, o.x, o.y) > 380));
    if (lejos.length) puntos = lejos;
    tipos.forEach((t, i) => {
      if (this.countEnemies() >= MAX_ENEMIES_ALIVE) return;
      const o = puntos[i % puntos.length];
      const x = o.x + (Math.random() - 0.5) * 50;
      const y = o.y + (Math.random() - 0.5) * 50;
      this.g.spawnUnit(t, this.g.world.blocksMoveAt(x, y) ? o.x : x, this.g.world.blocksMoveAt(x, y) ? o.y : y, "humanos", tag);
    });
  }

  spawnNear(tipos: Oleada, x: number, y: number, tag: string): void {
    tipos.forEach((t, i) => {
      if (this.countEnemies() >= MAX_ENEMIES_ALIVE) return;
      const a = (i / tipos.length) * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 110;
      const py = y + Math.sin(a) * 110;
      if (!this.g.world.blocksMoveAt(px, py)) this.g.spawnUnit(t, px, py, "humanos", tag);
    });
  }
}
