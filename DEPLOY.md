# Guía de Despliegue — Doogking

Backend en **Coolify** · Frontend en **Coolify** · CI/CD con **GitHub Actions**

---

## Resumen de la arquitectura

```
GitHub (monorepo)
│
├── push a main (apps/api/** o libs/shared/**)
│   └── GitHub Actions → tests + build → webhook Coolify (API)
│                                              └── Coolify builds Docker → despliega API
│
└── push a main (apps/web/** o libs/shared/**)
    └── GitHub Actions → tests + build → webhook Coolify (Web)
                                              └── Coolify builds Docker (nginx) → despliega Angular SPA
```

Ambas apps son **recursos Docker separados** dentro de la misma instancia de Coolify
(`https://localcoolify.marcostorresalarcon.com`), cada uno con su propio Dockerfile, dominio,
SSL y webhook de deploy.

---

## 1. Prerrequisitos

| Herramienta | Uso |
|---|---|
| Coolify instalado en EC2/VPS (`https://localcoolify.marcostorresalarcon.com`) | Hosting de backend y frontend |
| Dominio configurado en DNS | uno para la API, otro para la web (ver §2.4 y §3.4) |

---

## 2. Backend en Coolify

### 2.1 Crear un nuevo Resource en Coolify

1. Entra a `https://localcoolify.marcostorresalarcon.com`.
2. Selecciona tu **Project** → **New Resource** → **Application**.
3. Elige **GitHub** como fuente y autoriza el acceso al repo `zenda`.
4. Selecciona el repositorio y la rama **`main`**.

### 2.2 Configurar el build (Docker)

En la pestaña **Build**:

| Campo | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Dockerfile location | `apps/api/Dockerfile` |
| Docker build context | `/` (raíz del repo — necesario para incluir `libs/shared`) |
| Port expuesto | `3000` |

> El Dockerfile está en `apps/api/Dockerfile` pero el build context debe ser la raíz `/`
> para que Docker pueda copiar `libs/shared/`.

### 2.3 Variables de entorno en Coolify

En la pestaña **Environment Variables**, agrega:

```
PORT=3000
MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster.mongodb.net/zenda?retryWrites=true&w=majority
JWT_SECRET=<string-aleatorio-min-32-chars>
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
```

> Nunca pongas estos valores en el repositorio. Solo en Coolify.

Añade también `API_URL` con el dominio público del API
(`API_URL=https://apizenda.marcostorresalarcon.com`): es la base de los enlaces de
los callbacks de calendario **y de las URLs de las imágenes subidas** (§2.3.1).

#### 2.3.0 Mapas: dos claves de Google distintas

El mapa de resultados se pinta con **Google Maps** y necesita **dos** claves
separadas, creadas ambas en Google Cloud sobre el mismo proyecto:

```
GOOGLE_MAPS_API_KEY=<clave de servidor>
GOOGLE_MAPS_BROWSER_KEY=<clave de navegador>
```

| Variable | Quién la usa | Cómo restringirla en Google Cloud |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Solo el API (autocompletado de población, geocodificación y cálculo de trayectos). Nunca sale del servidor. | Restricción de aplicación: **direcciones IP** (o ninguna). Restricción de API: *Places API (New)* y *Routes API*. |
| `GOOGLE_MAPS_BROWSER_KEY` | El navegador, que la pide con `GET /api/v1/geo/config` para cargar el SDK del mapa. Es **pública por diseño**: aparece en la URL del script. | Restricción de aplicación: **sitios web**, con `https://doogking.com/*`, `https://www.doogking.com/*` y `http://localhost:4200/*`. Restricción de API: **solo** *Maps JavaScript API*. |

> No uses la misma clave para las dos cosas: la de servidor no lleva restricción
> de dominio, así que publicarla permitiría a cualquiera facturar Places contra
> la cuenta del proyecto.

Sin `GOOGLE_MAPS_BROWSER_KEY` la web **no se rompe**: los listados se siguen
viendo en el mapa, pero sobre teselas de OpenStreetMap en lugar de Google Maps.
Es el modo en el que arranca un entorno recién montado.

