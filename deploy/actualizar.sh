#!/bin/sh
# Reconstruye y reinicia dawg con el código que hay en esta carpeta.
# Uso (en el VPS, dentro de la carpeta deploy):  sh actualizar.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Falta el archivo .env. Cópialo primero:  cp .env.example .env  (y edita tu IP)"
  exit 1
fi

echo "==> Construyendo la imagen nueva…"
docker compose build dawg

echo "==> Reiniciando (las partidas en curso se cortan)…"
docker compose up -d

echo "==> Limpiando imágenes viejas…"
docker image prune -f >/dev/null

echo "==> Estado:"
docker compose ps
echo
echo "Listo. Prueba: https://$(grep '^DOMINIO=' .env | cut -d= -f2)/salud"
