import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/index.ts
import { Server, matchMaker as matchMaker2 } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { existsSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";

// ../shared/src/constants.ts
var TILE = 64;
var TICK_RATE = 30;
var TICK_DT = 1 / TICK_RATE;
var PATCH_RATE = 20;
var PLAYERS_PER_ROOM = 3;
var PLAYER_RADIUS = 18;
var GHOST_SPEED = 260;
var INTERACT_RANGE = 90;
var FREEZE_AUTO_THAW = 15;
var NET_AUTO_FREE = 12;
var MINIGAME_DURATION = 60;
var MINIGAME_MIN = 30;
var MINIGAME_BONUS = 5;
var MINIGAME_LOCK = 30;
var CORE_STATION_DURATION = MINIGAME_DURATION;
var SOLO_TIME_FACTOR = 1.5;
var MAX_ENEMIES_ALIVE = 28;
var PROP_RADIUS = {
  barril: 20,
  caja: 24,
  cobertura: 34
};
var BOTIQUIN_CURA = 45;
var PING_TYPES = ["ayuda", "aqui", "defiendan", "voy"];
var ROOM_CODE_LENGTH = 4;
var LOBBY_BOUNDS = { minX: 0.12, maxX: 0.88, minY: 0.42, maxY: 0.84 };
var ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

// ../shared/src/aliens.ts
var ALIEN_KINDS = ["cambiaformas", "delmar", "inteligente"];
var ALIENS = {
  cambiaformas: {
    kind: "cambiaformas",
    nombre: "Cambiaformas",
    descripcion: "Se disfraza de humano: los soldados no lo atacan mientras dure el disfraz.",
    color: 8368714,
    colorCss: "#7fb24a",
    hp: 120,
    speed: 215,
    weapon: { nombre: "Pistola robada", damage: 14, fireRate: 4, bulletSpeed: 950, range: 700, pierce: 0, projectile: "bala" },
    ability: "disfraz"
  },
  delmar: {
    kind: "delmar",
    nombre: "Del mar",
    descripcion: "Transmuta: convierte objetos en cobertura y soldados en pulpos (m\xE1x. 3).",
    color: 15764004,
    colorCss: "#f08a24",
    hp: 150,
    speed: 195,
    weapon: { nombre: "Lanza de energ\xEDa", damage: 22, fireRate: 2.5, bulletSpeed: 780, range: 650, pierce: 1, projectile: "energia" },
    ability: "transmutar"
  },
  inteligente: {
    kind: "inteligente",
    nombre: "Inteligente",
    descripcion: "Telequinesis: levanta y lanza enemigos u objetos, activa cosas a distancia.",
    color: 10849520,
    colorCss: "#a58cf0",
    hp: 110,
    speed: 205,
    weapon: { nombre: "Rayo ps\xEDquico", damage: 10, fireRate: 6, bulletSpeed: 1050, range: 620, pierce: 0, projectile: "psiquico" },
    ability: "telequinesis"
  }
};
var ABILITY_OF = {
  cambiaformas: "disfraz",
  delmar: "transmutar",
  inteligente: "telequinesis"
};
var ABILITY_NAMES = {
  disfraz: "Disfraz",
  transmutar: "Transmutar",
  telequinesis: "Telequinesis"
};
var DISFRAZ = {
  maxEnergy: 100,
  drainPerSec: 2.2,
  /** Cada punto de daño recibido gasta este múltiplo de energía. */
  damageDrain: 2,
  shotCost: 7,
  rechargePerSec: 9,
  minToActivate: 25
};
var TRANSMUTAR = {
  cooldown: 5,
  range: 420,
  maxActive: 3,
  pulpoHp: 45,
  pulpoLife: 18,
  pulpoDamage: 14,
  pulpoSpeed: 270,
  coverHp: 170,
  coverLife: 25
};
var TELEQUINESIS = {
  cooldown: 4,
  range: 460,
  throwDamage: 45,
  throwSpeed: 900,
  stun: 1.2
};
function isAlienKind(v) {
  return typeof v === "string" && ALIEN_KINDS.includes(v);
}

// ../shared/src/enemies.ts
var ENEMIES = {
  fusilero: { nombre: "Fusilero", hp: 45, speed: 150, radius: 18, convertible: true, range: [220, 430], cientifico: false, amenaza: 1 },
  escudo: { nombre: "Escudo antidisturbios", hp: 90, speed: 120, radius: 20, convertible: true, range: [0, 60], cientifico: false, amenaza: 2 },
  lanzarredes: { nombre: "Lanzarredes", hp: 40, speed: 140, radius: 18, convertible: true, range: [220, 380], cientifico: false, amenaza: 2 },
  lanzallamas: { nombre: "Lanzallamas", hp: 160, speed: 115, radius: 22, convertible: true, range: [60, 150], cientifico: false, amenaza: 3 },
  francotirador: { nombre: "Francotirador", hp: 35, speed: 120, radius: 18, convertible: true, range: [480, 850], cientifico: false, amenaza: 2 },
  perro: { nombre: "Perro K9", hp: 32, speed: 285, radius: 16, convertible: false, range: [0, 40], cientifico: false, amenaza: 1 },
  criogenista: { nombre: "Criogenista", hp: 32, speed: 135, radius: 17, convertible: true, range: [300, 470], cientifico: true, amenaza: 2 },
  quimico: { nombre: "Qu\xEDmico", hp: 32, speed: 135, radius: 17, convertible: true, range: [280, 450], cientifico: true, amenaza: 1 },
  bioquimico: { nombre: "Bioqu\xEDmico", hp: 32, speed: 135, radius: 17, convertible: true, range: [260, 420], cientifico: true, amenaza: 2 },
  medico: { nombre: "M\xE9dico de campo", hp: 65, speed: 140, radius: 17, convertible: true, range: [200, 360], cientifico: true, amenaza: 2 },
  ingeniero: { nombre: "Ingeniero", hp: 65, speed: 130, radius: 17, convertible: true, range: [300, 480], cientifico: true, amenaza: 2 },
  jefe: { nombre: "Jefe de laboratorio", hp: 1100, speed: 85, radius: 40, convertible: false, range: [260, 480], cientifico: true, amenaza: 10 },
  torreta: { nombre: "Torreta", hp: 70, speed: 0, radius: 22, convertible: false, range: [0, 520], cientifico: false, amenaza: 1 },
  sensor: { nombre: "Sensor", hp: 25, speed: 0, radius: 14, convertible: false, range: [0, 0], cientifico: false, amenaza: 0 }
};
var ENEMY_TUNING = {
  fusilero: { burst: 3, burstGap: 0.12, cooldown: 2.1, damage: 4, bulletSpeed: 680 },
  escudo: { meleeRange: 62, meleeDamage: 9, stun: 0.5, cooldown: 1.6, shieldArc: 70 },
  lanzarredes: { cooldown: 6, netSpeed: 520, damage: 4 },
  lanzallamas: { cone: 32, range: 175, dps: 22, firePatchEvery: 0.6, patchLife: 3.5, patchDps: 8, backMultiplier: 3, explosionDamage: 70, explosionRadius: 120 },
  francotirador: { aimTime: 1.5, lockAt: 1.1, damage: 34, bulletSpeed: 1900, cooldown: 3.6 },
  perro: { biteDamage: 6, cooldown: 1.1, sniffRange: 210 },
  criogenista: { cooldown: 4.2, flight: 0.9, radius: 58 },
  quimico: { cooldown: 4, flight: 0.85, radius: 66, life: 4.5, dps: 12 },
  bioquimico: { cooldown: 4.5, flight: 0.85, radius: 85, life: 5, confuse: 4 },
  medico: { healRange: 170, healPerSec: 16, shieldTime: 5, cooldown: 4 },
  ingeniero: { cooldown: 9, sensorRange: 230 },
  jefe: { cooldown: 2.4, angryCooldown: 1.5, reinforceEvery: 20, tanks: 3, armoredMultiplier: 0.2 },
  torreta: { cooldown: 0.9, damage: 4, bulletSpeed: 680 }
};
function isConvertible(t) {
  return t !== "pulpo" && ENEMIES[t].convertible;
}

// ../shared/src/puzzles.ts
var ERRORES_PERMITIDOS = 4;
var PUZZLES = {
  p1: {
    id: "p1",
    nombre: "Memoria ps\xEDquica",
    sala: "C\xE1mara de contenci\xF3n",
    tipo: "individual",
    roles: ["inteligente"],
    minijuego: "memoria",
    duracion: MINIGAME_DURATION,
    descripcion: "Las zonas del cerebro se iluminan en orden: rep\xEDtelas. Cada acierto alarga la secuencia."
  },
  p2: {
    id: "p2",
    nombre: "Copia la cara",
    sala: "Archivo de seguridad",
    tipo: "individual",
    roles: ["cambiaformas"],
    minijuego: "cara",
    duracion: MINIGAME_DURATION,
    descripcion: "Disfrazado, arma la cara del cient\xEDfico que pide el esc\xE1ner: pelo, gafas, boca y placa."
  },
  p3: {
    id: "p3",
    nombre: "Transmutaci\xF3n",
    sala: "Sala de tuber\xEDas",
    tipo: "individual",
    roles: ["delmar"],
    minijuego: "transmutacion",
    duracion: MINIGAME_DURATION,
    descripcion: "Por la cinta pasan objetos: convi\xE9rtelos en lo que pide su cartel (coral, pulpo o burbuja)."
  },
  p4: {
    id: "p4",
    nombre: "Sala de rayos",
    sala: "Sala de rayos",
    tipo: "duo",
    roles: ["cambiaformas", "inteligente"],
    minijuego: "rayos",
    duracion: MINIGAME_DURATION,
    descripcion: "El cambiaformas lee el c\xF3digo en la consola; el inteligente activa los interruptores con telequinesis en ese orden."
  },
  p5: {
    id: "p5",
    nombre: "Puente sobre el \xE1cido",
    sala: "Piscina de \xE1cido",
    tipo: "duo",
    roles: ["inteligente", "delmar"],
    minijuego: "puente",
    duracion: MINIGAME_DURATION,
    descripcion: "El inteligente coloca bloques con telequinesis y el del mar los transmuta en puente antes de que se hundan."
  },
  p6: {
    id: "p6",
    nombre: "V\xE1lvulas a la vez",
    sala: "Esclusa",
    tipo: "duo",
    roles: ["cambiaformas", "delmar"],
    minijuego: "valvulas",
    duracion: MINIGAME_DURATION,
    descripcion: "Sigan las \xF3rdenes de la pantalla: \xABsolo A\xBB, \xABsolo B\xBB o \xAB\xA1AMBOS!\xBB. Cumplirlas r\xE1pido acorta el tiempo."
  },
  n1: {
    id: "n1",
    nombre: "Estaci\xF3n ps\xEDquica",
    sala: "N\xFAcleo",
    tipo: "nucleo",
    roles: ["inteligente"],
    minijuego: "memoria",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versi\xF3n corta de la memoria ps\xEDquica. Rompe un dep\xF3sito del jefe."
  },
  n2: {
    id: "n2",
    nombre: "Estaci\xF3n del disfraz",
    sala: "N\xFAcleo",
    tipo: "nucleo",
    roles: ["cambiaformas"],
    minijuego: "cara",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versi\xF3n corta de copia la cara. Rompe un dep\xF3sito del jefe."
  },
  n3: {
    id: "n3",
    nombre: "Estaci\xF3n de transmutaci\xF3n",
    sala: "N\xFAcleo",
    tipo: "nucleo",
    roles: ["delmar"],
    minijuego: "transmutacion",
    duracion: CORE_STATION_DURATION,
    descripcion: "Versi\xF3n corta de la transmutaci\xF3n. Rompe un dep\xF3sito del jefe."
  }
};
var DOOR_RULES = {
  D0: { requiere: ["tutorial"], texto: "Acaba con los guardias de las incubadoras" },
  D1: { requiere: ["p1"], texto: "Resuelve la Memoria ps\xEDquica" },
  D4: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D5: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D6: { requiere: ["p1", "p2", "p3"], texto: "Resuelve las tres salas individuales" },
  D7: { requiere: ["p4", "p5", "p6"], texto: "Resuelve las tres salas de d\xFAo" },
  D8: { requiere: ["n1", "n2", "n3", "jefe"], texto: "Destruye el n\xFAcleo y derrota al jefe" }
};
var RAYOS_SIMBOLOS = [
  { id: 0, nombre: "Espiral", color: "#3ef0ff" },
  { id: 1, nombre: "Tridente", color: "#ff5ad1" },
  { id: 2, nombre: "Ojo", color: "#ffd23e" },
  { id: 3, nombre: "Luna", color: "#7dff6a" },
  { id: 4, nombre: "Rayo", color: "#ff7a3e" },
  { id: 5, nombre: "Gota", color: "#9b7bff" }
];
var PUENTE = {
  sinkTime: 16,
  slots: 6
};
var ESCLUSA = {
  /** Al llegar a este número de fallos, se falla (se permiten ERRORES_PERMITIDOS). */
  maxMisses: ERRORES_PERMITIDOS + 1,
  /** Cada cuántos segundos llega una orden y cuántos dura para pulsar. */
  cada: 3.2,
  dura: 2.3,
  /** Una orden cuenta como rápida si se cumple en esta fracción de su tiempo. */
  rapida: 0.55
};

// ../shared/src/world.ts
var World = class {
  constructor(map) {
    this.tile = TILE;
    this.doorCells = /* @__PURE__ */ new Map();
    this.doorOpen = /* @__PURE__ */ new Map();
    this.objects = [];
    this.obstacles = [];
    this.rooms = [];
    this.w = map.width;
    this.h = map.height;
    const n = this.w * this.h;
    this.solid = new Uint8Array(n);
    this.liquid = new Uint8Array(n);
    this.bridged = new Uint8Array(n);
    this.closedDoor = new Uint8Array(n);
    const tileProps = /* @__PURE__ */ new Map();
    for (const ts of map.tilesets) {
      for (const t of ts.tiles ?? []) {
        tileProps.set(ts.firstgid + t.id, propsOf(t.properties));
      }
    }
    for (const layer of map.layers) {
      if (layer.type === "tilelayer" && layer.data) {
        layer.data.forEach((gid, i) => {
          const p = tileProps.get(gid);
          if (!p) return;
          if (p.solido) this.solid[i] = 1;
          if (p.liquido) this.liquid[i] = 1;
        });
      } else if (layer.type === "objectgroup" && layer.objects) {
        for (const o of layer.objects) {
          this.objects.push({
            id: o.id,
            type: o.type,
            name: o.name,
            x: o.x,
            y: o.y,
            w: o.width,
            h: o.height,
            props: propsOf(o.properties)
          });
        }
      }
    }
    for (const o of this.objects) {
      if (o.type === "door") {
        const cells = [];
        for (let cy = Math.floor(o.y / TILE); cy < Math.ceil((o.y + o.h) / TILE); cy++) {
          for (let cx = Math.floor(o.x / TILE); cx < Math.ceil((o.x + o.w) / TILE); cx++) {
            cells.push(this.idx(cx, cy));
          }
        }
        this.doorCells.set(o.name, cells);
        this.doorOpen.set(o.name, true);
        this.setDoor(o.name, Boolean(o.props.abierta));
      } else if (o.type === "decor" && Number(o.props.radio) > 0) {
        this.obstacles.push({ x: o.x, y: o.y, r: Number(o.props.radio) });
      } else if (o.type === "room") {
        this.rooms.push({ id: o.name, nombre: String(o.props.nombre ?? o.name), x: o.x, y: o.y, w: o.w, h: o.h });
      }
    }
  }
  idx(cx, cy) {
    return cy * this.w + cx;
  }
  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h;
  }
  blocksMove(cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    const i = this.idx(cx, cy);
    if (this.solid[i] || this.closedDoor[i]) return true;
    return this.liquid[i] === 1 && this.bridged[i] === 0;
  }
  blocksShot(cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    const i = this.idx(cx, cy);
    return this.solid[i] === 1 || this.closedDoor[i] > 0;
  }
  blocksMoveAt(x, y) {
    return this.blocksMove(Math.floor(x / TILE), Math.floor(y / TILE));
  }
  blocksShotAt(x, y) {
    return this.blocksShot(Math.floor(x / TILE), Math.floor(y / TILE));
  }
  setDoor(id, open) {
    const cells = this.doorCells.get(id);
    if (!cells || this.doorOpen.get(id) === open) return;
    this.doorOpen.set(id, open);
    for (const i of cells) this.closedDoor[i] += open ? -1 : 1;
  }
  setBridge(cx, cy, on) {
    if (this.inBounds(cx, cy)) this.bridged[this.idx(cx, cy)] = on ? 1 : 0;
  }
  /** Mueve un círculo deslizándose contra paredes y obstáculos. */
  moveCircle(x, y, dx, dy, r, extra) {
    const dist2 = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist2 / (r * 0.5)));
    let px = x;
    let py = y;
    for (let s = 0; s < steps; s++) {
      px += dx / steps;
      py += dy / steps;
      const res = this.resolve(px, py, r, extra);
      px = res.x;
      py = res.y;
    }
    return { x: px, y: py };
  }
  resolve(x, y, r, extra) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const x0 = Math.floor((x - r) / TILE);
      const x1 = Math.floor((x + r) / TILE);
      const y0 = Math.floor((y - r) / TILE);
      const y1 = Math.floor((y + r) / TILE);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (!this.blocksMove(cx, cy)) continue;
          const rx0 = cx * TILE;
          const ry0 = cy * TILE;
          const px = clamp(x, rx0, rx0 + TILE);
          const py = clamp(y, ry0, ry0 + TILE);
          let ddx = x - px;
          let ddy = y - py;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            x += ddx / d * (r - d);
            y += ddy / d * (r - d);
          } else {
            const left = x - rx0;
            const right = rx0 + TILE - x;
            const top = y - ry0;
            const bottom = ry0 + TILE - y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) x = rx0 - r;
            else if (m === right) x = rx0 + TILE + r;
            else if (m === top) y = ry0 - r;
            else y = ry0 + TILE + r;
            ddx = ddy = 0;
          }
          moved = true;
        }
      }
      const pushOut = (c) => {
        const ddx = x - c.x;
        const ddy = y - c.y;
        const min = r + c.r;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 1e-3;
        x = c.x + ddx / d * min;
        y = c.y + ddy / d * min;
        moved = true;
      };
      for (const c of this.obstacles) pushOut(c);
      if (extra) for (const c of extra) pushOut(c);
      if (!moved) break;
    }
    return { x, y };
  }
  /** ¿Hay visión directa (sin paredes ni puertas cerradas) entre dos puntos? */
  lineOfSight(x0, y0, x1, y1) {
    return this.raycast(x0, y0, x1, y1) === null;
  }
  /** Devuelve el primer punto donde la línea choca con una pared, o null si llega. */
  raycast(x0, y0, x1, y1) {
    let cx = Math.floor(x0 / TILE);
    let cy = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE);
    const ey = Math.floor(y1 / TILE);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((stepX > 0 ? (cx + 1) * TILE : cx * TILE) - x0) / dx : Infinity;
    let tMaxY = dy !== 0 ? ((stepY > 0 ? (cy + 1) * TILE : cy * TILE) - y0) / dy : Infinity;
    let guard = 0;
    while ((cx !== ex || cy !== ey) && guard++ < 512) {
      let t;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        cy += stepY;
      }
      if (t > 1) break;
      if (this.blocksShot(cx, cy)) return { x: x0 + dx * t, y: y0 + dy * t };
    }
    return null;
  }
  roomAt(x, y) {
    return this.rooms.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
  }
  find(type3) {
    return this.objects.filter((o) => o.type === type3);
  }
  findOne(type3, name) {
    return this.objects.find((o) => o.type === type3 && (name === void 0 || o.name === name));
  }
};
function propsOf(list) {
  const out = {};
  for (const p of list ?? []) out[p.name] = p.value;
  return out;
}
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ../shared/src/movement.ts
function canMove(p) {
  if (p.ghost) return true;
  return p.status === "ok" && !p.locked;
}
function stepPlayer(world, p, mx, my, dt, extra) {
  if (!canMove(p)) return { x: p.x, y: p.y };
  let ix = clamp(mx, -1, 1);
  let iy = clamp(my, -1, 1);
  if (p.confused > 0 && !p.ghost) {
    ix = -ix;
    iy = -iy;
  }
  const len = Math.hypot(ix, iy);
  if (len < 0.01) return { x: p.x, y: p.y };
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  if (p.ghost) {
    return {
      x: clamp(p.x + ix * GHOST_SPEED * dt, TILE, (world.w - 1) * TILE),
      y: clamp(p.y + iy * GHOST_SPEED * dt, TILE, (world.h - 1) * TILE)
    };
  }
  const speed = ALIENS[p.kind].speed;
  return world.moveCircle(p.x, p.y, ix * speed * dt, iy * speed * dt, PLAYER_RADIUS, extra);
}

