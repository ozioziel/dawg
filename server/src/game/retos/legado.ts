// Retos clásicos del primer laboratorio, adaptados al sistema de 8 aliens y 1–5 jugadores:
// memoria psíquica, copia la cara, transmutación (minijuegos de consola), sala de rayos,
// puente sobre el ácido y válvulas a la vez (dúos). En un dúo, si solo queda un alien que
// puede hacer los dos papeles (por llevar el alma del otro), lo hace solo con más tiempo.
import {
  ESCLUSA,
  MINIGAME_BONUS,
  MINIGAME_DURATION,
  MINIGAME_LOCK,
  MINIGAME_MIN,
  PUENTE,
  RAYOS_SIMBOLOS,
  SOLO_TIME_FACTOR,
  TILE,
  dist,
  type AlienKind,
  type MinigameMsg,
} from "@dawg/shared";
import { Prop, type Player } from "../../schema/GameState";
import { RetoBase } from "./base";

/** Puede hacer ese papel: es ese alien o lleva su alma (aunque tenga que transformarse). */
function podriaSer(p: Player, k: AlienKind): boolean {
  return p.vivo && (p.kind === k || p.almas.includes(k));
}

// ================================================================== minijuegos de consola (individuales)
abstract class Consola extends RetoBase {
  protected estacion = "";
  private ultimoBonus = -99;

  protected override montar(): void {
    const p = this.pos(0.5, 0.35);
    this.despejar(p.x, p.y, 120);
    this.estacion = this.obj("estacion", p.x, p.y, { txt: this.def.nombre });
  }

  protected requisitoExtra(_p: Player): string {
    return "";
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.estacion, 100)) return false;
    if (this.st.estado === "activo" && this.st.actores) return true;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    const falta = this.requisitoExtra(p);
    if (falta) return this.g.aviso(falta, "info", id), true;
    this.empezar();
    this.st.tiempo = this.st.total = MINIGAME_DURATION;
    this.st.actores = id;
    this.st.solo = false;
    this.st.datos = JSON.stringify({ semilla: Math.floor(Math.random() * 1e9), inicio: this.g.time });
    this.inicio = this.g.time;
    p.ocupado = this.slot;
    this.g.aviso(`${p.nombre} empezó «${this.def.nombre}». ¡Defiéndanlo! Dura de ${MINIGAME_MIN} a ${MINIGAME_DURATION} s.`, "info");
    return true;
  }

  protected override update(dt: number): void {
    if (!this.st.actores) return;
    const actor = this.jugadores.get(this.st.actores);
    if (!actor || !actor.vivo) return this.fallar("Cayó quien hacía el minijuego.", MINIGAME_LOCK);
    if (!this.cerca(actor, this.estacion, 200)) return this.fallar("Se alejó de la consola.", MINIGAME_LOCK);
    this.st.tiempo -= dt;
    this.progreso(1 - this.st.tiempo / this.st.total);
    if (this.st.tiempo <= 0) this.resolver();
  }

  override mensaje(id: string, msg: MinigameMsg): void {
    if (id !== this.st.actores) return;
    if (msg.ev === "fallo") this.fallar(msg.razon ? String(msg.razon).slice(0, 80) : "Falló el minijuego.", MINIGAME_LOCK);
    else if (msg.ev === "acierto" && msg.rapido) {
      if (this.g.time - this.ultimoBonus < 1.5) return;
      this.ultimoBonus = this.g.time;
      const minimo = Math.max(0, MINIGAME_MIN - (this.g.time - this.inicio));
      this.st.tiempo = Math.max(minimo, this.st.tiempo - MINIGAME_BONUS);
    }
  }
}

export class LMemoria extends Consola {}
export class LTransmutacion extends Consola {}
export class LCara extends Consola {
  protected override requisitoExtra(p: Player): string {
    return p.disfrazado ? "" : "El escáner facial solo funciona si vas disfrazado de humano (escanea a un guardia).";
  }
}

