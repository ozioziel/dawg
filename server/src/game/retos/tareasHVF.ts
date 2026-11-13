// Tareas de Curandera (H), Vesper (V) y Freeze (F) en los tres sectores.
import { DYN_TODOS, HAB, TILE, angleDiff, dist } from "@dawg/shared";
import type { Player } from "../../schema/GameState";
import { RetoBase } from "./base";

const azar = (n: number) => Math.floor(Math.random() * n);

// ================================================================== H · Sector I: Raíces de nutrición
export class T1H extends RetoBase {
  private barrera = "";
  private nodos: string[] = [];
  private raiz: { pid: string; puntos: { x: number; y: number }[]; objs: string[] } | null = null;
  private conectados = 0;

  protected override montar(): void {
    const c = this.pos(0.5, 0.5);
    this.despejar(c.x, c.y, 420);
    this.barrera = this.obj("barrera_bio", c.x, c.y, { txt: "Barrera biológica (E)", v: 0 });
    for (const [fx, fy] of [[0.1, 0.15], [0.9, 0.2], [0.5, 0.92]]) this.nodos.push(this.obj("nodo_nutricion", this.pos(fx, fy).x, this.pos(fx, fy).y, { txt: "Nodo de nutrición" }));
  }

  private cortar(motivo: string): void {
    if (!this.raiz) return;
    for (const o of this.raiz.objs) this.quitarObj(o);
    this.g.aviso(motivo, "peligro", this.raiz.pid);
    this.raiz = null;
  }

  protected override update(): void {
    if (!this.raiz) return;
    const p = this.jugadores.get(this.raiz.pid);
    if (!p || !p.vivo || p.forma !== "curandera") return this.cortar("La raíz se secó.");
    if (p.estado !== "ok") return this.cortar("¡Te aturdieron y la raíz se rompió! Vuelve a la barrera (E).");
    const ult = this.raiz.puntos[this.raiz.puntos.length - 1];
    if (dist(ult.x, ult.y, p.x, p.y) > 46) {
      this.raiz.puntos.push({ x: p.x, y: p.y });
      this.raiz.objs.push(this.obj("raiz", p.x, p.y, { ang: Math.atan2(p.y - ult.y, p.x - ult.x), r: Math.round(dist(ult.x, ult.y, p.x, p.y)) }));
      if (this.raiz.puntos.length > 60) this.cortar("La raíz no da para tanto: vuelve a la barrera y busca un camino más corto.");
    }
  }

  override interact(id: string, p: Player): boolean {
    if (this.cerca(p, this.barrera)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.bloqueado(id)) return true;
      this.empezar();
      if (this.raiz) this.cortar("Empiezas una raíz nueva.");
      const b = this.o(this.barrera)!;
      this.raiz = { pid: id, puntos: [{ x: b.x, y: b.y }], objs: [] };
      this.g.aviso("La raíz te sigue: llévala hasta un nodo de nutrición y pulsa E. Si te aturden, se rompe.", "info", id);
      return true;
    }
    const nodo = this.nodos.find((n) => this.cerca(p, n));
    if (!nodo) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    const o = this.o(nodo)!;
    if (o.st === "ok") return this.g.aviso("Ese nodo ya está conectado.", "info", id), true;
    if (!this.raiz || this.raiz.pid !== id) return this.g.aviso("Trae una raíz desde la barrera biológica (E en la barrera).", "info", id), true;
    o.st = "ok";
    for (const r of this.raiz.objs) this.o(r) && (this.o(r)!.st = "ok");
    this.raiz = null;
    this.conectados++;
    this.o(this.barrera)!.v = this.conectados / 3;
    this.progreso(this.conectados / 3);
    this.g.fx("curar", o.x, o.y);
    this.g.sectores.paso(this, id);
    if (this.conectados >= 3) this.resolver();
    else this.g.aviso(`Nodo conectado (${this.conectados}/3).`, "exito", id);
    return true;
  }
}

