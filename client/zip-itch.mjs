// Comprime client/dist en dawg-itch.zip (raíz del proyecto) listo para subir a itch.io (HTML5).
import { strToU8, zipSync } from "fflate";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist");
const out = resolve(here, "../../dawg-itch.zip");

const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dist, p).split("\\").join("/")] = new Uint8Array(readFileSync(p));
  }
};
walk(dist);
if (!files["index.html"]) {
  console.error("No existe client/dist/index.html. Ejecuta antes el build.");
  process.exit(1);
}
const url = process.env.VITE_SERVER_URL;
files["LEEME.txt"] = strToU8(`dawg — build para itch.io\nServidor: ${url || "(no definido: el juego intentará conectarse a la misma dirección)"}\n`);
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`Listo: ${out} (${Object.keys(files).length} archivos)`);
if (!url) console.warn("Aviso: no definiste VITE_SERVER_URL; en itch.io el juego no sabrá dónde está tu servidor.");
