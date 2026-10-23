// El mapa, las entidades y el control del jugador local (con predicción del movimiento).
import {
  ALIENS,
  ENEMIES,
  INTERACT_RANGE,
  PING_TYPES,
  PROP_RADIUS,
  PUZZLES,
  TELEQUINESIS,
  TICK_DT,
  TILE,
  TRANSMUTAR,
  dist,
  isAlienKind,
  stepPlayer,
  type AlienKind,
  type Circle,
  type EnemyType,
  type FxEvent,
  type InputMsg,
  type MapObject,
  type PingEvent,
} from "@dawg/shared";
import Phaser from "phaser";
import type { GameStateS, PlayerS, ProjectileS } from "../../net/tipos";
import { ayudaControles } from "../../ui/ayuda";
import { ALTURA, COLOR_ALIEN, PROF_UI_MUNDO, TEXTO, actualizarReloj, ctx, prof, type Ctx } from "../contexto";
import { Efectos } from "../efectos";
import { alternarSonido, sfx } from "../sonido";
import { VistaPersonaje } from "../vistas";

const TICK_MS = TICK_DT * 1000;

interface VistaProyectil {
  img: Phaser.GameObjects.Image;
  sombra?: Phaser.GameObjects.Image;
  t0: number;
}

const DECOR_ORIGEN: Record<string, number> = { holograma: 0.72, nucleo: 0.7, mesa: 0.75, consola: 0.8, estanteria: 0.82 };

export class Mundo extends Phaser.Scene {
  c!: Ctx;
  private efectos!: Efectos;
  private teclas!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  // Predicción del jugador local
  private pred: { x: number; y: number } | null = null;
  private render = { x: 0, y: 0 };
  private pendientes: InputMsg[] = [];
  private seq = 0;
  private acc = 0;
  private ultimoAck = -1;
  private ultimoServidor = { x: NaN, y: NaN };
  aim = 0;
  // Vistas
  private vJug = new Map<string, VistaPersonaje>();
  private vUni = new Map<string, VistaPersonaje>();
  private vSimple = new Map<string, Phaser.GameObjects.Image>();
  private vProy = new Map<string, VistaProyectil>();
  private vZona = new Map<string, Phaser.GameObjects.Image>();
  private vObj = new Map<string, Phaser.GameObjects.Image>();
  private vAlma = new Map<string, { img: Phaser.GameObjects.Image; txt: Phaser.GameObjects.Text }>();
  private vPuerta = new Map<string, Phaser.GameObjects.Sprite>();
  private vEstacion = new Map<string, { spr: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text; obj: MapObject }>();
  private vInterruptor: Phaser.GameObjects.Sprite[] = [];
  private vPalanca: { spr: Phaser.GameObjects.Sprite; obj: MapObject }[] = [];
  private vSlot: { img: Phaser.GameObjects.Image; obj: MapObject }[] = [];
  private vBoton?: Phaser.GameObjects.Sprite;
  private vPing: { img: Phaser.GameObjects.Image; hasta: number }[] = [];
  private nucleo?: Phaser.GameObjects.Image;
  private gLaser!: Phaser.GameObjects.Graphics;
  private gApunte!: Phaser.GameObjects.Graphics;
  private salida?: Phaser.GameObjects.Image;
  private puentes = new Set<number>();
  private vidaPrev = -1;

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
    const map = this.make.tilemap({ key: "area1" });
    const ts = map.addTilesetImage("laboratorio", "tiles")!;
    map.createLayer("suelo", ts, 0, 0)!.setDepth(0);
    map.createLayer("paredes", ts, 0, 0)!.setDepth(1);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setBackgroundColor("#0b2328");
    this.ajustarZoom();
    this.scale.on("resize", () => this.ajustarZoom());
    this.efectos = new Efectos(this);
    this.gLaser = this.add.graphics().setDepth(PROF_UI_MUNDO - 10).setBlendMode(Phaser.BlendModes.ADD);
    this.gApunte = this.add.graphics().setDepth(PROF_UI_MUNDO - 5);
    this.crearEscenario();