// ================================================================== H · Sector II: Síntesis de enzima
const MUESTRAS = ["Roja", "Azul", "Verde", "Ámbar"];
export class T2H extends RetoBase {
  private sintetizador = "";
  private muestras: string[] = [];
  private receta: number[] = [];
  private dentro: number[] = [];
  private catalizador = false;
  private lleva = new Map<string, number>();

  protected override montar(): void {
    const c = this.pos(0.5, 0.45);
    this.despejar(c.x, c.y, 420);
    this.receta = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
    this.sintetizador = this.obj("sintetizador", c.x, c.y, { txt: `Pide: ${this.receta.map((r) => MUESTRAS[r]).join(" + ")} + catalizador` });
    [[0.1, 0.15], [0.9, 0.15], [0.1, 0.88], [0.9, 0.88]].forEach(([fx, fy], i) => this.muestras.push(this.obj("muestra", this.pos(fx, fy).x, this.pos(fx, fy).y, { f: i, txt: MUESTRAS[i] })));
  }

  protected override reiniciar(): void {
    this.dentro = [];
    this.catalizador = false;
    this.lleva.clear();
    this.muestras.forEach((m) => this.o(m) && (this.o(m)!.st = ""));
    this.o(this.sintetizador)!.v = 0;
  }

  override interact(id: string, p: Player): boolean {
    const m = this.muestras.find((mm) => this.cerca(p, mm, 70) && this.o(mm)!.st === "");
    if (m) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.lleva.has(id)) return this.g.aviso("Ya llevas una muestra: déjala en el sintetizador.", "info", id), true;
      this.empezar();
      this.lleva.set(id, this.o(m)!.f);
      this.o(m)!.st = "llevada";
      this.g.aviso(`Llevas la muestra ${MUESTRAS[this.o(m)!.f]}.`, "info", id);
      return true;
    }
    if (this.cerca(p, this.sintetizador)) {
      if (!this.puede(p)) return this.noPuede(id), true;
      if (this.bloqueado(id)) return true;
      const f = this.lleva.get(id);
      if (f === undefined) return this.g.aviso(`El sintetizador pide ${this.receta.map((r) => MUESTRAS[r]).join(" + ")} y un catalizador orgánico (digiere a un guardia junto a él).`, "info", id), true;
      this.lleva.delete(id);
      if (!this.receta.includes(f) || this.dentro.includes(f)) {
        this.error(id, `¡${MUESTRAS[f]} no va en esta enzima! Reacción tóxica.`);
        this.g.addZone("gas", p.x, p.y, 80, 3);
        this.reiniciar();
        return true;
      }
      this.dentro.push(f);
      this.avance();
      return true;
    }
    return false;
  }

  /** Digerir junto al sintetizador = catalizador (en vez de curar). */
  override habilidad(id: string, p: Player): boolean {
    if (!p.cautivo || !this.cerca(p, this.sintetizador, 140)) return false;
    if (!this.puede(p)) return false;
    if (this.bloqueado(id)) return true;
    this.empezar();
    p.cautivo = "";
    this.catalizador = true;
    this.g.fx("devorar", p.x, p.y, { x2: this.o(this.sintetizador)!.x, y2: this.o(this.sintetizador)!.y });
    this.g.aviso("Catalizador orgánico añadido.", "exito", id);
    p.enfriamiento = p.enfMax = 1;
    this.avance();
    return true;
  }

  private avance(): void {
    const n = this.dentro.length + (this.catalizador ? 1 : 0);
    this.o(this.sintetizador)!.v = n / 3;
    this.progreso(n / 3);
    if (n >= 3) this.resolver();
  }

  protected override update(): void {
    for (const [pid, f] of this.lleva) {
      const p = this.jugadores.get(pid);
      if (!p || !p.vivo) {
        this.lleva.delete(pid);
        const m = this.muestras.find((mm) => this.o(mm)!.f === f);
        if (m) this.o(m)!.st = "";
      }
    }
  }
}

