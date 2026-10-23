// Carga de sprites, casillas y mapa; luego arranca el mundo y el HUD.
import Phaser from "phaser";
import mapa from "../../../../maps/area1.json";
import { TITULO, ctx } from "../contexto";

export const ANIMS_DIRS = ["down", "up", "side"] as const;

interface Manifest {
  personajes: Record<string, { frame: number }>;
  objetos: Record<string, { w: number; h: number; frames: number }>;
}

export class Carga extends Phaser.Scene {
  constructor() {
    super("Carga");
  }

  preload(): void {
    const { width, height } = this.scale;
    const txt = this.add.text(width / 2, height / 2 - 30, "Cargando el Área 51…", { ...TITULO, fontSize: "42px" }).setOrigin(0.5);
    const barra = this.add.rectangle(width / 2 - 200, height / 2 + 20, 0, 18, 0x7dff6a).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2 + 20, 404, 22).setStrokeStyle(3, 0x0a0a0c);
    this.load.on("progress", (p: number) => (barra.width = 400 * p));
    this.load.on("complete", () => txt.setText("¡Listo!"));

    this.load.setPath("assets/");
    this.load.image("tiles", "tiles.png");
    this.load.tilemapTiledJSON("area1", mapa);
    // El manifiesto (generado junto con el arte) dice qué sprites hay y su tamaño.
    this.load.json("manifest", "manifest.json");
    this.load.once("filecomplete-json-manifest", (_k: string, _t: string, m: Manifest) => {
      for (const [name, info] of Object.entries(m.personajes)) {
        this.load.spritesheet(name, `personajes/${name}.png`, { frameWidth: info.frame, frameHeight: info.frame });
      }
      for (const k of ["cambiaformas", "cambiaformas_humano", "delmar", "inteligente"]) this.load.image(`retrato_${k}`, `personajes/retrato_${k}.png`);
      for (const [name, info] of Object.entries(m.objetos)) {
        if (info.frames > 1) this.load.spritesheet(name, `objetos/${name}.png`, { frameWidth: info.w, frameHeight: info.h });
        else this.load.image(name, `objetos/${name}.png`);
      }
    });
  }

  create(): void {
    // Animaciones de caminar: [paso1, quieto, paso2, quieto] por dirección.
    const m = this.cache.json.get("manifest") as Manifest;
    for (const name of Object.keys(m.personajes)) {
      ANIMS_DIRS.forEach((dir, d) => {
        this.anims.create({
          key: `${name}-${dir}-caminar`,
          frames: [1, 0, 2, 0].map((f) => ({ key: name, frame: d * 3 + f })),
          frameRate: name === "perro" ? 12 : 8,
          repeat: -1,
        });
      });
    }
    this.scene.start("Mundo");
    this.scene.launch("Hud");
    ctx(this).room.send("cargado");
  }
}