// ================================================================== Sala de rayos (Cambiaformas + Telequinesis)
export class LRayos extends RetoBase {
  private consola = "";
  private interruptores: string[] = [];
  private ronda = 1;
  private sec: number[] = [];
  private idx = 0;

  protected override montar(): void {
    const z2 = this.zona.z2;
    const cp = z2 ? { x: z2.x + z2.w * 0.3, y: z2.y + z2.h * 0.2 } : this.pos(0.12, 0.2);
    this.consola = this.obj("estacion", cp.x, cp.y, { txt: "Consola de rayos (Cambiaformas disfrazado)" });
    const pos = [[0.3, 0.15], [0.6, 0.15], [0.9, 0.15], [0.3, 0.85], [0.6, 0.85], [0.9, 0.85]];
    pos.forEach(([fx, fy], i) => {
      const p = z2 ? this.pos(0.2 + (fx - 0.3) * 1.1, fy) : this.pos(fx, fy);
      this.despejar(p.x, p.y, 60);
      this.interruptores.push(this.obj("interruptor", p.x, p.y, { f: i, txt: RAYOS_SIMBOLOS[i].nombre }));
    });
  }

  private secuencia(n: number): number[] {
    const out: number[] = [];
    while (out.length < n) {
      const s = Math.floor(Math.random() * RAYOS_SIMBOLOS.length);
      if (out[out.length - 1] !== s) out.push(s);
    }
    return out;
  }

  private sync(): void {
    this.st.datos = JSON.stringify({ ronda: this.ronda, sec: this.sec, idx: this.idx });
  }

  protected override reiniciar(): void {
    this.ronda = 1;
    this.sec = [];
    this.idx = 0;
    this.st.datos = "";
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.consola, 110)) return false;
    if (this.st.estado === "activo" && this.sec.length) return true;
    if (!podriaSer(p, "cambiaformas") || p.forma !== "cambiaformas") return this.g.aviso("La consola solo muestra el código a un humano: necesita al Cambiaformas disfrazado.", "info", id), true;
    if (!p.disfrazado) return this.g.aviso("Disfrázate (escanea a un guardia) para que la consola te muestre el código.", "info", id), true;
    if (this.bloqueado(id)) return true;
    // ¿Quién activa los interruptores?
    let otro = "";
    this.jugadores.forEach((o, oid) => oid !== id && podriaSer(o, "inteligente") && (otro = oid));
    const solo = !otro;
    if (solo && !podriaSer(p, "inteligente")) return this.g.aviso("Hace falta Telequinesis (o su alma) para activar los interruptores.", "info", id), true;
    this.empezar();
    this.st.solo = solo;
    this.st.total = this.st.tiempo = MINIGAME_DURATION * (solo ? SOLO_TIME_FACTOR : 1);
    this.st.actores = solo ? id : `${id},${otro}`;
    this.ronda = 1;
    this.sec = this.secuencia(4);
    this.idx = 0;
    this.sync();
    this.g.aviso(solo ? `${p.nombre} hace los dos papeles: memoriza el código, transfórmate en Telequinesis (Q) y actívalo en los interruptores.` : "Sala de rayos: el Cambiaformas dicta el código y Telequinesis activa los interruptores en ese orden.", "info");
    return true;
  }

  protected override update(dt: number): void {
    if (!this.sec.length) return;
    this.st.tiempo -= dt;
    this.progreso(((this.ronda - 1) * 1 + this.idx / this.sec.length) / 3);
    if (this.st.tiempo <= 0) this.fallar("¡Se acabó el tiempo!", MINIGAME_LOCK);
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    const sw = this.interruptores.find((s) => this.cerca({ x, y }, s, 60));
    if (!sw) return false;
    if (p.forma !== "inteligente") return false;
    if (!this.sec.length) return this.g.aviso("Los interruptores no responden: primero hay que leer el código en la consola.", "info", id), true;
    const o = this.o(sw)!;
    this.g.fx("telequinesis", p.x, p.y, { x2: o.x, y2: o.y });
    p.enfriamiento = p.enfMax = 0.6;
    if (o.f === this.sec[this.idx]) {
      this.idx++;
      this.g.fx("chispa", o.x, o.y);
      if (this.idx >= this.sec.length) {
        if (this.ronda >= 3) {
          this.sync();
          this.resolver();
          return true;
        }
        this.ronda++;
        this.sec = this.secuencia(3 + this.ronda);
        this.idx = 0;
        this.g.aviso(`¡Código correcto! Ronda ${this.ronda} de 3: nuevo código en la consola.`, "exito");
      }
      this.sync();
    } else this.fallar(`Interruptor equivocado (${RAYOS_SIMBOLOS[o.f].nombre}).`, MINIGAME_LOCK);
    return true;
  }
}

