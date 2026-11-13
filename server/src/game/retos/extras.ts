// Retos genéricos: cualquier equipo puede resolverlos (se usan para completar salas sin repetir).
import { TILE, dist } from "@dawg/shared";
import type { Player } from "../../schema/GameState";
import { RetoBase } from "./base";

// ================================================================== Fusibles de emergencia
export class XFusibles extends RetoBase {
  private fusibles: string[] = [];
  private panel = "";
  private lleva = new Map<string, number>();
  private puestos = 0;

  protected override montar(): void {
    this.panel = this.obj("panel_fusibles", this.pos(0.5, 0.12).x, this.pos(0.5, 0.12).y, { v: 0, txt: "Panel de fusibles (E)" });
    const sitios = [[0.08, 0.85], [0.92, 0.8], [0.5, 0.92], [0.12, 0.4], [0.88, 0.35]].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const [fx, fy] of sitios) this.fusibles.push(this.obj("fusible", this.pos(fx, fy).x, this.pos(fx, fy).y));
  }

  protected override update(): void {
    this.jugadores.forEach((p, id) => {
      if (!p.vivo) {
        const n = this.lleva.get(id);
        if (n) {
          for (let i = 0; i < n; i++) this.fusibles.push(this.obj("fusible", p.x + i * 30, p.y));
          this.lleva.delete(id);
        }
        return;
      }
      for (const f of [...this.fusibles]) {
        if (!this.cerca(p, f, 46)) continue;
        this.empezar();
        this.quitarObj(f);
        this.fusibles.splice(this.fusibles.indexOf(f), 1);
        this.lleva.set(id, (this.lleva.get(id) ?? 0) + 1);
        this.g.aviso(`${p.nombre} recogió un fusible.`, "info");
      }
    });
    this.texto(`Fusibles en el panel ${this.puestos}/3. Recógelos pasando por encima y llévalos al panel (E).`);
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.panel)) return false;
    if (this.bloqueado(id)) return true;
    const n = this.lleva.get(id) ?? 0;
    if (!n) return this.g.aviso("No llevas fusibles.", "info", id), true;
    this.lleva.delete(id);
    this.puestos += n;
    this.o(this.panel)!.v = this.puestos / 3;
    this.progreso(this.puestos / 3);
    this.g.fx("chispa", p.x, p.y);
    this.g.sectores.paso(this, id);
    if (this.puestos >= 3) this.resolver();
    return true;
  }
}

// ================================================================== Pirateo del terminal (mantener zona)
export class XTerminal extends RetoBase {
  private terminal = "";
  private aro = "";
  private avance = 0;

  protected override montar(): void {
    const c = this.pos(0.5, 0.5);
    this.despejar(c.x, c.y, 200);
    this.terminal = this.obj("terminal_pirateo", c.x, c.y, { txt: "Terminal" });
    this.aro = this.obj("aro_zona", c.x, c.y, { r: 170, v: 0 });
  }

  protected override update(dt: number): void {
    const t = this.o(this.terminal)!;
    let dentro = 0;
    this.jugadores.forEach((p) => p.vivo && dist(p.x, p.y, t.x, t.y) < 170 && dentro++);
    let enemigos = 0;
    this.g.state.unidades.forEach((u) => u.team === "humanos" && dist(u.x, u.y, t.x, t.y) < 170 && enemigos++);
    if (dentro > 0) this.empezar();
    if (dentro > 0 && enemigos === 0) this.avance += dt * (0.028 + 0.012 * (dentro - 1)) * this.g.sectores.factorAlarma(true);
    else if (dentro === 0) this.avance = Math.max(0, this.avance - dt * 0.01);
    this.o(this.aro)!.v = this.avance;
    this.o(this.aro)!.st = enemigos > 0 ? "mal" : dentro > 0 ? "ok" : "";
    this.progreso(this.avance);
    this.texto(enemigos > 0 && dentro > 0 ? "¡Hay guardias dentro del círculo: el pirateo se detiene!" : `Pirateo ${Math.round(this.avance * 100)}%: quédense dentro del círculo.`);
    if (this.avance >= 1) this.resolver();
  }
}

