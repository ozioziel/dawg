// Interfaz sobre el juego: equipo, vida, habilidad, recurso, definitiva, objetivo, retos del
// sector, jefes, compuerta, avisos, minimapa, flechas hacia compañeros/almas y minijuegos.
import { ALIENS, CODIGO_COLORES, TILE, dist, enemyDef, isAlienKind, retoDef, slotDef, type AvisoMsg } from "@dawg/shared";
import Phaser from "phaser";
import type { GameStateS, PlayerS } from "../../net/tipos";
import { mostrarFin, ocultarFin } from "../../ui/fin";
import { PanelMejoras } from "../../ui/mejoras";
import { COLOR_ALIEN, TEXTO, TITULO, ctx, type Ctx } from "../contexto";
import { sfx } from "../sonido";
import type { Mundo } from "./Mundo";

const COLOR_AVISO: Record<string, string> = { info: "#eaf6ff", peligro: "#ff5a5a", exito: "#7dff6a", alma: "#d2b8ff", rescate: "#ffd23e", sector: "#3ef0ff" };
const COLOR_SECTOR = ["#2f6d78", "#3a7896", "#3f8f8a", "#7a7f86"];

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

const NOMBRE_JEFE: Record<string, string> = { jefe: "JEFE DE LABORATORIO", centinela: "CENTINELA MK-II", director: "DIRECTOR KESSLER · OMEGA" };

export class Hud extends Phaser.Scene {
  c!: Ctx;
  private filas = new Map<string, Fila>();
  private gEquipo!: Phaser.GameObjects.Graphics;
  private gPropio!: Phaser.GameObjects.Graphics;
  private txtVida!: Phaser.GameObjects.Text;
  private txtHab!: Phaser.GameObjects.Text;
  private txtBasico!: Phaser.GameObjects.Text;
  private txtCdBasico!: Phaser.GameObjects.Text;
  private txtCdHab!: Phaser.GameObjects.Text;
  /** Destello cuando un enfriamiento termina (clave → hasta cuándo). */
  private listoHasta = new Map<string, number>();
  private estabaListo = new Map<string, boolean>();
  private txtRecurso!: Phaser.GameObjects.Text;
  private txtUlti!: Phaser.GameObjects.Text;
  private txtAyuda!: Phaser.GameObjects.Text;
  private retratoPropio!: Phaser.GameObjects.Image;
  private almasIconos: Phaser.GameObjects.Image[] = [];
  private objetivo!: Phaser.GameObjects.Text;
  private gObjetivo!: Phaser.GameObjects.Graphics;
  private retosTxt!: Phaser.GameObjects.Text;
  private gRetos!: Phaser.GameObjects.Graphics;
  private jefeTxt!: Phaser.GameObjects.Text;
  private gJefe!: Phaser.GameObjects.Graphics;
  private gCodigo!: Phaser.GameObjects.Graphics;
  private codigoTxt!: Phaser.GameObjects.Text;
  private avisos: { t: Phaser.GameObjects.Text; hasta: number }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private mm!: Phaser.GameObjects.Image;
  private mmBig!: Phaser.GameObjects.Image;
  private gMapa!: Phaser.GameObjects.Graphics;
  private flechas: Flecha[] = [];
  private mgActual = "";
  private faseVista = "";
  private ultimoEstado = new Map<string, string>();
  private panelMejoras!: PanelMejoras;
  private mmEscala = 1;

  constructor() {
    super("Hud");
  }

  get st(): GameStateS {
    return this.c.room.state;
  }

  private get movil(): boolean {
    return this.scale.width < 820 || this.c.ui.tactil;
  }

