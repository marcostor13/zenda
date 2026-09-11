# Bun como gestor de paquetes; Node como runtime del build y de producción.
FROM node:20-alpine AS builder
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Todos los package.json del workspace: bun valida el lockfile contra el conjunto
# completo. --filter limita la instalación a los workspaces que usa esta imagen.
COPY package.json bun.lock ./
COPY libs/shared/package.json ./libs/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --filter=shared --filter=web

COPY libs/shared/src ./libs/shared/src
COPY libs/shared/tsconfig.json ./libs/shared/
COPY apps/web ./apps/web

RUN bun run --cwd libs/shared build
RUN bun run --cwd apps/web build

# ── Producción ────────────────────────────────────────────────────────────────
#
# Node, no nginx. La web pasó a renderizarse en el servidor porque los
# rastreadores de WhatsApp, Facebook y compañía no ejecutan JavaScript: con la
# SPA servida como ficheros estáticos, compartir la ficha de una residencia
# enseñaba el título y la descripción genéricos de la portada, y cualquier
# dirección inventada devolvía un 200 con la portada dentro en vez de un 404.
#
# Lo que hacía `nginx.conf` —cabeceras de caché, `env.js` sin guardar, el
# reparto de estáticos— lo hace ahora `src/server.ts`.
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
# Coolify enruta al puerto que declare la imagen; 4000 es el de `server.ts`.
ENV PORT=4000

# El build de servidor se empaqueta con sus dependencias dentro, así que en
# producción no hace falta ningún `node_modules`.
# `--chown=node`: el arranque reescribe `browser/env.js` con las variables del
# contenedor, y el proceso no corre como root.
COPY --from=builder --chown=node:node /app/apps/web/dist/web ./dist/web

# La configuración (URL del API, claves publicables) se inyecta al arrancar, no
# al construir: la misma imagen sirve para cualquier entorno.
COPY apps/web/docker-entrypoint.sh /entrypoint-doogking.sh
RUN chmod +x /entrypoint-doogking.sh

# No corre como root: el proceso sólo escribe `env.js` y lee lo ya construido.
USER node

EXPOSE 4000
ENTRYPOINT ["/entrypoint-doogking.sh"]
CMD ["node", "dist/web/server/server.mjs"]
