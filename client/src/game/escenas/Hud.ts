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
    let aw = Math.min(720, W - 60);
    if (this.movil) {
      const izq = 272;
      const der = W - 200;
      if (der - izq >= 240) {
        ax = (izq + der) / 2;
        aw = der - izq;
      } else y = Math.max(y, yEquipo + 112);
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

  private dibujarEquipo(): number {
    const g = this.gEquipo.clear();
    const compacto = this.movil;
    const ancho = compacto ? 170 : 232;
    const alto = compacto ? 36 : 50;
    let y = 12;
    const vistos = new Set<string>();
    for (const [id, p] of this.ordenJugadores()) {
      vistos.add(id);
      let f = this.filas.get(id);
      if (!f) {
        f = {
          img: this.add.image(0, 0, `retrato_${p.forma}`).setOrigin(0.5),
          nombre: this.add.text(0, 0, "", { ...TEXTO, fontSize: "14px" }),
          icono: this.add.image(0, 0, "icono_hielo").setScale(0.5).setVisible(false),
        };
        this.filas.set(id, f);
      }
      const color = COLOR_ALIEN[p.forma] ?? 0xffffff;
      g.fillStyle(0x0a1622, 0.82).fillRoundedRect(12, y, ancho, alto, 10).lineStyle(3, color, 0.9).strokeRoundedRect(12, y, ancho, alto, 10);
      if (this.textures.exists(`retrato_${p.forma}`)) f.img.setTexture(`retrato_${p.forma}`);
      f.img.setDisplaySize(alto - 8, alto - 8).setPosition(12 + alto / 2, y + alto / 2).setAlpha(p.vivo ? 1 : 0.4);
      const yo = id === this.c.room.sessionId;
      const formaTxt = p.forma !== p.kind && isAlienKind(p.forma) ? ` → ${ALIENS[p.forma].nombre}` : "";
      f.nombre
        .setPosition(12 + alto + 2, y + 3)
        .setFontSize(compacto ? 12 : 14)
        .setText(`${p.nombre}${yo ? " (tú)" : ""}${p.conectado ? "" : " ⚠"}${formaTxt}`)
        .setColor("#" + color.toString(16).padStart(6, "0"));
      const bw = ancho - alto - 12;
      const by = y + alto - (compacto ? 12 : 16);
      g.fillStyle(0x000000, 0.8).fillRect(12 + alto + 2, by, bw, compacto ? 7 : 9);
      if (p.vivo) g.fillStyle(p.hp / p.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a).fillRect(12 + alto + 2, by, (bw * Math.max(0, p.hp)) / p.maxHp, compacto ? 7 : 9);
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

  private dibujarPropio(me: PlayerS | undefined, H: number, yEquipo: number): void {
    const g = this.gPropio.clear();
    for (const i of this.almasIconos) i.setVisible(false);
    const ocultar = !me;
    for (const t of [this.txtVida, this.txtHab, this.txtRecurso, this.txtUlti, this.txtAyuda, this.retratoPropio]) t.setVisible(!ocultar);
    if (!me) return;
    const compacto = this.movil;
    const w = compacto ? 250 : 340;
    const h = compacto ? 104 : 132;
    const x = 12;
    const y = compacto ? yEquipo + 2 : H - h - 12;
    const forma = isAlienKind(me.forma) ? ALIENS[me.forma] : undefined;
    const color = COLOR_ALIEN[me.forma] ?? 0xffffff;
    g.fillStyle(0x0a1622, 0.86).fillRoundedRect(x, y, w, h, 14).lineStyle(3, color, 1).strokeRoundedRect(x, y, w, h, 14);
    const rr = compacto ? 34 : 46;
    if (this.textures.exists(`retrato_${me.forma}`)) this.retratoPropio.setTexture(`retrato_${me.forma}`);
    this.retratoPropio.setDisplaySize(rr, rr).setPosition(x + 8 + rr / 2, y + 8 + rr / 2);
    const tx = x + rr + 16;
    const bw = w - (tx - x) - 12;
    const prestada = me.forma !== me.kind ? ` (alma)` : "";
    this.txtVida
      .setPosition(tx, y + 6)
      .setFontSize(compacto ? 13 : 15)
      .setText(me.vivo ? `${forma?.nombre ?? me.forma}${prestada} · ${Math.max(0, Math.round(me.hp))}/${me.maxHp}` : me.fantasma ? "Fantasma" : "Caído");
    g.fillStyle(0x000000, 0.85).fillRect(tx, y + (compacto ? 24 : 28), bw, 10);
    if (me.vivo) g.fillStyle(me.hp / me.maxHp > 0.35 ? 0x7dff6a : 0xff4a4a).fillRect(tx, y + (compacto ? 24 : 28), (bw * Math.max(0, me.hp)) / me.maxHp, 10);
    if (me.escudo > 0) g.fillStyle(0xc08bff, 0.8).fillRect(tx, y + (compacto ? 21 : 25), Math.min(bw, me.escudo * 2), 3);
    // Habilidad
    const hy = y + (compacto ? 38 : 44);
    const frac = me.enfMax > 0 ? 1 - Math.min(1, me.enfriamiento / me.enfMax) : 1;
    g.fillStyle(0x000000, 0.85).fillRect(tx, hy + 16, bw, 7).fillStyle(me.enfriamiento <= 0 ? 0x3ef0ff : 0x5a6a7a).fillRect(tx, hy + 16, bw * frac, 7);
    const tecla = this.c.ui.tactil ? "" : "[ESPACIO] ";
    this.txtHab.setPosition(tx, hy).setFontSize(compacto ? 11 : 13).setText(`${tecla}${forma?.habilidad.nombre ?? ""}${me.confuso > 0 ? " · ¡INVERTIDO!" : ""}`);
    // Recurso propio
    const recurso = this.recurso(me);
    this.txtRecurso.setPosition(tx, hy + 26).setFontSize(compacto ? 11 : 12).setText(recurso.txt);
    if (recurso.frac >= 0) g.fillStyle(0x000000, 0.8).fillRect(tx + bw * 0.55, hy + 30, bw * 0.45, 6).fillStyle(recurso.color).fillRect(tx + bw * 0.55, hy + 30, bw * 0.45 * recurso.frac, 6);
    // Definitiva
    const uy = hy + (compacto ? 42 : 46);
    const uf = me.ultiT > 0 ? me.ultiT / Math.max(0.1, me.ultiMax) : me.ulti;
    g.fillStyle(0x000000, 0.85).fillRect(tx, uy + 16, bw, 7).fillStyle(me.ultiT > 0 ? 0xff8a3a : me.ulti >= 1 ? 0xffd23e : 0x8a7a3a).fillRect(tx, uy + 16, bw * Math.min(1, uf), 7);
    const listo = me.ulti >= 1 ? "¡LISTA!" : `${Math.floor(me.ulti * 100)}%`;
    this.txtUlti.setPosition(tx, uy).setFontSize(compacto ? 11 : 13).setText(`${this.c.ui.tactil ? "" : "[R] "}${forma?.ulti.nombre ?? ""} · ${me.ultiT > 0 ? "ACTIVA" : me.tunel === 1 ? "marca la salida" : listo}`);
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
    g.fillStyle(0x000000, 0.8).fillRect(W / 2 - w / 2, y + 30, w, 14);
    g.fillStyle(jefe.blindado || (jefe.t === "jefe" && jefe.tanques > 0) || (jefe.t === "centinela" && jefe.st !== "enfriado") ? 0x8aa0c0 : 0xff4a4a).fillRect(W / 2 - w / 2, y + 30, (w * Math.max(0, jefe.hp)) / jefe.maxHp, 14);
    g.lineStyle(3, 0x0a0a0c).strokeRect(W / 2 - w / 2, y + 30, w, 14);
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
