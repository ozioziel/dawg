// Tareas de Escarabajo (E) y Simbionte (S) en los tres sectores.
import { DYN_DISPARO, DYN_SUPERFICIE, DYN_TODOS, TILE, dist } from "@dawg/shared";
import type { Player, Unit } from "../../schema/GameState";
import { RetoBase } from "./base";

// ================================================================== E · Sector I: Interruptor sísmico
export class T1E extends RetoBase {
  private interruptor = "";
  private grietas: { tx: number; ty: number }[] = [];
  private grietaObjs: string[] = [];
  private interior = { tx: 0, ty: 0 };

  protected override montar(): void {
    const c = this.casilla(0.6, 0.5);
    this.despejar(c.x, c.y, 360);
    this.interior = { tx: c.tx - 1, ty: c.ty - 1 };
    // Anillo de contenedores: solo se pasa por debajo.
    this.anillo("contenedor", c.tx - 1, c.ty - 1, 3, 3, 2, DYN_SUPERFICIE);
    this.interruptor = this.obj("interruptor_sismico", c.x, c.y, { txt: "Interruptor sísmico" });
    // Suelo agrietado en un lado: cruzarlo bajo tierra derrumba la base.
    const lado = Math.random() < 0.5 ? -1 : 1;
    for (let dy = -3; dy <= 3; dy++)
      for (const dx of [lado * 2, lado * 3]) {
        const g = { tx: c.tx + dx, ty: c.ty + dy };
        this.grietas.push(g);
        this.grietaObjs.push(this.obj("grieta", (g.tx + 0.5) * TILE, (g.ty + 0.5) * TILE));
      }
    this.texto(`Excava bajo los contenedores sin cruzar el suelo agrietado (lado ${lado < 0 ? "oeste" : "este"}) y pulsa E bajo el interruptor.`);
  }

  protected override update(): void {
    this.jugadores.forEach((p, id) => {
      if (!p.bajoTierra) return;
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      if (!this.grietas.some((g) => g.tx === tx && g.ty === ty)) return;
      this.empezar();
      this.g.fx("explosion", p.x, p.y, { r: 70 });
      this.g.damagePlayer(id, p, 0);
      p.bajoTierra = false;
      const pos = this.g.lugarLibre(this.pos(0.1, 0.5).x, this.pos(0.1, 0.5).y, p.x, p.y);
      p.x = pos.x;
      p.y = pos.y;
      this.error(id, "¡Cruzaste el suelo agrietado y se derrumbó la base! Rodéalo.");
    });
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.interruptor, 70)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (!p.bajoTierra) return this.g.aviso("El interruptor se activa desde abajo: excava (habilidad) y pulsa E bajo él.", "info", id), true;
    this.resolver();
    return true;
  }

  protected override alResolver(): void {
    this.limpiar();
  }
}

// ================================================================== E · Sector II: Galería secreta
export class T2E extends RetoBase {
  private placas: string[] = [];
  private paso = 0;

  protected override montar(): void {
    const pos = [[0.15, 0.2], [0.8, 0.25], [0.3, 0.8], [0.85, 0.8], [0.5, 0.5]].sort(() => Math.random() - 0.5).slice(0, 4);
    pos.forEach(([fx, fy], i) => this.placas.push(this.obj("placa", this.pos(fx, fy).x, this.pos(fx, fy).y, { f: i + 1, st: "oculto", txt: String(i + 1) })));
    this.obj("entrada_galeria", this.pos(0.05, 0.5).x, this.pos(0.05, 0.5).y, { txt: "Galería secreta (excava)" });
  }

  protected override reiniciar(): void {
    this.paso = 0;
    this.placas.forEach((p) => (this.o(p)!.st = "oculto"));
  }

  override interact(id: string, p: Player): boolean {
    const pl = this.placas.find((pp) => this.cerca(p, pp, 70));
    if (!pl) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (!p.bajoTierra) return this.g.aviso("Las placas de presión están bajo el suelo: excava para verlas y activarlas.", "info", id), true;
    if (this.bloqueado(id)) return true;
    this.empezar();
    const o = this.o(pl)!;
    if (o.st === "ok") return true;
    if (o.f !== this.paso + 1) {
      this.error(id, `Orden equivocado: esa era la placa ${o.f}. Gas en la galería; empieza de nuevo por la 1.`);
      this.g.addZone("gas", p.x, p.y, 90, 3);
      this.reiniciar();
      return true;
    }
    o.st = "ok";
    this.paso++;
    this.progreso(this.paso / 4);
    this.g.sectores.paso(this, id);
    if (this.paso >= 4) this.resolver();
    return true;
  }
}

// ================================================================== E · Sector III: Ruta bajo el cerrojo
export class T3E extends RetoBase {
  private palanca = "";
  private suelo = "";
  private cavar = 0;
  private abierto = 0;
  private extremos: string[] = [];
  private interior = { x: 0, y: 0 };