// src/config.ts
function jugadoresNecesarios() {
  const n = Number(process.env.JUGADORES_MINIMOS);
  return Number.isInteger(n) && n >= 1 && n <= PLAYERS_PER_ROOM ? n : PLAYERS_PER_ROOM;
}
var PORT = Number(process.env.PORT ?? 2567);
var ORIGENES = (process.env.ORIGENES_PERMITIDOS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
var CLIENTE_DIR = process.env.CLIENTE_DIR ?? "";

// src/rooms/GameRoom.ts
import { Room as Room2 } from "@colyseus/core";

// src/schema/GameState.ts
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
var Player = class extends Schema {
  constructor() {
    super(...arguments);
    this.nombre = "";
    this.kind = "";
    this.x = 0;
    this.y = 0;
    this.aim = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.vivo = true;
    this.fantasma = false;
    this.conectado = true;
    this.estado = "ok";
    this.estadoT = 0;
    this.confuso = 0;
    this.disfrazado = false;
    this.energia = 100;
    this.enfriamiento = 0;
    this.habilidad = "";
    this.almas = new ArraySchema();
    this.seq = 0;
    this.ocupado = "";
    this.rescate = 0;
    this.bajas = 0;
  }
};
__decorateClass([
  type("string")
], Player.prototype, "nombre", 2);
__decorateClass([
  type("string")
], Player.prototype, "kind", 2);
__decorateClass([
  type("float32")
], Player.prototype, "x", 2);
__decorateClass([
  type("float32")
], Player.prototype, "y", 2);
__decorateClass([
  type("float32")
], Player.prototype, "aim", 2);
__decorateClass([
  type("int16")
], Player.prototype, "hp", 2);
__decorateClass([
  type("int16")
], Player.prototype, "maxHp", 2);
__decorateClass([
  type("boolean")
], Player.prototype, "vivo", 2);
__decorateClass([
  type("boolean")
], Player.prototype, "fantasma", 2);
__decorateClass([
  type("boolean")
], Player.prototype, "conectado", 2);
__decorateClass([
  type("string")
], Player.prototype, "estado", 2);
__decorateClass([
  type("float32")
], Player.prototype, "estadoT", 2);
__decorateClass([
  type("float32")
], Player.prototype, "confuso", 2);
__decorateClass([
  type("boolean")
], Player.prototype, "disfrazado", 2);
__decorateClass([
  type("float32")
], Player.prototype, "energia", 2);
__decorateClass([
  type("float32")
], Player.prototype, "enfriamiento", 2);
__decorateClass([
  type("string")
], Player.prototype, "habilidad", 2);
__decorateClass([
  type(["string"])
], Player.prototype, "almas", 2);
__decorateClass([
  type("uint32")
], Player.prototype, "seq", 2);
__decorateClass([
  type("string")
], Player.prototype, "ocupado", 2);
__decorateClass([
  type("float32")
], Player.prototype, "rescate", 2);
__decorateClass([
  type("uint16")
], Player.prototype, "bajas", 2);
var Unit = class extends Schema {
  constructor() {
    super(...arguments);
    this.t = "";
    this.team = "humanos";
    this.x = 0;
    this.y = 0;
    this.ang = 0;
    this.hp = 1;
    this.maxHp = 1;
    this.st = "";
    this.stT = 0;
    this.blindado = false;
    this.escudo = false;
    this.tanques = 0;
    this.moviendo = false;
  }
};
__decorateClass([
  type("string")
], Unit.prototype, "t", 2);
__decorateClass([
  type("string")
], Unit.prototype, "team", 2);
__decorateClass([
  type("int16")
], Unit.prototype, "x", 2);
__decorateClass([
  type("int16")
], Unit.prototype, "y", 2);
__decorateClass([
  type("float32")
], Unit.prototype, "ang", 2);
__decorateClass([
  type("int16")
], Unit.prototype, "hp", 2);
__decorateClass([
  type("int16")
], Unit.prototype, "maxHp", 2);
__decorateClass([
  type("string")
], Unit.prototype, "st", 2);
__decorateClass([
  type("float32")
], Unit.prototype, "stT", 2);
__decorateClass([
  type("boolean")
], Unit.prototype, "blindado", 2);
__decorateClass([
  type("boolean")
], Unit.prototype, "escudo", 2);
__decorateClass([
  type("uint8")
], Unit.prototype, "tanques", 2);
__decorateClass([
  type("boolean")
], Unit.prototype, "moviendo", 2);
var Projectile = class extends Schema {
  constructor() {
    super(...arguments);
    this.k = "";
    this.team = "";
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.tx = 0;
    this.ty = 0;
    this.vuelo = 0;
  }
};
__decorateClass([
  type("string")
], Projectile.prototype, "k", 2);
__decorateClass([
  type("string")
], Projectile.prototype, "team", 2);
__decorateClass([
  type("int16")
], Projectile.prototype, "x", 2);
__decorateClass([
  type("int16")
], Projectile.prototype, "y", 2);
__decorateClass([
  type("float32")
], Projectile.prototype, "vx", 2);
__decorateClass([
  type("float32")
], Projectile.prototype, "vy", 2);
__decorateClass([
  type("int16")
], Projectile.prototype, "tx", 2);
__decorateClass([
  type("int16")
], Projectile.prototype, "ty", 2);
__decorateClass([
  type("float32")
], Projectile.prototype, "vuelo", 2);
var Zone = class extends Schema {
  constructor() {
    super(...arguments);
    this.k = "";
    this.x = 0;
    this.y = 0;
    this.r = 0;
    this.vida = 0;
  }
};
__decorateClass([
  type("string")
], Zone.prototype, "k", 2);
__decorateClass([
  type("int16")
], Zone.prototype, "x", 2);
__decorateClass([
  type("int16")
], Zone.prototype, "y", 2);
__decorateClass([
  type("int16")
], Zone.prototype, "r", 2);
__decorateClass([
  type("float32")
], Zone.prototype, "vida", 2);
var Prop = class extends Schema {
  constructor() {
    super(...arguments);
    this.k = "";
    this.x = 0;
    this.y = 0;
    this.hp = 1;
    this.st = "";
    this.t = 0;
    this.dueno = "";
  }
};
__decorateClass([
  type("string")
], Prop.prototype, "k", 2);
__decorateClass([
  type("int16")
], Prop.prototype, "x", 2);
__decorateClass([
  type("int16")
], Prop.prototype, "y", 2);
__decorateClass([
  type("int16")
], Prop.prototype, "hp", 2);
__decorateClass([
  type("string")
], Prop.prototype, "st", 2);
__decorateClass([
  type("float32")
], Prop.prototype, "t", 2);
__decorateClass([
  type("string")
], Prop.prototype, "dueno", 2);
var Door = class extends Schema {
  constructor() {
    super(...arguments);
    this.abierta = false;
  }
};
__decorateClass([
  type("boolean")
], Door.prototype, "abierta", 2);
var Puzzle = class extends Schema {
  constructor() {
    super(...arguments);
    this.estado = "libre";
    this.tiempo = 0;
    this.total = 0;
    this.actores = "";
    this.solo = false;
    this.datos = "";
  }
};
__decorateClass([
  type("string")
], Puzzle.prototype, "estado", 2);
__decorateClass([
  type("float32")
], Puzzle.prototype, "tiempo", 2);
__decorateClass([
  type("float32")
], Puzzle.prototype, "total", 2);
__decorateClass([
  type("string")
], Puzzle.prototype, "actores", 2);
__decorateClass([
  type("boolean")
], Puzzle.prototype, "solo", 2);
__decorateClass([
  type("string")
], Puzzle.prototype, "datos", 2);
var Soul = class extends Schema {
  constructor() {
    super(...arguments);
    this.kind = "";
    this.de = "";
    this.x = 0;
    this.y = 0;
  }
};
__decorateClass([
  type("string")
], Soul.prototype, "kind", 2);
__decorateClass([
  type("string")
], Soul.prototype, "de", 2);
__decorateClass([
  type("int16")
], Soul.prototype, "x", 2);
__decorateClass([
  type("int16")
], Soul.prototype, "y", 2);
var GameState = class extends Schema {
  constructor() {
    super(...arguments);
    this.fase = "esperando";
    this.tiempo = 0;
    this.objetivo = "";
    this.jefe = "";
    this.jugadores = new MapSchema();
    this.unidades = new MapSchema();
    this.proyectiles = new MapSchema();
    this.zonas = new MapSchema();
    this.objetos = new MapSchema();
    this.puertas = new MapSchema();
    this.puzzles = new MapSchema();
    this.almas = new MapSchema();
  }
};
__decorateClass([
  type("string")
], GameState.prototype, "fase", 2);
__decorateClass([
  type("float32")
], GameState.prototype, "tiempo", 2);
__decorateClass([
  type("string")
], GameState.prototype, "objetivo", 2);
__decorateClass([
  type("string")
], GameState.prototype, "jefe", 2);
__decorateClass([
  type({ map: Player })
], GameState.prototype, "jugadores", 2);
__decorateClass([
  type({ map: Unit })
], GameState.prototype, "unidades", 2);
__decorateClass([
  type({ map: Projectile })
], GameState.prototype, "proyectiles", 2);
__decorateClass([
  type({ map: Zone })
], GameState.prototype, "zonas", 2);
__decorateClass([
  type({ map: Prop })
], GameState.prototype, "objetos", 2);
__decorateClass([
  type({ map: Door })
], GameState.prototype, "puertas", 2);
__decorateClass([
  type({ map: Puzzle })
], GameState.prototype, "puzzles", 2);
__decorateClass([
  type({ map: Soul })
], GameState.prototype, "almas", 2);

// ../maps/area1.json
var area1_default = { type: "map", version: "1.10", tiledversion: "1.10.2", orientation: "orthogonal", renderorder: "right-down", width: 120, height: 96, tilewidth: 64, tileheight: 64, infinite: false, nextlayerid: 4, nextobjectid: 171, properties: [{ name: "nombre", type: "string", value: "\xC1rea 1 \u2014 Incubadoras" }], layers: [{ id: 1, name: "suelo", type: "tilelayer", x: 0, y: 0, width: 120, height: 96, opacity: 1, visible: true, data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 0, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 3, 8, 3, 3, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 3, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 2, 1, 2, 2, 2, 1, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 1, 2, 2, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 3, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 3, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 0, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 3, 8, 3, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 3, 4, 4, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 3, 8, 8, 8, 8, 3, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 3, 3, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 8, 8, 8, 3, 3, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 3, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 3, 0, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 3, 8, 8, 8, 3, 8, 8, 8, 8, 3, 3, 3, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 3, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 3, 8, 8, 3, 8, 3, 3, 3, 8, 8, 3, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 3, 8, 3, 8, 8, 3, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 3, 3, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 3, 4, 3, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 3, 4, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 3, 8, 8, 8, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 3, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 3, 8, 8, 8, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 3, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 1, 2, 1, 1, 1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 3, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 1, 1, 2, 2, 2, 2, 1, 2, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 3, 8, 8, 3, 8, 8, 8, 3, 8, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 3, 3, 8, 8, 3, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 1, 1, 2, 1, 1, 1, 2, 2, 1, 2, 2, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 3, 8, 8, 8, 8, 8, 3, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 3, 4, 4, 3, 4, 3, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 2, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 3, 8, 3, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8, 3, 3, 8, 8, 8, 8, 8, 3, 3, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 2, 1, 2, 2, 2, 1, 1, 2, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 3, 8, 8, 3, 8, 8, 3, 8, 3, 8, 8, 8, 8, 8, 8, 3, 8, 8, 3, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 2, 1, 1, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 8, 3, 8, 8, 8, 8, 8, 8, 8, 3, 8, 3, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 2, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 8, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 1, 5, 1, 5, 1, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 2, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 5, 5, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 2, 8, 8, 2, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 2, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 5, 5, 1, 5, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 5, 1, 1, 5, 1, 1, 1, 1, 5, 1, 5, 1, 1, 1, 1, 5, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 8, 8, 8, 8, 2, 8, 8, 2, 8, 8, 2, 8, 8, 8, 8, 8, 2, 2, 8, 2, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 5, 1, 1, 5, 1, 5, 1, 1, 1, 1, 1, 1, 5, 1, 5, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 2, 8, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 2, 8, 8, 2, 8, 2, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 5, 1, 1, 1, 1, 5, 1, 5, 1, 5, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 5, 5, 1, 5, 1, 1, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 2, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1, 5, 1, 1, 5, 5, 5, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 5, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 2, 8, 2, 2, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 5, 1, 1, 5, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 2, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2, 2, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 5, 1, 1, 5, 1, 1, 5, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 1, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 5, 1, 1, 1, 5, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 2, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 2, 8, 8, 2, 2, 8, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 2, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 2, 2, 2, 8, 8, 8, 8, 8, 8, 8, 2, 8, 8, 8, 2, 8, 8, 8, 8, 8, 8, 8, 2, 8, 2, 8, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 5, 2, 2, 2, 2, 2, 2, 5, 2, 2, 2, 5, 2, 2, 5, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 2, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2, 2, 2, 5, 5, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2, 2, 2, 5, 2, 2, 2, 2, 5, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 5, 2, 5, 2, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2, 5, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 5, 2, 2, 2, 5, 2, 5, 2, 2, 2, 2, 2, 2, 2, 5, 2, 5, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 5, 5, 2, 2, 2, 5, 5, 2, 5, 2, 2, 2, 5, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 2, 2, 5, 2, 2, 2, 5, 2, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 5, 5, 2, 2, 2, 2, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 3, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 5, 5, 2, 2, 5, 5, 2, 5, 2, 2, 2, 2, 2, 5, 2, 2, 5, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 3, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 5, 2, 2, 2, 2, 5, 2, 5, 2, 5, 2, 2, 5, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 3, 1, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 3, 1, 1, 1, 3, 1, 1, 1, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 3, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 1, 7, 7, 1, 7, 7, 7, 7, 7, 7, 1, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 3, 1, 3, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 3, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 1, 7, 7, 7, 7, 1, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 3, 3, 4, 3, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 1, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 3, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 1, 1, 7, 1, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 7, 7, 1, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 3, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 7, 1, 7, 7, 1, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 6, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 3, 1, 1, 3, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 1, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 1, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 3, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 3, 3, 4, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 3, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 7, 7, 7, 7, 7, 1, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 3, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 1, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 3, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 1, 7, 7, 7, 7, 7, 7, 1, 7, 7, 1, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 1, 1, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 1, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 3, 3, 3, 4, 4, 4, 4, 3, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 1, 7, 7, 7, 7, 7, 7, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 3, 4, 3, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 1, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { id: 2, name: "paredes", type: "tilelayer", x: 0, y: 0, width: 120, height: 96, opacity: 1, visible: true, data: [17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 17, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 17, 16, 16, 16, 17, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 17, 16, 17, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 12, 14, 12, 12, 15, 18, 18, 12, 12, 18, 18, 12, 12, 11, 12, 12, 18, 15, 14, 12, 12, 14, 12, 13, 14, 14, 12, 12, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 12, 12, 14, 12, 18, 12, 18, 15, 12, 12, 12, 15, 12, 12, 15, 12, 15, 12, 12, 12, 13, 12, 12, 12, 14, 12, 15, 15, 11, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 11, 12, 12, 12, 12, 12, 12, 12, 12, 13, 18, 12, 12, 12, 12, 13, 12, 14, 18, 18, 13, 12, 12, 12, 18, 12, 14, 18, 12, 11, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 17, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 17, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 17, 16, 17, 17, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 17, 17, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 17, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 17, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 17, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 17, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 17, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 17, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 17, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 17, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 17, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 17, 16, 17, 16, 16, 17, 16, 16, 16, 16, 11, 18, 12, 12, 12, 12, 0, 0, 0, 18, 12, 12, 18, 13, 14, 13, 12, 13, 12, 12, 13, 12, 12, 12, 15, 12, 12, 12, 12, 15, 12, 13, 15, 12, 12, 14, 12, 18, 12, 12, 13, 12, 14, 12, 12, 12, 18, 12, 12, 12, 12, 13, 12, 12, 0, 0, 0, 12, 12, 12, 14, 12, 12, 18, 13, 14, 18, 13, 12, 12, 14, 12, 14, 12, 12, 12, 14, 13, 12, 12, 12, 14, 12, 14, 14, 18, 14, 13, 14, 12, 12, 18, 12, 0, 0, 0, 12, 12, 15, 12, 12, 18, 12, 12, 12, 12, 12, 15, 12, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 17, 17, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 17, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 17, 17, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 12, 12, 12, 14, 12, 12, 12, 12, 18, 12, 12, 13, 14, 12, 15, 0, 0, 0, 12, 12, 12, 14, 12, 15, 12, 14, 12, 13, 12, 12, 14, 13, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 17, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 17, 16, 16, 17, 11, 12, 12, 12, 12, 12, 12, 15, 12, 18, 18, 14, 12, 12, 12, 12, 14, 12, 15, 12, 13, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 11, 12, 12, 12, 12, 12, 12, 13, 12, 12, 12, 12, 12, 18, 12, 12, 18, 12, 12, 12, 12, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 17, 16, 17, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 17, 16, 16, 17, 17, 17, 16, 17, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 17, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 12, 12, 18, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 12, 12, 12, 12, 15, 14, 12, 14, 12, 12, 12, 14, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 17, 17, 17, 16, 17, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 17, 17, 17, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 17, 16, 16, 17, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 17, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 17, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 17, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 17, 17, 16, 17, 17, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 17, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 17, 17, 16, 16, 17, 11, 12, 12, 14, 13, 14, 13, 15, 15, 14, 12, 12, 12, 12, 13, 12, 18, 14, 12, 14, 15, 12, 12, 12, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 11, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 11, 16, 16, 17, 16, 17, 17, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 17, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 17, 16, 16, 17, 16, 17, 17, 16, 16, 11, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 11, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 12, 12, 0, 0, 0, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 12, 12, 12, 12, 12, 18, 12, 12, 12, 13, 12, 18, 14, 14, 12, 18, 12, 12, 12, 12, 12, 12, 12, 15, 12, 13, 12, 13, 18, 11, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 11, 16, 17, 16, 16, 16, 17, 16, 17, 16, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 17, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 17, 16, 17, 17, 17, 16, 11, 15, 12, 12, 12, 12, 12, 14, 12, 0, 0, 0, 12, 14, 12, 12, 12, 12, 12, 11, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 11, 13, 18, 18, 13, 12, 18, 15, 12, 12, 12, 0, 0, 0, 18, 12, 14, 12, 12, 12, 14, 13, 14, 18, 13, 11, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 17, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 17, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 12, 12, 12, 12, 12, 12, 12, 11, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 17, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 12, 12, 12, 12, 12, 12, 14, 15, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 17, 16, 16, 16, 17, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 17, 17, 16, 16, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 17, 17, 16, 16, 16, 16, 17, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 17, 16, 16, 16, 16, 17, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 17, 17, 16, 17, 17, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 17, 16, 16, 16, 17, 16, 17, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 17, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 16, 16, 17, 17, 16, 17, 16, 17, 16, 16, 16, 17, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 17, 17, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 17, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 17, 17, 16, 16, 17, 16, 17, 16, 16, 16, 16, 17, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 17, 16, 16, 16, 16, 16, 16, 17, 16, 16, 17, 17, 16, 16, 16, 16, 17, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 17, 17, 16, 17, 16, 16, 17, 17, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 16, 17, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17] }, { id: 3, name: "objetos", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown", objects: [{ id: 1, name: "r0", type: "room", x: 256, y: 4480, width: 1536, height: 1408, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Incubadoras" }] }, { id: 2, name: "almacen", type: "room", x: 512, y: 3648, width: 1472, height: 640, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Almac\xE9n" }] }, { id: 3, name: "r1", type: "room", x: 2560, y: 4352, width: 1152, height: 1152, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "C\xE1mara de contenci\xF3n" }] }, { id: 4, name: "hub", type: "room", x: 2816, y: 2176, width: 2048, height: 1408, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Hub central" }] }, { id: 5, name: "r2", type: "room", x: 512, y: 2304, width: 1280, height: 1024, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Archivo de seguridad" }] }, { id: 6, name: "r3", type: "room", x: 5888, y: 2304, width: 1280, height: 1024, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Sala de tuber\xEDas" }] }, { id: 7, name: "pasillo", type: "room", x: 384, y: 1664, width: 6912, height: 192, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Pasillo norte" }] }, { id: 8, name: "r4", type: "room", x: 384, y: 256, width: 1792, height: 1280, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Sala de rayos" }] }, { id: 9, name: "r5", type: "room", x: 2944, y: 256, width: 1792, height: 1280, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Piscina de \xE1cido" }] }, { id: 10, name: "r6", type: "room", x: 5504, y: 256, width: 1792, height: 1280, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Esclusa" }] }, { id: 11, name: "r7", type: "room", x: 4224, y: 4096, width: 2816, height: 1792, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "N\xFAcleo de las incubadoras" }] }, { id: 12, name: "salida", type: "room", x: 7104, y: 4736, width: 448, height: 448, rotation: 0, visible: true, properties: [{ name: "nombre", type: "string", value: "Salida al \xC1rea 2" }] }, { id: 13, name: "D0", type: "door", x: 1792, y: 5056, width: 64, height: 192, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "v" }] }, { id: 14, name: "D1", type: "door", x: 3072, y: 4288, width: 192, height: 64, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "h" }] }, { id: 15, name: "D4", type: "door", x: 704, y: 1536, width: 192, height: 128, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "h" }] }, { id: 16, name: "D5", type: "door", x: 3776, y: 1536, width: 192, height: 128, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "h" }] }, { id: 17, name: "D6", type: "door", x: 6272, y: 1536, width: 192, height: 128, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "h" }] }, { id: 18, name: "D7", type: "door", x: 4352, y: 4032, width: 192, height: 64, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "h" }] }, { id: 19, name: "D8", type: "door", x: 7040, y: 4864, width: 64, height: 192, rotation: 0, visible: true, properties: [{ name: "orientacion", type: "string", value: "v" }] }, { id: 20, name: "j0", type: "player_spawn", x: 608, y: 5152, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 21, name: "j1", type: "player_spawn", x: 864, y: 5280, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 22, name: "j2", type: "player_spawn", x: 1120, y: 5152, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 23, name: "incubadora_rota", type: "decor", x: 480, y: 4768, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 24, name: "incubadora_rota", type: "decor", x: 480, y: 5600, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 25, name: "incubadora_rota", type: "decor", x: 736, y: 4768, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 26, name: "incubadora_rota", type: "decor", x: 736, y: 5600, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 27, name: "incubadora_rota", type: "decor", x: 992, y: 4768, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 28, name: "incubadora_rota", type: "decor", x: 992, y: 5600, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 29, name: "incubadora_rota", type: "decor", x: 1248, y: 4768, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 30, name: "incubadora_rota", type: "decor", x: 1248, y: 5600, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 31, name: "incubadora_rota", type: "decor", x: 1504, y: 4768, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 32, name: "incubadora_rota", type: "decor", x: 1504, y: 5600, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora_rota" }, { name: "radio", type: "int", value: 34 }] }, { id: 33, name: "consola", type: "decor", x: 416, y: 5216, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "consola" }, { name: "radio", type: "int", value: 26 }] }, { id: 34, name: "tubo", type: "decor", x: 1696, y: 4640, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 35, name: "tubo", type: "decor", x: 1696, y: 5728, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 36, name: "estanteria", type: "decor", x: 672, y: 3744, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "estanteria" }, { name: "radio", type: "int", value: 30 }] }, { id: 37, name: "estanteria", type: "decor", x: 864, y: 3744, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "estanteria" }, { name: "radio", type: "int", value: 30 }] }, { id: 38, name: "estanteria", type: "decor", x: 1568, y: 3744, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "estanteria" }, { name: "radio", type: "int", value: 30 }] }, { id: 39, name: "estanteria", type: "decor", x: 1760, y: 3744, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "estanteria" }, { name: "radio", type: "int", value: 30 }] }, { id: 40, name: "tubo", type: "decor", x: 2656, y: 4448, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 41, name: "tubo", type: "decor", x: 3616, y: 4448, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 42, name: "servidor", type: "decor", x: 2656, y: 5408, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "servidor" }, { name: "radio", type: "int", value: 26 }] }, { id: 43, name: "servidor", type: "decor", x: 3616, y: 5408, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "servidor" }, { name: "radio", type: "int", value: 26 }] }, { id: 44, name: "holograma", type: "decor", x: 3872, y: 2848, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "holograma" }, { name: "radio", type: "int", value: 52 }] }, { id: 45, name: "mesa", type: "decor", x: 3168, y: 2464, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "mesa" }, { name: "radio", type: "int", value: 30 }] }, { id: 46, name: "mesa", type: "decor", x: 4512, y: 2464, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "mesa" }, { name: "radio", type: "int", value: 30 }] }, { id: 47, name: "mesa", type: "decor", x: 3168, y: 3296, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "mesa" }, { name: "radio", type: "int", value: 30 }] }, { id: 48, name: "mesa", type: "decor", x: 4512, y: 3296, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "mesa" }, { name: "radio", type: "int", value: 30 }] }, { id: 49, name: "tubo", type: "decor", x: 2912, y: 2272, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 50, name: "tubo", type: "decor", x: 4768, y: 2272, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tubo" }, { name: "radio", type: "int", value: 26 }] }, { id: 51, name: "servidor", type: "decor", x: 736, y: 2976, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "servidor" }, { name: "radio", type: "int", value: 26 }] }, { id: 52, name: "servidor", type: "decor", x: 992, y: 2976, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "servidor" }, { name: "radio", type: "int", value: 26 }] }, { id: 53, name: "servidor", type: "decor", x: 1504, y: 2976, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "servidor" }, { name: "radio", type: "int", value: 26 }] }, { id: 54, name: "mesa", type: "decor", x: 1440, y: 2528, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "mesa" }, { name: "radio", type: "int", value: 30 }] }, { id: 55, name: "tanque", type: "decor", x: 6112, y: 2528, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tanque" }, { name: "radio", type: "int", value: 34 }] }, { id: 56, name: "tanque", type: "decor", x: 6944, y: 3168, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tanque" }, { name: "radio", type: "int", value: 34 }] }, { id: 57, name: "tanque", type: "decor", x: 6112, y: 3168, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tanque" }, { name: "radio", type: "int", value: 34 }] }, { id: 58, name: "consola", type: "decor", x: 480, y: 1312, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "consola" }, { name: "radio", type: "int", value: 26 }] }, { id: 59, name: "tanque", type: "decor", x: 5600, y: 352, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tanque" }, { name: "radio", type: "int", value: 34 }] }, { id: 60, name: "tanque", type: "decor", x: 7200, y: 1440, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "tanque" }, { name: "radio", type: "int", value: 34 }] }, { id: 61, name: "nucleo", type: "decor", x: 5632, y: 4992, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "nucleo" }, { name: "radio", type: "int", value: 92 }] }, { id: 62, name: "incubadora", type: "decor", x: 4448, y: 4320, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora" }, { name: "radio", type: "int", value: 34 }] }, { id: 63, name: "incubadora", type: "decor", x: 6816, y: 4320, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora" }, { name: "radio", type: "int", value: 34 }] }, { id: 64, name: "incubadora", type: "decor", x: 4448, y: 5664, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora" }, { name: "radio", type: "int", value: 34 }] }, { id: 65, name: "incubadora", type: "decor", x: 6816, y: 5664, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sprite", type: "string", value: "incubadora" }, { name: "radio", type: "int", value: 34 }] }, { id: 66, name: "barril", type: "prop", x: 544, y: 5792, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 67, name: "caja", type: "prop", x: 1376, y: 5088, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 68, name: "barril", type: "prop", x: 1632, y: 5280, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 69, name: "caja", type: "prop", x: 416, y: 4576, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 70, name: "caja", type: "prop", x: 1184, y: 3936, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 71, name: "caja", type: "prop", x: 1312, y: 3936, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 72, name: "barril", type: "prop", x: 1888, y: 4128, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 73, name: "botiquin", type: "prop", x: 608, y: 4128, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "botiquin" }] }, { id: 74, name: "barril", type: "prop", x: 2848, y: 4896, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 75, name: "caja", type: "prop", x: 3424, y: 4896, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 76, name: "barril", type: "prop", x: 3040, y: 5280, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 77, name: "caja", type: "prop", x: 3360, y: 5280, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 78, name: "barril", type: "prop", x: 3424, y: 2656, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 79, name: "caja", type: "prop", x: 4256, y: 2656, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 80, name: "barril", type: "prop", x: 3424, y: 3104, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 81, name: "caja", type: "prop", x: 4256, y: 3104, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 82, name: "botiquin", type: "prop", x: 3872, y: 3488, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "botiquin" }] }, { id: 83, name: "caja", type: "prop", x: 800, y: 2720, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 84, name: "barril", type: "prop", x: 1632, y: 2848, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 85, name: "caja", type: "prop", x: 1248, y: 3168, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 86, name: "barril", type: "prop", x: 6368, y: 2848, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 87, name: "caja", type: "prop", x: 6688, y: 2848, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 88, name: "barril", type: "prop", x: 7008, y: 2464, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 89, name: "botiquin", type: "prop", x: 7072, y: 3232, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "botiquin" }] }, { id: 90, name: "caja", type: "prop", x: 1952, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 91, name: "barril", type: "prop", x: 5792, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 92, name: "caja", type: "prop", x: 2912, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 93, name: "caja", type: "prop", x: 608, y: 928, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 94, name: "barril", type: "prop", x: 992, y: 544, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 95, name: "caja", type: "prop", x: 1632, y: 1120, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 96, name: "barril", type: "prop", x: 1952, y: 672, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 97, name: "caja", type: "prop", x: 3232, y: 1312, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 98, name: "barril", type: "prop", x: 4448, y: 1248, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 99, name: "caja", type: "prop", x: 4256, y: 1376, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 100, name: "caja", type: "prop", x: 5920, y: 1056, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 101, name: "barril", type: "prop", x: 6880, y: 608, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 102, name: "caja", type: "prop", x: 6624, y: 1376, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 103, name: "botiquin", type: "prop", x: 6112, y: 416, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "botiquin" }] }, { id: 104, name: "barril", type: "prop", x: 4768, y: 4640, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 105, name: "barril", type: "prop", x: 6496, y: 4640, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "barril" }] }, { id: 106, name: "caja", type: "prop", x: 4768, y: 5408, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 107, name: "caja", type: "prop", x: 6496, y: 5408, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "caja" }] }, { id: 108, name: "botiquin", type: "prop", x: 5664, y: 4256, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "kind", type: "string", value: "botiquin" }] }, { id: 109, name: "p1", type: "station", x: 3168, y: 4576, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "p1" }] }, { id: 110, name: "p2", type: "station", x: 1120, y: 2464, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "p2" }] }, { id: 111, name: "p3", type: "station", x: 6496, y: 2464, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "p3" }] }, { id: 112, name: "p4", type: "station", x: 608, y: 544, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "p4" }, { name: "parte", type: "string", value: "A" }] }, { id: 113, name: "p4", type: "switch", x: 1440, y: 416, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 0 }] }, { id: 114, name: "p4", type: "switch", x: 1760, y: 416, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 1 }] }, { id: 115, name: "p4", type: "switch", x: 2080, y: 416, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 2 }] }, { id: 116, name: "p4", type: "switch", x: 1440, y: 1376, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 3 }] }, { id: 117, name: "p4", type: "switch", x: 1760, y: 1376, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 4 }] }, { id: 118, name: "p4", type: "switch", x: 2080, y: 1376, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "simbolo", type: "int", value: 5 }] }, { id: 119, name: "p5", type: "dispenser", x: 3360, y: 1248, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 120, name: "p5", type: "slot", x: 3872, y: 992, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 0 }] }, { id: 121, name: "p5", type: "slot", x: 3872, y: 928, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 1 }] }, { id: 122, name: "p5", type: "slot", x: 3872, y: 864, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 2 }] }, { id: 123, name: "p5", type: "slot", x: 3872, y: 800, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 3 }] }, { id: 124, name: "p5", type: "slot", x: 3872, y: 736, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 4 }] }, { id: 125, name: "p5", type: "slot", x: 3872, y: 672, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "i", type: "int", value: 5 }] }, { id: 126, name: "p5", type: "button", x: 3872, y: 416, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 127, name: "p6", type: "lever", x: 5664, y: 928, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "parte", type: "string", value: "A" }] }, { id: 128, name: "p6", type: "lever", x: 7136, y: 928, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "parte", type: "string", value: "B" }] }, { id: 129, name: "p6", type: "water_zone", x: 5888, y: 448, width: 1024, height: 960, rotation: 0, visible: true, properties: [] }, { id: 130, name: "n1", type: "station", x: 5024, y: 4512, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "n1" }] }, { id: 131, name: "n2", type: "station", x: 6240, y: 4512, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "n2" }] }, { id: 132, name: "n3", type: "station", x: 5632, y: 5664, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "puzzle", type: "string", value: "n3" }] }, { id: 133, name: "jefe", type: "boss_spawn", x: 5632, y: 4384, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [] }, { id: 134, name: "salida", type: "exit", x: 7168, y: 4736, width: 384, height: 448, rotation: 0, visible: true, properties: [] }, { id: 135, name: "r0", type: "spawn", x: 1312, y: 3872, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r0" }] }, { id: 136, name: "r0", type: "spawn", x: 1760, y: 5792, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r0" }] }, { id: 137, name: "r0", type: "spawn", x: 352, y: 4576, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r0" }] }, { id: 138, name: "almacen", type: "spawn", x: 1824, y: 3744, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "almacen" }] }, { id: 139, name: "almacen", type: "spawn", x: 608, y: 4256, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "almacen" }] }, { id: 140, name: "r1", type: "spawn", x: 3616, y: 4640, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r1" }] }, { id: 141, name: "r1", type: "spawn", x: 3616, y: 5408, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r1" }] }, { id: 142, name: "r1", type: "spawn", x: 2656, y: 5152, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r1" }] }, { id: 143, name: "hub", type: "spawn", x: 2976, y: 2336, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "hub" }] }, { id: 144, name: "hub", type: "spawn", x: 4704, y: 2336, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "hub" }] }, { id: 145, name: "hub", type: "spawn", x: 2976, y: 3424, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "hub" }] }, { id: 146, name: "hub", type: "spawn", x: 4704, y: 3424, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "hub" }] }, { id: 147, name: "r2", type: "spawn", x: 608, y: 2400, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r2" }] }, { id: 148, name: "r2", type: "spawn", x: 1696, y: 3232, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r2" }] }, { id: 149, name: "r2", type: "spawn", x: 608, y: 3232, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r2" }] }, { id: 150, name: "r3", type: "spawn", x: 7072, y: 2400, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r3" }] }, { id: 151, name: "r3", type: "spawn", x: 5984, y: 3232, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r3" }] }, { id: 152, name: "r3", type: "spawn", x: 7072, y: 3232, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r3" }] }, { id: 153, name: "pasillo", type: "spawn", x: 480, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "pasillo" }] }, { id: 154, name: "pasillo", type: "spawn", x: 7200, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "pasillo" }] }, { id: 155, name: "pasillo", type: "spawn", x: 2592, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "pasillo" }] }, { id: 156, name: "pasillo", type: "spawn", x: 5152, y: 1760, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "pasillo" }] }, { id: 157, name: "r4", type: "spawn", x: 2080, y: 352, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r4" }] }, { id: 158, name: "r4", type: "spawn", x: 480, y: 1504, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r4" }] }, { id: 159, name: "r4", type: "spawn", x: 2080, y: 1504, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r4" }] }, { id: 160, name: "r5", type: "spawn", x: 3040, y: 1440, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r5" }] }, { id: 161, name: "r5", type: "spawn", x: 4640, y: 1440, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r5" }] }, { id: 162, name: "r5", type: "spawn", x: 3040, y: 1120, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r5" }] }, { id: 163, name: "r5", type: "spawn", x: 4640, y: 1120, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r5" }] }, { id: 164, name: "r6", type: "spawn", x: 5600, y: 1440, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r6" }] }, { id: 165, name: "r6", type: "spawn", x: 7200, y: 352, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r6" }] }, { id: 166, name: "r6", type: "spawn", x: 6432, y: 352, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r6" }] }, { id: 167, name: "r7", type: "spawn", x: 4320, y: 4192, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r7" }] }, { id: 168, name: "r7", type: "spawn", x: 6944, y: 4192, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r7" }] }, { id: 169, name: "r7", type: "spawn", x: 4320, y: 5792, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r7" }] }, { id: 170, name: "r7", type: "spawn", x: 6944, y: 5792, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: [{ name: "sala", type: "string", value: "r7" }] }] }], tilesets: [{ firstgid: 1, name: "laboratorio", image: "../client/public/assets/tiles.png", imagewidth: 512, imageheight: 192, tilewidth: 64, tileheight: 64, columns: 8, tilecount: 24, margin: 0, spacing: 0, tiles: [{ id: 8, properties: [{ name: "liquido", type: "bool", value: true }] }, { id: 9, properties: [{ name: "liquido", type: "bool", value: true }] }, { id: 10, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 11, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 12, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 13, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 14, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 15, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 16, properties: [{ name: "solido", type: "bool", value: true }] }, { id: 17, properties: [{ name: "solido", type: "bool", value: true }] }] }] };

// src/game/director.ts
var ENCUENTROS = {
  almacen: ["fusilero", "fusilero", "quimico"],
  r1: ["fusilero", "fusilero", "perro"],
  hub: ["fusilero", "escudo", "medico", "fusilero"],
  r2: ["ingeniero", "perro", "fusilero"],
  r3: ["fusilero", "fusilero", "bioquimico"],
  pasillo: ["francotirador", "criogenista", "fusilero"],
  r4: ["escudo", "medico", "fusilero"],
  r5: ["francotirador", "francotirador", "fusilero"],
  r6: ["lanzallamas", "lanzarredes", "fusilero"],
  r7: ["escudo", "escudo", "medico"]
};
var OLEADAS = {
  p1: [
    ["fusilero", "fusilero", "perro"],
    ["fusilero", "lanzarredes", "criogenista"],
    ["perro", "perro", "fusilero", "quimico"],
    ["escudo", "medico", "fusilero"],
    ["lanzarredes", "lanzallamas", "fusilero"]
  ],
  p2: [
    ["fusilero", "fusilero"],
    ["perro", "ingeniero", "fusilero"],
    ["quimico", "fusilero", "fusilero"],
    ["escudo", "medico", "fusilero"],
    ["perro", "perro", "francotirador"]
  ],
  p3: [
    ["lanzarredes", "fusilero", "fusilero"],
    ["bioquimico", "fusilero", "perro"],
    ["lanzallamas", "lanzarredes"],
    ["criogenista", "francotirador", "fusilero"],
    ["escudo", "medico", "quimico"]
  ],
  p4: [
    ["fusilero", "fusilero", "perro"],
    ["ingeniero", "perro", "fusilero"],
    ["escudo", "medico", "criogenista"],
    ["lanzarredes", "lanzallamas", "fusilero"]
  ],
  p5: [
    ["fusilero", "fusilero", "criogenista"],
    ["francotirador", "fusilero", "quimico"],
    ["escudo", "medico", "bioquimico"],
    ["lanzallamas", "lanzarredes", "perro"]
  ],
  p6: [
    ["fusilero", "fusilero", "perro"],
    ["lanzarredes", "lanzallamas"],
    ["criogenista", "francotirador", "fusilero"],
    ["escudo", "medico", "quimico", "fusilero"]
  ],
  nucleo: [
    ["fusilero", "fusilero", "perro"],
    ["criogenista", "quimico", "fusilero"],
    ["escudo", "medico", "bioquimico"],
    ["lanzarredes", "lanzallamas", "francotirador"]
  ]
};
var SALA_DE = { p1: "r1", p2: "r2", p3: "r3", p4: "r4", p5: "r5", p6: "r6", n1: "r7", n2: "r7", n3: "r7" };
var Director = class {
  constructor(g) {
    this.g = g;
    this.visitadas = /* @__PURE__ */ new Set();
    this.activas = /* @__PURE__ */ new Map();
    this.tutorial = 0;
    this.tutorialT = 3;
    this.roomCheck = 0;
    this.patrulla = 30;
  }
  reset() {
    this.visitadas.clear();
    this.activas.clear();
    this.tutorial = 0;
    this.tutorialT = 3;
    this.patrulla = 30;
  }
  start() {
    this.visitadas.add("r0");
  }
  update(dt) {
    if (process.env.DIRECTOR_APAGADO === "1") {
      this.g.flags.add("tutorial");
      return;
    }
    this.updateTutorial(dt);
    this.roomCheck -= dt;
    if (this.roomCheck <= 0) {
      this.roomCheck = 0.5;
      this.checkRooms();
    }
    for (const [id, a] of this.activas) {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = a.intervalo;
        const lista = OLEADAS[a.clave];
        this.spawnWave(lista[a.idx++ % lista.length], a.sala, id);
      }
    }
    this.patrulla -= dt;
    if (this.patrulla <= 0) {
      this.patrulla = 24;
      this.patrol();
    }
  }
  // ---------------------------------------------------------------- tutorial (sala 0)
  updateTutorial(dt) {
    if (this.g.flags.has("tutorial")) return;
    if (this.tutorial === 0) {
      this.tutorialT -= dt;
      if (this.tutorialT <= 0) {
        this.tutorial = 1;
        this.g.aviso("\xA1Guardias! WASD para moverte, rat\xF3n para apuntar y disparar, ESPACIO para tu habilidad.", "peligro");
        this.spawnWave(["fusilero", "fusilero", "perro"], "r0", "tutorial");
      }
      return;
    }
    if (this.aliveWithTag("tutorial") > 0) return;
    if (this.tutorial === 1) {
      this.tutorial = 2;
      this.g.aviso("Llegan m\xE1s\u2026 Si un compa\xF1ero queda congelado, ac\xE9rcate y mant\xE9n E.", "peligro");
      this.spawnWave(["fusilero", "fusilero", "criogenista"], "almacen", "tutorial");
    } else if (this.tutorial === 2) {
      this.tutorial = 3;
      this.g.flags.add("tutorial");
      this.g.aviso("\xA1Despejado! La puerta hacia la C\xE1mara de contenci\xF3n se abri\xF3.", "exito");
    }
  }
  aliveWithTag(tag) {
    let n = 0;
    this.g.brains.forEach((b, id) => {
      const u = this.g.state.unidades.get(id);
      if (b.tag === tag && u && u.team === "humanos" && u.t !== "torreta" && u.t !== "sensor") n++;
    });
    return n;
  }
  // ---------------------------------------------------------------- salas
  checkRooms() {
    this.g.state.jugadores.forEach((p) => {
      if (!p.vivo) return;
      const room = this.g.world.roomAt(p.x, p.y);
      if (!room || this.visitadas.has(room.id)) return;
      this.visitadas.add(room.id);
      if (room.id === "r7") this.spawnBoss();
      const enc = ENCUENTROS[room.id];
      if (enc) this.spawnWave(enc, room.id, "sala-" + room.id);
    });
  }
  spawnBoss() {
    const o = this.g.world.findOne("boss_spawn");
    if (!o || this.g.state.jefe) return;
    this.g.spawnUnit("jefe", o.x, o.y, "humanos", "jefe");
    this.g.aviso("\xA1El JEFE DE LABORATORIO! Activen las 3 estaciones para romper sus dep\xF3sitos.", "peligro");
  }
  // ---------------------------------------------------------------- puzzles
  onPuzzleStart(id) {
    const def = PUZZLES[id];
    const clave = def.tipo === "nucleo" ? "nucleo" : id;
    if (def.tipo === "nucleo" && [...this.activas.values()].some((a) => a.clave === "nucleo")) return;
    const intervalo = def.tipo === "individual" ? 15 : def.tipo === "duo" ? 18 : 16;
    this.activas.set(def.tipo === "nucleo" ? "nucleo" : id, { timer: 4, idx: 0, clave, sala: SALA_DE[id], intervalo });
  }
  onPuzzleEnd(id) {
    const def = PUZZLES[id];
    if (def.tipo === "nucleo") {
      const otras = ["n1", "n2", "n3"].some((n) => this.g.state.puzzles.get(n)?.estado === "activo");
      if (!otras) this.activas.delete("nucleo");
    } else this.activas.delete(id);
  }
  onPuzzleFail(id) {
    const def = PUZZLES[id];
    const lista = OLEADAS[def.tipo === "nucleo" ? "nucleo" : id];
    const castigo = [...lista[Math.floor(Math.random() * lista.length)], ...lista[Math.floor(Math.random() * lista.length)]];
    this.spawnWave(castigo, SALA_DE[id], "castigo");
    this.onPuzzleEnd(id);
  }
  // ---------------------------------------------------------------- patrullas
  patrol() {
    if (this.countEnemies() >= 6) return;
    const vivos = [];
    this.g.state.jugadores.forEach((p2) => p2.vivo && vivos.push({ x: p2.x, y: p2.y }));
    if (!vivos.length) return;
    const p = vivos[Math.floor(Math.random() * vivos.length)];
    const room = this.g.world.roomAt(p.x, p.y);
    if (!room || room.id === "r0" || room.id === "salida") return;
    const grupos = [
      ["fusilero", "perro"],
      ["fusilero", "quimico"],
      ["fusilero", "fusilero", "criogenista"],
      ["perro", "perro"]
    ];
    this.spawnWave(grupos[Math.floor(Math.random() * grupos.length)], room.id, "patrulla");
  }
  // ---------------------------------------------------------------- aparición
  countEnemies() {
    let n = 0;
    this.g.state.unidades.forEach((u) => {
      if (u.team === "humanos" && u.t !== "torreta" && u.t !== "sensor") n++;
    });
    return n;
  }
  spawnWave(tipos, sala, tag) {
    if (process.env.DIRECTOR_APAGADO === "1") return;
    let puntos = this.g.world.find("spawn").filter((o) => o.name === sala);
    if (!puntos.length) return;
    const jugadores = [];
    this.g.state.jugadores.forEach((p) => p.vivo && jugadores.push({ x: p.x, y: p.y }));
    const lejos = puntos.filter((o) => jugadores.every((p) => dist(p.x, p.y, o.x, o.y) > 380));
    if (lejos.length) puntos = lejos;
    tipos.forEach((t, i) => {
      if (this.countEnemies() >= MAX_ENEMIES_ALIVE) return;
      const o = puntos[i % puntos.length];
      const x = o.x + (Math.random() - 0.5) * 50;
      const y = o.y + (Math.random() - 0.5) * 50;
      this.g.spawnUnit(t, this.g.world.blocksMoveAt(x, y) ? o.x : x, this.g.world.blocksMoveAt(x, y) ? o.y : y, "humanos", tag);
    });
  }
  spawnNear(tipos, x, y, tag) {
    tipos.forEach((t, i) => {
      if (this.countEnemies() >= MAX_ENEMIES_ALIVE) return;
      const a = i / tipos.length * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 110;
      const py = y + Math.sin(a) * 110;
      if (!this.g.world.blocksMoveAt(px, py)) this.g.spawnUnit(t, px, py, "humanos", tag);
    });
  }
};

