# Doogking móvil — Android e iOS

La app móvil es la **misma web de Angular** empaquetada con Capacitor. No hay
un segundo código base: lo que se arregla en la web se arregla en la app.

- `appId`: `com.doogking.app` — **no se puede cambiar** una vez publicada.
- `webDir`: `dist/web/browser` (salida del *application builder* de Angular).
- Configuración: `apps/web/capacitor.config.ts`.

---

## 1. Requisitos

| Para | Hace falta |
|---|---|
| APK de Android | JDK 21 y el SDK de Android (los trae Android Studio) |
| App de iOS | Un Mac con Xcode 15+ y cuenta de Apple Developer |

En este equipo el JDK 21 está en `C:\Program Files\Android\Android Studio\jbr`.

---

## 2. Generar el APK

```bash
bun run --cwd apps/web movil:sync     # build de Angular + copia a android/
cd apps/web/android
gradlew.bat assembleDebug             # -> app/build/outputs/apk/debug/app-debug.apk
```

Si Gradle no encuentra el SDK, `apps/web/android/local.properties` debe existir
con las barras **dobladas** (es un fichero de propiedades de Java):

```
sdk.dir=C\:\Users\TU_USUARIO\AppData\Local\Android\Sdk
```

### APK de publicación (firmado)

El de arriba es un APK de depuración: sirve para instalar y probar, **no para
publicar**. Para la Play Store hace falta un almacén de claves propio:

```bash
keytool -genkey -v -keystore doogking.keystore -alias doogking \
        -keyalg RSA -keysize 2048 -validity 10000
```

Guardarlo **fuera del repositorio** y sin perderlo: si se pierde, no se puede
volver a publicar una actualización de esa app nunca más. Luego se declara en
`android/app/build.gradle` (bloque `signingConfigs`) y se usa `assembleRelease`.

---

## 3. La URL del API

La app no habla con `localhost`: ahí no hay nada desde un móvil. La dirección
del API sale de `apps/web/public/env.js`, que se genera antes del build:

```bash
WEB_API_URL=https://apizenda.marcostorresalarcon.com/api/v1 bun run --cwd apps/web movil:sync
```

Para probar contra un API local desde un móvil de la misma red, usar la IP del
equipo (`http://192.168.1.50:3051/api/v1`) y poner `cleartext: true` en
`capacitor.config.ts` **sólo mientras se prueba**.

---

## 4. Notificaciones push

### 4.1 Qué hace falta en Firebase

La API antigua de FCM (la de la clave de servidor) **la apagó Google el
20/06/2024**. El servidor usa ahora la API HTTP v1, que va con cuenta de
servicio:

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com).
2. Añadir una app **Android** con el paquete `com.doogking.app`.
3. Descargar `google-services.json` y dejarlo en `apps/web/android/app/`.
   Sin ese fichero la app compila igual, pero no recibe push.
4. Configuración del proyecto → Cuentas de servicio → *Generar nueva clave
   privada*. Del JSON que descarga, al `.env` del API:

```
FCM_PROJECT_ID=...      # project_id
FCM_CLIENT_EMAIL=...    # client_email
FCM_PRIVATE_KEY="..."   # private_key, entre comillas y con los \n tal cual
```

Para iOS, además: subir la clave de APNs (`.p8`) a Firebase y añadir la app iOS
con el mismo paquete, descargando `GoogleService-Info.plist` a `ios/App/App/`.

### 4.2 Comprobar que funciona

`/admin/avisos` dice en la primera línea si el envío está operativo y cuántos
dispositivos hay registrados. Desde ahí se puede mandar una notificación de
prueba y ver cuántas se entregaron.

### 4.3 El permiso

En Android 13+ e iOS el permiso se pide **en tiempo de ejecución**, y el rechazo
es definitivo: sólo se revierte desde los ajustes del sistema. Por eso la app
**no lo pide al arrancar**, sino desde `PushRegistroService.solicitarPermiso()`,
cuando hay un motivo que enseñar (después de reservar, o desde el perfil).

---

## 5. Avisos automáticos

`/admin/avisos` → *Avisos automáticos*. Cada aviso lleva un disparador, un
segmento, un texto y una hora:

| Disparador | A quién le llega |
|---|---|
| Difusión | A todo el segmento elegido |
| Recordatorio de pago pendiente | Reservas sin pagar desde hace N días |
| Membresía a punto de vencer | Staff de comercios que caducan en N días |
| Reserva próxima | Clientes con una reserva dentro de N días |

Un barrido revisa cada minuto qué toca. Se guarda la hora (`HH:mm`) y no una
expresión cron: un administrador sabe decir "a las 10:00", y una expresión mal
escrita dejaría el aviso mudo sin avisar.

---

## 6. Enlaces profundos

Un enlace a `https://doogking.com/...` abre la app en esa pantalla. Para que
Android lo haga sin preguntar, hay que publicar en el dominio el fichero
`/.well-known/assetlinks.json` con la huella SHA-256 del certificado de firma:

```bash
keytool -list -v -keystore doogking.keystore -alias doogking
```

Sin ese fichero el enlace sigue funcionando, pero Android pregunta si abrirlo
con la app o con el navegador.

---

## 7. iOS

La plataforma ya está creada (`apps/web/ios`). En un Mac:

```bash
bun run --cwd apps/web movil:sync
cd apps/web/ios/App && open App.xcworkspace
```

En Xcode: elegir el equipo de firma, activar la capacidad *Push Notifications*
y *Background Modes → Remote notifications* (el `Info.plist` ya lo declara), y
archivar para subir a App Store Connect.

El icono de iOS va **sin transparencia y sin esquinas redondeadas**: el sistema
aplica su propia máscara, y App Store Connect rechaza un PNG con canal alfa.