  protected override montar(): void {
    const c = this.casilla(0.7, 0.5);
    this.despejar(c.x, c.y, 360);
    this.interior = { x: c.x, y: c.y };
    this.anillo("muro", c.tx - 1, c.ty - 1, 3, 3, 1, DYN_TODOS | DYN_DISPARO);
    this.palanca = this.obj("palanca_liberacion", c.x, c.y, { txt: "Palanca de liberación" });
    const s = { x: (c.tx - 3 + 0.5) * TILE, y: c.y };
    this.suelo = this.obj("suelo_blando", s.x, s.y, { v: 0, txt: "Suelo blando: excava y mantén E" });
  }

  protected override update(dt: number): void {
    if (this.abierto > 0) {
      this.abierto -= dt;
      if (this.abierto <= 0) {
        for (const e of this.extremos) this.g.state.objetos.delete(e);
        this.extremos = [];
        this.g.aviso("La ruta temporal bajo el cerrojo se derrumbó.", "info");
      }
    }
  }

  override mantener(id: string, p: Player, dt: number): boolean {
    if (!this.cerca(p, this.suelo, 80) || this.abierto > 0) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (!p.bajoTierra) return this.g.aviso("Excava primero (habilidad) y mantén E bajo el suelo blando.", "info", id), true;
    if (this.bloqueado(id)) return true;
    this.empezar();
    this.cavar += dt / 3.5;
    this.o(this.suelo)!.v = this.cavar;
    if (this.cavar >= 1) {
      this.cavar = 0;
      this.abierto = 18;
      const s = this.o(this.suelo)!;
      const clave = "reto-" + this.slot + ":" + Math.floor(this.g.time);
      this.extremos = [this.g.addProp("tunel", s.x, s.y, { t: 18, dueno: clave }), this.g.addProp("tunel", this.interior.x - 20, this.interior.y + 30, { t: 18, dueno: clave })];
      this.g.aviso(this.g.k > 1 ? "¡Ruta abierta 18 s! Tú o un aliado: entrad por el agujero y tirad de la palanca (E)." : "¡Ruta abierta 18 s! Sal de la tierra, entra por el agujero y tira de la palanca (E).", "exito");
      this.g.sectores.paso(this, id);
    }
    return true;
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.palanca, 80)) return false;
    if (this.bloqueado(id)) return true;
    this.resolver();
    return true;
  }
}

// ================================================================== S · Sector I: Lector de seguridad
export class T1S extends RetoBase {
  private lector = "";
  private avance = 0;
  private guardias: string[] = [];

  protected override montar(): void {
    this.lector = this.obj("lector", this.pos(0.7, 0.5).x, this.pos(0.7, 0.5).y, { v: 0, txt: "Lector de seguridad" });
    for (const fy of [0.25, 0.75]) this.traer(fy);
  }

  private traer(fy: number): void {
    const ruta = [this.pos(0.15, fy), this.pos(0.45, fy)];
    this.guardias.push(this.unidad("fusilero", ruta[0].x, ruta[0].y, { etiqueta: "Guardia del lector", ruta }));
  }

  override onUnidadMuere(uid: string): void {
    const i = this.guardias.indexOf(uid);
    if (i < 0 || this.resuelto) return;
    this.guardias.splice(i, 1);
    if (this.guardias.length < 2) this.despues(6, () => !this.resuelto && this.traer(Math.random() < 0.5 ? 0.25 : 0.75));
  }

  override onAsimilar(_id: string, uid: string): void {
    const b = this.g.brains.get(uid);
    // En este reto el huésped se conserva poseído con su arma.
    if (b) b.mantener = true;
    this.empezar();
    const i = this.guardias.indexOf(uid);
    if (i >= 0) this.guardias.splice(i, 1);
  }

  protected override update(dt: number): void {
    const l = this.o(this.lector)!;
    let sobre = false;
    this.g.state.unidades.forEach((u) => {
      if (u.team === "aliens" && u.poseido === "S" && u.t !== "cria" && dist(u.x, u.y, l.x, l.y) < 50) sobre = true;
    });
    if (sobre) this.avance += dt / 5;
    else this.avance = Math.max(0, this.avance - dt / 8);
    l.v = this.avance;
    l.st = sobre ? "on" : "";
    this.progreso(this.avance);
    if (this.avance >= 1) this.resolver();
  }
}

// ================================================================== S · Sector II: Estaciones biométricas
export class T2S extends RetoBase {
  private estaciones: string[] = [];
  private nodo = "";
  private guardias: string[] = [];

  protected override montar(): void {
    for (const fx of [0.25, 0.75]) this.estaciones.push(this.obj("biometrica", this.pos(fx, 0.25).x, this.pos(fx, 0.25).y, { txt: "Estación biométrica" }));
    const n = this.pos(0.5, 0.75);
    this.nodo = this.unidad("nodo", n.x, n.y, { etiqueta: "Nodo secundario", fijo: true });
    for (const fy of [0.45, 0.6]) this.traer(fy);
  }