// ================================================================== Generadores de escudo
export class XGeneradores extends RetoBase {
  private gens: string[] = [];
  private caidos = 0;

  protected override montar(): void {
    for (const [fx, fy] of [[0.2, 0.3], [0.8, 0.3], [0.5, 0.8]]) {
      const p = this.pos(fx, fy);
      this.despejar(p.x, p.y, 80);
      this.gens.push(this.unidad("generador", p.x, p.y, { etiqueta: "Generador", fijo: true }));
    }
  }

  override onUnidadMuere(uid: string): void {
    if (!this.gens.includes(uid)) return;
    this.empezar();
    this.caidos++;
    this.progreso(this.caidos / this.gens.length);
    for (const g of this.gens) {
      const b = this.g.brains.get(g);
      if (b) b.shieldT = 4;
    }
    if (this.caidos >= this.gens.length) this.resolver();
    else this.g.aviso(`Generador destruido (${this.caidos}/${this.gens.length}). Los demás se blindan 4 s.`, "exito");
  }

  protected override update(): void {
    this.gens.forEach((g) => {
      const u = this.g.state.unidades.get(g);
      if (u && u.hp < u.maxHp) this.empezar();
    });
  }
}

// ================================================================== Espejos del láser
type Dir = 0 | 1 | 2 | 3; // E, S, O, N
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
export class XEspejos extends RetoBase {
  private cols = 5;
  private filas = 3;
  private espejos = new Map<string, { c: number; f: number; o: 0 | 1 }>();
  private emisorFila = 1;
  private receptor = "";
  private salida = { c: 0, f: 0 };
  private celda = 0;
  private x0 = 0;
  private y0 = 0;

  protected override montar(): void {
    this.celda = Math.min(Math.floor((this.zona.w * 0.8) / this.cols), Math.floor((this.zona.h * 0.8) / this.filas), 2 * TILE);
    this.x0 = this.zona.x + this.zona.w / 2 - (this.cols * this.celda) / 2;
    this.y0 = this.zona.y + this.zona.h / 2 - (this.filas * this.celda) / 2;
    this.despejar(this.zona.x + this.zona.w / 2, this.zona.y + this.zona.h / 2, 420);
    // Construye una solución y la desordena (siempre resoluble).
    for (let intento = 0; intento < 200; intento++) {
      const celdas = new Set<string>();
      while (celdas.size < 4) celdas.add(`${Math.floor(Math.random() * this.cols)},${Math.floor(Math.random() * this.filas)}`);
      const conf = [...celdas].map((k) => {
        const [c, f] = k.split(",").map(Number);
        return { c, f, o: (Math.random() < 0.5 ? 0 : 1) as 0 | 1 };
      });
      this.emisorFila = Math.floor(Math.random() * this.filas);
      const r = this.trazar(conf);
      if (r.reflejos < 2 || r.fuera.c === -1) continue;
      this.salida = r.fuera;
      // Desordenar hasta que no acierte.
      for (let k = 0; k < 20; k++) {
        for (const m of conf) if (Math.random() < 0.6) m.o = m.o ? 0 : 1;
        const rr = this.trazar(conf);
        if (rr.fuera.c !== this.salida.c || rr.fuera.f !== this.salida.f) break;
      }
      for (const m of conf) {
        const id = this.obj("espejo", this.x0 + (m.c + 0.5) * this.celda, this.y0 + (m.f + 0.5) * this.celda, { f: m.o, txt: "Espejo (E)" });
        this.espejos.set(id, m);
      }
      break;
    }
    this.obj("emisor", this.x0 - this.celda * 0.5, this.y0 + (this.emisorFila + 0.5) * this.celda, { ang: 0, txt: "Emisor" });
    this.receptor = this.obj("receptor", this.x0 + (this.salida.c + 0.5) * this.celda, this.y0 + (this.salida.f + 0.5) * this.celda, { txt: "Receptor" });
    this.actualizarRayo();
  }

