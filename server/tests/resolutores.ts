// Resolutores automáticos: cada uno completa un reto usando solo acciones de juego válidas
// (habilidades, E, disparos, órdenes). Se teletransporta al jugador para no depender de la ruta
// a pie (la accesibilidad se prueba aparte). Sirven para comprobar que todos los retos son resolubles.
import { dist, type AlienKind } from "@dawg/shared";
import type { Player, Unit } from "../src/schema/GameState";
import type { Partida } from "../src/game/Partida";
import type { RetoBase } from "../src/game/retos/base";

export class Banco {
  constructor(readonly g: Partida) {}
  tick(n = 1): void {
    for (let i = 0; i < n; i++) {
      // Nadie muere durante los resolutores (se prueba la lógica del reto, no el combate).
      this.g.state.jugadores.forEach((p) => {
        if (!p.vivo) return;
        p.hp = p.maxHp;
        // Se prueba la lógica, no el combate: sin congelaciones, redes ni gas.
        if (p.estado !== "ok" && p.estado !== "aturdido") {
          p.estado = "ok";
          p.estadoT = 0;
        }
        p.confuso = 0;
      });
      this.g.tick(1 / 30);
    }
  }
  seg(s: number): void {
    this.tick(Math.round(s * 30));
  }
  p(id: string): Player {
    return this.g.state.jugadores.get(id)!;
  }
  tp(id: string, x: number, y: number): void {
    const p = this.p(id);
    p.x = x;
    p.y = y;
  }
  /** Teletransporta a un sitio caminable cercano. */
  junto(id: string, x: number, y: number, dx = 0, dy = 70): void {
    const p = this.p(id);
    const quien = p.bajoTierra ? 2 : 1;
    for (const [ox, oy] of [[dx, dy], [0, 70], [0, -70], [70, 0], [-70, 0], [50, 50], [-50, 50], [50, -50], [-50, -50], [0, 40], [40, 0], [0, 0]]) {
      if (!this.g.world.blocksMoveAt(x + ox, y + oy, quien)) {
        this.tp(id, x + ox, y + oy);
        return;
      }
    }
    this.tp(id, x, y);
  }
  E(id: string): void {
    this.g.setInteract(id, true);
    this.tick(1);
    this.g.setInteract(id, false);
    this.tick(1);
  }
  Emantener(id: string, s: number): void {
    this.g.setInteract(id, true);
    this.seg(s);
    this.g.setInteract(id, false);
    this.tick(1);
  }
  hab(id: string, x: number, y: number): void {
    const p = this.p(id);
    p.enfriamiento = 0;
    this.g.usarHabilidad(id, x, y, "down");
    this.tick(1);
    this.g.usarHabilidad(id, x, y, "up");
    this.tick(1);
  }
  habMantener(id: string, x: number, y: number, s: number): void {
    this.p(id).enfriamiento = 0;
    this.g.usarHabilidad(id, x, y, "down");
    this.seg(s);
  }
  apuntarA(id: string, x: number, y: number): number {
    const p = this.p(id);
    return Math.atan2(y - p.y, x - p.x);
  }
  disparar(id: string, x: number, y: number, s: number): void {
    const n = Math.round(s * 30);
    for (let i = 0; i < n; i++) {
      const p = this.p(id);
      this.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: this.apuntarA(id, x, y), shoot: true });
      this.tick(1);
    }
    const p = this.p(id);
    this.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: p.aim, shoot: false });
    this.tick(1);
  }
  /** Dispara siguiendo a una unidad que se mueve. */
  dispararA(id: string, uid: string, s: number): void {
    const n = Math.round(s * 30);
    for (let i = 0; i < n; i++) {
      const u = this.g.state.unidades.get(uid);
      const p = this.p(id);
      if (!u) break;
      this.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: this.apuntarA(id, u.x, u.y), shoot: true });
      this.tick(1);
    }
    const p = this.p(id);
    this.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: p.aim, shoot: false });
    this.tick(1);
  }
  forma(id: string, k: AlienKind): void {
    const p = this.p(id);
    if (p.forma !== k) this.g.ponerForma(id, p, k);
  }
  unidadCerca(x: number, y: number, r: number, f: (u: Unit) => boolean): [string, Unit] | null {
    return this.g.unitNear(x, y, r, f);
  }
  /** Escaneo del Cambiaformas sobre una unidad concreta. */
  escanear(id: string, uid: string): void {
    for (let i = 0; i < 8; i++) {
      const u = this.g.state.unidades.get(uid);
      if (!u) return;
      this.junto(id, u.x, u.y, 60, 0);
      this.hab(id, u.x, u.y);
      for (let k = 0; k < 45; k++) {
        const uu = this.g.state.unidades.get(uid);
        if (uu) this.junto(id, uu.x, uu.y, 60, 0);
        this.tick(1);
      }
      if (this.p(id).identidad === u.t) break;
    }
    const p = this.p(id);
    if (!p.disfrazado) {
      p.energia = 100;
      this.hab(id, p.x + 400, p.y + 400);
    }
  }
}

