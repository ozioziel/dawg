// Tareas de Cambiaformas (C), Del Mar (D) y Telequinesis (T) en los tres sectores.
import { CODIGO_COLORES, DYN_DISPARO, DYN_TODOS, HAB, RITMO, TILE, dist, type MinigameMsg } from "@dawg/shared";
import type { Player, Unit } from "../../schema/GameState";
import { RetoBase } from "./base";

const azar = (n: number) => Math.floor(Math.random() * n);

// ================================================================== C · Sector I: Credencial del inspector
export class T1C extends RetoBase {
  private inspector = "";
  private consola = "";
  private teclado = "";
  private codigo: number[] = [];
  private leido = false;

  protected override montar(): void {
    this.despejar(this.pos(0.5, 0.5).x, this.pos(0.5, 0.5).y, 400);
    this.consola = this.obj("consola_c", this.pos(0.18, 0.22).x, this.pos(0.18, 0.22).y, { txt: "Consola del inspector" });
    this.teclado = this.obj("teclado", this.pos(0.82, 0.78).x, this.pos(0.82, 0.78).y, { txt: "Teclado de seguridad" });
    this.traerInspector();
    this.texto("Escanea vivo al Inspector (habilidad a su lado).");
  }

  private traerInspector(): void {
    const ruta = [this.pos(0.25, 0.3), this.pos(0.75, 0.3), this.pos(0.75, 0.7), this.pos(0.25, 0.7)];
    this.inspector = this.unidad("inspector", ruta[0].x, ruta[0].y, { etiqueta: "Inspector", ruta });
  }

  override onUnidadMuere(uid: string): void {
    if (uid !== this.inspector || this.resuelto) return;
    this.g.aviso("El Inspector cayó… llega otro inspector de relevo en unos segundos.", "info");
    this.despues(5, () => !this.resuelto && this.traerInspector());
  }

  override onEscaneo(_id: string, p: Player, u: Unit): void {
    if (u.t === "inspector" && !this.resuelto) {
      this.texto("Disfrazado de Inspector: lee el código en su consola (E).");
      this.empezar();
      void p;
    }
  }

  override interact(id: string, p: Player): boolean {
    if (this.cerca(p, this.consola)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.bloqueado(id)) return true;
      if (!p.disfrazado || p.identidad !== "inspector") {
        this.g.aviso("La consola pide la credencial del Inspector: escanéalo y ve disfrazado de él.", "info", id);
        return true;
      }
      this.empezar();
      this.codigo = [0, 0, 0, 0].map(() => azar(CODIGO_COLORES.length));
      this.leido = true;
      this.g.emit("codigo", { reto: this.slot, codigo: this.codigo, hasta: this.g.time + 9 }, id);
      this.g.fx("escaneo", p.x, p.y, { x2: this.o(this.consola)!.x, y2: this.o(this.consola)!.y });
      this.texto("Memoriza el código de colores y márcalo en el teclado (E).");
      this.o(this.consola)!.st = "on";
      return true;
    }
    if (this.cerca(p, this.teclado)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.bloqueado(id)) return true;
      if (!this.leido) {
        this.g.aviso("Primero lee el código en la consola del Inspector.", "info", id);
        return true;
      }
      p.ocupado = this.slot;
      this.st.actores = id;
      this.st.datos = JSON.stringify({ largo: this.codigo.length });
      return true;
    }
    return false;
  }

  override mensaje(id: string, msg: MinigameMsg): void {
    if (msg.ev === "fallo") {
      const p = this.jugadores.get(id);
      if (p?.ocupado === this.slot) p.ocupado = "";
      return;
    }
    if (msg.ev !== "codigo" || !Array.isArray(msg.codigo)) return;
    const p = this.jugadores.get(id);
    if (p?.ocupado === this.slot) p.ocupado = "";
    const ok = msg.codigo.length === this.codigo.length && msg.codigo.every((c, i) => c === this.codigo[i]);
    if (ok) return this.resolver();
    this.leido = false;
    this.texto("Código incorrecto: vuelve a leerlo en la consola (E).");
    if (p) p.sospecha = Math.min(0.95, p.sospecha + 0.3);
    this.error(id, "Código incorrecto: la consola genera uno nuevo y la seguridad sospecha.");
  }
}