  private trazar(conf: { c: number; f: number; o: 0 | 1 }[]): { puntos: number[][]; fuera: { c: number; f: number }; reflejos: number } {
    let c = -1;
    let f = this.emisorFila;
    let d: Dir = 0;
    const puntos: number[][] = [[c, f]];
    let reflejos = 0;
    for (let paso = 0; paso < 40; paso++) {
      c += DX[d];
      f += DY[d];
      if (c < 0 || f < 0 || c >= this.cols || f >= this.filas) return { puntos: [...puntos, [c, f]], fuera: { c, f }, reflejos };
      const m = conf.find((x) => x.c === c && x.f === f);
      if (m) {
        // "/" (0): E→N, N→E, O→S, S→O.  "\" (1): E→S, S→E, O→N, N→O
        const tabla0: Dir[] = [3, 2, 1, 0];
        const tabla1: Dir[] = [1, 0, 3, 2];
        d = (m.o === 0 ? tabla0 : tabla1)[d];
        reflejos++;
        puntos.push([c, f]);
      }
    }
    return { puntos, fuera: { c: -1, f: -1 }, reflejos };
  }

  private actualizarRayo(): boolean {
    const r = this.trazar([...this.espejos.values()]);
    const px = r.puntos.map(([c, f]) => [Math.round(this.x0 + (c + 0.5) * this.celda), Math.round(this.y0 + (f + 0.5) * this.celda)]);
    this.st.datos = JSON.stringify({ rayo: px });
    const ok = r.fuera.c === this.salida.c && r.fuera.f === this.salida.f;
    if (this.o(this.receptor)) this.o(this.receptor)!.st = ok ? "ok" : "";
    return ok;
  }

  override interact(id: string, p: Player): boolean {
    let mejor = "";
    let bd = 80;
    for (const [oid] of this.espejos) {
      const o = this.o(oid);
      if (o && dist(p.x, p.y, o.x, o.y) < bd) {
        bd = dist(p.x, p.y, o.x, o.y);
        mejor = oid;
      }
    }
    if (!mejor) return false;
    if (this.bloqueado(id)) return true;
    this.empezar();
    const m = this.espejos.get(mejor)!;
    m.o = m.o ? 0 : 1;
    this.o(mejor)!.f = m.o;
    if (this.actualizarRayo()) this.resolver();
    return true;
  }
}

// ================================================================== Carro de muestras
export class XCarro extends RetoBase {
  private carro = "";
  private cx = 0;
  private a = { x: 0, y: 0 };
  private b = { x: 0, y: 0 };

  protected override montar(): void {
    this.a = this.pos(0.06, 0.55);
    this.b = this.pos(0.94, 0.55);
    this.despejar((this.a.x + this.b.x) / 2, this.a.y, 600);
    this.obj("railes", (this.a.x + this.b.x) / 2, this.a.y, { r: Math.round(this.b.x - this.a.x) });
    this.carro = this.obj("carro", this.a.x, this.a.y, { v: 0, txt: "Carro de muestras" });
    this.cx = this.a.x;
    this.obj("meta", this.b.x, this.b.y, { txt: "Andén" });
  }

  protected override update(dt: number): void {
    const c = this.o(this.carro)!;
    let cerca = false;
    this.jugadores.forEach((p) => p.vivo && dist(p.x, p.y, c.x, c.y) < 170 && (cerca = true));
    let bloqueo = false;
    this.g.state.unidades.forEach((u) => u.team === "humanos" && dist(u.x, u.y, c.x, c.y) < 150 && (bloqueo = true));
    if (cerca) this.empezar();
    if (cerca && !bloqueo) this.cx = Math.min(this.b.x, this.cx + 52 * dt);
    c.x = Math.round(this.cx);
    c.st = bloqueo ? "mal" : cerca ? "ok" : "";
    const v = (c.x - this.a.x) / (this.b.x - this.a.x);
    c.v = v;
    this.progreso(v);
    this.texto(bloqueo ? "¡Guardias junto al carro! Despéjenlo." : cerca ? "El carro avanza…" : "Acérquense al carro para empujarlo.");
    if (v >= 1) this.resolver();
  }
}

