// Cuarto de espera: cada jugador mueve su alien dentro de un rectángulo del suelo antes de empezar.
import { ALIENS, LOBBY_BOUNDS, isAlienKind } from "@dawg/shared";
import type { SalaLobby } from "../net/conexion";
import { h } from "./dom";

const VEL_X = 0.3;
const VEL_Y = 0.2;
const FRAMES = 9;
const PASOS = [1, 0, 2, 0];
const ENVIO_MS = 60;

type Dir = "down" | "up" | "side";

interface Figura {
  el: HTMLElement;
  cuerpo: HTMLElement;
  etiqueta: HTMLElement;
  kind: string;
  x: number;
  y: number;
  dir: Dir;
  izq: boolean;
  mov: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function crearCuarto(room: SalaLobby): { el: HTMLElement; destroy: () => void } {
  const capa = h("div", { class: "cuarto-capa" });
  const el = h(
    "div",
    { class: "cuarto" },
    h("img", { class: "cuarto-fondo", src: "assets/cuarto_espera.png", alt: "Cuarto de espera", draggable: "false" }),
    capa,
  );

  const figuras = new Map<string, Figura>();
  const teclas = new Set<string>();
  let activo = true;
  let ultimo = performance.now();
  let ultimoEnvio = 0;
  let enviado = { x: -1, y: -1 };

  const onDown = (e: KeyboardEvent) => {
    if (!/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/.test(e.code)) return;
    e.preventDefault();
    teclas.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => teclas.delete(e.code);
  const onBlur = () => teclas.clear();
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);

  const destroy = () => {
    activo = false;
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
  };

  const crearFigura = (kind: string, alien: string, nombre: string, propio: boolean, x: number, y: number): Figura => {
    const cuerpo = h("div", { class: "cuarto-cuerpo" });
    cuerpo.style.backgroundImage = `url(assets/personajes/${kind}.png)`;
    const etiqueta = h("span", { class: `cuarto-nombre ${propio ? "propio" : ""}` }, nombre);
    if (isAlienKind(alien)) etiqueta.style.color = ALIENS[alien].colorCss;
    const fig = h("div", { class: "cuarto-figura" }, etiqueta, cuerpo);
    capa.append(fig);
    return { el: fig, cuerpo, etiqueta, kind, x, y, dir: "down", izq: false, mov: false };
  };

  const pintar = (f: Figura, t: number) => {
    const ancho = el.clientWidth || 600;
    const prof = (f.y - LOBBY_BOUNDS.minY) / (LOBBY_BOUNDS.maxY - LOBBY_BOUNDS.minY);
    const lado = ancho * (0.13 + 0.06 * clamp(prof, 0, 1));
    const base = f.dir === "down" ? 0 : f.dir === "up" ? 3 : 6;
    const frame = base + (f.mov ? PASOS[Math.floor(t / 125) % PASOS.length]! : 0);
    f.el.style.left = `${f.x * 100}%`;
    f.el.style.top = `${f.y * 100}%`;
    f.el.style.zIndex = String(Math.round(f.y * 1000));
    f.cuerpo.style.width = `${lado}px`;
    f.cuerpo.style.height = `${lado}px`;
    f.cuerpo.style.backgroundPosition = `${(frame / (FRAMES - 1)) * 100}% 0`;
    f.cuerpo.style.transform = f.dir === "side" && f.izq ? "scaleX(-1)" : "none";
  };

  const tick = (ahora: number) => {
    if (!activo) return;
    if (!el.isConnected) {
      destroy();
      return;
    }
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const st = room.state;
    const vistos = new Set<string>();

    st?.jugadores?.forEach((p, id) => {
      if (!p.alien) return;
      vistos.add(id);
      const propio = id === room.sessionId;
      let f = figuras.get(id);
      const sprite = p.skin ? `skin${p.skin}${p.alien}` : p.alien;
      if (f && f.kind !== sprite) {
        f.el.remove();
        figuras.delete(id);
        f = undefined;
      }
      if (!f) {
        f = crearFigura(sprite, p.alien, propio ? `${p.nombre} (tú)` : p.nombre, propio, p.x, p.y);
        figuras.set(id, f);
      }
      f.etiqueta.textContent = propio ? `${p.nombre} (tú)` : p.nombre;
      f.etiqueta.classList.toggle("listo", p.listo);

      if (propio) {
        const dx = (teclas.has("KeyD") || teclas.has("ArrowRight") ? 1 : 0) - (teclas.has("KeyA") || teclas.has("ArrowLeft") ? 1 : 0);
        const dy = (teclas.has("KeyS") || teclas.has("ArrowDown") ? 1 : 0) - (teclas.has("KeyW") || teclas.has("ArrowUp") ? 1 : 0);
        const libre = st.estado === "esperando";
        f.mov = libre && (dx !== 0 || dy !== 0);
        if (f.mov) {
          const n = Math.hypot(dx, dy);
          f.x = clamp(f.x + (dx / n) * VEL_X * dt, LOBBY_BOUNDS.minX, LOBBY_BOUNDS.maxX);
          f.y = clamp(f.y + (dy / n) * VEL_Y * dt, LOBBY_BOUNDS.minY, LOBBY_BOUNDS.maxY);
          if (dx !== 0) {
            f.dir = "side";
            f.izq = dx < 0;
          } else f.dir = dy < 0 ? "up" : "down";
          if (ahora - ultimoEnvio > ENVIO_MS && (Math.abs(f.x - enviado.x) > 0.002 || Math.abs(f.y - enviado.y) > 0.002)) {
            room.send("mover", { x: f.x, y: f.y });
            enviado = { x: f.x, y: f.y };
            ultimoEnvio = ahora;
          }
        }
      } else {
        const ddx = p.x - f.x;
        const ddy = p.y - f.y;
        f.mov = Math.hypot(ddx, ddy) > 0.004;
        if (f.mov) {
          if (Math.abs(ddx) > Math.abs(ddy)) {
            f.dir = "side";
            f.izq = ddx < 0;
          } else f.dir = ddy < 0 ? "up" : "down";
        }
        const k = Math.min(1, dt * 10);
        f.x += ddx * k;
        f.y += ddy * k;
      }
      pintar(f, ahora);
    });

    for (const [id, f] of figuras) {
      if (vistos.has(id)) continue;
      f.el.remove();
      figuras.delete(id);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return { el, destroy };
}