// ================================================================== C · Sector II: Control de identidad
export class T2C extends RetoBase {
  private tecnico = "";
  private escaner = "";
  private clave = "";
  private terminal = "";
  private arco = "";
  private arcoAbierto = 0;
  private verif = 0;
  private portador = "";
  private huecoArco = { tx: 0, ty: 0, tw: 1, th: 1 };
  private interior = { tx: 0, ty: 0 };

  protected override montar(): void {
    const c = this.casilla(0.72, 0.5);
    this.interior = { tx: c.tx - 1, ty: c.ty - 1 };
    this.despejar(c.x, c.y, 300);
    const r = this.anillo("muro", c.tx - 1, c.ty - 1, 3, 3, 1, DYN_TODOS | DYN_DISPARO, { lado: "o", desde: 1, ancho: 1 });
    this.huecoArco = r.hueco!;
    this.arco = this.bloqueo("arco", this.huecoArco.tx, this.huecoArco.ty, 1, 1, DYN_TODOS);
    this.clave = this.obj("clave", c.x, c.y, { txt: "Clave de contención" });
    const e = { x: (this.huecoArco.tx - 1 + 0.5) * TILE, y: (this.huecoArco.ty + 0.5) * TILE };
    this.escaner = this.obj("escaner", e.x, e.y - 50, { txt: "Arco de identidad", v: 0 });
    this.terminal = this.obj("terminal_c", this.pos(0.12, 0.2).x, this.pos(0.12, 0.2).y, { txt: "Terminal de contención" });
    this.traerTecnico();
    this.texto("Copia al Técnico de auditoría y verifica su identidad en el arco (mantén E).");
  }

  private traerTecnico(): void {
    const ruta = [this.pos(0.15, 0.75), this.pos(0.45, 0.85), this.pos(0.45, 0.15), this.pos(0.15, 0.4)];
    this.tecnico = this.unidad("tecnico", ruta[0].x, ruta[0].y, { etiqueta: "Técnico de auditoría", ruta });
  }

  override onUnidadMuere(uid: string): void {
    if (uid === this.tecnico && !this.resuelto) {
      this.g.aviso("Llega un técnico de relevo.", "info");
      this.despues(5, () => !this.resuelto && this.traerTecnico());
    }
  }

  override onEscaneo(_id: string, _p: Player, u: Unit): void {
    if (u.t === "tecnico") this.empezar();
  }

  protected override update(dt: number): void {
    if (this.arcoAbierto > 0) {
      this.arcoAbierto -= dt;
      if (this.arcoAbierto <= 0) {
        // Si alguien está en el umbral, espera un poco más.
        let ocupado = false;
        this.jugadores.forEach((p) => {
          if (Math.floor(p.x / TILE) === this.huecoArco.tx && Math.floor(p.y / TILE) === this.huecoArco.ty) ocupado = true;
        });
        if (ocupado) this.arcoAbierto = 0.5;
        else {
          this.arco = this.bloqueo("arco", this.huecoArco.tx, this.huecoArco.ty, 1, 1, DYN_TODOS);
          this.o(this.escaner)!.st = "";
        }
      }
    }
    if (this.portador) {
      const p = this.jugadores.get(this.portador);
      const k = this.o(this.clave);
      if (!p || !p.vivo || p.forma !== "cambiaformas") {
        this.portador = "";
        const c = { x: (this.interior.tx + 1.5) * TILE, y: (this.interior.ty + 1.5) * TILE };
        if (k) {
          k.x = c.x;
          k.y = c.y;
          k.st = "";
        }
        this.g.aviso("La clave volvió a su cámara.", "peligro");
      } else if (k) {
        k.x = Math.round(p.x);
        k.y = Math.round(p.y - 60);
      }
    }
    this.o(this.escaner)!.v = this.verif;
  }

