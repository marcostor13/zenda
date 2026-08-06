# Plan — Tickets MayaHelp (export 2026-08-05)

Verificación del estado real en código de los 6 tickets exportados desde MayaHelp
(TCK-8004, TCK-8008, TCK-8009, TCK-8010, TCK-8011, TCK-8012) y plan para cerrarlos todos.

> **Nota sobre los adjuntos:** las capturas alojadas en
> `r2.mayahelp.marcostorresalarcon.com` no se pudieron descargar desde este entorno
> (la política de red del contenedor devuelve `403` en el CONNECT del proxy). La
> verificación se ha hecho sobre el código y los `.md` de planes anteriores; los puntos
> que dependen de ver la captura están marcados como **[requiere captura]**.

---

## 1. Resumen del estado

| Ticket | Tema | Estado real |
|---|---|---|
| **TCK-8004** | Landing "Muy pronto" | ✅ **Implementado** (commit `5282789`) |
| **TCK-8008** | Iconos oficiales en lugar del nombre | ✅ **Resuelto** — redes en `931dbb7`, marcas de pago en T1 |
| **TCK-8009** | "Garantía Doogking" con iconos y orden | ✅ **Implementado** (commit `931dbb7`) |
| **TCK-8010** | Iconografía Lucide en toda la plataforma, sin emojis | ✅ **Resuelto** — ver §3 T2 (hecho) |
| **TCK-8011** | Programa Doogking Alpha premium | ✅ **Implementado** (commit `931dbb7`); el emoji residual del navbar se retiró en T2 |
| **TCK-8012** | La foto del perro no sale al registrarlo | ✅ **Resuelto** — ver §3 T3 (hecho) |

Estado de los planes `.md` anteriores: los 12 bloques de `docs/PLAN-NEW-CHANGES-27-07.md`,
`docs/PLAN-UNIFICADO-REVISION-Y-MODULOS.md` y `docs/PLAN-MEJORAS-TODA-LA-APP.md` figuran
como completados y se han verificado por muestreo en código. De
`docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md` quedaban 4 items marcados `[ ]`; tres ya
estaban implementados y se han marcado como hechos. El único que sigue abierto es la
prueba manual end-to-end con Stripe en modo test, que necesita el stack levantado y
claves de test.

---

## 2. Verificación ticket a ticket

### TCK-8004 — Landing de prelanzamiento ✅

`apps/web/src/app/features/proximamente/proximamente.component.ts` cubre los 6 puntos
del ticket más el extra pedido:

| Petición del ticket | Dónde está |
|---|---|
| "MUY PRONTO" pasa desapercibido → "Estamos preparando algo muy grande" | `pm__badge` con icono `rocket` |
| Texto central más aspiracional | `pm__lead`, con el texto ampliado a "todo lo que tu mascota necesita" (incluye la corrección final del ticket sobre no limitarlo a perros) |
| Generar ilusión con 3 líneas de valor | `pm__ventajas` (`ventajas`) |
| Iconos con etiqueta debajo | `pm__grid` → `servicios` con `label` por categoría |
| Aprovechar el fondo azul inferior | `pm__cta`: captura de email (`ListaEsperaService` → `POST /lista-espera`, módulo `apps/api/src/core/lista-espera`) + bloque de redes |
| Elemento de confianza antes del pie | `pm__confianza`: "La plataforma donde propietarios y profesionales se encuentran con total confianza." |
| Contador visual de servicios (residencias, hoteles, veterinarios, peluquerías, transporte, adiestradores, seguros, explora) | rejilla `servicios` |

**Acción:** ninguna. Solo confirmar con la clienta y cerrar el ticket.

### TCK-8009 — "Garantía Doogking" ✅

`apps/web/src/app/shared/components/trust-block/rs-trust-block.component.ts`:

- Los 8 checks están en el **orden exacto** pedido por la clienta (verificada → pago
  seguro → confirmación inmediata → reseñas → sin cargos ocultos → cancelación →
  atención al cliente → soporte antes/durante/después).
- Cada check usa `rs-icon` (vectorial), no emoji: `badge-check`, `lock`, `zap`, `star`,
  `credit-card`, `calendar`, `headphones`, `handshake`.
- Título renombrado a **"Garantía Doogking"** (la favorita de la clienta) en
  `alojamiento-detalle.component.ts:120` y `vertical-detalle.component.ts:168`.