// ================================================================== H · Sector III: Bomba de drenaje
export class T3H extends RetoBase {
  private rejillas: string[] = [];
  private bomba = "";
  private tramo = 0;
  private crecer = 0;
  private plagaT = 6;
  private nutridoT = -99;

  protected override montar(): void {
    [[0.1, 0.5], [0.35, 0.2], [0.65, 0.8], [0.9, 0.5]].forEach(([fx, fy], i) => {
      const p = this.pos(fx, fy);
      if (i < 3) this.rejillas.push(this.obj("rejilla", p.x, p.y, { v: 0, txt: `Rejilla ${i + 1}` }));
      else this.bomba = this.obj("bomba", p.x, p.y, { txt: "Bomba de emergencia" });
    });
    this.texto("Siembra raíces en la Rejilla 1 y nútrelas (mantén E) hasta la bomba.");
  }

  protected override update(dt: number): void {
    if (this.inicio < 0) return;
    // Plagas que muerden las raíces
    this.plagaT -= dt;
    if (this.plagaT <= 0) {
      this.plagaT = 14;
      const r = this.o(this.rejillas[Math.min(this.tramo, 2)]);
      if (r) this.g.director.spawnNear(["perro", "fusilero"], r.x, r.y, "reto-" + this.slot);
    }
    // Sin nutrir, el tramo actual se marchita despacio.
    const o = this.o(this.rejillas[this.tramo]);
    if (o && this.crecer > 0 && this.g.time - this.nutridoT > 0.3) {
      this.crecer = Math.max(0, this.crecer - dt * 0.03 * this.g.sectores.factorAlarma());
      o.v = this.crecer;
    }
  }

  override mantener(id: string, p: Player, dt: number): boolean {
    const r = this.rejillas[this.tramo];
    if (!r || !this.cerca(p, r, 100)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    this.empezar();
    this.nutridoT = this.g.time;
    this.crecer += dt / 5;
    this.o(r)!.v = Math.min(1, this.crecer);
    this.o(r)!.st = "raiz";
    this.progreso((this.tramo + this.crecer) / 3);
    if (this.crecer >= 1) {
      this.o(r)!.st = "ok";
      this.crecer = 0;
      this.tramo++;
      const sig = this.rejillas[this.tramo] ?? this.bomba;
      const s = this.o(sig)!;
      this.obj("raiz", (this.o(r)!.x + s.x) / 2, (this.o(r)!.y + s.y) / 2, { ang: Math.atan2(s.y - this.o(r)!.y, s.x - this.o(r)!.x), r: Math.round(dist(s.x, s.y, this.o(r)!.x, this.o(r)!.y)), st: "ok" });
      this.g.sectores.paso(this, id);
      if (this.tramo >= 3) {
        this.o(this.bomba)!.st = "ok";
        this.resolver();
      } else this.g.aviso(`Las raíces avanzan: nutre la Rejilla ${this.tramo + 1}.`, "exito", id);
    }
    return true;
  }
}

// ================================================================== V · Sector I: Anclas de sombra
export class T1V extends RetoBase {
  private terminal = "";
  private anclas: string[] = [];
  private plataformas: { tx: number; ty: number }[] = [];
  private pasarela = "";