// ================================================================== Puente sobre el ácido (Telequinesis + Del Mar)
export class LPuente extends RetoBase {
  private dispensador = { x: 0, y: 0 };
  private slots: { x: number; y: number; i: number }[] = [];
  private boton = "";

  protected override montar(): void {
    const d = this.g.world.findOne("dispenser", "l-puente")!;
    this.dispensador = { x: d.x, y: d.y };
    this.obj("dispensador", d.x, d.y, { txt: "Dispensador de bloques (telequinesis)" });
    this.slots = this.g.world.find("slot_puente").map((o) => ({ x: o.x, y: o.y, i: Number(o.props.i) }));
    for (const s of this.slots) this.obj("marca_slot", s.x, s.y, { f: s.i });
    const b = this.g.world.findOne("button", "l-puente")!;
    this.boton = this.obj("boton", b.x, b.y, { txt: "Botón (E)" });
  }

  private puentes(): number {
    let n = 0;
    this.g.state.objetos.forEach((o) => o.k === "puente" && o.dueno === this.slot && n++);
    return n;
  }

  protected override reiniciar(): void {
    const quitar: string[] = [];
    this.g.state.objetos.forEach((o, oid) => {
      if ((o.k === "bloque" || o.k === "puente") && (o.dueno === this.slot || o.st === "hundiendo" || o.st === "sostenido")) {
        quitar.push(oid);
        this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), false);
      }
    });
    for (const id of quitar) this.g.state.objetos.delete(id);
    this.jugadores.forEach((p) => {
      if (p.vivo && this.g.world.blocksMoveAt(p.x, p.y, 1)) {
        p.x = this.dispensador.x;
        p.y = this.dispensador.y + 60;
      }
    });
  }

  protected override update(dt: number): void {
    if (this.st.estado !== "activo") return;
    this.st.tiempo -= dt;
    const quitar: string[] = [];
    this.g.state.objetos.forEach((o, oid) => {
      if (o.k !== "bloque") return;
      if (o.st === "sostenido") {
        const p = this.jugadores.get(o.dueno);
        if (!p || !p.vivo) return void quitar.push(oid);
        o.x = Math.round(p.x + Math.cos(p.aim) * 46);
        o.y = Math.round(p.y + Math.sin(p.aim) * 46 - 20);
      } else if (o.st === "hundiendo") {
        o.t -= dt;
        if (o.t <= 0) {
          quitar.push(oid);
          this.g.fx("acido", o.x, o.y, { r: 40 });
        }
      }
    });
    for (const id of quitar) this.g.state.objetos.delete(id);
    this.progreso(this.puentes() / PUENTE.slots);
    this.texto(`Puente ${this.puentes()}/${PUENTE.slots}. Telequinesis: bloques del dispensador a las casillas · Del Mar: transmútalos antes de que se hundan.`);
    if (this.st.tiempo <= 0) this.fallar("¡Se acabó el tiempo!", MINIGAME_LOCK);
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.boton, 100)) return false;
    if (this.st.estado !== "activo") return true;
    if (this.puentes() < PUENTE.slots) return this.g.aviso("Primero completen el puente.", "info", id), true;
    this.resolver();
    return true;
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    // Telequinesis: tomar bloque o colocarlo
    if (p.forma === "inteligente") {
      if (dist(x, y, this.dispensador.x, this.dispensador.y) < 70) {
        if (this.bloqueado(id)) return true;
        if (this.st.estado === "libre") {
          let otro = "";
          this.jugadores.forEach((o, oid) => oid !== id && podriaSer(o, "delmar") && (otro = oid));
          const solo = !otro;
          if (solo && !podriaSer(p, "delmar")) return this.g.aviso("Hace falta alguien que transmute (Del Mar o su alma).", "info", id), true;
          this.empezar();
          this.st.solo = solo;
          this.st.total = this.st.tiempo = MINIGAME_DURATION * (solo ? SOLO_TIME_FACTOR : 1);
          this.st.actores = solo ? id : `${id},${otro}`;
        }
        let ya = false;
        this.g.state.objetos.forEach((o) => o.k === "bloque" && o.st === "sostenido" && o.dueno === id && (ya = true));
        if (ya) return this.g.aviso("Ya sostienes un bloque: apunta a una casilla del ácido.", "info", id), true;
        const b = new Prop();
        b.k = "bloque";
        b.st = "sostenido";
        b.dueno = id;
        b.x = Math.round(p.x);
        b.y = Math.round(p.y - 40);
        this.g.state.objetos.set(this.g.id("o"), b);
        this.g.fx("telequinesis", this.dispensador.x, this.dispensador.y, { x2: p.x, y2: p.y });
        p.enfriamiento = p.enfMax = 0.6;
        return true;
      }
      const slot = this.slots.find((s) => dist(x, y, s.x, s.y) < 48);
      if (slot) {
        let held: Prop | null = null;
        this.g.state.objetos.forEach((o) => o.k === "bloque" && o.st === "sostenido" && o.dueno === id && (held = o));
        if (!held) return this.g.aviso("Primero toma un bloque del dispensador (telequinesis sobre él).", "info", id), true;
        let libre = true;
        this.g.state.objetos.forEach((o) => (o.k === "bloque" || o.k === "puente") && o.st !== "sostenido" && dist(o.x, o.y, slot.x, slot.y) < 10 && (libre = false));
        if (!libre) return this.g.aviso("Esa casilla ya tiene un bloque.", "info", id), true;
        const h = held as Prop;
        this.g.fx("telequinesis", h.x, h.y, { x2: slot.x, y2: slot.y });
        h.st = "hundiendo";
        h.t = PUENTE.sinkTime;
        h.x = Math.round(slot.x);
        h.y = Math.round(slot.y);
        h.dueno = this.slot;
        p.enfriamiento = p.enfMax = 0.6;
        return true;
      }
      return false;
    }
    // Del Mar: transmutar bloque en puente
    if (p.forma === "delmar") {
      let target: Prop | null = null;
      this.g.state.objetos.forEach((o) => !target && o.k === "bloque" && o.st === "hundiendo" && dist(x, y, o.x, o.y) < 50 && (target = o));
      if (!target) return false;
      const o = target as Prop;
      o.k = "puente";
      o.st = "";
      o.dueno = this.slot;
      this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), true);
      this.g.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
      p.enfriamiento = p.enfMax = 0.6;
      if (this.puentes() >= PUENTE.slots) this.g.aviso("¡Puente completo! Crucen y pulsen el botón (E).", "exito");
      return true;
    }
    return false;
  }

  protected override alResolver(): void {
    // El puente se queda: solo se quitan los objetos del reto.
    for (const id of [...this.objs]) this.quitarObj(id);
  }
}