// src/game/enemigos.ts
var AGGRO = 1500;
function updateUnits(g, dt) {
  const solids = g.solidProps();
  const entries = [];
  g.state.unidades.forEach((u, id) => {
    const b = g.brains.get(id);
    if (b) entries.push([id, u, b]);
  });
  for (const [uid, u, b] of entries) {
    if (!g.state.unidades.has(uid)) continue;
    if (Math.round(b.x) !== u.x || Math.round(b.y) !== u.y) {
      b.x = u.x;
      b.y = u.y;
    }
    if (b.shieldT > 0) b.shieldT -= dt;
    u.blindado = b.shieldT > 0;
    u.moviendo = false;
    if (b.stun > 0) {
      b.stun -= dt;
      u.st = "aturdido";
      b.aimT = 0;
      continue;
    }
    if (u.st === "aturdido") u.st = "";
    b.cd -= dt;
    if (u.team === "aliens") {
      updatePulpo(g, uid, u, b, dt, solids);
      continue;
    }
    switch (u.t) {
      case "torreta":
        updateTorreta(g, u, b, dt);
        break;
      case "sensor":
        updateSensor(g, u, b, dt);
        break;
      case "medico":
        updateMedico(g, uid, u, b, dt, solids, entries);
        break;
      default:
        updateSoldado(g, uid, u, b, dt, solids);
    }
  }
  separate(g, entries);
}
function findTarget(g, u, b, ignoreDisguise) {
  let best = null;
  let bd = AGGRO;
  const consider = (t, extra = 0) => {
    const flow = t.player ? g.flows.get(t.id) : void 0;
    let d = flow ? flow.at(u.x, u.y) * 64 : -1;
    if (d < 0) d = dist(u.x, u.y, t.x, t.y) * 1.6;
    d += extra;
    if (t.id === b.target) d *= 0.75;
    if (d < bd) {
      bd = d;
      best = t;
    }
  };
  g.state.jugadores.forEach((p, id) => {
    if (!p.vivo || p.fantasma) return;
    if (p.disfrazado && !ignoreDisguise) return;
    consider({ id, x: p.x, y: p.y, player: p });
  });
  g.state.unidades.forEach((o, id) => {
    if (o.team === "aliens") consider({ id, x: o.x, y: o.y }, 60);
  });
  if (best) b.target = best.id;
  return best;
}
function move(g, u, b, dx, dy, speed, dt, solids, r) {
  const len = Math.hypot(dx, dy);
  if (len < 0.01 || speed <= 0) return;
  const pos = g.world.moveCircle(b.x, b.y, dx / len * speed * dt, dy / len * speed * dt, r, solids);
  if (Math.abs(pos.x - b.x) + Math.abs(pos.y - b.y) > 0.3) u.moviendo = true;
  b.x = pos.x;
  b.y = pos.y;
  u.x = Math.round(pos.x);
  u.y = Math.round(pos.y);
}
function approachDir(g, u, t, los) {
  if (!los && t.player) {
    const f = g.flows.get(t.id);
    const d = f?.direction(u.x, u.y);
    if (d) return d;
  }
  const len = dist(u.x, u.y, t.x, t.y) || 1;
  return { x: (t.x - u.x) / len, y: (t.y - u.y) / len };
}
function separate(g, entries) {
  for (let i = 0; i < entries.length; i++) {
    const [ia, a, ba] = entries[i];
    if (!g.state.unidades.has(ia) || ENEMIES_SPEED(a) === 0) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const [ib, c, bc] = entries[j];
      if (!g.state.unidades.has(ib)) continue;
      const ra = radius(a);
      const rb = radius(c);
      const dx = ba.x - bc.x;
      const dy = ba.y - bc.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (ENEMIES_SPEED(a) > 0 && !g.world.blocksMoveAt(ba.x + nx * push, ba.y + ny * push)) {
          ba.x += nx * push;
          ba.y += ny * push;
          a.x = Math.round(ba.x);
          a.y = Math.round(ba.y);
        }
        if (ENEMIES_SPEED(c) > 0 && !g.world.blocksMoveAt(bc.x - nx * push, bc.y - ny * push)) {
          bc.x -= nx * push;
          bc.y -= ny * push;
          c.x = Math.round(bc.x);
          c.y = Math.round(bc.y);
        }
      }
    }
  }
}
function radius(u) {
  return u.t === "pulpo" ? 16 : ENEMIES[u.t].radius;
}
function ENEMIES_SPEED(u) {
  return u.t === "pulpo" ? TRANSMUTAR.pulpoSpeed : ENEMIES[u.t].speed;
}
function updateSoldado(g, uid, u, b, dt, solids) {
  const def = ENEMIES[u.t];
  const t = findTarget(g, u, b, u.t === "perro");
  if (u.t === "perro") sniff(g, u, b, dt);
  if (u.t === "jefe") bossTick(g, uid, u, b, dt);
  if (!t) {
    u.st = u.st === "apuntando" ? "" : u.st;
    return;
  }
  const d = dist(u.x, u.y, t.x, t.y);
  const los = d < 1100 && g.world.lineOfSight(u.x, u.y, t.x, t.y);
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  const [minR, maxR] = def.range;
  if (u.t === "francotirador" && b.aimT > 0) {
    if (!los) {
      b.aimT = 0;
      u.st = "";
    } else {
      const tn = ENEMY_TUNING.francotirador;
      b.aimT += dt;
      if (b.aimT < tn.lockAt) u.ang = turn(u.ang, toT, 4 * dt);
      u.stT = Math.min(1, b.aimT / tn.aimTime);
      if (b.aimT >= tn.aimTime) {
        g.spawnProjectile("rayo_franco", "humanos", u.x + Math.cos(u.ang) * 30, u.y + Math.sin(u.ang) * 30, u.ang, tn.bulletSpeed, { damage: tn.damage, range: 1400 });
        b.aimT = 0;
        b.cd = tn.cooldown;
        u.st = "";
      }
      return;
    }
  }
  let dir = { x: 0, y: 0 };
  let speed = def.speed;
  if (!los || d > maxR) {
    dir = approachDir(g, u, t, los);
  } else if (d < minR || def.cientifico && d < 200) {
    dir = { x: (u.x - t.x) / (d || 1), y: (u.y - t.y) / (d || 1) };
    if (def.cientifico) speed *= 1.1;
  } else if (u.t !== "torreta") {
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe *= -1;
      b.strafeT = 1.2 + Math.random() * 2;
    }
    dir = { x: -Math.sin(toT) * b.strafe, y: Math.cos(toT) * b.strafe };
    speed *= 0.45;
  }
  if (u.t === "lanzallamas" && los && d < ENEMY_TUNING.lanzallamas.range) speed *= 0.4;
  move(g, u, b, dir.x, dir.y, speed, dt, solids, def.radius);
  u.ang = los ? turn(u.ang, toT, 6 * dt) : Math.atan2(dir.y, dir.x) || u.ang;
  if (!los) return;
  attack(g, uid, u, b, t, d, toT, dt);
}
function attack(g, uid, u, b, t, d, toT, dt) {
  const def = ENEMIES[u.t];
  switch (u.t) {
    case "fusilero": {
      const tn = ENEMY_TUNING.fusilero;
      if (b.burst <= 0 && b.cd <= 0 && d < def.range[1] + 120) {
        b.burst = tn.burst;
        b.burstT = 0;
        b.cd = tn.cooldown + Math.random() * 0.8;
      }
      if (b.burst > 0) {
        b.burstT -= dt;
        if (b.burstT <= 0) {
          const a = u.ang + (Math.random() - 0.5) * 0.12;
          g.spawnProjectile("bala_roja", "humanos", u.x + Math.cos(a) * 26, u.y + Math.sin(a) * 26, a, tn.bulletSpeed, { damage: tn.damage, range: 800 });
          b.burst--;
          b.burstT = tn.burstGap;
        }
      }
      break;
    }
    case "escudo": {
      const tn = ENEMY_TUNING.escudo;
      if (d < tn.meleeRange + 10 && b.cd <= 0) {
        b.cd = tn.cooldown;
        hitTarget(g, t, tn.meleeDamage, uid);
        if (t.player) {
          g.setEstado(t.id, t.player, "aturdido", tn.stun);
          const pos = g.world.moveCircle(t.player.x, t.player.y, Math.cos(toT) * 50, Math.sin(toT) * 50, 18, g.solidProps());
          t.player.x = pos.x;
          t.player.y = pos.y;
        }
        g.fx("impacto", t.x, t.y, { c: 16777215 });
      }
      break;
    }
    case "lanzarredes": {
      const tn = ENEMY_TUNING.lanzarredes;
      if (b.cd <= 0 && d < def.range[1] + 100 && t.player) {
        b.cd = tn.cooldown;
        g.spawnProjectile("red_proy", "humanos", u.x + Math.cos(u.ang) * 26, u.y + Math.sin(u.ang) * 26, u.ang, tn.netSpeed, { damage: 0, range: 700 });
      }
      break;
    }
    case "lanzallamas": {
      const tn = ENEMY_TUNING.lanzallamas;
      if (d > tn.range) break;
      u.st = "lanzando";
      const cone = tn.cone * Math.PI / 180;
      g.state.jugadores.forEach((p, id) => {
        if (!p.vivo || p.fantasma) return;
        const dd = dist(u.x, u.y, p.x, p.y);
        if (dd < tn.range && Math.abs(angleDiff(u.ang, Math.atan2(p.y - u.y, p.x - u.x))) < cone) g.damagePlayer(id, p, tn.dps * dt);
      });
      g.state.unidades.forEach((o, oid) => {
        if (o.team !== "aliens") return;
        if (dist(u.x, u.y, o.x, o.y) < tn.range && Math.abs(angleDiff(u.ang, Math.atan2(o.y - u.y, o.x - u.x))) < cone) {
          o.hp -= tn.dps * dt;
          if (o.hp <= 0) g.killUnit(oid, o, "");
        }
      });
      b.flameT -= dt;
      if (b.flameT <= 0) {
        b.flameT = 0.12;
        g.fx("llamas", u.x + Math.cos(u.ang) * 30, u.y + Math.sin(u.ang) * 30, { x2: u.x + Math.cos(u.ang) * tn.range, y2: u.y + Math.sin(u.ang) * tn.range });
      }
      b.patchT -= dt;
      if (b.patchT <= 0) {
        b.patchT = tn.firePatchEvery;
        const px = u.x + Math.cos(u.ang) * tn.range * 0.7;
        const py = u.y + Math.sin(u.ang) * tn.range * 0.7;
        if (!g.world.blocksMoveAt(px, py)) g.addZone("fuego", px, py, 42, tn.patchLife);
      }
      break;
    }
    case "francotirador": {
      if (b.cd <= 0 && d < 1e3) {
        b.aimT = 1e-3;
        u.st = "apuntando";
        u.stT = 0;
      }
      break;
    }
    case "perro": {
      const tn = ENEMY_TUNING.perro;
      if (d < def.radius + 26 && b.cd <= 0) {
        b.cd = tn.cooldown;
        hitTarget(g, t, tn.biteDamage, uid);
      }
      break;
    }
    case "criogenista":
    case "quimico":
    case "bioquimico": {
      const tn = ENEMY_TUNING[u.t];
      if (b.cd <= 0 && d < 560) {
        b.cd = tn.cooldown + Math.random();
        const k = u.t === "criogenista" ? "frasco_azul" : u.t === "quimico" ? "frasco_verde" : "frasco_morado";
        g.throwFlask(k, u.x, u.y - 10, t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 40, tn.flight, uid);
        u.st = "lanzando";
        u.stT = 0.3;
      } else if (u.st === "lanzando" && b.cd < tn.cooldown - 0.4) u.st = "";
      break;
    }
    case "ingeniero": {
      const tn = ENEMY_TUNING.ingeniero;
      b.devices = b.devices.filter((id) => g.state.unidades.has(id));
      if (b.cd <= 0) {
        b.cd = tn.cooldown;
        const hasT = b.devices.some((id) => g.state.unidades.get(id)?.t === "torreta");
        const hasS = b.devices.some((id) => g.state.unidades.get(id)?.t === "sensor");
        const ox = u.x + Math.cos(u.ang + Math.PI / 2) * 50;
        const oy = u.y + Math.sin(u.ang + Math.PI / 2) * 50;
        if (g.world.blocksMoveAt(ox, oy)) break;
        if (!hasT) b.devices.push(g.spawnUnit("torreta", ox, oy, "humanos", b.tag));
        else if (!hasS) b.devices.push(g.spawnUnit("sensor", ox, oy, "humanos", b.tag));
        g.fx("chispa", ox, oy);
      }
      break;
    }
    case "jefe": {
      const tn = ENEMY_TUNING.jefe;
      if (b.cd <= 0 && d < 700) {
        b.cd = u.tanques > 0 ? tn.cooldown : tn.angryCooldown;
        const kinds = ["frasco_azul", "frasco_verde", "frasco_morado"];
        const k = kinds[b.kinds++ % 3];
        for (const off of [-80, 0, 80]) {
          const px = t.x + Math.cos(toT + Math.PI / 2) * off;
          const py = t.y + Math.sin(toT + Math.PI / 2) * off;
          g.throwFlask(k, u.x, u.y - 30, px, py, 1, uid);
        }
        u.st = "lanzando";
        u.stT = 0.4;
      }
      break;
    }
    default:
      break;
  }
}
function hitTarget(g, t, dmg, from) {
  if (t.player) {
    g.damagePlayer(t.id, t.player, dmg);
    return;
  }
  const o = g.state.unidades.get(t.id);
  if (!o) return;
  o.hp -= dmg;
  if (o.hp <= 0) g.killUnit(t.id, o, "");
  void from;
}
function sniff(g, u, b, dt) {
  b.t2 -= dt;
  if (b.t2 > 0) return;
  g.state.jugadores.forEach((p, id) => {
    if (!p.disfrazado || !p.vivo) return;
    if (dist(u.x, u.y, p.x, p.y) < ENEMY_TUNING.perro.sniffRange) {
      b.t2 = 6;
      g.fx("ladrido", u.x, u.y);
      g.revelar(id, p, "\xA1Un perro te oli\xF3 y ladr\xF3! Se rompi\xF3 tu disfraz.");
      b.target = id;
    }
  });
}
function bossTick(g, uid, u, b, dt) {
  b.t2 += dt;
  if (b.t2 >= ENEMY_TUNING.jefe.reinforceEvery) {
    b.t2 = 0;
    g.director.spawnNear(["fusilero", "escudo", "medico"], u.x, u.y, "jefe");
    g.aviso("\xA1El Jefe llam\xF3 refuerzos!", "peligro");
  }
  void uid;
}
function updateTorreta(g, u, b, dt) {
  const tn = ENEMY_TUNING.torreta;
  const t = findTarget(g, u, b, false);
  if (!t) return;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d > ENEMIES.torreta.range[1] || !g.world.lineOfSight(u.x, u.y, t.x, t.y)) return;
  const toT = Math.atan2(t.y - u.y, t.x - u.x);
  u.ang = turn(u.ang, toT, 5 * dt);
  if (b.cd <= 0 && Math.abs(angleDiff(u.ang, toT)) < 0.2) {
    b.cd = tn.cooldown;
    g.spawnProjectile("bala_roja", "humanos", u.x + Math.cos(u.ang) * 26, u.y + Math.sin(u.ang) * 26, u.ang, tn.bulletSpeed, { damage: tn.damage, range: 700 });
  }
}
function updateSensor(g, u, b, dt) {
  b.t2 -= dt;
  u.ang += dt * 2;
  if (b.t2 > 0) return;
  g.state.jugadores.forEach((p, id) => {
    if (!p.disfrazado || !p.vivo) return;
    if (dist(u.x, u.y, p.x, p.y) < ENEMY_TUNING.ingeniero.sensorRange && g.world.lineOfSight(u.x, u.y, p.x, p.y)) {
      b.t2 = 2;
      g.revelar(id, p, "\xA1Un sensor detect\xF3 tu disfraz! Destr\xFAyelo.");
      g.fx("revelado", u.x, u.y);
    }
  });
}
function updateMedico(g, uid, u, b, dt, solids, entries) {
  const tn = ENEMY_TUNING.medico;
  let ally = null;
  let ad = 700;
  for (const [oid, o, ob] of entries) {
    if (oid === uid || o.team !== "humanos" || o.t === "torreta" || o.t === "sensor" || !g.state.unidades.has(oid)) continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < tn.healRange && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + tn.healPerSec * dt);
    if (d < ad) {
      ad = d;
      ally = o;
    }
    if (b.cd <= 0 && d < tn.healRange) ob.shieldT = tn.shieldTime;
  }
  if (b.cd <= 0) {
    b.cd = tn.cooldown;
    g.fx("rescate", u.x, u.y, { c: 4124927 });
  }
  const t = findTarget(g, u, b, false);
  let dir = { x: 0, y: 0 };
  if (t && dist(u.x, u.y, t.x, t.y) < 260) {
    const d = dist(u.x, u.y, t.x, t.y) || 1;
    dir = { x: (u.x - t.x) / d, y: (u.y - t.y) / d };
  } else if (ally && ad > tn.healRange * 0.6) {
    const a = ally;
    dir = { x: a.x - u.x, y: a.y - u.y };
  } else if (!ally && t) {
    dir = approachDir(g, u, t, g.world.lineOfSight(u.x, u.y, t.x, t.y));
  }
  move(g, u, b, dir.x, dir.y, ENEMIES.medico.speed, dt, solids, ENEMIES.medico.radius);
  if (t) u.ang = Math.atan2(t.y - u.y, t.x - u.x);
}
function updatePulpo(g, uid, u, b, dt, solids) {
  b.life -= dt;
  if (b.life <= 0) {
    g.killUnit(uid, u, "");
    return;
  }
  let best = null;
  let bd = 900;
  g.state.unidades.forEach((o, oid) => {
    if (o.team !== "humanos" || o.t === "sensor") return;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d < bd && g.world.lineOfSight(u.x, u.y, o.x, o.y)) {
      bd = d;
      best = [oid, o];
    }
  });
  if (best) {
    const [oid, o] = best;
    const r = ENEMIES[o.t].radius;
    if (bd > r + 20) move(g, u, b, o.x - u.x, o.y - u.y, TRANSMUTAR.pulpoSpeed, dt, solids, 16);
    u.ang = Math.atan2(o.y - u.y, o.x - u.x);
    if (bd < r + 28 && b.cd <= 0) {
      b.cd = 0.5;
      g.hitUnit(oid, o, TRANSMUTAR.pulpoDamage, null, b.owner);
      g.fx("impacto", o.x, o.y, { c: 16739133 });
    }
    return;
  }
  const owner = g.state.jugadores.get(b.owner);
  if (owner && owner.vivo && dist(u.x, u.y, owner.x, owner.y) > 90) {
    const f = g.flows.get(b.owner);
    const d = f?.direction(u.x, u.y) ?? { x: owner.x - u.x, y: owner.y - u.y };
    move(g, u, b, d.x, d.y, TRANSMUTAR.pulpoSpeed * 0.8, dt, solids, 16);
  }
}
function turn(a, target, maxStep) {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

// src/game/flujo.ts
var DIRS = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [1, -1, 14],
  [-1, 1, 14],
  [-1, -1, 14]
];
var FlowField = class {
  constructor(world) {
    this.world = world;
    this.dist = new Int32Array(world.w * world.h).fill(-1);
  }
  build(x, y) {
    const { world, dist: dist2 } = this;
    dist2.fill(-1);
    const sx = Math.floor(x / TILE);
    const sy = Math.floor(y / TILE);
    if (!world.inBounds(sx, sy)) return;
    const buckets = [];
    const push = (i, d) => {
      (buckets[d] ??= []).push(i);
    };
    dist2[world.idx(sx, sy)] = 0;
    push(world.idx(sx, sy), 0);
    for (let d = 0; d < buckets.length; d++) {
      const b = buckets[d];
      if (!b) continue;
      for (const i of b) {
        if (dist2[i] !== d) continue;
        const cx = i % world.w;
        const cy = (i - cx) / world.w;
        for (const [dx, dy, c] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (world.blocksMove(nx, ny)) continue;
          if (dx !== 0 && dy !== 0 && (world.blocksMove(cx + dx, cy) || world.blocksMove(cx, cy + dy))) continue;
          const ni = world.idx(nx, ny);
          const nd = d + c;
          if (dist2[ni] === -1 || nd < dist2[ni]) {
            dist2[ni] = nd;
            push(ni, nd);
          }
        }
      }
      buckets[d] = [];
      if (d > 8e3) break;
    }
  }
  /** Distancia en casillas (aprox.) desde la posición, o -1 si no hay camino. */
  at(x, y) {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (!this.world.inBounds(cx, cy)) return -1;
    const d = this.dist[this.world.idx(cx, cy)];
    return d < 0 ? -1 : d / 10;
  }
  /** Dirección normalizada hacia la siguiente casilla del camino. */
  direction(x, y) {
    const { world, dist: dist2 } = this;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (!world.inBounds(cx, cy)) return null;
    const here = dist2[world.idx(cx, cy)];
    if (here < 0) return null;
    let best = here;
    let bx = -1;
    let by = -1;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (world.blocksMove(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (world.blocksMove(cx + dx, cy) || world.blocksMove(cx, cy + dy))) continue;
      const d = dist2[world.idx(nx, ny)];
      if (d >= 0 && d < best) {
        best = d;
        bx = nx;
        by = ny;
      }
    }
    if (bx < 0) return null;
    const tx = (bx + 0.5) * TILE - x;
    const ty = (by + 0.5) * TILE - y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }
};

