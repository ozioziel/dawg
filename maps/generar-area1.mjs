// Genera maps/area1.json (formato Tiled) a partir del diseño del Área 1.
// Uso: npm run mapa
// El JSON se puede abrir y editar luego en Tiled (https://www.mapeditor.org/).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const W = 120;
const H = 96;
const T = 64;

// ---- Tileset (debe coincidir con el orden de generar-arte) ----
export const TILES = {
  suelo_a: 0,
  suelo_b: 1,
  suelo_c: 2,
  suelo_morado: 3,
  suelo_rejilla: 4,
  suelo_peligro: 5,
  suelo_verde: 6,
  suelo_azul: 7,
  acido: 8,
  agua: 9,
  pared_superior: 10,
  pared_frente: 11,
  pared_frente_rosa: 12,
  pared_frente_cian: 13,
  pared_frente_pantalla: 14,
  vacio: 15,
  vacio_b: 16,
  pared_frente_tuberia: 17,
};
const SOLIDOS = [10, 11, 12, 13, 14, 15, 16, 17];
const LIQUIDOS = [8, 9];

// RNG con semilla para que el mapa sea siempre igual.
let seed = 51;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const floor = new Int16Array(W * H).fill(-1); // índice de tile de suelo o -1
const at = (x, y) => y * W + x;

function carve(x0, x1, y0, y1, tile) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = Array.isArray(tile) ? tile[Math.floor(rnd() * tile.length)] : tile;
      floor[at(x, y)] = t;
    }
}
function fill(x0, x1, y0, y1, tile) {
  carve(x0, x1, y0, y1, tile);
}
function unCarve(x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor[at(x, y)] = -1;
}

const { suelo_a, suelo_b, suelo_c, suelo_morado, suelo_rejilla, suelo_peligro, suelo_verde, suelo_azul, acido } = TILES;

// ---- Salas ----
const rooms = [
  { id: "r0", nombre: "Incubadoras", x0: 4, x1: 27, y0: 70, y1: 91, tile: [suelo_verde, suelo_verde, suelo_verde, suelo_verde, suelo_verde, suelo_verde, suelo_verde, suelo_verde, suelo_a] },
  { id: "almacen", nombre: "Almacén", x0: 8, x1: 30, y0: 57, y1: 66, tile: [suelo_b, suelo_b, suelo_b, suelo_b, suelo_rejilla] },
  { id: "r1", nombre: "Cámara de contención", x0: 40, x1: 57, y0: 68, y1: 85, tile: [suelo_a, suelo_a, suelo_a, suelo_a, suelo_a, suelo_c] },
  { id: "hub", nombre: "Hub central", x0: 44, x1: 75, y0: 34, y1: 55, tile: [suelo_azul, suelo_azul, suelo_azul, suelo_azul, suelo_azul, suelo_azul, suelo_b] },
  { id: "r2", nombre: "Archivo de seguridad", x0: 8, x1: 27, y0: 36, y1: 51, tile: [suelo_b, suelo_b, suelo_b, suelo_b, suelo_b, suelo_a] },
  { id: "r3", nombre: "Sala de tuberías", x0: 92, x1: 111, y0: 36, y1: 51, tile: [suelo_a, suelo_a, suelo_a, suelo_a, suelo_rejilla] },
  { id: "pasillo", nombre: "Pasillo norte", x0: 6, x1: 113, y0: 26, y1: 28, tile: [suelo_a, suelo_a, suelo_a, suelo_a, suelo_a, suelo_b] },
  { id: "r4", nombre: "Sala de rayos", x0: 6, x1: 33, y0: 4, y1: 23, tile: [suelo_morado, suelo_morado, suelo_morado, suelo_morado, suelo_morado, suelo_c] },
  { id: "r5", nombre: "Piscina de ácido", x0: 46, x1: 73, y0: 4, y1: 23, tile: [suelo_a, suelo_b] },
  { id: "r6", nombre: "Esclusa", x0: 86, x1: 113, y0: 4, y1: 23, tile: [suelo_azul, suelo_azul, suelo_azul, suelo_azul, suelo_c] },
  { id: "r7", nombre: "Núcleo de las incubadoras", x0: 66, x1: 109, y0: 64, y1: 91, tile: [suelo_morado, suelo_morado, suelo_morado, suelo_morado, suelo_morado, suelo_c] },
  { id: "salida", nombre: "Salida al Área 2", x0: 111, x1: 117, y0: 74, y1: 80, tile: suelo_peligro },
];
for (const r of rooms) carve(r.x0, r.x1, r.y0, r.y1, r.tile);