  override mantener(id: string, p: Player, dt: number): boolean {
    if (!this.cerca(p, this.escaner, 110) || this.arcoAbierto > 0) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (!p.disfrazado || p.identidad !== "tecnico") {
      if (this.verif === 0) {
        this.error(id, "¡Identidad no autorizada! El arco solo se abre para el Técnico de auditoría.");
        p.sospecha = Math.min(0.95, p.sospecha + 0.35);
        this.verif = -1;
        this.despues(2, () => (this.verif = 0));
      }
      return true;
    }
    this.empezar();
    this.verif = Math.max(0, this.verif) + dt / 3;
    p.sospecha = Math.min(0.98, p.sospecha + dt * 0.05);
    if (this.verif >= 1) {
      this.verif = 0;
      this.quitarBloqueo(this.arco);
      this.arcoAbierto = 9;
      this.o(this.escaner)!.st = "on";
      this.g.aviso("Identidad verificada: el arco se abre 9 s.", "exito", id);
      this.texto("Entra, toma la clave (E) y llévala al terminal (E).");
    }
    return true;
  }

  override interact(id: string, p: Player): boolean {
    if (!this.portador && this.cerca(p, this.clave, 80)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      this.portador = id;
      this.o(this.clave)!.st = "llevada";
      this.g.aviso("Tienes la clave. Sal antes de que el arco se cierre (si se cierra, verifica desde dentro con E).", "exito", id);
      return true;
    }
    // Verificar desde dentro de la cámara
    if (this.arcoAbierto <= 0 && Math.floor(p.x / TILE) >= this.interior.tx && Math.floor(p.x / TILE) < this.interior.tx + 3 && Math.floor(p.y / TILE) >= this.interior.ty && Math.floor(p.y / TILE) < this.interior.ty + 3) {
      if (p.disfrazado && p.identidad === "tecnico") {
        this.quitarBloqueo(this.arco);
        this.arcoAbierto = 6;
        return true;
      }
      this.g.aviso("Necesitas la identidad del Técnico para abrir desde dentro.", "info", id);
      return true;
    }
    if (this.cerca(p, this.terminal)) {
      if (this.portador !== id) {
        this.g.aviso("El terminal espera la clave de contención.", "info", id);
        return true;
      }
      this.resolver();
      return true;
    }
    return false;
  }
}

// ================================================================== C · Sector III: Sello de evacuación
export class T3C extends RetoBase {
  private oficial = "";
  private terminal = "";
  private avance = 0;

  protected override montar(): void {
    this.terminal = this.obj("terminal_emergencia", this.pos(0.5, 0.25).x, this.pos(0.5, 0.25).y, { txt: "Terminal de emergencia", v: 0 });
    this.traerOficial();
    this.texto("Escanea al Oficial de evacuación (va armado) y, disfrazado de él, mantén E en el terminal.");
  }

  private traerOficial(): void {
    const ruta = [this.pos(0.2, 0.6), this.pos(0.8, 0.6), this.pos(0.8, 0.85), this.pos(0.2, 0.85)];
    this.oficial = this.unidad("oficial", ruta[0].x, ruta[0].y, { etiqueta: "Oficial de evacuación", ruta });
    this.unidad("fusilero", ruta[1].x, ruta[1].y, { ruta });
  }

  override onUnidadMuere(uid: string): void {
    if (uid === this.oficial && !this.resuelto) {
      let copiado = false;
      this.jugadores.forEach((p) => p.identidad === "oficial" && (copiado = true));
      if (!copiado) {
        this.g.aviso("El Oficial cayó antes de copiarlo: llega otro oficial con escolta.", "info");
        this.despues(6, () => !this.resuelto && this.traerOficial());
      }
    }
  }

  protected override update(dt: number): void {
    // Sin nadie trabajando, el sello se vuelve a cerrar poco a poco.
    this.avance = Math.max(0, this.avance - dt * 0.02);
    this.o(this.terminal)!.v = this.avance;
    this.progreso(this.avance);
  }

