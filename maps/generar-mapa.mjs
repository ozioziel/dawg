// Genera maps/area51.json (formato Tiled): un único mapa continuo con los tres sectores.
//   Sector I   (x 0-111):   Incubadoras — el laboratorio original, su núcleo y su jefe.
//   Sector II  (x 111-198): Complejo de Xenogenética — atrio, cinco salas y el Centinela MK-II.
//   Sector III (x 199-279): Protocolo de fuga — hangar de evacuación, Gran Compuerta y exterior.
// Uso: npm run mapa. El JSON se puede abrir y retocar en Tiled.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const W = 280;
const H = 96;
const T = 64;

// ---- Tileset (debe coincidir con tiles.png: 8 columnas × 3 filas) ----
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
  suelo_xeno: 18,
  suelo_hangar: 19,
  arena: 20,
  suelo_alarma: 21,
  pared_frente_xeno: 22,
  pared_frente_hangar: 23,
};
const SOLIDOS = [10, 11, 12, 13, 14, 15, 16, 17, 22, 23];
const LIQUIDOS = [8, 9];

let seed = 51;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const floor = new Int16Array(W * H).fill(-1);
const at = (x, y) => y * W + x;
function carve(x0, x1, y0, y1, tile) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) floor[at(x, y)] = Array.isArray(tile) ? tile[Math.floor(rnd() * tile.length)] : tile;
}
const unCarve = (x0, x1, y0, y1) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor[at(x, y)] = -1;
};
const {
  suelo_a,
  suelo_b,
  suelo_c,
  suelo_morado,
  suelo_rejilla,
  suelo_peligro,
  suelo_verde,
  suelo_azul,
  acido,
  suelo_xeno,
  suelo_hangar,
  arena,
  suelo_alarma,
} = TILES;
const mix = (main, other, n = 6) => [...Array(n).fill(main), other];

// ---- Salas ----
const rooms = [
  // Sector I
  { id: "r0", s: 1, nombre: "Incubadoras", x0: 4, x1: 27, y0: 70, y1: 91, tile: mix(suelo_verde, suelo_a, 8) },
  { id: "almacen", s: 1, nombre: "Almacén", x0: 8, x1: 30, y0: 57, y1: 66, tile: mix(suelo_b, suelo_rejilla, 4) },
  { id: "r1", s: 1, nombre: "Cámara de contención", x0: 40, x1: 57, y0: 68, y1: 85, tile: mix(suelo_a, suelo_c, 5) },
  { id: "hub", s: 1, nombre: "Hub central", x0: 44, x1: 75, y0: 34, y1: 55, tile: mix(suelo_azul, suelo_b) },
  { id: "r2", s: 1, nombre: "Archivo de seguridad", x0: 8, x1: 27, y0: 36, y1: 51, tile: mix(suelo_b, suelo_a, 5) },
  { id: "r3", s: 1, nombre: "Sala de tuberías", x0: 92, x1: 109, y0: 36, y1: 51, tile: mix(suelo_a, suelo_rejilla, 4) },
  { id: "pasillo", s: 1, nombre: "Pasillo norte", x0: 6, x1: 109, y0: 26, y1: 28, tile: mix(suelo_a, suelo_b, 5) },
  { id: "r4", s: 1, nombre: "Sala de rayos", x0: 6, x1: 33, y0: 4, y1: 23, tile: mix(suelo_morado, suelo_c, 5) },
  { id: "r5", s: 1, nombre: "Piscina de ácido", x0: 46, x1: 73, y0: 4, y1: 23, tile: [suelo_a, suelo_b] },
  { id: "r6", s: 1, nombre: "Esclusa", x0: 82, x1: 109, y0: 4, y1: 23, tile: mix(suelo_azul, suelo_c, 4) },
  { id: "r7", s: 1, nombre: "Núcleo de las incubadoras", x0: 66, x1: 109, y0: 64, y1: 91, tile: mix(suelo_morado, suelo_c, 5) },
  // Sector II
  { id: "e2", s: 2, nombre: "Esclusa de descontaminación", x0: 112, x1: 125, y0: 72, y1: 82, tile: mix(suelo_xeno, suelo_peligro, 9) },
  { id: "hub2", s: 2, nombre: "Atrio de bioingeniería", x0: 118, x1: 196, y0: 41, y1: 56, tile: mix(suelo_xeno, suelo_c, 7) },
  { id: "s2a", s: 2, nombre: "Invernadero de mutágenos", x0: 120, x1: 139, y0: 5, y1: 24, tile: mix(suelo_verde, suelo_xeno, 3) },
  { id: "s2b", s: 2, nombre: "Criobanco", x0: 146, x1: 167, y0: 5, y1: 24, tile: mix(suelo_azul, suelo_xeno, 3) },
  { id: "s2c", s: 2, nombre: "Laboratorio de clonación", x0: 174, x1: 195, y0: 5, y1: 24, tile: mix(suelo_xeno, suelo_morado, 4) },
  { id: "s2d", s: 2, nombre: "Sala de pruebas", x0: 128, x1: 149, y0: 63, y1: 81, tile: mix(suelo_xeno, suelo_rejilla, 4) },
  { id: "s2e", s: 2, nombre: "Archivo genético", x0: 153, x1: 171, y0: 63, y1: 81, tile: mix(suelo_xeno, suelo_b, 4) },
  { id: "arena2", s: 2, nombre: "Cámara del Centinela", x0: 175, x1: 197, y0: 61, y1: 92, tile: mix(suelo_rejilla, suelo_peligro, 9) },
  // Sector III
  { id: "e3", s: 3, nombre: "Túnel de carga", x0: 200, x1: 212, y0: 79, y1: 87, tile: mix(suelo_hangar, suelo_peligro, 7) },
  { id: "hangar", s: 3, nombre: "Hangar de evacuación", x0: 216, x1: 272, y0: 31, y1: 88, tile: mix(suelo_hangar, suelo_b, 9) },
  { id: "exterior", s: 3, nombre: "Exterior · Desierto de Nevada", x0: 214, x1: 275, y0: 3, y1: 26, tile: arena },
];
for (const r of rooms) carve(r.x0, r.x1, r.y0, r.y1, r.tile);

