// Interfaz sobre el juego: equipo, vida, habilidad, objetivo, avisos, minimapa,
// flechas hacia los compañeros y el gestor de minijuegos.
import {
  ABILITY_NAMES,
  ALIENS,
  ALIEN_KINDS,
  DISFRAZ,
  INTERACT_RANGE,
  PUENTE,
  PUZZLES,
  TELEQUINESIS,
  TILE,
  TRANSMUTAR,
  dist,
  isAlienKind,
  type AbilityKind,
  type AvisoMsg,
} from "@dawg/shared";
import Phaser from "phaser";
import type { GameStateS, PlayerS } from "../../net/tipos";
import { mostrarFin, ocultarFin } from "../../ui/fin";
import { COLOR_ALIEN, TEXTO, TITULO, ctx, type Ctx } from "../contexto";
import { sfx } from "../sonido";
import type { Mundo } from "./Mundo";

const COLOR_AVISO: Record<string, string> = { info: "#eaf6ff", peligro: "#ff5a5a", exito: "#7dff6a", alma: "#d2b8ff", rescate: "#ffd23e" };
const ROOM_COLOR: Record<string, string> = {
  r0: "#3c8a66",
  almacen: "#4a6170",
  r1: "#3b7896",
  hub: "#3a63a8",
  r2: "#4b6585",
  r3: "#3f7676",
  pasillo: "#3a5a74",
  r4: "#5f53a0",
  r5: "#3d7590",
  r6: "#3a7f9a",
  r7: "#734f9a",
  salida: "#b0962a",
};

interface Fila {
  img: Phaser.GameObjects.Image;
  nombre: Phaser.GameObjects.Text;
  icono: Phaser.GameObjects.Image;
}

interface Flecha {
  f: Phaser.GameObjects.Image;
  icono: Phaser.GameObjects.Image;
  txt: Phaser.GameObjects.Text;
}

export class Hud extends Phaser.Scene {
  c!: Ctx;
  private filas = new Map<string, Fila>();
  private gEquipo!: Phaser.GameObjects.Graphics;
  private gPropio!: Phaser.GameObjects.Graphics;
  private txtVida!: Phaser.GameObjects.Text;
  private txtHab!: Phaser.GameObjects.Text;
  private txtAyuda!: Phaser.GameObjects.Text;
  private almasIconos: Phaser.GameObjects.Image[] = [];
  private objetivo!: Phaser.GameObjects.Text;
  private gObjetivo!: Phaser.GameObjects.Graphics;
  private puzzlesTxt!: Phaser.GameObjects.Text;
  private gPuzzles!: Phaser.GameObjects.Graphics;
  private jefeTxt!: Phaser.GameObjects.Text;
  private gJefe!: Phaser.GameObjects.Graphics;
  private avisos: { t: Phaser.GameObjects.Text; hasta: number }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private mm!: Phaser.GameObjects.Image;
  private mmBig!: Phaser.GameObjects.Image;
  private gMapa!: Phaser.GameObjects.Graphics;
  private flechas: Flecha[] = [];
  private mgActual = "";
  private faseVista = "";
  private ultimoEstado = new Map<string, string>();

  constructor() {
    super("Hud");
  }

  get st(): GameStateS {
    return this.c.room.state;
  }

  create(): void {
    this.c = ctx(this);
    this.gEquipo = this.add.graphics();
    this.gPropio = this.add.graphics();
    this.txtVida = this.add.text(0, 0, "", { ...TEXTO, fontSize: "16px" });
    this.txtHab = this.add.text(0, 0, "", { ...TEXTO, fontSize: "16px" });
    this.txtAyuda = this.add.text(0, 0, "", { ...TEXTO, fontSize: "13px", color: "#a9c6db", strokeThickness: 3 });
    this.gObjetivo = this.add.graphics();
    this.objetivo = this.add.text(0, 0, "", { ...TEXTO, fontSize: "17px", align: "center" }).setOrigin(0.5, 0);
    this.gPuzzles = this.add.graphics();
    this.puzzlesTxt = this.add.text(0, 0, "", { ...TEXTO, fontSize: "15px", align: "center", color: "#ffd23e" }).setOrigin(0.5, 0);
    this.gJefe = this.add.graphics();
    this.jefeTxt = this.add.text(0, 0, "JEFE DE LABORATORIO", { ...TITULO, fontSize: "24px", color: "#ff7a5a" }).setOrigin(0.5, 1).setVisible(false);
    this.prompt = this.add.text(0, 0, "", { ...TEXTO, fontSize: "19px", align: "center", color: "#ffd23e" }).setOrigin(0.5, 1);
    this.crearMinimapa();
    this.gMapa = this.add.graphics();
    this.c.room.onMessage("aviso", (m: AvisoMsg) => this.aviso(m.texto, m.tipo));
    this.scale.on("resize", () => this.colocarMinimapa());
  }