// src/game/puzzles.ts
var Puzzles = class {
  constructor(g) {
    this.g = g;
    this.obj = /* @__PURE__ */ new Map();
    this.rayos = { ronda: 1, sec: [], idx: 0 };
    this.esclusa = null;
    /** Palancas reservadas antes de empezar la esclusa. */
    this.palancas = { A: "", B: "" };
    /** Cuándo empezó cada puzzle (para el mínimo de 30 s). */
    this.inicio = /* @__PURE__ */ new Map();
    this.ultimoBonus = /* @__PURE__ */ new Map();
  }
  init() {
    this.obj.clear();
    for (const o of this.g.world.objects) {
      if (["station", "switch", "dispenser", "slot", "button", "lever"].includes(o.type)) {
        const k = `${o.type}:${o.name}`;
        if (!this.obj.has(k)) this.obj.set(k, []);
        this.obj.get(k).push(o);
      }
    }
    for (const id of Object.keys(PUZZLES)) {
      const pz = new Puzzle();
      pz.total = PUZZLES[id].duracion;
      this.g.state.puzzles.set(id, pz);
    }
    this.esclusa = null;
    this.palancas = { A: "", B: "" };
    this.rayos = { ronda: 1, sec: [], idx: 0 };
  }
  get(type3, name) {
    return this.obj.get(`${type3}:${name}`) ?? [];
  }
  pz(id) {
    return this.g.state.puzzles.get(id);
  }
  actores(pz) {
    return pz.actores ? pz.actores.split(",") : [];
  }
  player(id) {
    return this.g.state.jugadores.get(id);
  }
  // ------------------------------------------------------------------ E (interactuar)
  interact(id, p) {
    if (p.ocupado) return;
    for (const pid of ["p1", "p2", "p3", "n1", "n2", "n3", "p4"]) {
      const st = this.get("station", pid)[0];
      if (!st || dist(p.x, p.y, st.x, st.y) > INTERACT_RANGE + 10) continue;
      if (pid === "p4") return this.startRayos(id, p);
      return this.startIndividual(pid, id, p);
    }
    for (const lv of this.get("lever", "p6")) {
      if (dist(p.x, p.y, lv.x, lv.y) <= INTERACT_RANGE + 10) return this.lever(id, p, String(lv.props.parte));
    }
    const btn = this.get("button", "p5")[0];
    if (btn && dist(p.x, p.y, btn.x, btn.y) <= INTERACT_RANGE + 10) return this.pressBridgeButton(id, p);
  }
  startIndividual(pid, id, p) {
    const pz = this.pz(pid);
    const def = PUZZLES[pid];
    const role = def.roles[0];
    if (pz.estado === "resuelto") return this.g.aviso("Esta consola ya est\xE1 resuelta.", "info", id);
    if (pz.estado === "bloqueado") return this.g.aviso(`Consola bloqueada: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    if (pz.estado === "activo") return;
    if (!this.g.qualifies(p, role)) return this.g.aviso(`Solo el ${ALIENS[role].nombre} (o quien lleve su alma) puede usar esta consola.`, "info", id);
    if (def.minijuego === "cara" && !p.disfrazado) return this.g.aviso("Necesitas estar disfrazado de humano para usar el esc\xE1ner (ESPACIO).", "info", id);
    pz.estado = "activo";
    pz.tiempo = def.duracion;
    pz.total = def.duracion;
    pz.actores = id;
    pz.solo = false;
    pz.datos = JSON.stringify({ semilla: Math.floor(Math.random() * 1e9), inicio: this.g.time });
    p.ocupado = pid;
    this.inicio.set(pid, this.g.time);
    this.g.aviso(`${p.nombre} empez\xF3 "${def.nombre}". \xA1Defi\xE9ndanlo! Dura de ${MINIGAME_MIN} a ${def.duracion} s: cuanto mejor lo haga, antes termina.`, "info");
    this.g.director.onPuzzleStart(pid);
  }
  // ------------------------------------------------------------------ mensajes de minijuego
  message(id, msg) {
    if (!msg || typeof msg.id !== "string") return;
    const pz = this.g.state.puzzles.get(msg.id);
    if (!pz || pz.estado !== "activo") return;
    if (msg.id === "p6") return this.esclusaNota(id, msg);
    if (!this.actores(pz).includes(id)) return;
    if (msg.ev === "fallo") this.fail(msg.id, msg.razon ? String(msg.razon).slice(0, 80) : "Fall\xF3 el minijuego.");
    else if (msg.ev === "acierto" && msg.rapido) this.bonus(msg.id);
  }
  /** Resta MINIGAME_BONUS segundos, sin que el puzzle dure menos de MINIGAME_MIN en total. */
  bonus(pid) {
    const pz = this.pz(pid);
    const ahora = this.g.time;
    if (ahora - (this.ultimoBonus.get(pid) ?? -99) < 1.5) return;
    this.ultimoBonus.set(pid, ahora);
    const transcurrido = ahora - (this.inicio.get(pid) ?? ahora);
    const minimoRestante = Math.max(0, MINIGAME_MIN - transcurrido);
    pz.tiempo = Math.max(minimoRestante, pz.tiempo - MINIGAME_BONUS);
  }
  // ------------------------------------------------------------------ eventos de jugadores
  // Recibir golpes, quedar congelado o perder el disfraz ya no hace fallar al instante:
  // el minijuego del cliente cuenta cada golpe como un error (se permiten ERRORES_PERMITIDOS).
  onPlayerHit(_id, _amount) {
  }
  onPlayerStatus(_id) {
  }
  onPlayerDown(id) {
    this.g.state.puzzles.forEach((pz, pid) => {
      if (pz.estado === "activo" && this.actores(pz).includes(id)) this.fail(pid, "Cay\xF3 quien hac\xEDa el puzzle.");
    });
    if (this.palancas.A === id) this.palancas.A = "";
    if (this.palancas.B === id) this.palancas.B = "";
  }
  // ------------------------------------------------------------------ bucle
  update(dt) {
    this.g.state.puzzles.forEach((pz, pid) => {
      if (pz.estado === "bloqueado") {
        pz.tiempo -= dt;
        if (pz.tiempo <= 0) {
          pz.estado = "libre";
          pz.tiempo = 0;
          this.g.aviso(`La consola de "${PUZZLES[pid].nombre}" se desbloque\xF3.`, "info");
        }
        return;
      }
      if (pz.estado !== "activo") return;
      const def = PUZZLES[pid];
      if (def.minijuego === "valvulas") return this.updateEsclusa(dt);
      pz.tiempo -= dt;
      if (def.minijuego === "puente") this.updatePuente(dt);
      if (def.tipo === "individual" || def.tipo === "nucleo") {
        const actor = this.player(pz.actores);
        if (!actor || !actor.vivo) return this.fail(pid, "Cay\xF3 quien hac\xEDa el puzzle.");
        const st = this.get("station", pid)[0];
        if (st && dist(actor.x, actor.y, st.x, st.y) > INTERACT_RANGE * 2) return this.fail(pid, "Se alej\xF3 de la consola.");
        if (pz.tiempo <= 0) return this.resolve(pid);
      } else if (pz.tiempo <= 0) {
        return this.fail(pid, "\xA1Se acab\xF3 el tiempo!");
      }
    });
  }
  fail(pid, razon) {
    const pz = this.pz(pid);
    if (pz.estado !== "activo") return;
    const def = PUZZLES[pid];
    for (const a of this.actores(pz)) {
      const p = this.player(a);
      if (p && p.ocupado === pid) p.ocupado = "";
    }
    pz.estado = "bloqueado";
    pz.tiempo = MINIGAME_LOCK;
    pz.actores = "";
    pz.datos = "";
    if (pid === "p5") this.resetPuente();
    if (pid === "p6") this.resetEsclusa();
    if (pid === "p4") this.rayos = { ronda: 1, sec: [], idx: 0 };
    this.g.aviso(`\u2716 Fall\xF3 "${def.nombre}": ${razon} Llegan m\xE1s soldados y la consola se bloquea ${MINIGAME_LOCK} s.`, "peligro");
    this.g.director.onPuzzleFail(pid);
  }
  resolve(pid) {
    const pz = this.pz(pid);
    const def = PUZZLES[pid];
    for (const a of this.actores(pz)) {
      const p = this.player(a);
      if (p && p.ocupado === pid) p.ocupado = "";
    }
    pz.estado = "resuelto";
    pz.tiempo = 0;
    this.g.flags.add(pid);
    this.g.director.onPuzzleEnd(pid);
    const st = this.get("station", pid)[0];
    if (st) this.g.fx("rescate", st.x, st.y, { c: 8257386 });
    if (def.tipo === "nucleo") {
      const jefe = this.g.state.jefe ? this.g.state.unidades.get(this.g.state.jefe) : void 0;
      if (jefe && jefe.tanques > 0) jefe.tanques--;
      const quedan = ["n1", "n2", "n3"].filter((n) => !this.g.flags.has(n)).length;
      this.g.fx("nucleo", 88 * TILE, 78 * TILE);
      this.g.aviso(quedan ? `\xA1Dep\xF3sito del jefe destruido! Quedan ${quedan}.` : "\xA1Los tres dep\xF3sitos rotos! El jefe ya no tiene blindaje: \xA1ac\xE1benlo!", "exito");
    } else {
      this.g.aviso(`\u2714 "${def.nombre}" resuelto.`, "exito");
    }
  }
  // ------------------------------------------------------------------ dúos: ¿quién hace cada papel?
  /** Devuelve [jugadorRolA, jugadorRolB, solo] o null si nadie puede. */
  repartir(pid, starter) {
    const [ra, rb] = PUZZLES[pid].roles;
    const vivos = [];
    this.g.state.jugadores.forEach((p, id) => p.vivo && vivos.push([id, p]));
    const s = this.player(starter);
    const sA = this.g.qualifies(s, ra);
    const sB = this.g.qualifies(s, rb);
    const other = (role) => vivos.find(([id, p]) => id !== starter && this.g.qualifies(p, role));
    if (sA) {
      const o = other(rb);
      if (o) return [starter, o[0], false];
      if (sB) return [starter, starter, true];
    }
    if (sB) {
      const o = other(ra);
      if (o) return [o[0], starter, false];
    }
    return null;
  }
  // ------------------------------------------------------------------ P4: Sala de rayos
  startRayos(id, p) {
    const pz = this.pz("p4");
    if (pz.estado === "resuelto") return;
    if (pz.estado === "bloqueado") return this.g.aviso(`Consola bloqueada: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    if (!this.g.qualifies(p, "cambiaformas")) return this.g.aviso("La consola solo muestra el c\xF3digo a humanos: necesita al Cambiaformas disfrazado.", "info", id);
    if (!p.disfrazado) return this.g.aviso("Disfr\xE1zate (ESPACIO) para que la consola te muestre el c\xF3digo.", "info", id);
    if (pz.estado === "activo") return;
    const r = this.repartir("p4", id);
    if (!r) return this.g.aviso("Hace falta alguien con telequinesis (el Inteligente o su alma).", "info", id);
    const [a, b, solo] = r;
    pz.estado = "activo";
    pz.solo = solo;
    pz.total = pz.tiempo = PUZZLES.p4.duracion * (solo ? SOLO_TIME_FACTOR : 1);
    pz.actores = solo ? a : `${a},${b}`;
    this.rayos = { ronda: 1, sec: this.secuencia(4), idx: 0 };
    this.syncRayos();
    const pb = this.player(b);
    this.g.aviso(
      solo ? `${p.nombre} hace los dos papeles: memoriza el c\xF3digo de la consola y act\xEDvalo con telequinesis en los interruptores.` : `Sala de rayos: ${p.nombre} lee el c\xF3digo en la consola y ${pb.nombre} activa los interruptores con telequinesis. \xA1Comun\xEDquense!`,
      "info"
    );
    this.g.director.onPuzzleStart("p4");
  }
  secuencia(n) {
    const out = [];
    while (out.length < n) {
      const s = Math.floor(Math.random() * RAYOS_SIMBOLOS.length);
      if (out[out.length - 1] !== s) out.push(s);
    }
    return out;
  }
  syncRayos() {
    this.pz("p4").datos = JSON.stringify({ ronda: this.rayos.ronda, sec: this.rayos.sec, idx: this.rayos.idx });
  }
  switchAt(x, y) {
    return this.get("switch", "p4").find((o) => dist(x, y, o.x, o.y) < 60);
  }
  // ------------------------------------------------------------------ P5: Puente sobre el ácido
  updatePuente(dt) {
    const remove = [];
    this.g.state.objetos.forEach((o, oid) => {
      if (o.k !== "bloque") return;
      if (o.st === "sostenido") {
        const p = this.player(o.dueno);
        if (!p || !p.vivo) return void remove.push(oid);
        o.x = Math.round(p.x + Math.cos(p.aim) * 46);
        o.y = Math.round(p.y + Math.sin(p.aim) * 46 - 20);
      } else if (o.st === "hundiendo") {
        o.t -= dt;
        if (o.t <= 0) {
          remove.push(oid);
          this.g.fx("acido", o.x, o.y, { r: 40 });
          this.g.aviso("Un bloque se hundi\xF3 en el \xE1cido.", "peligro");
        }
      }
    });
    for (const id of remove) this.g.state.objetos.delete(id);
  }
  slotFree(i) {
    const s = this.get("slot", "p5").find((o) => Number(o.props.i) === i);
    if (!s) return false;
    let free = true;
    this.g.state.objetos.forEach((o) => {
      if ((o.k === "bloque" || o.k === "puente") && o.st !== "sostenido" && dist(o.x, o.y, s.x, s.y) < 10) free = false;
    });
    return free;
  }
  bridgesDone() {
    let n = 0;
    this.g.state.objetos.forEach((o) => {
      if (o.k === "puente" && o.dueno === "p5") n++;
    });
    return n;
  }
  pressBridgeButton(id, p) {
    const pz = this.pz("p5");
    if (pz.estado !== "activo") return;
    if (this.bridgesDone() < PUENTE.slots) return;
    this.g.aviso(`${p.nombre} puls\xF3 el bot\xF3n.`, "exito");
    this.resolve("p5");
  }
  resetPuente() {
    const remove = [];
    this.g.state.objetos.forEach((o, oid) => {
      if ((o.k === "bloque" || o.k === "puente") && (o.dueno === "p5" || o.st === "hundiendo" || o.st === "sostenido")) {
        remove.push(oid);
        this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), false);
      }
    });
    for (const id of remove) this.g.state.objetos.delete(id);
    const disp = this.get("dispenser", "p5")[0];
    this.g.state.jugadores.forEach((p) => {
      if (p.vivo && this.g.world.blocksMoveAt(p.x, p.y) && disp) {
        p.x = disp.x;
        p.y = disp.y + 60;
      }
    });
  }
  // ------------------------------------------------------------------ P6: Válvulas a la vez
  lever(id, p, parte) {
    const pz = this.pz("p6");
    if (pz.estado === "resuelto") return;
    if (pz.estado === "bloqueado") return this.g.aviso(`V\xE1lvulas bloqueadas: ${Math.ceil(pz.tiempo)} s.`, "info", id);
    if (pz.estado === "activo") return;
    const role = parte === "A" ? "cambiaformas" : "delmar";
    if (!this.g.qualifies(p, role)) return this.g.aviso(`Esta palanca es del ${ALIENS[role].nombre} (o de quien lleve su alma).`, "info", id);
    this.palancas[parte] = id;
    const otra = parte === "A" ? "B" : "A";
    const otraRole = otra === "A" ? "cambiaformas" : "delmar";
    let otroPosible = false;
    this.g.state.jugadores.forEach((o, oid) => {
      if (oid !== id && this.g.qualifies(o, otraRole)) otroPosible = true;
    });
    const solo = !otroPosible && this.g.qualifies(p, otraRole);
    if (!solo && !this.palancas[otra]) {
      this.g.aviso(`${p.nombre} est\xE1 en la palanca ${parte}. Falta alguien en la palanca ${otra}.`, "info");
      return;
    }
    if (!solo && !otroPosible) return this.g.aviso("Falta alguien que pueda usar la otra palanca.", "info", id);
    const opA = solo ? id : this.palancas.A;
    const opB = solo ? id : this.palancas.B;
    pz.estado = "activo";
    pz.solo = solo;
    pz.total = pz.tiempo = PUZZLES.p6.duracion;
    pz.actores = solo ? id : `${opA},${opB}`;
    this.esclusa = { fase: "espera", inicio: 0, esperaT: 3, notas: [], hitsA: [], hitsB: [], evaluada: [], fallos: 0, opA, opB, ultimoError: -9 };
    this.g.aviso(
      solo ? `${p.nombre} maneja las dos palancas: F = v\xE1lvula A, J = v\xE1lvula B. Sigue las \xF3rdenes; si las cumples r\xE1pido, termina antes.` : "\xA1V\xE1lvulas en marcha! Pulsen ESPACIO solo cuando la orden les toque. Si las cumplen r\xE1pido, termina antes.",
      "info"
    );
    this.g.director.onPuzzleStart("p6");
    this.syncEsclusa();
  }
  /** Órdenes para todo el tiempo máximo, una tras otra, sin solaparse. */
  generarNotas() {
    const notas = [];
    for (let t = 1.5; t + ESCLUSA.dura < PUZZLES.p6.duracion; t += ESCLUSA.cada) {
      const r = Math.random();
      notas.push({ t: Math.round(t * 100) / 100, d: ESCLUSA.dura, l: r < 0.36 ? "AB" : r < 0.68 ? "A" : "B" });
    }
    return notas;
  }
  updateEsclusa(dt) {
    const e = this.esclusa;
    const pz = this.pz("p6");
    if (!e) return;
    const opA = this.player(e.opA);
    const opB = this.player(e.opB);
    if (!opA?.vivo || !opB?.vivo) return this.fail("p6", "Falta quien maneje una palanca.");
    if (e.fase === "espera") {
      e.esperaT -= dt;
      if (e.esperaT > 0) return;
      e.fase = "ritmo";
      e.inicio = this.g.time + 0.5;
      this.inicio.set("p6", e.inicio);
      e.notas = this.generarNotas();
      e.hitsA = e.notas.map(() => -1);
      e.hitsB = e.notas.map(() => -1);
      e.evaluada = e.notas.map(() => false);
      opA.ocupado = "p6";
      opB.ocupado = "p6";
      this.syncEsclusa();
      return;
    }
    pz.tiempo -= dt;
    const ahora = this.g.time - e.inicio;
    let cambio = false;
    e.notas.forEach((n, i) => {
      if (e.evaluada[i] || ahora < n.t + n.d + 0.5) return;
      e.evaluada[i] = true;
      const pulsos = n.l === "A" ? [e.hitsA[i]] : n.l === "B" ? [e.hitsB[i]] : [e.hitsA[i], e.hitsB[i]];
      if (pulsos.some((h) => h < 0)) {
        e.fallos++;
        cambio = true;
      } else if (Math.max(...pulsos) <= n.t + n.d * ESCLUSA.rapida) {
        this.bonus("p6");
      }
    });
    if (e.fallos >= ESCLUSA.maxMisses) return this.fail("p6", "Demasiadas \xF3rdenes falladas.");
    if (pz.tiempo <= 0) {
      opA.ocupado = "";
      opB.ocupado = "";
      return this.resolve("p6");
    }
    if (cambio) this.syncEsclusa();
  }
  esclusaNota(id, msg) {
    const e = this.esclusa;
    if (!e || e.fase !== "ritmo" || typeof msg.nota !== "number") return;
    if (!msg.ok) {
      if (this.g.time - e.ultimoError < 0.8 || id !== e.opA && id !== e.opB) return;
      e.ultimoError = this.g.time;
      e.fallos++;
      this.syncEsclusa();
      if (e.fallos >= ESCLUSA.maxMisses) this.fail("p6", "Demasiadas \xF3rdenes falladas.");
      return;
    }
    const i = msg.nota | 0;
    if (i < 0 || i >= e.notas.length || e.evaluada[i]) return;
    const cuando = this.g.time - e.inicio;
    const pz = this.pz("p6");
    if (pz.solo) {
      if (id !== e.opA) return;
      if (msg.lane === "A" && e.hitsA[i] < 0) e.hitsA[i] = cuando;
      else if (msg.lane === "B" && e.hitsB[i] < 0) e.hitsB[i] = cuando;
      return;
    }
    if (id === e.opA && e.hitsA[i] < 0) e.hitsA[i] = cuando;
    if (id === e.opB && e.hitsB[i] < 0) e.hitsB[i] = cuando;
  }
  syncEsclusa() {
    const e = this.esclusa;
    if (!e) return;
    this.pz("p6").datos = JSON.stringify({
      fase: e.fase,
      inicio: e.inicio,
      notas: e.notas,
      fallos: e.fallos,
      max: ESCLUSA.maxMisses,
      opA: e.opA,
      opB: e.opB
    });
  }
  resetEsclusa() {
    const e = this.esclusa;
    if (e) {
      for (const id of [e.opA, e.opB]) {
        const p = this.player(id);
        if (p && p.ocupado === "p6") p.ocupado = "";
      }
    }
    this.esclusa = null;
    this.palancas = { A: "", B: "" };
  }
  // ------------------------------------------------------------------ habilidades sobre objetos de puzzle
  /** Devuelve null si no había nada de puzzle ahí, o el enfriamiento a aplicar. */
  telequinesis(id, p, x, y) {
    const sw = this.switchAt(x, y);
    if (sw) {
      const pz = this.pz("p4");
      if (pz.estado !== "activo") {
        this.g.aviso("Los interruptores no responden: primero hay que leer el c\xF3digo en la consola.", "info", id);
        return 0;
      }
      const sim = Number(sw.props.simbolo);
      this.g.fx("telequinesis", p.x, p.y, { x2: sw.x, y2: sw.y });
      if (sim === this.rayos.sec[this.rayos.idx]) {
        this.rayos.idx++;
        this.g.fx("chispa", sw.x, sw.y);
        if (this.rayos.idx >= this.rayos.sec.length) {
          if (this.rayos.ronda >= 3) {
            this.syncRayos();
            this.resolve("p4");
            return 0.8;
          }
          this.rayos.ronda++;
          this.rayos.sec = this.secuencia(3 + this.rayos.ronda);
          this.rayos.idx = 0;
          this.g.aviso(`\xA1C\xF3digo correcto! Ronda ${this.rayos.ronda} de 3: nuevo c\xF3digo en la consola.`, "exito");
        }
        this.syncRayos();
      } else {
        this.fail("p4", `Interruptor equivocado (${RAYOS_SIMBOLOS[sim].nombre}).`);
      }
      return 0.8;
    }
    const disp = this.get("dispenser", "p5")[0];
    if (disp && dist(x, y, disp.x, disp.y) < 70) {
      const pz = this.pz("p5");
      if (pz.estado === "resuelto" || pz.estado === "bloqueado") return 0;
      if (!this.g.qualifies(p, "inteligente")) return null;
      if (pz.estado === "libre") {
        const r = this.repartir("p5", id);
        if (!r) {
          this.g.aviso("Hace falta alguien que transmute (el Del mar o su alma).", "info", id);
          return 0;
        }
        pz.estado = "activo";
        pz.solo = r[2];
        pz.total = pz.tiempo = PUZZLES.p5.duracion * (r[2] ? SOLO_TIME_FACTOR : 1);
        pz.actores = r[2] ? id : `${r[0]},${r[1]}`;
        this.g.aviso(r[2] ? `${p.nombre} hace los dos papeles: coloca bloques y transm\xFAtalos antes de que se hundan.` : "\xA1Puente! Coloquen bloques con telequinesis y transm\xFAtenlos en puente antes de que se hundan.", "info");
        this.g.director.onPuzzleStart("p5");
      }
      let ya = false;
      this.g.state.objetos.forEach((o) => {
        if (o.k === "bloque" && o.st === "sostenido" && o.dueno === id) ya = true;
      });
      if (ya) {
        this.g.aviso("Ya sostienes un bloque: apunta a una casilla del \xE1cido.", "info", id);
        return 0;
      }
      const b = new Prop();
      b.k = "bloque";
      b.st = "sostenido";
      b.dueno = id;
      b.x = Math.round(p.x);
      b.y = Math.round(p.y - 40);
      this.g.state.objetos.set(this.g.id("o"), b);
      this.g.fx("telequinesis", disp.x, disp.y, { x2: p.x, y2: p.y });
      return 0.8;
    }
    const slot = this.get("slot", "p5").find((o) => dist(x, y, o.x, o.y) < 48);
    if (slot) {
      let held = null;
      this.g.state.objetos.forEach((o) => {
        if (o.k === "bloque" && o.st === "sostenido" && o.dueno === id) held = o;
      });
      if (!held) {
        this.g.aviso("Primero toma un bloque del dispensador (telequinesis sobre \xE9l).", "info", id);
        return 0;
      }
      const i = Number(slot.props.i);
      if (!this.slotFree(i)) {
        this.g.aviso("Esa casilla ya tiene un bloque.", "info", id);
        return 0;
      }
      if (dist(p.x, p.y, slot.x, slot.y) > TELEQUINESIS.range + 60) return 0;
      const h = held;
      this.g.fx("telequinesis", h.x, h.y, { x2: slot.x, y2: slot.y });
      h.st = "hundiendo";
      h.t = PUENTE.sinkTime;
      h.x = Math.round(slot.x);
      h.y = Math.round(slot.y);
      h.dueno = "p5";
      return 0.8;
    }
    return null;
  }
  transmutar(id, p, x, y) {
    let target = null;
    this.g.state.objetos.forEach((o2, oid) => {
      if (target) return;
      if (o2.k === "bloque" && o2.st === "hundiendo" && dist(x, y, o2.x, o2.y) < 50) target = [oid, o2];
    });
    if (!target) return null;
    const [, o] = target;
    o.k = "puente";
    o.st = "";
    o.dueno = "p5";
    this.g.world.setBridge(Math.floor(o.x / TILE), Math.floor(o.y / TILE), true);
    this.g.fx("transmutar", o.x, o.y, { c: 16747066, x2: p.x, y2: p.y });
    const n = this.bridgesDone();
    if (n >= PUENTE.slots) this.g.aviso("\xA1Puente completo! Crucen y pulsen el bot\xF3n (E).", "exito");
    else this.g.aviso(`Puente: ${n}/${PUENTE.slots}`, "info");
    void id;
    return 0.8;
  }
};