// ================================================================== El saboteador
export class XSaboteador extends RetoBase {
  private sab = "";
  private alarma = "";
  private lector = "";
  private tarjeta = "";
  private lleva = "";
  private ruta: { x: number; y: number }[] = [];

  protected override montar(): void {
    this.ruta = [this.pos(0.1, 0.15), this.pos(0.85, 0.2), this.pos(0.15, 0.8), this.pos(0.9, 0.85)];
    this.alarma = this.obj("alarma", this.ruta[3].x, this.ruta[3].y, { txt: "Alarma" });
    this.lector = this.obj("lector_tarjeta", this.pos(0.5, 0.5).x, this.pos(0.5, 0.5).y, { txt: "Lector de tarjetas (E)" });
    this.traer();
  }

  private traer(): void {
    // Espera en su sitio hasta que llegue alguien a la sala; entonces echa a correr.
    this.sab = this.unidad("tecnico", this.ruta[0].x, this.ruta[0].y, { etiqueta: "Saboteador", fijo: true });
  }

  private correr(): void {
    const b = this.g.brains.get(this.sab);
    if (!b || b.j.saboteador) return;
    b.ruta = this.ruta.slice(1);
    b.rutaI = 0;
    b.j.saboteador = 1;
    b.fijo = false;
    this.g.aviso("¡Un saboteador corre hacia la alarma con la tarjeta de acceso!", "peligro");
  }

  override onUnidadMuere(uid: string, u: { x: number; y: number }): void {
    if (uid !== this.sab || this.resuelto) return;
    this.empezar();
    this.sab = "";
    this.tarjeta = this.obj("tarjeta", u.x, u.y, { txt: "Tarjeta" });
    this.g.aviso("¡El saboteador soltó la tarjeta! Recógela y llévala al lector.", "exito");
  }

  protected override update(): void {
    const u = this.sab ? this.g.state.unidades.get(this.sab) : undefined;
    if (u && dist(u.x, u.y, this.ruta[3].x, this.ruta[3].y) < 50) {
      this.empezar();
      this.g.removeUnit(this.sab);
      this.sab = "";
      this.o(this.alarma)!.st = "on";
      this.g.fx("alarma", this.ruta[3].x, this.ruta[3].y);
      this.error("", "¡El saboteador activó la alarma! Llegan guardias y otro técnico lo intentará.");
      this.g.director.onRetoFail(this.slot);
      this.despues(8, () => {
        if (!this.resuelto) {
          this.o(this.alarma)!.st = "";
          this.traer();
        }
      });
    }
    if (u) {
      let cerca = false;
      this.jugadores.forEach((p) => p.vivo && this.cercaDe(p.x, p.y, -32) && (cerca = true));
      if (cerca) {
        this.empezar();
        this.correr();
      }
    }
    if (this.tarjeta) {
      this.jugadores.forEach((p, id) => {
        if (this.tarjeta && p.vivo && this.cerca(p, this.tarjeta, 46)) {
          this.quitarObj(this.tarjeta);
          this.tarjeta = "";
          this.lleva = id;
        }
      });
    }
    if (this.lleva) {
      const p = this.jugadores.get(this.lleva);
      if (!p || !p.vivo) {
        this.tarjeta = this.obj("tarjeta", p?.x ?? this.ruta[0].x, p?.y ?? this.ruta[0].y);
        this.lleva = "";
      }
    }
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.lector)) return false;
    if (this.lleva !== id) return this.g.aviso("El lector necesita la tarjeta del saboteador.", "info", id), true;
    this.resolver();
    return true;
  }
}

// ================================================================== Purga de gas
export class XPurga extends RetoBase {
  private valvulas: string[] = [];
  private avance = new Map<string, number>();
  private gasT = 2;

  protected override montar(): void {
    for (const [fx, fy] of [[0.1, 0.15], [0.9, 0.15], [0.1, 0.85], [0.9, 0.85]]) {
      const id = this.obj("valvula_purga", this.pos(fx, fy).x, this.pos(fx, fy).y, { v: 0, txt: "Válvula de purga" });
      this.valvulas.push(id);
      this.avance.set(id, 0);
    }
  }

