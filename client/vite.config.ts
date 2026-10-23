import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: el mismo build funciona en itch.io y en la página propia.
  base: "./",
  server: { port: 5173, host: true },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
});
