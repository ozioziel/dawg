// Director de amenazas (estilo Left 4 Dead): encuentros al entrar en cada sala, oleadas mientras
// se resuelve un reto, castigo al fallar, patrullas y robots cazadores que aparecen fuera de la vista.
// Se adapta al tamaño del equipo (cantidad, vida y ritmo) y se endurece sector a sector.
// La dificultad NO baja aunque muera un alien.
import { ESCALA_EQUIPO, MAX_ENEMIGOS_POR_EQUIPO, dist, rangoDe, type EnemyType } from "@dawg/shared";
import type { Unit } from "../schema/GameState";
import type { Partida } from "./Partida";
import { soltarAgarre } from "./enemigos";

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
  hub2: ["fusilero", "robot", "medico", "fusilero"],
  s2a: ["bioquimico", "fusilero", "perro"],
  s2b: ["criogenista", "robot", "fusilero"],
  s2c: ["laser", "fusilero", "quimico"],
  s2d: ["escudo", "medico", "fusilero"],
  s2e: ["ingeniero", "laser", "fusilero"],
  arena2: ["robot", "fusilero"],
  hangar: ["robot", "fusilero", "fusilero", "laser"],
};

/** Oleadas mientras se resuelve un reto, por sector (se repiten en ciclo). */
const OLEADAS: Record<number, Oleada[]> = {
  1: [
    ["fusilero", "fusilero", "perro"],
    ["fusilero", "lanzarredes", "criogenista"],
    ["perro", "perro", "fusilero", "quimico"],
    ["escudo", "medico", "fusilero"],
    ["lanzarredes", "lanzallamas", "fusilero"],
    ["francotirador", "fusilero", "bioquimico"],
  ],
  2: [
    ["fusilero", "robot", "perro"],
    ["laser", "fusilero", "criogenista"],
    ["escudo", "medico", "robot"],
    ["lanzallamas", "lanzarredes", "fusilero"],
    ["bioquimico", "quimico", "fusilero", "fusilero"],
    ["robot", "laser", "medico"],
  ],
  3: [
    ["robot", "fusilero", "laser"],
    ["escudo", "escudo", "medico", "fusilero"],
    ["robot", "robot", "criogenista"],
    ["laser", "lanzallamas", "fusilero", "perro"],
    ["oficial", "fusilero", "fusilero"],
  ],
};

interface Activa {
  timer: number;
  idx: number;
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
  private cazadorT = 80;

  constructor(private g: Partida) {}

  get apagado(): boolean {
    return process.env.DIRECTOR_APAGADO === "1";
  }

  reset(): void {
    this.visitadas.clear();
    this.activas.clear();
    this.tutorial = 0;
    this.tutorialT = 3;
    this.patrulla = 30;
    this.cazadorT = 80;
  }

  /** Marca como visitadas las salas de sectores anteriores (reintento desde un punto de control). */
  saltarHasta(sector: number): void {
    for (const r of this.g.world.rooms) {
      const s = Number(this.g.world.findOne("room", r.id)?.props.sector ?? 1);
      if (s < sector) this.visitadas.add(r.id);
    }
    if (sector > 1) this.tutorial = 3;
  }

