// Lógica de las salas-puzzle: individuales (1,5 min), dúos y estaciones del núcleo.
// Si fallan: llegan más soldados y la consola se bloquea 30 s.
import {
  ALIENS,
  ESCLUSA,
  INTERACT_RANGE,
  MINIGAME_LOCK,
  PUENTE,
  PUZZLES,
  RAYOS_SIMBOLOS,
  SOLO_TIME_FACTOR,
  TELEQUINESIS,
  TILE,
  dist,
  type AlienKind,
  type MapObject,
  type MinigameMsg,
} from "@dawg/shared";
import { Player, Prop, Puzzle } from "../schema/GameState";
import type { Partida } from "./Partida";

interface Nota {
  t: number;
  l: "A" | "B" | "AB";
}

interface EsclusaData {
  ronda: number;
  fase: "ritmo" | "pausa" | "espera";
  inicio: number;
  pausaT: number;
  notas: Nota[];
  hitsA: boolean[];
  hitsB: boolean[];
  evaluada: boolean[];
  fallos: number;
  agua: number;
  aguaT: number;
  opA: string;
  opB: string;
  ultimoError: number;
}

export class Puzzles {
  private obj = new Map<string, MapObject[]>();
  private rayos = { ronda: 1, sec: [] as number[], idx: 0 };
  private esclusa: EsclusaData | null = null;
  /** Palancas reservadas antes de empezar la esclusa. */
  private palancas = { A: "", B: "" };
  private hitAt = new Map<string, number>();

  constructor(private g: Partida) {}

  init(): void {
    this.obj.clear();
    for (const o of this.g.world.objects) {
      if (["station", "switch", "dispenser", "slot", "button", "lever", "water_zone"].includes(o.type)) {
        const k = `${o.type}:${o.name}`;
        if (!this.obj.has(k)) this.obj.set(k, []);
        this.obj.get(k)!.push(o);
      }
    }
    for (const id of Object.keys(PUZZLES)) {
      const pz = new Puzzle();
      pz.total = PUZZLES[id].duracion;
      this.g.state.puzzles.set(id, pz);
    }
    this.esclusa = null;
    this.palancas = { A: "", B: "" };
    this.rayos = { ronda: 1, sec: [], idx: 0 };
  }

  private get(type: string, name: string): MapObject[] {
    return this.obj.get(`${type}:${name}`) ?? [];
  }

  private pz(id: string): Puzzle {
    return this.g.state.puzzles.get(id)!;
  }

  private actores(pz: Puzzle): string[] {
    return pz.actores ? pz.actores.split(",") : [];
  }

  private player(id: string): Player | undefined {
    return this.g.state.jugadores.get(id);
  }

  // ------------------------------------------------------------------ E (interactuar)
  interact(id: string, p: Player): void {
    if (p.ocupado) return;
    // Estaciones individuales y del núcleo
    for (const pid of ["p1", "p2", "p3", "n1", "n2", "n3", "p4"]) {
      const st = this.get("station", pid)[0];
      if (!st || dist(p.x, p.y, st.x, st.y) > INTERACT_RANGE + 10) continue;
      if (pid === "p4") return this.startRayos(id, p);
      return this.startIndividual(pid, id, p);
    }
    // Palancas de la esclusa
    for (const lv of this.get("lever", "p6")) {
      if (dist(p.x, p.y, lv.x, lv.y) <= INTERACT_RANGE + 10) return this.lever(id, p, String(lv.props.parte) as "A" | "B");
    }
    // Botón del puente
    const btn = this.get("button", "p5")[0];
    if (btn && dist(p.x, p.y, btn.x, btn.y) <= INTERACT_RANGE + 10) return this.pressBridgeButton(id, p);
  }