// Pared interior de la Sala de rayos (lado consola | lado interruptores) con un hueco.
unCarve(19, 19, 4, 11);
unCarve(19, 19, 16, 23);
// Piscina de ácido.
carve(46, 73, 10, 15, acido);
// Muros bajos del hangar (coberturas sólidas).
for (const [x, y] of [[238, 50], [250, 50], [238, 64], [250, 64]]) unCarve(x, x + 1, y, y + 1);
// Columnas del atrio.
for (const x of [134, 150, 166, 182]) unCarve(x, x, 47, 50);

// ---- Pasillos ----
const corr = [
  [28, 39, 79, 81, suelo_rejilla], // incubadoras → contención
  [14, 16, 67, 69, suelo_rejilla], // incubadoras ↔ almacén
  [48, 50, 56, 67, suelo_rejilla], // hub → contención
  [28, 43, 42, 44, suelo_rejilla], // archivo ↔ hub
  [76, 91, 42, 44, suelo_rejilla], // hub ↔ tuberías
  [59, 61, 29, 33, suelo_rejilla], // hub ↔ pasillo norte
  [11, 13, 24, 25, suelo_peligro], // D4
  [59, 61, 24, 25, suelo_peligro], // D5
  [98, 100, 24, 25, suelo_peligro], // D6
  [68, 70, 56, 63, suelo_rejilla], // hub → núcleo
  [110, 111, 76, 78, suelo_peligro], // núcleo → esclusa (D8)
  [120, 122, 57, 71, suelo_rejilla], // esclusa → atrio
  [128, 130, 25, 40, suelo_rejilla], // atrio → s2a
  [155, 157, 25, 40, suelo_rejilla], // atrio → s2b
  [183, 185, 25, 40, suelo_rejilla], // atrio → s2c
  [138, 140, 57, 62, suelo_rejilla], // atrio → s2d
  [161, 163, 57, 62, suelo_rejilla], // atrio → s2e
  [185, 187, 57, 60, suelo_peligro], // atrio → arena del centinela
  [198, 199, 82, 84, suelo_peligro], // arena → túnel de carga
  [213, 215, 82, 84, suelo_hangar], // túnel → hangar
  [237, 251, 27, 30, suelo_peligro], // Gran Compuerta
];
for (const [x0, x1, y0, y1, t] of corr) carve(x0, x1, y0, y1, t);
// Marcas de alarma alrededor de la compuerta y del círculo central del hangar.
carve(234, 254, 31, 32, suelo_alarma);
carve(240, 248, 55, 59, suelo_alarma);

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
      if (x >= 199) walls[at(x, y)] = r < 0.8 ? TILES.pared_frente_hangar : TILES.pared_frente_tuberia;
      else if (x >= 112) walls[at(x, y)] = r < 0.62 ? TILES.pared_frente_xeno : r < 0.8 ? TILES.pared_frente_cian : TILES.pared_frente_pantalla;
      else
        walls[at(x, y)] =
          r < 0.62 ? TILES.pared_frente : r < 0.72 ? TILES.pared_frente_rosa : r < 0.82 ? TILES.pared_frente_cian : r < 0.91 ? TILES.pared_frente_tuberia : TILES.pared_frente_pantalla;
    } else walls[at(x, y)] = TILES.pared_superior;
  }
}