// Pared interior de la Sala de rayos (lado consola | lado interruptores) con un hueco.
unCarve(19, 19, 4, 11);
unCarve(19, 19, 16, 23);
// Piscina de ácido.
fill(46, 73, 10, 15, acido);

// ---- Pasillos ----
carve(28, 39, 79, 81, suelo_rejilla); // incubadoras → contención (D0 en x=28)
carve(14, 16, 67, 69, suelo_rejilla); // incubadoras ↔ almacén
carve(48, 50, 56, 67, suelo_rejilla); // hub → contención (D1 en y=67)
carve(28, 43, 42, 44, suelo_rejilla); // archivo ↔ hub
carve(76, 91, 42, 44, suelo_rejilla); // hub ↔ tuberías
carve(59, 61, 29, 33, suelo_rejilla); // hub ↔ pasillo norte
carve(11, 13, 24, 25, suelo_peligro); // D4
carve(59, 61, 24, 25, suelo_peligro); // D5
carve(98, 100, 24, 25, suelo_peligro); // D6
carve(68, 70, 56, 63, suelo_rejilla); // hub → núcleo (D7 en y=63)
carve(110, 110, 76, 78, suelo_peligro); // D8
// Marcas de peligro bajo las puertas.
fill(28, 28, 79, 81, suelo_peligro);
fill(48, 50, 67, 67, suelo_peligro);
fill(68, 70, 63, 63, suelo_peligro);

// ---- Paredes ----
const walls = new Int16Array(W * H).fill(-1);
const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && floor[at(x, y)] >= 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (isFloor(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) near = true;
    if (!near) {
      walls[at(x, y)] = rnd() < 0.82 ? TILES.vacio : TILES.vacio_b;
      continue;
    }
    if (isFloor(x, y + 1)) {
      const r = rnd();
      walls[at(x, y)] =
        r < 0.62 ? TILES.pared_frente
        : r < 0.72 ? TILES.pared_frente_rosa
        : r < 0.82 ? TILES.pared_frente_cian
        : r < 0.91 ? TILES.pared_frente_tuberia
        : TILES.pared_frente_pantalla;
    } else {
      walls[at(x, y)] = TILES.pared_superior;
    }
  }
}

// ---- Objetos ----
const objects = [];
let nextId = 1;
const c = (t) => (t + 0.5) * T; // centro de celda en píxeles
function obj(type, name, x, y, props = {}, w = 0, h = 0) {
  objects.push({
    id: nextId++,
    name,
    type,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    ...(w === 0 && h === 0 ? { point: true } : {}),
    properties: Object.entries(props).map(([k, v]) => ({
      name: k,
      type: typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v === "boolean" ? "bool" : "string",
      value: v,
    })),
  });
}
const point = (type, name, tx, ty, props) => obj(type, name, c(tx), c(ty), props);
const rect = (type, name, x0, x1, y0, y1, props) => obj(type, name, x0 * T, y0 * T, props, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);

for (const r of rooms) rect("room", r.id, r.x0, r.x1, r.y0, r.y1, { nombre: r.nombre });

