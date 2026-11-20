// El mapa, las entidades y el control del jugador local (con predicción del movimiento).
import {
  ALIENS,
  HAB,
  INTERACT_RANGE,
  PING_TYPES,
  PROP_RADIUS,
  RAYOS_SIMBOLOS,
  TICK_DT,
  TILE,
  dist,
  enemyDef,
  isAlienKind,
  retoDef,
  stepPlayer,
  type AlienKind,
  type Circle,
  type FxEvent,
  type InputMsg,
  type PingEvent,
} from "@dawg/shared";
import Phaser from "phaser";
import type { BloqueoS, GameStateS, PlayerS, ProjectileS, PzObjS, UnitS } from "../../net/tipos";
import { ayudaControles } from "../../ui/ayuda";
import { ControlesTactiles } from "../../ui/tactil";
import { ALTURA, COLOR_ALIEN, PROF_UI_MUNDO, TEXTO, actualizarReloj, ctx, esTactil, hojaJugador, prof, type Ctx } from "../contexto";
import { Efectos } from "../efectos";
import { alternarSonido, sfx } from "../sonido";
import { VistaPersonaje, perfilDe } from "../vistas";

const TICK_MS = TICK_DT * 1000;

interface VistaProyectil {
  img: Phaser.GameObjects.Image;
  sombra?: Phaser.GameObjects.Image;
  t0: number;
}

interface VistaPz {
  img: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
  txt?: Phaser.GameObjects.Text;
  k: string;
}

const DECOR_ORIGEN: Record<string, number> = { holograma: 0.72, nucleo: 0.7, mesa: 0.75, consola: 0.8, estanteria: 0.82 };
/** Objetos de reto que van en el suelo (planos). */
const PLANOS = new Set(["hueco", "ranura", "rejilla", "plataforma", "marca_inicio", "marca_muro", "grieta", "placa", "entrada_galeria", "suelo_blando", "lector", "biometrica", "baldosa", "marca_slot", "meta", "railes", "cinta", "conducto", "raiz", "soporte", "pasarela_hielo", "anillo", "aro_zona", "respiradero", "fuga"]);
/** Unidades que se dibujan como imagen fija. */
const ESTATICAS = new Set(["torreta", "sensor", "generador", "nodo", "pilon", "terminal"]);
/** Color del fogonazo al disparar, por alien o tipo de enemigo. */
const FOGONAZO: Record<string, number> = { cambiaformas: 0xffe08a, delmar: 0x6fd6ff, inteligente: 0xc08bff, curandera: 0x9cff7a, simbionte: 0xff8a2a, laser: 0x7dff6a, francotirador: 0xfff4a0, director: 0xff5a4a, robot: 0xffb020, dron: 0xffd23e };
/** Color del rastro de chicle de cada masa. */
const GOO_COLOR: Record<string, number> = { simbionte: 0xb9501a, skin1simbionte: 0x7a1830, simbionte_coloso: 0xa8461a, cria: 0xb9501a };
const ESCALA_UNIDAD: Record<string, number> = { pulpo: 0.75, perro: 0.85, cria: 0.85, planta: 0.95, dron: 0.8, kraken: 1, cazador: 1.05, robot: 1.05 };
const ZONA_TEX: Record<string, string> = { eco: "zona_eco", jardin: "zona_jardin", singularidad: "zona_singularidad", electrico: "zona_electrico", aviso: "zona_aviso", vapor: "zona_vapor" };

/** Alcance por defecto de la habilidad para apuntar en pantallas táctiles. */
const ALCANCE_TACTIL: Record<AlienKind, number> = { cambiaformas: 0, delmar: 340, inteligente: 360, curandera: 0, vesper: 380, freeze: 240, escarabajo: 0, simbionte: 280 };

export class Mundo extends Phaser.Scene {
  c!: Ctx;
  private efectos!: Efectos;
  private teclas!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT", Phaser.Input.Keyboard.Key>;
  // Predicción del jugador local
  private pred: { x: number; y: number } | null = null;
  private render = { x: 0, y: 0 };
  private pendientes: InputMsg[] = [];
  private seq = 0;
  private acc = 0;
  private ultimoAck = -1;
  private ultimoServidor = { x: NaN, y: NaN };
  aim = 0;
  // Habilidad mantenida
  private habDown = false;
  private habEnvio = 0;
  private tactilHab: "" | "down" | "up" = "";
  // Vistas
  private vJug = new Map<string, VistaPersonaje>();
  private vExtra = new Map<string, { burbuja?: Phaser.GameObjects.Image; monticulo?: Phaser.GameObjects.Sprite; icono?: Phaser.GameObjects.Image; aura?: Phaser.GameObjects.Image }>();
  private vUni = new Map<string, VistaPersonaje>();
  /** Último contador de acción visto por entidad (para animar cada acción una vez). */
  private animVisto = new Map<string, number>();
  /** Distancia recorrida por entidad (pisadas, rastro de goo, raíces). */
  private recorrido = new Map<string, { x: number; y: number; d: number }>();
  private inicioMundo = 0;
  private vivoAntes = new Map<string, boolean>();
  private vEtiqueta = new Map<string, Phaser.GameObjects.Text>();
  private vSimple = new Map<string, Phaser.GameObjects.Image>();
  private vProy = new Map<string, VistaProyectil>();
  private vZona = new Map<string, Phaser.GameObjects.Image>();
  private vObj = new Map<string, Phaser.GameObjects.Image>();
  private vPz = new Map<string, VistaPz>();
  private vBloq = new Map<string, { img: Phaser.GameObjects.TileSprite; b: BloqueoS }>();
  private vAlma = new Map<string, { img: Phaser.GameObjects.Image; txt: Phaser.GameObjects.Text }>();
  private vPuerta = new Map<string, { s: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text }>();
  private vPing: { img: Phaser.GameObjects.Image; hasta: number }[] = [];
  private nucleo?: Phaser.GameObjects.Image;
  private gLaser!: Phaser.GameObjects.Graphics;
  private gApunte!: Phaser.GameObjects.Graphics;
  private gMundo!: Phaser.GameObjects.Graphics;
  private gSuelo!: Phaser.GameObjects.Graphics;
  private oscuridad!: Phaser.GameObjects.Rectangle;
  private luces: Phaser.GameObjects.Image[] = [];
  private salida?: Phaser.GameObjects.Image;
  private puentes = new Set<number>();
  private vidaPrev = -1;
  private siguiendo = "";
  private tactil?: ControlesTactiles;
  private chorroT = 0;
  private capaDano!: HTMLDivElement;
  private animDano?: Animation;
  private animDistorsion?: Animation;

  constructor() {
    super("Mundo");
  }

  get room() {
    return this.c.room;
  }

  get st(): GameStateS {
    return this.c.room.state;
  }