// ================================================================== Válvulas a la vez (Cambiaformas + Del Mar)
interface Nota {
  t: number;
  d: number;
  l: "A" | "B" | "AB";
}

export class LValvulas extends RetoBase {
  private palancas: { id: string; parte: "A" | "B" }[] = [];
  private reserva = { A: "", B: "" };
  private e: { fase: "ritmo" | "espera"; inicio: number; esperaT: number; notas: Nota[]; hitsA: number[]; hitsB: number[]; evaluada: boolean[]; fallos: number; opA: string; opB: string; ultimoError: number } | null = null;
  private ultimoBonus = -99;

  protected override montar(): void {
    const a = this.pos(0.1, 0.5);
    const b = this.pos(0.9, 0.5);
    this.palancas = [
      { id: this.obj("palanca", a.x, a.y, { txt: "Palanca A · Cambiaformas" }), parte: "A" },
      { id: this.obj("palanca", b.x, b.y, { txt: "Palanca B · Del Mar" }), parte: "B" },
    ];
  }

  protected override reiniciar(): void {
    if (this.e) for (const id of [this.e.opA, this.e.opB]) {
      const p = this.jugadores.get(id);
      if (p && p.ocupado === this.slot) p.ocupado = "";
    }
    this.e = null;
    this.reserva = { A: "", B: "" };
    for (const pl of this.palancas) this.o(pl.id)!.f = 0;
  }