// Puertas
rect("door", "D0", 28, 28, 79, 81, { orientacion: "v" });
rect("door", "D1", 48, 50, 67, 67, { orientacion: "h" });
rect("door", "D4", 11, 13, 24, 25, { orientacion: "h" });
rect("door", "D5", 59, 61, 24, 25, { orientacion: "h" });
rect("door", "D6", 98, 100, 24, 25, { orientacion: "h" });
rect("door", "D7", 68, 70, 63, 63, { orientacion: "h" });
rect("door", "D8", 110, 110, 76, 78, { orientacion: "v" });

// Inicio
[[9, 80], [13, 82], [17, 80]].forEach(([x, y], i) => point("player_spawn", `j${i}`, x, y));

// Decorado sólido (sprite + radio de colisión)
const decor = (sprite, tx, ty, radio) => point("decor", sprite, tx, ty, { sprite, radio });
for (const x of [7, 11, 15, 19, 23]) {
  decor("incubadora_rota", x, 74, 34);
  decor("incubadora_rota", x, 87, 34);
}
decor("consola", 6, 81, 26);
decor("tubo", 26, 72, 26);
decor("tubo", 26, 89, 26);
// Almacén
decor("estanteria", 10, 58, 30);
decor("estanteria", 13, 58, 30);
decor("estanteria", 24, 58, 30);
decor("estanteria", 27, 58, 30);
// Contención
decor("tubo", 41, 69, 26);
decor("tubo", 56, 69, 26);
decor("servidor", 41, 84, 26);
decor("servidor", 56, 84, 26);
// Hub
decor("holograma", 60, 44, 52);
decor("mesa", 49, 38, 30);
decor("mesa", 70, 38, 30);
decor("mesa", 49, 51, 30);
decor("mesa", 70, 51, 30);
decor("tubo", 45, 35, 26);
decor("tubo", 74, 35, 26);
// Archivo
for (const x of [11, 15, 23]) decor("servidor", x, 46, 26);
decor("mesa", 22, 39, 30);
// Tuberías
decor("tanque", 95, 39, 34);
decor("tanque", 108, 49, 34);
decor("tanque", 95, 49, 34);
// Rayos
decor("consola", 7, 20, 26);
// Esclusa
decor("tanque", 87, 5, 34);
decor("tanque", 112, 22, 34);
// Núcleo
decor("nucleo", 87.5, 77.5, 92);
for (const [x, y] of [[69, 67], [106, 67], [69, 88], [106, 88]]) decor("incubadora", x, y, 34);

// Objetos destructibles / transmutables
const prop = (kind, tx, ty) => point("prop", kind, tx, ty, { kind });
[
  ["barril", 8, 90], ["caja", 21, 79], ["barril", 25, 82], ["caja", 6, 71],
  ["caja", 18, 61], ["caja", 20, 61], ["barril", 29, 64], ["botiquin", 9, 64],
  ["barril", 44, 76], ["caja", 53, 76], ["barril", 47, 82], ["caja", 52, 82],
  ["barril", 53, 41], ["caja", 66, 41], ["barril", 53, 48], ["caja", 66, 48], ["botiquin", 60, 54],
  ["caja", 12, 42], ["barril", 25, 44], ["caja", 19, 49],
  ["barril", 99, 44], ["caja", 104, 44], ["barril", 109, 38], ["botiquin", 110, 50],
  ["caja", 30, 27], ["barril", 90, 27], ["caja", 45, 27],
  ["caja", 9, 14], ["barril", 15, 8], ["caja", 25, 17], ["barril", 30, 10],
  ["caja", 50, 20], ["barril", 69, 19], ["caja", 66, 21],
  ["caja", 92, 16], ["barril", 107, 9], ["caja", 103, 21], ["botiquin", 95, 6],
  ["barril", 74, 72], ["barril", 101, 72], ["caja", 74, 84], ["caja", 101, 84], ["botiquin", 88, 66],
].forEach(([k, x, y]) => prop(k, x, y));