  override mantener(id: string, p: Player, dt: number): boolean {
    if (!this.cerca(p, this.terminal, 100)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (!p.disfrazado || p.identidad !== "oficial") {
      this.g.aviso("El terminal de emergencia solo responde al Oficial de evacuación: cópialo y disfrázate.", "info", id);
      return true;
    }
    this.empezar();
    this.avance += (dt / 7) * this.g.sectores.factorAlarma();
    p.sospecha = Math.min(0.99, p.sospecha + dt * 0.04);
    if (this.avance >= 1) this.resolver();
    return true;
  }
}

// ================================================================== D · Sector I: Cinta de incubación
const SIMBOLOS = ["Concha", "Espiral", "Ala", "Cristal"];
export class T1D extends RetoBase {
  private huecos: string[] = [];
  private items = new Map<string, number>();
  private gen = 0;
  private hechos = 0;

  protected override montar(): void {
    const a = this.pos(0.08, 0.68);
    const b = this.pos(0.92, 0.68);
    this.despejar((a.x + b.x) / 2, a.y, 500);
    this.obj("cinta", (a.x + b.x) / 2, a.y, { r: Math.round(b.x - a.x), txt: "Cinta de incubación" });
    const req = [azar(4), azar(4), azar(4)];
    [0.3, 0.5, 0.7].forEach((fx, i) => {
      const p = this.pos(fx, 0.25);
      this.huecos.push(this.obj("hueco", p.x, p.y, { f: req[i], txt: `Hueco: ${SIMBOLOS[req[i]]}` }));
    });
    this.obj("conducto", this.pos(0.5, 0.25).x, this.pos(0.5, 0.25).y - 40, { r: Math.round(this.zona.w * 0.6) });
  }

  protected override update(dt: number): void {
    this.gen -= dt;
    const a = this.pos(0.08, 0.68);
    const b = this.pos(0.92, 0.68);
    if (this.gen <= 0) {
      this.gen = 1.5;
      const faltan = this.huecos.map((h) => this.o(h)!).filter((o) => o.st !== "ok").map((o) => o.f);
      const f = faltan.length && Math.random() < 0.6 ? faltan[azar(faltan.length)] : azar(4);
      this.items.set(this.obj("componente", a.x, a.y, { f }), f);
    }
    for (const [id] of this.items) {
      const o = this.o(id);
      if (!o) {
        this.items.delete(id);
        continue;
      }
      o.x += Math.round(85 * dt * (this.g.sectores.factorAlarma() > 1 ? 1.3 : 1)) || 1;
      if (o.x > b.x) {
        this.quitarObj(id);
        this.items.delete(id);
      }
    }
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    let objetivo = "";
    for (const [oid] of this.items) {
      const o = this.o(oid);
      if (o && dist(o.x, o.y, x, y) < 55) objetivo = oid;
    }
    if (!objetivo) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (dist(p.x, p.y, x, y) > HAB.delmar.range + 40) return this.g.aviso("Demasiado lejos para transmutar.", "info", id), true;
    this.empezar();
    const o = this.o(objetivo)!;
    const hueco = this.huecos.map((h) => [h, this.o(h)!] as const).find(([, h]) => h.st !== "ok" && h.f === o.f);
    p.enfriamiento = p.enfMax = 0.7;
    this.g.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
    this.quitarObj(objetivo);
    this.items.delete(objetivo);
    if (!hueco) {
      this.error(id, `Ese componente (${SIMBOLOS[o.f]}) no encaja en ningún hueco libre.`);
      return true;
    }
    hueco[1].st = "ok";
    this.g.fx("transmutar", hueco[1].x, hueco[1].y, { c: 0xffb070, x2: o.x, y2: o.y });
    this.hechos++;
    this.progreso(this.hechos / 3);
    this.g.sectores.paso(this, id);
    if (this.hechos >= 3) this.resolver();
    return true;
  }
}

// ================================================================== D · Sector II: Calibración rítmica
export class T2D extends RetoBase {
  private reactor = "";
  private deposito = "";
  private valvula = "";
  private ritmoOk = false;
  private puente = "";
  private bordes = { tx: 0, ty: 0 };