  protected override montar(): void {
    const z = this.zona;
    const tx0 = Math.floor((z.x + z.w * 0.3) / TILE);
    const ty0 = Math.floor((z.y + z.h * 0.2) / TILE);
    const tw = Math.max(9, Math.floor((z.w * 0.62) / TILE));
    const th = Math.max(6, Math.floor((z.h * 0.6) / TILE));
    this.despejar((tx0 + tw / 2) * TILE, (ty0 + th / 2) * TILE, 500);
    // Foso con dos plataformas: P1 (con un centinela) y P2 (centinela + terminal).
    const p1 = { tx: tx0 + 2, ty: ty0 + Math.floor(th / 2) - 1 };
    const p2 = { tx: tx0 + tw - 4, ty: ty0 + Math.floor(th / 2) - 1 };
    this.plataformas = [p1, p2];
    const dentro = (x: number, y: number) => this.plataformas.some((p) => x >= p.tx && x < p.tx + 3 && y >= p.ty && y < p.ty + 3);
    for (let y = ty0; y < ty0 + th; y++) {
      let ini = -1;
      for (let x = tx0; x <= tx0 + tw; x++) {
        const foso = x < tx0 + tw && !dentro(x, y);
        if (foso && ini < 0) ini = x;
        if (!foso && ini >= 0) {
          this.bloqueo("abismo", ini, y, x - ini, 1, DYN_TODOS);
          ini = -1;
        }
      }
    }
    this.terminal = this.obj("terminal_v", (p2.tx + 2.3) * TILE, (p2.ty + 1.5) * TILE, { txt: "Terminal aislado (E)" });
    this.pasarela = this.obj("plataforma", (p1.tx + 1.5) * TILE, (p1.ty + 1.5) * TILE, { r: 3 * TILE });
    this.obj("plataforma", (p2.tx + 1.5) * TILE, (p2.ty + 1.5) * TILE, { r: 3 * TILE });
    this.anclas.push(this.ancla(p1));
    this.anclas.push(this.ancla(p2));
    this.texto("Salta detrás del centinela de la primera plataforma (habilidad) y luego al de la segunda; pulsa E en el terminal.");
  }

  private ancla(p: { tx: number; ty: number }): string {
    const uid = this.unidad("fusilero", (p.tx + 1) * TILE + 20, (p.ty + 1.5) * TILE, { etiqueta: "Centinela (ancla)", fijo: true });
    const u = this.g.state.unidades.get(uid)!;
    u.ang = Math.PI; // mira hacia el oeste: su espalda da a la plataforma
    return uid;
  }

  override onUnidadMuere(uid: string): void {
    const i = this.anclas.indexOf(uid);
    if (i < 0 || this.resuelto) return;
    this.g.aviso("Cayó un centinela-ancla: otro ocupa su puesto en unos segundos.", "info");
    this.despues(7, () => {
      if (!this.resuelto) this.anclas[i] = this.ancla(this.plataformas[i]);
    });
  }

  override onTeleport(id: string, p: Player, uid: string): void {
    if (this.anclas.includes(uid)) {
      this.empezar();
      if (this.puede(p)) this.g.sectores.paso(this, id);
    }
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.terminal, 90)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    this.resolver();
    return true;
  }

  protected override alResolver(): void {
    // Al resolver se tiende una pasarela de vuelta: se quita el foso.
    this.limpiar();
    void this.pasarela;
  }
}

// ================================================================== V · Sector II: Corredor de focos
export class T2V extends RetoBase {
  private focos: string[] = [];
  private control = "";
  private inicioPos = { x: 0, y: 0 };
  private patrullas: string[] = [];
  private pillado = 0;

  protected override montar(): void {
    this.inicioPos = this.pos(0.06, 0.5);
    this.obj("marca_inicio", this.inicioPos.x, this.inicioPos.y, { txt: "Entrada del corredor" });
    this.control = this.obj("control_umbrio", this.pos(0.94, 0.5).x, this.pos(0.94, 0.5).y, { txt: "Control umbrío (E)" });
    [0.3, 0.55, 0.78].forEach((fx, i) => {
      const p = this.pos(fx, i % 2 ? 0.05 : 0.95);
      this.focos.push(this.obj("foco", p.x, p.y, { ang: i % 2 ? Math.PI / 2 : -Math.PI / 2, r: Math.round(this.zona.h * 0.95), v: 0.32 }));
    });
    for (const fy of [0.3, 0.7]) this.traerPatrulla(fy);
    this.texto("No pises la luz de los focos. Salta detrás de las patrullas (su sombra te cubre) y pulsa el control umbrío.");
  }