  create(): void {
    this.c = ctx(this);
    this.capaDano = document.createElement("div");
    this.capaDano.className = "dano-pantalla";
    document.getElementById("juego")!.append(this.capaDano);
    this.events.once("shutdown", () => {
      this.animDano?.cancel();
      this.animDistorsion?.cancel();
      this.capaDano.remove();
    });
    const map = this.make.tilemap({ key: "area51" });
    const ts = map.addTilesetImage("laboratorio", "tiles")!;
    map.createLayer("suelo", ts, 0, 0)!.setDepth(0);
    const paredes = map.createLayer("paredes", ts, 0, 0)!.setDepth(1);
    paredes.setTint(0xd7e5e4);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setBackgroundColor("#0b2328");
    this.ajustarZoom();
    this.scale.on("resize", () => this.ajustarZoom());
    this.efectos = new Efectos(this);
    this.inicioMundo = this.time.now;
    this.gSuelo = this.add.graphics().setDepth(4);
    this.gLaser = this.add.graphics().setDepth(PROF_UI_MUNDO - 10).setBlendMode(Phaser.BlendModes.ADD);
    this.gMundo = this.add.graphics().setDepth(PROF_UI_MUNDO - 20);
    this.gApunte = this.add.graphics().setDepth(PROF_UI_MUNDO - 5);
    this.oscuridad = this.add.rectangle(0, 0, 10, 10, 0x05020c, 0).setOrigin(0).setScrollFactor(0).setDepth(PROF_UI_MUNDO - 30);
    this.crearEscenario();

    // Entrada de teclado y ratón
    const kb = this.input.keyboard!;
    this.teclas = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as typeof this.teclas;
    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor("crosshair");
    const libre = () => !this.c.chat.abierto;
    kb.on("keydown-E", () => libre() && this.room.send("interactuar", { down: true }));
    kb.on("keyup-E", () => this.room.send("interactuar", { down: false }));
    kb.on("keydown-SPACE", (e: KeyboardEvent) => !e.repeat && libre() && !this.c.ui.minijuego && this.habilidad("down"));
    kb.on("keyup-SPACE", () => this.habDown && this.habilidad("up"));
    kb.on("keydown-R", () => libre() && this.usarUlti());
    kb.on("keydown-Q", () => libre() && this.room.send("cambiar"));
    kb.on("keydown-G", () => libre() && this.room.send("dar"));
    ["SEVEN", "EIGHT", "NINE"].forEach((k, i) => kb.on(`keydown-${k}`, () => libre() && this.room.send("mejora", { i })));
    kb.on("keydown-ENTER", () => {
      if (!this.c.chat.abierto) {
        this.c.chat.abrir();
        this.room.send("interactuar", { down: false });
      }
    });
    kb.on("keydown-M", () => libre() && (this.c.ui.mapaGrande = !this.c.ui.mapaGrande));
    kb.on("keydown-H", () => libre() && ayudaControles());
    kb.on("keydown-N", () => libre() && this.c.chat.sistema(alternarSonido() ? "Sonido activado" : "Sonido silenciado"));
    PING_TYPES.forEach((tipo, i) => {
      kb.on(`keydown-${["ONE", "TWO", "THREE", "FOUR"][i]}`, () => {
        if (!libre()) return;
        const wp = this.mouseMundo();
        this.room.send("ping", { tipo, x: wp.x, y: wp.y + ALTURA });
      });
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() && !this.c.ui.minijuego && libre() && !this.c.ui.tactil) this.habilidad("down");
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.habDown && !p.rightButtonDown() && !this.c.ui.tactil && p.button === 2) this.habilidad("up");
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.room.send("interactuar", { down: false });
      if (this.habDown) this.habilidad("up");
    });

    // Controles táctiles (crossplay con móvil)
    this.c.ui.tactil = esTactil();
    if (this.c.ui.tactil) {
      this.tactil = new ControlesTactiles(this.c, {
        ulti: () => this.usarUlti(),
        interactuar: (down) => this.room.send("interactuar", { down }),
        forma: () => this.room.send("cambiar"),
        dar: () => this.room.send("dar"),
        ping: () => {
          const me = this.st.jugadores.get(this.room.sessionId);
          if (me) this.room.send("ping", { tipo: "aqui", x: me.x, y: me.y });
        },
        mapa: () => (this.c.ui.mapaGrande = !this.c.ui.mapaGrande),
        chat: () => this.c.chat.abrir(),
        mejora: () => this.room.send("mejora", { i: 0 }),
      });
      this.events.once("shutdown", () => this.tactil?.destruir());
    }

    // Mensajes del servidor
    this.room.onMessage("fx", (e: FxEvent) => this.efectos.play(e));
    this.room.onMessage("ping", (m: PingEvent) => this.ping(m));
    this.room.onMessage("codigo", (m: { codigo: number[] }) => (this.c.ui.codigo = { codigo: m.codigo, hasta: performance.now() + 9000 }));
  }

  private ajustarZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const movil = Math.min(w, h) < 600;
    const z = Phaser.Math.Clamp(Math.min(w / 1280, h / 760), movil ? 0.5 : 0.55, 1.15);
    this.cameras.main.setZoom(z);
    this.oscuridad?.setSize(w + 4, h + 4);
  }

  mouseMundo(): { x: number; y: number } {
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  /** Dónde apunta la habilidad: el ratón o, en táctil, un objetivo cercano en la dirección del joystick. */
  private objetivo(): { x: number; y: number } {
    if (!this.c.ui.tactil) {
      const wp = this.mouseMundo();
      return { x: wp.x, y: wp.y + ALTURA * 0.8 };
    }
    const me = this.st.jugadores.get(this.room.sessionId);
    if (!me) return { x: 0, y: 0 };
    const origen = this.origenControl(me);
    const alcance = isAlienKind(me.forma) ? ALCANCE_TACTIL[me.forma] : 300;
    if (alcance <= 0) return { x: origen.x + Math.cos(this.aim) * 40, y: origen.y + Math.sin(this.aim) * 40 };
    // Busca el objetivo más alineado con la dirección (unidades, objetos de reto, barriles).
    let best: { x: number; y: number } | null = null;
    let bs = Infinity;
    const probar = (x: number, y: number) => {
      const d = dist(origen.x, origen.y, x, y);
      if (d < 20 || d > alcance + 160) return;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - origen.y, x - origen.x) - this.aim));
      if (da > 0.6) return;
      const s = da * 300 + d * 0.3;
      if (s < bs) {
        bs = s;
        best = { x, y };
      }
    };
    this.st.unidades.forEach((u) => u.team === "humanos" && probar(u.x, u.y));
    this.st.pz.forEach((o) => probar(o.x, o.y));
    this.st.objetos.forEach((o) => (o.k === "barril" || o.k === "caja" || o.k === "bloque") && probar(o.x, o.y));
    return best ?? { x: origen.x + Math.cos(this.aim) * alcance, y: origen.y + Math.sin(this.aim) * alcance };
  }

  private habilidad(fase: "down" | "up"): void {
    const t = this.objetivo();
    this.habDown = fase === "down";
    this.room.send("habilidad", { x: t.x, y: t.y, fase });
  }

  private usarUlti(): void {
    const t = this.objetivo();
    this.room.send("ulti", { x: t.x, y: t.y });
  }

  /** Posición desde la que se apunta: el cuerpo o el guardia controlado. */
  private origenControl(me: PlayerS): { x: number; y: number } {
    if (me.controla) {
      const u = this.st.unidades.get(me.controla);
      if (u) return { x: u.x, y: u.y };
    }
    return me.vivo ? { x: this.render.x, y: this.render.y } : { x: me.x, y: me.y };
  }

  // ------------------------------------------------------------------ escenario fijo
  private crearEscenario(): void {
    const w = this.c.world;
    for (const o of w.find("decor")) {
      const k = String(o.props.sprite);
      const img = this.add.image(o.x, o.y, k).setOrigin(0.5, DECOR_ORIGEN[k] ?? 0.85).setDepth(prof(o.y));
      if (k === "nucleo") this.nucleo = img;
    }
    for (const o of w.find("door")) {
      const v = o.props.orientacion === "v";
      const s = this.add.sprite(o.x + o.w / 2, o.y + o.h / 2, v ? "puerta_v" : "puerta_h", 0).setDisplaySize(o.w, o.h).setDepth(v ? prof(o.y + o.h) : prof(o.y + o.h) - 40);
      s.setTint(o.props.gigante ? 0xffe38a : 0xcceeff);
      const txt = this.add.text(o.x + o.w / 2, o.y - 6, o.props.gigante ? "GRAN COMPUERTA" : "SELLADA", { ...TEXTO, fontSize: o.props.gigante ? "22px" : "14px", color: o.props.gigante ? "#ffd23e" : "#ff6a6a" }).setOrigin(0.5, 1).setDepth(PROF_UI_MUNDO).setVisible(Boolean(o.props.gigante));
      this.vPuerta.set(o.name, { s, txt });
    }
    const exit = w.findOne("exit");
    if (exit) this.salida = this.add.image(exit.x + exit.w / 2, exit.y + exit.h / 2, "salida").setDepth(prof(exit.y + exit.h)).setAlpha(0.5).setScale(1.4);
    // Nombres de sala en el suelo
    for (const r of w.rooms) {
      if (r.id === "pasillo") continue;
      this.add.text(r.x + 20, r.y + 14, r.nombre.toUpperCase(), { ...TEXTO, fontSize: "18px", color: "#9fd6e0", strokeThickness: 3 }).setAlpha(0.45).setDepth(3);
    }
  }

  // ------------------------------------------------------------------ bucle
  override update(t: number, delta: number): void {
    const st = this.st;
    if (!st) return;
    const dt = delta / 1000;
    actualizarReloj(st.tiempo);
    this.syncMundo();
    const me = st.jugadores.get(this.room.sessionId);
    this.entradaTactil(me);
    this.predecir(delta, me);
    this.syncJugadores(dt, me);
    this.syncUnidades(dt);
    this.syncProyectiles();
    this.syncZonas();
    this.syncObjetos();
    this.syncPz(me);
    this.syncAlmas(t);
    this.syncPings();
    this.efectosGlobales(me);
    this.dibujarApuntado(me);
    this.seguirCamara(me);
    this.c.ui.prompt = this.calcularPrompt(me);
    if (me) {
      if (this.vidaPrev >= 0 && me.hp < this.vidaPrev) this.efectoDano();
      this.vidaPrev = me.hp;
      if (this.habDown && performance.now() - this.habEnvio > 100) {
        this.habEnvio = performance.now();
        const o = this.objetivo();
        this.room.send("apunta", o);
      }
      if (this.tactil) {
        const frac = me.enfMax > 0 ? me.enfriamiento / me.enfMax : 0;
        this.tactil.actualizar(me.forma, frac, me.ulti, me.ultiT > 0 || me.tunel === 1, me.almas.length, Boolean(me.oferta));
      }
    }
  }

  private efectoDano(): void {
    const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.animDano?.cancel();
    this.animDano = this.capaDano.animate(
      [{ opacity: movimientoReducido ? 0.35 : 0.8 }, { opacity: 0 }],
      { duration: movimientoReducido ? 200 : 550, easing: "ease-out" },
    );
    if (movimientoReducido) return;
    this.cameras.main.shake(120, 0.004);
    this.animDistorsion?.cancel();
    this.animDistorsion = this.game.canvas.animate(
      [
        { transform: "scale(1.006) skewX(0.35deg)" },
        { transform: "scale(1.003) skewX(-0.2deg)", offset: 0.35 },
        { transform: "none" },
      ],
      { duration: 260, easing: "ease-out" },
    );
  }

  private entradaTactil(me: PlayerS | undefined): void {
    if (!this.c.ui.tactil || !me) return;
    const h = this.c.tactil.habilidad;
    if (h && h !== this.tactilHab) {
      this.tactilHab = h;
      if (!this.c.ui.minijuego) this.habilidad(h);
    }
    if (h === "up") {
      this.c.tactil.habilidad = "";
      this.tactilHab = "";
    }
  }

  private seguirCamara(me: PlayerS | undefined): void {
    if (!me) return;
    const objetivo = me.controla && this.vUni.has(me.controla) ? me.controla : this.room.sessionId;
    if (objetivo === this.siguiendo) return;
    const v = objetivo === this.room.sessionId ? this.vJug.get(objetivo) : this.vUni.get(objetivo);
    if (!v) return;
    this.siguiendo = objetivo;
    this.cameras.main.startFollow(v.cuerpo, true, 0.12, 0.12, 0, 30);
  }

  /** Puertas, puentes y bloqueos dinámicos en el mundo local (para que la predicción choque igual que el servidor). */
  private syncMundo(): void {
    this.st.puertas.forEach((d, id) => {
      this.c.world.setDoor(id, d.abierta);
      const v = this.vPuerta.get(id);
      if (!v) return;
      if (Number(v.s.frame.name) !== (d.abierta ? 1 : 0)) v.s.setFrame(d.abierta ? 1 : 0);
      const gigante = id === "DF";
      if (d.abierta) v.s.setTint(gigante ? 0x7dff6a : 0xaef8da);
      else if (d.sellada) v.s.setTint(0xff6a6a);
      else v.s.setTint(gigante ? 0xffe38a : 0xcceeff);
      v.s.setAlpha(d.abierta ? 0.58 : 1);
      if (id !== "DF") v.txt.setVisible(d.sellada && !d.abierta);
    });
    const ahora = new Set<number>();
    this.st.objetos.forEach((o) => {
      if (o.k === "puente") ahora.add(Math.floor(o.y / TILE) * this.c.world.w + Math.floor(o.x / TILE));
    });
    for (const i of this.puentes) if (!ahora.has(i)) this.c.world.setBridge(i % this.c.world.w, Math.floor(i / this.c.world.w), false);
    for (const i of ahora) if (!this.puentes.has(i)) this.c.world.setBridge(i % this.c.world.w, Math.floor(i / this.c.world.w), true);
    this.puentes = ahora;
    this.salida?.setAlpha(this.st.puertas.get("DF")?.abierta ? 1 : 0.4);
    // Bloqueos dinámicos
    const vistos = new Set<string>();
    this.st.bloqueos.forEach((b, id) => {
      vistos.add(id);
      if (this.vBloq.has(id)) return;
      this.c.world.addDyn(b.x, b.y, b.w, b.h, b.m, 1);
      const tex = this.textures.exists("bq_" + b.k) ? "bq_" + b.k : "bq_muro";
      const img = this.add.tileSprite(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE, tex).setOrigin(0);
      img.setDepth(b.k === "abismo" ? 2 : prof((b.y + b.h) * TILE));
      if (b.k === "vidrio") img.setTint(0x9fefff).setAlpha(0.72);
      else if (b.k === "valla") img.setTint(0xffca6a);
      else if (b.k === "hielo" || b.k === "muro") img.setTint(0xc5f3ff);
      else img.setTint(0xf0e2d0);
      this.vBloq.set(id, { img, b: { k: b.k, x: b.x, y: b.y, w: b.w, h: b.h, m: b.m } });
    });
    for (const [id, v] of this.vBloq) {
      if (vistos.has(id)) {
        if (v.b.k === "valla") v.img.setAlpha(0.7 + Math.sin(this.time.now / 90) * 0.3);
        continue;
      }
      this.c.world.addDyn(v.b.x, v.b.y, v.b.w, v.b.h, v.b.m, -1);
      v.img.destroy();
      this.vBloq.delete(id);
    }
  }

  private solidos(): Circle[] {
    const out: Circle[] = [];
    this.st.objetos.forEach((o) => {
      const r = PROP_RADIUS[o.k];
      if (r) out.push({ x: o.x, y: o.y, r });
    });
    return out;
  }

  private mover(me: PlayerS, p: { x: number; y: number }) {
    return {
      x: p.x,
      y: p.y,
      speed: me.velocidad,
      status: me.estado,
      confused: me.confuso,
      ghost: me.fantasma,
      locked: me.ocupado !== "" || me.controla !== "" || me.canalTipo === "fijo",
      under: me.bajoTierra,
    };
  }

  private predecir(delta: number, me: PlayerS | undefined): void {
    if (!me) return;
    const world = this.c.world;
    const solidos = this.solidos();
    if (!this.pred) {
      this.pred = { x: me.x, y: me.y };
      this.render = { x: me.x, y: me.y };
      this.cameras.main.centerOn(me.x, me.y);
    }
    if (me.seq !== this.ultimoAck || me.x !== this.ultimoServidor.x || me.y !== this.ultimoServidor.y) {
      this.ultimoAck = me.seq;
      this.ultimoServidor = { x: me.x, y: me.y };
      this.pendientes = this.pendientes.filter((i) => i.seq > me.seq);
      let p = { x: me.x, y: me.y };
      for (const i of this.pendientes) p = stepPlayer(world, this.mover(me, p), i.mx, i.my, TICK_DT, solidos);
      this.pred = p;
    }
    this.acc = Math.min(this.acc + delta, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const inp = this.leerInput(me);
      this.pendientes.push(inp);
      if (this.pendientes.length > 120) this.pendientes.shift();
      this.pred = stepPlayer(world, this.mover(me, this.pred), inp.mx, inp.my, TICK_DT, solidos);
      this.room.send("input", inp);
    }
    const d = Math.hypot(this.pred.x - this.render.x, this.pred.y - this.render.y);
    if (d > 140) this.render = { ...this.pred };
    else {
      const k = Math.min(1, (delta / 1000) * 22);
      this.render.x += (this.pred.x - this.render.x) * k;
      this.render.y += (this.pred.y - this.render.y) * k;
    }
    if (this.c.ui.tactil) {
      if (this.c.tactil.aim !== null) this.aim = this.c.tactil.aim;
    } else {
      const wp = this.mouseMundo();
      const o = this.origenControl(me);
      this.aim = Math.atan2(wp.y - (o.y - ALTURA), wp.x - o.x);
    }
  }

  private leerInput(me: PlayerS): InputMsg {
    const libre = !this.c.chat.abierto && this.st.fase === "jugando";
    const k = this.teclas;
    let mx = libre ? (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0) : 0;
    let my = libre ? (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0) : 0;
    let shoot = false;
    if (this.c.ui.tactil) {
      if (libre && (this.c.tactil.mx || this.c.tactil.my)) {
        mx = this.c.tactil.mx;
        my = this.c.tactil.my;
      }
      shoot = libre && !this.c.ui.minijuego && this.c.tactil.disparo;
    } else {
      const p = this.input.activePointer;
      shoot = libre && !this.c.ui.minijuego && p.isDown && p.leftButtonDown();
    }
    void me;
    return { seq: ++this.seq, mx, my, aim: this.aim, shoot };
  }

  // ------------------------------------------------------------------ jugadores
  private syncJugadores(dt: number, me: PlayerS | undefined): void {
    const vivos = new Set<string>();
    this.st.jugadores.forEach((p, id) => {
      vivos.add(id);
      const yo = id === this.room.sessionId;
      let v = this.vJug.get(id);
      const hoja = hojaJugador(p);
      if (!v) {
        v = new VistaPersonaje(this, hoja, p.x, p.y, { nombre: yo ? undefined : p.nombre, color: COLOR_ALIEN[p.kind] });
        this.vJug.set(id, v);
        this.vExtra.set(id, {});
      }
      const ex = this.vExtra.get(id)!;
      const estabaVivo = this.vivoAntes.get(id);
      if (estabaVivo && !p.vivo) {
        this.efectos.muerte(v.rx, v.ry, v.perfil, COLOR_ALIEN[p.forma] ?? 0xffffff);
        if (yo) this.cameras.main.shake(260, 0.01);
      }
      this.vivoAntes.set(id, p.vivo);
      if (yo) {
        v.rx = this.render.x;
        v.ry = this.render.y;
      } else v.seguir(p.x, p.y, dt);
      v.setSheet(hoja);
      const fantasma = p.fantasma;
      v.cuerpo.setAlpha(fantasma ? 0.4 : p.bajoTierra ? 0 : 1);
      v.sombra.setVisible(!fantasma && !p.bajoTierra);
      v.arma?.setVisible(!fantasma && !p.bajoTierra && p.estado === "ok" && !p.controla && !(p.forma === "curandera" && p.cautivo) && p.ultiT <= 0);
      if (fantasma) v.cuerpo.setTint(0xbfe6ff);
      else if (p.disfrazado) v.cuerpo.setTint(0xd8ffd0);
      else if (p.confuso > 0) v.cuerpo.setTint(0xd9b8ff);
      else if (p.punal > 0) v.cuerpo.setTint(0xc8b0ff);
      else v.cuerpo.clearTint();
      v.setOverlay(p.estado === "congelado" ? "hielo" : p.estado === "red" ? "red_trampa" : null);
      v.setAura(Boolean(p.controla) || p.punal > 0 || (p.ultiT > 0 && p.forma !== "simbionte"), p.punal > 0 ? 0x7a5cff : p.controla ? 0xc08bff : COLOR_ALIEN[p.forma] ?? 0xffffff);
      v.quieto = p.estado === "congelado" || p.estado === "red";
      v.aturdido = p.estado === "aturdido";
      v.extraY = fantasma ? -(10 + Math.sin(this.time.now / 300) * 4) : 0;
      v.extraEscala = p.forma === "simbionte" && p.ultiT > 0 ? 1 + Math.sin(this.time.now / 160) * 0.03 : 1;
      const apunta = yo ? this.aim : p.aim;
      // Acción nueva anunciada por el servidor → animación + efecto
      const visto = this.animVisto.get(id);
      if (visto !== undefined && visto !== p.animN && p.anim && !fantasma) {
        v.accion(p.anim, apunta);
        const col = COLOR_ALIEN[p.forma] ?? 0xffffff;
        if (p.anim === "disparo") this.efectos.fogonazo(v.rx, v.ry, apunta, FOGONAZO[p.forma] ?? col);
        else this.efectos.accion(p.anim, v.rx, v.ry, col);
      }
      this.animVisto.set(id, p.animN);
      v.actualizar(apunta, null, dt, fantasma ? undefined : p.hp, p.maxHp);
      if (!fantasma && !p.bajoTierra && p.vivo) this.rastro(id, v, hoja);
      // Escudo (psíquico o de la Fusión)
      if (p.escudo > 0) {
        if (!ex.burbuja) ex.burbuja = this.add.image(0, 0, "burbuja").setAlpha(0.8);
        ex.burbuja.setPosition(v.rx, v.ry - 40).setDepth(prof(v.ry) + 2).setScale(p.ultiT > 0 && p.forma === "simbionte" ? 1.4 : 0.85);
      } else if (ex.burbuja) {
        ex.burbuja.destroy();
        ex.burbuja = undefined;
      }
      // Escarabajo bajo tierra: montículo que se mueve
      if (p.bajoTierra && p.vivo) {
        if (!ex.monticulo) ex.monticulo = this.add.sprite(0, 0, "monticulo", 0);
        ex.monticulo.setPosition(v.rx, v.ry).setDepth(prof(v.ry)).setFrame(Math.floor(this.time.now / 120) % 2);
        if (Math.random() < 0.15) this.efectos.tierra(v.rx, v.ry);
      } else if (ex.monticulo) {
        ex.monticulo.destroy();
        ex.monticulo = undefined;
      }
      // Iconos de estado
      const icono = p.estado === "agarrado" ? "icono_agarre" : p.cautivo ? "icono_cautivo" : "";
      if (icono) {
        if (!ex.icono) ex.icono = this.add.image(0, 0, icono).setScale(0.6);
        ex.icono.setTexture(icono).setPosition(v.rx, v.ry - 100).setDepth(PROF_UI_MUNDO + 5);
      } else if (ex.icono) {
        ex.icono.destroy();
        ex.icono = undefined;
      }
      // Progreso de rescate y de canalización
      if (p.rescate > 0 && p.estado !== "ok") v.barra.lineStyle(5, 0x7dff6a, 1).beginPath().arc(v.rx, v.ry - 45, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.rescate).strokePath();
      if (p.canal > 0 && p.canalTipo !== "fijo") v.barra.lineStyle(4, p.canalTipo === "escanear" ? 0x7fb24a : 0xc08bff, 1).beginPath().arc(v.rx, v.ry - 45, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.canal).strokePath();
      // Chorro de hielo de Freeze
      if (p.disparando && p.forma === "freeze" && p.vivo) {
        this.chorroT -= dt;
        if (this.chorroT <= 0) {
          this.chorroT = 0.03;
          this.efectos.chorro(v.rx, v.ry - ALTURA, yo ? this.aim : p.aim);
          if (Math.random() < 0.15) v.accion("disparo", yo ? this.aim : p.aim);
        }
      }
    });
    for (const [id, v] of this.vJug) {
      if (vivos.has(id)) continue;
      this.animVisto.delete(id);
      this.recorrido.delete(id);
      v.destruir();
      const ex = this.vExtra.get(id);
      ex?.burbuja?.destroy();
      ex?.monticulo?.destroy();
      ex?.icono?.destroy();
      this.vJug.delete(id);
      this.vExtra.delete(id);
    }
    void me;
  }

  /** Pisadas, trozos de goo o tierra según cómo se mueve cada cuerpo. */
  private rastro(id: string, v: VistaPersonaje, hoja: string): void {
    let r = this.recorrido.get(id);
    if (!r) {
      this.recorrido.set(id, { x: v.rx, y: v.ry, d: 0 });
      return;
    }
    const d = Math.hypot(v.rx - r.x, v.ry - r.y);
    r.x = v.rx;
    r.y = v.ry;
    if (d > 60) return;
    r.d += d;
    const perfil = v.perfil;
    const umbral = perfil === "masa" ? 30 : perfil === "planta" ? 36 : perfil === "cuadrupedo" ? 30 : perfil === "flotante" || perfil === "tentaculos" ? 1e9 : 44;
    if (r.d < umbral) return;
    r.d = 0;
    if (perfil === "masa") this.efectos.rastroGoo(v.rx, v.ry, GOO_COLOR[hoja] ?? 0xb9501a, hoja === "simbionte_coloso" ? 1.5 : hoja === "cria" ? 0.6 : 1);
    else if (perfil === "planta") this.efectos.raices(v.rx, v.ry);
    else this.efectos.pisada(v.rx, v.ry, perfil === "maquina" || perfil === "pesado");
  }

  // ------------------------------------------------------------------ unidades
  private syncUnidades(dt: number): void {
    const vistas = new Set<string>();
    this.gLaser.clear();
    this.st.unidades.forEach((u, id) => {
      vistas.add(id);
      if (ESTATICAS.has(u.t)) {
        this.unidadEstatica(id, u);
        this.etiqueta(id, u, u.y - 110);
        return;
      }
      let v = this.vUni.get(id);
      if (!v || v.cuerpo.texture.key !== (this.textures.exists(u.t) ? u.t : "fusilero")) {
        v?.destruir();
        v = new VistaPersonaje(this, this.textures.exists(u.t) ? u.t : "fusilero", u.x, u.y, { escala: ESCALA_UNIDAD[u.t] ?? 1, aparecer: this.time.now - this.inicioMundo > 2500 });
        this.vUni.set(id, v);
      }
      v.seguir(u.x, u.y, dt);
      if (u.t === "escudo" && !u.escudo) v.quitarEscudo();
      v.setAura(u.blindado || u.poseido === "T", u.poseido === "T" ? 0xc08bff : 0x3ef0ff);
      // Tintes de estado
      const pulso = 0.5 + 0.5 * Math.sin(this.time.now / 120);
      if (u.st === "congelado") v.cuerpo.setTint(0x9fe3ff);
      else if (u.st === "infectado") v.cuerpo.setTint(Phaser.Display.Color.GetColor(255, 150 + pulso * 70, 90 + pulso * 50));
      else if (u.poseido === "S") v.cuerpo.setTint(0xffc08a);
      else if (u.st === "aturdido") v.cuerpo.setTint(0x9aa0ff);
      else if (u.st === "enfriado") v.cuerpo.setTint(0x8fd8ff);
      else if (u.st === "cargando") v.cuerpo.setTint(pulso > 0.5 ? 0xff8a8a : 0xffffff);
      else if (u.frio > 0.05) v.cuerpo.setTint(Phaser.Display.Color.GetColor(255 - u.frio * 110, 255 - u.frio * 40, 255));
      else v.cuerpo.clearTint();
      v.setOverlay(u.st === "congelado" ? "hielo" : u.st === "infectado" || u.poseido === "S" ? "goo_infeccion" : null);
      v.quieto = u.st === "congelado";
      v.aturdido = u.st === "aturdido";
      const jefe = enemyDef(u.t)?.rango === "jefe";
      const vistoU = this.animVisto.get(id);
      if (vistoU !== undefined && vistoU !== u.animN && u.anim) {
        v.accion(u.anim, u.ang);
        if (u.anim === "disparo") this.efectos.fogonazo(v.rx, v.ry, u.ang, FOGONAZO[u.t] ?? (u.team === "aliens" ? 0xffb26a : 0xffd23e));
        else this.efectos.accion(u.anim, v.rx, v.ry, u.team === "aliens" ? 0x7dff6a : 0xff6a4a);
      }
      this.animVisto.set(id, u.animN);
      if (u.st === "cargando" && Math.random() < 0.3) this.efectos.accion("carga", v.rx, v.ry, 0xffffff);
      v.actualizar(u.ang, u.moviendo, dt, jefe || u.t === "planta" ? undefined : u.hp, u.maxHp);
      this.rastro(id, v, u.t);
      // Barra de infección del Simbionte: se llena con cada fragmento; llena = se puede asimilar
      if (u.team === "humanos" && (u.infeccion > 0 || u.st === "infectado")) v.barraExtra(u.st === "infectado" ? 1 : u.infeccion, 0xff8a2a, 1, u.st === "infectado");
      this.etiqueta(id, u, v.ry - 100 * v.escala);
      // Láseres de apuntado
      if (u.st === "apuntando") {
        const lasr = u.t === "laser";
        this.rayo(u.x, u.y, u.ang, 1400, lasr ? 0x40ff40 : 0xff2020, (lasr ? 2.5 : 1.5) + u.stT * 3, 0.35 + u.stT * 0.6);
      }
      // Láser giratorio del Centinela
      if (u.t === "centinela" && u.st !== "enfriado" && u.st !== "congelado") this.rayo(u.x, u.y, u.ang, 620, 0xff3030, 6, 0.85);
    });
    let bajas = 0;
    for (const id of this.vUni.keys()) if (!vistas.has(id)) bajas++;
    for (const [id, v] of this.vUni) {
      if (!vistas.has(id)) {
        // Muerte animada (si desaparecen muchas de golpe, p. ej. al reiniciar, se quitan sin más)
        if (bajas <= 8 && !v.muriendo) {
          this.efectos.muerte(v.rx, v.ry, v.perfil);
          v.morir();
        } else v.destruir();
        this.vUni.delete(id);
        this.animVisto.delete(id);
        this.recorrido.delete(id);
      }
    }
    for (const [id, img] of this.vSimple) {
      if (!vistas.has(id.split(":")[0])) {
        img.destroy();
        this.vSimple.delete(id);
      }
    }
    for (const [id, t] of this.vEtiqueta) {
      if (!vistas.has(id)) {
        t.destroy();
        this.vEtiqueta.delete(id);
      }
    }
  }

  private unidadEstatica(id: string, u: UnitS): void {
    let img = this.vSimple.get(id);
    if (!img) {
      img = this.add.image(u.x, u.y, u.t).setOrigin(0.5, 0.75).setDepth(prof(u.y));
      this.vSimple.set(id, img);
      if (u.t === "torreta") this.vSimple.set(id + ":c", this.add.image(u.x, u.y - 24, "torreta_canon").setOrigin(0.25, 0.5).setDepth(prof(u.y) + 1));
    }
    img.setPosition(u.x, u.y);
    const canon = this.vSimple.get(id + ":c");
    canon?.setRotation(u.ang);
    const vistoT = this.animVisto.get(id);
    if (canon && vistoT !== undefined && vistoT !== u.animN && u.anim === "disparo") {
      this.efectos.fogonazo(u.x, u.y + ALTURA - 24, u.ang, 0xffd23e);
      this.tweens.add({ targets: canon, x: u.x - Math.cos(u.ang) * 6, y: u.y - 24 - Math.sin(u.ang) * 6, duration: 50, yoyo: true });
    }
    this.animVisto.set(id, u.animN);
    if (u.t === "sensor") img.setScale(1 + Math.sin(this.time.now / 200) * 0.05);
    if (u.t === "nodo") img.setTint(Phaser.Display.Color.GetColor(255 - u.infeccion * 60, 255 - u.infeccion * 160, 255));
    if (u.t === "generador" || u.t === "pilon") img.setAlpha(u.blindado ? 0.6 + Math.sin(this.time.now / 80) * 0.3 : 1);
    if (u.t !== "nodo" && u.t !== "terminal" && u.hp < u.maxHp) {
      this.barraEnemigo(u.x - 28, u.y - 99, 56, 8, u.hp / u.maxHp, 0xff4a4a);
    }
    if (u.t === "terminal") this.barraEnemigo(u.x - 32, u.y - 99, 64, 8, u.hp / u.maxHp, 0x7dff6a);
  }

  private barraEnemigo(x: number, y: number, w: number, h: number, frac: number, color: number): void {
    const p = Phaser.Math.Clamp(frac, 0, 1);
    this.gLaser.fillStyle(0x000000, 0.94).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 2);
    this.gLaser.lineStyle(1.5, 0x7dff6a, 0.8).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 2);
    this.gLaser.fillStyle(color, 1).fillRect(x, y, w * p, h);
    this.gLaser.fillStyle(0xffffff, 0.3).fillRect(x, y, w * p, 2);
    for (let i = 1; i < 8; i++) this.gLaser.lineStyle(1, 0x031108, 0.7).lineBetween(x + (w * i) / 8, y, x + (w * i) / 8, y + h);
  }

  private etiqueta(id: string, u: UnitS, y: number): void {
    const texto = u.poseido === "S" ? (u.t === "cria" ? "" : "Huésped") : u.etiqueta;
    let t = this.vEtiqueta.get(id);
    if (!texto) {
      t?.setVisible(false);
      return;
    }
    if (!t) {
      t = this.add.text(0, 0, "", { ...TEXTO, fontSize: "13px", color: "#ffd23e" }).setOrigin(0.5, 1);
      this.vEtiqueta.set(id, t);
    }
    t.setText(texto).setVisible(true).setPosition(u.x, y).setDepth(PROF_UI_MUNDO + 1).setColor(u.poseido ? "#e6a8ff" : "#ffd23e");
  }

  private rayo(x: number, y: number, ang: number, largo: number, color: number, ancho: number, alfa: number): void {
    const ox = x + Math.cos(ang) * 30;
    const oy = y + Math.sin(ang) * 30;
    const tx = x + Math.cos(ang) * largo;
    const ty = y + Math.sin(ang) * largo;
    const hit = this.c.world.raycast(ox, oy, tx, ty);
    this.gLaser.lineStyle(ancho, color, alfa).lineBetween(ox, oy - ALTURA, hit ? hit.x : tx, (hit ? hit.y : ty) - ALTURA);
  }

  // ------------------------------------------------------------------ proyectiles (simulados en el cliente)
  private syncProyectiles(): void {
    const ahora = this.time.now;
    const vistos = new Set<string>();
    const cam = this.cameras.main;
    this.st.proyectiles.forEach((pr, id) => {
      vistos.add(id);
      let v = this.vProy.get(id);
      if (!v) {
        v = this.crearProyectil(pr, ahora);
        this.vProy.set(id, v);
        const d = Phaser.Math.Distance.Between(pr.x, pr.y, cam.midPoint.x, cam.midPoint.y);
        if (d < 1100) sfx.disparo(pr.k, Phaser.Math.Clamp(1.3 - d / 1100, 0.2, 1));
      }
      const t = (ahora - v.t0) / 1000;
      if (pr.vuelo > 0) {
        const k = Math.min(1, t / pr.vuelo);
        const gx = pr.x + (pr.tx - pr.x) * k;
        const gy = pr.y + (pr.ty - pr.y) * k;
        v.img.setPosition(gx, gy - Math.sin(Math.PI * k) * 90 - 20 * (1 - k)).setRotation(pr.k === "misil" ? Math.atan2(pr.ty - pr.y, pr.tx - pr.x) : t * 10).setDepth(prof(gy) + 50);
        if (pr.k === "misil" && this.game.loop.frame % 2 === 0) this.efectos.estela("misil", v.img.x, v.img.y);
        v.sombra?.setPosition(gx, gy).setDepth(prof(gy) - 40);
      } else {
        const x = pr.x + pr.vx * t;
        const y = pr.y + pr.vy * t;
        v.img.setPosition(x, y - ALTURA).setDepth(prof(y) + 20);
        if (pr.k.startsWith("tq_")) v.img.rotation += 0.3;
        else if (this.game.loop.frame % 2 === 0) this.efectos.estela(pr.k, x, y - ALTURA);
      }
    });
    for (const [id, v] of this.vProy) {
      if (!vistos.has(id)) {
        v.img.destroy();
        v.sombra?.destroy();
        this.vProy.delete(id);
      }
    }
  }

  private crearProyectil(pr: ProjectileS, t0: number): VistaProyectil {
    let k = pr.k.startsWith("tq_") ? pr.k.slice(3) : pr.k;
    if (!this.textures.exists(k)) k = "bala";
    const img = this.add.image(pr.x, pr.y, k).setRotation(Math.atan2(pr.vy, pr.vx));
    if (pr.k.startsWith("tq_")) img.setScale(0.8).setTint(0xe0c8ff);
    if (["bala", "bala_roja", "energia", "psiquico", "rayo_franco", "rayo_laser"].includes(pr.k)) img.setBlendMode(Phaser.BlendModes.ADD);
    let sombra: Phaser.GameObjects.Image | undefined;
    if (pr.vuelo > 0) sombra = this.add.image(pr.x, pr.y, "sombra").setScale(0.35);
    return { img, sombra, t0 };
  }

  // ------------------------------------------------------------------ zonas y objetos
  private syncZonas(): void {
    const vistos = new Set<string>();
    this.st.zonas.forEach((z, id) => {
      vistos.add(id);
      let img = this.vZona.get(id);
      const nueva = ZONA_TEX[z.k];
      if (!img) {
        const tex = nueva ?? (z.k === "acido" ? "acido" : z.k === "gas" ? "gas" : "fuego");
        img = this.add.image(z.x, z.y, tex).setDepth(z.k === "gas" || z.k === "vapor" ? prof(z.y) + 200 : 4);
        const base = nueva ? 256 : z.k === "acido" ? 120 : z.k === "gas" ? 150 : 60;
        img.setScale((z.r * 2) / base).setData("base", (z.r * 2) / base);
        if (z.k === "gas") img.setAlpha(0.85);
        if (z.k === "eco" || z.k === "jardin") img.setBlendMode(Phaser.BlendModes.SCREEN);
        this.vZona.set(id, img);
      }
      const base = img.getData("base") as number;
      if (z.k === "fuego") img.setScale(base * (1 + Math.sin(this.time.now / 90 + z.x) * 0.08));
      if (z.k === "singularidad") img.setRotation(this.time.now / 150).setScale(base * (0.9 + (1 - z.vida / Math.max(0.1, z.total)) * 0.3));
      if (z.k === "electrico") img.setAlpha(z.total - z.vida < 1.2 ? 0.25 + Math.abs(Math.sin(this.time.now / 70)) * 0.25 : 0.7 + Math.random() * 0.3);
      if (z.k === "aviso") img.setScale(base * (0.6 + 0.4 * Math.min(1, (z.total - z.vida) / Math.max(0.1, z.total)))).setAlpha(0.7 + Math.sin(this.time.now / 60) * 0.3);
      if (z.k === "eco") img.setRotation(this.time.now / 3000);
      if (z.vida < 1 && z.k !== "aviso") img.setAlpha(Math.max(0, z.vida) * (z.k === "gas" ? 0.85 : 1));
    });
    for (const [id, img] of this.vZona) {
      if (!vistos.has(id)) {
        img.destroy();
        this.vZona.delete(id);
      }
    }
  }

  private syncObjetos(): void {
    const vistos = new Set<string>();
    this.st.objetos.forEach((o, id) => {
      vistos.add(id);
      let img = this.vObj.get(id);
      if (!img || img.texture.key !== o.k) {
        img?.destroy();
        const plano = o.k === "puente" || o.k === "charco_agua" || o.k === "tunel";
        img = this.add.image(o.x, o.y, this.textures.exists(o.k) ? o.k : "caja").setOrigin(0.5, plano ? 0.5 : 0.8);
        if (o.k === "cobertura" || o.k === "puente" || o.k === "muro_hielo" || o.k === "tunel") {
          img.setScale(0.2);
          this.tweens.add({ targets: img, scale: 1, duration: 300, ease: "Back.Out" });
        }
        this.vObj.set(id, img);
      }
      img.setPosition(o.x, o.y);
      img.setDepth(o.k === "puente" || o.k === "tunel" ? 3 : o.k === "charco_agua" ? 3 : o.st === "sostenido" ? prof(o.y) + 100 : prof(o.y));
      if (o.k === "bloque") {
        if (o.st === "hundiendo") {
          img.setTint(0x9fffa0).setAlpha(0.6 + 0.4 * Math.min(1, o.t / 3));
          img.setScale(0.7 + 0.3 * Math.min(1, o.t / 9));
        } else img.clearTint().setAlpha(1).setScale(0.8);
      }
      if ((o.k === "cobertura" || o.k === "muro_hielo") && o.t < 3) img.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 120)));
      if (o.k === "tunel") img.setAlpha(o.t < 3 ? 0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 120)) : 1);
    });
    for (const [id, img] of this.vObj) {
      if (!vistos.has(id)) {
        img.destroy();
        this.vObj.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ objetos de los retos
  private syncPz(me: PlayerS | undefined): void {
    const g = this.gMundo.clear();
    const gs = this.gSuelo.clear();
    const vistos = new Set<string>();
    const ahora = this.time.now;
    this.st.pz.forEach((o, id) => {
      vistos.add(id);
      let v = this.vPz.get(id);
      if (!v || v.k !== o.k) {
        v?.img.destroy();
        v?.txt?.destroy();
        v = this.crearPz(o);
        this.vPz.set(id, v);
      }
      this.actualizarPz(v, o, me, ahora, g);
      // Foco: cono de luz en el suelo
      if (o.k === "foco") {
        gs.fillStyle(0xfff4a0, 0.2).slice(o.x, o.y, o.r, o.ang - o.v, o.ang + o.v, false).fillPath();
        gs.lineStyle(2, 0xffd23e, 0.5).slice(o.x, o.y, o.r, o.ang - o.v, o.ang + o.v, false).strokePath();
      }
      // Anillos de progreso
      if (o.v >= 0 && !["foco", "aro_zona", "anillo", "medidor"].includes(o.k)) {
        g.lineStyle(6, 0x0a0a0c, 0.8).beginPath().arc(o.x, o.y - 70, 22, 0, Math.PI * 2).strokePath();
        g.lineStyle(4, o.st === "mal" ? 0xff4a4a : o.k.includes("calor") || o.k === "tuberia_caliente" || o.k === "celula" ? 0xff8a3a : 0x7dff6a, 1)
          .beginPath()
          .arc(o.x, o.y - 70, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.v))
          .strokePath();
      }
      if ((o.k === "aro_zona" || o.k === "anillo") && o.v > 0) g.lineStyle(6, 0x7dff6a, 0.9).beginPath().arc(o.x, o.y, o.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.v)).strokePath();
    });
    for (const [id, v] of this.vPz) {
      if (!vistos.has(id)) {
        v.img.destroy();
        v.txt?.destroy();
        this.vPz.delete(id);
      }
    }
    // Rayos de los retos (espejos)
    this.st.retos.forEach((r) => {
      if (r.def !== "x-espejos" || !r.datos || r.estado === "resuelto") return;
      try {
        const d = JSON.parse(r.datos) as { rayo?: number[][] };
        if (!d.rayo || d.rayo.length < 2) return;
        g.lineStyle(9, 0xff3030, 0.3);
        g.beginPath().moveTo(d.rayo[0][0], d.rayo[0][1] - 20);
        for (const [x, y] of d.rayo.slice(1)) g.lineTo(x, y - 20);
        g.strokePath();
        g.lineStyle(3, 0xffd0d0, 1);
        g.beginPath().moveTo(d.rayo[0][0], d.rayo[0][1] - 20);
        for (const [x, y] of d.rayo.slice(1)) g.lineTo(x, y - 20);
        g.strokePath();
      } catch {
        /* datos parciales */
      }
    });
  }

  private crearPz(o: PzObjS): VistaPz {
    let k = o.k;
    if (!this.textures.exists(k)) k = "marca_suelo";
    const plano = PLANOS.has(o.k);
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
    if ((o.k === "cinta" || o.k === "railes" || o.k === "conducto") && o.r > 0) {
      const tex = this.textures.get(k).getSourceImage() as HTMLImageElement;
      img = this.add.tileSprite(o.x, o.y, o.r, tex.height, k);
    } else {
      img = this.add.image(o.x, o.y, k, 0);
    }
    img.setOrigin(0.5, plano ? 0.5 : 0.8);
    let txt: Phaser.GameObjects.Text | undefined;
    if (o.txt) txt = this.add.text(o.x, o.y, o.txt, { ...TEXTO, fontSize: "13px", align: "center", color: "#e8fbff", wordWrap: { width: 220 } }).setOrigin(0.5, 1).setDepth(PROF_UI_MUNDO);
    return { img, txt, k: o.k };
  }

  private actualizarPz(v: VistaPz, o: PzObjS, me: PlayerS | undefined, ahora: number, g: Phaser.GameObjects.Graphics): void {
    const img = v.img;
    const plano = PLANOS.has(o.k);
    let y = o.y;
    if (o.st === "flota" || o.st === "llevada") y -= 10 + Math.sin(ahora / 200) * 6;
    img.setPosition(o.x, y).setDepth(plano ? (o.k === "raiz" ? 5 : 3) : prof(o.y));
    // Tamaño de los que tienen ancho/radio
    if (o.k === "raiz" && o.r > 0) (img as Phaser.GameObjects.Image).setDisplaySize(o.r + 8, 18).setRotation(o.ang).setPosition(o.x - Math.cos(o.ang) * o.r * 0.5, o.y - Math.sin(o.ang) * o.r * 0.5);
    else if ((o.k === "anillo" || o.k === "aro_zona") && o.r > 0) img.setDisplaySize(o.r * 2, o.r * 2);
    else if ((o.k === "baldosa" || o.k === "plataforma" || o.k === "soporte" || o.k === "pasarela_hielo") && o.r > 0) img.setDisplaySize(o.r, o.r);
    else if (o.k === "espejo" || o.k === "interruptor" || o.k === "hueco" || o.k === "componente" || o.k === "ranura" || o.k === "muestra") (img as Phaser.GameObjects.Image).setFrame(o.f);
    // Fotogramas por estado
    const marco: Record<string, string> = { placa: "ok", baldosa: "on", receptor: "ok", alarma: "on", valvula_purga: "ok", valvula_rota: "junta" };
    if (marco[o.k]) (img as Phaser.GameObjects.Image).setFrame(o.st === marco[o.k] ? 1 : 0);
    if (o.k === "estacion") {
      const r = this.st.retos.get(o.reto);
      (img as Phaser.GameObjects.Image).setFrame(({ libre: 0, activo: 1, bloqueado: 2, resuelto: 3 } as Record<string, number>)[r?.estado ?? "libre"] ?? 0);
    }
    // Estados visuales
    let visible = true;
    if (o.st === "oculto") visible = Boolean(me?.bajoTierra);
    img.setVisible(visible);
    const a = 0.65 + 0.35 * Math.sin(ahora / 140);
    if (o.st === "ok") img.setTint(0xb8ffb0).setAlpha(1);
    else if (o.st === "mal") img.setTint(0xff8a8a).setAlpha(1);
    else if (o.st === "pauta") img.setTint(0xffffff).setAlpha(a);
    else if (o.st === "on" || o.st === "lista") img.clearTint().setAlpha(a);
    else if (o.st === "off" || o.st === "usada" || o.st === "cd") img.setTint(0x777777).setAlpha(0.75);
    else img.clearTint().setAlpha(1);
    if (o.k === "anillo") img.setTint(o.st === "ok" ? 0x7dff6a : 0xc08bff);
    if (o.k === "medidor" && o.v >= 0) g.lineStyle(5, 0xe0393e, 1).lineBetween(o.x, o.y - 52, o.x + Math.cos(-Math.PI + o.v * Math.PI) * 18, o.y - 52 + Math.sin(-Math.PI + o.v * Math.PI) * 18);
    if (o.k === "interruptor" && RAYOS_SIMBOLOS[o.f]) img.setAlpha(1);
    // Texto solo cerca (evita saturar la pantalla)
    if (v.txt) {
      const cerca = me && dist(me.x, me.y, o.x, o.y) < 420;
      v.txt.setVisible(Boolean(cerca) && visible).setPosition(o.x, (plano ? o.y - 30 : o.y - 80) - (o.k === "anillo" ? o.r : 0));
      if (o.txt !== v.txt.text) v.txt.setText(o.txt);
    }
  }

  private syncAlmas(t: number): void {
    const vistos = new Set<string>();
    this.st.almas.forEach((s, id) => {
      vistos.add(id);
      let v = this.vAlma.get(id);
      if (!v) {
        const img = this.add.image(s.x, s.y, "alma").setTint(COLOR_ALIEN[s.kind] ?? 0xffffff).setBlendMode(Phaser.BlendModes.SCREEN);
        const nombre = isAlienKind(s.kind) ? ALIENS[s.kind].nombre : s.kind;
        const txt = this.add.text(s.x, s.y - 70, `Alma de ${s.de} (${nombre})`, { ...TEXTO, fontSize: "13px" }).setOrigin(0.5);
        v = { img, txt };
        this.vAlma.set(id, v);
      }
      v.img.setPosition(s.x, s.y - 34 + Math.sin(t / 300) * 6).setDepth(prof(s.y));
      v.txt.setPosition(s.x, s.y - 80).setDepth(PROF_UI_MUNDO);
    });
    for (const [id, v] of this.vAlma) {
      if (!vistos.has(id)) {
        v.img.destroy();
        v.txt.destroy();
        this.vAlma.delete(id);
      }
    }
    if (this.nucleo) {
      let rotos = 0;
      this.st.pz.forEach((o) => o.k === "sabotaje" && o.st === "ok" && rotos++);
      this.nucleo.setFrame(rotos === 3 ? 1 : 0);
    }
  }

  // ------------------------------------------------------------------ oscuridad del Eclipse, apagones y alarmas
  private efectosGlobales(me: PlayerS | undefined): void {
    const st = this.st;
    let alfa = 0;
    let color = 0x05020c;
    if (st.apagon > 0) alfa = 0.78;
    else if (st.eclipse > 0) {
      alfa = 0.5;
      color = 0x14062a;
    } else if (st.crisis === "reactor") {
      alfa = 0.12 + 0.08 * Math.sin(this.time.now / 120);
      color = 0xff1010;
    }
    this.oscuridad.setFillStyle(color, alfa);
    // Linternas durante el apagón
    const necesarias = st.apagon > 0 ? st.jugadores.size : 0;
    while (this.luces.length < necesarias) this.luces.push(this.add.image(0, 0, "luz").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(2.6));
    let i = 0;
    st.jugadores.forEach((p, id) => {
      const l = this.luces[i++];
      if (!l) return;
      const v = this.vJug.get(id);
      l.setVisible(st.apagon > 0 && p.vivo).setPosition(v?.rx ?? p.x, (v?.ry ?? p.y) - 30).setDepth(PROF_UI_MUNDO - 29);
    });
    for (let k = i; k < this.luces.length; k++) this.luces[k].setVisible(false);
    void me;
  }

  // ------------------------------------------------------------------ pings
  private ping(m: PingEvent): void {
    const img = this.add.image(m.x, m.y - 40, `ping_${m.tipo}`).setDepth(PROF_UI_MUNDO + 50).setScale(0);
    this.tweens.add({ targets: img, scale: 1, duration: 250, ease: "Back.Out" });
    this.tweens.add({ targets: img, y: m.y - 52, yoyo: true, repeat: -1, duration: 400, ease: "Sine.InOut" });
    this.vPing.push({ img, hasta: this.time.now + 6000 });
    this.c.ui.pings.push({ de: m.de, tipo: m.tipo, x: m.x, y: m.y, hasta: performance.now() + 6000 });
    sfx.ping();
    const quien = this.st.jugadores.get(m.de);
    if (quien) this.c.chat.sistema(`📍 ${quien.nombre}: ${{ ayuda: "¡Ayuda!", aqui: "Aquí", defiendan: "¡Defiendan!", voy: "Voy" }[m.tipo]}`, isAlienKind(quien.kind) ? ALIENS[quien.kind].colorCss : "#fff");
  }

  private syncPings(): void {
    const now = this.time.now;
    this.vPing = this.vPing.filter((p) => {
      if (now < p.hasta) return true;
      p.img.destroy();
      return false;
    });
    const t = performance.now();
    this.c.ui.pings = this.c.ui.pings.filter((p) => p.hasta > t);
  }

  // ------------------------------------------------------------------ apuntado y avisos de interacción
  private dibujarApuntado(me: PlayerS | undefined): void {
    const g = this.gApunte.clear();
    if (!me || !me.vivo || me.estado !== "ok" || this.c.ui.minijuego || !isAlienKind(me.forma)) return;
    const f = me.forma;
    const rangos: Partial<Record<AlienKind, number>> = { delmar: HAB.delmar.range, inteligente: HAB.inteligente.range, vesper: HAB.vesper.range, freeze: HAB.freeze.wallRange, simbionte: 380, cambiaformas: HAB.cambiaformas.scanRange, curandera: HAB.curandera.captureRange };
    const rango = rangos[f];
    if (!rango) return;
    const color = ALIENS[f].color;
    const o = this.origenControl(me);
    g.lineStyle(2, color, me.enfriamiento > 0 ? 0.12 : 0.3).strokeCircle(o.x, o.y, rango);
    if (this.c.ui.tactil) return;
    const t = this.objetivo();
    // Resaltar el objetivo bajo el cursor
    let tgt: { x: number; y: number } | null = null;
    let bd = 80;
    this.st.unidades.forEach((u) => {
      if (u.team !== "humanos") return;
      const d = dist(t.x, t.y, u.x, u.y);
      if (d < bd) {
        bd = d;
        tgt = u;
      }
    });
    if (!tgt)
      this.st.pz.forEach((p) => {
        const d = dist(t.x, t.y, p.x, p.y);
        if (d < 70 && d < bd) {
          bd = d;
          tgt = p;
        }
      });
    if (f === "freeze") {
      // Vista previa del muro de hielo
      const ang = Math.atan2(t.y - o.y, t.x - o.x);
      const d = Math.min(rango, dist(o.x, o.y, t.x, t.y));
      const cx = o.x + Math.cos(ang) * d;
      const cy = o.y + Math.sin(ang) * d;
      g.lineStyle(3, 0x6fd6ff, 0.6);
      for (let i = -1; i <= 1; i++) g.strokeCircle(cx - Math.sin(ang) * i * 50, cy + Math.cos(ang) * i * 50, 24);
      return;
    }
    if (tgt) {
      const tt = tgt as { x: number; y: number };
      const lejos = dist(o.x, o.y, tt.x, tt.y) > rango + 40;
      g.lineStyle(3, lejos ? 0x888888 : color, 0.9).strokeEllipse(tt.x, tt.y, 72, 36);
    }
  }

  private calcularPrompt(me: PlayerS | undefined): string {
    if (!me) return "";
    const solo = this.st.equipo <= 1;
    if (me.fantasma) return solo ? "Caíste… la cápsula de emergencia te devolverá en el punto de control." : "Eres un fantasma: tus compañeros pueden usar tu alma. Volverás en el próximo punto de control.";
    if (!me.vivo) return "";
    if (me.estado === "congelado") return solo ? "¡Congelado! Te soltarás en unos segundos." : "¡Estás congelado! Un compañero debe mantener E junto a ti.";
    if (me.estado === "red") return solo ? "¡Atrapado en una red! Te soltarás en unos segundos." : "¡Atrapado en una red! Un compañero debe mantener E junto a ti.";
    if (me.estado === "agarrado") return "¡Un cazador te agarra! Pulsa E repetidamente para soltarte (o que te ayuden).";
    if (me.controla) return "Controlas a un guardia: muévelo y dispara. Habilidad para soltarlo · E para que pulse algo.";
    if (me.tunel === 1) return "Túnel: ve hasta la salida y pulsa R otra vez.";
    const x = me.x;
    const y = me.y;
    let txt = "";
    this.st.jugadores.forEach((o, id) => {
      if (txt || id === this.room.sessionId || !o.vivo || (o.estado !== "congelado" && o.estado !== "red" && o.estado !== "agarrado")) return;
      if (dist(x, y, o.x, o.y) <= INTERACT_RANGE) txt = `[Mantén E] Liberar a ${o.nombre}`;
    });
    if (txt) return txt;
    this.st.almas.forEach((s) => {
      if (!txt && dist(x, y, s.x, s.y) <= INTERACT_RANGE) txt = `[E] Recoger el alma de ${s.de} (${isAlienKind(s.kind) ? ALIENS[s.kind].nombre : s.kind})`;
    });
    if (txt) return txt;
    // Objeto de reto o estación más cercana
    let mejor: PzObjS | null = null;
    let bd = 120;
    this.st.pz.forEach((o) => {
      if (!o.txt || o.st === "oculto") return;
      const d = dist(x, y, o.x, o.y);
      if (d < bd) {
        bd = d;
        mejor = o;
      }
    });
    if (mejor) {
      const o = mejor as PzObjS;
      const r = this.st.retos.get(o.reto);
      if (r) {
        const def = retoDef(r.def);
        if (r.estado === "resuelto") return `${def?.nombre ?? ""}: resuelto ✔`;
        if (r.estado === "bloqueado") return `${def?.nombre ?? ""}: bloqueado ${Math.ceil(r.tiempo)} s`;
        return `${o.txt} — ${r.texto}`;
      }
      if (o.k === "capsula") return o.st === "lista" ? "[Mantén E] Cápsula de reanimación (si hay compañeros caídos)" : "Cápsula usada";
      if (o.k === "sabotaje") return o.st === "ok" ? "Estación saboteada ✔" : "[Mantén E] Sabotear el depósito del Jefe";
      if (o.k === "refrigerante") return o.st === "cd" ? "Válvula recargándose…" : "[Mantén E] Refrigerante (cuando el Centinela pase del 70% de calor)";
      if (o.k === "parche") return "[Mantén E] Re-estabilizar la estación";
      return o.txt;
    }
    if (me.almas.length) {
      let cerca = "";
      this.st.jugadores.forEach((o, id) => {
        if (!cerca && id !== this.room.sessionId && o.vivo && dist(x, y, o.x, o.y) < 140) cerca = o.nombre;
      });
      return cerca ? `[G] Pasar un alma a ${cerca} · [Q] cambiar de forma` : "[Q] Cambiar de forma (llevas almas)";
    }
    return "";
  }
}