  protected override update(dt: number): void {
    if (this.inicio < 0) {
      let alguien = false;
      this.jugadores.forEach((p) => p.vivo && this.cercaDe(p.x, p.y, -64) && (alguien = true));
      if (alguien) this.empezar();
      else return;
    }
    this.gasT -= dt;
    if (this.gasT <= 0) {
      this.gasT = 2.6;
      for (const v of this.valvulas) {
        const o = this.o(v)!;
        if (o.st === "ok") continue;
        const a = Math.random() * Math.PI * 2;
        this.g.addZone("vapor", o.x + Math.cos(a) * 90, o.y + Math.sin(a) * 90, 75, 4);
      }
    }
    const cerradas = this.valvulas.filter((v) => this.o(v)!.st === "ok").length;
    this.progreso(cerradas / 4);
    if (cerradas >= 4) this.resolver();
  }

  override mantener(id: string, p: Player, dt: number): boolean {
    const v = this.valvulas.find((vv) => this.cerca(p, vv, 85) && this.o(vv)!.st !== "ok");
    if (!v) return false;
    if (this.bloqueado(id)) return true;
    this.empezar();
    const a = (this.avance.get(v) ?? 0) + dt / 2.5;
    this.avance.set(v, a);
    this.o(v)!.v = a;
    if (a >= 1) {
      this.o(v)!.st = "ok";
      this.g.fx("chispa", p.x, p.y);
      this.g.sectores.paso(this, id);
    }
    return true;
  }
}

// ================================================================== Rejilla de luces
export class XLuces extends RetoBase {
  private baldosas: string[][] = [];
  private pisando = new Map<string, string>();
  private cd = new Map<string, number>();

  protected override montar(): void {
    const tam = Math.min(110, Math.floor(Math.min(this.zona.w, this.zona.h) / 4));
    const c = this.pos(0.5, 0.5);
    this.despejar(c.x, c.y, tam * 2.5);
    for (let f = 0; f < 3; f++) {
      this.baldosas.push([]);
      for (let k = 0; k < 3; k++) this.baldosas[f].push(this.obj("baldosa", c.x + (k - 1) * tam, c.y + (f - 1) * tam, { st: "on", r: tam - 8 }));
    }
    // Desordenar con pulsaciones aleatorias (siempre resoluble).
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) this.pulsar(Math.floor(Math.random() * 3), Math.floor(Math.random() * 3));
    if (this.todas()) this.pulsar(1, 1);
  }

  private pulsar(f: number, k: number): void {
    for (const [df, dk] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const o = this.baldosas[f + df]?.[k + dk];
      if (!o) continue;
      const b = this.o(o)!;
      b.st = b.st === "on" ? "off" : "on";
    }
  }

  private todas(): boolean {
    return this.baldosas.every((fila) => fila.every((o) => this.o(o)!.st === "on"));
  }

  protected override update(dt: number): void {
    for (const [k, v] of this.cd) this.cd.set(k, v - dt);
    this.jugadores.forEach((p, id) => {
      if (!p.vivo || p.bajoTierra) return;
      let sobre = "";
      let fi = -1;
      let ki = -1;
      this.baldosas.forEach((fila, f) =>
        fila.forEach((o, k) => {
          const b = this.o(o)!;
          if (Math.abs(p.x - b.x) < b.r / 2 && Math.abs(p.y - b.y) < b.r / 2) {
            sobre = o;
            fi = f;
            ki = k;
          }
        }),
      );
      if (sobre && this.pisando.get(id) !== sobre && (this.cd.get(sobre) ?? 0) <= 0) {
        if (this.st.estado === "bloqueado") return;
        this.empezar();
        this.pulsar(fi, ki);
        this.cd.set(sobre, 0.4);
        if (this.todas()) this.resolver();
      }
      this.pisando.set(id, sobre);
    });
    let on = 0;
    this.baldosas.forEach((f) => f.forEach((o) => this.o(o)?.st === "on" && on++));
    this.progreso(on / 9);
  }
}