  protected override montar(): void {
    const c = this.casilla(0.68, 0.5);
    this.despejar(c.x, c.y, 360);
    // Isla rodeada de abismo con la válvula de calibración.
    const r = this.anillo("abismo", c.tx - 1, c.ty - 1, 3, 3, 2, DYN_TODOS, { lado: "o", desde: 1, ancho: 1 });
    this.bordes = { tx: r.hueco!.tx, ty: r.hueco!.ty };
    this.puente = this.bloqueo("abismo", r.hueco!.tx, r.hueco!.ty, r.hueco!.tw, 1, DYN_TODOS);
    this.valvula = this.obj("valvula_cal", c.x, c.y, { txt: "Válvula de calibración" });
    const dpos = { x: (r.hueco!.tx - 1.5) * TILE, y: (r.hueco!.ty + 0.5) * TILE };
    this.deposito = this.obj("deposito", dpos.x, dpos.y, { st: "inerte", txt: "Depósito inerte" });
    this.reactor = this.obj("reactor", this.pos(0.2, 0.3).x, this.pos(0.2, 0.3).y, { txt: "Bio-reactor (E)" });
    this.texto("Calibra el bio-reactor con la secuencia rítmica (E).");
  }

  override interact(id: string, p: Player): boolean {
    if (this.cerca(p, this.reactor)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.bloqueado(id)) return true;
      if (this.ritmoOk) return this.g.aviso("El bio-reactor ya está calibrado: transmuta el depósito.", "info", id), true;
      this.empezar();
      p.ocupado = this.slot;
      this.st.actores = id;
      this.st.datos = JSON.stringify({ semilla: azar(1e9), notas: RITMO.notas, inicio: this.g.time + 1.5, caida: RITMO.caida });
      this.st.total = this.st.tiempo = RITMO.duracion;
      return true;
    }
    if (this.cerca(p, this.valvula, 80)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      this.resolver();
      return true;
    }
    return false;
  }

  protected override update(dt: number): void {
    const actor = this.jugadores.get(this.st.actores);
    if (actor && actor.ocupado === this.slot) {
      this.st.tiempo -= dt;
      if (this.st.tiempo < -6) {
        actor.ocupado = "";
        this.fallar("El ritmo se perdió.");
      }
    }
  }

  override mensaje(id: string, msg: MinigameMsg): void {
    const p = this.jugadores.get(id);
    if (!p || p.ocupado !== this.slot) return;
    if (msg.ev === "fallo") {
      p.ocupado = "";
      this.fallar("El reactor se desacompasó.");
      return;
    }
    if (msg.ev !== "ritmo") return;
    p.ocupado = "";
    const frac = (Number(msg.aciertos) || 0) / Math.max(1, Number(msg.total) || 1);
    if (frac < RITMO.minimo) {
      this.fallar(`Calibración insuficiente (${Math.round(frac * 100)}%).`);
      return;
    }
    this.ritmoOk = true;
    this.o(this.reactor)!.st = "ok";
    this.o(this.deposito)!.st = "listo";
    this.progreso(0.6);
    this.texto("¡Calibrado! Transmuta el depósito (habilidad) para tender un soporte hasta la válvula.");
    this.g.sectores.paso(this, id);
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    if (!this.cerca({ x, y }, this.deposito, 70)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (!this.ritmoOk) return this.g.aviso("El depósito es inerte: primero calibra el bio-reactor (E).", "info", id), true;
    if (!this.o(this.deposito) || this.o(this.deposito)!.st === "soporte") return false;
    this.o(this.deposito)!.st = "soporte";
    this.quitarBloqueo(this.puente);
    this.obj("soporte", (this.bordes.tx + 0.5) * TILE, (this.bordes.ty + 0.5) * TILE, { r: 2 * TILE });
    this.g.fx("transmutar", (this.bordes.tx + 0.5) * TILE, (this.bordes.ty + 0.5) * TILE, { c: 0xff8a3a, x2: p.x, y2: p.y });
    this.texto("Cruza el soporte y abre la válvula de calibración (E).");
    p.enfriamiento = p.enfMax = 1;
    return true;
  }
}

// ================================================================== D · Sector III: Juntas orgánicas
export class T3D extends RetoBase {
  private valvulas: string[] = [];
  private presion = 0;
  private medidor = "";