  private traerPatrulla(fy: number): void {
    const ruta = [this.pos(0.2, fy), this.pos(0.85, fy)];
    this.patrullas.push(this.unidad("fusilero", ruta[0].x, ruta[0].y, { etiqueta: "Patrulla", ruta }));
  }

  override onUnidadMuere(uid: string): void {
    const i = this.patrullas.indexOf(uid);
    if (i >= 0 && !this.resuelto) {
      this.patrullas.splice(i, 1);
      this.despues(5, () => !this.resuelto && this.traerPatrulla(Math.random() < 0.5 ? 0.3 : 0.7));
    }
  }

  protected override update(dt: number): void {
    const t = this.g.time;
    this.focos.forEach((f, i) => {
      const o = this.o(f)!;
      const base = o.y < this.zona.y + this.zona.h / 2 ? Math.PI / 2 : -Math.PI / 2;
      o.ang = base + Math.sin(t * (0.7 + i * 0.25) + i) * 0.9;
    });
    if (this.pillado > 0) this.pillado -= dt;
    this.jugadores.forEach((p, id) => {
      if (!p.vivo || p.bajoTierra || this.pillado > 0 || !this.puede(p)) return;
      if (p.x < this.zona.x || p.x > this.zona.x + this.zona.w || p.y < this.zona.y || p.y > this.zona.y + this.zona.h) return;
      // A la sombra de una patrulla no te ven.
      for (const uid of this.patrullas) {
        const u = this.g.state.unidades.get(uid);
        if (u && dist(u.x, u.y, p.x, p.y) < 70) return;
      }
      for (const f of this.focos) {
        const o = this.o(f)!;
        const d = dist(o.x, o.y, p.x, p.y);
        if (d < o.r && Math.abs(angleDiff(o.ang, Math.atan2(p.y - o.y, p.x - o.x))) < o.v) {
          this.pillado = 1.5;
          this.empezar();
          this.error(id, "¡Te pilló un foco! Vuelves a la entrada del corredor.");
          this.g.fx("teleport", p.x, p.y, { x2: this.inicioPos.x, y2: this.inicioPos.y, c: 0xffd23e });
          p.x = this.inicioPos.x;
          p.y = this.inicioPos.y;
          this.g.damagePlayer(id, p, 8);
          return;
        }
      }
    });
  }

  override onTeleport(id: string, p: Player, uid: string): void {
    if (this.patrullas.includes(uid)) this.empezar();
    void id;
    void p;
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.control, 90)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    this.resolver();
    return true;
  }
}

// ================================================================== V · Sector III: Cierres en cadena
export class T3V extends RetoBase {
  private cierres: string[] = [];
  private centinelas: string[] = [];
  private cuenta = 0;
  private hechos = 0;

  protected override montar(): void {
    [[0.06, 0.1], [0.94, 0.12], [0.94, 0.9], [0.06, 0.88]].forEach(([fx, fy], i) => {
      const p = this.pos(fx, fy);
      this.cierres.push(this.obj("cierre", p.x, p.y, { txt: `Cierre ${i + 1}`, f: i }));
      const c = this.pos(fx + (fx < 0.5 ? 0.12 : -0.12), fy + (fy < 0.5 ? 0.18 : -0.18));
      this.centinelas.push(this.unidad("fusilero", c.x, c.y, { etiqueta: "Centinela", fijo: true }));
    });
  }

  protected override reiniciar(): void {
    this.cuenta = 0;
    this.hechos = 0;
    for (const c of this.cierres) this.o(c)!.st = "";
  }

