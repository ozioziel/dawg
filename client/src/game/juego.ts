// Arranca Phaser con la partida ya conectada.
import mapa from "../../../maps/area1.json";
import { World, type TiledMap } from "@dawg/shared";
import Phaser from "phaser";
import { cliente, borrarReconexion, guardarReconexion, type SalaJuego } from "../net/conexion";
import type { GameStateS } from "../net/tipos";
import { Chat } from "../ui/chat";
import { h, limpiar, ui } from "../ui/dom";
import { ocultarFin } from "../ui/fin";
import type { Ctx } from "./contexto";
import { Carga } from "./escenas/Carga";
import { Hud } from "./escenas/Hud";
import { Mundo } from "./escenas/Mundo";
import { MgEsclusa } from "./minijuegos/MgEsclusa";
import { MgIdentidad } from "./minijuegos/MgIdentidad";
import { MgOrbe } from "./minijuegos/MgOrbe";
import { MgRayos } from "./minijuegos/MgRayos";
import { MgTuberias } from "./minijuegos/MgTuberias";

let juego: Phaser.Game | null = null;

export function iniciarJuego(room: SalaJuego, volverAlMenu: (msg?: string) => void): void {
  limpiar();
  const chat = new Chat(room);
  let saliendo = false;
  const c: Ctx = {
    room,
    chat,
    world: new World(mapa as unknown as TiledMap),
    ui: { mapaGrande: false, minijuego: "", prompt: "", pings: [] },
    salir: (msg?: string) => {
      saliendo = true;
      borrarReconexion();
      void room.leave(true);
      cerrar();
      volverAlMenu(msg);
    },
  };

  const cerrar = () => {
    ocultarFin();
    chat.destruir();
    juego?.destroy(true);
    juego = null;
  };

  juego = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "juego",
    backgroundColor: "#0b2328",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    fps: { target: 60 },
    disableContextMenu: true,
    scene: [Carga, Mundo, Hud, MgOrbe, MgIdentidad, MgTuberias, MgRayos, MgEsclusa],
    callbacks: { preBoot: (g) => g.registry.set("ctx", c) },
  });
  if (import.meta.env.DEV) (window as unknown as { juego: Phaser.Game }).juego = juego;

  // Reconexión si se corta la red
  room.onLeave(async (code) => {
    if (saliendo) return;
    if (code === 1000) {
      cerrar();
      volverAlMenu("La partida terminó.");
      return;
    }
    const aviso = h("div", { class: "conexion" }, "Conexión perdida… reconectando");
    ui().append(aviso);
    for (let i = 0; i < 8; i++) {
      try {
        const nueva = await cliente.reconnect<GameStateS>(room.reconnectionToken);
        aviso.remove();
        guardarReconexion(nueva);
        cerrar();
        iniciarJuego(nueva, volverAlMenu);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    aviso.remove();
    cerrar();
    borrarReconexion();
    volverAlMenu("Se perdió la conexión con la partida.");
  });
}
