# Guía de Despliegue — Reservalo

Backend en **Coolify** · Frontend en **AWS Amplify** · CI/CD con **GitHub Actions**

---

## Resumen de la arquitectura

```
GitHub (monorepo)
│
├── push a main (apps/api/** o libs/shared/**)
│   └── GitHub Actions → tests + build → webhook Coolify
│                                              └── Coolify builds Docker → despliega API
│
└── push a main (apps/web/** o libs/shared/**)
    └── GitHub Actions → tests + build → aws amplify start-job
                                              └── Amplify build → despliega Angular SPA
```

---

## 1. Prerrequisitos

| Herramienta | Uso |
|---|---|
| Coolify instalado en EC2/VPS | Hosting del backend NestJS |
| Cuenta AWS con acceso a Amplify | Hosting del frontend Angular |
| IAM User con permisos `amplify:StartJob` | GitHub Actions puede disparar builds |
| Dominio configurado en DNS | `api.zenda.pe` y `zenda.pe` (o los que uses) |

---

## 2. Backend en Coolify

### 2.1 Crear un nuevo Resource en Coolify

1. Entra a tu instancia de Coolify (`https://coolify.tudominio.com`).
2. Selecciona tu **Project** → **New Resource** → **Application**.
3. Elige **GitHub** como fuente y autoriza el acceso al repo `reservalo` (o como se llame).
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

1. Agrega `api.zenda.pe` (o el dominio que uses).
2. Habilita **Generate SSL Certificate** (Let's Encrypt automático).
3. En tu proveedor DNS, crea un registro **A** apuntando `api.zenda.pe` → IP de tu servidor Coolify.

### 2.5 Obtener el Webhook URL de Coolify

1. En la app de Coolify, ve a **Settings** → **Deploy Webhook**.
2. Copia la URL del webhook (tiene el formato `https://coolify.tudominio.com/api/v1/deploy/webhook?uuid=...&token=...`).
3. Guárdala — la usarás como secret en GitHub.

### 2.6 Primer deploy manual

Desde Coolify, haz clic en **Deploy** para verificar que el Docker build funciona antes de conectar GitHub Actions.

---

## 3. Frontend en AWS Amplify

### 3.1 Crear la app en AWS Amplify

1. Entra a la [consola de AWS Amplify](https://console.aws.amazon.com/amplify).
2. Selecciona tu región (ej. `us-east-1` o la más cercana a Perú: `sa-east-1`).
3. Haz clic en **Create new app** → **Host web app**.

### 3.2 Conectar GitHub

1. Selecciona **GitHub** como proveedor.
2. Autoriza AWS Amplify para acceder a tu repo.
3. Selecciona el repositorio y la rama **`main`**.
4. En la pregunta "Is this a monorepo?": selecciona **No** (usamos el `amplify.yml` en raíz, no la detección automática por subdirectorio).

### 3.3 Configurar el build

Amplify leerá automáticamente el archivo `amplify.yml` de la raíz del repositorio.

Verifica que en la pantalla de Build Settings aparezca:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 20
        - npm ci
    build:
      commands:
        - npm run build:web
  artifacts:
    baseDirectory: apps/web/dist/web/browser
    files:
      - '**/*'
```

Si no lo detecta automáticamente, pega el contenido del `amplify.yml` en el editor de Build Settings.

### 3.4 Variables de entorno en Amplify

En **Environment variables** dentro de la consola de Amplify:

```
AMPLIFY_MONOREPO_APP_ROOT=apps/web
```

> Esta variable indica a Amplify cuál es la carpeta raíz de la app, pero como usamos el `amplify.yml` en raíz con rutas absolutas, es solo referencial.

### 3.5 Configurar SPA Routing (Angular Router)

Angular usa HTML5 History API. Sin esta regla, un refresh en cualquier ruta que no sea `/` dará 404.

En Amplify Console → **Rewrites and redirects** → **Add rule**:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | **200 (Rewrite)** |

O de forma más sencilla:
| Source | Target | Type |
|---|---|---|
| `/<*>` | `/index.html` | **404 (Rewrite)** |

### 3.6 Dominio personalizado en Amplify

1. En Amplify Console → **Domain management** → **Add domain**.
2. Ingresa `zenda.pe` (o el dominio que uses).
3. Amplify provee registros DNS (CNAME o ALIAS) para agregar en tu proveedor.
4. SSL se configura automáticamente vía AWS Certificate Manager.

### 3.7 Obtener el App ID de Amplify

El App ID está en la URL de la consola:
`https://us-east-1.console.aws.amazon.com/amplify/apps/**d1xxxxxxx**/...`

También puedes verlo en **App settings** → **General** → **App ARN**.

---

## 4. IAM User para GitHub Actions

Crea un usuario IAM con permisos mínimos para disparar builds desde GitHub Actions.

### 4.1 Crear política IAM

En AWS IAM → **Policies** → **Create policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:StartJob",
        "amplify:GetJob",
        "amplify:ListJobs"
      ],
      "Resource": "arn:aws:amplify:*:*:apps/*/branches/main/jobs/*"
    }
  ]
}
```

Nómbrala `GitHubActions-AmplifyDeploy`.

### 4.2 Crear usuario IAM

1. IAM → **Users** → **Create user**.
2. Nombre: `github-actions-reservalo`.
3. Adjunta la política `GitHubActions-AmplifyDeploy`.
4. Crea **Access key** (tipo: Application running outside AWS).
5. Guarda el `Access Key ID` y `Secret Access Key`.

---

## 5. GitHub Secrets

En tu repositorio GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Valor |
|---|---|
| `COOLIFY_WEBHOOK_URL` | URL del webhook de Coolify (paso 2.5) |
| `AWS_ACCESS_KEY_ID` | Access Key ID del usuario IAM |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key del usuario IAM |
| `AWS_REGION` | Región de AWS donde creaste la app Amplify (ej. `us-east-1`) |
| `AMPLIFY_APP_ID` | App ID de Amplify (paso 3.7) |

---

## 6. Verificar el flujo completo

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

Repite con un cambio en `apps/web/` para verificar el deploy de Amplify.

### Verificar endpoints

```bash
# Backend
curl https://api.zenda.pe/api/v1/health