    // Entrada
    const kb = this.input.keyboard!;
    this.teclas = kb.addKeys("W,A,S,D") as typeof this.teclas;
    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor("crosshair");
    const libre = () => !this.c.chat.abierto;
    kb.on("keydown-E", () => libre() && this.room.send("interactuar", { down: true }));
    kb.on("keyup-E", () => this.room.send("interactuar", { down: false }));
    kb.on("keydown-SPACE", () => libre() && !this.c.ui.minijuego && this.usarHabilidad());
    kb.on("keydown-Q", () => libre() && this.room.send("cambiar"));
    kb.on("keydown-G", () => libre() && this.room.send("dar"));
    kb.on("keydown-ENTER", () => {
      if (!this.c.chat.abierto) {
        this.c.chat.abrir();
        this.room.send("interactuar", { down: false });
      }
    });
    kb.on("keydown-M", () => libre() && (this.c.ui.mapaGrande = !this.c.ui.mapaGrande));
    kb.on("keydown-H", () => libre() && ayudaControles());
    kb.on("keydown-N", () => libre() && this.c.chat.sistema(alternarSonido() ? "Sonido activado" : "Sonido silenciado"));
    kb.on("keydown-R", () => libre() && (this.st.fase === "victoria" || this.st.fase === "derrota") && this.room.send("reiniciar"));
    PING_TYPES.forEach((tipo, i) => {
      kb.on(`keydown-${["ONE", "TWO", "THREE", "FOUR"][i]}`, () => {
        if (!libre()) return;
        const wp = this.mouseMundo();
        this.room.send("ping", { tipo, x: wp.x, y: wp.y + ALTURA });
      });
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() && !this.c.ui.minijuego && libre()) this.usarHabilidad();
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => this.room.send("interactuar", { down: false }));

