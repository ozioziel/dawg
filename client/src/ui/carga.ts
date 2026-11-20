const pantalla = document.getElementById("pantalla-carga")!;
const mensaje = document.getElementById("carga-mensaje")!;
const volver = document.getElementById("carga-volver") as HTMLButtonElement;
let generacion = 0;
let inicio = 0;

export function mostrarCarga(): number {
  generacion++;
  inicio = performance.now();
  mensaje.textContent = "CARGANDO ARCHIVOS DEL ÁREA 51...";
  volver.hidden = true;
  volver.onclick = null;
  pantalla.classList.remove("oculta");
  return generacion;
}

export async function finalizarCarga(id: number): Promise<boolean> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, 5000 - (performance.now() - inicio))));
  if (id !== generacion) return false;
  pantalla.classList.add("oculta");
  return true;
}

export function cancelarCarga(id: number): void {
  if (id !== generacion) return;
  generacion++;
  pantalla.classList.add("oculta");
}

export function errorCarga(id: number, texto: string, accion: () => void): void {
  if (id !== generacion) return;
  mensaje.textContent = texto;
  volver.hidden = false;
  volver.onclick = accion;
}