#### 2.3.1 Imágenes subidas (fotos de listados y de la mascota)

`POST /api/v1/upload/image` tiene dos modos y **no hace falta configurar nada** para
que funcione:

| Modo | Cuándo se usa | Dónde se guarda | URL devuelta |
|---|---|---|---|
| **GridFS** (por defecto) | Si falta cualquiera de las 4 variables de S3 | MongoDB Atlas, colección `uploads.*` | `{API_URL}/api/v1/upload/<id>` |
| **S3** | Con las 4 variables de S3 puestas | Bucket S3 | `{S3_PUBLIC_BASE_URL}/uploads/<uuid>.<ext>` o la URL directa del bucket |

Variables opcionales:

```
S3_REGION=eu-west-1
S3_BUCKET=doogking-uploads
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.doogking.com
```

> **Si usas S3, el bucket tiene que servir los objetos públicamente.** Desde 2023 los
> buckets nuevos de AWS bloquean el acceso público por defecto, así que la imagen se
> sube bien pero el `<img>` recibe un 403 y la foto no aparece. Dos salidas:
> a) política de bucket con `s3:GetObject` público sobre `uploads/*`, o
> b) servirlo por CloudFront/dominio propio y fijar `S3_PUBLIC_BASE_URL`.
>
> Si no quieres administrar un bucket, no pongas ninguna variable de S3: el modo
> GridFS guarda las imágenes en la misma base de datos y no requiere infraestructura
> adicional. `API_URL` sí debe estar bien puesta, porque de ahí sale la URL pública.

### 2.4 Dominio y SSL en Coolify

En la pestaña **Domains**:

1. Agrega `apizenda.marcostorresalarcon.com`.
2. Habilita **Generate SSL Certificate** (Let's Encrypt automático).
3. En tu proveedor DNS, crea un registro **A** o **CNAME** apuntando `apizenda.marcostorresalarcon.com` → IP de tu servidor Coolify.

### 2.5 Obtener el Webhook URL de Coolify

1. En la app de Coolify, ve a la pestaña **Webhooks**.
2. Copia la URL de **Deploy Webhook** — en esta instancia tiene el formato
   `https://localcoolify.marcostorresalarcon.com/api/v1/deploy?uuid=<uuid-del-recurso>&force=false`
   y está marcada como **"(auth required)"**: la URL sola no basta, hay que llamarla con un
   header `Authorization: Bearer <token>` (ver §2.5.1).
3. Guárdala como `COOLIFY_WEBHOOK_URL` en GitHub Secrets (§4).

### 2.5.1 Generar el API Token de Coolify (una sola vez, sirve para todos los recursos)

1. En Coolify → tu usuario/team → **Keys & Tokens** → **API tokens** → **Create New Token**.
2. Dale permiso de `deploy` (o `root`/`*` si tu versión no separa el scope).
3. Copia el token — Coolify solo lo muestra una vez.
4. Guárdalo como `COOLIFY_API_TOKEN` en GitHub Secrets (§4). El mismo token sirve para
   disparar el deploy de **cualquier** recurso (API y Web) — solo cambia el `uuid` en la URL.

### 2.6 Primer deploy manual

Desde Coolify, haz clic en **Deploy** para verificar que el Docker build funciona antes de conectar GitHub Actions.

---

## 3. Frontend en Coolify

El frontend Angular se sirve como un **Docker build multi-stage**: `apps/web/Dockerfile`
instala con **Bun** (`bun install --frozen-lockfile`), compila la SPA con Node y la sirve con **nginx** (`apps/web/nginx.conf`), que además resuelve
el ruteo de Angular Router (fallback a `index.html` en cualquier ruta que no sea un archivo real).

### 3.1 Crear un nuevo Resource en Coolify

1. Entra a `https://localcoolify.marcostorresalarcon.com`.
2. En el mismo **Project** que la API → **New Resource** → **Application**.
3. Elige **GitHub** como fuente, mismo repo `zenda`, rama **`main`**.

### 3.2 Configurar el build (Docker)

En la pestaña **Build**:

| Campo | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Dockerfile location | `apps/web/Dockerfile` |
| Docker build context | `/` (raíz del repo — necesario para incluir `libs/shared`) |
| Port expuesto (contenedor) | `80` |
| Ports Mapping (host) | `8085:80` — ver §3.4, es el puerto que espera el Cloudflare Tunnel |

> Igual que la API: el Dockerfile vive en `apps/web/` pero el build context debe ser la raíz
> `/` para que Docker pueda copiar `libs/shared/`.

### 3.3 Variables de entorno

El frontend no necesita variables de entorno en runtime — la URL de la API se fija en build
time vía `apps/web/src/environments/environment.prod.ts` (ver §9). Si cambias el dominio del
backend, edita ese archivo y haz push; el pipeline reconstruye la imagen automáticamente.

### 3.4 Dominio: Cloudflare Tunnel (no A/CNAME directo)

`doogking.com`, `doogking.eu` y `doogking.es` **no** usan un registro A/CNAME apuntando a la IP
del servidor — el servidor Coolify no expone IP pública directa para estos dominios. En su
lugar usan el **Cloudflare Tunnel `ai`** (`acb6beb0-5c3f-4de8-9293-47898fbee030`), el mismo
tunnel compartido que ya sirve `localcoolify.marcostorresalarcon.com`, `mayahelp`, etc. — un
solo `cloudflared` corriendo en el servidor enruta cada hostname a un puerto `localhost` distinto.

Ya está configurado (2026-07-28): el tunnel tiene reglas de ingress para `doogking.com`,
`doogking.eu` y `doogking.es` → `http://localhost:8085`. Lo único que falta del lado de
Coolify es que el recurso del frontend tenga **Ports Mapping = `8085:80`** (§3.2) para que algo
responda en ese puerto.

> Si en el futuro agregas otro dominio a este mismo servidor por Cloudflare Tunnel: Cloudflare
> dashboard → **Zero Trust** → **Networks** → **Tunnels** → `ai` → **Public Hostname** → añade
> el hostname con `service = http://localhost:<puerto-libre>`, y usa ese mismo puerto como
> Ports Mapping del recurso en Coolify. La API de Cloudflare (`cfd_tunnel/.../configurations`)
> también permite editarlo por API con un token con permiso `Account:Cloudflare Tunnel:Edit`.

### 3.5 Obtener el Webhook URL y el API Token de Coolify

1. En la app de Coolify (la del frontend), ve a la pestaña **Webhooks**.
2. Copia la URL de **Deploy Webhook** (formato `.../api/v1/deploy?uuid=...&force=false`,
   marcada **"(auth required)"**).
3. Guárdala como `COOLIFY_WEBHOOK_URL_WEB` en GitHub Secrets (§4) — **distinto** del webhook de la API.
4. El token Bearer (`COOLIFY_API_TOKEN`) es el mismo que generaste en §2.5.1 — no hace falta
   crear uno nuevo por recurso, sirve para cualquier `uuid`.

### 3.6 Primer deploy manual

Desde Coolify, haz clic en **Deploy** para verificar que el Docker build (Node → Angular →
nginx) funciona antes de conectar GitHub Actions. Verifica que al abrir la URL:
- Cargue el home.
- Navegar a una ruta interna (ej. `/perfil`) y refrescar la página **no** dé 404 (confirma que
  `nginx.conf` está resolviendo el fallback a `index.html`).

---

## 4. GitHub Secrets

En tu repositorio GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Valor |
|---|---|
| `COOLIFY_WEBHOOK_URL` | URL del webhook de Coolify de la **API** (paso 2.5) |
| `COOLIFY_WEBHOOK_URL_WEB` | URL del webhook de Coolify del **frontend** (paso 3.5) |
| `COOLIFY_API_TOKEN` | Token Bearer de Coolify (paso 2.5.1) — el mismo para API y Web |

> Los webhooks de Coolify en esta instancia requieren autenticación ("auth required"): la URL
> sola devuelve **401**. Hace falta llamarla con `Authorization: Bearer $COOLIFY_API_TOKEN` —
> ya está así en `.github/workflows/ci.yml`.

---

## 5. Verificar el flujo completo

### Primera verificación

```bash
# Haz un cambio pequeño en el backend
echo "# test" >> apps/api/README.md
git add apps/api/README.md
git commit -m "chore: test deploy pipeline"
git push origin main
```

Observa en **GitHub → Actions**:
1. El job `Detectar cambios` identifica que `api` cambió.
2. El job `API — CI + Deploy` corre tests → build → lanza el webhook de Coolify.
3. En Coolify, verás el deploy iniciarse automáticamente.

Repite con un cambio en `apps/web/` para verificar el deploy del frontend (mismo flujo, otro webhook).

### Verificar endpoints

```bash
# Backend
curl https://apizenda.marcostorresalarcon.com/api/v1/health

# Frontend
open https://doogking.com  # (el dominio que configures en Coolify, §3.4)
```

---

## 6. Flujo de CI/CD automático (resumen)

```
Developer → git push origin main
│
├── Cambios en apps/api/** o libs/shared/**
│   ├── GitHub Actions: bun run test:api + bun run build:api
│   └── Si pasan: POST webhook → Coolify redeploy API (Docker)
│
└── Cambios en apps/web/** o libs/shared/**
    ├── GitHub Actions: bun run test:web + bun run build:web
    └── Si pasan: POST webhook → Coolify redeploy Web (Docker: Node build + nginx)
```

**Pull Requests:** el workflow corre igualmente (sin el paso de deploy) para validar que los tests y el build pasan antes de mergear a `main`.

**Deploy manual:** desde GitHub → Actions → `CI/CD — Reservalo` → **Run workflow** (disparador `workflow_dispatch`).

---

## 7. Troubleshooting

### Docker build falla en Coolify (API o Web)

- Verifica que el build context sea `/` (raíz del repo), no `apps/api/` ni `apps/web/`.
- Revisa los logs de Coolify — el error más común es que no encuentra `libs/shared`.
- Prueba localmente desde la raíz del monorepo:
  ```bash
  docker build -f apps/api/Dockerfile .
  docker build -f apps/web/Dockerfile .
  ```

### Angular Router devuelve 404 al refrescar (frontend en Coolify)

- Revisa `apps/web/nginx.conf` — la directiva `try_files $uri $uri/ /index.html;` dentro de
  `location /` es la que resuelve el fallback. Si la editaste, confirma que sigue ahí.
- Verifica que el Dockerfile copie `nginx.conf` a `/etc/nginx/conf.d/default.conf` (no a otra ruta).

### El webhook de Coolify no dispara el deploy

- Verifica que `COOLIFY_WEBHOOK_URL` (API) o `COOLIFY_WEBHOOK_URL_WEB` (Web) estén
  correctamente configurados en GitHub Secrets — un secret vacío hace que `curl` reciba una
  URL vacía y falle.
- Confirma la URL copiándola de nuevo desde Coolify → pestaña **Webhooks**: puede regenerarse
  si cambia el `uuid` del recurso.
- **Error 401 (`curl: (22) ... returned error: 401`)**: falta o es inválido el header
  `Authorization: Bearer`. Verifica que `COOLIFY_API_TOKEN` esté seteado en GitHub Secrets y
  que el token siga activo en Coolify → **Keys & Tokens** → **API tokens**. Esta instancia
  marca los webhooks como "(auth required)", así que la URL sola nunca es suficiente.

### El job de CI no se dispara al hacer push

- Asegúrate de que los archivos modificados estén bajo `apps/api/**`, `apps/web/**` o `libs/shared/**`.
- Cambios solo en archivos como `DEPLOY.md` o `.github/**` no disparan ningún job (correcto por diseño).
- Usa **workflow_dispatch** para forzar un run completo.

---

## 8. Variables de entorno del frontend

El archivo `apps/web/src/environments/environment.prod.ts` contiene la URL de la API:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://apizenda.marcostorresalarcon.com/api/v1',
};
```

Si cambias el dominio del backend, actualiza este archivo y haz push — el pipeline reconstruirá el frontend automáticamente.
