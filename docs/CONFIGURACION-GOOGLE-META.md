# Configuración en Google y Meta — dominios, orígenes y políticas

> **Fecha:** 2026-09-02 · **Para:** consola de Google Cloud y panel de desarrolladores de Meta.
> Todo lo de este documento se hace **fuera del repositorio**. Sin ello, el acceso con
> Google y con Meta no funciona dentro de la app, y el mapa se dibuja siempre con
> OpenStreetMap en lugar de Google Maps.

---

## 0. Datos de la app que te van a pedir

| Dato | Valor |
|---|---|
| ID de aplicación (Android e iOS) | `com.doogking.app` |
| Origen del WebView en la app | `https://localhost` |
| Dominio web | `doogking.com` / `www.doogking.com` |
| API | `https://apizenda.marcostorresalarcon.com/api/v1` |
| SHA-1 del certificado de firma | `2D:08:8D:C4:DC:CD:F4:1E:8B:52:DD:B2:AA:BA:70:F4:2D:15:8E:F9` |
| SHA-256 del certificado | `61:B4:7D:6E:C1:D1:65:15:66:74:AE:4E:2A:38:B5:B6:B4:0E:90:5F:33:D9:7E:BD:A5:8A:01:A8:69:30:B6:E3` |
| Key hash de Meta (Android, base64) | `LQiNxNzN9B6LUt2yqrpw9C0Vjvk=` |


Client ID: 492040502835-lebnm66cdi602q459d2gvppgv6nbqosb.apps.googleusercontent.com

> Las tres huellas salen del keystore de release (`doogking-release.jks`). Si algún día se
> firma con otra clave, hay que volver a calcularlas y actualizarlas en ambas consolas.
>
> **Si activas Play App Signing** (Google firma por ti al publicar), Play usa **otro**
> certificado distinto de éste. En ese caso hay que añadir *también* el SHA-1 que muestra
> Play Console → *Configuración → Integridad de la aplicación*, o el acceso con Google
> fallará sólo en la versión descargada de la tienda y funcionará en el APK que instales a
> mano. Es un fallo desconcertante y muy común.

**El origen `https://localhost` no es un error.** Es la dirección desde la que Capacitor
sirve la web dentro de la app, en Android y en iOS (fijado en `capacitor.config.ts` con
`androidScheme`/`iosScheme: 'https'`). Todo lo que valide dominios tiene que contemplarlo.

---

## 1. Google Cloud

### 1.1 Pantalla de consentimiento de OAuth

**APIs y servicios → Pantalla de consentimiento de OAuth**

| Campo | Valor |
|---|---|
| Tipo de usuario | Externo |
| Nombre de la aplicación | Doogking |
| Dominios autorizados | `doogking.com` |
| Enlace a la política de privacidad | `https://doogking.com/privacidad` |
| Enlace a las condiciones del servicio | `https://doogking.com/condiciones` |
| Ámbitos | `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` |

Las tres páginas **ya existen en la web** y están fuera del modo "muy pronto" a propósito,
justo para que Google y Meta puedan leerlas sin credenciales.

Mientras la app esté en *Prueba*, sólo entran los correos de la lista de usuarios de
prueba. Para abrirlo a clientes reales hay que pulsar **Publicar app**. Con estos tres
ámbitos (todos "no sensibles") **no hace falta pasar la verificación de Google**.

### 1.2 IDs de cliente OAuth — hacen falta **tres**

Ahora mismo sólo existe el de web. Es la causa de que el acceso con Google no funcione
en la app: Google Identity Services no está soportado dentro de un WebView.

**Credenciales → Crear credenciales → ID de cliente de OAuth**

#### a) Aplicación web — para doogking.com

- **Orígenes autorizados de JavaScript:**
  - `https://doogking.com`
  - `https://www.doogking.com`
  - `http://localhost:4200` *(desarrollo)*