- Cubierto por tests (`rs-trust-block.component.spec.ts`: orden + ausencia de emojis).

**Acción:** ninguna.

### TCK-8011 — Programa Doogking Alpha ✅

`apps/web/src/app/features/perfil-usuario/perfil-alpha.component.ts` +
`libs/shared/src/constants.ts`:

- Título "Programa Doogking Alpha" + eyebrow "Club exclusivo" con icono `crown`.
- Numeración romana **ALPHA I / II / III**, con `nombreAlphaPresentacion()` que normaliza
  los nombres antiguos ("Alpha 2") que puedan venir de BD o del panel admin.
- Texto introductorio aspiracional: "Cuantas más reservas completes, más ventajas
  exclusivas desbloquearás."
- Tarjeta destacada del nivel actual + **barra de progreso** + mensaje motivador
  ("Solo te faltan N reservas para llegar a ALPHA II") + bloque "Al llegar a X desbloqueas".
- Cada nivel es una **tarjeta con insignia** propia y resalte del nivel actual
  (`nivel-card--actual`).
- Beneficios orientados a beneficio ("Ahorra hasta un 10 % en tus próximas reservas",
  "Disfruta de promociones premium reservadas a miembros Alpha") con iconos Lucide
  asignados por `iconoDeBeneficio()`.
- Tests en `perfil-alpha.component.spec.ts` (romanos + ausencia de emojis).

**Acción pendiente (menor):** el navbar todavía muestra `👑 {{ a.nombreNivel }}`
(`rs-navbar.component.ts:80`). Entra en la tarea T2 de §3.

### TCK-8008 — Iconos oficiales en lugar del nombre 🟡

Hecho: `RsSocialIconComponent` (`instagram`, `facebook`, `tiktok`, `x`, `youtube`,
`linkedin`) sustituye el nombre escrito de cada red en el footer del home
(`home.component.ts:1107`) y en la landing (`proximamente.component.ts:489`).

Sigue como **texto** en la app (candidato a lo que muestra la captura del ticket):

| Sitio | Texto actual |
|---|---|
| `reserva-wizard.component.ts:648` | `Visa · Mastercard · American Express` |
| `home.component.ts:390` | `Visa · Mastercard · Stripe · Apple Pay · Google Pay` |
| `perfil-pagos.component.ts:53-57` | `Visa`, `Mastercard` como etiqueta de la tarjeta guardada |

**Captura confirmada por el cliente (05/08):** es el pie del home, con las redes como
píldoras de texto ("Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube") y la línea
"Visa · Mastercard …" debajo. Corresponde al build anterior a `931dbb7`: desde ese
commit las redes ya salen con su logotipo, y las marcas de pago con el suyo desde T1.
Ambas mitades de lo que muestra la captura quedan cubiertas; falta desplegar para que
la clienta lo vea.

### TCK-8010 — Iconografía uniforme sin emojis 🟡

Existe el componente `rs-icon` con **88 iconos** de trazo Lucide
(`apps/web/src/app/shared/components/icon/rs-icon.component.ts`), ya aplicado en home,
landing, ficha de alojamiento, ficha genérica de vertical, wizard de reserva, badges
automáticos, trust-block y Alpha.

Pero quedan **220 líneas con emoji en 33 archivos de producción** (45 de ellas son
banderas del selector de prefijo telefónico, que se pueden mantener):

| Área | Archivos | Líneas con emoji |
|---|---|---|
| Panel admin | `admin-reservas`, `admin-dashboard`, `admin-comercios`, `admin-reportes`, `admin-analitica`, `cupones-admin`, `admin-usuarios` | 76 |
| Ficha de mascota | `perro-form`, `perros-lista` | 29 |
| Panel comercio | `comercio-reservas`, `comercio-config`, `comercio-ingresos`, `comercio-listados`, `comercio-equipo` | 16 |
| Auth y ayuda | `registro-comercio`, `registro`, `login`, `ayuda` | 19 |
| Cliente | `favoritos`, `transporte-lista`, `alojamiento-lista/detalle`, `valorar-token`, `perfil-pagos`, `perfil-comercio`, `perfil-seguridad`, `perfil-notificaciones`, `mis-reservas`, `explora-*` | 20 |
| Navbar / shared | `rs-navbar`, `rs-favorito-btn` | 5 |
| Catálogo de países | `paises.catalogo.ts` | 45 (banderas — decisión aparte) |