  create(): void {
    this.c = ctx(this);
    this.gEquipo = this.add.graphics();
    this.gPropio = this.add.graphics();
    this.retratoPropio = this.add.image(0, 0, "retrato_cambiaformas").setOrigin(0.5);
    this.txtVida = this.add.text(0, 0, "", { ...TEXTO, fontSize: "16px" });
    this.txtHab = this.add.text(0, 0, "", { ...TEXTO, fontSize: "14px" });
    this.txtBasico = this.add.text(0, 0, "", { ...TEXTO, fontSize: "14px", color: "#ffe2c8" });
    this.txtCdBasico = this.add.text(0, 0, "", { ...TEXTO, fontSize: "12px", color: "#ffb08a" }).setOrigin(1, 0);
    this.txtCdHab = this.add.text(0, 0, "", { ...TEXTO, fontSize: "12px", color: "#9fe8ff" }).setOrigin(1, 0);
    this.txtRecurso = this.add.text(0, 0, "", { ...TEXTO, fontSize: "13px", color: "#cfe6ff" });
    this.txtUlti = this.add.text(0, 0, "", { ...TEXTO, fontSize: "14px", color: "#ffd23e" });
    this.txtAyuda = this.add.text(0, 0, "", { ...TEXTO, fontSize: "12px", color: "#a9c6db", strokeThickness: 3 });
    this.gObjetivo = this.add.graphics();
    this.objetivo = this.add.text(0, 0, "", { ...TEXTO, fontSize: "16px", align: "center" }).setOrigin(0.5, 0);
    this.gRetos = this.add.graphics();
    this.retosTxt = this.add.text(0, 0, "", { ...TEXTO, fontSize: "13px", align: "left", lineSpacing: 6 }).setOrigin(0, 0);
    this.gJefe = this.add.graphics();
    this.jefeTxt = this.add.text(0, 0, "", { ...TITULO, fontSize: "24px", color: "#ff7a5a" }).setOrigin(0.5, 1).setVisible(false);
    this.gCodigo = this.add.graphics();
    this.codigoTxt = this.add.text(0, 0, "", { ...TEXTO, fontSize: "16px", color: "#ffd23e" }).setOrigin(0.5, 0);
    this.prompt = this.add.text(0, 0, "", { ...TEXTO, fontSize: "18px", align: "center", color: "#ffd23e", wordWrap: { width: 760 } }).setOrigin(0.5, 1);
    this.crearMinimapa();
    this.gMapa = this.add.graphics();
    this.panelMejoras = new PanelMejoras(this.c);
    this.events.once("shutdown", () => this.panelMejoras.destruir());
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
    const sectorDe = (x: number) => (x < 112 ? 1 : x < 199 ? 2 : 3);
    for (let cy = 0; cy < w.h; cy++) {
      for (let cx = 0; cx < w.w; cx++) {
        const i = w.idx(cx, cy);
        let col = "";
        if (w.liquid[i]) col = "#6be04a";
        else if (suelo(cx, cy)) col = w.roomAt((cx + 0.5) * TILE, (cy + 0.5) * TILE) ? COLOR_SECTOR[sectorDe(cx)] : "#28505a";
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

  private colocarMinimapa(): void {
    const W = this.scale.width;
    const max = this.movil ? 170 : 300;
    this.mmEscala = Math.min(2, max / this.c.world.w);
    this.mm.setScale(this.mmEscala).setPosition(W - this.c.world.w * this.mmEscala - 12, 12);
  }

  // ------------------------------------------------------------------ avisos
  private aviso(texto: string, tipo: string): void {
    sfx.aviso(tipo);
    const t = this.add
      .text(this.scale.width / 2, 0, texto, { ...TEXTO, fontSize: this.movil ? "14px" : "17px", color: COLOR_AVISO[tipo] ?? "#fff", align: "center", wordWrap: { width: Math.min(720, this.scale.width - 60) } })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.avisos.push({ t, hasta: this.time.now + (tipo === "peligro" || tipo === "alma" || tipo === "rescate" || tipo === "sector" ? 7000 : 5000) });
    while (this.avisos.length > (this.movil ? 3 : 4)) this.avisos.shift()!.t.destroy();
  }

  // ------------------------------------------------------------------ bucle
  override update(): void {
    const st = this.st;
    if (!st) return;
    const me = st.jugadores.get(this.c.room.sessionId);
    const W = this.scale.width;
    const H = this.scale.height;
    const yEquipo = this.dibujarEquipo();
    this.dibujarPropio(me, H, yEquipo);
    let y = this.dibujarObjetivo(W);
    y = this.dibujarJefe(W, y, me);
    y = this.dibujarCodigo(W, y);
    this.dibujarRetos(W);
    // Avisos: en pantallas pequeñas van en la columna libre entre los paneles y el minimapa,
    // o debajo del panel propio si no hay sitio (móvil en vertical).
    let ax = W / 2;
    // Sin pisar el panel de retos (derecha) ni el propio (izquierda)
    let aw = Math.max(300, Math.min(720, W - 640));
    if (this.movil) {
      const izq = 272;
      const der = W - 200;
      if (der - izq >= 240) {
        ax = (izq + der) / 2;
        aw = der - izq;
      } else y = Math.max(y, yEquipo + 136);
    } else if (W < 1180) y = Math.max(y, yEquipo + 4);
    const now = this.time.now;
    this.avisos = this.avisos.filter((a) => {
      if (now > a.hasta) {
        a.t.destroy();
        return false;
      }
      return true;
    });
    for (const a of this.avisos) {
      if (a.t.style.wordWrapWidth !== aw) a.t.setWordWrapWidth(aw);
      a.t.setPosition(ax, y + 6);
      if (a.hasta - now < 600) a.t.setAlpha((a.hasta - now) / 600);
      y += a.t.height + 4;
    }
    this.prompt
      .setPosition(W / 2, H - (this.c.ui.tactil ? 170 : 22))
      .setFontSize(this.movil ? 14 : 18)
      .setWordWrapWidth(Math.min(760, W - 40))
      .setText(this.c.ui.minijuego ? "" : this.c.ui.prompt);
    this.dibujarMapa();
    this.dibujarFlechas(me);
    this.gestionarMinijuego(me);
    this.revisarFase();
    this.avisosDeEstado();
    this.panelMejoras.actualizar(me);
  }

  private avisosDeEstado(): void {
    this.st.jugadores.forEach((p, id) => {
      const prev = this.ultimoEstado.get(id) ?? "ok";
      if (prev !== p.estado && (p.estado === "congelado" || p.estado === "red" || p.estado === "agarrado")) sfx.aviso("rescate");
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
    return out;
  }

  private barraTerminal(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, segmentos = 10): void {
    const p = Phaser.Math.Clamp(frac, 0, 1);
    g.fillStyle(0x010503, 0.96).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 2);
    g.lineStyle(1.5, 0x6fbd65, 0.9).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 2);
    g.fillStyle(color, 1).fillRoundedRect(x, y, w * p, h, 1);
    if (p > 0) g.fillStyle(0xffffff, 0.34).fillRect(x, y, w * p, 2);
    for (let i = 1; i < segmentos; i++) {
      const sx = x + (w * i) / segmentos;
      g.lineStyle(1, 0x031108, 0.75).lineBetween(sx, y, sx, y + h);
    }
  }

  private dibujarEquipo(): number {
    const g = this.gEquipo.clear();
    const compacto = this.movil;
    const ancho = compacto ? 190 : 258;
    const alto = compacto ? 46 : 62;
    let y = 12;
    const vistos = new Set<string>();
    for (const [id, p] of this.ordenJugadores()) {
      vistos.add(id);
      let f = this.filas.get(id);
      if (!f) {
        f = {
          img: this.add.image(0, 0, `retrato_${p.forma}`).setOrigin(0.5),
          nombre: this.add.text(0, 0, "", { ...TEXTO, fontSize: "14px", strokeThickness: 4 }),
          icono: this.add.image(0, 0, "icono_hielo").setScale(0.5).setVisible(false),
        };
        this.filas.set(id, f);
      }
      const color = COLOR_ALIEN[p.forma] ?? 0xffffff;
      g.fillStyle(0x000000, 0.82).fillRoundedRect(17, y + 5, ancho, alto, 3);
      g.fillStyle(0x031008, 0.94).fillRoundedRect(12, y, ancho, alto, 3).lineStyle(2, color, 1).strokeRoundedRect(12, y, ancho, alto, 3);
      g.lineStyle(1, 0x7dff6a, 0.2).lineBetween(16, y + 4, 12 + ancho - 4, y + 4);
      const foto = alto - 8;
      g.fillStyle(0x000000, 0.9).fillRoundedRect(16, y + 4, foto, foto, 2).lineStyle(2, 0x7dff6a, 0.65).strokeRoundedRect(16, y + 4, foto, foto, 2);
      if (this.textures.exists(`retrato_${p.forma}`)) f.img.setTexture(`retrato_${p.forma}`);
      f.img.setDisplaySize(foto - 4, foto - 4).setPosition(16 + foto / 2, y + 4 + foto / 2).setAlpha(p.vivo ? 1 : 0.4);
      const yo = id === this.c.room.sessionId;
      const formaTxt = p.forma !== p.kind && isAlienKind(p.forma) ? ` → ${ALIENS[p.forma].nombre}` : "";
      f.nombre
        .setPosition(12 + alto + 2, y + 3)
        .setFontSize(compacto ? 12 : 14)
        .setText(`${p.nombre}${yo ? " (tú)" : ""}${p.conectado ? "" : " ⚠"}${formaTxt}`)
        .setColor("#" + color.toString(16).padStart(6, "0"));
      const bx = 12 + alto + 3;
      const bw = ancho - alto - 13;
      const by = y + alto - (compacto ? 13 : 16);
      this.barraTerminal(g, bx, by, bw, compacto ? 7 : 9, p.vivo ? p.hp / p.maxHp : 0, p.hp / p.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a, 10);
      if (p.ulti >= 1) g.fillStyle(0xffd23e).fillCircle(12 + ancho - 10, y + 10, 5);
      const icon = !p.vivo ? "icono_calavera" : p.estado === "congelado" ? "icono_hielo" : p.estado === "red" ? "icono_red" : p.estado === "agarrado" ? "icono_agarre" : p.almas.length ? "icono_alma" : "";
      f.icono.setVisible(Boolean(icon)).setPosition(12 + ancho - 26, y + alto / 2);
      if (icon) f.icono.setTexture(icon).setAlpha(p.estado !== "ok" ? 0.6 + 0.4 * Math.sin(this.time.now / 120) : 1);
      y += alto + 6;
    }
    for (const [id, f] of this.filas) {
      if (vistos.has(id)) continue;
      f.img.destroy();
      f.nombre.destroy();
      f.icono.destroy();
      this.filas.delete(id);
    }
    return y;
  }

  /** Barra de enfriamiento que se vacía al usarse y se rellena hasta estar lista (con destello al volver). */
  private barraCd(g: Phaser.GameObjects.Graphics, clave: string, x: number, y: number, w: number, h: number, restante: number, total: number, colListo: number, colCarga: number): void {
    const listo = restante <= 0.001;
    const frac = listo || total <= 0 ? 1 : 1 - Math.min(1, restante / total);
    const now = this.time.now;
    if (listo && this.estabaListo.get(clave) === false) this.listoHasta.set(clave, now + 350);
    this.estabaListo.set(clave, listo);
    g.fillStyle(0x000000, 0.85).fillRect(x, y, w, h);
    g.fillStyle(listo ? colListo : colCarga, 1).fillRect(x, y, w * frac, h);
    if (!listo) g.fillStyle(0xffffff, 0.85).fillRect(x + w * frac - 2, y, 2, h);
    const destello = (this.listoHasta.get(clave) ?? 0) - now;
    if (destello > 0) g.fillStyle(0xffffff, (destello / 350) * 0.8).fillRect(x - 2, y - 2, w + 4, h + 4);
    g.lineStyle(1, 0x000000, 0.9).strokeRect(x, y, w, h);
  }

  private dibujarPropio(me: PlayerS | undefined, H: number, yEquipo: number): void {
    const g = this.gPropio.clear();
    for (const i of this.almasIconos) i.setVisible(false);
    const ocultar = !me;
    for (const t of [this.txtVida, this.txtHab, this.txtBasico, this.txtCdBasico, this.txtCdHab, this.txtRecurso, this.txtUlti, this.txtAyuda, this.retratoPropio]) t.setVisible(!ocultar);
    if (!me) return;
    const compacto = this.movil;
    const w = compacto ? 278 : 370;
    const h = compacto ? 146 : 184;
    const x = 12;
    const y = compacto ? yEquipo + 2 : H - h - 12;
    const forma = isAlienKind(me.forma) ? ALIENS[me.forma] : undefined;
    const color = COLOR_ALIEN[me.forma] ?? 0xffffff;
    g.fillStyle(0x000000, 0.86).fillRoundedRect(x + 5, y + 5, w, h, 4);
    g.fillStyle(0x031008, 0.95).fillRoundedRect(x, y, w, h, 4).lineStyle(3, color, 1).strokeRoundedRect(x, y, w, h, 4);
    g.fillStyle(0x7dff6a, 0.25).fillRect(x + 8, y + 6, w - 16, 2);
    const rr = compacto ? 52 : 72;
    g.fillStyle(0x000000, 0.9).fillRoundedRect(x + 7, y + 9, rr + 2, rr + 2, 2).lineStyle(2, 0x9bff85, 0.9).strokeRoundedRect(x + 7, y + 9, rr + 2, rr + 2, 2);
    if (this.textures.exists(`retrato_${me.forma}`)) this.retratoPropio.setTexture(`retrato_${me.forma}`);
    this.retratoPropio.setDisplaySize(rr - 4, rr - 4).setPosition(x + 8 + rr / 2, y + 10 + rr / 2);
    const tx = x + rr + 17;
    const bw = w - (tx - x) - 12;
    const fs = compacto ? 11 : 13;
    const paso = compacto ? 22 : 27;
    const prestada = me.forma !== me.kind ? ` (alma)` : "";
    // Vida
    this.txtVida
      .setPosition(tx, y + 6)
      .setFontSize(compacto ? 13 : 15)
      .setText(me.vivo ? `${forma?.nombre ?? me.forma}${prestada} · ${Math.max(0, Math.round(me.hp))}/${me.maxHp}` : me.fantasma ? "Fantasma" : "Caído");
    const vy = y + (compacto ? 24 : 28);
    this.barraTerminal(g, tx, vy, bw, 10, me.vivo ? me.hp / me.maxHp : 0, me.hp / me.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a, 12);
    if (me.escudo > 0) g.fillStyle(0xc08bff, 0.9).fillRect(tx, vy - 4, Math.min(bw, me.escudo * 2), 3);
    const seg = (t: number) => (t > 0.05 ? `${t.toFixed(t < 10 ? 1 : 0)} s` : "");
    // Ataque básico (se vacía al usarse y se recarga)
    const by = vy + (compacto ? 14 : 16);
    const berserk = me.forma === "cambiaformas" && me.ultiT > 0;
    const nombreBasico = berserk ? "Garras berserk" : forma?.ataque.nombre ?? "Ataque";
    this.txtBasico.setPosition(tx, by).setFontSize(fs).setText(`${this.c.ui.tactil ? "" : "[CLIC] "}${nombreBasico}`);
    this.txtCdBasico.setPosition(tx + bw, by).setFontSize(fs - 1).setText(seg(me.cdBasico));
    this.barraCd(g, "basico", tx, by + fs + 4, bw, 6, me.cdBasico, me.cdBasicoMax, 0xffb26a, 0x8a4a2a);
    // Habilidad
    const hy = by + paso;
    const tecla = this.c.ui.tactil ? "" : "[ESPACIO] ";
    this.txtHab.setPosition(tx, hy).setFontSize(fs).setText(`${tecla}${forma?.habilidad.nombre ?? ""}${me.confuso > 0 ? " · ¡INVERTIDO!" : ""}`);
    this.txtCdHab.setPosition(tx + bw, hy).setFontSize(fs - 1).setText(seg(me.enfriamiento));
    this.barraCd(g, "hab", tx, hy + fs + 4, bw, 6, me.enfriamiento, me.enfMax, 0x3ef0ff, 0x2a5a6a);
    // Recurso propio
    const ry = hy + paso;
    const recurso = this.recurso(me);
    this.txtRecurso.setPosition(tx, ry).setFontSize(compacto ? 10 : 12).setText(recurso.txt);
    if (recurso.frac >= 0) g.fillStyle(0x000000, 0.8).fillRect(tx + bw * 0.55, ry + 4, bw * 0.45, 6).fillStyle(recurso.color).fillRect(tx + bw * 0.55, ry + 4, bw * 0.45 * recurso.frac, 6);
    // Definitiva
    const uy = ry + (compacto ? 16 : 20);
    const uf = me.ultiT > 0 ? me.ultiT / Math.max(0.1, me.ultiMax) : me.ulti;
    this.barraTerminal(g, tx, uy + fs + 4, bw, 7, uf, me.ultiT > 0 ? 0xff8a3a : me.ulti >= 1 ? 0xffd23e : 0x8a7a3a, 14);
    if (me.ulti >= 1 && me.ultiT <= 0) g.lineStyle(2, 0xffd23e, 0.5 + 0.5 * Math.sin(this.time.now / 140)).strokeRect(tx - 2, uy + fs + 2, bw + 4, 11);
    const listo = me.ulti >= 1 ? "¡LISTA!" : `${Math.floor(me.ulti * 100)}%`;
    this.txtUlti.setPosition(tx, uy).setFontSize(fs).setText(`${this.c.ui.tactil ? "" : "[R] "}${forma?.ulti.nombre ?? ""} · ${me.ultiT > 0 ? "ACTIVA" : me.tunel === 1 ? "marca la salida" : listo}`);
    const almas = me.almas.toArray();
    this.txtAyuda
      .setPosition(x + 10, y + h - 16)
      .setVisible(!compacto)
      .setText(almas.length ? "Almas: Q cambiar de forma · G pasar a un compañero" : "E interactuar · 1-4 pings · Enter chat · M mapa · H ayuda");
    almas.forEach((k, i) => {
      let img = this.almasIconos[i];
      if (!img) this.almasIconos.push((img = this.add.image(0, 0, "alma").setScale(0.35)));
      img.setVisible(true).setPosition(x + w - 16 - i * 22, y + h - 14).setTint(COLOR_ALIEN[k] ?? 0xffffff);
    });
  }

  private recurso(me: PlayerS): { txt: string; frac: number; color: number } {
    switch (me.forma) {
      case "cambiaformas": {
        const ident = me.identidad ? enemyDef(me.identidad)?.nombre ?? me.identidad : "sin identidad";
        if (me.ultiT > 0) return { txt: "Mutación Berserk", frac: -1, color: 0 };
        return { txt: me.disfrazado ? `Disfraz: ${ident} · sospecha` : `Identidad: ${ident}`, frac: me.disfrazado ? me.sospecha : me.energia / 100, color: me.disfrazado ? (me.sospecha > 0.6 ? 0xff4a4a : 0xffd23e) : 0x7fb24a };
      }
      case "inteligente":
        return { txt: me.controla ? "Controlando a un guardia · psique" : "Energía psíquica", frac: me.energia / 100, color: 0xc08bff };
      case "escarabajo":
        return { txt: me.bajoTierra ? "Bajo tierra · excavación" : "Excavación", frac: me.energia / 100, color: 0xa8c84a };
      case "curandera":
        return { txt: me.cautivo ? `Cautivo: ${enemyDef(me.cautivo)?.nombre ?? me.cautivo} (habilidad = digerir)` : "Boca vacía", frac: -1, color: 0 };
      case "simbionte":
        return { txt: `Colonia: ${me.colonia} huésped${me.colonia === 1 ? "" : "es"}`, frac: -1, color: 0 };
      case "vesper":
        return { txt: me.punal > 0 ? "¡Puñalada preparada!" : "Ataca por la espalda", frac: me.punal > 0 ? me.punal / 3 : -1, color: 0x9a7cff };
      case "delmar":
        return { txt: "Transmutaciones: máx. 3 a la vez", frac: -1, color: 0 };
      default:
        return { txt: me.disparando ? "Chorro de hielo" : "", frac: -1, color: 0 };
    }
  }

  private dibujarObjetivo(W: number): number {
    const lado = this.movil ? 190 : 260;
    const ancho = Math.max(220, Math.min(640, W - 2 * lado - 20));
    const t = this.objetivo.setFontSize(this.movil ? 12 : 15).setWordWrapWidth(ancho).setText(this.st.objetivo).setPosition(W / 2, 14);
    this.gObjetivo.clear().fillStyle(0x0a1622, 0.8).fillRoundedRect(W / 2 - t.width / 2 - 12, 6, t.width + 24, t.height + 16, 12);
    let y = 14 + t.height + 10;
    // Compuerta (sector III)
    if (this.st.sector === 3 && this.st.compuerta > 0) {
      const w = Math.min(420, W - 120);
      this.gObjetivo.fillStyle(0x000000, 0.8).fillRect(W / 2 - w / 2, y, w, 12).fillStyle(0xffd23e).fillRect(W / 2 - w / 2, y, w * this.st.compuerta, 12).lineStyle(2, 0x0a0a0c).strokeRect(W / 2 - w / 2, y, w, 12);
      this.gObjetivo.lineStyle(2, 0xff4a4a).lineBetween(W / 2 - w / 2 + w * 0.7, y - 2, W / 2 - w / 2 + w * 0.7, y + 14);
      y += 18;
    }
    if (this.st.eclipse > 0) {
      this.gObjetivo.fillStyle(0x7a5cff, 0.9).fillRoundedRect(W / 2 - 70, y, 140, 18, 6);
      y += 22;
    }
    return y;
  }

  private dibujarRetos(W: number): void {
    const g = this.gRetos.clear();
    const lineas: string[] = [];
    const barras: { frac: number; color: number }[] = [];
    let plan: { sectores: { s: number; id: string; sala: string; comp: string }[] } | null = null;
    try {
      plan = this.st.plan ? JSON.parse(this.st.plan) : null;
    } catch {
      plan = null;
    }
    const ps = plan?.sectores.find((s) => s.s === this.st.sector);
    if (ps) lineas.push(`PROTOCOLO ${ps.id} · «${ps.sala}»`);
    this.st.retos.forEach((r) => {
      const s = slotDef(r.slot);
      if (!s || s.sector !== this.st.sector) return;
      const def = retoDef(r.def);
      if (!def) return;
      const quien = def.requiere.length ? def.requiere.map((k) => ALIENS[k].letra).join("+") : "todos";
      const estado = r.estado === "resuelto" ? "✔" : r.estado === "bloqueado" ? `⛔ ${Math.ceil(r.tiempo)}s` : r.estado === "activo" ? `${Math.round(r.progreso * 100)}%` : "";
      lineas.push(`${r.estado === "resuelto" ? "✔" : "•"} ${def.nombre} [${quien}] ${estado}`);
      barras.push({ frac: r.estado === "resuelto" ? 1 : r.progreso, color: r.estado === "bloqueado" ? 0xff4a4a : r.estado === "resuelto" ? 0x7dff6a : 0xffd23e });
    });
    if (!lineas.length || this.movil) {
      this.retosTxt.setText("");
      return;
    }
    const x = W - 300;
    const y = this.mm.y + this.c.world.h * this.mmEscala + 10;
    this.retosTxt.setPosition(x + 10, y + 6).setText(lineas.join("\n")).setWordWrapWidth(280);
    g.fillStyle(0x0a1622, 0.78).fillRoundedRect(x, y, 292, this.retosTxt.height + 12, 10);
    const lh = this.retosTxt.height / lineas.length;
    barras.forEach((b, i) => {
      const by = y + 6 + lh * (i + 2) - 5;
      g.fillStyle(0x000000, 0.6).fillRect(x + 22, by, 250, 3).fillStyle(b.color).fillRect(x + 22, by, 250 * Math.max(0, Math.min(1, b.frac)), 3);
    });
    this.children.bringToTop(this.retosTxt);
  }

  private dibujarJefe(W: number, y: number, me: PlayerS | undefined): number {
    const g = this.gJefe.clear();
    const jefe = this.st.jefe ? this.st.unidades.get(this.st.jefe) : undefined;
    if (!jefe || !me || dist(me.x, me.y, jefe.x, jefe.y) > 1800) {
      this.jefeTxt.setVisible(false);
      return y;
    }
    const w = Math.min(520, W - 120);
    this.jefeTxt
      .setVisible(true)
      .setText(NOMBRE_JEFE[jefe.t] ?? "JEFE")
      .setFontSize(this.movil ? 18 : 24)
      .setPosition(W / 2, y + 26);
    const colorJefe = jefe.blindado || (jefe.t === "jefe" && jefe.tanques > 0) || (jefe.t === "centinela" && jefe.st !== "enfriado") ? 0x8aa0c0 : 0xff4a4a;
    g.fillStyle(0x000000, 0.85).fillRoundedRect(W / 2 - w / 2 - 7, y + 23, w + 14, 28, 3);
    this.barraTerminal(g, W / 2 - w / 2, y + 30, w, 14, jefe.hp / jefe.maxHp, colorJefe, 18);
    if (jefe.t === "jefe") {
      const cols = [0x3ec0ff, 0x6be04a, 0xa46bff];
      for (let i = 0; i < 3; i++) g.fillStyle(i >= jefe.tanques ? 0x333333 : cols[i], 1).fillRoundedRect(W / 2 + w / 2 + 8 + i * 18, y + 26, 14, 22, 4);
    } else if (jefe.t === "centinela") {
      // Calor: por encima de la marca, las válvulas lo enfrían
      g.fillStyle(0x000000, 0.8).fillRect(W / 2 - w / 2, y + 48, w, 6).fillStyle(jefe.st === "enfriado" ? 0x3ec0ff : 0xff8a3a).fillRect(W / 2 - w / 2, y + 48, w * Math.min(1, jefe.stT), 6);
      g.lineStyle(2, 0xffffff).lineBetween(W / 2 - w / 2 + w * 0.7, y + 46, W / 2 - w / 2 + w * 0.7, y + 56);
      return y + 62;
    } else if (jefe.t === "director") {
      let pilones = 0;
      this.st.unidades.forEach((u) => u.t === "pilon" && pilones++);
      for (let i = 0; i < pilones; i++) g.fillStyle(0xffd23e).fillRoundedRect(W / 2 + w / 2 + 8 + i * 14, y + 26, 10, 22, 3);
    }
    return y + 54;
  }

  /** Código de la consola del inspector (solo lo ve el Cambiaformas que la leyó). */
  private dibujarCodigo(W: number, y: number): number {
    const g = this.gCodigo.clear();
    const c = this.c.ui.codigo;
    if (!c || performance.now() > c.hasta) {
      this.codigoTxt.setText("");
      return y;
    }
    const n = c.codigo.length;
    this.codigoTxt.setText("CÓDIGO DE LA CONSOLA (memorízalo)").setPosition(W / 2, y + 4);
    g.fillStyle(0x0a1622, 0.9).fillRoundedRect(W / 2 - n * 34 - 10, y, n * 68 + 20, 86, 12);
    c.codigo.forEach((k, i) => {
      const col = Phaser.Display.Color.HexStringToColor(CODIGO_COLORES[k].color).color;
      g.fillStyle(col, 1).fillRoundedRect(W / 2 - n * 34 + i * 68 + 6, y + 30, 56, 46, 8).lineStyle(3, 0x0a0a0c).strokeRoundedRect(W / 2 - n * 34 + i * 68 + 6, y + 30, 56, 46, 8);
    });
    return y + 92;
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
      s = Math.min((W - 60) / w.w, (H - 60) / w.h, 6);
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
    const mundo = this.scene.get("Mundo") as Mundo;
    const v = mundo.cameras.main.worldView;
    const [vx, vy] = P(v.x, v.y);
    g.lineStyle(1.5, 0xffffff, 0.6).strokeRect(vx, vy, (v.width / TILE) * s, (v.height / TILE) * s);
    for (const o of w.find("door")) {
      const d = this.st.puertas.get(o.name);
      const [x, y] = P(o.x, o.y);
      g.fillStyle(d?.abierta ? 0x7dff6a : d?.sellada ? 0x553333 : 0xff4a4a, 1).fillRect(x, y, Math.max(2, (o.w / TILE) * s), Math.max(2, (o.h / TILE) * s));
    }
    // Retos del sector actual
    const colEst: Record<string, number> = { libre: 0x3ef0ff, activo: 0xffd23e, bloqueado: 0xff4a4a, resuelto: 0x7dff6a };
    this.st.retos.forEach((r) => {
      const so = w.findOne("slot", r.slot);
      if (!so || r.estado === "inactivo") return;
      const [x, y] = P(so.x + so.w / 2, so.y + so.h / 2);
      g.fillStyle(colEst[r.estado] ?? 0xffffff, r.estado === "activo" ? 0.5 + 0.5 * Math.sin(this.time.now / 150) : 1).fillCircle(x, y, big ? 7 : 2.5);
    });
    const vivos: PlayerS[] = [];
    this.st.jugadores.forEach((p) => p.vivo && vivos.push(p));
    this.st.unidades.forEach((u) => {
      if (u.team !== "humanos" || !vivos.some((p) => dist(p.x, p.y, u.x, u.y) < 750)) return;
      const [x, y] = P(u.x, u.y);
      const jefe = enemyDef(u.t)?.rango === "jefe";
      g.fillStyle(jefe ? 0xff2020 : 0xff6a6a, 1).fillCircle(x, y, jefe ? (big ? 7 : 3.5) : big ? 3 : 1.2);
    });
    this.st.almas.forEach((a) => {
      const [x, y] = P(a.x, a.y);
      g.fillStyle(0xffffff, 1).fillCircle(x, y, big ? 6 : 2.5).lineStyle(2, COLOR_ALIEN[a.kind] ?? 0xffffff).strokeCircle(x, y, big ? 6 : 2.5);
    });
    for (const p of this.c.ui.pings) {
      const [x, y] = P(p.x, p.y);
      g.lineStyle(2, 0xffd23e, 1).strokeCircle(x, y, (big ? 10 : 4) + Math.sin(this.time.now / 120) * 2);
    }
    this.st.jugadores.forEach((p, id) => {
      const [x, y] = P(p.x, p.y);
      const r = (big ? 7 : 3) * (id === this.c.room.sessionId ? 1.3 : 1);
      g.fillStyle(COLOR_ALIEN[p.forma] ?? 0xffffff, p.vivo ? 1 : 0.4).fillCircle(x, y, r).lineStyle(2, id === this.c.room.sessionId ? 0xffffff : 0x0a0a0c).strokeCircle(x, y, r);
      if (p.estado !== "ok" && p.vivo) g.lineStyle(2, 0xffd23e, 0.5 + 0.5 * Math.sin(this.time.now / 100)).strokeCircle(x, y, r + 4);
    });
  }

  // ------------------------------------------------------------------ flechas
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
      if (id === this.c.room.sessionId || !p.vivo) return;
      const urgente = p.estado === "congelado" || p.estado === "red" || p.estado === "agarrado";
      objetivos.push({ x: p.x, y: p.y, color: COLOR_ALIEN[p.forma] ?? 0xffffff, icono: p.estado === "congelado" ? "icono_hielo" : p.estado === "red" ? "icono_red" : p.estado === "agarrado" ? "icono_agarre" : "", urgente, etiqueta: p.nombre });
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
        f = { f: this.add.image(0, 0, "flecha").setScale(0.8), icono: this.add.image(0, 0, "icono_hielo").setScale(0.55), txt: this.add.text(0, 0, "", { ...TEXTO, fontSize: "12px" }).setOrigin(0.5) };
        this.flechas.push(f);
      }
      if (dentro) {
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
      const r = me.ocupado ? this.st.retos.get(me.ocupado) : undefined;
      const def = r ? retoDef(r.def) : undefined;
      const escenas: Record<string, string> = { memoria: "MgMemoria", cara: "MgCara", transmutacion: "MgTransmutacion", codigo: "MgCodigo", ritmo: "MgRitmo" };
      if (r && def?.minijuego && escenas[def.minijuego] && r.estado !== "resuelto") {
        want = escenas[def.minijuego];
        id = me.ocupado;
      } else {
        this.st.retos.forEach((rr, slot) => {
          if (want || rr.estado !== "activo") return;
          if (rr.def === "l-valvulas" && rr.actores.split(",").includes(this.c.room.sessionId)) {
            want = "MgValvulas";
            id = slot;
          } else if (rr.def === "l-rayos" && rr.datos && me.forma === "cambiaformas" && me.disfrazado) {
            let consola: { x: number; y: number } | null = null;
            this.st.pz.forEach((o) => o.reto === slot && o.k === "estacion" && (consola = o));
            if (consola && dist(me.x, me.y, (consola as { x: number }).x, (consola as { y: number }).y) < 220) {
              want = "MgRayos";
              id = slot;
            }
          }
        });
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