- **URIs de redirección:** ninguna (se usa ID token, no redirección).

#### b) Android — para la app

- Tipo: **Android**
- Nombre del paquete: `com.doogking.app`
- Huella SHA-1: `2D:08:8D:C4:DC:CD:F4:1E:8B:52:DD:B2:AA:BA:70:F4:2D:15:8E:F9`

#### c) iOS — para la app

- Tipo: **iOS**
- ID del paquete: `com.doogking.app`

#### Dónde se ponen

En el backend (Coolify → *Environment Variables*), **los tres separados por comas**:

```
GOOGLE_CLIENT_ID=<web>.apps.googleusercontent.com,<android>.apps.googleusercontent.com,<ios>.apps.googleusercontent.com
```

El API ya admite varios: valida que el `aud` del token sea uno de ellos. El *client
secret* de Google no se usa en este flujo.

### 1.3 Clave de navegador de Maps — **hay que añadir un referrer**

Ésta es la causa de que el mapa salga siempre con OpenStreetMap en la app.

**Credenciales → la clave de `GOOGLE_MAPS_BROWSER_KEY` → Restricciones de aplicación → Sitios web**

Añadir a los que ya haya:

```
https://doogking.com/*
https://www.doogking.com/*
http://localhost:4200/*
https://localhost/*          ← NUEVO: la app de Android y iOS
```

Restricción de API: sólo **Maps JavaScript API**.

> Sin la última línea, Google rechaza la petición del mapa desde la app y el código cae a
> OpenStreetMap **en silencio**, sin ningún error visible. Por eso no se había detectado.
>
> Ten en cuenta que la restricción por referrer es débil por naturaleza (un referrer se
> falsifica). Si el gasto de Maps preocupa, la alternativa sólida es el SDK nativo de Maps
> con clave restringida por paquete y huella — pero eso es un cambio de código, no de
> consola. Deja también un presupuesto con alerta en *Facturación*.

### 1.4 Clave de servidor de Places — **no tocar**

`GOOGLE_MAPS_API_KEY` la usa el API para el autocompletado de direcciones. **El buscador
de direcciones ya funciona bien en la app**: el frontend no llama a Google, llama a
`/geo/autocomplete` del propio API y es el servidor quien habla con Places. Por eso no le
afecta ninguna restricción de navegador.

Mantén esta clave restringida a **Places API (New)** y, si puedes, por IP del servidor.
Nunca la pongas en `GOOGLE_MAPS_BROWSER_KEY`: acabaría publicada en el navegador y
cualquiera podría facturar Places contra ella.

### 1.5 Firebase — para las notificaciones push

Es un proyecto de Google aparte, ya recogido como T1/T2 en `PLAN-APP-MOVIL.md`:

1. Crear proyecto Firebase y añadir una app **Android** con `com.doogking.app` y el SHA-1.
2. Descargar `google-services.json` → `apps/web/android/app/`.
3. Añadir una app **iOS** con `com.doogking.app` y subir la clave **APNs `.p8`**
   (Configuración → Cloud Messaging).

---

## 2. Meta (Facebook)

**<https://developers.facebook.com/apps/>** → app de Doogking → producto **Inicio de sesión con Facebook**.

### 2.1 Configuración básica

| Campo | Valor |
|---|---|
| Dominios de la app | `doogking.com`, `www.doogking.com` |
| URL de la política de privacidad | `https://doogking.com/privacidad` |
| URL de eliminación de datos | `https://doogking.com/eliminar-datos` |
| Condiciones del servicio | `https://doogking.com/condiciones` |
| Categoría | Estilo de vida (o Mascotas) |

> Meta **exige** la URL de eliminación de datos antes de dejar publicar la app. Ya existe
> en la web (`/eliminar-datos`), igual que las otras dos.

### 2.2 Inicio de sesión con Facebook → Configuración