**Acción:** tarea T2 de §3.

### TCK-8012 — No sale la foto del perro ❌

El recorrido completo está correcto en cliente y servidor:

- `perro-form.component.ts:81` → `<rs-image-upload formControlName="fotos" [multiple]="true" [maxFiles]="4" />`
- `construirPayload()` envía `fotos` (línea 610); `CrearPerroDto` la acepta
  (`libs/shared/src/dtos/perros/crear-perro.dto.ts:35`), así que el `ValidationPipe`
  con `whitelist: true` **no** la descarta; `perro.schema.ts:21` la persiste.
- `perros-lista.component.ts:44` y `rs-pet-picker` la pintan si existe.

El fallo está en la subida/servido del fichero, en `apps/api/src/core/upload/upload.service.ts`:

1. **S3 opcional:** si faltan `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID` o
   `AWS_SECRET_ACCESS_KEY`, `getClient()` lanza `503` (línea 45). El frontend captura la
   excepción y solo pinta un icono rojo sin texto
   (`rs-image-upload.component.ts:307-311`), así que el usuario guarda la ficha creyendo
   que la foto se subió. **Síntoma exacto del ticket.**
2. **Objeto no público:** el `PutObjectCommand` no fija ACL ni asume política de bucket, y
   devuelve una URL directa `https://<bucket>.s3.<region>.amazonaws.com/<key>`
   (línea 36). Si el bucket es privado (por defecto en AWS desde 2023), la subida funciona
   pero el `<img>` da 403 → tampoco se ve la foto.

**Acción:** tarea T3 de §3.

---

## 3. Plan de trabajo

Orden por impacto: primero el bug, luego la coherencia visual, luego el detalle de marca.

### T3 — Arreglar la foto de la mascota (TCK-8012) · ✅ hecho

Implementado. Resumen de lo entregado, sobre el plan original:

- `upload.service.ts`: dos modos. Con las 4 variables de S3 va a S3 y respeta
  `S3_PUBLIC_BASE_URL`; sin ellas guarda en **GridFS** y devuelve
  `{API_URL}/api/v1/upload/<id>`. La subida ya no puede devolver 503 por falta de
  configuración.
- `upload.controller.ts`: `GET /upload/:id` **público** (el `src` de un `<img>` no puede
  mandar el header de autorización) con `Cache-Control` inmutable; el `POST` sigue
  detrás de `JwtAuthGuard`.
- `rs-image-upload.component.ts`: mensaje de error visible con el motivo real
  (sin conexión / formato o tamaño / mensaje del servidor), botón **Reintentar** que
  reusa el fichero, e implementa `Validator` para invalidar el control mientras haya una
  subida fallida o en curso.
- `perro-form.component.ts`: `submit()` ya no falla en silencio; explica que la foto no
  se subió, porque el aviso vive en el paso 1 y se guarda desde el último.
- `perros-lista` y `rs-pet-picker`: directiva `rsImg`, para degradar a la imagen de
  respaldo si la URL guardada está rota.
- `.env.example` y `DEPLOY.md` §2.3.1: los dos modos, y el aviso de que un bucket S3
  privado devuelve 403 al pintar la imagen.

Tests: 12 nuevos en el API (`upload.service.spec.ts`, `upload.controller.spec.ts`),
7 en `rs-image-upload.component.spec.ts` y 2 en `perro-form.component.spec.ts`.
Suites completas en verde (API 609, web 1157) y los dos builds compilan.

<details>
<summary>Plan original de T3</summary>

1. **Backend `upload`:**
   - Añadir `S3_PUBLIC_BASE_URL` opcional (CDN/CloudFront o dominio del bucket) y usarla
     para construir la URL devuelta cuando esté presente.
   - Añadir **almacenamiento de respaldo en GridFS** (MongoDB Atlas ya está disponible en
     todos los entornos) cuando S3 no esté configurado: `POST /upload/image` guarda el
     binario y devuelve `/<apiUrl>/upload/:id`; nuevo `GET /upload/:id` público que hace
     stream con `Cache-Control` largo. Así la foto funciona siempre, con o sin S3.
   - Tests: `upload.service.spec.ts` (ruta S3, ruta GridFS, error de configuración) y
     `upload.controller.spec.ts` (GET público).