// src/game/Partida.ts
var PROJ_RADIUS = { red_proy: 14, tq: 18 };
var Partida = class {
  constructor(state, emit) {
    this.state = state;
    this.emit = emit;
    this.pdata = /* @__PURE__ */ new Map();
    this.brains = /* @__PURE__ */ new Map();
    this.projData = /* @__PURE__ */ new Map();
    this.flags = /* @__PURE__ */ new Set();
    this.flows = /* @__PURE__ */ new Map();
    this.nextId = 1;
    this.flowTimer = 0;
    this.spawnIndex = 0;
    this.votos = /* @__PURE__ */ new Set();
    /** Equipo inicial para poder reiniciar. */
    this.roster = [];
    this.world = new World(area1_default);
    this.director = new Director(this);
    this.puzzles = new Puzzles(this);
    this.initWorld();
  }
  get time() {
    return this.state.tiempo;
  }
  id(prefix) {
    return prefix + this.nextId++;
  }
  // ------------------------------------------------------------------ montaje
  initWorld() {
    const s = this.state;
    for (const o of this.world.find("door")) {
      const d = new Door();
      d.abierta = false;
      s.puertas.set(o.name, d);
      this.world.setDoor(o.name, false);
    }
    for (const o of this.world.find("prop")) {
      const p = new Prop();
      p.k = String(o.props.kind);
      p.x = Math.round(o.x);
      p.y = Math.round(o.y);
      p.hp = p.k === "barril" ? 30 : p.k === "caja" ? 45 : 1;
      s.objetos.set("m" + o.id, p);
    }
    this.puzzles.init();
  }
  addPlayer(id, nombre, kind) {
    const p = new Player();
    p.nombre = nombre;
    p.kind = kind;
    const def = ALIENS[kind];
    p.hp = p.maxHp = def.hp;
    p.habilidad = def.ability;
    p.energia = DISFRAZ.maxEnergy;
    const spawns = this.world.find("player_spawn");
    const sp = spawns[this.spawnIndex++ % spawns.length];
    p.x = sp.x;
    p.y = sp.y;
    this.state.jugadores.set(id, p);
    this.pdata.set(id, {
      inputs: [],
      shootCd: 0,
      shoot: false,
      interact: false,
      interactPrev: false,
      lastHitAt: -99,
      rescuedAt: -99,
      noticeAt: /* @__PURE__ */ new Map()
    });
    if (!this.roster.find((r) => r.id === id)) this.roster.push({ id, nombre, kind });
  }
  start() {
    this.state.fase = "jugando";
    this.aviso("\xA1Despertaron en las incubadoras! Escapen del \xC1rea 51.", "info");
    this.director.start();
    this.updateObjective();
  }
  /** Vuelve a empezar el Área 1 con el mismo equipo. */
  reset() {
    const s = this.state;
    s.unidades.clear();
    s.proyectiles.clear();
    s.zonas.clear();
    s.objetos.clear();
    s.puertas.clear();
    s.puzzles.clear();
    s.almas.clear();
    s.jefe = "";
    s.tiempo = 0;
    this.brains.clear();
    this.projData.clear();
    this.flags.clear();
    this.votos.clear();
    for (const id of this.world.doorCells.keys()) this.world.setDoor(id, true);
    this.world.bridged.fill(0);
    this.initWorld();
    const conectados = /* @__PURE__ */ new Map();
    s.jugadores.forEach((p, id) => conectados.set(id, p.conectado));
    s.jugadores.clear();
    this.pdata.clear();
    this.spawnIndex = 0;
    for (const r of this.roster) {
      this.addPlayer(r.id, r.nombre, r.kind);
      const p = s.jugadores.get(r.id);
      p.conectado = conectados.get(r.id) ?? false;
      if (!p.conectado) this.killPlayer(r.id, p, true);
    }
    this.director.reset();
    this.start();
  }
  votarReinicio(id) {
    if (this.state.fase !== "victoria" && this.state.fase !== "derrota") return;
    this.votos.add(id);
    let faltan = 0;
    this.state.jugadores.forEach((p, pid) => {
      if (p.conectado && !this.votos.has(pid)) faltan++;
    });
    if (faltan === 0) this.reset();
    else this.aviso(`${this.state.jugadores.get(id)?.nombre ?? "Alguien"} quiere reintentar (faltan ${faltan}).`, "info");
  }
  // ------------------------------------------------------------------ mensajes
  input(id, msg) {
    const d = this.pdata.get(id);
    if (!d || typeof msg?.seq !== "number") return;
    d.inputs.push({
      seq: msg.seq >>> 0,
      mx: Number(msg.mx) || 0,
      my: Number(msg.my) || 0,
      aim: Number(msg.aim) || 0,
      shoot: Boolean(msg.shoot)
    });
    if (d.inputs.length > 12) d.inputs.splice(0, d.inputs.length - 12);
  }
  setInteract(id, down) {
    const d = this.pdata.get(id);
    if (d) d.interact = Boolean(down);
  }
  cambiarHabilidad(id) {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo) return;
    const list = this.abilitiesOf(p);
    const i = list.indexOf(p.habilidad);
    p.habilidad = list[(i + 1) % list.length];
    if (p.habilidad !== "disfraz" && p.disfrazado && !this.qualifies(p, "cambiaformas")) p.disfrazado = false;
  }
  abilitiesOf(p) {
    const set = /* @__PURE__ */ new Set([ABILITY_OF[p.kind]]);
    p.almas.forEach((k) => isAlienKind(k) && set.add(ABILITY_OF[k]));
    return [...set];
  }
  /** ¿Puede hacer el papel de este alien (por ser él o por llevar su alma)? */
  qualifies(p, kind) {
    return p.vivo && (p.kind === kind || p.almas.includes(kind));
  }
  usarHabilidad(id, x, y) {
    const p = this.state.jugadores.get(id);
    if (!p || !this.canAct(p)) return;
    x = Number(x);
    y = Number(y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    switch (p.habilidad) {
      case "disfraz":
        if (p.disfrazado) {
          p.disfrazado = false;
        } else if (p.energia >= DISFRAZ.minToActivate) {
          p.disfrazado = true;
          this.fx("transmutar", p.x, p.y, { c: 8368714 });
        } else {
          this.aviso("El disfraz se est\xE1 recargando\u2026", "info", id);
        }
        return;
      case "transmutar": {
        if (p.enfriamiento > 0) return;
        if (dist(p.x, p.y, x, y) > TRANSMUTAR.range + 40) return this.aviso("Demasiado lejos para transmutar.", "info", id);
        const cd = this.puzzles.transmutar(id, p, x, y);
        if (cd !== null) p.enfriamiento = cd;
        else if (this.transmutar(id, p, x, y)) p.enfriamiento = TRANSMUTAR.cooldown;
        return;
      }
      case "telequinesis": {
        if (p.enfriamiento > 0) return;
        if (dist(p.x, p.y, x, y) > TELEQUINESIS.range + 40) return this.aviso("Demasiado lejos para la telequinesis.", "info", id);
        const cd = this.puzzles.telequinesis(id, p, x, y);
        if (cd !== null) p.enfriamiento = cd;
        else if (this.telequinesis(id, p, x, y)) p.enfriamiento = TELEQUINESIS.cooldown;
        return;
      }
    }
  }
  darAlma(id) {
    const p = this.state.jugadores.get(id);
    if (!p || !p.vivo || p.almas.length === 0) return;
    let best = null;
    let bd = 140;
    this.state.jugadores.forEach((o, oid) => {
      if (oid === id || !o.vivo) return;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    if (!best) return this.aviso("Ac\xE9rcate a un compa\xF1ero para pasarle el alma (G).", "info", id);
    const target = best;
    const kind = p.almas.pop();
    target.almas.push(kind);
    if (!this.abilitiesOf(p).includes(p.habilidad)) p.habilidad = ABILITY_OF[p.kind];
    this.aviso(`${p.nombre} le pas\xF3 el alma de ${ALIENS[kind].nombre} a ${target.nombre}. Ahora ${target.nombre} hace los dos papeles.`, "alma");
    this.fx("alma", target.x, target.y);
  }
  // ------------------------------------------------------------------ bucle
  tick(dt) {
    if (this.state.fase !== "jugando") return;
    this.state.tiempo += dt;
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.45;
      this.rebuildFlows();
    }
    this.updatePlayers(dt);
    updateUnits(this, dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateProps(dt);
    this.puzzles.update(dt);
    this.director.update(dt);
    this.updateDoors();
    this.updateObjective();
    this.checkEnd();
  }
  rebuildFlows() {
    this.state.jugadores.forEach((p, id) => {
      if (!p.vivo) {
        this.flows.delete(id);
        return;
      }
      let f = this.flows.get(id);
      if (!f) this.flows.set(id, f = new FlowField(this.world));
      f.build(p.x, p.y);
    });
  }
  canAct(p) {
    return p.vivo && !p.fantasma && p.estado === "ok" && p.ocupado === "";
  }
  /** Círculos que bloquean el paso (barriles, cajas, coberturas). */
  solidProps() {
    const out = [];
    this.state.objetos.forEach((o) => {
      const r = PROP_RADIUS[o.k];
      if (r) out.push({ x: o.x, y: o.y, r });
    });
    return out;
  }
  updatePlayers(dt) {
    const extra = this.solidProps();
    this.state.jugadores.forEach((p, id) => {
      const d = this.pdata.get(id);
      if (p.confuso > 0) p.confuso = Math.max(0, p.confuso - dt);
      if (p.enfriamiento > 0) p.enfriamiento = Math.max(0, p.enfriamiento - dt);
      if (p.vivo && p.estado !== "ok") {
        p.estadoT -= dt;
        if (p.estadoT <= 0) this.freePlayer(p, null);
      }
      if (p.rescate > 0 && this.time - d.rescuedAt > 0.25) p.rescate = Math.max(0, p.rescate - dt * 0.8);
      if (p.disfrazado) {
        if (!p.ocupado) p.energia -= DISFRAZ.drainPerSec * dt;
        if (p.energia <= 0) this.revelar(id, p, "Se acab\xF3 tu disfraz.");
      } else {
        p.energia = Math.min(DISFRAZ.maxEnergy, p.energia + DISFRAZ.rechargePerSec * dt);
      }
      let n = 0;
      while (d.inputs.length && n < 4) {
        const inp = d.inputs.shift();
        const pos = stepPlayer(
          this.world,
          { x: p.x, y: p.y, kind: p.kind, status: p.estado, confused: p.confuso, ghost: p.fantasma, locked: p.ocupado !== "" },
          inp.mx,
          inp.my,
          TICK_DT,
          extra
        );
        p.x = pos.x;
        p.y = pos.y;
        if (p.estado === "ok") p.aim = inp.aim;
        d.shoot = inp.shoot;
        p.seq = inp.seq;
        n++;
      }
      if (!p.vivo) return;
      d.shootCd -= dt;
      if (d.shoot && this.canAct(p) && d.shootCd <= 0) this.disparar(id, p, d);
      this.updateInteract(id, p, d, dt);
      if (p.hp < p.maxHp) {
        this.state.objetos.forEach((o, oid) => {
          if (o.k === "botiquin" && dist(p.x, p.y, o.x, o.y) < 44) {
            p.hp = Math.min(p.maxHp, p.hp + BOTIQUIN_CURA);
            this.state.objetos.delete(oid);
            this.fx("rescate", o.x, o.y, { c: 8257386 });
          }
        });
      }
    });
  }
  disparar(id, p, d) {
    const w = ALIENS[p.kind].weapon;
    d.shootCd = 1 / w.fireRate;
    let ox = p.x + Math.cos(p.aim) * 24;
    let oy = p.y + Math.sin(p.aim) * 24;
    if (!this.world.lineOfSight(p.x, p.y, ox, oy)) {
      ox = p.x;
      oy = p.y;
    }
    this.spawnProjectile(w.projectile, "aliens", ox, oy, p.aim, w.bulletSpeed, { damage: w.damage, pierce: w.pierce, owner: id, range: w.range });
    if (p.disfrazado) {
      p.energia -= DISFRAZ.shotCost;
      if (p.energia <= 0) this.revelar(id, p, "Disparar gast\xF3 tu disfraz.");
    }
  }
  updateInteract(id, p, d, dt) {
    const pressed = d.interact && !d.interactPrev;
    d.interactPrev = d.interact;
    if (!p.vivo || p.estado !== "ok") return;
    if (d.interact && !p.ocupado) {
      let mate = null;
      let mateId = "";
      this.state.jugadores.forEach((o, oid) => {
        if (oid === id || !o.vivo || o.estado !== "congelado" && o.estado !== "red") return;
        if (dist(p.x, p.y, o.x, o.y) <= INTERACT_RANGE) {
          mate = o;
          mateId = oid;
        }
      });
      if (mate) {
        const m = mate;
        m.rescate += dt / (m.estado === "red" ? 1 : 1.4);
        this.pdata.get(mateId).rescuedAt = this.time;
        if (m.rescate >= 1) this.freePlayer(m, p);
        return;
      }
    }
    if (!pressed) return;
    let soulId = "";
    let sd = INTERACT_RANGE;
    this.state.almas.forEach((s, sid) => {
      const dd = dist(p.x, p.y, s.x, s.y);
      if (dd < sd) {
        sd = dd;
        soulId = sid;
      }
    });
    if (soulId && !p.ocupado) {
      const s = this.state.almas.get(soulId);
      p.almas.push(s.kind);
      this.state.almas.delete(soulId);
      this.fx("alma", p.x, p.y);
      this.aviso(`${p.nombre} recogi\xF3 el alma de ${s.de}: ahora tiene sus habilidades (Q para cambiar) y har\xE1 los dos papeles.`, "alma");
      return;
    }
    this.puzzles.interact(id, p);
  }
  freePlayer(p, by) {
    const era = p.estado;
    p.estado = "ok";
    p.estadoT = 0;
    p.rescate = 0;
    if (by) {
      this.aviso(`${by.nombre} ${era === "red" ? "cort\xF3 la red de" : "descongel\xF3 a"} ${p.nombre}.`, "rescate");
      this.fx("rescate", p.x, p.y);
    }
  }
  setEstado(id, p, estado, t) {
    if (!p.vivo || p.fantasma) return;
    if (estado === "aturdido") {
      if (p.estado === "ok") {
        p.estado = "aturdido";
        p.estadoT = t ?? 0.6;
      }
      return;
    }
    if (p.estado === "congelado" || p.estado === "red") return;
    p.estado = estado;
    p.estadoT = estado === "congelado" ? FREEZE_AUTO_THAW : NET_AUTO_FREE;
    p.rescate = 0;
    if (p.disfrazado && estado === "red") this.revelar(id, p, "");
    this.aviso(estado === "congelado" ? `\xA1${p.nombre} est\xE1 congelado! Ve a descongelarlo (mant\xE9n E).` : `\xA1${p.nombre} est\xE1 atrapado en una red! Ve a cortarla (mant\xE9n E).`, "rescate");
    this.puzzles.onPlayerStatus(id);
  }
  revelar(id, p, motivo) {
    if (!p.disfrazado) return;
    p.disfrazado = false;
    p.energia = Math.max(0, p.energia);
    this.fx("revelado", p.x, p.y);
    if (motivo) this.aviso(motivo, "peligro", id);
    this.puzzles.onPlayerStatus(id);
  }
  damagePlayer(id, p, amount) {
    if (!p.vivo || p.fantasma || amount <= 0) return;
    const d = this.pdata.get(id);
    if (d) d.lastHitAt = this.time;
    if (p.disfrazado) {
      p.energia -= amount * DISFRAZ.damageDrain;
      if (p.energia <= 0) this.revelar(id, p, "\xA1Te descubrieron!");
    }
    p.hp -= amount;
    this.puzzles.onPlayerHit(id, amount);
    if (p.hp <= 0) this.killPlayer(id, p);
  }
  lastHitAt(id) {
    return this.pdata.get(id)?.lastHitAt ?? -99;
  }
  killPlayer(id, p, silencioso = false) {
    if (!p.vivo) return;
    p.vivo = false;
    p.fantasma = true;
    p.hp = 0;
    p.estado = "ok";
    p.disfrazado = false;
    p.ocupado = "";
    p.rescate = 0;
    const kinds = [p.kind, ...p.almas];
    p.almas.clear();
    kinds.forEach((k, i) => {
      const s = new Soul();
      s.kind = k;
      s.de = k === p.kind ? p.nombre : ALIENS[k].nombre;
      s.x = Math.round(p.x + (i ? Math.cos(i * 2.1) * 34 : 0));
      s.y = Math.round(p.y + (i ? Math.sin(i * 2.1) * 34 : 0));
      this.state.almas.set(this.id("a"), s);
    });
    this.fx("muerte", p.x, p.y);
    if (!silencioso) this.aviso(`\u2620 ${p.nombre} cay\xF3. Recojan su alma (E) para usar sus habilidades. Volver\xE1 en el \xC1rea 2.`, "peligro");
    this.puzzles.onPlayerDown(id);
    this.flows.delete(id);
  }
  playerLeft(id) {
    const p = this.state.jugadores.get(id);
    if (!p) return;
    p.conectado = false;
    if (p.vivo) {
      this.aviso(`${p.nombre} se desconect\xF3.`, "peligro");
      this.killPlayer(id, p, true);
    }
  }
  // ------------------------------------------------------------------ habilidades
  transmutar(id, p, x, y) {
    if (this.countConversions(id) >= TRANSMUTAR.maxActive) {
      this.aviso(`M\xE1ximo ${TRANSMUTAR.maxActive} transmutaciones activas.`, "info", id);
      return false;
    }
    const u = this.unitNear(x, y, 70, (u2) => u2.team === "humanos" && (isConvertible(u2.t) || u2.t === "torreta"));
    if (u) {
      const [uid, unit] = u;
      if (unit.t === "torreta") {
        this.removeUnit(uid);
        this.addCover(unit.x, unit.y, id);
      } else {
        this.removeUnit(uid);
        const pul = this.spawnUnit("pulpo", unit.x, unit.y, "aliens");
        const b = this.brains.get(pul);
        b.life = TRANSMUTAR.pulpoLife;
        b.owner = id;
      }
      this.fx("transmutar", unit.x, unit.y, { c: 16747066, x2: p.x, y2: p.y });
      return true;
    }
    const prop = this.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      this.state.objetos.delete(oid);
      this.addCover(o.x, o.y, id);
      this.fx("transmutar", o.x, o.y, { c: 16747066, x2: p.x, y2: p.y });
      return true;
    }
    this.aviso("Nada que transmutar ah\xED (apunta a un soldado, barril, caja o torreta).", "info", id);
    return false;
  }
  countConversions(id) {
    let n = 0;
    this.state.objetos.forEach((o) => {
      if (o.k === "cobertura" && o.dueno === id) n++;
    });
    this.brains.forEach((b, uid) => {
      if (b.owner === id && this.state.unidades.get(uid)?.t === "pulpo") n++;
    });
    return n;
  }
  addCover(x, y, owner) {
    const c = new Prop();
    c.k = "cobertura";
    c.x = x;
    c.y = y;
    c.hp = TRANSMUTAR.coverHp;
    c.t = TRANSMUTAR.coverLife;
    c.dueno = owner;
    this.state.objetos.set(this.id("o"), c);
  }
  telequinesis(id, p, x, y) {
    const throwAng = p.aim;
    const u = this.unitNear(x, y, 70, (u2) => u2.team === "humanos" && u2.t !== "jefe" && u2.t !== "sensor");
    if (u) {
      const [uid, unit] = u;
      if (unit.t === "escudo" && unit.escudo) {
        unit.escudo = false;
        this.aviso("\xA1Le quitaste el escudo!", "exito", id);
      }
      const pos = this.world.moveCircle(unit.x, unit.y, Math.cos(throwAng) * 170, Math.sin(throwAng) * 170, ENEMIES[unit.t].radius);
      this.fx("telequinesis", unit.x, unit.y, { x2: pos.x, y2: pos.y });
      unit.x = Math.round(pos.x);
      unit.y = Math.round(pos.y);
      const b = this.brains.get(uid);
      if (b) b.stun = TELEQUINESIS.stun;
      this.hitUnit(uid, unit, TELEQUINESIS.throwDamage, null, id);
      return true;
    }
    const prop = this.propNear(x, y, 60, (o) => o.k === "barril" || o.k === "caja");
    if (prop) {
      const [oid, o] = prop;
      this.state.objetos.delete(oid);
      this.fx("telequinesis", o.x, o.y);
      this.spawnProjectile("tq_" + o.k, "aliens", o.x, o.y, throwAng, TELEQUINESIS.throwSpeed, {
        damage: TELEQUINESIS.throwDamage,
        pierce: 0,
        owner: id,
        range: 700,
        carga: o.k
      });
      return true;
    }
    this.aviso("Nada que mover ah\xED (apunta a un enemigo, barril o caja).", "info", id);
    return false;
  }
  // ------------------------------------------------------------------ unidades
  spawnUnit(t, x, y, team = "humanos", tag = "") {
    const u = new Unit();
    u.t = t;
    u.team = team;
    u.x = Math.round(x);
    u.y = Math.round(y);
    const hp = t === "pulpo" ? TRANSMUTAR.pulpoHp : ENEMIES[t].hp;
    u.hp = u.maxHp = hp;
    if (t === "jefe") u.tanques = ENEMY_TUNING.jefe.tanks;
    if (t === "escudo") u.escudo = true;
    const id = this.id("u");
    this.state.unidades.set(id, u);
    this.brains.set(id, {
      x,
      y,
      cd: 1 + Math.random() * 1.5,
      burst: 0,
      burstT: 0,
      target: "",
      stun: 0,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: 1 + Math.random() * 2,
      aimT: 0,
      lockAng: 0,
      flameT: 0,
      patchT: 0,
      life: 0,
      owner: "",
      tag,
      shieldT: 0,
      t2: 0,
      kinds: 0,
      devices: []
    });
    if (t === "jefe") this.state.jefe = id;
    return id;
  }
  removeUnit(id) {
    this.state.unidades.delete(id);
    this.brains.delete(id);
  }
  hitUnit(uid, u, dmg, from, owner) {
    if (from && u.t === "escudo" && u.escudo) {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) < ENEMY_TUNING.escudo.shieldArc * Math.PI / 180) {
        this.fx("chispa", u.x + Math.cos(u.ang) * 22, u.y + Math.sin(u.ang) * 22);
        return "bloqueado";
      }
    }
    if (from && u.t === "lanzallamas") {
      const incoming = Math.atan2(-from.vy, -from.vx);
      if (Math.abs(angleDiff(u.ang, incoming)) > 120 * Math.PI / 180) dmg *= ENEMY_TUNING.lanzallamas.backMultiplier;
    }
    if (u.t === "jefe" && u.tanques > 0) dmg *= ENEMY_TUNING.jefe.armoredMultiplier;
    const b = this.brains.get(uid);
    if (b && b.shieldT > 0) dmg *= 0.5;
    u.hp -= Math.round(dmg);
    if (b && u.team === "humanos" && owner) b.target = b.target || owner;
    if (u.hp <= 0) this.killUnit(uid, u, owner);
    return "ok";
  }
  killUnit(uid, u, owner) {
    this.removeUnit(uid);
    this.fx("muerte", u.x, u.y, { c: u.team === "aliens" ? 16739133 : 16726843 });
    const p = owner ? this.state.jugadores.get(owner) : void 0;
    if (p && u.team === "humanos") p.bajas++;
    if (u.t === "lanzallamas") {
      const t = ENEMY_TUNING.lanzallamas;
      this.explode(u.x, u.y, t.explosionRadius, t.explosionDamage, owner);
    }
    if (u.t === "jefe") {
      this.state.jefe = "";
      this.flags.add("jefe");
      this.aviso("\xA1El Jefe de laboratorio cay\xF3!", "exito");
      this.fx("explosion", u.x, u.y, { r: 160 });
    }
  }
  explode(x, y, r, dmg, owner) {
    this.fx("explosion", x, y, { r });
    this.state.unidades.forEach((u, uid) => {
      if (u.team !== "humanos") return;
      const d = dist(x, y, u.x, u.y);
      if (d < r) this.hitUnit(uid, u, dmg * (1 - d / r * 0.5), null, owner);
    });
    const chain = [];
    this.state.objetos.forEach((o, oid) => {
      if (o.k === "barril" && dist(x, y, o.x, o.y) < r * 0.8) chain.push(oid);
    });
    for (const oid of chain) {
      const o = this.state.objetos.get(oid);
      if (!o) continue;
      this.state.objetos.delete(oid);
      this.explode(o.x, o.y, 100, 55, owner);
    }
  }
  unitNear(x, y, r, filter) {
    let best = null;
    let bd = r;
    this.state.unidades.forEach((u, uid) => {
      if (!filter(u)) return;
      const d = dist(x, y, u.x, u.y) - (u.t === "jefe" ? 30 : 0);
      if (d < bd) {
        bd = d;
        best = [uid, u];
      }
    });
    return best;
  }
  propNear(x, y, r, filter) {
    let best = null;
    let bd = r;
    this.state.objetos.forEach((o, oid) => {
      if (!filter(o)) return;
      const d = dist(x, y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = [oid, o];
      }
    });
    return best;
  }
  // ------------------------------------------------------------------ proyectiles
  spawnProjectile(k, team, x, y, ang, speed, o) {
    const pr = new Projectile();
    pr.k = k;
    pr.team = team;
    pr.x = Math.round(x);
    pr.y = Math.round(y);
    pr.vx = Math.cos(ang) * speed;
    pr.vy = Math.sin(ang) * speed;
    const id = this.id("b");
    this.state.proyectiles.set(id, pr);
    this.projData.set(id, { px: x, py: y, t: 0, life: o.range / speed, damage: o.damage, pierce: o.pierce ?? 0, owner: o.owner ?? "", hits: /* @__PURE__ */ new Set(), carga: o.carga });
    return id;
  }
  throwFlask(k, x, y, tx, ty, flight, owner) {
    const pr = new Projectile();
    pr.k = k;
    pr.team = "humanos";
    pr.x = Math.round(x);
    pr.y = Math.round(y);
    pr.tx = Math.round(tx);
    pr.ty = Math.round(ty);
    pr.vuelo = flight;
    const id = this.id("b");
    this.state.proyectiles.set(id, pr);
    this.projData.set(id, { px: x, py: y, t: 0, life: flight, damage: 0, pierce: 0, owner, hits: /* @__PURE__ */ new Set() });
  }
  flaskPos(pr, d) {
    const k = Math.min(1, d.t / pr.vuelo);
    return { x: pr.x + (pr.tx - pr.x) * k, y: pr.y + (pr.ty - pr.y) * k };
  }
  flaskBurst(pr, x, y) {
    if (pr.k === "frasco_azul") {
      const r = ENEMY_TUNING.criogenista.radius;
      this.fx("hielo", x, y, { r });
      this.state.jugadores.forEach((p, id) => {
        if (p.vivo && dist(x, y, p.x, p.y) < r + 16) this.setEstado(id, p, "congelado");
      });
      this.state.unidades.forEach((u, uid) => {
        if (u.team === "humanos" && u.t !== "jefe" && dist(x, y, u.x, u.y) < r + 16) {
          const b = this.brains.get(uid);
          if (b) b.stun = 4;
        }
      });
    } else if (pr.k === "frasco_verde") {
      const t = ENEMY_TUNING.quimico;
      this.addZone("acido", x, y, t.radius, t.life);
      this.fx("acido", x, y, { r: t.radius });
    } else {
      const t = ENEMY_TUNING.bioquimico;
      this.addZone("gas", x, y, t.radius, t.life);
      this.fx("gas", x, y, { r: t.radius });
    }
  }
  addZone(k, x, y, r, vida) {
    const z = new Zone();
    z.k = k;
    z.x = Math.round(x);
    z.y = Math.round(y);
    z.r = r;
    z.vida = vida;
    this.state.zonas.set(this.id("z"), z);
  }
  updateProjectiles(dt) {
    const remove = [];
    const flasks = [];
    this.state.proyectiles.forEach((pr, id) => {
      if (pr.vuelo > 0) flasks.push([id, pr, this.projData.get(id)]);
    });
    this.state.proyectiles.forEach((pr, id) => {
      const d = this.projData.get(id);
      if (!d) return void remove.push(id);
      d.t += dt;
      if (pr.vuelo > 0) {
        if (d.t >= pr.vuelo) {
          this.flaskBurst(pr, pr.tx, pr.ty);
          remove.push(id);
        }
        return;
      }
      let nx = d.px + pr.vx * dt;
      let ny = d.py + pr.vy * dt;
      const wall = this.world.raycast(d.px, d.py, nx, ny);
      if (wall) {
        nx = wall.x;
        ny = wall.y;
      }
      const rad = PROJ_RADIUS[pr.k] ?? (pr.k.startsWith("tq_") ? PROJ_RADIUS.tq : 5);
      let dead = false;
      if (pr.team === "aliens") {
        for (const [fid, f, fd] of flasks) {
          if (remove.includes(fid)) continue;
          const fp = this.flaskPos(f, fd);
          if (segDist(d.px, d.py, nx, ny, fp.x, fp.y) < 18 + rad) {
            this.flaskBurst(f, fp.x, fp.y);
            remove.push(fid);
            dead = true;
            break;
          }
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || u.team !== "humanos" || d.hits.has(uid)) return;
            const r = ENEMIES[u.t].radius;
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < r + rad) {
              d.hits.add(uid);
              const res = this.hitUnit(uid, u, d.damage, pr, d.owner);
              this.fx("impacto", u.x, u.y, { c: 16765502 });
              if (res === "bloqueado" || d.pierce-- <= 0) dead = true;
            }
          });
        }
      } else {
        this.state.objetos.forEach((o, oid) => {
          if (dead || o.k !== "cobertura") return;
          if (segDist(d.px, d.py, nx, ny, o.x, o.y) < 34) {
            o.hp -= d.damage;
            dead = true;
            this.fx("chispa", o.x, o.y);
            if (o.hp <= 0) this.state.objetos.delete(oid);
          }
        });
        if (!dead) {
          this.state.jugadores.forEach((p, pid) => {
            if (dead || !p.vivo || p.fantasma) return;
            if (segDist(d.px, d.py, nx, ny, p.x, p.y) < 18 + rad) {
              dead = true;
              if (pr.k === "red_proy") {
                this.damagePlayer(pid, p, ENEMY_TUNING.lanzarredes.damage);
                if (p.vivo) this.setEstado(pid, p, "red");
              } else {
                this.damagePlayer(pid, p, d.damage);
              }
              this.fx("impacto", p.x, p.y, { c: 16726843 });
            }
          });
        }
        if (!dead) {
          this.state.unidades.forEach((u, uid) => {
            if (dead || u.team !== "aliens") return;
            if (segDist(d.px, d.py, nx, ny, u.x, u.y) < 18 + rad) {
              dead = true;
              u.hp -= d.damage;
              if (u.hp <= 0) this.killUnit(uid, u, "");
            }
          });
        }
      }
      if (wall) dead = true;
      if (d.t > d.life) dead = true;
      d.px = nx;
      d.py = ny;
      if (dead) {
        if (d.carga === "barril") this.explode(nx, ny, 110, 60, d.owner);
        else if (wall) this.fx("impacto", nx, ny, { c: pr.team === "aliens" ? 16765502 : 16726843 });
        remove.push(id);
      }
    });
    for (const id of remove) {
      this.state.proyectiles.delete(id);
      this.projData.delete(id);
    }
  }
  updateZones(dt) {
    const remove = [];
    this.state.zonas.forEach((z, zid) => {
      z.vida -= dt;
      if (z.vida <= 0) return void remove.push(zid);
      this.state.jugadores.forEach((p, id) => {
        if (!p.vivo || p.fantasma || dist(z.x, z.y, p.x, p.y) > z.r) return;
        if (z.k === "acido") this.damagePlayer(id, p, ENEMY_TUNING.quimico.dps * dt);
        else if (z.k === "fuego") this.damagePlayer(id, p, ENEMY_TUNING.lanzallamas.patchDps * dt);
        else if (z.k === "gas") {
          if (p.confuso <= 0) this.aviso("\xA1Gas! Tus controles est\xE1n invertidos.", "peligro", id);
          p.confuso = Math.max(p.confuso, ENEMY_TUNING.bioquimico.confuse);
        }
      });
    });
    for (const id of remove) this.state.zonas.delete(id);
  }
  updateProps(dt) {
    const remove = [];
    this.state.objetos.forEach((o, oid) => {
      if (o.k === "cobertura") {
        o.t -= dt;
        if (o.t <= 0) remove.push(oid);
      }
    });
    for (const id of remove) {
      const o = this.state.objetos.get(id);
      this.fx("transmutar", o.x, o.y, { c: 16761487 });
      this.state.objetos.delete(id);
    }
  }
  // ------------------------------------------------------------------ puertas y objetivos
  updateDoors() {
    this.state.puertas.forEach((door, id) => {
      if (door.abierta) return;
      const rule = DOOR_RULES[id];
      if (!rule || !rule.requiere.every((f) => this.flags.has(f))) return;
      door.abierta = true;
      this.world.setDoor(id, true);
      const o = this.world.findOne("door", id);
      if (o) this.fx("chispa", o.x + o.w / 2, o.y + o.h / 2);
      this.aviso(id === "D8" ? "\xA1La salida est\xE1 abierta! Corran a la SALIDA." : "Se abri\xF3 una puerta.", "exito");
    });
  }
  updateObjective() {
    const f = this.flags;
    const faltan = (ids, nombres) => ids.filter((i) => !f.has(i)).map((i) => nombres[i]).join(" \xB7 ");
    let t;
    if (!f.has("tutorial")) t = "Sobrevivan a los guardias de las incubadoras.";
    else if (!f.has("p1")) t = "C\xE1mara de contenci\xF3n: el Inteligente resuelve la Memoria ps\xEDquica (E en la consola). Los dem\xE1s, \xA1defi\xE9ndanlo!";
    else if (!f.has("p2") || !f.has("p3"))
      t = "Desde el hub: " + faltan(["p2", "p3"], { p2: "Archivo de seguridad (Cambiaformas disfrazado, al oeste)", p3: "Sala de tuber\xEDas (Del mar, al este)" });
    else if (!f.has("p4") || !f.has("p5") || !f.has("p6"))
      t = "Pasillo norte, salas de d\xFAo: " + faltan(["p4", "p5", "p6"], { p4: "Sala de rayos", p5: "Piscina de \xE1cido", p6: "V\xE1lvulas (esclusa)" });
    else if (!f.has("n1") || !f.has("n2") || !f.has("n3") || !f.has("jefe"))
      t = "N\xFAcleo (al sur del hub): activen las 3 estaciones para romper los dep\xF3sitos del Jefe y derr\xF3tenlo.";
    else t = "\xA1Lleguen a la SALIDA al este del n\xFAcleo!";
    if (this.state.objetivo !== t) this.state.objetivo = t;
  }
  checkEnd() {
    let vivos = 0;
    let enSalida = 0;
    const exit = this.world.findOne("exit");
    this.state.jugadores.forEach((p) => {
      if (!p.vivo) return;
      vivos++;
      if (exit && p.x >= exit.x && p.y >= exit.y && p.x <= exit.x + exit.w && p.y <= exit.y + exit.h) enSalida++;
    });
    if (vivos === 0) {
      this.state.fase = "derrota";
      this.aviso("Los atraparon a todos\u2026 Pulsen R para reintentar.", "peligro");
    } else if (this.state.puertas.get("D8")?.abierta && enSalida === vivos) {
      this.state.fase = "victoria";
      this.aviso("\xA1Escaparon del \xC1rea 1! Demo completada.", "exito");
    }
  }
  // ------------------------------------------------------------------ eventos
  aviso(texto, tipo, para) {
    if (para) {
      const d = this.pdata.get(para);
      if (d) {
        const last = d.noticeAt.get(texto) ?? -99;
        if (this.time - last < 2) return;
        d.noticeAt.set(texto, this.time);
      }
    }
    this.emit("aviso", { texto, tipo }, para);
  }
  fx(t, x, y, extra = {}) {
    this.emit("fx", { t, x: Math.round(x), y: Math.round(y), ...extra });
  }
  abilityName(a) {
    return ABILITY_NAMES[a] ?? a;
  }
};
function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

