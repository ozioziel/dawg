import "./ui/estilos.css";
import { iniciarJuego } from "./game/juego";
import { intentarReconectar, type SalaJuego } from "./net/conexion";
import { errorCarga, finalizarCarga, mostrarCarga } from "./ui/carga";
import { mostrarMenu } from "./ui/menu";

const cargaInicial = mostrarCarga();
const empezar = (room: SalaJuego) => iniciarJuego(room, (msg) => mostrarMenu(empezar, msg));

async function arrancar(): Promise<void> {
  // Esperar a las fuentes para que Phaser dibuje los textos con ellas.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('32px "Bangers"'), document.fonts.load('700 16px "Chakra Petch"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* sin fuentes, se usa la del sistema */
  }
  const room = await intentarReconectar();
  if (room) empezar(room);
  else mostrarMenu(empezar);
}

void arrancar()
  .then(async () => {
    if (document.readyState !== "complete") {
      await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
    }
    await finalizarCarga(cargaInicial);
  })
  .catch((error: unknown) => {
    console.error("No se pudo iniciar el juego:", error);
    errorCarga(cargaInicial, "NO SE PUDO INICIAR EL JUEGO. RECARGA LA PÁGINA.", () => window.location.reload());
  });
