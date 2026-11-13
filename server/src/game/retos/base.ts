// Base de todos los retos del mundo. Un reto vive en una sala ("slot") y coloca sus propios
// objetos interactivos (PzObj), bloqueos de paso y NPC dentro de la zona de esa sala.
// El servidor valida todo: el cliente solo dibuja y envía intenciones.
import { ALIENS, CARGA_ULTI, ESCALA_EQUIPO, RETO_LOCK, TILE, dist, retoDef, type AlienKind, type MinigameMsg, type RetoDef, type UnitType } from "@dawg/shared";
import { Bloqueo, PzObj, Reto as RetoS, type Player, type Unit } from "../../schema/GameState";
import type { Partida } from "../Partida";

export interface Zona {
  x: number;
  y: number;
  w: number;
  h: number;
  z2?: { x: number; y: number; w: number; h: number };
}

export abstract class RetoBase {
  readonly st: RetoS;
  readonly def: RetoDef;
  inicio = -1;
  protected objs = new Set<string>();
  protected bloqs = new Set<string>();
  protected units = new Set<string>();
  protected esperas: { t: number; fn: () => void }[] = [];
  /** Aviso "bloqueado" una vez por pulsación. */
  private ultimoAvisoBloqueo = -99;

  constructor(
    readonly g: Partida,
    readonly id: string,
    readonly slot: string,
    readonly zona: Zona,
  ) {
    this.def = retoDef(id)!;
    this.st = new RetoS();
    this.st.def = id;
    this.st.slot = slot;
    this.st.estado = "inactivo";
    g.state.retos.set(slot, this.st);
  }

  // ---------------------------------------------------------------- ciclo de vida
  /** Se llama al empezar su sector. */
  abrir(): void {
    if (this.st.estado !== "inactivo") return;
    this.st.estado = "libre";
    this.texto(this.def.instrucciones);
    this.montar();
  }

  protected abstract montar(): void;
  /** Vuelve al estado inicial tras un fallo (objetos a su sitio). */
  protected reiniciar(): void {}

  tick(dt: number): void {
    if (this.esperas.length) {
      for (const e of this.esperas) e.t -= dt;
      const listas = this.esperas.filter((e) => e.t <= 0);
      this.esperas = this.esperas.filter((e) => e.t > 0);
      for (const e of listas) e.fn();
    }
    if (this.st.estado === "bloqueado") {
      this.st.tiempo -= dt;
      if (this.st.tiempo <= 0) {
        this.st.estado = this.inicio >= 0 ? "activo" : "libre";
        this.st.tiempo = 0;
        this.g.aviso(`«${this.def.nombre}» vuelve a estar disponible.`, "info");
      }
      return;
    }
    if (this.st.estado === "libre" || this.st.estado === "activo") this.update(dt);
  }

  protected update(_dt: number): void {}

  get resuelto(): boolean {
    return this.st.estado === "resuelto";
  }

  get disponible(): boolean {
    return this.st.estado === "libre" || this.st.estado === "activo";
  }

  // ---------------------------------------------------------------- ganchos (devuelven true si lo usaron)
  interact(_id: string, _p: Player): boolean {
    return false;
  }
  mantener(_id: string, _p: Player, _dt: number): boolean {
    return false;
  }
  habilidad(_id: string, _p: Player, _x: number, _y: number): boolean {
    return false;
  }
  chorro(_id: string, _p: Player, _dt: number): void {}
  mensaje(_id: string, _msg: MinigameMsg): void {}
  onUnidadMuere(_uid: string, _u: Unit, _owner: string): void {}
  onEscaneo(_id: string, _p: Player, _u: Unit): void {}
  onTeleport(_id: string, _p: Player, _uid: string): void {}
  onAsimilar(_id: string, _uid: string, _u: Unit): void {}
  onPlayerDown(_id: string): void {}