// ---- Objetos ----
const objects = [];
let nextId = 1;
const c = (t) => (t + 0.5) * T;
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

for (const r of rooms) rect("room", r.id, r.x0, r.x1, r.y0, r.y1, { nombre: r.nombre, sector: r.s });
rect("sector", "1", 0, 111, 0, H - 1, { nombre: "Sector I · Incubadoras" });
rect("sector", "2", 112, 198, 0, H - 1, { nombre: "Sector II · Complejo de Xenogenética" });
rect("sector", "3", 199, W - 1, 0, H - 1, { nombre: "Sector III · Protocolo de fuga" });

// Puertas
const doors = [
  ["D0", 28, 28, 79, 81, "v"],
  ["D1", 48, 50, 67, 67, "h"],
  ["D2", 28, 28, 42, 44, "v"],
  ["D3", 91, 91, 42, 44, "v"],
  ["D4", 11, 13, 24, 25, "h"],
  ["D5", 59, 61, 24, 25, "h"],
  ["D6", 98, 100, 24, 25, "h"],
  ["D7", 68, 70, 63, 63, "h"],
  ["D8", 110, 110, 76, 78, "v"],
  ["E1", 128, 130, 25, 25, "h"],
  ["E2", 155, 157, 25, 25, "h"],
  ["E3", 183, 185, 25, 25, "h"],
  ["E4", 138, 140, 62, 62, "h"],
  ["E5", 161, 163, 62, 62, "h"],
  ["D10", 185, 187, 60, 60, "h"],
  ["D11", 198, 198, 82, 84, "v"],
  ["D12", 215, 215, 82, 84, "v"],
  ["DF", 237, 251, 29, 30, "h"],
];
for (const [n, x0, x1, y0, y1, o] of doors) rect("door", n, x0, x1, y0, y1, { orientacion: o, gigante: n === "DF" });

// Inicio y puntos de control (cápsulas de reanimación)
[[9, 80], [13, 82], [17, 80], [11, 84], [15, 85]].forEach(([x, y], i) => point("player_spawn", `j${i}`, x, y));
point("checkpoint", "1", 13, 82, { sector: 1 });
point("checkpoint", "2", 116, 77, { sector: 2 });
point("checkpoint", "3", 205, 83, { sector: 3 });
point("capsula", "2", 123, 74, { sector: 2 });
point("capsula", "3", 210, 81, { sector: 3 });

// Zonas de cada sala-reto (donde los retos colocan sus objetos). zona2 opcional.
const slot = (id, x0, x1, y0, y1, extra = {}) => rect("slot", id, x0, x1, y0, y1, extra);
slot("r1", 42, 55, 70, 83);
slot("r2", 10, 25, 38, 49);
slot("r3", 94, 107, 38, 49);
slot("r4", 21, 32, 5, 22, { z2x: 7, z2y: 5, z2w: 11, z2h: 18 });
slot("r5", 47, 72, 16, 22);
slot("r6", 84, 107, 6, 21);
slot("s2a", 122, 137, 7, 22);
slot("s2b", 148, 165, 7, 22);
slot("s2c", 176, 193, 7, 22);
slot("s2d", 130, 147, 65, 79);
slot("s2e", 155, 169, 65, 79);
slot("s3a", 218, 232, 33, 43);
slot("s3b", 256, 270, 33, 43);
slot("s3c", 218, 232, 46, 57);
slot("s3d", 256, 270, 46, 57);
slot("s3e", 218, 232, 62, 73);
slot("s3f", 256, 270, 62, 73);
slot("s3g", 236, 252, 76, 86);

