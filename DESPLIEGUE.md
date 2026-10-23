# Despliegue de dawg (VPS + itch.io)

Guía paso a paso para poner el juego en línea. No hace falta saber de servidores: copia y pega los comandos.

- **El servidor del juego** va en el VPS (Ubuntu con Docker). También sirve la página del juego.
- **itch.io** solo aloja la página; el juego se conecta al VPS por `wss://`.
- Como el VPS no tiene dominio, usamos **sslip.io**: convierte tu IP en un nombre. Por ejemplo, la IP `203.0.113.25` se convierte en `203-0-113-25.sslip.io`. Con ese nombre se consigue un certificado HTTPS gratis.

> En todos los comandos, cambia `203-0-113-25` por **tu IP con guiones**.

---

## 0. Lo que necesitas

| Qué | Dónde |
|---|---|
| Acceso por SSH al VPS (usuario y contraseña o clave) | Te lo da tu amigo |
| Docker con `docker compose` | En el VPS (ya está instalado) |
| Node.js 20 o superior | En tu PC (para generar los paquetes) |
| Cuenta de itch.io | Tú la creas |

---

## 1. Preparar los paquetes (en tu PC)

En la carpeta del proyecto, abre una terminal (PowerShell):

```powershell
npm install
npm run paquete:vps
```

Se crea **`dawg-vps.zip`** en la raíz del proyecto: lleva el código y la configuración, pero no tus archivos privados.

---

## 2. Revisar el VPS (una sola vez)

Conéctate al VPS:

```powershell
ssh usuario@203.0.113.25
```

Ya dentro del VPS:

```bash
# ¿Funciona Docker?
docker compose version

# ¿Cuál es la IP pública? (para armar la dirección sslip.io)
curl -4 ifconfig.me

# ¿Hay algo usando los puertos 80 o 443?
sudo ss -tlnp | grep -E ':80 |:443 '
```

- Si el último comando **no muestra nada**, sigue la **opción A** (la más fácil).
- Si muestra algo (por ejemplo `nginx` o `apache`), el VPS ya tiene una web: sigue la **opción B**.

Abre los puertos en el firewall del VPS:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Si `ufw` dice que está inactivo, no pasa nada. **Importante:** muchos proveedores (Hetzner, DigitalOcean, OVH, Oracle…) tienen además un firewall en su panel web. Ahí también hay que permitir los puertos **80** y **443** (TCP).

Para que Docker arranque solo si el VPS se reinicia:

```bash
sudo systemctl enable docker
```

---

## 3. Subir el paquete

Desde **tu PC** (PowerShell, en la carpeta del proyecto):

```powershell
scp dawg-vps.zip usuario@203.0.113.25:~
```

En el **VPS**:

```bash
sudo apt-get install -y unzip
unzip -o dawg-vps.zip
cd dawg/deploy
cp .env.example .env
nano .env
```

En `nano`, cambia `203-0-113-25` por tu IP con guiones en las dos líneas, y deja el resto igual:

```
DOMINIO=203-0-113-25.sslip.io
ORIGENES_PERMITIDOS=https://html-classic.itch.zone,https://html.itch.zone,https://203-0-113-25.sslip.io
JUGADORES_MINIMOS=3
```

Guarda con `Ctrl+O` y `Enter`, y sal con `Ctrl+X`.

---

## 4A. Opción A — VPS sin otra web (recomendada)

Sigues dentro de `dawg/deploy`:

```bash
sh actualizar.sh
```

La primera vez tarda unos minutos porque construye la imagen. Esto levanta:

- **dawg**: el servidor del juego, que se reinicia solo si se cae.
- **caddy**: el HTTPS. Pide y renueva solo el certificado.

## 4B. Opción B — el VPS ya tiene Nginx

```bash
cd ~/dawg/deploy/solo-juego
docker compose up -d --build

# Configurar Nginx
sudo cp nginx-dawg.conf /etc/nginx/sites-available/dawg
sudo sed -i 's/TU-IP-CON-GUIONES/203-0-113-25/' /etc/nginx/sites-available/dawg
sudo ln -s /etc/nginx/sites-available/dawg /etc/nginx/sites-enabled/dawg
sudo nginx -t && sudo systemctl reload nginx

# Certificado HTTPS gratis
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 203-0-113-25.sslip.io
```