  override interact(id: string, p: Player): boolean {
    const pl = this.palancas.find((x) => this.cerca(p, x.id, 100));
    if (!pl) return false;
    if (this.st.estado === "activo" && this.e) return true;
    if (this.bloqueado(id)) return true;
    const role: AlienKind = pl.parte === "A" ? "cambiaformas" : "delmar";
    const otraRole: AlienKind = pl.parte === "A" ? "delmar" : "cambiaformas";
    if (!podriaSer(p, role)) return this.g.aviso(`Esta palanca es de ${pl.parte === "A" ? "Cambiaformas" : "Del Mar"} (o de quien lleve su alma).`, "info", id), true;
    this.reserva[pl.parte] = id;
    let otroPosible = false;
    this.jugadores.forEach((o, oid) => oid !== id && podriaSer(o, otraRole) && (otroPosible = true));
    const solo = !otroPosible && podriaSer(p, otraRole);
    const otra = pl.parte === "A" ? "B" : "A";
    if (!solo && !this.reserva[otra]) {
      this.g.aviso(`${p.nombre} está en la palanca ${pl.parte}. Falta alguien en la palanca ${otra}.`, "info");
      return true;
    }
    if (!solo && !otroPosible) return this.g.aviso("Falta alguien que pueda usar la otra palanca.", "info", id), true;
    const opA = solo ? id : this.reserva.A;
    const opB = solo ? id : this.reserva.B;
    this.empezar();
    this.st.solo = solo;
    this.st.total = this.st.tiempo = MINIGAME_DURATION;
    this.st.actores = solo ? id : `${opA},${opB}`;
    this.e = { fase: "espera", inicio: 0, esperaT: 3, notas: [], hitsA: [], hitsB: [], evaluada: [], fallos: 0, opA, opB, ultimoError: -9 };
    this.g.aviso(solo ? `${p.nombre} maneja las dos palancas: F = válvula A, J = válvula B (o los botones en pantalla).` : "¡Válvulas en marcha! Pulsen ESPACIO (o el botón) solo cuando la orden les toque.", "info");
    this.sync();
    return true;
  }

  private notas(): Nota[] {
    const notas: Nota[] = [];
    for (let t = 1.5; t + ESCLUSA.dura < MINIGAME_DURATION; t += ESCLUSA.cada) {
      const r = Math.random();
      notas.push({ t: Math.round(t * 100) / 100, d: ESCLUSA.dura, l: r < 0.36 ? "AB" : r < 0.68 ? "A" : "B" });
    }
    return notas;
  }