type Resolutor = (b: Banco, r: RetoBase, quien: (k?: AlienKind) => string) => void;
const R = (r: RetoBase) => r as unknown as Record<string, unknown> & RetoBase;
const obj = (b: Banco, id: string) => b.g.state.pz.get(id)!;
const hasta = (b: Banco, r: RetoBase, s: number, paso: () => void) => {
  for (let t = 0; t < s * 30 && !r.resuelto; t += 1) {
    paso();
    b.tick(1);
  }
};

export const RESOLUTORES: Record<string, Resolutor> = {
  t1C(b, r, q) {
    const id = q("cambiaformas");
    b.escanear(id, R(r).inspector as string);
    const c = obj(b, R(r).consola as string);
    b.junto(id, c.x, c.y);
    b.E(id);
    const t = obj(b, R(r).teclado as string);
    b.junto(id, t.x, t.y);
    b.E(id);
    b.g.sectores.mensajeMinijuego(id, { id: r.slot, ev: "codigo", codigo: R(r).codigo as number[] });
  },
  t2C(b, r, q) {
    const id = q("cambiaformas");
    b.escanear(id, R(r).tecnico as string);
    const e = obj(b, R(r).escaner as string);
    b.junto(id, e.x, e.y + 40, 0, 0);
    b.Emantener(id, 3.6);
    const k = obj(b, R(r).clave as string);
    b.tp(id, k.x, k.y);
    b.E(id);
    const t = obj(b, R(r).terminal as string);
    b.junto(id, t.x, t.y);
    b.E(id);
  },
  t3C(b, r, q) {
    const id = q("cambiaformas");
    b.escanear(id, R(r).oficial as string);
    const t = obj(b, R(r).terminal as string);
    b.junto(id, t.x, t.y);
    b.g.setInteract(id, true);
    hasta(b, r, 20, () => {
      const p = b.p(id);
      if (!p.disfrazado) {
        p.energia = 100;
        p.sospecha = 0;
        b.g.usarHabilidad(id, p.x + 500, p.y, "down");
      }
      p.sospecha = 0;
    });
    b.g.setInteract(id, false);
  },
  t1D(b, r, q) {
    const id = q("delmar");
    const c = b.g.state.pz.get([...(R(r).huecos as string[])][0])!;
    b.tp(id, c.x, c.y + 100);
    hasta(b, r, 90, () => {
      const huecos = (R(r).huecos as string[]).map((h) => obj(b, h));
      for (const [iid] of R(r).items as Map<string, number>) {
        const o = b.g.state.pz.get(iid);
        if (o && huecos.some((h) => h.st !== "ok" && h.f === o.f)) {
          b.junto(id, o.x, o.y - 120, 0, 0);
          b.hab(id, o.x, o.y);
          break;
        }
      }
    });
  },
  t2D(b, r, q) {
    const id = q("delmar");
    const re = obj(b, R(r).reactor as string);
    b.junto(id, re.x, re.y);
    b.E(id);
    b.g.sectores.mensajeMinijuego(id, { id: r.slot, ev: "ritmo", aciertos: 30, total: 34 });
    const d = obj(b, R(r).deposito as string);
    b.junto(id, d.x, d.y, -60, 0);
    b.hab(id, d.x, d.y);
    const v = obj(b, R(r).valvula as string);
    b.tp(id, v.x, v.y + 30);
    b.E(id);
  },
  t3D(b, r, q) {
    const id = q("delmar");
    const m = obj(b, R(r).medidor as string);
    b.tp(id, m.x, m.y + 40);
    hasta(b, r, 140, () => {
      for (const v of R(r).valvulas as string[]) {
        const o = obj(b, v);
        if (o.st !== "junta" || o.v < 0.3) {
          b.hab(id, o.x, o.y);
          break;
        }
      }
    });
  },
  t1T(b, r, q) {
    const id = q("inteligente");
    const pr = obj(b, R(r).proyector as string);
    b.junto(id, pr.x, pr.y);
    b.E(id);
    b.seg(4);
    const ce = obj(b, R(r).celda as string);
    b.junto(id, ce.x, ce.y);
    b.hab(id, ce.x, ce.y);
    for (const i of R(r).orden as number[]) {
      const s = obj(b, (R(r).ranuras as string[])[i]);
      b.junto(id, s.x, s.y + 180, 0, 0);
      b.hab(id, s.x, s.y);
    }
  },
  t2T(b, r, q) {
    const id = q("inteligente");
    const uid = (R(r).sujetos as string[])[0];
    const u = b.g.state.unidades.get(uid)!;
    b.junto(id, u.x, u.y, 120, 0);
    b.habMantener(id, u.x, u.y, 0.8);
    b.g.usarHabilidad(id, u.x, u.y, "up");
    const p = b.p(id);
    if (!p.controla) throw new Error("No tomó el control del guardia");
    const sw = obj(b, R(r).interruptor as string);
    const cu = b.g.state.unidades.get(p.controla)!;
    cu.x = sw.x + 30;
    cu.y = sw.y;
    b.tick(2);
    b.E(id);
  },
  t3T(b, r, q) {
    const id = q("inteligente");
    const re = obj(b, R(r).regulador as string);
    b.junto(id, re.x, re.y + 150, 0, 0);
    b.p(id).enfriamiento = 0;
    b.g.usarHabilidad(id, re.x, re.y, "down");
    const d = b.g.pdata.get(id)!;
    hasta(b, r, 60, () => {
      const an = obj(b, R(r).anilloObj as string);
      d.aimX = an.x;
      d.aimY = an.y;
    });
    b.g.usarHabilidad(id, 0, 0, "up");
  },
  t1H(b, r, q) {
    const id = q("curandera");
    for (const n of R(r).nodos as string[]) {
      const ba = obj(b, R(r).barrera as string);
      b.junto(id, ba.x, ba.y, 0, 60);
      b.E(id);
      const no = obj(b, n);
      const p = b.p(id);
      const x0 = p.x;
      const y0 = p.y;
      for (let i = 1; i <= 20; i++) {
        b.tp(id, x0 + ((no.x - x0) * i) / 20, y0 + ((no.y + 40 - y0) * i) / 20);
        b.tick(1);
      }
      b.E(id);
    }
  },
  t2H(b, r, q) {
    const id = q("curandera");
    const si = obj(b, R(r).sintetizador as string);
    for (const f of R(r).receta as number[]) {
      const m = (R(r).muestras as string[]).find((mm) => obj(b, mm).f === f)!;
      const o = obj(b, m);
      b.junto(id, o.x, o.y, 0, 40);
      b.E(id);
      b.junto(id, si.x, si.y);
      b.E(id);
    }
    const uid = b.g.spawnUnit("fusilero", si.x + 60, si.y + 60);
    b.junto(id, si.x + 60, si.y + 110, 0, 0);
    b.hab(id, si.x + 60, si.y + 60);
    b.junto(id, si.x, si.y);
    b.hab(id, si.x, si.y);
    void uid;
  },
  t3H(b, r, q) {
    const id = q("curandera");
    for (let i = 0; i < 3 && !r.resuelto; i++) {
      const re = obj(b, (R(r).rejillas as string[])[i]);
      b.junto(id, re.x, re.y);
      b.Emantener(id, 5.6);
    }
  },
  t1V(b, r, q) {
    const id = q("vesper");
    const [a1, a2] = R(r).anclas as string[];
    const u1 = b.g.state.unidades.get(a1)!;
    for (let dx = 260; dx < 600; dx += 40) if (!b.g.world.blocksMoveAt(u1.x - dx, u1.y, 1)) {
      b.tp(id, u1.x - dx, u1.y);
      break;
    }
    b.hab(id, u1.x, u1.y);
    const u2 = b.g.state.unidades.get(a2)!;
    b.hab(id, u2.x, u2.y);
    b.E(id);
  },
  t2V(b, r, q) {
    const id = q("vesper");
    const c = obj(b, R(r).control as string);
    for (let i = 0; i < 20 && !r.resuelto; i++) {
      b.tp(id, c.x - 40, c.y);
      b.E(id);
      b.seg(0.3);
    }
  },
  t3V(b, r, q) {
    const id = q("vesper");
    for (const c of R(r).cierres as string[]) {
      const o = obj(b, c);
      b.junto(id, o.x, o.y, 0, 40);
      b.E(id);
    }
  },
  t1F(b, r, q) {
    const id = q("freeze");
    const m = obj(b, R(r).marca as string);
    b.junto(id, m.x - 200, m.y, 0, 0);
    b.hab(id, m.x, m.y);
    b.seg(0.5);
    const t = obj(b, R(r).tuberia as string);
    b.junto(id, t.x + 150, t.y, 0, 0);
    hasta(b, r, 40, () => {
      if ((R(r).calor as number) > 0.01) {
        const p = b.p(id);
        b.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: b.apuntarA(id, t.x, t.y), shoot: true });
      }
      if ((R(r).calor as number) <= 0.01) {
        const v = obj(b, R(r).valvula as string);
        b.junto(id, v.x, v.y);
        b.g.setInteract(id, !b.g.pdata.get(id)!.interact);
      }
    });
    b.g.setInteract(id, false);
  },
  t2F(b, r, q) {
    const id = q("freeze");
    const h = R(r).huecoRect as { tx: number; ty: number; tw: number; th: number };
    const gx = (h.tx + 1) * 64;
    const gy = (h.ty + h.th / 2) * 64;
    b.junto(id, gx - 220, gy, 0, 0);
    b.hab(id, gx, gy);
    b.seg(0.5);
    const c = obj(b, R(r).celula as string);
    b.tp(id, c.x - 70, c.y);
    b.disparar(id, c.x, c.y, 14);
  },
  t3F(b, r, q) {
    const id = q("freeze");
    let i = 0;
    hasta(b, r, 120, () => {
      const f = obj(b, R(r).fuga as string);
      if (f.st !== "ok") {
        b.junto(id, f.x, f.y + 150, 0, 0);
        b.p(id).enfriamiento = 0;
        b.g.usarHabilidad(id, f.x, f.y, "down");
        b.g.usarHabilidad(id, f.x, f.y, "up");
        return;
      }
      const cierres = R(r).cierres as string[];
      const c = obj(b, cierres.reduce((m, x) => (obj(b, x).v > obj(b, m).v ? x : m), cierres[0]));
      if (i++ % 2 === 0) b.junto(id, c.x, c.y + 120, 0, 0);
      const p = b.p(id);
      b.g.input(id, { seq: (p.seq + 1) >>> 0, mx: 0, my: 0, aim: b.apuntarA(id, c.x, c.y), shoot: true });
    });
  },
  t1E(b, r, q) {
    const id = q("escarabajo");
    const it = obj(b, R(r).interruptor as string);
    b.junto(id, it.x, it.y - 260, 0, 0);
    b.hab(id, it.x, it.y);
    // Bajo tierra hasta el interruptor (sin pisar grietas: ruta por el norte).
    b.tp(id, it.x, it.y - 130);
    b.tick(1);
    b.tp(id, it.x, it.y);
    b.tick(1);
    b.E(id);
  },
  t2E(b, r, q) {
    const id = q("escarabajo");
    const p = b.p(id);
    const pl = (R(r).placas as string[]).map((x) => obj(b, x)).sort((a, c) => a.f - c.f);
    b.junto(id, pl[0].x, pl[0].y);
    b.hab(id, p.x, p.y);
    for (const o of pl) {
      b.tp(id, o.x, o.y);
      b.p(id).energia = 100;
      b.E(id);
    }
  },
  t3E(b, r, q) {
    const id = q("escarabajo");
    const s = obj(b, R(r).suelo as string);
    b.junto(id, s.x, s.y, 0, 0);
    b.hab(id, s.x, s.y);
    b.tp(id, s.x, s.y);
    b.Emantener(id, 3.8);
    const pa = obj(b, R(r).palanca as string);
    // Al abrirse la ruta, quien está sobre el agujero viaja al otro lado.
    if (dist(b.p(id).x, b.p(id).y, pa.x, pa.y) > 80) {
      b.seg(1.6);
      b.tp(id, s.x, s.y);
      b.tick(3);
    }
    if (dist(b.p(id).x, b.p(id).y, pa.x, pa.y) > 80) throw new Error("El túnel no llevó dentro del cerrojo");
    b.E(id);
  },
  t1S(b, r, q) {
    const id = q("simbionte");
    const h = asimilarUno(b, r, id, R(r).guardias as string[]);
    const l = obj(b, R(r).lector as string);
    b.junto(id, l.x + 200, l.y, 0, 0);
    b.hab(id, l.x, l.y);
    hasta(b, r, 40, () => {
      const u = b.g.state.unidades.get(h);
      if (u && dist(u.x, u.y, l.x, l.y) > 60 && Math.random() < 0.02) {
        u.x = l.x;
        u.y = l.y;
      }
    });
  },
  t2S(b, r, q) {
    const id = q("simbionte");
    const est = (R(r).estaciones as string[]).map((e) => obj(b, e));
    const hs: string[] = [];
    for (let k = 0; k < 2; k++) hs.push(asimilarUno(b, r, id, R(r).guardias as string[]));
    hs.forEach((h, i) => {
      const u = b.g.state.unidades.get(h)!;
      u.x = est[i].x;
      u.y = est[i].y;
      const br = b.g.brains.get(h)!;
      br.x = u.x;
      br.y = u.y;
      br.orden = { x: est[i].x, y: est[i].y };
    });
    const n = b.g.state.unidades.get(R(r).nodo as string)!;
    b.junto(id, n.x, n.y + 160, 0, 0);
    b.disparar(id, n.x, n.y, 12);
  },
  t3S(b, r, q) {
    const id = q("simbionte");
    const h = asimilarUno(b, r, id, R(r).guardias as string[]);
    for (const s of R(r).seguros as string[]) {
      const o = obj(b, s);
      const br = b.g.brains.get(h);
      const u = b.g.state.unidades.get(h);
      if (!br || !u) break;
      u.x = o.x;
      u.y = o.y;
      br.x = o.x;
      br.y = o.y;
      br.orden = { x: o.x, y: o.y };
      const p = b.p(id);
      p.x = o.x + 400;
      b.seg(8.6);
    }
  },
  "x-fusibles"(b, r, q) {
    const id = q();
    for (const f of [...(R(r).fusibles as string[])]) {
      const o = obj(b, f);
      b.tp(id, o.x, o.y);
      b.tick(2);
    }
    const pa = obj(b, R(r).panel as string);
    b.junto(id, pa.x, pa.y);
    b.E(id);
  },
  "x-terminal"(b, r, q) {
    const id = q();
    const t = obj(b, R(r).terminal as string);
    b.junto(id, t.x, t.y, 0, 60);
    hasta(b, r, 60, () => {});
  },
  "x-generadores"(b, r, q) {
    const id = q();
    for (const gid of R(r).gens as string[]) {
      const u = b.g.state.unidades.get(gid);
      if (!u) continue;
      b.seg(4.2);
      b.g.hitUnit(gid, u, 5000, null, id);
    }
  },
  "x-espejos"(b, r, q) {
    const id = q();
    const ids = [...(R(r).espejos as Map<string, unknown>).keys()];
    for (let mask = 0; mask < 1 << ids.length && !r.resuelto; mask++) {
      ids.forEach((m, i) => {
        if (r.resuelto) return;
        const o = obj(b, m);
        if (o.f !== ((mask >> i) & 1)) {
          b.junto(id, o.x, o.y, 0, 50);
          b.E(id);
        }
      });
    }
  },
  "x-carro"(b, r, q) {
    const id = q();
    hasta(b, r, 90, () => {
      const c = obj(b, R(r).carro as string);
      b.tp(id, c.x - 60, c.y + 60);
    });
  },
  "x-saboteador"(b, r, q) {
    const id = q();
    b.seg(1);
    const uid = R(r).sab as string;
    const u = b.g.state.unidades.get(uid);
    if (u) b.g.hitUnit(uid, u, 9999, null, id);
    b.tick(2);
    const t = obj(b, R(r).tarjeta as string);
    b.tp(id, t.x, t.y);
    b.tick(3);
    const l = obj(b, R(r).lector as string);
    b.junto(id, l.x, l.y);
    b.E(id);
  },
  "x-purga"(b, r, q) {
    const id = q();
    for (const v of R(r).valvulas as string[]) {
      const o = obj(b, v);
      b.junto(id, o.x, o.y, 0, 40);
      b.Emantener(id, 2.8);
    }
  },
  "x-luces"(b, r, q) {
    const id = q();
    const bal = R(r).baldosas as string[][];
    const estado = () => bal.map((f) => f.map((o) => obj(b, o).st === "on"));
    // Buscar las pulsaciones que encienden todo (3x3, 512 combinaciones).
    const ini = estado();
    let sol = -1;
    for (let m = 0; m < 512 && sol < 0; m++) {
      const s = ini.map((f) => f.slice());
      for (let i = 0; i < 9; i++) {
        if (!((m >> i) & 1)) continue;
        const f = Math.floor(i / 3);
        const k = i % 3;
        for (const [df, dk] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (s[f + df]?.[k + dk] !== undefined) s[f + df][k + dk] = !s[f + df][k + dk];
      }
      if (s.every((f) => f.every(Boolean))) sol = m;
    }
    if (sol < 0) throw new Error("Luces sin solución");
    for (let i = 0; i < 9; i++) {
      if (!((sol >> i) & 1)) continue;
      const o = obj(b, bal[Math.floor(i / 3)][i % 3]);
      b.tp(id, o.x, o.y - 400);
      b.tick(1);
      b.tp(id, o.x, o.y);
      b.tick(14);
      b.tp(id, o.x, o.y - 400);
      b.tick(1);
    }
  },
  "l-memoria"(b, r, q) {
    consola(b, r, q("inteligente"));
  },
  "l-transmutacion"(b, r, q) {
    consola(b, r, q("delmar"));
  },
  "l-cara"(b, r, q) {
    const id = q("cambiaformas");
    const e = obj(b, R(r).estacion as string);
    const uid = b.g.spawnUnit("fusilero", e.x + 100, e.y + 100);
    b.escanear(id, uid);
    b.g.removeUnit(uid);
    consola(b, r, id);
  },
  "l-rayos"(b, r, q) {
    const t = q("inteligente");
    const c = q("cambiaformas");
    const uid = b.g.spawnUnit("fusilero", obj(b, R(r).consola as string).x + 100, obj(b, R(r).consola as string).y + 100);
    b.escanear(c, uid);
    b.g.removeUnit(uid);
    const co = obj(b, R(r).consola as string);
    b.forma(c, "cambiaformas");
    b.junto(c, co.x, co.y);
    b.E(c);
    for (let ronda = 0; ronda < 3 && !r.resuelto; ronda++) {
      for (const s of [...(R(r).sec as number[])]) {
        const sw = (R(r).interruptores as string[]).map((x) => obj(b, x)).find((o) => o.f === s)!;
        b.forma(t, "inteligente");
        b.junto(t, sw.x, sw.y + 150, 0, 0);
        b.hab(t, sw.x, sw.y);
      }
    }
  },
  "l-puente"(b, r, q) {
    const t = q("inteligente");
    const d = q("delmar");
    const disp = R(r).dispensador as { x: number; y: number };
    for (const s of R(r).slots as { x: number; y: number }[]) {
      b.forma(t, "inteligente");
      b.junto(t, disp.x, disp.y + 60, 0, 0);
      b.hab(t, disp.x, disp.y);
      b.hab(t, s.x, s.y);
      b.forma(d, "delmar");
      b.junto(d, s.x, s.y + 380, 0, 0);
      b.hab(d, s.x, s.y);
    }
    const bo = obj(b, R(r).boton as string);
    b.tp(t, bo.x, bo.y + 40);
    b.E(t);
  },
  "l-valvulas"(b, r, q) {
    const c = q("cambiaformas");
    const d = q("delmar");
    const [pa, pb] = R(r).palancas as { id: string }[];
    const oa = obj(b, pa.id);
    const ob = obj(b, pb.id);
    b.junto(c, oa.x, oa.y, 0, 40);
    b.junto(d, ob.x, ob.y, 0, 40);
    b.E(c);
    if (c !== d) b.E(d);
    b.seg(4);
    hasta(b, r, 70, () => {
      const e = R(r).e as { inicio: number; notas: { t: number; d: number; l: string }[]; hitsA: number[]; hitsB: number[] } | null;
      if (!e) return;
      const ahora = b.g.time - e.inicio;
      e.notas.forEach((n, i) => {
        if (ahora < n.t + 0.1 || ahora > n.t + n.d * 0.4) return;
        if (n.l.includes("A") && e.hitsA[i] < 0) b.g.sectores.mensajeMinijuego(c, { id: r.slot, ev: "nota", nota: i, ok: true, lane: "A" });
        if (n.l.includes("B") && e.hitsB[i] < 0) b.g.sectores.mensajeMinijuego(d, { id: r.slot, ev: "nota", nota: i, ok: true, lane: "B" });
      });
    });
  },
};

function consola(b: Banco, r: RetoBase, id: string): void {
  const e = b.g.state.pz.get(R(r).estacion as string)!;
  b.junto(id, e.x, e.y);
  b.E(id);
  hasta(b, r, 70, () => {
    if (Math.floor(b.g.time * 30) % 50 === 0) b.g.sectores.mensajeMinijuego(id, { id: r.slot, ev: "acierto", rapido: true });
  });
}

function asimilarUno(b: Banco, r: RetoBase, id: string, lista: string[]): string {
  for (let intento = 0; intento < 40; intento++) {
    const uid = lista.find((x) => b.g.state.unidades.get(x)?.team === "humanos");
    if (!uid) {
      b.seg(1);
      continue;
    }
    const u = b.g.state.unidades.get(uid)!;
    b.junto(id, u.x, u.y, 140, 0);
    b.dispararA(id, uid, 1.5);
    const uu = b.g.state.unidades.get(uid);
    if (uu && uu.st === "infectado") {
      b.hab(id, uu.x, uu.y);
      if (uu.team === "aliens") return uid;
    }
  }
  throw new Error("No se pudo asimilar a ningún guardia");
}