    // Mensajes del servidor
    this.room.onMessage("fx", (e: FxEvent) => this.efectos.play(e));
    this.room.onMessage("ping", (m: PingEvent) => this.ping(m));
  }

  private ajustarZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const z = Phaser.Math.Clamp(Math.min(w / 1280, h / 760), 0.55, 1.15);
    this.cameras.main.setZoom(z);
  }

  mouseMundo(): { x: number; y: number } {
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  private usarHabilidad(): void {
    const wp = this.mouseMundo();
    this.room.send("habilidad", { x: wp.x, y: wp.y + ALTURA * 0.8 });
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
      this.vPuerta.set(o.name, s);
    }
    for (const o of w.find("station")) {
      const def = PUZZLES[o.name];
      const spr = this.add.sprite(o.x, o.y, "estacion", 0).setOrigin(0.5, 0.8).setScale(0.85).setDepth(prof(o.y));
      const rol = def.roles.map((r) => ALIENS[r].nombre).join(" + ");
      const txt = this.add
        .text(o.x, o.y - 86, `${def.nombre}\n${rol}`, { ...TEXTO, fontSize: "14px", align: "center", color: "#" + COLOR_ALIEN[def.roles[0]].toString(16) })
        .setOrigin(0.5, 1)
        .setDepth(PROF_UI_MUNDO);
      this.vEstacion.set(o.name, { spr, txt, obj: o });
    }
    for (const o of w.find("switch")) {
      const s = this.add.sprite(o.x, o.y, "interruptor", Number(o.props.simbolo)).setOrigin(0.5, 0.8).setDepth(prof(o.y));
      this.vInterruptor.push(s);
    }
    for (const o of w.find("lever")) {
      const spr = this.add.sprite(o.x, o.y, "palanca", 0).setOrigin(0.5, 0.85).setDepth(prof(o.y));
      this.add.text(o.x, o.y - 70, `Palanca ${o.props.parte}\n${o.props.parte === "A" ? "Cambiaformas" : "Del mar"}`, { ...TEXTO, fontSize: "13px", align: "center" }).setOrigin(0.5, 1).setDepth(PROF_UI_MUNDO);
      this.vPalanca.push({ spr, obj: o });
    }
    for (const o of w.find("slot")) {
      const img = this.add.image(o.x, o.y, "marca_suelo").setScale(0.6).setDepth(3).setVisible(false).setTint(0xffd23e);
      this.vSlot.push({ img, obj: o });
    }
    const disp = w.findOne("dispenser");
    if (disp) {
      this.add.image(disp.x, disp.y, "dispensador").setOrigin(0.5, 0.8).setDepth(prof(disp.y));
      this.add.text(disp.x, disp.y - 80, "Dispensador de bloques\n(telequinesis)", { ...TEXTO, fontSize: "13px", align: "center", color: "#c08bff" }).setOrigin(0.5, 1).setDepth(PROF_UI_MUNDO);
    }
    const btn = w.findOne("button");
    if (btn) this.vBoton = this.add.sprite(btn.x, btn.y, "boton", 0).setOrigin(0.5, 0.7).setDepth(prof(btn.y));
    const exit = w.findOne("exit");
    if (exit) {
      this.salida = this.add.image(exit.x + exit.w / 2, exit.y + 40, "salida").setDepth(prof(exit.y + 40)).setAlpha(0.5);
    }
  }

  // ------------------------------------------------------------------ bucle
  override update(_t: number, delta: number): void {
    const st = this.st;
    if (!st) return;
    const dt = delta / 1000;
    actualizarReloj(st.tiempo);
    this.syncMundo();
    const me = st.jugadores.get(this.room.sessionId);
    this.predecir(delta, me);
    this.syncJugadores(dt);
    this.syncUnidades(dt);
    this.syncProyectiles();
    this.syncZonas();
    this.syncObjetos();
    this.syncAlmas(_t);
    this.syncEstaciones();
    this.syncPings();
    this.dibujarApuntado(me);
    this.c.ui.prompt = this.calcularPrompt(me);
    if (me) {
      if (this.vidaPrev >= 0 && me.hp < this.vidaPrev) this.cameras.main.shake(120, 0.004);
      this.vidaPrev = me.hp;
    }
  }

  /** Puertas y puentes en el mundo local (para que la predicción choque igual que el servidor). */
  private syncMundo(): void {
    this.st.puertas.forEach((d, id) => {
      this.c.world.setDoor(id, d.abierta);
      const s = this.vPuerta.get(id);
      if (s && Number(s.frame.name) !== (d.abierta ? 1 : 0)) s.setFrame(d.abierta ? 1 : 0);
    });
    const ahora = new Set<number>();
    this.st.objetos.forEach((o) => {
      if (o.k === "puente") ahora.add(Math.floor(o.y / TILE) * this.c.world.w + Math.floor(o.x / TILE));
    });
    for (const i of this.puentes) if (!ahora.has(i)) this.c.world.setBridge(i % this.c.world.w, Math.floor(i / this.c.world.w), false);
    for (const i of ahora) if (!this.puentes.has(i)) this.c.world.setBridge(i % this.c.world.w, Math.floor(i / this.c.world.w), true);
    this.puentes = ahora;
    this.salida?.setAlpha(this.st.puertas.get("D8")?.abierta ? 1 : 0.4);
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
    return { x: p.x, y: p.y, kind: me.kind as AlienKind, status: me.estado, confused: me.confuso, ghost: me.fantasma, locked: me.ocupado !== "" };
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
    // Reconciliar con la posición que confirma el servidor
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
      const inp = this.leerInput();
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
    const wp = this.mouseMundo();
    this.aim = Math.atan2(wp.y - (this.render.y - ALTURA), wp.x - this.render.x);
  }

  private leerInput(): InputMsg {
    const libre = !this.c.chat.abierto && this.st.fase === "jugando";
    const k = this.teclas;
    const mx = libre ? (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0) : 0;
    const my = libre ? (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0) : 0;
    const p = this.input.activePointer;
    const shoot = libre && !this.c.ui.minijuego && p.isDown && p.leftButtonDown();
    return { seq: ++this.seq, mx, my, aim: this.aim, shoot };
  }

  // ------------------------------------------------------------------ jugadores
  private syncJugadores(dt: number): void {
    const vivos = new Set<string>();
    this.st.jugadores.forEach((p, id) => {
      vivos.add(id);
      const yo = id === this.room.sessionId;
      let v = this.vJug.get(id);
      if (!v) {
        v = new VistaPersonaje(this, p.kind, p.x, p.y, { nombre: yo ? undefined : p.nombre, color: COLOR_ALIEN[p.kind] });
        this.vJug.set(id, v);
        if (yo) this.cameras.main.startFollow(v.cuerpo, true, 0.12, 0.12, 0, 30);
      }
      if (yo) {
        v.rx = this.render.x;
        v.ry = this.render.y;
      } else v.seguir(p.x, p.y, dt);
      v.setSheet(p.disfrazado ? "cambiaformas_humano" : p.kind);
      const fantasma = p.fantasma;
      v.cuerpo.setAlpha(fantasma ? 0.4 : 1);
      v.sombra.setVisible(!fantasma);
      v.arma?.setVisible(!fantasma && p.estado === "ok");
      if (fantasma) v.cuerpo.setTint(0xbfe6ff);
      else if (p.confuso > 0) v.cuerpo.setTint(0xd9b8ff);
      else v.cuerpo.clearTint();
      v.setOverlay(p.estado === "congelado" ? "hielo" : p.estado === "red" ? "red_trampa" : null);
      v.actualizar(yo ? this.aim : p.aim, null, dt, fantasma ? undefined : p.hp, p.maxHp);
      if (fantasma) v.cuerpo.y -= 10 + Math.sin(this.time.now / 300) * 4;
      // Progreso de rescate
      if (p.rescate > 0 && p.estado !== "ok") {
        v.barra.lineStyle(5, 0x7dff6a, 1).beginPath().arc(v.rx, v.ry - 45, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.rescate).strokePath();
      }
    });
    for (const [id, v] of this.vJug) {
      if (!vivos.has(id)) {
        v.destruir();
        this.vJug.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ unidades
  private syncUnidades(dt: number): void {
    const vistas = new Set<string>();
    this.gLaser.clear();
    this.st.unidades.forEach((u, id) => {
      vistas.add(id);
      if (u.t === "torreta" || u.t === "sensor") {
        let img = this.vSimple.get(id);
        if (!img) {
          img = this.add.image(u.x, u.y, u.t).setOrigin(0.5, 0.75).setDepth(prof(u.y));
          this.vSimple.set(id, img);
          if (u.t === "torreta") {
            const canon = this.add.image(u.x, u.y - 24, "torreta_canon").setOrigin(0.25, 0.5).setDepth(prof(u.y) + 1);
            this.vSimple.set(id + ":c", canon);
          }
        }
        this.vSimple.get(id + ":c")?.setRotation(u.ang);
        if (u.t === "sensor") img.setScale(1 + Math.sin(this.time.now / 200) * 0.05);
        return;
      }
      let v = this.vUni.get(id);
      if (!v) {
        v = new VistaPersonaje(this, u.t, u.x, u.y, { escala: u.t === "pulpo" ? 0.75 : u.t === "perro" ? 0.85 : 1 });
        this.vUni.set(id, v);
      }
      v.seguir(u.x, u.y, dt);
      if (u.t === "escudo" && !u.escudo) v.quitarEscudo();
      v.setAura(u.blindado, 0x3ef0ff);
      if (u.st === "aturdido") v.cuerpo.setTint(0x9aa0ff);
      else v.cuerpo.clearTint();
      v.actualizar(u.ang, u.moviendo, dt, u.t === "jefe" ? undefined : u.hp, u.maxHp);
      if (u.st === "apuntando") {
        const ox = u.x + Math.cos(u.ang) * 30;
        const oy = u.y + Math.sin(u.ang) * 30;
        const tx = u.x + Math.cos(u.ang) * 1400;
        const ty = u.y + Math.sin(u.ang) * 1400;
        const hit = this.c.world.raycast(ox, oy, tx, ty);
        const ex = hit ? hit.x : tx;
        const ey = hit ? hit.y : ty;
        this.gLaser.lineStyle(1.5 + u.stT * 3, 0xff2020, 0.35 + u.stT * 0.6).lineBetween(ox, oy - ALTURA, ex, ey - ALTURA);
      }
    });
    for (const [id, v] of this.vUni) {
      if (!vistas.has(id)) {
        v.destruir();
        this.vUni.delete(id);
      }
    }
    for (const [id, img] of this.vSimple) {
      if (!vistas.has(id.split(":")[0])) {
        img.destroy();
        this.vSimple.delete(id);
      }
    }
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
        v.img.setPosition(gx, gy - Math.sin(Math.PI * k) * 90 - 20 * (1 - k)).setRotation(t * 10).setDepth(prof(gy) + 50);
        v.sombra?.setPosition(gx, gy).setDepth(prof(gy) - 40);
      } else {
        const x = pr.x + pr.vx * t;
        const y = pr.y + pr.vy * t;
        v.img.setPosition(x, y - ALTURA).setDepth(prof(y) + 20);
        if (pr.k.startsWith("tq_")) v.img.rotation += 0.3;
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
    const k = pr.k.startsWith("tq_") ? pr.k.slice(3) : pr.k;
    const img = this.add.image(pr.x, pr.y, k).setRotation(Math.atan2(pr.vy, pr.vx));
    if (pr.k.startsWith("tq_")) img.setScale(0.8).setTint(0xe0c8ff);
    if (["bala", "bala_roja", "energia", "psiquico", "rayo_franco"].includes(pr.k)) img.setBlendMode(Phaser.BlendModes.ADD);
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
      if (!img) {
        img = this.add.image(z.x, z.y, z.k === "acido" ? "acido" : z.k === "gas" ? "gas" : "fuego").setDepth(z.k === "gas" ? prof(z.y) + 200 : 4);
        const base = z.k === "acido" ? 120 : z.k === "gas" ? 150 : 60;
        img.setScale((z.r * 2) / base);
        if (z.k === "gas") img.setAlpha(0.85);
        this.vZona.set(id, img);
      }
      if (z.k === "fuego") img.setScale(((z.r * 2) / 60) * (1 + Math.sin(this.time.now / 90 + z.x) * 0.08));
      if (z.vida < 1) img.setAlpha(Math.max(0, z.vida) * (z.k === "gas" ? 0.85 : 1));
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
        const plano = o.k === "puente" || o.k === "charco_agua";
        img = this.add.image(o.x, o.y, o.k).setOrigin(0.5, plano ? 0.5 : 0.8);
        if (o.k === "cobertura" || o.k === "puente") {
          img.setScale(0.2);
          this.tweens.add({ targets: img, scale: 1, duration: 300, ease: "Back.Out" });
        }
        this.vObj.set(id, img);
      }
      img.setPosition(o.x, o.y);
      img.setDepth(o.k === "puente" ? 2 : o.k === "charco_agua" ? 3 : o.st === "sostenido" ? prof(o.y) + 100 : prof(o.y));
      if (o.k === "bloque") {
        if (o.st === "hundiendo") {
          img.setTint(0x9fffa0).setAlpha(0.6 + 0.4 * Math.min(1, o.t / 3));
          img.setScale(0.7 + 0.3 * Math.min(1, o.t / 9));
        } else img.clearTint().setAlpha(1).setScale(0.8);
      }
      if (o.k === "cobertura") img.setAlpha(o.t < 3 ? 0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 120)) : 1);
    });
    for (const [id, img] of this.vObj) {
      if (!vistos.has(id)) {
        img.destroy();
        this.vObj.delete(id);
      }
    }
  }

  private syncAlmas(t: number): void {
    const vistos = new Set<string>();
    this.st.almas.forEach((s, id) => {
      vistos.add(id);
      let v = this.vAlma.get(id);
      if (!v) {
        const img = this.add.image(s.x, s.y, "alma").setTint(COLOR_ALIEN[s.kind] ?? 0xffffff).setBlendMode(Phaser.BlendModes.SCREEN);
        const txt = this.add.text(s.x, s.y - 70, `Alma de ${s.de}`, { ...TEXTO, fontSize: "13px" }).setOrigin(0.5);
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
  }

  private syncEstaciones(): void {
    const frame: Record<string, number> = { libre: 0, activo: 1, bloqueado: 2, resuelto: 3 };
    for (const [id, v] of this.vEstacion) {
      const pz = this.st.puzzles.get(id);
      if (!pz) continue;
      v.spr.setFrame(frame[pz.estado] ?? 0);
      v.txt.setAlpha(pz.estado === "resuelto" ? 0.45 : 1);
    }
    const p4 = this.st.puzzles.get("p4");
    const brillo = p4?.estado === "activo" ? 0.75 + Math.sin(this.time.now / 160) * 0.25 : 1;
    for (const s of this.vInterruptor) s.setAlpha(brillo);
    const p6 = this.st.puzzles.get("p6");
    let fase = "";
    if (p6?.estado === "activo" && p6.datos) {
      try {
        fase = JSON.parse(p6.datos).fase;
      } catch {
        fase = "";
      }
    }
    for (const l of this.vPalanca) l.spr.setFrame(fase === "ritmo" || p6?.estado === "resuelto" ? 1 : 0);
    const p5 = this.st.puzzles.get("p5");
    for (const s of this.vSlot) {
      let ocupado = false;
      this.st.objetos.forEach((o) => {
        if ((o.k === "bloque" || o.k === "puente") && o.st !== "sostenido" && Math.abs(o.x - s.obj.x) < 10 && Math.abs(o.y - s.obj.y) < 10) ocupado = true;
      });
      s.img.setVisible(p5?.estado === "activo" && !ocupado).setAlpha(0.6 + Math.sin(this.time.now / 200) * 0.3);
    }
    this.vBoton?.setFrame(p5?.estado === "resuelto" ? 1 : 0);
    if (this.nucleo) {
      const rotos = ["n1", "n2", "n3"].filter((n) => this.st.puzzles.get(n)?.estado === "resuelto").length;
      this.nucleo.setFrame(rotos === 3 ? 1 : 0);
    }
  }

  // ------------------------------------------------------------------ pings
  private ping(m: PingEvent): void {
    const img = this.add.image(m.x, m.y - 40, `ping_${m.tipo}`).setDepth(PROF_UI_MUNDO + 50).setScale(0);
    this.tweens.add({ targets: img, scale: 1, duration: 250, ease: "Back.Out" });
    this.tweens.add({ targets: img, y: m.y - 52, yoyo: true, repeat: -1, duration: 400, ease: "Sine.InOut" });
    const hasta = this.time.now + 6000;
    this.vPing.push({ img, hasta });
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
    if (!me || !me.vivo || me.estado !== "ok" || this.c.ui.minijuego) return;
    const hab = me.habilidad;
    if (hab !== "transmutar" && hab !== "telequinesis") return;
    const rango = hab === "transmutar" ? TRANSMUTAR.range : TELEQUINESIS.range;
    const color = hab === "transmutar" ? 0xff8a3a : 0xc08bff;
    g.lineStyle(2, color, me.enfriamiento > 0 ? 0.12 : 0.3).strokeCircle(this.render.x, this.render.y, rango);
    const wp = this.mouseMundo();
    const tx = wp.x;
    const ty = wp.y + ALTURA * 0.8;
    // Resaltar el objetivo bajo el cursor
    let tgt: { x: number; y: number; r: number } | null = null;
    let bd = 70;
    this.st.unidades.forEach((u) => {
      if (u.team !== "humanos" || u.t === "sensor") return;
      if (hab === "transmutar" && !(ENEMIES[u.t as EnemyType]?.convertible || u.t === "torreta")) return;
      if (hab === "telequinesis" && u.t === "jefe") return;
      const d = dist(tx, ty, u.x, u.y);
      if (d < bd) {
        bd = d;
        tgt = { x: u.x, y: u.y, r: 30 };
      }
    });
    if (!tgt) {
      this.st.objetos.forEach((o) => {
        const ok = o.k === "barril" || o.k === "caja" || (hab === "transmutar" && ((o.k === "bloque" && o.st === "hundiendo") || o.k === "charco_agua"));
        if (!ok) return;
        const d = dist(tx, ty, o.x, o.y);
        if (d < 60 && d < bd) {
          bd = d;
          tgt = { x: o.x, y: o.y, r: 30 };
        }
      });
    }
    const lejos = dist(this.render.x, this.render.y, tx, ty) > rango;
    if (tgt) {
      const t = tgt as { x: number; y: number; r: number };
      g.lineStyle(3, lejos ? 0x888888 : color, 0.9).strokeEllipse(t.x, t.y, t.r * 2.4, t.r * 1.2);
    }
  }

  private calcularPrompt(me: PlayerS | undefined): string {
    if (!me) return "";
    if (me.fantasma) return "Eres un fantasma: puedes moverte y mirar. Volverás en el Área 2.";
    if (!me.vivo) return "";
    if (me.estado === "congelado") return "¡Estás congelado! Un compañero debe mantener E junto a ti.";
    if (me.estado === "red") return "¡Atrapado en una red! Un compañero debe mantener E junto a ti.";
    const x = me.x;
    const y = me.y;
    let txt = "";
    this.st.jugadores.forEach((o, id) => {
      if (txt || id === this.room.sessionId || !o.vivo || (o.estado !== "congelado" && o.estado !== "red")) return;
      if (dist(x, y, o.x, o.y) <= INTERACT_RANGE) txt = `[Mantén E] ${o.estado === "red" ? "Cortar la red de" : "Descongelar a"} ${o.nombre}`;
    });
    if (txt) return txt;
    this.st.almas.forEach((s) => {
      if (!txt && dist(x, y, s.x, s.y) <= INTERACT_RANGE) txt = `[E] Recoger el alma de ${s.de}`;
    });
    if (txt) return txt;
    for (const [id, v] of this.vEstacion) {
      if (dist(x, y, v.obj.x, v.obj.y) > INTERACT_RANGE + 10) continue;
      const pz = this.st.puzzles.get(id);
      const def = PUZZLES[id];
      if (!pz) continue;
      if (pz.estado === "resuelto") return `${def.nombre}: resuelto ✔`;
      if (pz.estado === "bloqueado") return `${def.nombre}: bloqueada ${Math.ceil(pz.tiempo)} s`;
      const rol = def.roles[0];
      const puede = me.kind === rol || me.almas.includes(rol);
      if (pz.estado === "activo")
        return id === "p4" ? (pz.solo ? "Memoriza el código y actívalo con telequinesis en los interruptores (Q para cambiar)." : "Código en pantalla: díctalo a tu compañero (Enter para chatear).") : `${def.nombre}: en curso…`;
      if (!puede) return `${def.nombre}: solo ${ALIENS[rol].nombre}`;
      if ((def.minijuego === "identidad" || id === "p4") && !me.disfrazado) return `${def.nombre}: primero disfrázate (ESPACIO)`;
      return `[E] ${def.nombre}`;
    }
    for (const l of this.vPalanca) {
      if (dist(x, y, l.obj.x, l.obj.y) <= INTERACT_RANGE + 10) {
        const p6 = this.st.puzzles.get("p6");
        if (p6?.estado === "activo") return "Esclusa en marcha: sigue el ritmo";
        return `[E] Palanca ${l.obj.props.parte} (${l.obj.props.parte === "A" ? "Cambiaformas" : "Del mar"})`;
      }
    }
    const btn = this.c.world.findOne("button");
    if (btn && dist(x, y, btn.x, btn.y) <= INTERACT_RANGE + 10) return this.st.puzzles.get("p5")?.estado === "activo" ? "[E] Pulsar el botón (con el puente completo)" : "Botón del puente";
    const disp = this.c.world.findOne("dispenser");
    if (disp && me.habilidad === "telequinesis" && dist(x, y, disp.x, disp.y) < 360) return "[ESPACIO sobre el dispensador] Tomar un bloque · luego ESPACIO sobre una casilla del ácido";
    if (me.almas.length) {
      let cerca = "";
      this.st.jugadores.forEach((o, id) => {
        if (!cerca && id !== this.room.sessionId && o.vivo && dist(x, y, o.x, o.y) < 140) cerca = o.nombre;
      });
      if (cerca) return `[G] Pasar el alma a ${cerca} · [Q] cambiar de habilidad`;
    }
    return "";
  }
}