# Frontend
open https://zenda.pe
```

---

## 7. Flujo de CI/CD automático (resumen)

```
Developer → git push origin main
│
├── Cambios en apps/api/** o libs/shared/**
│   ├── GitHub Actions: npm test:api + npm build:api
│   └── Si pasan: POST webhook → Coolify redeploy (Docker)
│
└── Cambios en apps/web/** o libs/shared/**
    ├── GitHub Actions: npm test:web + npm build:web
    └── Si pasan: aws amplify start-job → Amplify build + deploy
```

**Pull Requests:** el workflow corre igualmente (sin el paso de deploy) para validar que los tests y el build pasan antes de mergear a `main`.

**Deploy manual:** desde GitHub → Actions → `CI/CD — Reservalo` → **Run workflow** (disparador `workflow_dispatch`).

---

## 8. Troubleshooting

### Docker build falla en Coolify

- Verifica que el build context sea `/` (raíz del repo), no `apps/api/`.
- Revisa los logs de Coolify — el error más común es que no encuentra `libs/shared`.
- Prueba localmente: `docker build -f apps/api/Dockerfile .` desde la raíz del monorepo.

### Amplify no encuentra el `amplify.yml`

- El archivo debe estar en la **raíz** del repositorio, no en `apps/web/`.
- Si Amplify muestra su build spec por defecto, edítalo manualmente en la consola y pega el contenido del `amplify.yml`.

### Angular Router devuelve 404 al refrescar

- Asegúrate de haber configurado la regla de rewrite en Amplify (paso 3.5).

### `aws amplify start-job` falla en GitHub Actions

- Verifica que los secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` y `AMPLIFY_APP_ID` estén correctamente configurados.
- Verifica que el usuario IAM tenga el permiso `amplify:StartJob`.

### El job de CI no se dispara al hacer push

- Asegúrate de que los archivos modificados estén bajo `apps/api/**`, `apps/web/**` o `libs/shared/**`.
- Cambios solo en archivos como `DEPLOY.md` o `.github/**` no disparan ningún job (correcto por diseño).
- Usa **workflow_dispatch** para forzar un run completo.

---

## 9. Variables de entorno del frontend

El archivo `apps/web/src/environments/environment.prod.ts` contiene la URL de la API:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.zenda.pe/api/v1',
};
```

Si cambias el dominio del backend, actualiza este archivo y haz push — el pipeline reconstruirá el frontend automáticamente.