  update(dt: number): void {
    this.roomCheck -= dt;
    if (this.roomCheck <= 0) {
      this.roomCheck = 0.5;
      this.checkRooms();
    }
    if (this.apagado) {
      this.g.flags.add("tutorial");
      return;
    }
    this.updateTutorial(dt);
    for (const [id, a] of this.activas) {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = a.intervalo;
        const lista = OLEADAS[this.g.state.sector] ?? OLEADAS[1];
        this.spawnWave(lista[a.idx++ % lista.length], a.sala, "reto-" + id);
      }
    }
    this.patrulla -= dt;
    if (this.patrulla <= 0) {
      this.patrulla = 24 * ESCALA_EQUIPO.intervalo[this.g.k];
      this.patrol();
    }
    // Robots cazadores desde el sector II.
    if (this.g.state.sector >= 2) {
      this.cazadorT -= dt;
      if (this.cazadorT <= 0) {
        this.cazadorT = (this.g.state.sector === 3 ? 55 : 85) * ESCALA_EQUIPO.intervalo[this.g.k];
        this.spawnCazador(1);
      }
    }
  }

  // ---------------------------------------------------------------- tutorial (sala 0)
  private updateTutorial(dt: number): void {
    if (this.g.flags.has("tutorial")) return;
    if (this.tutorial === 0) {
      this.tutorialT -= dt;
      if (this.tutorialT <= 0) {
        this.tutorial = 1;
        this.g.aviso("¡Guardias! Muévete, apunta y ataca. Usa tu habilidad (ESPACIO / clic derecho) y tu definitiva (R) cuando esté cargada.", "peligro");
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
      if (b.tag === tag && u && u.team === "humanos" && rangoDe(u.t) !== "dispositivo") n++;
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
      this.g.sectores.onSalaVisitada(room.id);
      const enc = ENCUENTROS[room.id];
      if (enc && !(room.id.startsWith("s2") && this.g.sectores.salaSellada(room.id))) this.spawnWave(enc, room.id, "sala-" + room.id);
    });
  }

  // ---------------------------------------------------------------- retos
  onRetoStart(slot: string, intervalo = 16): void {
    if (this.activas.has(slot)) return;
    const sala = this.salaDeSlot(slot);
    this.activas.set(slot, { timer: 4, idx: Math.floor(Math.random() * 4), sala, intervalo: intervalo * ESCALA_EQUIPO.intervalo[this.g.k] });
  }

  onRetoEnd(slot: string): void {
    this.activas.delete(slot);
  }

  onRetoFail(slot: string): void {
    const lista = OLEADAS[this.g.state.sector] ?? OLEADAS[1];
    const castigo = [...lista[Math.floor(Math.random() * lista.length)], ...(this.g.k >= 3 ? lista[Math.floor(Math.random() * lista.length)] : [])];
    this.spawnWave(castigo, this.salaDeSlot(slot), "castigo");
  }

  salaDeSlot(slot: string): string {
    if (slot.startsWith("s3")) return "hangar";
    return slot;
  }

  // ---------------------------------------------------------------- patrullas
  private patrol(): void {
    if (this.countEnemies() >= this.max() / 3) return;
    const vivos: { x: number; y: number }[] = [];
    this.g.state.jugadores.forEach((p) => p.vivo && vivos.push({ x: p.x, y: p.y }));
    if (!vivos.length) return;
    const p = vivos[Math.floor(Math.random() * vivos.length)];
    const room = this.g.world.roomAt(p.x, p.y);
    if (!room || ["r0", "e2", "e3", "exterior"].includes(room.id)) return;
    const s = this.g.state.sector;
    const grupos: Oleada[] =
      s === 1
        ? [["fusilero", "perro"], ["fusilero", "quimico"], ["fusilero", "fusilero", "criogenista"], ["perro", "perro"]]
        : s === 2
          ? [["fusilero", "robot"], ["laser", "fusilero"], ["perro", "perro", "fusilero"], ["bioquimico", "robot"]]
          : [["robot", "fusilero"], ["laser", "escudo"], ["oficial", "fusilero"], ["robot", "perro", "perro"]];
    this.spawnWave(grupos[Math.floor(Math.random() * grupos.length)], room.id, "patrulla");
  }

  /** Robot cazador: aparece en un punto que nadie está viendo y corre a por un alien. */
  spawnCazador(n: number): void {
    if (this.apagado) return;
    const vivos: { x: number; y: number }[] = [];
    this.g.state.jugadores.forEach((p) => p.vivo && vivos.push({ x: p.x, y: p.y }));
    if (!vivos.length) return;
    const puntos = this.g.world
      .find("spawn")
      .filter((o) => vivos.some((p) => dist(p.x, p.y, o.x, o.y) < 1300) && vivos.every((p) => dist(p.x, p.y, o.x, o.y) > 450 && !this.g.world.lineOfSight(p.x, p.y, o.x, o.y)));
    for (let i = 0; i < n && puntos.length; i++) {
      const o = puntos[Math.floor(Math.random() * puntos.length)];
      this.g.spawnUnit("cazador", o.x, o.y, "humanos", "cazador");
      this.g.fx("alarma", o.x, o.y);
    }
    if (puntos.length) this.g.aviso("Se oye algo metálico corriendo por los conductos…", "peligro");
  }

  soltarAgarre(pid: string): void {
    this.g.brains.forEach((b, uid) => {
      if (b.agarre !== pid) return;
      const u = this.g.state.unidades.get(uid);
      if (u) soltarAgarre(this.g, uid, u, b);
      else b.agarre = "";
    });
  }

  onUnidadMuere(uid: string, u: Unit): void {
    // Si el cazador muere agarrando a alguien, lo suelta.
    if (u.t === "cazador") {
      this.g.state.jugadores.forEach((p) => {
        if (p.estado === "agarrado") {
          let otro = false;
          this.g.brains.forEach((b, oid) => oid !== uid && b.agarre && this.g.state.jugadores.get(b.agarre) === p && (otro = true));
          if (!otro) {
            p.estado = "ok";
            p.estadoT = 0;
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------- aparición
  countEnemies(): number {
    let n = 0;
    this.g.state.unidades.forEach((u) => {
      if (u.team === "humanos" && rangoDe(u.t) !== "dispositivo" && rangoDe(u.t) !== "npc") n++;
    });
    return n;
  }

  max(): number {
    return MAX_ENEMIGOS_POR_EQUIPO[this.g.k];
  }

  /** Ajusta una oleada al tamaño del equipo. */
  escalar(tipos: Oleada): Oleada {
    const f = ESCALA_EQUIPO.cantidad[this.g.k];
    const n = Math.max(1, Math.round(tipos.length * f));
    const out = tipos.slice(0, Math.min(n, tipos.length));
    for (let i = tipos.length; i < n; i++) out.push(tipos[i % tipos.length]);
    return out;
  }

  spawnWave(tipos: Oleada, sala: string, tag: string): void {
    if (this.apagado) return;
    let puntos = this.g.world.find("spawn").filter((o) => o.name === sala);
    if (!puntos.length) return;
    const jugadores: { x: number; y: number }[] = [];
    this.g.state.jugadores.forEach((p) => p.vivo && jugadores.push({ x: p.x, y: p.y }));
    const lejos = puntos.filter((o) => jugadores.every((p) => dist(p.x, p.y, o.x, o.y) > 380));
    if (lejos.length) puntos = lejos;
    this.escalar(tipos).forEach((t, i) => {
      if (this.countEnemies() >= this.max()) return;
      const o = puntos[i % puntos.length];
      const x = o.x + (Math.random() - 0.5) * 50;
      const y = o.y + (Math.random() - 0.5) * 50;
      const ok = !this.g.world.blocksMoveAt(x, y);
      this.g.spawnUnit(t, ok ? x : o.x, ok ? y : o.y, "humanos", tag);
    });
  }

  spawnNear(tipos: Oleada, x: number, y: number, tag: string): void {
    if (this.apagado) return;
    this.escalar(tipos).forEach((t, i, arr) => {
      if (this.countEnemies() >= this.max()) return;
      const a = (i / arr.length) * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 130;
      const py = y + Math.sin(a) * 130;
      if (!this.g.world.blocksMoveAt(px, py)) this.g.spawnUnit(t, px, py, "humanos", tag);
    });
  }
}