  // ------------------------------------------------------------------ minimapa
  private crearMinimapa(): void {
    const w = this.c.world;
    const canvas = document.createElement("canvas");
    canvas.width = w.w;
    canvas.height = w.h;
    const g = canvas.getContext("2d")!;
    const suelo = (cx: number, cy: number) => !w.solid[w.idx(cx, cy)];
    for (let cy = 0; cy < w.h; cy++) {
      for (let cx = 0; cx < w.w; cx++) {
        const i = w.idx(cx, cy);
        let col = "";
        if (w.liquid[i]) col = "#6be04a";
        else if (suelo(cx, cy)) col = ROOM_COLOR[w.roomAt((cx + 0.5) * TILE, (cy + 0.5) * TILE)?.id ?? ""] ?? "#2f6d78";
        else {
          let borde = false;
          for (let dy = -1; dy <= 1 && !borde; dy++) for (let dx = -1; dx <= 1; dx++) if (w.inBounds(cx + dx, cy + dy) && suelo(cx + dx, cy + dy)) borde = true;
          if (borde) col = "#0e1a22";
        }
        if (col) {
          g.fillStyle = col;
          g.fillRect(cx, cy, 1, 1);
        }
      }
    }
    if (this.textures.exists("minimapa")) this.textures.remove("minimapa");
    this.textures.addCanvas("minimapa", canvas);
    this.mm = this.add.image(0, 0, "minimapa").setOrigin(0, 0).setAlpha(0.92);
    this.mmBig = this.add.image(0, 0, "minimapa").setOrigin(0.5).setVisible(false);
    this.mm.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.colocarMinimapa();
  }

  private mmEscala = 2;

  private colocarMinimapa(): void {
    const W = this.scale.width;
    this.mmEscala = W < 900 ? 1.5 : 2;
    this.mm.setScale(this.mmEscala).setPosition(W - this.c.world.w * this.mmEscala - 16, 16);
  }

  // ------------------------------------------------------------------ avisos
  private aviso(texto: string, tipo: string): void {
    sfx.aviso(tipo);
    const t = this.add
      .text(this.scale.width / 2, 0, texto, { ...TEXTO, fontSize: "18px", color: COLOR_AVISO[tipo] ?? "#fff", align: "center", wordWrap: { width: Math.min(720, this.scale.width - 80) } })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.avisos.push({ t, hasta: this.time.now + (tipo === "peligro" || tipo === "alma" || tipo === "rescate" ? 6500 : 5000) });
    while (this.avisos.length > 4) this.avisos.shift()!.t.destroy();
  }

  // ------------------------------------------------------------------ bucle
  override update(): void {
    const st = this.st;
    if (!st) return;
    const me = st.jugadores.get(this.c.room.sessionId);
    const W = this.scale.width;
    const H = this.scale.height;
    this.dibujarEquipo();
    this.dibujarPropio(me, H);
    let y = this.dibujarObjetivo(W);
    y = this.dibujarPuzzles(W, y);
    y = this.dibujarJefe(W, y, me);
    // En pantallas estrechas, los avisos van debajo del panel del equipo para no taparlo.
    if (W < 1180) y = Math.max(y, 16 + this.filas.size * 62 + 4);
    // Avisos
    const now = this.time.now;
    this.avisos = this.avisos.filter((a) => {
      if (now > a.hasta) {
        a.t.destroy();
        return false;
      }
      return true;
    });
    for (const a of this.avisos) {
      a.t.setPosition(W / 2, y + 6);
      if (a.hasta - now < 600) a.t.setAlpha((a.hasta - now) / 600);
      y += a.t.height + 4;
    }
    // Interacción
    this.prompt.setPosition(W / 2, H - 24).setText(this.c.ui.minijuego ? "" : this.c.ui.prompt);
    this.dibujarMapa();
    this.dibujarFlechas(me);
    this.gestionarMinijuego(me);
    this.revisarFase();
    this.avisosDeEstado();
  }

