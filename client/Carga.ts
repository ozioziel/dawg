// Carga de sprites, casillas y el mapa del Área 51; luego arranca el mundo y el HUD.
import Phaser from "phaser";
import { ALIEN_KINDS } from "@dawg/shared";
import mapa from "../../../../maps/area51.json";
import { TITULO, ctx } from "../contexto";

export const ANIMS_DIRS = ["down", "up", "side"] as const;

interface Manifest {
  /** Hojas animadas: `cols` cuadros por fila (abajo, arriba, lado) y los cuadros de cada acción. */
  personajes: Record<string, { frame: number; cols?: number; anims?: Record<string, number[]> }>;
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
    this.load.tilemapTiledJSON("area51", mapa);
    // El manifiesto (generado junto con el arte) dice qué sprites hay y su tamaño.
    this.load.json("manifest", "manifest.json");
    this.load.once("filecomplete-json-manifest", (_k: string, _t: string, m: Manifest) => {
      for (const [name, info] of Object.entries(m.personajes)) {
        this.load.spritesheet(name, `personajes/${name}.png`, { frameWidth: info.frame, frameHeight: info.frame });
      }
      // Miniaturas de 128 px para el HUD (los retratos grandes solo se usan en el lobby).
      for (const k of [...ALIEN_KINDS, "cambiaformas_humano"]) this.load.image(`retrato_${k}`, `personajes/mini_${k}.png`);
      for (const [name, info] of Object.entries(m.objetos)) {
        if (info.frames > 1) this.load.spritesheet(name, `objetos/${name}.png`, { frameWidth: info.w, frameHeight: info.h });
        else this.load.image(name, `objetos/${name}.png`);
      }
    });
  }

  create(): void {
    const m = this.cache.json.get("manifest") as Manifest;
    for (const [name, info] of Object.entries(m.personajes)) {
      const rapido = /perro|cazador|escarabajo|cria|dron/.test(name);
      const lento = /simbionte|coloso|centinela|kraken/.test(name);
      ANIMS_DIRS.forEach((dir, d) => {
        if (info.cols && info.anims) {
          // Hoja animada: una animación por acción y dirección.
          for (const [anim, cuadros] of Object.entries(info.anims)) {
            const fps: Record<string, number> = { quieto: lento ? 2.5 : 3, caminar: rapido ? 15 : lento ? 8 : 11, atacar: 16, habilidad: 11, golpe: 10 };
            this.anims.create({
              key: `${name}-${dir}-${anim}`,
              frames: cuadros.map((c) => ({ key: name, frame: d * info.cols! + c })),
              frameRate: fps[anim] ?? 10,
              repeat: anim === "quieto" || anim === "caminar" ? -1 : 0,
              yoyo: anim === "quieto",
            });
          }
          return;
        }
        // Hojas de 9 cuadros (arte del equipo): caminar = [paso1, quieto, paso2, quieto].
        this.anims.create({
          key: `${name}-${dir}-caminar`,
          frames: [1, 0, 2, 0].map((f) => ({ key: name, frame: d * 3 + f })),
          frameRate: rapido ? 13 : 8,
          repeat: -1,
        });
      });
    }
    this.scene.start("Mundo");
    this.scene.launch("Hud");
    ctx(this).room.send("cargado");
  }
}