- **URI de redireccionamiento de OAuth válidos:**
  - `https://doogking.com/`
  - `https://www.doogking.com/`
- **Iniciar sesión con el SDK de JavaScript:** activado.
- **Dominios permitidos para el SDK de JavaScript:** `https://doogking.com`, `https://www.doogking.com`.

### 2.3 Plataformas de la app — añadir Android e iOS

**Configuración → Básica → + Añadir plataforma**

**Android:**

| Campo | Valor |
|---|---|
| Nombre del paquete | `com.doogking.app` |
| Nombre de la clase de actividad | `com.doogking.app.MainActivity` |
| Hashes de clave | `LQiNxNzN9B6LUt2yqrpw9C0Vjvk=` |

**iOS:**

| Campo | Valor |
|---|---|
| ID del paquete | `com.doogking.app` |

### 2.4 Permisos y revisión

Con `public_profile` y `email` **no hace falta revisión de app**: son permisos
concedidos por defecto. Sí hay que **cambiar la app de "Desarrollo" a "Activa"** (el
interruptor de arriba) para que entre alguien que no sea administrador o tester.

Meta pide además completar la **Verificación del negocio** para publicar. Prepara la
documentación de la empresa; suele ser lo que más tarda.

### 2.5 Variables en el backend

```
FACEBOOK_APP_ID=<id de la app>
FACEBOOK_APP_SECRET=<secreto>
```

---

## 3. Aviso importante: el acceso social **no funciona hoy dentro de la app**

La configuración de arriba es necesaria, pero **no es suficiente**. El código actual
(`social-sdk.service.ts`) implementa sólo el camino web:

- **Google** carga `accounts.google.com/gsi/client` y dibuja el botón oficial. Google
  Identity Services **no está soportado dentro de un WebView**, que es exactamente donde
  corre la app.
- **Meta** carga `connect.facebook.net/sdk.js` y llama a `FB.login()`, que abre una
  ventana emergente. En el WebView esa ventana no vuelve con la respuesta, y el origen
  `https://localhost` no es un dominio que se pueda registrar en Meta.

No hay ninguna comprobación de plataforma en ese servicio: la app ejecuta el mismo camino
que el navegador. En el móvil los botones aparecen y no completan el acceso.

**Lo que falta (cambio de código, no de consola):** instalar los plugins nativos
—`@codetrix-studio/capacitor-google-auth` y `@capacitor-community/facebook-login`— y
ramificar por `Capacitor.isNativePlatform()`, usando en la app los IDs de cliente de
Android/iOS de §1.2. El backend **ya está preparado**: acepta varios `GOOGLE_CLIENT_ID`.

Ese trabajo depende de que existan antes los IDs de esta guía, así que el orden es:
**primero la consola, después el código.**

Mientras tanto, decide qué prefieres para el APK que se reparta:

- **Dejarlo como está**: los botones se ven y no funcionan en el móvil.
- **Ocultarlos en la app**: el acceso con email y contraseña sigue intacto, y no se ofrece
  algo que no responde. Es un cambio de una línea.

---

## 4. Resumen de qué desbloquea cada cosa

| Configuración | Qué arregla | Bloquea a |
|---|---|---|
| §1.3 referrer `https://localhost/*` | El mapa deja de caer a OpenStreetMap en la app | Nada más; efecto inmediato |
| §1.2 b) y c) IDs Android/iOS | Acceso con Google en la app | Requiere después el plugin nativo |
| §2.3 plataformas Android/iOS | Acceso con Meta en la app | Requiere después el plugin nativo |
| §1.5 Firebase | Notificaciones push | `google-services.json` en el repo |
| §2.1 URL de eliminación de datos | Poder publicar la app de Meta | — |
| §1.1 política de privacidad | Poder publicar la pantalla de consentimiento | — |

**Lo único que ya funciona bien en la app sin tocar nada** es el autocompletado de
direcciones, porque va por el API y no por el navegador (§1.4).