  protected override montar(): void {
    for (const [fx, fy] of [[0.15, 0.25], [0.85, 0.25], [0.15, 0.78], [0.85, 0.78]]) {
      const p = this.pos(fx, fy);
      this.valvulas.push(this.obj("valvula_rota", p.x, p.y, { v: 1, st: "", txt: "Válvula" }));
    }
    this.medidor = this.obj("medidor", this.pos(0.5, 0.5).x, this.pos(0.5, 0.5).y, { v: 0, txt: "Presión de la compuerta" });
  }

  protected override update(dt: number): void {
    if (this.inicio < 0) return;
    let selladas = 0;
    for (const id of this.valvulas) {
      const o = this.o(id)!;
      // Las juntas se deterioran con el tiempo y vuelven a fallar.
      o.v = Math.max(0, o.v - dt / (o.st === "junta" ? 26 : 9) * this.g.sectores.factorAlarma());
      if (o.v <= 0 && o.st === "junta") o.st = "";
      if (o.st === "junta") selladas++;
      if (o.v <= 0 && Math.random() < dt * 0.5) this.g.fx("gas", o.x, o.y, { r: 30 });
    }
    if (selladas >= 3) this.presion += dt / 45;
    else this.presion = Math.max(0, this.presion - dt / 90);
    this.o(this.medidor)!.v = this.presion;
    this.progreso(this.presion);
    this.texto(`Juntas selladas ${selladas}/4 (hacen falta 3 para subir la presión). Presión ${Math.round(this.presion * 100)}%.`);
    if (this.presion >= 1) this.resolver();
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    const v = this.valvulas.find((v) => this.cerca({ x, y }, v, 60));
    if (!v) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (dist(p.x, p.y, x, y) > HAB.delmar.range + 40) return this.g.aviso("Demasiado lejos para transmutar.", "info", id), true;
    this.empezar();
    const o = this.o(v)!;
    o.st = "junta";
    o.v = 1;
    this.g.fx("transmutar", o.x, o.y, { c: 0xff8a3a, x2: p.x, y2: p.y });
    p.enfriamiento = p.enfMax = 1.5;
    if (this.inicio < 0) this.inicio = this.g.time;
    return true;
  }
}

// ================================================================== T · Sector I: Celda energética
export class T1T extends RetoBase {
  private proyector = "";
  private celda = "";
  private ranuras: string[] = [];
  private orden: number[] = [];
  private paso = 0;
  private visto = false;
  private sostiene = "";
  private casa = { x: 0, y: 0 };

  protected override montar(): void {
    const c = this.casilla(0.65, 0.45);
    this.despejar(c.x, c.y, 380);
    // Ranuras tras un blindaje de vidrio (no se puede entrar, pero la telequinesis pasa por encima).
    this.anillo("vidrio", c.tx - 2, c.ty - 1, 5, 3, 1, DYN_TODOS);
    for (let i = 0; i < 3; i++) this.ranuras.push(this.obj("ranura", (c.tx - 1.5 + i * 2) * TILE, (c.ty + 0.5) * TILE, { f: i, txt: ["α", "β", "γ"][i] }));
    this.casa = this.pos(0.2, 0.75);
    this.celda = this.obj("celda", this.casa.x, this.casa.y, { txt: "Celda energética" });
    this.proyector = this.obj("proyector", this.pos(0.2, 0.25).x, this.pos(0.2, 0.25).y, { txt: "Proyector de pauta (E)" });
    this.texto("Mira la pauta en el proyector (E).");
  }

  protected override reiniciar(): void {
    this.paso = 0;
    this.visto = false;
    this.sostiene = "";
    const o = this.o(this.celda);
    if (o) {
      o.x = this.casa.x;
      o.y = this.casa.y;
      o.st = "";
    }
    for (const r of this.ranuras) this.o(r)!.st = "";
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.proyector)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    this.empezar();
    this.orden = [0, 1, 2].sort(() => Math.random() - 0.5);
    this.paso = 0;
    this.visto = true;
    for (const r of this.ranuras) this.o(r)!.st = "";
    this.orden.forEach((r, i) => this.despues(0.6 + i * 0.9, () => this.o(this.ranuras[r]) && (this.o(this.ranuras[r])!.st = "pauta")));
    this.despues(0.6 + 3 * 0.9 + 0.6, () => this.ranuras.forEach((r) => this.o(r) && this.o(r)!.st === "pauta" && (this.o(r)!.st = "")));
    this.texto("Toma la celda con telequinesis y colócala en las ranuras en el orden que se iluminaron.");
    return true;
  }