// Decorado sólido (sprite + radio de colisión)
const decor = (sprite, tx, ty, radio) => point("decor", sprite, tx, ty, { sprite, radio });
for (const x of [7, 11, 15, 19, 23]) {
  decor("incubadora_rota", x, 74, 34);
  decor("incubadora_rota", x, 87, 34);
}
decor("consola", 6, 81, 26);
decor("tubo", 26, 72, 26);
decor("tubo", 26, 89, 26);
for (const x of [10, 13, 24, 27]) decor("estanteria", x, 58, 30);
decor("tubo", 41, 69, 26);
decor("tubo", 56, 69, 26);
decor("servidor", 41, 84, 26);
decor("servidor", 56, 84, 26);
decor("holograma", 60, 44, 52);
for (const [x, y] of [[49, 38], [70, 38], [49, 51], [70, 51]]) decor("mesa", x, y, 30);
decor("tubo", 45, 35, 26);
decor("tubo", 74, 35, 26);
decor("servidor", 9, 37, 26);
decor("servidor", 26, 37, 26);
decor("servidor", 9, 50, 26);
decor("tanque", 93, 37, 34);
decor("tanque", 108, 37, 34);
decor("tanque", 108, 50, 34);
decor("consola", 7, 20, 26);
decor("tanque", 83, 5, 34);
decor("tanque", 108, 22, 34);
decor("nucleo", 87.5, 77.5, 92);
for (const [x, y] of [[69, 67], [106, 67], [69, 88], [106, 88]]) decor("incubadora", x, y, 34);
// Sector II
decor("holograma", 158, 48, 52);
for (const [x, y] of [[121, 43], [195, 43], [121, 55], [195, 55]]) decor("tanque", x, y, 34);
for (const x of [121, 138]) decor("incubadora", x, 6, 34);
for (const x of [147, 166]) decor("tanque", x, 6, 34);
for (const x of [175, 194]) decor("incubadora", x, 6, 34);
decor("servidor", 129, 80, 26);
decor("servidor", 148, 80, 26);
decor("servidor", 154, 80, 26);
decor("servidor", 170, 80, 26);
for (const [x, y] of [[176, 62], [196, 62], [176, 91], [196, 91]]) decor("tubo", x, y, 26);
decor("consola", 113, 73, 26);
// Sector III
for (const [x, y] of [[217, 32], [271, 32], [217, 87], [271, 87]]) decor("tanque", x, y, 34);
for (const [x, y] of [[226, 59], [262, 59]]) decor("mesa", x, y, 30);

// Objetos destructibles / transmutables
const prop = (kind, tx, ty) => point("prop", kind, tx, ty, { kind });
[
  // Sector I
  ["barril", 8, 90], ["caja", 21, 79], ["barril", 25, 82], ["caja", 6, 71],
  ["caja", 18, 61], ["caja", 20, 61], ["barril", 29, 64], ["botiquin", 9, 64],
  ["barril", 44, 76], ["caja", 53, 76], ["barril", 47, 82],
  ["barril", 53, 41], ["caja", 66, 41], ["barril", 53, 48], ["caja", 66, 48], ["botiquin", 60, 54],
  ["caja", 12, 42], ["barril", 25, 44],
  ["barril", 99, 44], ["caja", 104, 47], ["botiquin", 106, 50],
  ["caja", 30, 27], ["barril", 90, 27], ["caja", 45, 27],
  ["caja", 9, 14], ["barril", 15, 8],
  ["caja", 50, 20], ["barril", 69, 19],
  ["caja", 86, 16], ["botiquin", 95, 6],
  ["barril", 74, 72], ["barril", 101, 72], ["caja", 74, 84], ["caja", 101, 84], ["botiquin", 88, 66],
  // Sector II
  ["botiquin", 118, 80], ["caja", 114, 74], ["barril", 124, 81],
  ["barril", 126, 45], ["caja", 142, 52], ["barril", 172, 44], ["caja", 190, 52], ["botiquin", 158, 55],
  ["caja", 123, 20], ["barril", 150, 20], ["caja", 178, 20], ["botiquin", 192, 8],
  ["barril", 132, 66], ["caja", 168, 66],
  ["barril", 179, 70], ["caja", 193, 70], ["barril", 179, 84], ["caja", 193, 84], ["botiquin", 186, 64], ["botiquin", 186, 90],
  // Sector III
  ["botiquin", 202, 81], ["caja", 207, 86],
  ["caja", 236, 40], ["barril", 252, 40], ["caja", 236, 72], ["barril", 252, 72], ["barril", 230, 59], ["caja", 258, 59],
  ["botiquin", 244, 34], ["botiquin", 244, 88], ["botiquin", 219, 60], ["botiquin", 269, 60],
].forEach(([k, x, y]) => prop(k, x, y));