// Estaciones de minijuego
point("station", "p1", 49, 71, { puzzle: "p1" });
point("station", "p2", 17, 38, { puzzle: "p2" });
point("station", "p3", 101, 38, { puzzle: "p3" });
point("station", "p4", 9, 8, { puzzle: "p4", parte: "A" });
[[22, 6], [27, 6], [32, 6], [22, 21], [27, 21], [32, 21]].forEach(([x, y], i) => point("switch", "p4", x, y, { simbolo: i }));
point("dispenser", "p5", 52, 19, {});
for (let i = 0; i < 6; i++) point("slot", "p5", 60, 15 - i, { i });
point("button", "p5", 60, 6, {});
point("lever", "p6", 88, 14, { parte: "A" });
point("lever", "p6", 111, 14, { parte: "B" });
rect("water_zone", "p6", 92, 107, 7, 21, {});
point("station", "n1", 78, 70, { puzzle: "n1" });
point("station", "n2", 97, 70, { puzzle: "n2" });
point("station", "n3", 87.5, 88, { puzzle: "n3" });
point("boss_spawn", "jefe", 87.5, 68, {});
rect("exit", "salida", 112, 117, 74, 80, {});

// Puntos de aparición de enemigos por sala
const spawns = {
  r0: [[20, 60], [27, 90], [5, 71]],
  almacen: [[28, 58], [9, 66]],
  r1: [[56, 72], [56, 84], [41, 80]],
  hub: [[46, 36], [73, 36], [46, 53], [73, 53]],
  r2: [[9, 37], [26, 50], [9, 50]],
  r3: [[110, 37], [93, 50], [110, 50]],
  pasillo: [[7, 27], [112, 27], [40, 27], [80, 27]],
  r4: [[32, 5], [7, 23], [32, 23]],
  r5: [[47, 22], [72, 22], [47, 17], [72, 17]],
  r6: [[87, 22], [112, 5], [100, 5]],
  r7: [[67, 65], [108, 65], [67, 90], [108, 90]],
};
for (const [sala, list] of Object.entries(spawns)) for (const [x, y] of list) point("spawn", sala, x, y, { sala });

// ---- Escribir JSON de Tiled ----
const toGid = (arr) => Array.from(arr, (t) => (t < 0 ? 0 : t + 1));
const tilesetTiles = [
  ...SOLIDOS.map((id) => ({ id, properties: [{ name: "solido", type: "bool", value: true }] })),
  ...LIQUIDOS.map((id) => ({ id, properties: [{ name: "liquido", type: "bool", value: true }] })),
].sort((a, b) => a.id - b.id);

const map = {
  type: "map",
  version: "1.10",
  tiledversion: "1.10.2",
  orientation: "orthogonal",
  renderorder: "right-down",
  width: W,
  height: H,
  tilewidth: T,
  tileheight: T,
  infinite: false,
  nextlayerid: 4,
  nextobjectid: nextId,
  properties: [{ name: "nombre", type: "string", value: "Área 1 — Incubadoras" }],
  layers: [
    { id: 1, name: "suelo", type: "tilelayer", x: 0, y: 0, width: W, height: H, opacity: 1, visible: true, data: toGid(floor) },
    { id: 2, name: "paredes", type: "tilelayer", x: 0, y: 0, width: W, height: H, opacity: 1, visible: true, data: toGid(walls) },
    { id: 3, name: "objetos", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true, draworder: "topdown", objects },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: "laboratorio",
      image: "../client/public/assets/tiles.png",
      imagewidth: 8 * T,
      imageheight: 3 * T,
      tilewidth: T,
      tileheight: T,
      columns: 8,
      tilecount: 24,
      margin: 0,
      spacing: 0,
      tiles: tilesetTiles,
    },
  ],
};

const out = join(here, "area1.json");
writeFileSync(out, JSON.stringify(map));
console.log(`Mapa escrito en ${out} (${W}x${H}, ${objects.length} objetos)`);
