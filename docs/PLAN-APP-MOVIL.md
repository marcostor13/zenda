# PLAN — App móvil Android/iOS (auditoría, correcciones y publicación)

> **Fecha:** 2026-09-02 · **Alcance:** `apps/web` (Angular + Capacitor 8), proyectos nativos `android/` e `ios/`.
> **Estado:** Olas 1–4 implementadas y verificadas. Ola 5 pendiente de credenciales de terceros.

---

## 1. Método

Auditoría estática del envoltorio nativo y de su acoplamiento con la web, contrastando
lo que el código Angular **usa** contra lo que los proyectos nativos **declaran**. La
mayoría de los fallos encontrados son de ese hueco: funcionalidad que existe en la web y
que en la app instalada no puede funcionar porque falta la declaración nativa que la
habilita. Ninguno da error en compilación y ninguno se ve en el navegador, que es por lo
que sobrevivieron.

Verificación: `tsc --noEmit`, `ng build`, `nest build`, `cap sync`, la suite de Jest
completa y `apksigner verify` sobre el APK generado.

---

## 2. Estado encontrado

### 2.1 Bloqueante de compilación

| # | Hallazgo | Efecto |
|---|---|---|
| **B1** | `values/colors.xml` no definía `colorPrimary`, `colorPrimaryDark` ni `colorAccent`, y `styles.xml` los referencia desde `AppTheme`. | **No se podía generar ningún APK.** El empaquetado de recursos fallaba. Alguien reescribió `colors.xml` para añadir el color de notificación y se llevó por delante los colores base del andamiaje. |

### 2.2 Permisos nativos ausentes

Los tres eran funcionalidad ya escrita en Angular que en la app instalada no podía ejecutarse.

| # | Hallazgo | Efecto |
|---|---|---|
| **P1** | `navigator.geolocation` se usa en `alojamiento-lista` y `explora-lista` ("cerca de mí"), pero no había permiso de ubicación en Android ni `NSLocationWhenInUseUsageDescription` en iOS. | Android: el botón no hacía nada, sin error. **iOS: el sistema mata el proceso** — la app se cierra sola al pulsarlo. |
| **P2** | Hay subida de imágenes en cuatro pantallas (`rs-image-upload`, wizard de reserva, seguros, ficha de comercio); faltaban `CAMERA`/`READ_MEDIA_IMAGES` y las claves `NSCamera*`/`NSPhotoLibrary*`. | Android: la opción "hacer foto" se cerraba sola. **iOS: cierre de la app** al elegir cámara o galería. |
| **P3** | Sin bloque `<queries>` (Android 11+). | Abrir un enlace externo, un `tel:` o un `mailto:` desde una ficha no hacía nada. |

### 2.3 Notificaciones push

| # | Hallazgo | Efecto |
|---|---|---|
| **N1** | `AppDelegate.swift` no implementaba `didRegisterForRemoteNotificationsWithDeviceToken` ni su pareja de error. | **Push completamente muertas en iOS.** APNs entrega el token sólo ahí. El plugin no falla ni avisa: `register()` se queda esperando un evento `registration` que nunca llega, el móvil jamás se da de alta en el API. Todo el resto de la cadena (servicio Angular, `push.controller` del API) estaba bien. |
| **N2** | Sin fichero de *entitlements*: ni `aps-environment` ni *associated domains*. | Sin `aps-environment`, APNs rechaza el registro aunque N1 esté resuelto. |
| **N3** | No hay `google-services.json`. | **Push muertas en Android.** Requiere proyecto Firebase (ver §5). |

### 2.4 Enlaces profundos

| # | Hallazgo | Efecto |
|---|---|---|
| **E1** | Android tiene su `intent-filter` con `autoVerify` y `MovilService.escucharEnlacesProfundos()` funciona; iOS no declaraba *associated domains*. | Universal links inoperativos en iOS: todo enlace a doogking.com abría Safari. |
| **E2** | Ni `assetlinks.json` (Android) ni `apple-app-site-association` (iOS) publicados en el dominio. | Sin ellos, Android pregunta con qué app abrir en vez de ir directo, e iOS no abre la app nunca. Ver §5. |

### 2.5 Diseño tipo app

| # | Hallazgo | Efecto |
|---|---|---|
| **D1** | `index.html` no llevaba `viewport-fit=cover`. | **Las 13 reglas `env(safe-area-inset-*)` que ya existían en el código devolvían 0 en iOS.** Las barras fijas (pie de reserva, aviso de sin conexión) quedaban bajo el notch y el indicador de inicio. El CSS era correcto; le faltaba el interruptor. |
| **D2** | `styles.scss` sin `overscroll-behavior`, `-webkit-tap-highlight-color`, `user-select` ni `touch-action`. | Rebote elástico al final del scroll, destello azul al tocar, menú de copiar al mantener pulsado, 300 ms de retardo en cada toque. Son los cuatro tics por los que una web dentro de un WebView se nota que es una web. |
| **D3** | Sin navegación inferior; sólo navbar superior heredada de la web. | En móvil la navegación vivía en el tercio de pantalla al que no llega el pulgar. |
| **D4** | Tipografías cargadas desde `fonts.googleapis.com` en `index.html` y `styles.scss`. | En la app instalada el primer arranque depende de la red para pintar texto. *(Pendiente, §5.)* |

