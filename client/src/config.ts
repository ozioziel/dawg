// Dirección del servidor de juego.
// - En itch.io se fija al compilar: VITE_SERVER_URL=wss://1-2-3-4.sslip.io npm run build:itch
// - Si la página la sirve el propio servidor (VPS), usa la misma dirección.
// - En desarrollo local (npm run dev), el servidor está en el puerto 2567.
// - Para probar otro servidor sin recompilar: ?servidor=wss://... en la URL.
function serverUrl(): string {
  const forced = new URLSearchParams(location.search).get("servidor");
  if (forced) return forced;
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  if (import.meta.env.DEV) return `ws://${location.hostname || "localhost"}:2567`;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
}

export const SERVER_URL = serverUrl();
