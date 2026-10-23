// Servidor de dawg: salas Colyseus + (opcional) la página del juego compilada.
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { existsSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";
import { CLIENTE_DIR, ORIGENES, PORT, jugadoresNecesarios } from "./config";
import { GameRoom } from "./rooms/GameRoom";
import { LobbyRoom } from "./rooms/LobbyRoom";

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ORIGENES.length === 0 || ORIGENES.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  next();
});

// Las peticiones de emparejamiento de Colyseus tienen su propio CORS: se limita igual.
if (ORIGENES.length) {
  matchMaker.controller.getCorsHeaders = (req) => {
    const origin = String(req.headers?.origin ?? "");
    return { "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0] };
  };
}

app.get("/salud", (_req, res) => {
  res.json({ ok: true, juego: "dawg", jugadoresNecesarios: jugadoresNecesarios() });
});

// Página propia: si existe el cliente compilado, se sirve en la misma dirección.
const clienteDir = CLIENTE_DIR ? resolve(CLIENTE_DIR) : "";
if (clienteDir && existsSync(clienteDir)) {
  app.use(express.static(clienteDir, { maxAge: "1h" }));
  console.log(`Sirviendo el juego desde ${clienteDir}`);
}

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server, pingInterval: 5000, pingMaxRetries: 3 }),
});

gameServer.define("lobby", LobbyRoom);
gameServer.define("partida", GameRoom);

gameServer.listen(PORT).then(() => {
  console.log(`dawg escuchando en el puerto ${PORT} (jugadores por sala: ${jugadoresNecesarios()})`);
});

const apagar = async () => {
  console.log("Apagando…");
  await gameServer.gracefullyShutdown(false);
  process.exit(0);
};
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