  private avisosDeEstado(): void {
    // Señal sonora cuando un compañero necesita rescate.
    this.st.jugadores.forEach((p, id) => {
      const prev = this.ultimoEstado.get(id) ?? "ok";
      if (prev !== p.estado && (p.estado === "congelado" || p.estado === "red")) sfx.aviso("rescate");
      this.ultimoEstado.set(id, p.estado);
    });
  }

  private revisarFase(): void {
    const f = this.st.fase;
    if (f === this.faseVista) return;
    this.faseVista = f;
    if (f === "victoria" || f === "derrota") mostrarFin(this.c, f);
    else ocultarFin();
  }

  private ordenJugadores(): [string, PlayerS][] {
    const out: [string, PlayerS][] = [];
    this.st.jugadores.forEach((p, id) => out.push([id, p]));
    return out.sort((a, b) => ALIEN_KINDS.indexOf(a[1].kind as never) - ALIEN_KINDS.indexOf(b[1].kind as never));
  }

  private dibujarEquipo(): void {
    const g = this.gEquipo.clear();
    let y = 16;
    const vistos = new Set<string>();
    for (const [id, p] of this.ordenJugadores()) {
      vistos.add(id);
      let f = this.filas.get(id);
      if (!f) {
        f = {
          img: this.add.image(0, 0, `retrato_${p.kind}`).setScale(0.2).setOrigin(0.5),
          nombre: this.add.text(0, 0, "", { ...TEXTO, fontSize: "15px" }),
          icono: this.add.image(0, 0, "icono_hielo").setScale(0.6).setVisible(false),
        };
        this.filas.set(id, f);
      }
      const color = COLOR_ALIEN[p.kind] ?? 0xffffff;
      g.fillStyle(0x0a1622, 0.82).fillRoundedRect(16, y, 232, 54, 12).lineStyle(3, color, 0.9).strokeRoundedRect(16, y, 232, 54, 12);
      f.img.setPosition(44, y + 27).setAlpha(p.vivo ? 1 : 0.4);
      const yo = id === this.c.room.sessionId;
      f.nombre.setPosition(72, y + 6).setText(`${p.nombre}${yo ? " (tú)" : ""}${p.conectado ? "" : " ⚠"}`).setColor("#" + color.toString(16));
      const w = 160;
      g.fillStyle(0x000000, 0.8).fillRect(72, y + 32, w, 10);
      if (p.vivo) g.fillStyle(p.hp / p.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a).fillRect(72, y + 32, (w * Math.max(0, p.hp)) / p.maxHp, 10);
      g.lineStyle(2, 0x0a0a0c).strokeRect(72, y + 32, w, 10);
      const icon = !p.vivo ? "icono_calavera" : p.estado === "congelado" ? "icono_hielo" : p.estado === "red" ? "icono_red" : p.almas.length ? "icono_alma" : "";
      f.icono.setVisible(Boolean(icon)).setPosition(232, y + 14);
      if (icon) f.icono.setTexture(icon).setAlpha(p.estado !== "ok" ? 0.6 + 0.4 * Math.sin(this.time.now / 120) : 1);
      y += 62;
    }
    for (const [id, f] of this.filas) {
      if (vistos.has(id)) continue;
      f.img.destroy();
      f.nombre.destroy();
      f.icono.destroy();
      this.filas.delete(id);
    }
  }

