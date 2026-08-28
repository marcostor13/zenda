# Login social (Google y Meta) — cómo generar las credenciales

El código de acceso con Google y Meta ya está implementado. Solo falta
**rellenar las credenciales públicas** en el frontend y los **secretos** en el
backend. Mientras estén vacías, los botones sociales no se muestran y la app
sigue funcionando con email/contraseña.

---

## 1. Google

### 1.1 Crear el proyecto y la pantalla de consentimiento
1. Entra en <https://console.cloud.google.com/> con la cuenta del cliente.
2. Arriba, crea un proyecto (p. ej. **Doogking**) o selecciona uno existente.
3. Menú **APIs y servicios → Pantalla de consentimiento de OAuth**.
   - Tipo de usuario: **Externo** → *Crear*.
   - Nombre de la app: `Doogking`, correo de asistencia, logo (opcional).
   - Dominios autorizados: `marcostorresalarcon.com` (y tu dominio de web).
   - Ámbitos (scopes): añade `.../auth/userinfo.email`,
     `.../auth/userinfo.profile` y `openid`.
   - Guarda. Mientras esté en modo *Prueba*, añade tus emails como
     **usuarios de prueba**; para producción, pulsa **Publicar app**.

### 1.2 Crear el ID de cliente OAuth (Web)
1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**.
3. **Orígenes autorizados de JavaScript** (sin barra final):
   - `http://localhost:4200` (desarrollo)
   - `https://TU-DOMINIO-WEB` (producción; el dominio de Netlify o el propio)
4. **URIs de redirección autorizados**: *no hacen falta* — usamos Google
   Identity Services con ID token, no el flujo de redirección.
5. Crea y copia el **Client ID** (termina en `.apps.googleusercontent.com`).
   El *client secret* de Google **no se usa** en este flujo.

### 1.3 Configurar
- **Frontend** — `apps/web/src/environments/environment.ts` y
  `environment.prod.ts`:
  ```ts
  googleClientId: 'XXXXXX.apps.googleusercontent.com',
  ```
- **Backend** — variable de entorno (Coolify → Environment Variables):
  ```
  GOOGLE_CLIENT_ID=XXXXXX.apps.googleusercontent.com
  ```
  Debe ser **exactamente el mismo** que el del frontend: el backend valida que
  el token venga de este cliente.

---

## 2. Meta (Facebook)

### 2.1 Crear la app
1. Entra en <https://developers.facebook.com/apps/> con la cuenta del cliente
   (requiere una cuenta de desarrollador de Meta verificada).
2. **Crear app → Tipo: "Autenticar y solicitar datos con Facebook Login" /
   "Consumer"**. Nombre: `Doogking`.
3. En el panel de la app, añade el producto **Facebook Login → Web**.
   - *Site URL*: `https://TU-DOMINIO-WEB`.

### 2.2 Configurar Facebook Login
1. **Facebook Login → Configuración**:
   - **Valid OAuth Redirect URIs**: `https://TU-DOMINIO-WEB` (y
     `http://localhost:4200` para desarrollo).
   - Deja activado *Login with the JavaScript SDK* y añade los dominios en
     **Allowed Domains for the JavaScript SDK**.
2. **Configuración → Básica**: copia el **App ID** y el **App Secret**
   (pulsa *Mostrar*). Rellena *Política de privacidad* y *Categoría* (obligatorio
   para publicar).
3. Permisos: `public_profile` y `email` vienen por defecto. Para que usuarios
   fuera de tu lista de prueba puedan entrar, completa la **revisión de la app**
   y pásala a **modo Activo** (interruptor superior).

### 2.3 Configurar
- **Frontend** — `environment.ts` / `environment.prod.ts`:
  ```ts
  facebookAppId: '1234567890',
  ```