  override onUnidadMuere(uid: string): void {
    const i = this.centinelas.indexOf(uid);
    if (i < 0 || this.resuelto) return;
    this.despues(6, () => {
      if (this.resuelto) return;
      const o = this.o(this.cierres[i])!;
      this.centinelas[i] = this.unidad("fusilero", o.x + (o.x < this.zona.x + this.zona.w / 2 ? 90 : -90), o.y + (o.y < this.zona.y + this.zona.h / 2 ? 90 : -90), { etiqueta: "Centinela", fijo: true });
    });
  }

  protected override update(dt: number): void {
    if (this.cuenta <= 0) return;
    this.cuenta -= dt * this.g.sectores.factorAlarma();
    this.st.tiempo = this.cuenta;
    this.st.total = 24;
    if (this.cuenta <= 0) {
      this.g.aviso("¡Las alarmas reactivaron los cierres!", "peligro");
      this.reiniciar();
      this.g.director.onRetoFail(this.slot);
    }
  }

  override onTeleport(_id: string, p: Player, uid: string): void {
    if (this.centinelas.includes(uid) && this.puede(p)) this.empezar();
  }

  override interact(id: string, p: Player): boolean {
    const c = this.cierres.find((cc) => this.cerca(p, cc, 80));
    if (!c) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    const o = this.o(c)!;
    if (o.st === "ok") return true;
    this.empezar();
    if (this.cuenta <= 0) {
      this.cuenta = 24;
      this.g.aviso("¡Cuenta atrás! Acciona los otros cierres antes de que vuelva la alarma (salta detrás de los centinelas).", "peligro");
    }
    o.st = "ok";
    this.hechos++;
    // En este reto el paso sombrío se recarga muy rápido.
    p.enfriamiento = Math.min(p.enfriamiento, 1);
    this.progreso(this.hechos / 4);
    this.g.sectores.paso(this, id);
    if (this.hechos >= 4) this.resolver();
    return true;
  }
}

// ================================================================== F · Sector I: Tubería sobrecargada
export class T1F extends RetoBase {
  private tuberia = "";
  private marca = "";
  private valvula = "";
  private respiradero = "";
  private calor = 1;
  private desviado = false;
  private vapor = "";

  protected override montar(): void {
    this.tuberia = this.obj("tuberia_caliente", this.pos(0.25, 0.3).x, this.pos(0.25, 0.3).y, { v: 1, txt: "Tubería sobrecargada" });
    this.respiradero = this.obj("respiradero", this.pos(0.85, 0.75).x, this.pos(0.85, 0.75).y, { txt: "Fuga de vapor" });
    this.marca = this.obj("marca_muro", this.pos(0.55, 0.55).x, this.pos(0.55, 0.55).y, { txt: "Pon aquí un muro de hielo" });
    this.valvula = this.obj("valvula_f", this.pos(0.12, 0.75).x, this.pos(0.12, 0.75).y, { txt: "Válvula (E)" });
  }

  protected override update(dt: number): void {
    const o = this.o(this.tuberia)!;
    this.calor = Math.min(1, this.calor + dt * 0.03);
    o.v = this.calor;
    // El vapor tóxico sale hacia la válvula mientras no se desvíe.
    if (!this.desviado) {
      if (!this.vapor || !this.g.state.zonas.has(this.vapor)) this.vapor = this.g.addZone("vapor", this.pos(0.4, 0.7).x, this.pos(0.4, 0.7).y, 95, 2.5);
      // ¿Hay un muro de hielo sobre la marca?
      const m = this.o(this.marca)!;
      let muro = false;
      this.g.state.objetos.forEach((ob) => ob.k === "muro_hielo" && dist(ob.x, ob.y, m.x, m.y) < 90 && (muro = true));
      if (muro) {
        this.desviado = true;
        this.g.state.zonas.delete(this.vapor);
        m.st = "ok";
        this.g.aviso("¡Vapor desviado!", "exito");
        this.g.sectores.paso(this, "");
      }
    }
    this.progreso((1 - this.calor) * 0.5 + (this.desviado ? 0.4 : 0));
    this.texto(`Calor de la tubería: ${Math.round(this.calor * 100)}% · Vapor ${this.desviado ? "desviado ✔" : "sin desviar (muro en la marca)"} · Luego cierra la válvula (E).`);
  }

