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

### 2.4 Dominio y SSL en Coolify

En la pestaña **Domains**:

1. Agrega `apizenda.marcostorresalarcon.com`.
2. Habilita **Generate SSL Certificate** (Let's Encrypt automático).
3. En tu proveedor DNS, crea un registro **A** o **CNAME** apuntando `apizenda.marcostorresalarcon.com` → IP de tu servidor Coolify.

### 2.5 Obtener el Webhook URL de Coolify

1. En la app de Coolify, ve a **Settings** → **Deploy Webhook**.
2. Copia la URL del endpoint de deploy (formato `https://localcoolify.marcostorresalarcon.com/api/v1/deploy?uuid=...&force=false`).
3. Guárdala como `COOLIFY_WEBHOOK_URL` en GitHub Secrets (§4).

> **La URL por sí sola no autoriza nada.** La API de Coolify autentica con la cabecera
> `Authorization: Bearer <API token>`, no con un token en la query string. Sin esa cabecera el
> endpoint responde **401** y el deploy no se encola. Genera el token en Coolify →
> **Keys & Tokens** → **API tokens** y guárdalo como `COOLIFY_TOKEN` en GitHub Secrets;
> `.github/scripts/coolify-deploy.sh` lo envía en cada llamada.

### 2.6 Primer deploy manual

Desde Coolify, haz clic en **Deploy** para verificar que el Docker build funciona antes de conectar GitHub Actions.

---

## 3. Frontend en Coolify

El frontend Angular se sirve como un **Docker build multi-stage**: `apps/web/Dockerfile`
compila la SPA con Node y la sirve con **nginx** (`apps/web/nginx.conf`), que además resuelve
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
| Port expuesto | `80` |

> Igual que la API: el Dockerfile vive en `apps/web/` pero el build context debe ser la raíz
> `/` para que Docker pueda copiar `libs/shared/`.

### 3.3 Variables de entorno

El frontend no necesita variables de entorno en runtime — la URL de la API se fija en build
time vía `apps/web/src/environments/environment.prod.ts` (ver §9). Si cambias el dominio del
backend, edita ese archivo y haz push; el pipeline reconstruye la imagen automáticamente.

### 3.4 Dominio y SSL en Coolify

En la pestaña **Domains**:

1. Agrega el dominio de la web (ej. `doogking.com` o `www.doogking.com`).
2. Habilita **Generate SSL Certificate** (Let's Encrypt automático).
3. En tu proveedor DNS, crea un registro **A** o **CNAME** apuntando ese dominio → IP de tu servidor Coolify.

### 3.5 Obtener el Webhook URL de Coolify

1. En la app de Coolify (la del frontend), ve a **Settings** → **Deploy Webhook**.
2. Copia la URL del endpoint de deploy.
3. Guárdala como `COOLIFY_WEBHOOK_URL_WEB` en GitHub Secrets (§4) — **distinto** del de la API.

> El `COOLIFY_TOKEN` de §2.5 es el mismo para ambos recursos: lo que cambia entre API y
> frontend es el `uuid` dentro de la URL, no el token.

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
| `COOLIFY_WEBHOOK_URL` | URL del endpoint de deploy de la **API** (paso 2.5) |
| `COOLIFY_WEBHOOK_URL_WEB` | URL del endpoint de deploy del **frontend** (paso 3.5) |
| `COOLIFY_TOKEN` | API token de Coolify (**Keys & Tokens** → **API tokens**). Común a los dos recursos; sin él ambos deploys fallan con 401 |

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
│   ├── GitHub Actions: npm test:api + npm build:api
│   └── Si pasan: POST webhook → Coolify redeploy API (Docker)
│
└── Cambios en apps/web/** o libs/shared/**
    ├── GitHub Actions: npm test:web + npm build:web
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

### El dominio devuelve 502 Bad Gateway

Un 502 significa que el proxy de Coolify (Traefik) tiene el dominio enrutado pero **no hay
contenedor sano detrás**. No es un problema de nginx ni del código Angular: la petición nunca
llega a la app. Por orden de probabilidad:

1. **El deploy nunca se ejecutó.** Mira el último run en GitHub Actions: si el step
   *Deploy … (Coolify webhook)* está en rojo, Coolify jamás recibió la orden y sigue sin
   imagen que levantar. Un `401` ahí significa `COOLIFY_TOKEN` ausente, inválido o caducado.
2. **El build falló en Coolify.** Abre el recurso → pestaña **Deployments** y revisa el log
   del último intento.
3. **Puerto mal configurado.** El contenedor del frontend escucha en el **80** (`EXPOSE 80` +
   `listen 80` en `nginx.conf`) y el de la API en el **3000**. Si el campo *Port* del recurso
   no coincide, Traefik enruta a un puerto muerto y devuelve 502.

Para desbloquear el sitio sin esperar al CI, pulsa **Deploy** manualmente en el recurso.

### El webhook de Coolify no dispara el deploy

- Un **401** es el fallo más común: la API de Coolify exige `Authorization: Bearer <token>` y
  no acepta el token en la query string. Comprueba que `COOLIFY_TOKEN` existe en GitHub
  Secrets y sigue vigente en Coolify → **Keys & Tokens** → **API tokens**.
- Un **404** suele ser un `uuid` que no corresponde al recurso: recopia la URL desde
  Coolify → **Settings** → **Deploy Webhook**.
- Verifica que `COOLIFY_WEBHOOK_URL` (API) o `COOLIFY_WEBHOOK_URL_WEB` (Web) no estén vacíos.
- El script `.github/scripts/coolify-deploy.sh` imprime el código HTTP y el cuerpo de la
  respuesta de Coolify en el log del job; empieza siempre por ahí.

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
