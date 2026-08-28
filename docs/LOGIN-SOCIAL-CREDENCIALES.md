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
**Sólo hay que configurarlo en el backend** (Coolify → Environment Variables):

```
GOOGLE_CLIENT_ID=XXXXXX.apps.googleusercontent.com
```

El frontend lo pide con `GET /auth/social/config` y dibuja el botón con ese
mismo valor, igual que hace con la clave de navegador del mapa. Así el `aud` del
token que emite Google y el que valida el API son el mismo por construcción.

`WEB_GOOGLE_CLIENT_ID` y lo escrito en `environment*.ts` quedan sólo como
respaldo por si el API no responde; no hace falta mantenerlos al día.

Admite **varios client IDs separados por comas** (el primero es el de la web; los
siguientes, los de la app móvil de Capacitor).

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
- **Backend** — variables de entorno (Coolify). El App ID también viaja al
  frontend por `GET /auth/social/config`:
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
| Backend (Coolify env) | `GOOGLE_CLIENT_ID` | Client ID de Google (público). Único sitio donde hay que ponerlo |
| Backend (Coolify env) | `FACEBOOK_APP_ID` | App ID de Meta (público) |
| Frontend (`environment*.ts`) | `googleClientId` · `facebookAppId` | Respaldo si el API no responde; no hay que mantenerlos |
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

Significa que el `aud` del ID token —el client ID con el que se dibujó el
botón— no coincide con el `GOOGLE_CLIENT_ID` del API.

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

Desde que el frontend pide los client IDs al API (`GET /auth/social/config`),
las dos partes no pueden divergir, así que sólo quedan dos causas:

| Causa | Cómo se ve | Qué hacer |
|---|---|---|
| `GOOGLE_CLIENT_ID` del API es de **otro cliente OAuth** del mismo proyecto —típicamente `GOOGLE_CALENDAR_CLIENT_ID`, que es el de la agenda— | El log del API dice `Token de Google con aud "…"; configurados: …` con dos valores `…apps.googleusercontent.com` de distinto prefijo numérico | Poner en `GOOGLE_CLIENT_ID` el cliente **web** del login y reiniciar el API |
| Una pestaña abierta desde antes del cambio sigue usando el client ID viejo | Falla en esa pestaña y no en una recién abierta | Recargar |

Cómo confirmarlo en 30 segundos:

1. `curl https://TU-API/api/v1/auth/social/config` → el client ID que el API
   sirve y valida. Es el mismo con el que el navegador dibuja el botón.
2. Si ahí no está el cliente web correcto, el arreglo está en Coolify →
   servicio del API → `GOOGLE_CLIENT_ID`, y hay que **reiniciar el servicio**.
3. El log del API deja la línea `Token de Google con aud "…"; configurados: …`
   al rechazar un token: da el valor recibido y el esperado de una vez.

Comprueba también, en Google Cloud → Credenciales → ese cliente OAuth, que
**Orígenes autorizados de JavaScript** incluye tu dominio (`https://doogking.com`,
`http://localhost:4200`). Sin eso el botón ni siquiera llega a dibujarse.

`GOOGLE_CLIENT_ID` admite **varios client IDs separados por comas**, que es como
convive la web con la app móvil de Capacitor:

```
GOOGLE_CLIENT_ID=123-web.apps.googleusercontent.com,456-android.apps.googleusercontent.com
```

El primero es el que se sirve al navegador. Los espacios alrededor de cada valor
se recortan. Tras cambiar la variable hay que **reiniciar el servicio del API**.

> Si en vez de 401 sale `503 El login con Google no está configurado`, es que
> `GOOGLE_CLIENT_ID` no está declarada en el API.