  override chorro(id: string, p: Player, dt: number): void {
    if (!this.puede(p)) return;
    const o = this.o(this.tuberia)!;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > 240 || Math.abs(angleDiff(p.aim, Math.atan2(o.y - p.y, o.x - p.x))) > 0.5) return;
    this.empezar();
    this.calor = Math.max(0, this.calor - dt * 0.12 * (1 + this.g.st(id, p, "frio")));
  }

  override interact(id: string, p: Player): boolean {
    if (!this.cerca(p, this.valvula)) return false;
    if (!this.puede(p)) return this.noPuede(id), true;
    if (this.bloqueado(id)) return true;
    if (this.calor > 0.05 || !this.desviado) return this.g.aviso("Antes enfría la tubería del todo y desvía el vapor con un muro de hielo.", "info", id), true;
    this.resolver();
    return true;
  }
}

// ================================================================== F · Sector II: Pasarela helada
export class T2F extends RetoBase {
  private hueco = "";
  private huecoRect = { tx: 0, ty: 0, tw: 1, th: 1 };
  private celula = "";
  private puenteT = 0;
  private calor = 1;

  protected override montar(): void {
    const c = this.casilla(0.7, 0.5);
    this.despejar(c.x, c.y, 360);
    const r = this.anillo("abismo", c.tx - 1, c.ty - 1, 3, 3, 2, DYN_TODOS, { lado: "o", desde: 0, ancho: 3 });
    this.huecoRect = r.hueco!;
    this.hueco = this.bloqueo("abismo", this.huecoRect.tx, this.huecoRect.ty, this.huecoRect.tw, this.huecoRect.th, DYN_TODOS);
    this.obj("marca_muro", (this.huecoRect.tx + 1) * TILE, (this.huecoRect.ty + this.huecoRect.th / 2) * TILE, { txt: "Muro de hielo aquí: pasarela" });
    this.celula = this.obj("celula", c.x, c.y, { v: 1, txt: "Célula de contención" });
  }

  protected override update(dt: number): void {
    if (this.puenteT > 0) {
      this.puenteT -= dt;
      if (this.puenteT <= 0) {
        this.hueco = this.bloqueo("abismo", this.huecoRect.tx, this.huecoRect.ty, this.huecoRect.tw, this.huecoRect.th, DYN_TODOS);
        this.g.aviso("La pasarela de hielo se derritió.", "info");
      }
    } else {
      let muro = false;
      this.g.state.objetos.forEach((o) => {
        if (o.k !== "muro_hielo") return;
        const tx = Math.floor(o.x / TILE);
        const ty = Math.floor(o.y / TILE);
        if (tx >= this.huecoRect.tx - 1 && tx <= this.huecoRect.tx + this.huecoRect.tw && ty >= this.huecoRect.ty - 1 && ty <= this.huecoRect.ty + this.huecoRect.th) muro = true;
      });
      if (muro) {
        this.quitarBloqueo(this.hueco);
        this.puenteT = 22;
        this.empezar();
        // El muro se integra en la pasarela.
        const quitar: string[] = [];
        this.g.state.objetos.forEach((o, oid) => {
          if (o.k === "muro_hielo" && Math.abs(Math.floor(o.x / TILE) - this.huecoRect.tx - 1) <= 2 && Math.abs(Math.floor(o.y / TILE) - this.huecoRect.ty - 1) <= 3) quitar.push(oid);
        });
        for (const q of quitar) this.g.state.objetos.delete(q);
        this.obj("pasarela_hielo", (this.huecoRect.tx + this.huecoRect.tw / 2) * TILE, (this.huecoRect.ty + this.huecoRect.th / 2) * TILE, { r: this.huecoRect.th * TILE });
        this.g.aviso("¡Pasarela helada durante 22 s!", "exito");
      }
    }
    if (this.calor <= 0.005) return this.resolver();
    this.calor = Math.min(1, this.calor + dt * 0.02);
    this.o(this.celula)!.v = this.calor;
    this.progreso(1 - this.calor);
  }