  protected override update(): void {
    if (!this.sostiene) return;
    const p = this.jugadores.get(this.sostiene);
    const o = this.o(this.celda)!;
    if (!p || !p.vivo || p.forma !== "inteligente") {
      this.sostiene = "";
      o.st = "";
      return;
    }
    const d = this.g.pdata.get(this.sostiene)!;
    const ax = p.x + Math.cos(p.aim) * 130;
    const ay = p.y + Math.sin(p.aim) * 130;
    o.x = Math.round(ax);
    o.y = Math.round(ay - 20);
    void d;
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    const enCelda = this.cerca({ x, y }, this.celda, 70);
    const ranura = this.ranuras.findIndex((r) => this.cerca({ x, y }, r, 60));
    if (!enCelda && ranura < 0 && this.sostiene !== id) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (!this.visto) return this.g.aviso("Primero mira la pauta en el proyector (E).", "info", id), true;
    if (!this.sostiene) {
      if (!enCelda) return false;
      this.sostiene = id;
      this.o(this.celda)!.st = "flota";
      this.g.fx("telequinesis", p.x, p.y, { x2: x, y2: y });
      return true;
    }
    if (ranura < 0) return this.g.aviso("Suelta la celda sobre una ranura (habilidad apuntando a ella).", "info", id), true;
    this.g.fx("telequinesis", p.x, p.y, { x2: this.o(this.ranuras[ranura])!.x, y2: this.o(this.ranuras[ranura])!.y });
    if (ranura === this.orden[this.paso]) {
      this.o(this.ranuras[ranura])!.st = "ok";
      this.paso++;
      this.progreso(this.paso / 3);
      this.g.sectores.paso(this, id);
      if (this.paso >= 3) {
        this.resolver();
        return true;
      }
      this.g.aviso(`Ranura correcta (${this.paso}/3).`, "exito", id);
    } else {
      this.error(id, "Ranura equivocada: el sensor reinicia la secuencia. Vuelve a mirar la pauta.");
      this.reiniciar();
    }
    return true;
  }
}

// ================================================================== T · Sector II: Guardia títere
export class T2T extends RetoBase {
  private interruptor = "";
  private sujetos: string[] = [];
  private zonaValla = { tx: 0, ty: 0 };

  protected override montar(): void {
    const c = this.casilla(0.72, 0.5);
    this.despejar(c.x, c.y, 300);
    this.zonaValla = { tx: c.tx - 1, ty: c.ty - 1 };
    // Valla láser: los aliens no pasan, los humanos sí.
    this.anillo("valla", c.tx - 1, c.ty - 1, 3, 3, 1, 2 /* DYN_ALIENS */);
    this.interruptor = this.obj("interruptor_t", c.x, c.y, { txt: "Interruptor (solo humanos)" });
    for (const fy of [0.25, 0.75]) this.traerSujeto(fy);
    this.texto("Controla a un guardia (mantén la habilidad sobre él), llévalo hasta el interruptor y pulsa E.");
  }

  private traerSujeto(fy: number): void {
    const ruta = [this.pos(0.15, fy), this.pos(0.45, fy)];
    this.sujetos.push(this.unidad("fusilero", ruta[0].x, ruta[0].y, { etiqueta: "Sujeto de pruebas", ruta }));
  }

  override onUnidadMuere(uid: string): void {
    const i = this.sujetos.indexOf(uid);
    if (i >= 0 && !this.resuelto) {
      this.sujetos.splice(i, 1);
      this.despues(6, () => !this.resuelto && this.traerSujeto(Math.random() < 0.5 ? 0.25 : 0.75));
    }
  }

