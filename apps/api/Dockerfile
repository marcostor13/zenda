# Bun como gestor de paquetes; Node como runtime de nest build y de producción.
FROM node:20-alpine AS builder
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Todos los package.json del workspace: bun valida el lockfile contra el conjunto
# completo. --filter limita la instalación a los workspaces que usa esta imagen.
COPY package.json bun.lock ./
COPY libs/shared/package.json ./libs/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --filter=shared --filter=api

COPY libs/shared/src ./libs/shared/src
COPY libs/shared/tsconfig.json ./libs/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

RUN bun run --cwd libs/shared build
RUN bun run --cwd apps/api build

FROM node:20-alpine AS production
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NODE_ENV=production

# Todos los package.json del workspace: bun valida el lockfile contra el conjunto
# completo. --filter limita la instalación a los workspaces que usa esta imagen.
COPY package.json bun.lock ./
COPY libs/shared/package.json ./libs/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --production --filter=shared --filter=api

COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/main"]