  override chorro(id: string, p: Player, dt: number): void {
    if (!this.puede(p)) return;
    const o = this.o(this.celula)!;
    if (dist(p.x, p.y, o.x, o.y) > 230 || Math.abs(angleDiff(p.aim, Math.atan2(o.y - p.y, o.x - p.x))) > 0.5) return;
    this.empezar();
    this.calor = Math.max(0, this.calor - dt * 0.11 * (1 + this.g.st(id, p, "frio")));
  }

  protected override alResolver(): void {
    this.limpiar();
  }
}

// ================================================================== F · Sector III: Cierres helados
export class T3F extends RetoBase {
  private cierres: string[] = [];
  private fuga = "";
  private fugaZona = "";
  private sync = 0;
  private fugaT = 0;

  protected override montar(): void {
    [[0.15, 0.2], [0.5, 0.12], [0.85, 0.2]].forEach(([fx, fy], i) => this.cierres.push(this.obj("cierre_calor", this.pos(fx, fy).x, this.pos(fx, fy).y, { v: 0.3, txt: `Cierre ${i + 1}` })));
    this.nuevaFuga();
  }

  private nuevaFuga(): void {
    if (this.fuga) this.quitarObj(this.fuga);
    const p = this.pos(0.2 + Math.random() * 0.6, 0.55 + Math.random() * 0.35);
    this.fuga = this.obj("fuga", p.x, p.y, { txt: "Fuga: tápala con un muro de hielo" });
    this.fugaT = 22;
  }

  protected override update(dt: number): void {
    if (this.inicio < 0) return;
    let roto = false;
    for (const c of this.cierres) {
      const o = this.o(c)!;
      o.v = Math.min(1, o.v + dt * 0.06 * this.g.sectores.factorAlarma());
      if (o.v >= 1) roto = true;
    }
    const f = this.o(this.fuga)!;
    let tapada = false;
    this.g.state.objetos.forEach((ob) => ob.k === "muro_hielo" && dist(ob.x, ob.y, f.x, f.y) < 80 && (tapada = true));
    f.st = tapada ? "ok" : "";
    if (!tapada) {
      if (!this.fugaZona || !this.g.state.zonas.has(this.fugaZona)) this.fugaZona = this.g.addZone("vapor", f.x, f.y, 90, 2);
    }
    this.fugaT -= dt;
    if (this.fugaT <= 0) this.nuevaFuga();
    if (roto) {
      this.sync = Math.max(0, this.sync - 0.3);
      for (const c of this.cierres) this.o(c)!.v = 0.4;
      this.error("", "¡Un cierre se sobrecalentó! La sincronización retrocede.");
    } else if (tapada) this.sync += dt / 40;
    this.progreso(this.sync);
    this.texto(`Sincronización ${Math.round(this.sync * 100)}% · mantén fríos los cierres (chorro) y la fuga tapada (muro).`);
    if (this.sync >= 1) this.resolver();
  }

  override chorro(id: string, p: Player, dt: number): void {
    if (!this.puede(p)) return;
    for (const c of this.cierres) {
      const o = this.o(c)!;
      if (dist(p.x, p.y, o.x, o.y) > 240 || Math.abs(angleDiff(p.aim, Math.atan2(o.y - p.y, o.x - p.x))) > 0.5) continue;
      this.empezar();
      o.v = Math.max(0, o.v - dt * 0.35 * (1 + this.g.st(id, p, "frio")));
    }
  }

  override habilidad(_id: string, p: Player): boolean {
    if (this.puede(p)) this.empezar();
    return false;
  }
}

void HAB;
void azar;
