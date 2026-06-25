FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY libs/shared/package*.json ./libs/shared/
COPY apps/api/package*.json ./apps/api/
RUN npm ci

COPY libs/shared/src ./libs/shared/src
COPY libs/shared/tsconfig.json ./libs/shared/
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

RUN npm run build --workspace=shared
RUN npm run build --workspace=api

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY libs/shared/package*.json ./libs/shared/
COPY apps/api/package*.json ./apps/api/
RUN npm ci --omit=dev

COPY --from=builder /app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/main"]