  private startIndividual(pid: string, id: string, p: Player): void {
    const pz = this.pz(pid);
    const def = PUZZLES[pid];
    const role = def.roles[0];
    if (pz.estado === "resuelto") return this.g.aviso("Esta consola ya está resuelta.", "info", id);
    if (pz.estado === "bloqueado") return this.g.aviso(`Consola bloqueada: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    if (pz.estado === "activo") return;
    if (!this.g.qualifies(p, role)) return this.g.aviso(`Solo el ${ALIENS[role].nombre} (o quien lleve su alma) puede usar esta consola.`, "info", id);
    if (def.minijuego === "identidad" && !p.disfrazado) return this.g.aviso("Necesitas estar disfrazado de humano para pasar el escáner (ESPACIO).", "info", id);
    if (pid.startsWith("n") && !this.g.state.jefe && !this.g.flags.has("jefe")) {
      // El jefe aparece al entrar a la sala; por si acaso.
    }
    pz.estado = "activo";
    pz.tiempo = def.duracion;
    pz.total = def.duracion;
    pz.actores = id;
    pz.solo = false;
    pz.datos = JSON.stringify({ semilla: Math.floor(Math.random() * 1e9), inicio: this.g.time });
    p.ocupado = pid;
    this.hitAt.set(pid, this.g.time);
    this.g.aviso(`${p.nombre} empezó "${def.nombre}". ¡Defiéndanlo ${Math.round(def.duracion)} segundos!`, "info");
    this.g.director.onPuzzleStart(pid);
  }

  // ------------------------------------------------------------------ mensajes de minijuego
  message(id: string, msg: MinigameMsg): void {
    if (!msg || typeof msg.id !== "string") return;
    const pz = this.g.state.puzzles.get(msg.id);
    if (!pz || pz.estado !== "activo") return;
    if (msg.id === "p6") return this.esclusaNota(id, msg);
    if (!this.actores(pz).includes(id)) return;
    if (msg.ev === "fallo") this.fail(msg.id, msg.razon ? String(msg.razon).slice(0, 80) : "Falló el minijuego.");
  }

  // ------------------------------------------------------------------ eventos de jugadores
  onPlayerHit(id: string, amount: number): void {
    const p = this.player(id);
    if (!p || !p.ocupado || amount < 1) return;
    const pz = this.g.state.puzzles.get(p.ocupado);
    // El escáner de identidad falla si le pegan al cambiaformas.
    if (pz && pz.estado === "activo" && PUZZLES[p.ocupado]?.minijuego === "identidad") this.fail(p.ocupado, `¡Le pegaron a ${p.nombre} y se rompió el disfraz!`);
  }

  onPlayerStatus(id: string): void {
    const p = this.player(id);
    if (!p || !p.ocupado) return;
    const pid = p.ocupado;
    if (p.estado === "congelado" || p.estado === "red") this.fail(pid, `${p.nombre} quedó ${p.estado === "red" ? "atrapado" : "congelado"} en plena consola.`);
    else if (!p.disfrazado && PUZZLES[pid]?.minijuego === "identidad") this.fail(pid, "Se rompió el disfraz en el escáner.");
  }

  onPlayerDown(id: string): void {
    this.g.state.puzzles.forEach((pz, pid) => {
      if (pz.estado === "activo" && this.actores(pz).includes(id)) this.fail(pid, "Cayó quien hacía el puzzle.");
    });
    if (this.palancas.A === id) this.palancas.A = "";
    if (this.palancas.B === id) this.palancas.B = "";
  }

  // ------------------------------------------------------------------ bucle
  update(dt: number): void {
    this.g.state.puzzles.forEach((pz, pid) => {
      if (pz.estado === "bloqueado") {
        pz.tiempo -= dt;
        if (pz.tiempo <= 0) {
          pz.estado = "libre";
          pz.tiempo = 0;
          this.g.aviso(`La consola de "${PUZZLES[pid].nombre}" se desbloqueó.`, "info");
        }
        return;
      }
      if (pz.estado !== "activo") return;
      const def = PUZZLES[pid];
      if (def.minijuego === "esclusa") return this.updateEsclusa(dt);
      pz.tiempo -= dt;
      if (def.minijuego === "puente") this.updatePuente(dt);
      if (def.tipo === "individual" || def.tipo === "nucleo") {
        const actor = this.player(pz.actores);
        if (!actor || !actor.vivo) return this.fail(pid, "Cayó quien hacía el puzzle.");
        const st = this.get("station", pid)[0];
        if (st && dist(actor.x, actor.y, st.x, st.y) > INTERACT_RANGE * 2) return this.fail(pid, "Se alejó de la consola.");
        if (pz.tiempo <= 0) return this.resolve(pid);
      } else if (pz.tiempo <= 0) {
        return this.fail(pid, "¡Se acabó el tiempo!");
      }
    });
  }

  fail(pid: string, razon: string): void {
    const pz = this.pz(pid);
    if (pz.estado !== "activo") return;
    const def = PUZZLES[pid];
    for (const a of this.actores(pz)) {
      const p = this.player(a);
      if (p && p.ocupado === pid) p.ocupado = "";
    }
    pz.estado = "bloqueado";
    pz.tiempo = MINIGAME_LOCK;
    pz.actores = "";
    pz.datos = "";
    if (pid === "p5") this.resetPuente();
    if (pid === "p6") this.resetEsclusa();
    if (pid === "p4") this.rayos = { ronda: 1, sec: [], idx: 0 };
    this.g.aviso(`✖ Falló "${def.nombre}": ${razon} Llegan más soldados y la consola se bloquea ${MINIGAME_LOCK} s.`, "peligro");
    this.g.director.onPuzzleFail(pid);
  }

  private resolve(pid: string): void {
    const pz = this.pz(pid);
    const def = PUZZLES[pid];
    for (const a of this.actores(pz)) {
      const p = this.player(a);
      if (p && p.ocupado === pid) p.ocupado = "";
    }
    pz.estado = "resuelto";
    pz.tiempo = 0;
    this.g.flags.add(pid);
    this.g.director.onPuzzleEnd(pid);
    const st = this.get("station", pid)[0];
    if (st) this.g.fx("rescate", st.x, st.y, { c: 0x7dff6a });
    if (def.tipo === "nucleo") {
      const jefe = this.g.state.jefe ? this.g.state.unidades.get(this.g.state.jefe) : undefined;
      if (jefe && jefe.tanques > 0) jefe.tanques--;
      const quedan = ["n1", "n2", "n3"].filter((n) => !this.g.flags.has(n)).length;
      this.g.fx("nucleo", 88 * TILE, 78 * TILE);
      this.g.aviso(quedan ? `¡Depósito del jefe destruido! Quedan ${quedan}.` : "¡Los tres depósitos rotos! El jefe ya no tiene blindaje: ¡acábenlo!", "exito");
    } else {
      this.g.aviso(`✔ "${def.nombre}" resuelto.`, "exito");
    }
  }

  // ------------------------------------------------------------------ dúos: ¿quién hace cada papel?
  /** Devuelve [jugadorRolA, jugadorRolB, solo] o null si nadie puede. */
  private repartir(pid: string, starter: string): [string, string, boolean] | null {
    const [ra, rb] = PUZZLES[pid].roles;
    const vivos: [string, Player][] = [];
    this.g.state.jugadores.forEach((p, id) => p.vivo && vivos.push([id, p]));
    const s = this.player(starter)!;
    const sA = this.g.qualifies(s, ra);
    const sB = this.g.qualifies(s, rb);
    const other = (role: AlienKind) => vivos.find(([id, p]) => id !== starter && this.g.qualifies(p, role));
    if (sA) {
      const o = other(rb);
      if (o) return [starter, o[0], false];
      if (sB) return [starter, starter, true];
    }
    if (sB) {
      const o = other(ra);
      if (o) return [o[0], starter, false];
    }
    return null;
  }

  // ------------------------------------------------------------------ P4: Sala de rayos
  private startRayos(id: string, p: Player): void {
    const pz = this.pz("p4");
    if (pz.estado === "resuelto") return;
    if (pz.estado === "bloqueado") return this.g.aviso(`Consola bloqueada: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    if (!this.g.qualifies(p, "cambiaformas")) return this.g.aviso("La consola solo muestra el código a humanos: necesita al Cambiaformas disfrazado.", "info", id);
    if (!p.disfrazado) return this.g.aviso("Disfrázate (ESPACIO) para que la consola te muestre el código.", "info", id);
    if (pz.estado === "activo") return; // ya lo está viendo
    const r = this.repartir("p4", id);
    if (!r) return this.g.aviso("Hace falta alguien con telequinesis (el Inteligente o su alma).", "info", id);
    const [a, b, solo] = r;
    pz.estado = "activo";
    pz.solo = solo;
    pz.total = pz.tiempo = PUZZLES.p4.duracion * (solo ? SOLO_TIME_FACTOR : 1);
    pz.actores = solo ? a : `${a},${b}`;
    this.rayos = { ronda: 1, sec: this.secuencia(4), idx: 0 };
    this.syncRayos();
    const pb = this.player(b)!;
    this.g.aviso(
      solo
        ? `${p.nombre} hace los dos papeles: memoriza el código de la consola y actívalo con telequinesis en los interruptores.`
        : `Sala de rayos: ${p.nombre} lee el código en la consola y ${pb.nombre} activa los interruptores con telequinesis. ¡Comuníquense!`,
      "info",
    );
    this.g.director.onPuzzleStart("p4");
  }

  private secuencia(n: number): number[] {
    const out: number[] = [];
    while (out.length < n) {
      const s = Math.floor(Math.random() * RAYOS_SIMBOLOS.length);
      if (out[out.length - 1] !== s) out.push(s);
    }
    return out;
  }

  private syncRayos(): void {
    this.pz("p4").datos = JSON.stringify({ ronda: this.rayos.ronda, sec: this.rayos.sec, idx: this.rayos.idx });
  }

  private switchAt(x: number, y: number): MapObject | undefined {
    return this.get("switch", "p4").find((o) => dist(x, y, o.x, o.y) < 60);
  }

  // ------------------------------------------------------------------ P5: Puente sobre el ácido
  private updatePuente(dt: number): void {
    const remove: string[] = [];
    this.g.state.objetos.forEach((o, oid) => {
      if (o.k !== "bloque") return;
      if (o.st === "sostenido") {
        const p = this.player(o.dueno);
        if (!p || !p.vivo) return void remove.push(oid);
        o.x = Math.round(p.x + Math.cos(p.aim) * 46);
        o.y = Math.round(p.y + Math.sin(p.aim) * 46 - 20);
      } else if (o.st === "hundiendo") {
        o.t -= dt;
        if (o.t <= 0) {
          remove.push(oid);
          this.g.fx("acido", o.x, o.y, { r: 40 });
          this.g.aviso("Un bloque se hundió en el ácido.", "peligro");
        }
      }
    });
    for (const id of remove) this.g.state.objetos.delete(id);
  }

  private slotFree(i: number): boolean {
    const s = this.get("slot", "p5").find((o) => Number(o.props.i) === i);
    if (!s) return false;
    let free = true;
    this.g.state.objetos.forEach((o) => {
      if ((o.k === "bloque" || o.k === "puente") && o.st !== "sostenido" && dist(o.x, o.y, s.x, s.y) < 10) free = false;
    });
    return free;
  }

  private bridgesDone(): number {
    let n = 0;
    this.g.state.objetos.forEach((o) => {
      if (o.k === "puente" && o.dueno === "p5") n++;
    });
    return n;
  }

  private pressBridgeButton(id: string, p: Player): void {
    const pz = this.pz("p5");
    if (pz.estado !== "activo") return;
    if (this.bridgesDone() < PUENTE.slots) return;
    this.g.aviso(`${p.nombre} pulsó el botón.`, "exito");
    this.resolve("p5");
  }

  private resetPuente(): void {
    const remove: string[] = [];
    this.g.state.objetos.forEach((o, oid) => {
      if ((o.k === "bloque" || o.k === "puente") && (o.dueno === "p5" || o.st === "hundiendo" || o.st === "sostenido")) {
        remove.push(oid);
        this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), false);
      }
    });
    for (const id of remove) this.g.state.objetos.delete(id);
    // Nadie se queda dentro del ácido.
    const disp = this.get("dispenser", "p5")[0];
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo && this.g.world.blocksMoveAt(p.x, p.y) && disp) {
        p.x = disp.x;
        p.y = disp.y + 60;
      }
    });
  }

  // ------------------------------------------------------------------ P6: Esclusa doble
  private lever(id: string, p: Player, parte: "A" | "B"): void {
    const pz = this.pz("p6");
    if (pz.estado === "resuelto") return;
    if (pz.estado === "bloqueado") return this.g.aviso(`Esclusa bloqueada: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    const role: AlienKind = parte === "A" ? "cambiaformas" : "delmar";
    if (pz.estado === "activo") {
      // Volver a la palanca durante la pausa
      return;
    }
    if (!this.g.qualifies(p, role)) return this.g.aviso(`Esta palanca es del ${ALIENS[role].nombre} (o de quien lleve su alma).`, "info", id);
    this.palancas[parte] = id;
    const otra = parte === "A" ? "B" : "A";
    const otraRole: AlienKind = otra === "A" ? "cambiaformas" : "delmar";
    // ¿Solo? Si nadie más vivo puede hacer el otro papel y este jugador sí.
    let otroPosible = false;
    this.g.state.jugadores.forEach((o, oid) => {
      if (oid !== id && this.g.qualifies(o, otraRole)) otroPosible = true;
    });
    const solo = !otroPosible && this.g.qualifies(p, otraRole);
    if (!solo && !this.palancas[otra]) {
      this.g.aviso(`${p.nombre} está en la palanca ${parte}. Falta alguien en la palanca ${otra}.`, "info");
      return;
    }
    if (!solo && !otroPosible) return this.g.aviso("Falta alguien que pueda usar la otra palanca.", "info", id);
    const opA = solo ? id : this.palancas.A;
    const opB = solo ? id : this.palancas.B;
    pz.estado = "activo";
    pz.solo = solo;
    pz.total = pz.tiempo = ESCLUSA.rounds * (ESCLUSA.roundTime + ESCLUSA.pause);
    pz.actores = solo ? id : `${opA},${opB}`;
    this.esclusa = {
      ronda: 1,
      fase: "espera",
      inicio: 0,
      pausaT: 3,
      notas: [],
      hitsA: [],
      hitsB: [],
      evaluada: [],
      fallos: 0,
      agua: 0,
      aguaT: 4,
      opA,
      opB,
      ultimoError: -9,
    };
    this.g.aviso(solo ? `${p.nombre} maneja las dos palancas (F y J). ¡A la vez en las notas dobles!` : "¡Esclusa en marcha! Cada uno ve su mitad del ritmo; las notas dobles se pulsan A LA VEZ.", "info");
    this.g.director.onPuzzleStart("p6");
    this.syncEsclusa();
  }

  private generarNotas(ronda: number): Nota[] {
    const notas: Nota[] = [];
    const gap = ronda === 1 ? 1.1 : ronda === 2 ? 0.85 : 0.7;
    for (let t = 2; t < ESCLUSA.roundTime - 0.5; t += gap * (0.8 + Math.random() * 0.5)) {
      const r = Math.random();
      notas.push({ t: Math.round(t * 100) / 100, l: r < 0.3 ? "AB" : r < 0.65 ? "A" : "B" });
    }
    return notas;
  }

  private updateEsclusa(dt: number): void {
    const e = this.esclusa;
    const pz = this.pz("p6");
    if (!e) return;
    pz.tiempo = Math.max(0, pz.tiempo - dt);
    // Agua que entra (el del mar la transmuta)
    e.aguaT -= dt;
    if (e.aguaT <= 0) {
      e.aguaT = e.fase === "ritmo" ? 5 : 2.2;
      this.spawnAgua();
    }
    let agua = 0;
    this.g.state.objetos.forEach((o) => o.k === "charco_agua" && agua++);
    e.agua = agua;
    if (agua > ESCLUSA.maxWater) return this.fail("p6", "¡La sala se inundó!");
    const opA = this.player(e.opA);
    const opB = this.player(e.opB);
    if (!opA?.vivo || !opB?.vivo) return this.fail("p6", "Falta quien maneje una palanca.");
    const leverA = this.get("lever", "p6").find((l) => l.props.parte === "A")!;
    const leverB = this.get("lever", "p6").find((l) => l.props.parte === "B")!;
    const solo = pz.solo;
    const cerca = (p: Player, l: MapObject) => dist(p.x, p.y, l.x, l.y) <= INTERACT_RANGE + 20;
    if (e.fase === "espera" || e.fase === "pausa") {
      e.pausaT -= dt;
      const listos = solo ? cerca(opA, leverA) || cerca(opA, leverB) : cerca(opA, leverA) && cerca(opB, leverB);
      if (e.pausaT <= 0 && listos) {
        e.fase = "ritmo";
        e.inicio = this.g.time + 0.5;
        e.notas = this.generarNotas(e.ronda);
        e.hitsA = e.notas.map(() => false);
        e.hitsB = e.notas.map(() => false);
        e.evaluada = e.notas.map(() => false);
        opA.ocupado = "p6";
        opB.ocupado = "p6";
        this.syncEsclusa();
      } else if (e.pausaT <= 0) {
        e.pausaT = 0;
        this.syncEsclusa();
      }
      return;
    }
    // Ritmo: evaluar notas pasadas
    const ahora = this.g.time - e.inicio;
    let cambio = false;
    e.notas.forEach((n, i) => {
      if (e.evaluada[i] || ahora < n.t + ESCLUSA.hitWindow + 0.6) return;
      e.evaluada[i] = true;
      const ok = n.l === "A" ? e.hitsA[i] : n.l === "B" ? e.hitsB[i] : e.hitsA[i] && e.hitsB[i];
      if (!ok) {
        e.fallos++;
        cambio = true;
      }
    });
    if (e.fallos >= ESCLUSA.maxMisses) return this.fail("p6", "Demasiadas notas falladas.");
    if (ahora >= ESCLUSA.roundTime + 0.8) {
      opA.ocupado = "";
      opB.ocupado = "";
      if (e.ronda >= ESCLUSA.rounds) {
        this.limpiarAgua();
        return this.resolve("p6");
      }
      e.ronda++;
      e.fase = "pausa";
      e.pausaT = ESCLUSA.pause;
      this.g.aviso(`Ronda ${e.ronda - 1} superada. Pausa de ${ESCLUSA.pause} s: ¡el del mar transmuta el agua! Luego vuelvan a las palancas.`, "info");
      cambio = true;
    }
    if (cambio) this.syncEsclusa();
  }

  private esclusaNota(id: string, msg: MinigameMsg): void {
    const e = this.esclusa;
    if (!e || e.fase !== "ritmo" || typeof msg.nota !== "number") return;
    if (!msg.ok) {
      // Pulsar sin nota también cuenta como fallo (evita aporrear la tecla).
      if (this.g.time - e.ultimoError < 0.3 || (id !== e.opA && id !== e.opB)) return;
      e.ultimoError = this.g.time;
      e.fallos++;
      this.syncEsclusa();
      if (e.fallos >= ESCLUSA.maxMisses) this.fail("p6", "Demasiadas notas falladas.");
      return;
    }
    const i = msg.nota | 0;
    if (i < 0 || i >= e.notas.length || e.evaluada[i]) return;
    const pz = this.pz("p6");
    const lane = msg.lane;
    if (pz.solo) {
      if (id !== e.opA) return;
      if (lane === "A") e.hitsA[i] = true;
      else if (lane === "B") e.hitsB[i] = true;
      return;
    }
    if (id === e.opA) e.hitsA[i] = true;
    if (id === e.opB) e.hitsB[i] = true;
  }

  private syncEsclusa(): void {
    const e = this.esclusa;
    if (!e) return;
    this.pz("p6").datos = JSON.stringify({
      ronda: e.ronda,
      fase: e.fase,
      inicio: e.inicio,
      pausa: e.pausaT,
      notas: e.notas,
      fallos: e.fallos,
      max: ESCLUSA.maxMisses,
      opA: e.opA,
      opB: e.opB,
    });
  }

  private spawnAgua(): void {
    const z = this.get("water_zone", "p6")[0];
    if (!z) return;
    for (let k = 0; k < 6; k++) {
      const x = z.x + Math.random() * z.w;
      const y = z.y + Math.random() * z.h;
      if (this.g.world.blocksMoveAt(x, y)) continue;
      const o = new Prop();
      o.k = "charco_agua";
      o.x = Math.round(x);
      o.y = Math.round(y);
      o.dueno = "p6";
      this.g.state.objetos.set(this.g.id("o"), o);
      return;
    }
  }

  private limpiarAgua(): void {
    const remove: string[] = [];
    this.g.state.objetos.forEach((o, oid) => o.k === "charco_agua" && remove.push(oid));
    for (const id of remove) this.g.state.objetos.delete(id);
  }

  private resetEsclusa(): void {
    const e = this.esclusa;
    if (e) {
      for (const id of [e.opA, e.opB]) {
        const p = this.player(id);
        if (p && p.ocupado === "p6") p.ocupado = "";
      }
    }
    this.esclusa = null;
    this.palancas = { A: "", B: "" };
    this.limpiarAgua();
  }

  // ------------------------------------------------------------------ habilidades sobre objetos de puzzle
  /** Devuelve null si no había nada de puzzle ahí, o el enfriamiento a aplicar. */
  telequinesis(id: string, p: Player, x: number, y: number): number | null {
    // Interruptores de la Sala de rayos
    const sw = this.switchAt(x, y);
    if (sw) {
      const pz = this.pz("p4");
      if (pz.estado !== "activo") {
        this.g.aviso("Los interruptores no responden: primero hay que leer el código en la consola.", "info", id);
        return 0;
      }
      const sim = Number(sw.props.simbolo);
      this.g.fx("telequinesis", p.x, p.y, { x2: sw.x, y2: sw.y });
      if (sim === this.rayos.sec[this.rayos.idx]) {
        this.rayos.idx++;
        this.g.fx("chispa", sw.x, sw.y);
        if (this.rayos.idx >= this.rayos.sec.length) {
          if (this.rayos.ronda >= 3) {
            this.syncRayos();
            this.resolve("p4");
            return 0.8;
          }
          this.rayos.ronda++;
          this.rayos.sec = this.secuencia(3 + this.rayos.ronda);
          this.rayos.idx = 0;
          this.g.aviso(`¡Código correcto! Ronda ${this.rayos.ronda} de 3: nuevo código en la consola.`, "exito");
        }
        this.syncRayos();
      } else {
        this.fail("p4", `Interruptor equivocado (${RAYOS_SIMBOLOS[sim].nombre}).`);
      }
      return 0.8;
    }
    // Dispensador y casillas del puente
    const disp = this.get("dispenser", "p5")[0];
    if (disp && dist(x, y, disp.x, disp.y) < 70) {
      const pz = this.pz("p5");
      if (pz.estado === "resuelto" || pz.estado === "bloqueado") return 0;
      if (!this.g.qualifies(p, "inteligente")) return null;
      if (pz.estado === "libre") {
        const r = this.repartir("p5", id);
        if (!r) {
          this.g.aviso("Hace falta alguien que transmute (el Del mar o su alma).", "info", id);
          return 0;
        }
        pz.estado = "activo";
        pz.solo = r[2];
        pz.total = pz.tiempo = PUZZLES.p5.duracion * (r[2] ? SOLO_TIME_FACTOR : 1);
        pz.actores = r[2] ? id : `${r[0]},${r[1]}`;
        this.g.aviso(r[2] ? `${p.nombre} hace los dos papeles: coloca bloques y transmútalos antes de que se hundan.` : "¡Puente! Coloquen bloques con telequinesis y transmútenlos en puente antes de que se hundan.", "info");
        this.g.director.onPuzzleStart("p5");
      }
      let ya = false;
      this.g.state.objetos.forEach((o) => {
        if (o.k === "bloque" && o.st === "sostenido" && o.dueno === id) ya = true;
      });
      if (ya) {
        this.g.aviso("Ya sostienes un bloque: apunta a una casilla del ácido.", "info", id);
        return 0;
      }
      const b = new Prop();
      b.k = "bloque";
      b.st = "sostenido";
      b.dueno = id;
      b.x = Math.round(p.x);
      b.y = Math.round(p.y - 40);
      this.g.state.objetos.set(this.g.id("o"), b);
      this.g.fx("telequinesis", disp.x, disp.y, { x2: p.x, y2: p.y });
      return 0.8;
    }
    const slot = this.get("slot", "p5").find((o) => dist(x, y, o.x, o.y) < 48);
    if (slot) {
      let held: Prop | null = null;
      this.g.state.objetos.forEach((o) => {
        if (o.k === "bloque" && o.st === "sostenido" && o.dueno === id) held = o;
      });
      if (!held) {
        this.g.aviso("Primero toma un bloque del dispensador (telequinesis sobre él).", "info", id);
        return 0;
      }
      const i = Number(slot.props.i);
      if (!this.slotFree(i)) {
        this.g.aviso("Esa casilla ya tiene un bloque.", "info", id);
        return 0;
      }
      if (dist(p.x, p.y, slot.x, slot.y) > TELEQUINESIS.range + 60) return 0;
      const h = held as Prop;
      this.g.fx("telequinesis", h.x, h.y, { x2: slot.x, y2: slot.y });
      h.st = "hundiendo";
      h.t = PUENTE.sinkTime;
      h.x = Math.round(slot.x);
      h.y = Math.round(slot.y);
      h.dueno = "p5";
      return 0.8;
    }
    return null;
  }

  transmutar(id: string, p: Player, x: number, y: number): number | null {
    // Bloque hundiéndose → pieza de puente
    let target: [string, Prop] | null = null;
    this.g.state.objetos.forEach((o, oid) => {
      if (target) return;
      if (o.k === "bloque" && o.st === "hundiendo" && dist(x, y, o.x, o.y) < 50) target = [oid, o];
      else if (o.k === "charco_agua" && dist(x, y, o.x, o.y) < 55) target = [oid, o];
    });
    if (!target) return null;
    const [oid, o] = target as [string, Prop];
    if (o.k === "charco_agua") {
      this.g.state.objetos.delete(oid);
      this.g.fx("transmutar", o.x, o.y, { c: 0x5ab8ff, x2: p.x, y2: p.y });
      return 0.8;
    }
    o.k = "puente";
    o.st = "";
    o.dueno = "p5";
    this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), true);
    this.g.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
    const n = this.bridgesDone();
    if (n >= PUENTE.slots) this.g.aviso("¡Puente completo! Crucen y pulsen el botón (E).", "exito");
    else this.g.aviso(`Puente: ${n}/${PUENTE.slots}`, "info");
    void id;
    return 0.8;
  }
}
