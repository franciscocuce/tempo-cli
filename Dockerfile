# better-sqlite3 y @node-rs/argon2 traen binarios nativos: se compilan acá, con las
# herramientas de build, y la imagen final se queda solo con el resultado
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# primero los manifiestos y después el código: si solo cambia el código, docker reusa
# la capa de npm ci en vez de reinstalar todo
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
RUN npm ci --prefix dashboard
COPY dashboard ./dashboard
RUN npm run dashboard:build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    TEMPO_DATA_DIR=/data \
    TEMPO_HOST=0.0.0.0 \
    TEMPO_PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
# el server busca el dashboard en <módulo>/../../dashboard/dist, así que dist/ y dashboard/dist
# tienen que quedar hermanos igual que en el repo
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboard/dist ./dashboard/dist

# node:22 ya trae el usuario "node" sin privilegios; la base vive en un volumen aparte
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 3000

# /api/public/status es la única ruta que responde sin sesión, así que sirve de healthcheck
# sin abrir nada nuevo. Se usa el fetch global de node porque la imagen slim no trae curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.TEMPO_PORT+'/api/public/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js", "serve"]
