FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY libs/shared/package*.json ./libs/shared/
COPY apps/web/package*.json ./apps/web/
RUN npm ci

COPY libs/shared/src ./libs/shared/src
COPY libs/shared/tsconfig.json ./libs/shared/
COPY apps/web ./apps/web

RUN npm run build --workspace=shared
RUN npm run build --workspace=web

FROM nginx:1.27-alpine AS production

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 80