// src/rooms/LobbyRoom.ts
import { Room, matchMaker } from "@colyseus/core";
import { randomUUID } from "node:crypto";

// src/schema/LobbyState.ts
import { MapSchema as MapSchema2, Schema as Schema2, type as type2 } from "@colyseus/schema";
var LobbyPlayer = class extends Schema2 {
  constructor() {
    super(...arguments);
    this.nombre = "";
    this.alien = "";
    this.listo = false;
    this.anfitrion = false;
    this.x = 0.5;
    this.y = 0.7;
  }
};
__decorateClass([
  type2("string")
], LobbyPlayer.prototype, "nombre", 2);
__decorateClass([
  type2("string")
], LobbyPlayer.prototype, "alien", 2);
__decorateClass([
  type2("boolean")
], LobbyPlayer.prototype, "listo", 2);
__decorateClass([
  type2("boolean")
], LobbyPlayer.prototype, "anfitrion", 2);
__decorateClass([
  type2("float32")
], LobbyPlayer.prototype, "x", 2);
__decorateClass([
  type2("float32")
], LobbyPlayer.prototype, "y", 2);
var LobbyState = class extends Schema2 {
  constructor() {
    super(...arguments);
    this.codigo = "";
    this.estado = "esperando";
    this.cuenta = 0;
    this.necesarios = 3;
    this.jugadores = new MapSchema2();
  }
};
__decorateClass([
  type2("string")
], LobbyState.prototype, "codigo", 2);
__decorateClass([
  type2("string")
], LobbyState.prototype, "estado", 2);
__decorateClass([
  type2("uint8")
], LobbyState.prototype, "cuenta", 2);
__decorateClass([
  type2("uint8")
], LobbyState.prototype, "necesarios", 2);
__decorateClass([
  type2({ map: LobbyPlayer })
], LobbyState.prototype, "jugadores", 2);

