// Ayudas mínimas para construir la interfaz HTML.

document.documentElement.style.setProperty("--mano-icono", `url("${new URL("assets/ICONmano.png", document.baseURI).href}")`);

export const ui = (): HTMLElement => document.getElementById("ui")!;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | ((e: Event) => void)> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (typeof v === "boolean") {
      if (v) el.setAttribute(k, "");
    } else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function limpiar(): void {
  ui().replaceChildren();
}

export function conPortada(el: HTMLElement): HTMLElement {
  el.style.backgroundImage = "linear-gradient(180deg, rgba(5,12,20,.35), rgba(5,12,20,.88)), url(assets/portada.png)";
  el.style.backgroundSize = "cover, contain";
  el.style.backgroundPosition = "center, center";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundColor = "#050a07";
  return el;
}

export function guardarLocal(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento */
  }
}

export function leerLocal(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}