// Reto clásico «Puente sobre el ácido» (solo en la piscina r5).
point("dispenser", "l-puente", 52, 19, {});
for (let i = 0; i < 6; i++) point("slot_puente", "l-puente", 60, 15 - i, { i });
point("button", "l-puente", 60, 6, {});

// Jefe 1: estaciones de sabotaje del núcleo
point("sabotaje", "n1", 78, 70, {});
point("sabotaje", "n2", 97, 70, {});
point("sabotaje", "n3", 87.5, 88, {});
point("boss_spawn", "jefe", 87.5, 68, {});
// Jefe 2: válvulas de refrigerante de la arena
point("refrigerante", "v1", 178, 76, {});
point("refrigerante", "v2", 194, 76, {});
point("refrigerante", "v3", 186, 90, {});
point("boss_spawn", "centinela", 186, 72, {});
// Jefe 3: pilones del exotraje y llegada
for (const [x, y, i] of [[232, 46, 1], [256, 46, 2], [232, 68, 3], [256, 68, 4]]) point("pilon", `p${i}`, x, y, {});
point("boss_spawn", "director", 244, 40, {});
// Consola de la Gran Compuerta
point("compuerta", "DF", 244, 34, {});
rect("exit", "salida", 226, 262, 4, 12, {});

// Puntos de aparición de enemigos por sala
const spawns = {
  r0: [[20, 60], [27, 90], [5, 71]],
  almacen: [[28, 58], [9, 66]],
  r1: [[56, 72], [56, 82], [41, 80]],
  hub: [[46, 36], [73, 36], [46, 53], [73, 53]],
  r2: [[11, 50], [26, 50], [18, 37]],
  r3: [[110, 44], [95, 50], [100, 37]],
  pasillo: [[7, 27], [108, 27], [40, 27], [80, 27]],
  r4: [[32, 5], [7, 23], [32, 23]],
  r5: [[47, 22], [72, 22], [47, 17], [72, 17]],
  r6: [[83, 22], [108, 5], [96, 5]],
  r7: [[67, 65], [108, 65], [67, 90], [108, 90]],
  e2: [[113, 81], [124, 73]],
  hub2: [[119, 42], [196, 42], [119, 55], [196, 55], [158, 42], [158, 55]],
  s2a: [[121, 23], [138, 23], [130, 6]],
  s2b: [[147, 23], [166, 23], [157, 6]],
  s2c: [[175, 23], [194, 23], [184, 6]],
  s2d: [[129, 64], [148, 64], [139, 80]],
  s2e: [[154, 64], [170, 64], [162, 80]],
  arena2: [[177, 63], [195, 63], [177, 90], [195, 90]],
  e3: [[201, 80], [211, 86]],
  hangar: [[218, 33], [270, 33], [218, 86], [270, 86], [244, 86], [217, 60], [271, 60]],
  exterior: [[216, 5], [273, 5], [244, 4]],
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
  properties: [{ name: "nombre", type: "string", value: "Área 51 — escape completo" }],
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

const out = join(here, "area51.json");
writeFileSync(out, JSON.stringify(map));
console.log(`Mapa escrito en ${out} (${W}x${H}, ${objects.length} objetos)`);