  private traer(fy: number): void {
    const ruta = [this.pos(0.1, fy), this.pos(0.9, fy)];
    this.guardias.push(this.unidad("fusilero", ruta[0].x, ruta[0].y, { ruta }));
  }

  override onUnidadMuere(uid: string): void {
    const i = this.guardias.indexOf(uid);
    if (i < 0 || this.resuelto) return;
    this.guardias.splice(i, 1);
    if (this.guardias.length < 2) this.despues(6, () => !this.resuelto && this.traer(0.5));
  }

  override onAsimilar(_id: string, uid: string): void {
    const i = this.guardias.indexOf(uid);
    if (i >= 0) {
      this.guardias.splice(i, 1);
      this.empezar();
    }
  }

  protected override update(): void {
    let ocupadas = 0;
    for (const e of this.estaciones) {
      const o = this.o(e)!;
      let s = false;
      this.g.state.unidades.forEach((u) => {
        if (u.team === "aliens" && (u.poseido === "S" || u.t === "cria") && dist(u.x, u.y, o.x, o.y) < 55) s = true;
      });
      o.st = s ? "on" : "";
      if (s) ocupadas++;
    }
    const n = this.g.state.unidades.get(this.nodo);
    if (!n) return;
    if (ocupadas < 2) n.infeccion = Math.max(0, n.infeccion - 0.004);
    this.progreso(ocupadas / 4 + n.infeccion / 2);
    this.texto(`Estaciones ocupadas ${ocupadas}/2 · nodo infectado ${Math.round(n.infeccion * 100)}%${ocupadas < 2 ? " (con las dos ocupadas, dispara fragmentos al nodo)" : ""}.`);
    if (ocupadas >= 2 && n.infeccion >= 1) this.resolver();
  }
}

// ================================================================== S · Sector III: Seguros de la compuerta
export class T3S extends RetoBase {
  private seguros: string[] = [];
  private estab = [0, 0, 0];
  private guardias: string[] = [];
  private arco = 0;

  protected override montar(): void {
    [[0.15, 0.3], [0.5, 0.15], [0.85, 0.3]].forEach(([fx, fy], i) => this.seguros.push(this.obj("seguro", this.pos(fx, fy).x, this.pos(fx, fy).y, { v: 0, txt: `Seguro ${i + 1}` })));
    for (const fx of [0.3, 0.7]) this.traer(fx);
  }

  private traer(fx: number): void {
    const p = this.pos(fx, 0.8);
    this.guardias.push(this.unidad("fusilero", p.x, p.y, { ruta: [p, this.pos(fx, 0.55)] }));
  }

  override onUnidadMuere(uid: string): void {
    const i = this.guardias.indexOf(uid);
    if (i < 0 || this.resuelto) return;
    this.guardias.splice(i, 1);
    this.despues(7, () => !this.resuelto && this.traer(Math.random() < 0.5 ? 0.3 : 0.7));
  }

  override onAsimilar(): void {
    this.empezar();
  }

  protected override update(dt: number): void {
    this.arco -= dt;
    let hechos = 0;
    this.seguros.forEach((sid, i) => {
      const o = this.o(sid)!;
      if (this.estab[i] >= 1) {
        hechos++;
        o.st = "ok";
        return;
      }
      let huesped: [string, Unit] | null = null;
      this.g.state.unidades.forEach((u, uid) => {
        if (u.team === "aliens" && (u.poseido === "S" || u.t === "cria") && dist(u.x, u.y, o.x, o.y) < 60) huesped = [uid, u];
      });
      if (huesped) {
        const [hid, h] = huesped as [string, Unit];
        this.estab[i] += dt / 8;
        o.st = "on";
        // Los arcos eléctricos hieren al huésped que sujeta el seguro.
        if (this.arco <= 0) {
          this.g.fx("chispa", o.x, o.y);
          this.g.danarAliado(hid, h, 2.5);
        }
      } else o.st = "";
      o.v = this.estab[i];
    });
    if (this.arco <= 0) this.arco = 1.2;
    this.progreso(hechos / 3);
    if (hechos >= 3) this.resolver();
  }

  /** E junto a un seguro: sacrificar un huésped para estabilizarlo al instante. */
  override interact(id: string, p: Player): boolean {
    const i = this.seguros.findIndex((s) => this.cerca(p, s, 110));
    if (i < 0) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (this.estab[i] >= 1) return true;
    const o = this.o(this.seguros[i])!;
    const h = this.g.unitNear(o.x, o.y, 200, (u) => u.dueno === id && u.team === "aliens" && (u.poseido === "S" || u.t === "cria"));
    if (!h) return this.g.aviso("Envía un huésped al seguro o tráelo cerca para sacrificarlo (E).", "info", id), true;
    this.empezar();
    this.g.fx("fusion", h[1].x, h[1].y, { x2: o.x, y2: o.y });
    this.g.removeUnit(h[0]);
    this.estab[i] = 1;
    this.g.aviso("Sacrificas un huésped: el seguro queda estable.", "exito", id);
    this.g.sectores.paso(this, id);
    return true;
  }
}
