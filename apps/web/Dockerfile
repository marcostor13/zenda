# Bun como gestor de paquetes; Node como runtime del build de Angular.
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

FROM nginx:1.27-alpine AS production

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist/web/browser /usr/share/nginx/html

# La configuración (URL del API, claves publicables) se inyecta al arrancar, no
# al construir: la misma imagen sirve para cualquier entorno.
COPY apps/web/docker-entrypoint.sh /entrypoint-doogking.sh
RUN chmod +x /entrypoint-doogking.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint-doogking.sh"]
CMD ["nginx", "-g", "daemon off;"]