---

## 5. Comprobar que funciona

1. En el navegador, abre `https://203-0-113-25.sslip.io/salud`. Tiene que mostrar `{"ok":true,"juego":"dawg",...}`.
2. Abre `https://203-0-113-25.sslip.io`. Es tu **página propia**: el juego completo, servido desde el VPS.
3. Crea una sala y pasa el código a dos amigos. La partida empieza cuando los 3 están listos.

Para ver qué pasa en el servidor (en el VPS, dentro de `dawg/deploy`):

```bash
docker compose ps                 # ¿están "running"?
docker compose logs -f dawg       # mensajes del juego (Ctrl+C para salir)
docker compose logs caddy         # mensajes del certificado HTTPS
```

---

## 6. Publicar en itch.io

En **tu PC** (PowerShell, en la carpeta del proyecto), con tu IP:

```powershell
$env:VITE_SERVER_URL="wss://203-0-113-25.sslip.io"; npm run build:itch
```

Se crea **`dawg-itch.zip`**. Luego, en itch.io:

1. **Dashboard → Create new project**.
2. **Kind of project:** `HTML`.
3. **Uploads:** sube `dawg-itch.zip` y marca **"This file will be played in the browser"**.
4. **Embed options:**
   - Tamaño `1280 × 720`.
   - Activa **Fullscreen button**.
   - Activa **Click to launch in fullscreen** si quieres.
5. Para probar, deja **Visibility** en *Draft* o *Restricted*. Cuando funcione, pásalo a *Public*.
6. La portada para la página de itch está en `client/public/assets/portada_itch.png` (630×500).

Si cambias de IP o de servidor, repite este paso con la dirección nueva.

---

## 7. Actualizar a una versión nueva

1. En tu PC: `npm run paquete:vps` y sube el zip otra vez con `scp`.
2. En el VPS:

```bash
unzip -o dawg-vps.zip
cd dawg/deploy
sh actualizar.sh
```

El archivo `.env` no se pisa, así que tu configuración se mantiene. Las partidas que estén en curso se cortan.

Si cambiaste algo del juego, vuelve a generar también `dawg-itch.zip` (paso 6) y súbelo a itch.io.

---

## 8. Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| `/salud` no abre | Revisa los puertos 80/443 en el firewall del **panel del proveedor**. Mira `docker compose ps` y `docker compose logs dawg`. |
| Error de certificado / "no es seguro" | Mira `docker compose logs caddy`. Let's Encrypt limita cuántos certificados se emiten por semana para sslip.io; Caddy reintenta solo (también con ZeroSSL). Espera unos minutos. Si sigue fallando, usa un subdominio gratis de [DuckDNS](https://www.duckdns.org) y ponlo en `DOMINIO`. |
| En itch.io dice "No se pudo conectar con el servidor" | El zip se compiló sin `VITE_SERVER_URL` o con otra IP: repite el paso 6. Comprueba que `ORIGENES_PERMITIDOS` incluye `https://html-classic.itch.zone`. |
| `bind: address already in use` al levantar | Algo ya usa el puerto 80/443: usa la **opción B**. |
| La partida no empieza | Hacen falta **3 jugadores**, cada uno con un alien distinto y en "¡Listo!". |
| Un jugador se queda cargando | La partida espera hasta 45 s a que todos carguen y luego empieza igual. |
| Se cortó la conexión de alguien | Tiene 60 s para volver (recargar la página reconecta solo). Si no vuelve, su alien cae y deja su alma. |

---

## 9. Variables de entorno (archivo `.env`)

| Variable | Para qué |
|---|---|
| `DOMINIO` | Dirección sslip.io (o DuckDNS) para el HTTPS de Caddy. |
| `ORIGENES_PERMITIDOS` | Webs que pueden conectarse al juego, separadas por comas. Vacío = cualquiera. |
| `JUGADORES_MINIMOS` | Siempre `3` en el VPS. En tu PC se puede poner `1` para probar solo. |

Hay otras dos variables que **solo** sirven para pruebas en tu PC. **Nunca** las actives en el VPS:

- `PRUEBAS=1`: activa atajos de depuración.
- `DIRECTOR_APAGADO=1`: quita los enemigos.