### 2.6 Metadatos de tienda (iOS)

| # | Hallazgo | Efecto |
|---|---|---|
| **M1** | `UIRequiredDeviceCapabilities` = `armv7`. | Arquitectura de 32 bits retirada en iOS 11. **Apple rechaza el envío.** |
| **M2** | `CFBundleDevelopmentRegion` = `en` y sin `CFBundleLocalizations`, con la plataforma traducida a 8 idiomas UE. | El App Store la anunciaba como app sólo en inglés y `Locale.preferredLanguages` nunca devolvía el idioma del usuario. |

---

## 3. Implementado y verificado

### Ola 1 — Desbloquear la compilación
- **B1** · `values/colors.xml`: restaurados `colorPrimary` (#08258B), `colorPrimaryDark` (#00135D) y `colorAccent` (#FBAE17) con los valores de marca, más `doogking_splash`.

### Ola 2 — Permisos nativos
- **P1/P2/P3** · `AndroidManifest.xml`: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` (con `maxSdkVersion=32`, que es lo que Play exige), `uses-feature` opcionales de cámara y ubicación, y bloque `<queries>` para `https`/`tel`/`mailto`/cámara/galería.
- **P1/P2** · `Info.plist`: los cuatro textos de uso (ubicación, cámara, fototeca lectura y escritura), redactados para la revisión de Apple, más `NSAppTransportSecurity` explícito para que ningún `cap sync` reintroduzca `NSAllowsArbitraryLoads`.

### Ola 3 — Push y enlaces profundos
- **N1** · `AppDelegate.swift`: los dos *handlers* de APNs, publicando en `NotificationCenter` los eventos que espera el plugin de Capacitor.
- **N2/E1** · `App/App.entitlements` nuevo, con `aps-environment` y `applinks:doogking.com` / `applinks:www.doogking.com`; registrado en `project.pbxproj` (Debug y Release).
- **M1/M2** · `Info.plist`: `arm64`, región `es` y los 8 idiomas en `CFBundleLocalizations`.

### Ola 4 — Diseño tipo app
- **D1** · `index.html`: `viewport-fit=cover`. Activa de golpe las 13 reglas de *safe area* que ya existían. No se bloquea el zoom: quien necesita ampliar para leer debe poder.
- **D2** · `styles.scss`, sección *2b. APP NATIVA*: `overscroll-behavior`, `touch-action: manipulation` (quita el retardo y el zoom por doble toque, conserva el de pellizco), `tap-highlight` transparente y `user-select: none` — con excepciones para campos de formulario y la clase `.rs-seleccionable`, porque el código de reserva o un importe sí se copian. Y `font-size: max(16px, 1em)` en los campos, que es lo que evita que iOS amplíe la página al enfocar un `input`.
  Todo bajo `.dk-nativo`, clase que `MovilService` pone en `<html>` al arrancar: **en la web no se aplica nada de esto**, porque ahí estos comportamientos son los correctos.
- **D3** · `RsNavInferiorComponent` nuevo: barra de 4 pestañas, objetivos táctiles de 48 px, adaptada al indicador de inicio del iPhone. Las pestañas cambian según la sesión — sin sesión no ofrece rutas con guard (que acabarían en el login), y un comercio o un admin ven su panel en lugar de "mis reservas". Se esconde en fichas y en el proceso de pago, donde esas pantallas ya tienen su propia barra de acción: con las dos a la vez, una tapaba a la otra. El hueco inferior del contenido aparece y desaparece con ella.
  7 tests nuevos.

### Ola 5 — Firma y APK
- `android/.gitignore`: `*.jks`, `*.keystore` y `keystore.properties` **activados** (venían comentados, así que un keystore se habría subido al repositorio).
- `app/build.gradle`: `signingConfigs.release` leyendo `keystore.properties` fuera del repositorio. Si el fichero no está, el build no se rompe: avisa y sigue.
- Keystore de release generado: RSA 2048, validez 30 años, alias `doogking`.

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` (web) | Sin errores |
| `ng build` | Correcto |
| `nest build` + `libs/shared` | Correcto |
| `cap sync` (android + ios) | 6 plugins resueltos en ambas plataformas |
| Jest (suite completa) | **2776 pasan, 1 falla** |
| `gradlew assembleRelease` | BUILD SUCCESSFUL — 2 m 32 s |
| `apksigner verify` | Firmado, esquema v2, `CN=Doogking` |
| URL del API dentro del APK | `https://apizenda.marcostorresalarcon.com/api/v1` |

**El fallo de Jest es previo y ajeno a este trabajo.** Es
`AdminDashboardComponent › periodo del panel` y falla igualmente con el árbol limpio
(comprobado con `git stash`): la aserción compara una fecha local serializada a UTC
(`2026-03-31` contra `2026-04-01T04:59:59.000Z`), un fallo de zona horaria del propio
test. Queda anotado como deuda, no se ha tocado.

**iOS no se ha compilado.** Requiere macOS con Xcode; los cambios de esta entrega son de
configuración (`Info.plist`, *entitlements*, `pbxproj`) y de dos *handlers* en Swift.
Necesitan una pasada de compilación en un Mac antes de archivar (§5).

### APK generado

```
apps/web/android/app/build/outputs/apk/release/app-release.apk   8,3 MB
SHA-256 del certificado: 61b47d6ec1d165156674ae4e2a38b5b6b40e905f33d97ebda58a01a86930b6e3
```

---

## 5. Pendiente

Ordenado por lo que bloquea. Todo lo que queda depende de credenciales o de servicios de
terceros que no están en el repositorio.

### 5.1 Bloqueado por terceros

| # | Tarea | Qué desbloquea | Quién |
|---|---|---|---|
| **T1** | Crear proyecto Firebase para `com.doogking.app` y colocar `google-services.json` en `apps/web/android/app/`. | Push en Android (N3). El `build.gradle` ya lo detecta solo. | Cliente |
| **T2** | Subir la clave APNs (`.p8`) a Firebase y, al archivar, cambiar `aps-environment` a `production`. | Push en iOS. | Cliente |
| **T3** | Publicar `https://doogking.com/.well-known/assetlinks.json` con la huella SHA-256 del certificado (§4). | Que un enlace abra la app directa en Android, sin preguntar (E2). | Cliente |
| **T4** | Publicar `https://doogking.com/.well-known/apple-app-site-association` con `<TEAM_ID>.com.doogking.app`, servido como `application/json` y sin redirecciones. | Universal links en iOS (E2). | Cliente |
| **T5** | Compilar y archivar en macOS con Xcode; alta del *App ID* con las capacidades Push Notifications y Associated Domains. | Envío a App Store. | Cliente |

### 5.2 Mejoras identificadas, no bloqueantes

| # | Tarea | Motivo |
|---|---|---|
| **T6** | Autoalojar las tipografías (Plus Jakarta Sans, Inter, Montserrat) en `public/` y quitar el `@import` de `fonts.googleapis.com` de `styles.scss` e `index.html`. | D4: hoy el primer arranque de la app depende de la red para pintar texto. Además evita una petición a un tercero desde la app, que es lo que Apple pregunta en la revisión de privacidad. |
| **T7** | Capa `monochrome` en `mipmap-anydpi-v26/ic_launcher.xml`. | Iconos temáticos de Android 13+: sin ella, el icono no se adapta al color del sistema. |
| **T8** | Variantes nocturnas de la splash (`drawable-night-*` en Android, `dark` en `Splash.imageset`). | `assets/splash-dark.png` **ya existe y no se usa**: basta con regenerar con `@capacitor/assets`. |
| **T9** | Proceso de versionado: `versionCode`/`versionName` siguen en `1`/`1.0`. | Play rechaza dos subidas con el mismo `versionCode`. |
| **T10** | Escribir `DEPLOY-MOVIL.md`. | Está citado en tres comentarios del código (`capacitor.config.ts`, `preparar-movil.mjs`) y **no existe**. |
| **T11** | Revisar `android:allowBackup="true"`. | El backup automático puede restaurar la sesión (JWT) en otro dispositivo del mismo usuario. Decisión de producto, no fallo. |

---

## 6. Operativa

### Regenerar el APK firmado

```bash
bun run --cwd apps/web apk:release
```

Encadena `preparar-movil.mjs` → `ng build` → `cap sync` → `--verificar` → `assembleRelease`.
El paso `--verificar` existe porque cualquier `ng build` intermedio reescribe `public/env.js`
con la configuración de desarrollo y el `cap sync` siguiente se la llevaba al APK: ya
ocurrió una vez que un APK salió apuntando a `localhost`.

**Requiere JDK 17–21.** El JDK 23 del sistema no lo admite AGP 8.13; se compiló con el de
Android Studio:

```bash
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleRelease
```

### Keystore — copia de seguridad obligatoria

`apps/web/android/doogking-release.jks` y `apps/web/android/keystore.properties` están
fuera del repositorio a propósito y **no existen en ningún otro sitio**.

Es la identidad de Doogking en Google Play: una vez publicada la app, sólo se pueden subir
actualizaciones firmadas con esta misma clave. Si se pierde, no hay forma de recuperarla ni
de sustituirla — habría que publicar otra app, con otra ficha, y los usuarios instalados no
recibirían nunca más una actualización.

Guardar ambos ficheros en el gestor de secretos del cliente antes de seguir.
