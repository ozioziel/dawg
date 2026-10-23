// Crea dawg-vps.zip con lo necesario para el VPS (sin node_modules, builds ni la carpeta privada).
// Uso (en tu PC, desde la raíz):  npm run paquete:vps
import { zipSync } from "fflate";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dawg-vps.zip");
const INCLUIR = ["package.json", "package-lock.json", "tsconfig.base.json", "Dockerfile", ".dockerignore", ".gitattributes", "README.md", "DESPLIEGUE.md", "shared", "server", "client", "maps", "deploy"];
const EXCLUIR = new Set(["node_modules", "dist", ".env", ".privado", ".claude", ".git"]);

const files = {};
const add = (p) => {
  const st = statSync(p);
  const name = p.split(/[\\/]/).pop();
  if (EXCLUIR.has(name) || name.endsWith(".zip")) return;
  if (st.isDirectory()) {
    for (const n of readdirSync(p)) add(join(p, n));
    return;
  }
  let data = new Uint8Array(readFileSync(p));
  // Los scripts de shell deben tener saltos de línea de Linux.
  if (/\.(sh)$/.test(name) || name === "Caddyfile" || name === ".env.example") {
    data = new TextEncoder().encode(new TextDecoder().decode(data).replace(/\r\n/g, "\n"));
  }
  files["dawg/" + relative(root, p).split("\\").join("/")] = data;
};
for (const i of INCLUIR) {
  try {
    add(join(root, i));
  } catch {
    console.warn("No encontrado:", i);
  }
}
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`Listo: ${out} (${Object.keys(files).length} archivos). Súbelo al VPS y sigue DESPLIEGUE.md.`);