  /** ¿Está el jugador cerca de este reto (para dar prioridad a sus ganchos)? */
  cercaDe(x: number, y: number, margen = 200): boolean {
    const z = this.zona;
    const sala = this.g.world.roomAt(z.x + z.w / 2, z.y + z.h / 2);
    const r = sala ?? z;
    return x >= r.x - margen && y >= r.y - margen && x <= r.x + r.w + margen && y <= r.y + r.h + margen;
  }

  // ---------------------------------------------------------------- estado
  /** Primera acción real: empiezan las oleadas del Director. */
  empezar(): void {
    if (this.st.estado !== "libre") return;
    this.st.estado = "activo";
    this.inicio = this.g.time;
    this.g.director.onRetoStart(this.slot);
    this.g.sectores.onRetoEmpieza(this);
  }

  resolver(): void {
    if (this.resuelto) return;
    this.empezar();
    for (const pid of this.st.actores.split(",")) {
      const p = this.g.state.jugadores.get(pid);
      if (p && p.ocupado === this.slot) p.ocupado = "";
    }
    this.st.estado = "resuelto";
    this.st.progreso = 1;
    this.st.tiempo = 0;
    this.st.actores = "";
    this.st.texto = "Resuelto ✔";
    this.g.director.onRetoEnd(this.slot);
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo) p.ulti = Math.min(1, p.ulti + CARGA_ULTI.porReto);
    });
    this.g.fx("rescate", this.zona.x + this.zona.w / 2, this.zona.y + this.zona.h / 2, { c: 0x7dff6a, r: 160 });
    this.g.aviso(`✔ «${this.def.nombre}» resuelto.`, "exito");
    this.alResolver();
    this.g.mejoras.otorgar(`«${this.def.nombre}»`, 100 * ESCALA_EQUIPO.tiempoReto[this.g.k]);
    this.g.sectores.onRetoResuelto(this);
  }

  /** Deja el reto resuelto sin efectos (reintento desde un punto de control posterior). */
  marcarResuelto(): void {
    this.st.estado = "resuelto";
    this.st.progreso = 1;
    this.st.texto = "Resuelto ✔";
    this.limpiar();
  }

  protected alResolver(): void {
    this.limpiar();
  }

  fallar(razon: string, lock = RETO_LOCK): void {
    if (this.st.estado !== "activo" && this.st.estado !== "libre") return;
    for (const pid of this.st.actores.split(",")) {
      const p = this.g.state.jugadores.get(pid);
      if (p && p.ocupado === this.slot) p.ocupado = "";
    }
    this.st.actores = "";
    this.st.estado = "bloqueado";
    this.st.tiempo = lock;
    this.st.total = lock;
    this.g.aviso(`✖ «${this.def.nombre}»: ${razon} Llegan refuerzos y se bloquea ${Math.round(lock)} s.`, "peligro");
    this.g.director.onRetoFail(this.slot);
    this.g.sectores.onRetoFalla(this);
    this.reiniciar();
  }

  // ---------------------------------------------------------------- utilidades
  /** ¿Puede este jugador hacer este reto (por forma)? */
  puede(p: Player): boolean {
    return p.vivo && !p.fantasma && (this.def.requiere.length === 0 || this.def.requiere.includes(p.forma as AlienKind));
  }

  /** Aviso amable cuando no es el alien correcto. */
  noPuede(id: string): void {
    const nombres = this.def.requiere.map((k) => ALIENS[k].nombre).join(" o ");
    this.g.aviso(`Esto lo hace ${nombres} (o quien lleve su alma y se transforme con Q).`, "info", id);
  }

  /** ¿Bloqueado por un fallo o por una complicación? Avisa y devuelve true. */
  protected bloqueado(id: string): boolean {
    if (this.st.estado === "bloqueado") {
      if (this.g.time - this.ultimoAvisoBloqueo > 1.5) {
        this.ultimoAvisoBloqueo = this.g.time;
        this.g.aviso(`Bloqueado: ${Math.ceil(this.st.tiempo)} s.`, "info", id);
      }
      return true;
    }
    const motivo = this.g.sectores.bloqueoComplicacion(this, id);
    if (motivo) {
      if (this.g.time - this.ultimoAvisoBloqueo > 1.5) {
        this.ultimoAvisoBloqueo = this.g.time;
        this.g.aviso(motivo, "peligro", id);
      }
      return true;
    }
    return false;
  }

  /** Error dentro del reto (orden equivocado, pieza incorrecta…): las complicaciones pueden castigarlo. */
  protected error(id: string, texto: string): void {
    this.g.aviso(texto, "peligro", id);
    this.g.sectores.onRetoError(this, id);
  }

  pos(fx: number, fy: number): { x: number; y: number } {
    return { x: Math.round(this.zona.x + this.zona.w * fx), y: Math.round(this.zona.y + this.zona.h * fy) };
  }

  /** Centro de la casilla que contiene la fracción indicada. */
  casilla(fx: number, fy: number): { tx: number; ty: number; x: number; y: number } {
    const p = this.pos(fx, fy);
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    return { tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
  }

  obj(k: string, x: number, y: number, o: Partial<Pick<PzObj, "st" | "v" | "txt" | "c" | "ang" | "f" | "r">> = {}): string {
    const ob = new PzObj();
    ob.k = k;
    ob.x = Math.round(x);
    ob.y = Math.round(y);
    ob.st = o.st ?? "";
    ob.v = o.v ?? -1;
    ob.txt = o.txt ?? "";
    ob.c = o.c ?? 0;
    ob.ang = o.ang ?? 0;
    ob.f = o.f ?? 0;
    ob.r = o.r ?? 0;
    ob.reto = this.slot;
    const id = this.g.id("pz");
    this.g.state.pz.set(id, ob);
    this.objs.add(id);
    return id;
  }

  o(id: string): PzObj | undefined {
    return this.g.state.pz.get(id);
  }

  quitarObj(id: string): void {
    this.g.state.pz.delete(id);
    this.objs.delete(id);
  }

  /** Bloqueo de paso rectangular en casillas. */
  bloqueo(k: string, tx: number, ty: number, tw: number, th: number, mask: number): string {
    const b = new Bloqueo();
    b.k = k;
    b.x = tx;
    b.y = ty;
    b.w = tw;
    b.h = th;
    b.m = mask;
    const id = this.g.id("bq");
    this.g.state.bloqueos.set(id, b);
    this.g.world.addDyn(tx, ty, tw, th, mask, 1);
    this.bloqs.add(id);
    // Nadie se queda atrapado dentro.
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo && this.g.world.blocksMoveAt(p.x, p.y, p.bajoTierra ? 2 : 1)) {
        const pos = this.g.lugarLibre(p.x, p.y, p.x, p.y);
        p.x = pos.x;
        p.y = pos.y;
      }
    });
    return id;
  }

  quitarBloqueo(id: string): void {
    const b = this.g.state.bloqueos.get(id);
    if (!b) return;
    this.g.world.addDyn(b.x, b.y, b.w, b.h, b.m, -1);
    this.g.state.bloqueos.delete(id);
    this.bloqs.delete(id);
  }

  /** Anillo cerrado de bloqueos alrededor de un interior (en casillas). hueco: lado y casillas libres. */
  anillo(k: string, tx: number, ty: number, iw: number, ih: number, grosor: number, mask: number, hueco?: { lado: "n" | "s" | "e" | "o"; desde: number; ancho: number }): { ids: string[]; hueco?: { tx: number; ty: number; tw: number; th: number } } {
    const ids: string[] = [];
    const x0 = tx - grosor;
    const y0 = ty - grosor;
    const W = iw + grosor * 2;
    const H = ih + grosor * 2;
    const lado = (l: "n" | "s" | "e" | "o", rx: number, ry: number, rw: number, rh: number) => {
      if (!hueco || hueco.lado !== l) {
        ids.push(this.bloqueo(k, rx, ry, rw, rh, mask));
        return undefined;
      }
      const horizontal = l === "n" || l === "s";
      const a = hueco.desde;
      const b = hueco.desde + hueco.ancho;
      if (horizontal) {
        if (a > 0) ids.push(this.bloqueo(k, rx, ry, a + grosor, rh, mask));
        if (rw - b - grosor > 0) ids.push(this.bloqueo(k, rx + b + grosor, ry, rw - b - grosor, rh, mask));
        return { tx: rx + grosor + a, ty: ry, tw: hueco.ancho, th: rh };
      }
      if (a > 0) ids.push(this.bloqueo(k, rx, ry, rw, a + grosor, mask));
      if (rh - b - grosor > 0) ids.push(this.bloqueo(k, rx, ry + b + grosor, rw, rh - b - grosor, mask));
      return { tx: rx, ty: ry + grosor + a, tw: rw, th: hueco.ancho };
    };
    const h1 = lado("n", x0, y0, W, grosor);
    const h2 = lado("s", x0, y0 + H - grosor, W, grosor);
    const h3 = lado("o", x0, y0 + grosor, grosor, ih);
    const h4 = lado("e", x0 + W - grosor, y0 + grosor, grosor, ih);
    // Los lados laterales no incluyen esquinas: ajustar el hueco vertical.
    const h = h1 ?? h2 ?? (h3 ? { ...h3, ty: h3.ty - grosor } : undefined) ?? (h4 ? { ...h4, ty: h4.ty - grosor } : undefined);
    return { ids, hueco: h };
  }

  /** NPC o guardia propio del reto (se repone si muere). */
  unidad(t: UnitType, x: number, y: number, o: { etiqueta?: string; ruta?: { x: number; y: number }[]; fijo?: boolean; team?: "humanos" | "aliens" } = {}): string {
    const uid = this.g.spawnUnit(t, x, y, o.team ?? "humanos", "reto-" + this.slot);
    const u = this.g.state.unidades.get(uid)!;
    u.etiqueta = o.etiqueta ?? "";
    const b = this.g.brains.get(uid)!;
    if (o.ruta) b.ruta = o.ruta;
    if (o.fijo) b.fijo = true;
    this.units.add(uid);
    return uid;
  }

  despues(t: number, fn: () => void): void {
    this.esperas.push({ t, fn });
  }

  texto(s: string): void {
    this.st.texto = s;
  }

  progreso(v: number): void {
    this.st.progreso = Math.max(0, Math.min(1, v));
  }

  /** Quita barriles y cajas que estorben a los objetos del reto. */
  despejar(x: number, y: number, r: number): void {
    const quitar: string[] = [];
    this.g.state.objetos.forEach((o, oid) => {
      if ((o.k === "barril" || o.k === "caja") && dist(o.x, o.y, x, y) < r) quitar.push(oid);
    });
    for (const id of quitar) this.g.state.objetos.delete(id);
  }

  cerca(p: { x: number; y: number }, objId: string, r = 90): boolean {
    const o = this.o(objId);
    return Boolean(o && dist(p.x, p.y, o.x, o.y) <= r);
  }

  limpiar(): void {
    for (const id of [...this.objs]) this.quitarObj(id);
    for (const id of [...this.bloqs]) this.quitarBloqueo(id);
    for (const uid of [...this.units]) {
      const u = this.g.state.unidades.get(uid);
      if (u && u.team === "humanos") this.g.removeUnit(uid);
      this.units.delete(uid);
    }
  }

  /** Alias de solo lectura para subclases. */
  protected get jugadores() {
    return this.g.state.jugadores;
  }
}

export type CtorReto = new (g: Partida, id: string, slot: string, zona: Zona) => RetoBase;