- **Backend** — variables de entorno (Coolify):
  ```
  FACEBOOK_APP_ID=1234567890
  FACEBOOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
  El **App Secret nunca va al frontend**: el backend lo usa para validar el
  token contra Meta (`debug_token`).

> Nota: Meta puede no compartir el email de algunas cuentas (login por
> teléfono, o si el usuario lo oculta). En ese caso el backend responde con un
> mensaje pidiendo usar Google o el correo; es el comportamiento esperado.

---

## 3. Resumen de variables

| Dónde | Variable | Valor |
|---|---|---|
| Frontend (`environment*.ts`) | `googleClientId` | Client ID de Google (público) |
| Frontend (`environment*.ts`) | `facebookAppId` | App ID de Meta (público) |
| Backend (Coolify env) | `GOOGLE_CLIENT_ID` | Igual que el del frontend |
| Backend (Coolify env) | `FACEBOOK_APP_ID` | Igual que el del frontend |
| Backend (Coolify env) | `FACEBOOK_APP_SECRET` | Secreto de Meta (**privado**) |

Tras rellenarlas y redeployar, los botones **"Continuar con Google"** y
**"Continuar con Meta"** aparecen automáticamente en `/auth/login` y
`/auth/registro`.

---

## 4. Cómo funciona (resumen técnico)

1. El usuario pulsa el botón → el SDK del proveedor devuelve un token al
   navegador (ID token de Google / access token de Meta).
2. El frontend lo envía a `POST /auth/google` o `POST /auth/facebook`.
3. El backend **verifica el token** contra el proveedor (firma, expiración,
   que pertenezca a nuestra app) y extrae email + nombre + foto.
4. Busca al usuario por email: si existe, vincula el proveedor; si no, crea una
   cuenta **cliente** sin contraseña. Devuelve **nuestro** JWT.
5. A partir de ahí, la sesión es idéntica a la de email/contraseña.

Las cuentas creadas solo con Google/Meta no tienen contraseña: si intentan
entrar por el formulario, el sistema les indica que usen el botón social.

---

## 5. Si el login con Google devuelve 401

```json
{
  "statusCode": 401,
  "message": "El acceso con Google no está bien configurado en este servidor: el token no corresponde a esta aplicación. No es un problema de tu cuenta."
}
```

No es un fallo de código ni un token caducado: el ID token que emitió el
navegador lleva en su campo `aud` el client ID con el que se dibujó el botón, y
ese valor **no coincide** con el `GOOGLE_CLIENT_ID` del API.

**No tiene que ver con la cuenta del usuario.** Si ya existe una cuenta con ese
email —creada con contraseña o con Meta— el login con Google **no falla**: el
API le vincula el proveedor y entra igual (`resolverCuentaSocial`). Además la
comprobación del `aud` ocurre *antes* de tocar la base de datos, así que el 401
sale exactamente igual con un email que nunca se ha registrado.

> El caso simétrico sí existe y es a propósito: quien se registró **solo** con
> Google o Meta y prueba el formulario de email recibe
> `Email o contraseña incorrectos`, el mismo mensaje que un email inexistente.
> Es deliberado —un mensaje distinto convertiría el login en un buscador de
> cuentas registradas—; la salida es pulsar el botón social, que está en la
> misma pantalla.

Cómo localizarlo:

1. **Qué client ID usa el navegador.** Abre `https://TU-DOMINIO/env.js` y mira
   `WEB_GOOGLE_CLIENT_ID`. Si no aparece, se está usando el respaldo compilado
   en `apps/web/src/environments/environment.prod.ts`.
2. **Qué client ID espera el API.** Coolify → servicio del API → Environment
   Variables → `GOOGLE_CLIENT_ID`.
3. **Compáralos carácter a carácter.** Desde la versión que registra el aviso,
   el log del API deja la línea al rechazar el token:
   `Token de Google con aud "…"; configurados: …`, que da los dos valores de
   una vez.

Causas habituales, en orden de frecuencia:

| Causa | Cómo se ve |
|---|---|
| El API tiene el client ID de **otro cliente OAuth** del mismo proyecto —típicamente `GOOGLE_CALENDAR_CLIENT_ID`, que es para la agenda | Los dos valores son `…apps.googleusercontent.com` pero con distinto prefijo numérico |
| Se creó un cliente OAuth nuevo y sólo se actualizó un lado | Igual que el anterior |
| El valor pegado en el panel arrastra espacios, comillas o un salto de línea | Los dos valores "parecen" iguales |
| La app móvil (Capacitor) usa su propio cliente de Android/iOS | Falla sólo en móvil, en web entra bien |

`GOOGLE_CLIENT_ID` admite **varios client IDs separados por comas**, que es como
se resuelve el último caso:

```
GOOGLE_CLIENT_ID=123-web.apps.googleusercontent.com,456-android.apps.googleusercontent.com
```

Los espacios alrededor de cada valor se recortan. Tras cambiar la variable hay
que **reiniciar el servicio del API** para que la lea.

> Si en vez de 401 sale `503 El login con Google no está configurado`, es que
> `GOOGLE_CLIENT_ID` no está declarada en el API.