  private dibujarPropio(me: PlayerS | undefined, H: number): void {
    const g = this.gPropio.clear();
    for (const i of this.almasIconos) i.setVisible(false);
    if (!me) return;
    const x = 16;
    const y = H - 128;
    const color = COLOR_ALIEN[me.kind] ?? 0xffffff;
    g.fillStyle(0x0a1622, 0.85).fillRoundedRect(x, y, 330, 112, 14).lineStyle(3, color, 1).strokeRoundedRect(x, y, 330, 112, 14);
    // Vida
    g.fillStyle(0x000000, 0.85).fillRect(x + 14, y + 30, 302, 16);
    if (me.vivo) g.fillStyle(me.hp / me.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a).fillRect(x + 14, y + 30, (302 * Math.max(0, me.hp)) / me.maxHp, 16);
    g.lineStyle(2, 0x0a0a0c).strokeRect(x + 14, y + 30, 302, 16);
    this.txtVida.setPosition(x + 14, y + 8).setText(me.vivo ? `${isAlienKind(me.kind) ? ALIENS[me.kind].nombre : me.kind} · Vida ${Math.max(0, Math.round(me.hp))}/${me.maxHp}` : me.fantasma ? "Fantasma" : "Caído");
    // Habilidad
    const hab = me.habilidad as AbilityKind;
    let frac = 1;
    let listo = true;
    let extra = "";
    if (hab === "disfraz") {
      frac = me.energia / DISFRAZ.maxEnergy;
      listo = me.disfrazado || me.energia >= DISFRAZ.minToActivate;
      extra = me.disfrazado ? " · ACTIVO" : "";
    } else {
      const cd = hab === "transmutar" ? TRANSMUTAR.cooldown : TELEQUINESIS.cooldown;
      frac = 1 - Math.min(1, me.enfriamiento / cd);
      listo = me.enfriamiento <= 0;
    }
    g.fillStyle(0x000000, 0.85).fillRect(x + 14, y + 74, 302, 12);
    g.fillStyle(listo ? (hab === "disfraz" && me.disfrazado ? 0x7fb24a : 0x3ef0ff) : 0x5a6a7a).fillRect(x + 14, y + 74, 302 * Math.max(0, Math.min(1, frac)), 12);
    g.lineStyle(2, 0x0a0a0c).strokeRect(x + 14, y + 74, 302, 12);
    this.txtHab.setPosition(x + 14, y + 52).setText(`[ESPACIO] ${ABILITY_NAMES[hab] ?? hab}${extra}${me.confuso > 0 ? " · ¡CONTROLES INVERTIDOS!" : ""}`);
    const almas = me.almas.toArray();
    this.txtAyuda.setPosition(x + 14, y + 90).setText(almas.length ? "Almas: Q cambiar habilidad · G pasar a un compañero" : "E interactuar · 1-4 pings · Enter chat · M mapa · H ayuda");
    almas.forEach((k, i) => {
      let img = this.almasIconos[i];
      if (!img) this.almasIconos.push((img = this.add.image(0, 0, "alma").setScale(0.4)));
      img.setVisible(true).setPosition(x + 300 - i * 26, y + 14).setTint(COLOR_ALIEN[k] ?? 0xffffff);
    });
  }

  private dibujarObjetivo(W: number): number {
    const ancho = Math.min(640, W - 2 * 280);
    const t = this.objetivo.setWordWrapWidth(Math.max(260, ancho)).setText(this.st.objetivo).setPosition(W / 2, 22);
    this.gObjetivo.clear().fillStyle(0x0a1622, 0.78).fillRoundedRect(W / 2 - t.width / 2 - 14, 12, t.width + 28, t.height + 20, 12);
    return 22 + t.height + 14;
  }

