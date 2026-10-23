// Empaqueta el servidor (incluye @dawg/shared y el mapa) en dist/index.js.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  tsconfig: "tsconfig.json",
  // Las dependencias reales se instalan en el contenedor; solo se empaqueta nuestro código.
  packages: "external",
  external: ["@colyseus/*", "express"],
  alias: { "@dawg/shared": "../shared/src/index.ts" },
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
});
console.log("Servidor empaquetado en server/dist/index.js");