2. **Frontend `rs-image-upload`:**
   - Mostrar el mensaje de error real bajo la zona de subida (hoy solo hay un icono).
   - Emitir un `invalid` al `FormControl` mientras haya un slot en error, para que el
     formulario avise en vez de guardar sin foto.
   - Test de la rama de error.
3. **Robustez de pintado:** aplicar la directiva `rsImg` (`img-fallback.directive.ts`) en
   `perros-lista.component.ts:45` y en `rs-pet-picker`, como ya hace el wizard, para
   degradar a la huella si la URL está rota.
4. **Documentación:** en `DEPLOY.md`, sección de variables de imagen (S3 + política de
   bucket público o `S3_PUBLIC_BASE_URL`, y el modo GridFS por defecto).

**Verificación:** alta de perro con foto en local sin S3 → la foto se ve en "Mis perros",
en el pet-picker y en el wizard.

</details>

### T2 — Retirar los emojis restantes (TCK-8010, cierra también la corona del 8011) · ✅ hecho

Implementado. Resumen de lo entregado:

- **Barrido A (mascota y cliente):** ficha y lista de mascotas, favoritos, mis reservas,
  valoración por token, listados y ficha de alojamiento, listado de transporte, explora,
  perfiles y navbar. Los cuatro niveles de sociabilidad pasan de emojis de semáforo a
  caras Lucide con color por token; las etiquetas de estado de la ficha llevan icono
  y variante de badge en vez de un círculo de color.
- **Barrido B (paneles):** panel admin completo (dashboard, comercios, reservas,
  usuarios, reportes, analítica, cupones) y panel comercio (config, equipo, ingresos,
  listados, reservas).
- **Barrido C (auth y ayuda):** registro, registro de comercio, login y centro de ayuda.
- **Componentes nuevos:** `rs-stars` (fila de estrellas de valoración, sustituye a los
  helpers que repetían el carácter de estrella como texto) y el input `filled` de
  `rs-icon` para rellenar el trazo.
- **Iconos añadidos a `rs-icon`:** `meh`, `frown`, `angry`, `flame`, `brain`, `trash`,
  `save`, `ticket`, `bar-chart`, `store`, `baby`, `banknote`.
- **Una sola fuente de iconos por vertical:** `iconoDeVertical()` en
  `verticales.config.ts`; `vertical-icon.ts` delega en ella y se borraron los tres
  mapas de emojis y los dos mapas de iconos duplicados que vivían en los paneles.
- **`rs-card`:** el input `amenities` admite ahora `{ icon, label }` además de texto
  suelto, para que los servicios de la tarjeta lleven icono.
- **Guardia anti-regresión:** `shared/sin-emojis.spec.ts` recorre el código de
  producción del frontend y falla si reaparece un emoji.
- **Excepción documentada:** las banderas de `paises.catalogo.ts` se mantienen (son la
  representación estándar en un selector de prefijo telefónico y no hay equivalente en
  Lucide). Es la única entrada de la lista blanca del test, junto al propio test.

Suite completa del frontend en verde (90 suites, 1158 tests) y `build:web` compila.

<details>
<summary>Plan original de T2</summary>

Por barridos, cada uno con sus tests actualizados:

1. **Barrido A — mascota y cliente:** `perro-form`, `perros-lista`, `favoritos`,
   `mis-reservas`, `valorar-token`, `alojamiento-lista/detalle`, `transporte-lista`,
   `explora-*`, `perfil-*`, `rs-navbar` (👑 → `rs-icon name="crown"`), `rs-favorito-btn`.
2. **Barrido B — paneles:** `panel-admin/*` (el volumen mayor: estados de reserva,
   verticales, acciones de tabla) y `panel-comercio/*`.
3. **Barrido C — auth y ayuda:** `registro`, `registro-comercio`, `login`, `ayuda`.
4. **Iconos nuevos en `rs-icon`** que haga falta añadir para no repetir emojis
   (p. ej. `trash`, `edit`, `ban`, `piggy-bank`, `flag`), siguiendo §21.8 de `CLAUDE.md`.
5. **Regla anti-regresión:** test en `apps/web` que recorra los `.ts` de `src/app` y falle
   si aparece un emoji pictográfico fuera de la lista blanca (`paises.catalogo.ts`).
6. **Banderas de país:** decisión explícita — se mantienen como emoji (son la
   representación estándar en un selector de prefijo). Se documenta como excepción.

