# dawg

Tres aliens escapan del **Área 51**. Juego web cooperativo **online para 3 jugadores**, en vista cenital, con estética de laboratorio caricaturesco.

Esta es la **demo del Área 1 (Incubadoras)**: tutorial, tres salas individuales, tres salas de dúo y el núcleo con el Jefe de laboratorio.

## Los aliens

| Alien | Arma | Habilidad (Espacio) |
|---|---|---|
| **Cambiaformas** | Pistola robada | **Disfraz**: los soldados no lo atacan. La barra se gasta mientras está activo y al recibir daño. |
| **Del mar** | Lanza de energía | **Transmutar**: convierte barriles, cajas y torretas en cobertura, y soldados en pulpos aliados. Máximo 3 a la vez. |
| **Inteligente** | Rayo psíquico | **Telequinesis**: lanza enemigos y objetos, y activa cosas a distancia. |

Si un alien cae, deja su **alma**. Cualquier compañero la recoge (E), gana sus habilidades (Q para cambiar) y hace los dos papeles. También puede pasársela a otro compañero (G).

## Controles

| Tecla | Acción |
|---|---|
| WASD | Moverse |
| Ratón | Apuntar 360° · clic izquierdo dispara · clic derecho = habilidad |
| Espacio | Habilidad hacia el ratón |
| E | Interactuar · mantener para rescatar a un compañero congelado o atrapado |
| Q / G | Cambiar de habilidad / pasar un alma |
| 1 2 3 4 | Pings: ¡Ayuda! · Aquí · ¡Defiendan! · Voy |
| Enter | Chat |
| M / H / N | Mapa grande / ayuda / sonido |

## Jugar en tu PC (desarrollo)

Necesitas **Node.js 20 o superior**.

```bash
npm install
npm run dev
```

- Abre http://localhost:5173 en **3 ventanas** del navegador: una crea la sala y las otras dos entran con el código.
- **Probar solo:** en PowerShell, `$env:JUGADORES_MINIMOS=1; npm run dev`. Para no tener enemigos, añade también `$env:DIRECTOR_APAGADO=1`.
- **Rellenar tu sala con 2 bots:** crea la sala en el navegador y, con el servidor encendido, ejecuta `npm run prueba:bots -- ws://localhost:2567 300 ABCD` (donde `ABCD` es el código).
- **Prueba automática con 3 bots:** `npm run prueba:bots`.

## Estructura

```
shared/   reglas comunes: aliens, enemigos, puzzles, mundo y movimiento (servidor + cliente)
server/   servidor Colyseus autoritativo: lobby, partida, IA, director de oleadas y puzzles
client/   juego en Phaser 3 + Vite: menú/lobby (HTML), mundo, HUD y minijuegos
maps/     mapa del Área 1 en formato Tiled (area1.json) y su generador
deploy/   Docker + Caddy para el VPS, actualizar.sh y alternativa con Nginx
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor (2567) + cliente (5173) con recarga automática |
| `npm run build` | Compila servidor y cliente para producción |
| `npm start` | Arranca el servidor compilado |
| `npm run build:itch` | Crea `dawg-itch.zip` para itch.io (usa `VITE_SERVER_URL`) |
| `npm run paquete:vps` | Crea `dawg-vps.zip` para subir al VPS |
| `npm run mapa` | Regenera `maps/area1.json` |
| `npm run typecheck` | Revisa los tipos de TypeScript |

## Publicar

La guía paso a paso (VPS con Docker + HTTPS con sslip.io + itch.io) está en **[DESPLIEGUE.md](DESPLIEGUE.md)**.
