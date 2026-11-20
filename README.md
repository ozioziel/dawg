# dawg

De uno a cinco aliens escapan del **Área 51**. Juego web cooperativo en vista cenital, con servidor autoritativo y juego cruzado PC + móvil.

Esta es la **demo completa**: un único mapa continuo con tres sectores y tres jefes.

| Sector | Zona | Jefe |
|---|---|---|
| **I · Incubadoras** | Tutorial, cámaras del laboratorio y núcleo | Jefe de laboratorio |
| **II · Complejo de Xenogenética** | Centro de investigación con cinco salas | Centinela MK-II (se sobrecalienta: hay que enfriarlo) |
| **III · Protocolo de fuga** | Hangar con la gran compuerta de salida y crisis progresivas | Director Kessler · Exotraje OMEGA |

Solo se gana derrotando al tercer jefe **y** cruzando la compuerta.

## Los ocho aliens

Cada jugador elige un alien distinto (de 1 a 5 por partida).

| Alien | Ataque | Habilidad | Definitiva |
|---|---|---|---|
| **Cambiaformas** | Pistola robada | Escanear identidad (disfraz de un guardia) | Mutación Berserk |
| **Del Mar** | Lanza de energía | Transmutación (pulpos aliados y coberturas, máx. 3) | Ecosistema Mutante |
| **Telequinesis** | Rayo psíquico | Telequinesis (lanzar, mover y control mental) | Singularidad Psíquica |
| **Curandera** | Espinas orgánicas | Devorar y curar | Jardín Carnívoro |
| **Vesper** | Cuchillo | Paso sombrío | Eclipse (fuego amigo entre guardias) |
| **Freeze** | Lanzallamas de hielo | Muro de hielo | Cero Absoluto |
| **Escarabajo** | Mordida letal | Excavación (bajo tierra y túneles) | Túnel de Escape |
| **Simbionte** | Fragmentos parasitarios | Asimilación / órdenes a huéspedes | Fusión Colosal |

- **Retos por equipo:** cada sala recibe un reto elegido según los aliens presentes (catálogo de 218 combinaciones). Nunca se repite un reto en la misma partida, ninguno necesita un alien ausente y en solitario ninguno exige dos personas a la vez.
- **Almas:** si un alien cae, deja su alma. Un compañero la recoge (E), se transforma en él (Q) con su aspecto, arma, habilidad, definitiva y HUD, y puede pasarla (G). Al llegar al siguiente punto de control el caído revive y recupera su alma.
- **Mejoras temporales:** tres ramas por alien. La calidad depende de cómo juega el equipo (curar, proteger, controlar, apoyar, resolver retos, rescatar… no solo matar). Cada jugador elige la suya (7 8 9) y se pierden al reiniciar desde cero.
- **En solitario:** una reanimación de emergencia por sector; los enemigos escalan con el tamaño del equipo (cantidad, vida, ritmo, daño y tiempo de los retos).

## Controles

| PC | Acción |
|---|---|
| WASD / flechas | Moverse |
| Ratón | Apuntar 360° · clic izquierdo ataca |
| Espacio / clic derecho | Habilidad hacia el ratón (algunas se mantienen pulsadas) |
| R | Definitiva cuando está cargada |
| E | Interactuar · mantener para rescatar, nutrir, sabotear… |
| Q / G | Transformarte en el alma que llevas / pasarla al compañero más cercano |
| 7 8 9 | Elegir mejora |
| 1 2 3 4 | Pings: ¡Ayuda! · Aquí · ¡Defiendan! · Voy |
| Enter | Chat |
| M / H / N | Mapa grande / ayuda / sonido |

**Móvil (mejor en horizontal):** joystick izquierdo para moverse, joystick derecho para apuntar y atacar, y botones de habilidad, definitiva, E, forma, alma, ping, mapa, chat y mejora.

Al iniciar la página y al entrar en una partida aparece la pantalla de carga durante al menos cinco segundos y hasta que los recursos estén listos. Al recibir daño, un destello verde y una breve distorsión indican el impacto; la opción de movimiento reducido del dispositivo atenúa el efecto.

## Jugar en tu PC (desarrollo)

Necesitas **Node.js 20 o superior**.

```bash
npm install
npm run dev
```

- Abre http://localhost:5173.
- **Solo:** botón **JUGAR SOLO** → **EMPEZAR SOLO** → elige alien → **EMPEZAR SOLO**. No hace falta ninguna variable.
- **Con amigos (2–5):** **CREAR SALA**, comparte el código de 4 letras; los demás usan **UNIRSE**. Cada uno elige un alien distinto y marca listo; el anfitrión pulsa **EMPEZAR**.
- Si se corta la conexión o recargas la página, vuelves a la misma partida (tienes 60 s).

### Pruebas

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas automáticas del servidor (unas 360): planes de retos para los 218 equipos, que cada reto se puede resolver en cada sala, recorridos completos de los 3 sectores con 1 a 5 jugadores, almas y reanimación, combate, jefes y rendimiento |
| `npm run typecheck` | Revisa los tipos de TypeScript (shared, server y client) |
| `npm run prueba:bots -- ws://localhost:2567 30 5` | Partida real con 5 bots durante 30 s (el último número: de 1 a 5 bots) |
| `npm run prueba:bots -- ws://localhost:2567 300 ABCD 2` | 2 bots entran en tu sala `ABCD` (créala antes en el navegador) |

Variables solo para pruebas en tu PC (nunca en el servidor público):

| Variable | Para qué |
|---|---|
| `DIRECTOR_APAGADO=1` | Sin oleadas automáticas de enemigos |
| `PRUEBAS=1` | Activa el mensaje `dbg` (teletransporte, morir, resolver un reto…) |
| `JUGADORES_MINIMOS=N` | Obliga a esperar a N jugadores en las salas multijugador (por defecto 1) |

En PowerShell: `$env:PRUEBAS=1; npm run dev`. En cmd: `set "PRUEBAS=1" && npm run dev`.

## Estructura

```
shared/   reglas comunes: aliens, enemigos, catálogo de retos, mejoras, mundo y movimiento
server/   servidor Colyseus autoritativo: lobby, partida, IA, jefes, director, retos, almas y mejoras
          server/tests/  pruebas automáticas (node:test)
client/   juego en Phaser 3 + Vite: menú/lobby (HTML), mundo, HUD, minijuegos y controles táctiles
maps/     mapa del Área 51 (area51.json, formato Tiled) y su generador (generar-mapa.mjs)
deploy/   Docker + Caddy para el VPS, actualizar.sh y alternativa por HTTP
```

`maps/area1.json` y `maps/generar-area1.mjs` son el mapa de la demo anterior (solo el Área 1); el juego ya no los usa.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor (2567) + cliente (5173) con recarga automática |
| `npm run build` | Compila servidor y cliente para producción |
| `npm start` | Arranca el servidor compilado |
| `npm run build:itch` | Crea `dawg-itch.zip` para itch.io (usa `VITE_SERVER_URL`) |
| `npm run paquete:vps` | Crea `dawg-vps.zip` para subir al VPS |
| `npm run mapa` | Regenera `maps/area51.json` |
| `npm test` | Pruebas automáticas |
| `npm run typecheck` | Revisa los tipos de TypeScript |

## Publicar

La guía paso a paso (VPS con Docker + HTTPS con sslip.io + itch.io) está en **[DESPLIEGUE.md](DESPLIEGUE.md)**.