// src/rooms/LobbyRoom.ts
var LobbyRoom = class extends Room {
  constructor() {
    super(...arguments);
    this.maxClients = 3;
    this.state = new LobbyState();
  }
  async onCreate() {
    this.roomId = await this.codigoUnico();
    this.state.codigo = this.roomId;
    this.state.necesarios = jugadoresNecesarios();
    this.maxClients = Math.max(this.state.necesarios, 1);
    await this.setPrivate(true);
    this.onMessage("elegir", (client, msg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || this.state.estado !== "esperando" || !isAlienKind(msg?.alien)) return;
      let ocupado = false;
      this.state.jugadores.forEach((o, id) => {
        if (id !== client.sessionId && o.alien === msg.alien) ocupado = true;
      });
      if (ocupado) return;
      p.alien = msg.alien;
      p.listo = false;
    });
    this.onMessage("listo", (client, msg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || this.state.estado !== "esperando") return;
      p.listo = Boolean(msg?.ready) && p.alien !== "";
      this.revisar();
    });
    this.onMessage("mover", (client, msg) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (!p || !p.alien || this.state.estado !== "esperando") return;
      if (!Number.isFinite(msg?.x) || !Number.isFinite(msg?.y)) return;
      p.x = Math.min(LOBBY_BOUNDS.maxX, Math.max(LOBBY_BOUNDS.minX, msg.x));
      p.y = Math.min(LOBBY_BOUNDS.maxY, Math.max(LOBBY_BOUNDS.minY, msg.y));
    });
    this.onMessage("nombre", (client, nombre) => {
      const p = this.state.jugadores.get(client.sessionId);
      if (p) p.nombre = limpiarNombre(nombre);
    });
  }
  onJoin(client, options) {
    const p = new LobbyPlayer();
    p.nombre = limpiarNombre(options?.nombre);
    p.anfitrion = this.state.jugadores.size === 0;
    p.x = 0.3 + 0.2 * this.state.jugadores.size;
    p.y = 0.7;
    this.state.jugadores.set(client.sessionId, p);
  }
  onLeave(client) {
    const p = this.state.jugadores.get(client.sessionId);
    this.state.jugadores.delete(client.sessionId);
    if (this.state.estado === "empezando" && this.countdown) {
      this.countdown.clear();
      this.countdown = void 0;
      this.state.estado = "esperando";
      this.state.cuenta = 0;
      this.unlock();
    }
    if (p?.anfitrion) {
      const next = [...this.state.jugadores.values()][0];
      if (next) next.anfitrion = true;
    }
  }
  revisar() {
    const lista = [...this.state.jugadores.values()];
    const listos = lista.length >= this.state.necesarios && lista.every((p) => p.listo && p.alien);
    if (!listos || this.state.estado !== "esperando") return;
    this.state.estado = "empezando";
    this.state.cuenta = 3;
    this.lock();
    const tick = this.clock.setInterval(() => {
      this.state.cuenta--;
      if (this.state.cuenta <= 0) {
        tick.clear();
        this.countdown = void 0;
        void this.empezar();
      }
    }, 1e3);
    this.countdown = tick;
  }
  async empezar() {
    const roster = [...this.state.jugadores.entries()].map(([id, p]) => ({ id, nombre: p.nombre, alien: p.alien, token: randomUUID() }));
    try {
      const sala = await matchMaker.createRoom("partida", { roster: roster.map(({ nombre, alien, token }) => ({ nombre, alien, token })), codigo: this.state.codigo });
      for (const r of roster) {
        const client = this.clients.find((c) => c.sessionId === r.id);
        if (!client) continue;
        const reserva = await matchMaker.reserveSeatFor(sala, { token: r.token });
        client.send("empezar", {
          sessionId: reserva.sessionId,
          room: { roomId: sala.roomId, processId: sala.processId, name: sala.name, publicAddress: sala.publicAddress }
        });
      }
    } catch (e) {
      console.error("No se pudo crear la partida", e);
      this.state.estado = "esperando";
      this.state.cuenta = 0;
      this.unlock();
      this.broadcast("error", "No se pudo crear la partida. Int\xE9ntalo otra vez.");
    }
  }
  async codigoUnico() {
    for (let i = 0; i < 50; i++) {
      let code = "";
      for (let k = 0; k < ROOM_CODE_LENGTH; k++) code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      const existing = await matchMaker.query({ roomId: code });
      if (!existing.length) return code;
    }
    throw new Error("Sin c\xF3digos libres");
  }
};
function limpiarNombre(n) {
  const s = String(n ?? "").replace(/[<>]/g, "").trim().slice(0, 14);
  return s || "Alien";
}