  private dibujarPuzzles(W: number, y: number): number {
    const lineas: string[] = [];
    const barras: { frac: number; color: number }[] = [];
    this.st.puzzles.forEach((pz, id) => {
      const def = PUZZLES[id];
      if (pz.estado === "activo") {
        let txt = `${def.nombre}${pz.solo ? " (solo)" : ""} — ${Math.ceil(pz.tiempo)} s`;
        if (id === "p5") {
          let n = 0;
          this.st.objetos.forEach((o) => o.k === "puente" && o.dueno === "p5" && n++);
          txt += ` · puente ${n}/${PUENTE.slots}`;
        }
        lineas.push(txt);
        barras.push({ frac: pz.total ? 1 - pz.tiempo / pz.total : 0, color: 0xffd23e });
      } else if (pz.estado === "bloqueado") {
        lineas.push(`${def.nombre}: bloqueada ${Math.ceil(pz.tiempo)} s`);
        barras.push({ frac: 1 - pz.tiempo / 30, color: 0xff4a4a });
      }
    });
    this.gPuzzles.clear();
    if (!lineas.length) {
      this.puzzlesTxt.setText("");
      return y;
    }
    this.puzzlesTxt.setText(lineas.join("\n")).setPosition(W / 2, y + 4);
    const lh = this.puzzlesTxt.height / lineas.length;
    barras.forEach((b, i) => {
      const by = y + 4 + lh * (i + 1) - 4;
      this.gPuzzles.fillStyle(0x000000, 0.7).fillRect(W / 2 - 120, by, 240, 5).fillStyle(b.color).fillRect(W / 2 - 120, by, 240 * Math.max(0, Math.min(1, b.frac)), 5);
    });
    return y + this.puzzlesTxt.height + 12;
  }

  private dibujarJefe(W: number, y: number, me: PlayerS | undefined): number {
    const g = this.gJefe.clear();
    const jefe = this.st.jefe ? this.st.unidades.get(this.st.jefe) : undefined;
    if (!jefe || !me || dist(me.x, me.y, jefe.x, jefe.y) > 1600) {
      this.jefeTxt.setVisible(false);
      return y;
    }
    const w = Math.min(520, W - 120);
    this.jefeTxt.setVisible(true).setPosition(W / 2, y + 28);
    g.fillStyle(0x000000, 0.8).fillRect(W / 2 - w / 2, y + 32, w, 16);
    g.fillStyle(0xff4a4a).fillRect(W / 2 - w / 2, y + 32, (w * Math.max(0, jefe.hp)) / jefe.maxHp, 16);
    g.lineStyle(3, 0x0a0a0c).strokeRect(W / 2 - w / 2, y + 32, w, 16);
    const cols = [0x3ec0ff, 0x6be04a, 0xa46bff];
    for (let i = 0; i < 3; i++) {
      const roto = i >= jefe.tanques;
      g.fillStyle(roto ? 0x333333 : cols[i], 1).fillRoundedRect(W / 2 + w / 2 + 8 + i * 18, y + 30, 14, 22, 4).lineStyle(2, 0x0a0a0c).strokeRoundedRect(W / 2 + w / 2 + 8 + i * 18, y + 30, 14, 22, 4);
    }
    return y + 58;
  }

