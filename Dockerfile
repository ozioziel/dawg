# Imagen del servidor de dawg (incluye la página del juego compilada).
# Se construye desde la raíz del proyecto: docker build -t dawg .

# ---------- 1) Compilar ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY shared shared
COPY server server
COPY client client
COPY maps maps
RUN npm run build

# ---------- 2) Ejecutar ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    CLIENTE_DIR=/app/client/dist
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --no-audit --no-fund --workspace server --include-workspace-root=false \
    && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:2567/salud || exit 1
CMD ["node", "server/dist/index.js"]