// src/rooms/GameRoom.ts
var GameRoom = class extends Room2 {
  constructor() {
    super(...arguments);
    this.maxClients = 3;
    this.state = new GameState();
    this.roster = [];
    this.usados = /* @__PURE__ */ new Set();
    /** Jugadores que ya terminaron de cargar el juego. */
    this.cargados = /* @__PURE__ */ new Set();
    this.chatAt = /* @__PURE__ */ new Map();
  }
  onCreate(options) {
    this.roster = Array.isArray(options?.roster) ? options.roster.slice(0, 3) : [];
    this.maxClients = Math.max(1, this.roster.length);
    this.autoDispose = true;
    this.partida = new Partida(this.state, (type3, msg, to) => {
      if (to) this.clients.find((c) => c.sessionId === to)?.send(type3, msg);
      else this.broadcast(type3, msg);
    });
    this.setPatchRate(1e3 / PATCH_RATE);
    this.setSimulationInterval((ms) => this.partida.tick(Math.min(ms, 100) / 1e3), 1e3 / TICK_RATE);
    this.onMessage("input", (c, m) => this.partida.input(c.sessionId, m));
    this.onMessage("habilidad", (c, m) => this.partida.usarHabilidad(c.sessionId, m?.x, m?.y));
    this.onMessage("interactuar", (c, m) => this.partida.setInteract(c.sessionId, Boolean(m?.down)));
    this.onMessage("cambiar", (c) => this.partida.cambiarHabilidad(c.sessionId));
    this.onMessage("dar", (c) => this.partida.darAlma(c.sessionId));
    this.onMessage("mg", (c, m) => this.partida.puzzles.message(c.sessionId, m));
    this.onMessage("reiniciar", (c) => this.partida.votarReinicio(c.sessionId));
    this.onMessage("cargado", (c) => {
      this.cargados.add(c.sessionId);
      this.intentarEmpezar();
    });
    this.onMessage("ping", (c, m) => {
      const p = this.state.jugadores.get(c.sessionId);
      if (!p || !PING_TYPES.includes(m?.tipo) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      if (this.spam(c.sessionId, 0.4)) return;
      this.broadcast("ping", { de: c.sessionId, tipo: m.tipo, x: Math.round(m.x), y: Math.round(m.y) });
    });
    this.onMessage("chat", (c, m) => {
      const p = this.state.jugadores.get(c.sessionId);
      const texto = String(m?.texto ?? "").replace(/[<>]/g, "").trim().slice(0, 140);
      if (!p || !texto || this.spam(c.sessionId, 0.5)) return;
      this.broadcast("chat", { de: c.sessionId, nombre: p.nombre, alien: p.kind, texto });
    });
    if (process.env.PRUEBAS === "1") {
      this.onMessage("dbg", (c, m) => {
        const p = this.state.jugadores.get(c.sessionId);
        if (!p) return;
        if (m.tp) {
          p.x = Number(m.tp[0]);
          p.y = Number(m.tp[1]);
        }
        if (m.flag) this.partida.flags.add(m.flag);
        if (m.morir) this.partida.killPlayer(c.sessionId, p);
        if (m.alma && isAlienKind(m.alma)) p.almas.push(m.alma);
        if (m.vida) p.hp = p.maxHp;
      });
    }
    this.clock.setTimeout(() => {
      if (this.state.fase === "esperando") this.disconnect();
    }, 12e4);
  }
  spam(id, gap) {
    const now = this.clock.currentTime / 1e3;
    const last = this.chatAt.get(id) ?? -99;
    if (now - last < gap) return true;
    this.chatAt.set(id, now);
    return false;
  }
  onAuth(_client, options) {
    const r = this.roster.find((e) => e.token === options?.token);
    if (!r || this.usados.has(r.token)) throw new Error("No tienes plaza en esta partida.");
    this.usados.add(r.token);
    return r;
  }
  onJoin(client, _options, auth) {
    const alien = isAlienKind(auth.alien) ? auth.alien : "cambiaformas";
    this.partida.addPlayer(client.sessionId, limpiarNombre(auth.nombre), alien);
    this.state.objetivo = "Esperando a que todos terminen de cargar\u2026";
    const necesarios = Math.min(jugadoresNecesarios(), this.roster.length);
    if (this.state.jugadores.size >= necesarios) {
      this.lock();
      this.clock.setTimeout(() => this.intentarEmpezar(true), 45e3);
    }
  }
  intentarEmpezar(forzar = false) {
    if (this.state.fase !== "esperando") return;
    const necesarios = Math.min(jugadoresNecesarios(), this.roster.length);
    if (this.state.jugadores.size < necesarios) return;
    let todos = true;
    this.state.jugadores.forEach((_p, id) => {
      if (!this.cargados.has(id)) todos = false;
    });
    if (todos || forzar) this.partida.start();
  }
  async onLeave(client, consented) {
    const p = this.state.jugadores.get(client.sessionId);
    if (!p) return;
    p.conectado = false;
    if (!consented && this.state.fase === "jugando") {
      try {
        this.partida.aviso(`${p.nombre} perdi\xF3 la conexi\xF3n\u2026 esperando 60 s.`, "peligro");
        await this.allowReconnection(client, 60);
        p.conectado = true;
        this.partida.aviso(`${p.nombre} volvi\xF3.`, "exito");
        return;
      } catch {
      }
    }
    this.partida.playerLeft(client.sessionId);
  }
};

// src/index.ts
var app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ORIGENES.length === 0 || ORIGENES.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  next();
});
if (ORIGENES.length) {
  matchMaker2.controller.getCorsHeaders = (req) => {
    const origin = String(req.headers?.origin ?? "");
    return { "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0] };
  };
}
app.get("/salud", (_req, res) => {
  res.json({ ok: true, juego: "dawg", jugadoresNecesarios: jugadoresNecesarios() });
});
var clienteDir = CLIENTE_DIR ? resolve(CLIENTE_DIR) : "";
if (clienteDir && existsSync(clienteDir)) {
  app.use(
    express.static(clienteDir, {
      setHeaders: (res, ruta) => {
        if (/-[\w-]{8}\.(js|css)$/.test(ruta)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      }
    })
  );
  console.log(`Sirviendo el juego desde ${clienteDir}`);
}
var server = http.createServer(app);
var gameServer = new Server({
  transport: new WebSocketTransport({ server, pingInterval: 5e3, pingMaxRetries: 3 })
});
gameServer.define("lobby", LobbyRoom);
gameServer.define("partida", GameRoom);
gameServer.listen(PORT).then(() => {
  console.log(`dawg escuchando en el puerto ${PORT} (jugadores por sala: ${jugadoresNecesarios()})`);
});
var apagar = async () => {
  console.log("Apagando\u2026");
  await gameServer.gracefullyShutdown(false);
  process.exit(0);
};
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
//# sourceMappingURL=index.js.map