**Verificación:** el test anti-regresión en verde + revisión visual de admin y ficha de mascota.

</details>

### T1 — Marcas oficiales en lugar del nombre (TCK-8008) · ✅ hecho

Implementado. Nuevo `RsBrandIconComponent`
(`shared/components/brand-icon/rs-brand-icon.component.ts`) con
`visa | mastercard | amex | stripe | apple-pay | google-pay`, y sustituido el texto en
los tres sitios donde las marcas se leían en lugar de reconocerse:

| Antes | Ahora |
|---|---|
| `reserva-wizard`: "Visa · Mastercard · American Express" | fila de marcas bajo el método de pago |
| `home` (pie): "Visa · Mastercard · Stripe · Apple Pay · Google Pay" | fila de marcas |
| `perfil-pagos`: chips con nombre y un icono genérico de tarjeta | fila de marcas |

Cada marca lleva `role="img"` y `aria-label` con su nombre, así que el lector de pantalla
sigue diciendo "Visa" aunque en pantalla ya no se lea. 5 tests nuevos.

**Nota sobre el artwork:** el símbolo de Mastercard son sus dos círculos, geometría
exacta. Las demás marcas son logotipos de texto y aquí se dibujan como lettering sobre
el fondo corporativo de cada una: reconocible y sin depender de assets externos (el CSP
de la app no permite cargar imágenes de terceros). Si se dispone del artwork oficial,
se deja en `public/icons/pagos/` y solo cambia ese componente.

<details>
<summary>Plan original de T1</summary>

1. Nuevo `RsBrandIconComponent` (`shared/components/brand-icon/`) con los logotipos
   vectoriales de `visa`, `mastercard`, `amex`, `stripe`, `apple-pay`, `google-pay`,
   siguiendo el mismo patrón que `rs-social-icon` (SVG inline, sin dependencias externas).
2. Sustituir el texto en `reserva-wizard.component.ts:648`, `home.component.ts:390` y
   `perfil-pagos.component.ts:53-57`, manteniendo el nombre como `aria-label`/`title`
   para accesibilidad.
3. Añadirlo al barrel `shared/index.ts` y a `.claude/commands/design-tokens.md`.
4. **[requiere captura]** Confirmar con la clienta que la captura del ticket es esa zona;
   si es otra, aplicar el mismo componente allí.

**Verificación:** test de render del componente + revisión visual del paso de pago.

</details>

### T4 — Cierre documental · ✅ hecho

`docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md` actualizado (los tres items ya
implementados marcados como hechos) y `.claude/commands/design-tokens.md` amplía la
sección de iconografía con la regla anti-emojis, los tres componentes de icono y la
guardia automática.

<details>
<summary>Plan original de T4</summary>

1. Actualizar `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`: marcar como hechos los tres
   items ya implementados —
   UI "Mis perros" (`features/perros/perros-lista.component.ts` + ruta `/perros`),
   selector de perro en la reserva (`reserva-wizard.component.ts:162-191` y
   `rs-pet-picker` en el buscador) y notificación del ajuste de precio
   (`notifications.service.ts:73-107`, tipo `ajuste_solicitado`).
   Queda abierto solo el e2e manual de Stripe en modo test.
2. Actualizar este documento con el resultado de cada tarea.

</details>

---

## 4. Secuencia sugerida y commits

| Orden | Tarea | Commit |
|---|---|---|
| 1 | T3 | `fix(upload): servir y mostrar la foto de la mascota (TCK-8012)` |
| 2 | T2 (los tres barridos + guardia) | `refactor(web): iconografía Lucide uniforme en toda la app (TCK-8010)` |
| 3 | T1 + T4 | `feat(web): marcas de pago oficiales en lugar del nombre (TCK-8008)` |

Los seis tickets quedan cerrados en código. Cada commit cita su código de ticket, según
pide el export de MayaHelp.

## 5. Preguntas abiertas para la clienta

1. **TCK-8008:** resuelto — la clienta envió la captura el 05/08 y es el pie del home
   (redes + línea de métodos de pago). Ambas partes están ya en código.
2. **TCK-8010:** ¿mantenemos las banderas emoji en el selector de prefijo telefónico
   (recomendado, es lo estándar) o también se sustituyen por SVG?
3. **TCK-8012:** ¿el entorno de producción tiene bucket S3 propio, o preferís el
   almacenamiento en MongoDB (GridFS) hasta que se contrate uno?