  // ------------------------------------------------------------------ minimapa dinámico
  private dibujarMapa(): void {
    const g = this.gMapa.clear();
    const big = this.c.ui.mapaGrande;
    const W = this.scale.width;
    const H = this.scale.height;
    const w = this.c.world;
    let s: number;
    let ox: number;
    let oy: number;
    if (big) {
      s = Math.min((W - 80) / w.w, (H - 80) / w.h, 7);
      ox = W / 2 - (w.w * s) / 2;
      oy = H / 2 - (w.h * s) / 2;
      this.mmBig.setVisible(true).setScale(s).setPosition(W / 2, H / 2);
      this.mm.setVisible(false);
      g.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);
      this.children.bringToTop(this.mmBig);
      this.children.bringToTop(g);
    } else {
      s = this.mmEscala;
      ox = this.mm.x;
      oy = this.mm.y;
      this.mm.setVisible(true);
      this.mmBig.setVisible(false);
      g.lineStyle(3, 0x0a0a0c).strokeRect(ox - 2, oy - 2, w.w * s + 4, w.h * s + 4);
    }
    const P = (x: number, y: number) => [ox + (x / TILE) * s, oy + (y / TILE) * s] as const;
    // Vista de la cámara
    const mundo = this.scene.get("Mundo") as Mundo;
    const v = mundo.cameras.main.worldView;
    const [vx, vy] = P(v.x, v.y);
    g.lineStyle(1.5, 0xffffff, 0.6).strokeRect(vx, vy, (v.width / TILE) * s, (v.height / TILE) * s);
    // Puertas
    for (const o of w.find("door")) {
      const abierta = this.st.puertas.get(o.name)?.abierta;
      const [x, y] = P(o.x, o.y);
      g.fillStyle(abierta ? 0x7dff6a : 0xff4a4a, 1).fillRect(x, y, Math.max(2, (o.w / TILE) * s), Math.max(2, (o.h / TILE) * s));
    }
    // Estaciones
    const colEst: Record<string, number> = { libre: 0x3ef0ff, activo: 0xffd23e, bloqueado: 0xff4a4a, resuelto: 0x7dff6a };
    for (const o of w.find("station")) {
      const pz = this.st.puzzles.get(o.name);
      if (!pz) continue;
      const [x, y] = P(o.x, o.y);
      g.fillStyle(colEst[pz.estado] ?? 0xffffff, pz.estado === "activo" ? 0.5 + 0.5 * Math.sin(this.time.now / 150) : 1).fillCircle(x, y, big ? 6 : 2.5);
    }
    for (const o of [...w.find("lever"), ...w.find("dispenser")]) {
      const [x, y] = P(o.x, o.y);
      g.fillStyle(0x3ef0ff, 1).fillCircle(x, y, big ? 5 : 2);
    }
    // Enemigos cerca de algún alien vivo
    const vivos: PlayerS[] = [];
    this.st.jugadores.forEach((p) => p.vivo && vivos.push(p));
    this.st.unidades.forEach((u) => {
      if (u.team !== "humanos" || !vivos.some((p) => dist(p.x, p.y, u.x, u.y) < 750)) return;
      const [x, y] = P(u.x, u.y);
      g.fillStyle(u.t === "jefe" ? 0xff2020 : 0xff6a6a, 1).fillCircle(x, y, u.t === "jefe" ? (big ? 7 : 3.5) : big ? 3 : 1.4);
    });
    // Almas
    this.st.almas.forEach((a) => {
      const [x, y] = P(a.x, a.y);
      g.fillStyle(0xffffff, 1).fillCircle(x, y, big ? 6 : 3).lineStyle(2, COLOR_ALIEN[a.kind] ?? 0xffffff).strokeCircle(x, y, big ? 6 : 3);
    });
    // Pings
    for (const p of this.c.ui.pings) {
      const [x, y] = P(p.x, p.y);
      g.lineStyle(2, 0xffd23e, 1).strokeCircle(x, y, (big ? 10 : 5) + Math.sin(this.time.now / 120) * 2);
    }
    // Jugadores
    this.st.jugadores.forEach((p, id) => {
      const [x, y] = P(p.x, p.y);
      const r = (big ? 7 : 3.5) * (id === this.c.room.sessionId ? 1.3 : 1);
      g.fillStyle(COLOR_ALIEN[p.kind] ?? 0xffffff, p.vivo ? 1 : 0.4).fillCircle(x, y, r).lineStyle(2, id === this.c.room.sessionId ? 0xffffff : 0x0a0a0c).strokeCircle(x, y, r);
      if (p.estado === "congelado" || p.estado === "red") g.lineStyle(2, 0xffd23e, 0.5 + 0.5 * Math.sin(this.time.now / 100)).strokeCircle(x, y, r + 4);
    });
  }

  // ------------------------------------------------------------------ flechas a compañeros
  private dibujarFlechas(me: PlayerS | undefined): void {
    for (const f of this.flechas) {
      f.f.setVisible(false);
      f.icono.setVisible(false);
      f.txt.setVisible(false);
    }
    if (!me || this.c.ui.mapaGrande) return;
    const mundo = this.scene.get("Mundo") as Mundo;
    const cam = mundo.cameras.main;
    const W = this.scale.width;
    const H = this.scale.height;
    const objetivos: { x: number; y: number; color: number; icono: string; urgente: boolean; etiqueta: string }[] = [];
    this.st.jugadores.forEach((p, id) => {
      if (id === this.c.room.sessionId) return;
      if (p.vivo) {
        const urgente = p.estado === "congelado" || p.estado === "red";
        objetivos.push({ x: p.x, y: p.y, color: COLOR_ALIEN[p.kind] ?? 0xffffff, icono: p.estado === "congelado" ? "icono_hielo" : p.estado === "red" ? "icono_red" : "", urgente, etiqueta: p.nombre });
      }
    });
    this.st.almas.forEach((a) => objetivos.push({ x: a.x, y: a.y, color: COLOR_ALIEN[a.kind] ?? 0xffffff, icono: "icono_alma", urgente: true, etiqueta: `alma de ${a.de}` }));
    for (const p of this.c.ui.pings) objetivos.push({ x: p.x, y: p.y, color: 0xffd23e, icono: `ping_${p.tipo}`, urgente: false, etiqueta: "" });

    objetivos.forEach((o, i) => {
      const sx = (o.x - cam.worldView.x) * cam.zoom;
      const sy = (o.y - 40 - cam.worldView.y) * cam.zoom;
      const margen = 46;
      const dentro = sx > margen && sy > margen && sx < W - margen && sy < H - margen;
      if (dentro && !o.urgente) return;
      let f = this.flechas[i];
      if (!f) {
        f = {
          f: this.add.image(0, 0, "flecha").setScale(0.8),
          icono: this.add.image(0, 0, "icono_hielo").setScale(0.55),
          txt: this.add.text(0, 0, "", { ...TEXTO, fontSize: "12px" }).setOrigin(0.5),
        };
        this.flechas.push(f);
      }
      if (dentro) {
        // Visible pero necesita ayuda: icono parpadeando encima.
        if (o.icono) f.icono.setVisible(true).setTexture(o.icono).setPosition(sx, sy - 50).setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 100)).clearTint();
        return;
      }
      const cx = W / 2;
      const cy = H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((W / 2 - margen) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - margen) / Math.abs(Math.sin(ang) || 1e-6));
      const ax = cx + Math.cos(ang) * k;
      const ay = cy + Math.sin(ang) * k;
      const pulso = o.urgente ? 1 + 0.25 * Math.sin(this.time.now / 90) : 1;
      f.f.setVisible(true).setPosition(ax, ay).setRotation(ang).setTint(o.color).setScale(0.8 * pulso);
      if (o.icono) f.icono.setVisible(true).setTexture(o.icono).setPosition(ax - Math.cos(ang) * 30, ay - Math.sin(ang) * 30).clearTint();
      const m = Math.round(dist(me.x, me.y, o.x, o.y) / TILE);
      f.txt
        .setVisible(true)
        .setPosition(ax - Math.cos(ang) * (o.icono ? 56 : 30), ay - Math.sin(ang) * (o.icono ? 56 : 30))
        .setText(`${o.etiqueta ? o.etiqueta + " · " : ""}${m} m`);
    });
  }

  // ------------------------------------------------------------------ minijuegos
  private gestionarMinijuego(me: PlayerS | undefined): void {
    let want = "";
    let id = "";
    if (me && me.vivo) {
      const pz = me.ocupado ? this.st.puzzles.get(me.ocupado) : undefined;
      const def = me.ocupado ? PUZZLES[me.ocupado] : undefined;
      if (def && pz?.estado === "activo" && ["orbe", "identidad", "tuberias"].includes(def.minijuego)) {
        want = { orbe: "MgOrbe", identidad: "MgIdentidad", tuberias: "MgTuberias" }[def.minijuego as "orbe"];
        id = me.ocupado;
      } else {
        const p6 = this.st.puzzles.get("p6");
        const p4 = this.st.puzzles.get("p4");
        const consola = this.c.world.findOne("station", "p4");
        if (p6?.estado === "activo" && p6.actores.split(",").includes(this.c.room.sessionId)) {
          want = "MgEsclusa";
          id = "p6";
        } else if (p4?.estado === "activo" && consola && me.disfrazado && (me.kind === "cambiaformas" || me.almas.includes("cambiaformas")) && dist(me.x, me.y, consola.x, consola.y) < INTERACT_RANGE * 2) {
          want = "MgRayos";
          id = "p4";
        }
      }
    }
    const clave = want ? `${want}:${id}` : "";
    if (clave === this.mgActual) return;
    if (this.mgActual) this.scene.stop(this.mgActual.split(":")[0]);
    this.mgActual = clave;
    this.c.ui.minijuego = "";
    if (want) {
      this.scene.launch(want, { id });
      this.scene.bringToTop(want);
    }
  }
}