  override interact(id: string, p: Player): boolean {
    if (!p.controla) {
      if (this.cerca(p, this.interruptor, 200)) {
        this.g.aviso("La valla láser solo deja pasar a humanos: controla a un guardia y que él pulse el interruptor.", "info", id);
        return true;
      }
      return false;
    }
    const u = this.g.state.unidades.get(p.controla);
    if (!u || !this.cerca(u, this.interruptor, 80)) return false;
    if (this.bloqueado(id)) return true;
    this.g.fx("chispa", u.x, u.y);
    this.resolver();
    return true;
  }

  protected override update(): void {
    this.jugadores.forEach((p) => {
      if (p.controla && p.forma === "inteligente") this.empezar();
    });
  }
}

// ================================================================== T · Sector III: Regulador flotante
export class T3T extends RetoBase {
  private regulador = "";
  private anilloObj = "";
  private sujeta = "";
  private avance = 0;
  private deriva = { x: 0, y: 0 };
  private meta = { x: 0, y: 0, a: 0 };

  protected override montar(): void {
    const c = this.pos(0.5, 0.5);
    this.meta = { x: c.x, y: c.y, a: 0 };
    this.anilloObj = this.obj("anillo", c.x, c.y, { r: 70, v: 0, txt: "Anillo de sincronización" });
    this.regulador = this.obj("regulador", this.pos(0.2, 0.3).x, this.pos(0.2, 0.3).y, { txt: "Regulador" });
  }

  protected override update(dt: number): void {
    const r = this.o(this.regulador)!;
    const an = this.o(this.anilloObj)!;
    // El anillo se mueve despacio y el regulador deriva con la turbulencia.
    this.meta.a += dt * 0.35;
    an.x = Math.round(this.meta.x + Math.cos(this.meta.a) * this.zona.w * 0.22);
    an.y = Math.round(this.meta.y + Math.sin(this.meta.a * 1.3) * this.zona.h * 0.2);
    if (Math.random() < dt * 0.8) this.deriva = { x: (Math.random() - 0.5) * 140, y: (Math.random() - 0.5) * 140 };
    const p = this.sujeta ? this.jugadores.get(this.sujeta) : undefined;
    const d = this.sujeta ? this.g.pdata.get(this.sujeta) : undefined;
    if (p && d && d.habDown && p.vivo && p.forma === "inteligente" && p.estado === "ok") {
      // El regulador sigue al punto donde apunta, contra la turbulencia.
      const tx = d.aimX;
      const ty = d.aimY;
      r.x = Math.round(r.x + (tx - r.x) * Math.min(1, dt * 3) + this.deriva.x * dt * 0.6);
      r.y = Math.round(r.y + (ty - r.y) * Math.min(1, dt * 3) + this.deriva.y * dt * 0.6);
      r.st = "flota";
      p.canal = this.avance;
      p.canalTipo = "fijo";
    } else {
      if (p) {
        p.canalTipo = "";
        p.canal = 0;
      }
      this.sujeta = "";
      r.st = "";
      r.x = Math.round(r.x + this.deriva.x * dt);
      r.y = Math.round(r.y + this.deriva.y * dt);
      r.x = Math.max(this.zona.x, Math.min(this.zona.x + this.zona.w, r.x));
      r.y = Math.max(this.zona.y, Math.min(this.zona.y + this.zona.h, r.y));
    }
    const dentro = dist(r.x, r.y, an.x, an.y) < an.r;
    if (dentro && this.sujeta) this.avance += dt / 22;
    else this.avance = Math.max(0, this.avance - dt / 40 * this.g.sectores.factorAlarma());
    an.v = this.avance;
    an.st = dentro ? "ok" : "";
    this.progreso(this.avance);
    if (this.avance >= 1) {
      if (p) p.canalTipo = "";
      this.resolver();
    }
  }

  override habilidad(id: string, p: Player, x: number, y: number): boolean {
    if (!this.cerca({ x, y }, this.regulador, 90) && this.sujeta !== id) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (dist(p.x, p.y, x, y) > HAB.inteligente.range + 80) return this.g.aviso("Demasiado lejos.", "info", id), true;
    this.empezar();
    this.sujeta = id;
    this.g.fx("telequinesis", p.x, p.y, { x2: x, y2: y });
    this.texto("Mantén la habilidad y guía el regulador dentro del anillo.");
    return true;
  }
}