  private sync(): void {
    const e = this.e;
    if (!e) return;
    this.st.datos = JSON.stringify({ fase: e.fase, inicio: e.inicio, notas: e.notas, fallos: e.fallos, max: ESCLUSA.maxMisses, opA: e.opA, opB: e.opB });
  }

  protected override update(dt: number): void {
    const e = this.e;
    if (!e) return;
    const opA = this.jugadores.get(e.opA);
    const opB = this.jugadores.get(e.opB);
    if (!opA?.vivo || !opB?.vivo) return this.fallar("Falta quien maneje una palanca.", MINIGAME_LOCK);
    if (e.fase === "espera") {
      e.esperaT -= dt;
      if (e.esperaT > 0) return;
      e.fase = "ritmo";
      e.inicio = this.g.time + 0.5;
      this.inicio = e.inicio;
      e.notas = this.notas();
      e.hitsA = e.notas.map(() => -1);
      e.hitsB = e.notas.map(() => -1);
      e.evaluada = e.notas.map(() => false);
      opA.ocupado = this.slot;
      opB.ocupado = this.slot;
      for (const pl of this.palancas) this.o(pl.id)!.f = 1;
      this.sync();
      return;
    }
    this.st.tiempo -= dt;
    this.progreso(1 - this.st.tiempo / this.st.total);
    const ahora = this.g.time - e.inicio;
    let cambio = false;
    e.notas.forEach((n, i) => {
      if (e.evaluada[i] || ahora < n.t + n.d + 0.5) return;
      e.evaluada[i] = true;
      const pulsos = n.l === "A" ? [e.hitsA[i]] : n.l === "B" ? [e.hitsB[i]] : [e.hitsA[i], e.hitsB[i]];
      if (pulsos.some((h) => h < 0)) {
        e.fallos++;
        cambio = true;
      } else if (Math.max(...pulsos) <= n.t + n.d * ESCLUSA.rapida && this.g.time - this.ultimoBonus > 1.5) {
        this.ultimoBonus = this.g.time;
        const minimo = Math.max(0, MINIGAME_MIN - (this.g.time - this.inicio));
        this.st.tiempo = Math.max(minimo, this.st.tiempo - MINIGAME_BONUS);
      }
    });
    if (e.fallos >= ESCLUSA.maxMisses) return this.fallar("Demasiadas órdenes falladas.", MINIGAME_LOCK);
    if (this.st.tiempo <= 0) {
      opA.ocupado = "";
      opB.ocupado = "";
      return this.resolver();
    }
    if (cambio) this.sync();
  }

  override mensaje(id: string, msg: MinigameMsg): void {
    const e = this.e;
    if (!e || e.fase !== "ritmo" || typeof msg.nota !== "number") return;
    if (!msg.ok) {
      if (this.g.time - e.ultimoError < 0.8 || (id !== e.opA && id !== e.opB)) return;
      e.ultimoError = this.g.time;
      e.fallos++;
      this.sync();
      if (e.fallos >= ESCLUSA.maxMisses) this.fallar("Demasiadas órdenes falladas.", MINIGAME_LOCK);
      return;
    }
    const i = msg.nota | 0;
    if (i < 0 || i >= e.notas.length || e.evaluada[i]) return;
    const cuando = this.g.time - e.inicio;
    if (this.st.solo) {
      if (id !== e.opA) return;
      if (msg.lane === "A" && e.hitsA[i] < 0) e.hitsA[i] = cuando;
      else if (msg.lane === "B" && e.hitsB[i] < 0) e.hitsB[i] = cuando;
      return;
    }
    if (id === e.opA && e.hitsA[i] < 0) e.hitsA[i] = cuando;
    if (id === e.opB && e.hitsB[i] < 0) e.hitsB[i] = cuando;
  }

  override onPlayerDown(id: string): void {
    if (this.reserva.A === id) this.reserva.A = "";
    if (this.reserva.B === id) this.reserva.B = "";
  }
}
