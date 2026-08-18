# Plan — Auditoría de seguridad, errores e inconsistencias + cobertura

> **Documento de estado vivo.** Se actualiza al cerrar cada fase.
> **Creado:** 2026-08-17. **Alcance:** `apps/api`, `apps/web`, `libs/shared`.
> **Método:** revisión del código real (no de los PLAN-\*.md previos) + ejecución de ambas suites
> con cobertura. Cada hallazgo lleva fichero y línea para poder verificarlo.

---

## 0. Resumen ejecutivo

Ambas suites están en verde (API 992 tests / 83 suites; Web 1408 tests / 109 suites) y la
arquitectura del core es sólida: el multi-tenant del panel de comercio toma siempre `comercioId`
del token, las reseñas y los perros validan propiedad, los cupones no pueden generar descuentos
negativos y no hay secretos versionados.

Los problemas se concentran en tres sitios:

1. **La superficie de entrada del API está sin blindar.** No hay rate limiting, ni `helmet`, ni
   CORS restringido, y Swagger se publica en producción. Hay además dos proxies **públicos** a
   APIs de pago (Google Places/Routes y DeepSeek) que cualquiera puede facturar.
2. **Dos fallos de autorización explotables**: el `state` del OAuth de calendario no está firmado
   pese a que el comentario del código afirma que sí, y la creación de reservas acepta del cliente
   el `comercioId` y el `vertical` sin contrastarlos nunca con el servicio reservado.
3. **El camino del dinero tiene un orden de operaciones frágil**: el webhook de Stripe marca el
   pago como aprobado *antes* de confirmar la reserva, y su propio guard de idempotencia impide
   que el reintento de Stripe repare el fallo.

Cobertura: **no está al 100 %, y tampoco llega al 80 % que exige CLAUDE.md §20.** Además los
umbrales del API están 16-19 puntos por debajo de la cobertura real, así que hoy no protegen nada.

**Esfuerzo estimado del plan completo: 8-11 días.** Las fases 0 a 2 (3-4 días) cubren todo lo que
es explotable o cuesta dinero.

---

## 1. Hallazgos de seguridad

### S1 · ALTA — El `state` del OAuth de calendario no está firmado

`apps/api/src/core/agenda/agenda.controller.ts:200-227`

El comentario dice *"la autoría viaja **firmada** en el `state`"*, pero
`agenda.controller.ts:193-195` solo hace `Buffer.from(JSON.stringify({agendaId, comercioId})).toString('base64url')`.
Es codificación, no firma. El callback (`:215`) hace `JSON.parse` del `state` y se lo pasa tal cual
a `conectarCalendario(agendaId, comercioId, ...)`.

Cualquiera puede fabricar el `state` de otro comercio y llamar al callback con su propio `code`,
enganchando **su** calendario a la agenda de un comercio ajeno (y al revés: llevarse los tokens de
Google del comercio a su propia agenda). No hay tampoco nonce anti-CSRF.

**Corrección:** firmar el `state` con `JwtService.sign({agendaId, comercioId}, {expiresIn: '10m'})`
y verificarlo en el callback; rechazar si la firma o el TTL fallan. Corregir el comentario.

### S2 · ALTA — El cliente elige `comercioId` y `vertical` de la reserva

`apps/api/src/core/bookings/bookings.controller.ts:33-46` → `bookings.service.ts:57-131`

`CrearReservaDto` trae `servicioId`, `comercioId` y `vertical` por separado
(`libs/shared/src/dtos/bookings/crear-reserva.dto.ts:8-14`) y el servicio **nunca carga el
documento del servicio** para contrastarlos. Consecuencias reales:

- La reserva se atribuye a un `comercioId` arbitrario: ese comercio la ve en su panel y recibe la
  liquidación, mientras el proveedor real nunca se entera.
- La comisión se resuelve con el `vertical` y el `comercioId` **elegidos por el atacante**
  (`bookings.service.ts:99-105` → `comisionResolver.resolver`). Basta apuntar a un comercio con
  `comisionPctOverride` bajo (o socio fundador) para pagar menos comisión de la que toca.

**Corrección:** cargar el servicio por `servicioId` y derivar de él `comercioId` y `vertical`;
ignorar los del body o devolver 409 si no coinciden. Marcarlos como deprecados en el DTO.

### S3 · ALTA — Sin rate limiting ni cabeceras de seguridad; proxies de pago abiertos

`apps/api/package.json` (no hay `@nestjs/throttler` ni `helmet`), `apps/api/src/main.ts:18-28`

- `POST /auth/login` es fuerza-brutable sin límite (agravado por S7).
- `POST /auth/registro`, `POST /lista-espera`, `POST /eventos` permiten spam ilimitado.
- `POST /ai-search` es **público** (`ai-search.controller.ts:16`) y llama a DeepSeek con nuestra
  clave (`ai-search.service.ts:66-84`). Coste por petición, sin techo.
- `GET /geo/autocomplete|geocode|direccion|trayecto` son **públicos** y llaman a Google Places y
  Routes con `GOOGLE_MAPS_API_KEY` (`geo.service.ts:183-362`). Places factura por sesión.

**Corrección:** `ThrottlerModule` global (p. ej. 100 req/min/IP), con límites estrictos y aparte
en `auth` (5/min), `ai-search` y `geo` (y exigir sesión iniciada para `ai-search`). Añadir `helmet`.

### S4 · ALTA — CORS abierto y Swagger publicado en producción

`apps/api/src/main.ts:28` `app.enableCors()` sin opciones → `Access-Control-Allow-Origin: *`.
`apps/api/src/main.ts:38` monta Swagger en `/api/docs` sin condición de entorno.

El token viaja en cabecera desde `localStorage`, así que no hay CSRF directo, pero cualquier sitio
puede consumir la API, y Swagger regala el mapa completo de endpoints y DTOs.

**Corrección:** whitelist de orígenes desde `APP_URL`/env; Swagger solo si
`NODE_ENV !== 'production'` o detrás de basic-auth.

### S5 · MEDIA-ALTA — El JWT no se revalida nunca contra la base de datos

`apps/api/src/core/auth/strategies/jwt.strategy.ts:17-19` devuelve el payload tal cual.
`apps/api/src/core/auth/auth.module.ts:24` fija `expiresIn` por defecto en **7 días**.

`rol` y `comercioId` viajan congelados en el token y son la base de todo el control de acceso
(`roles.guard.ts:23`, y los ~20 endpoints de `comercios.controller.ts` que hacen
`req.user.comercioId!`). El chequeo de `activo === false` existe **solo en el login**
(`auth.service.ts:54`). Por tanto: desactivar a un empleado, cambiarle el rol, desvincularlo del
comercio o suspender el comercio **no surte efecto hasta 7 días después**.

**Corrección:** revalidar el usuario en `validate()` (con caché corta en memoria para no pegarle a
Mongo en cada request), o bajar el TTL a ~1 h con refresh token, o `tokenVersion` incremental en
`usuarios` que invalide los tokens previos.

### S6 · MEDIA — Regex sin escapar en buscadores públicos (ReDoS)

- `apps/api/src/core/catalog/catalog.repository.ts:423` — `new RegExp(params.ciudad, 'i')`
- `apps/api/src/core/lugares/lugares.service.ts:39-40` — ciudad y provincia
- `apps/api/src/core/planificador/planificador.service.ts:137,138,151` — provincia

Es una **inconsistencia**, no un olvido aislado: admin, auditoría, comercios, reviews e incidencias
sí usan `escaparRegex` (`admin.service.ts:747`, `auditoria.service.ts:60`,
`comercios.repository.ts:132`, `reviews.repository.ts:76`, `incidencias.repository.ts:44`). Los
cuatro que faltan son justo los expuestos sin autenticar: `?ciudad=(a+)+$` bloquea el event loop.

**Corrección:** aplicar `escaparRegex` en los cuatro y subir el helper a `libs/shared` para que
haya una sola implementación.

### S7 · MEDIA — Enumeración de cuentas en el login

`apps/api/src/core/auth/auth.service.ts:43-45` y `:59-64`

El login devuelve *"Esta cuenta usa acceso con Google o Meta"* (403) o *"Verifica tu email"* (403)
**solo si el email existe**, frente al genérico *"Credenciales incorrectas"* (401) si no. Con S3
(sin rate limit) se puede enumerar la base de usuarios entera.

**Corrección:** un único mensaje y código para credenciales; trasladar el matiz a un paso posterior
del flujo (p. ej. tras verificar la contraseña).

### S8 · MEDIA — Ficheros servidos desde el origen del API sin `nosniff`

`apps/api/src/core/upload/upload.controller.ts:111-124` y `upload.service.ts:77,85`

`ParseFilePipeBuilder.addFileTypeValidator` valida el **mimetype declarado por el cliente**, no los
magic bytes. Ese mismo mimetype se persiste en GridFS y se devuelve como `Content-Type` en
`GET /upload/:id`, que es público. No se envían `X-Content-Type-Options: nosniff` ni
`Content-Disposition`, y el fichero se sirve desde el propio origen del API.

**Corrección:** validar magic bytes (`file-type`), forzar `nosniff` y `Content-Disposition: inline`
con nombre saneado, y a medio plazo servir los adjuntos desde S3/CDN en otro dominio.

### S9 · MEDIA — `POST /comercios` sin restricción de rol

`apps/api/src/core/comercios/comercios.controller.ts` (ruta `POST ''`, solo `JwtAuthGuard`) →
`comercios.service.ts:125-149`

Cualquier usuario autenticado, incluido un `cliente`, crea un documento `comercio`. El servicio no
sube el rol (solo asigna `comercioId`, `:143`), así que el creador tampoco puede gestionarlo: quedan
comercios huérfanos en la colección y la cuenta se autobloquea para un alta real
(*"Tu cuenta ya está vinculada a un comercio"*, `:129`).

**Corrección:** `@Roles(Rol.COMERCIO_ADMIN)` en la ruta, o promoción de rol explícita y auditada.

### S10 · BAJA-MEDIA — `RolesGuard` lanza TypeError si no hay usuario

`apps/api/src/core/auth/guards/roles.guard.ts:23-24` desestructura `user.rol` sin comprobar `user`.
Hoy siempre va acompañado de `JwtAuthGuard`, pero un `@Roles()` suelto daría 500 en vez de 401.

**Corrección:** `return Boolean(user) && rolesRequeridos.includes(user.rol);`

### S11 · BAJA — Cachés en memoria sin límite en `GeoService`

`apps/api/src/core/geo/geo.service.ts:141-145`: cuatro `Map` sin tope ni evicción, alimentados
desde endpoints públicos (S3). Las entradas caducadas solo se borran si alguien vuelve a pedir esa
misma clave (`leerCache`, `:428-436`), así que el crecimiento es monótono → OOM.

**Corrección:** LRU con tope (p. ej. 5.000 entradas por caché).

### S12 · BAJA — No existe recuperación de contraseña (HU A4)

No hay ningún endpoint de *forgot/reset* en `auth.controller.ts`. Quien olvida la contraseña pierde
la cuenta: el cambio exige la contraseña actual (`users.service.ts:37`). La infraestructura ya
existe — `iniciarVerificacionEmail` (`auth.service.ts:127-141`) es exactamente el patrón a copiar.

---

## 2. Errores e inconsistencias

### E1 · ALTA — El webhook de Stripe puede cobrar sin confirmar la reserva

`apps/api/src/core/payments/payments.service.ts:264-291`

El orden es: (1) guard de idempotencia `if (pago.estado !== INICIADO) return;` (`:265`);
(2) `pago.estado = APROBADO; await pago.save();` (`:271-273`); (3) `bookingsService.confirmar()`
(`:286`). Si el paso 3 lanza —y puede: `confirmar` llama a `revalidarAntesDeConfirmar`
(`bookings.service.ts:211`)— el controller devuelve error, Stripe reintenta, y en el reintento el
guard del paso 1 corta antes de tocar la reserva. **Cobro consumado, reserva sin confirmar, y el
reintento de Stripe ya no puede repararlo.**

En el caso de un viaje el fallo es parcial: el bucle `:285-289` confirma reservas de una en una, así
que si falla la tercera de cinco, las dos primeras quedan confirmadas y las demás no.

**Corrección:** confirmar las reservas **antes** de marcar el pago como aprobado, o introducir un
estado intermedio (`procesando`) que sí permita al reintento retomar el trabajo pendiente. Envolver
el viaje en una transacción de Mongoose.

### E2 · MEDIA-ALTA — Importes sin redondear al crear la reserva

`apps/api/src/core/bookings/bookings.service.ts:106-109`

```ts
const comisionMonto = montoSubtotal * comisionPct;
const iva = montoSubtotal * IVA_RATE;
const montoTotal = montoSubtotal + iva;
```

Sin `Math.round(x * 100) / 100`, al contrario que **todo** `payments.service.ts` (`:310-314`) y que
el propio `confirmarAjuste` (`bookings.service.ts:464-467`). Se persisten valores como
`121.34000000000002`; luego `calcularDesglose` recalcula redondeando, así que el importe de la
reserva y el efectivamente cobrado difieren en céntimos, y los agregados del reporte financiero del
admin suman ese ruido.

**Corrección:** redondear a 2 decimales en el mismo punto de cálculo. A medio plazo, considerar
trabajar en céntimos enteros.

### E3 · MEDIA-ALTA — Los servicios de comercios suspendidos siguen en el buscador

`apps/api/src/core/catalog/catalog.repository.ts:421` — el filtro base es `{ estado: 'publicado' }`
y nunca se cruza con `comercio.estado`. `comercios.service.cambiarEstado` (`:161`) marca el comercio
como `suspendido`, pero sus listados siguen siendo públicos, buscables y reservables. Contradice
directamente la HU J1 ("aprobar/suspender comercios, para controlar la calidad de la oferta"). Lo
mismo con los comercios recién registrados, que nacen en `pendiente` (`comercio.schema.ts:165`).

**Corrección:** denormalizar un flag `comercioActivo` en `servicios` y mantenerlo al cambiar el
estado del comercio (un `$in` sobre comercios en cada búsqueda rompería el índice ESR de §4.3).

### E4 · MEDIA — La recuperación de abandonos no envía nada, nunca

`apps/api/src/core/eventos/eventos.controller.ts:67-72` lee `req.user?.sub`, pero la ruta **no
tiene `JwtAuthGuard`** (es pública a propósito), así que `req.user` es siempre `undefined`. El DTO
local (`eventos.controller.ts:21-46`) tampoco declara `usuarioId`, y el `whitelist: true` global
(`main.ts:20`) lo eliminaría si llegara por el body.

Resultado: `evento.usuarioId` es siempre null, y `growth.service.ts:145`
(`if (!abandono.usuarioId) { omitidas++; continue; }`) descarta **todos** los abandonos. La campaña
de recuperación es código muerto en producción.

**Corrección:** un `JwtOpcionalGuard` que rellene `req.user` cuando haya un token válido sin
exigirlo. Es la pieza que el código ya asume que existe.

### E5 · MEDIA — Doble cobro del ajuste de precio

`apps/api/src/core/payments/payments.service.ts:185-222`

`aceptarAjuste` no comprueba si ya hay un pago de suplemento en estado `INICIADO` para esa reserva,
a diferencia de `crearIntent`, que sí lo hace (`:45-56`). Dos clics del cliente = dos PaymentIntents
= dos cargos por la misma diferencia.

**Corrección:** replicar el guard de `crearIntent`, filtrando por `esSuplemento: true`.

### E6 · MEDIA — `clientSecret` reutilizado con importe potencialmente obsoleto

`apps/api/src/core/payments/payments.service.ts:45-56`: si existe un pago `INICIADO` se devuelve su
`clientSecret` sin verificar que su `montoTotal` siga coincidiendo con el desglose actual de la
reserva. Si entre medias cambió el subtotal (suplementos, cupón), se cobra el importe viejo.

### E7 · MEDIA — Un ObjectId inválido en la ruta devuelve 500

Ningún controller valida los `:id` de path (el único que lo hace a mano es
`upload.service.ts:137-142`). `GET /reservas/loquesea` produce un `CastError` de Mongoose que
`DomainExceptionFilter` no captura (`@Catch(DomainException, HttpException)`,
`domain-exception.filter.ts:5`) → 500 genérico en vez de 400.

**Corrección:** `ParseObjectIdPipe` propio aplicado a los `@Param('id')`, y ampliar el filtro para
mapear `CastError`/`ValidationError` de Mongoose a 400.

### E8 · BAJA-MEDIA — Promesa fire-and-forget sin captura

`apps/api/src/core/eventos/growth.service.ts:161` hace `void this.pushService.enviarA(...)`, y
`push.service.enviarA` (`push.service.ts:77-89`) **no tiene try/catch**, al contrario que
`notifications.service` (`:31`, `:80`), que sí envuelve todo. Un fallo de Mongo o de FCM produce un
rechazo no capturado → en Node ≥ 15 tumba el proceso. Hoy la línea es inalcanzable por culpa de E4,
así que arreglar E4 **activa** este riesgo.

### E9 · BAJA — Salida del LLM sin validar

`apps/api/src/core/ai-search/ai-search.service.ts:89`: `JSON.parse(content) as SearchParams` sin
validar forma ni tipos. El aserto de tipo es una promesa vacía: si el modelo devuelve `ciudad` como
objeto o `presupuestoMax` como texto, el valor viaja al frontend y de ahí al filtro del catálogo.

**Corrección:** validar con `class-validator` o un type-guard antes de devolver, y caer a
`busquedaNoInterpretada` si no encaja.

---

## 3. Estado real de los tests y la cobertura

Ambas suites ejecutadas hoy, en verde:

| Suite | Test suites | Tests | Tiempo |
|---|---|---|---|
| API | 83 / 83 | 992 | 110 s |
| Web | 109 / 109 | 1408 | 60 s |

### 3.1 Cobertura medida frente a los umbrales

| | statements | branches | functions | lines |
|---|---|---|---|---|
| **API — real** | 86,16 % (4149/4815) | 75,08 % (1483/1975) | 78,15 % (812/1039) | 86,66 % (3699/4268) |
| API — umbral configurado | 70 | 56 | 58 | 70 |
| **Web — real** | 83,10 % (7092/8534) | 71,01 % (2377/3347) | 77,39 % (1578/2039) | 85,28 % (7402 líneas) |
| Web — umbral configurado | 80 | 70 | 74 | 80 |
| **Objetivo CLAUDE.md §20** | 80 | 80 | 80 | 80 |

**Respuesta directa: no, la cobertura no está al 100 %, y tampoco llega al 80 % de CLAUDE.md §20**
— fallan `branches` y `functions` en ambos workspaces.

Hay además una segunda anomalía: **los umbrales del API están 16-19 puntos por debajo de la
cobertura real**. El comentario de `apps/api/jest.config.ts:60-66` explica que se bajaron para
desbloquear el deploy, pero desde entonces la cobertura subió y nadie los reajustó. Hoy se podrían
borrar cientos de tests sin que el gate protestara: el suelo anti-regresión no está haciendo su
trabajo.

### 3.2 Ficheros sin ninguna cobertura, por criticidad

**API — seguridad e infraestructura (0 %)**
`core/auth/strategies/jwt.strategy.ts` · `shared/filters/domain-exception.filter.ts` ·
`core/payments/stripe.gateway.ts` · `core/ai-search/ai-search.service.ts`

**API — controllers sin ningún test (0 %)**
users · carrito · push · planificador · liquidaciones · incidencias · auditoria · configuracion ·
ai-search

**API — repositorios flojos**
incidencias 25,9 % · favoritos 32 % · users 41,4 % · cupones 46,7 %

**Web — seguridad del cliente (0 %)**
`core/interceptors/auth.interceptor.ts` · `core/guards/role.guard.ts` — las dos piezas que deciden
qué se envía y quién entra, sin un solo test.

**Web — UI Kit (0 %)**
`shared/components/button/rs-button.component.ts` · `shared/components/input/rs-input.component.ts`
— los dos componentes que CLAUDE.md §21 declara de uso obligatorio.

**Web — componentes con lógica y poca cobertura**
admin-api.service 45,0 % · comercio-listados 45,5 % · rs-filtros-listado 46,6 % ·
admin-pagos 55,3 % · rs-region-selector 65,2 % · comercio-equipo 66,7 %

### 3.3 E2E

Hay andamiaje sin recorrido real: `apps/web/e2e/humo.spec.ts` (1,6 KB) con Playwright configurado,
y `apps/api/test/auth.e2e-spec.ts` con supertest + `mongodb-memory-server`. Falta el flujo crítico
completo de punta a punta: **buscar → reservar → pagar → webhook → confirmar**, que es justo donde
viven E1, E2 y S2.

---

## 4. Plan de ejecución

Orden por riesgo real y dependencias. Cada corrección lleva su `.spec.ts` en el mismo commit
(CLAUDE.md §20). Al cerrar cada fase: `bun run build:shared && bun run build:api && bun run build:web`.

| Fase | Contenido | Hallazgos | Est. |
|---|---|---|---|
| **F0 — Blindaje de entrada** | helmet, ThrottlerModule global + límites estrictos en auth/geo/ai-search, CORS con whitelist, Swagger cerrado en prod | S3, S4 | 0,5 d |
| **F1 — Autorización** | Firmar el `state` del OAuth; derivar `comercioId`/`vertical` del servicio; revalidar el JWT contra BD y bajar el TTL; `@Roles` en `POST /comercios`; `RolesGuard` a prueba de `user` ausente | S1, S2, S5, S9, S10 | 1,5-2 d |
| **F2 — Camino del dinero** | Reordenar el webhook + transacción del viaje; redondeo de importes en `crear`; idempotencia de `aceptarAjuste`; revalidar importe del `clientSecret` reutilizado | E1, E2, E5, E6 | 1-1,5 d |
| **F3 — Entrada y consistencia** | `escaparRegex` en los 4 buscadores públicos (helper a `shared`); `ParseObjectIdPipe` + `CastError`→400; flag `comercioActivo` en `servicios`; `nosniff` + magic bytes en uploads; LRU en `GeoService` | S6, S8, S11, E3, E7 | 1-1,5 d |
| **F4 — Bugs funcionales** | `JwtOpcionalGuard` y atribución de eventos; try/catch en `push.enviarA`; validar la salida del LLM; mensaje de login genérico | E4, E8, E9, S7 | 0,5-1 d |
| **F5 — Recuperación de contraseña** | Endpoints forgot/reset copiando el patrón de `iniciarVerificacionEmail` + pantalla en la web | S12 | 1 d |
| **F6 — Cobertura** | Cubrir los 0 % críticos (jwt.strategy, filtro, stripe.gateway, auth.interceptor, role.guard, rs-button, rs-input), los 9 controllers del API sin test y los 4 repositorios flojos. Subir umbrales a 80/80/80/80 en ambos workspaces | §3.1, §3.2 | 2-3 d |
| **F7 — E2E del flujo crítico** | Playwright (web): registro → buscar → reservar → pagar (Stripe test) → ver reserva. Supertest (API): reserva + webhook de Stripe firmado + confirmación + liquidación | §3.3 | 1-2 d |

**Total: 8-11 días.** Las fases F0-F2 (3-4 días) cierran todo lo explotable y todo lo que cuesta
dinero; son las que conviene no aplazar.

### Notas de ejecución

- **F1/S5 y F0/S3 tocan la misma zona** (`main.ts`, `auth.module.ts`): conviene hacerlas seguidas
  para no repetir el ciclo de build y despliegue.
- **F4/E4 activa F4/E8**: arreglar la atribución de eventos hace alcanzable la línea de
  `pushService.enviarA` sin captura. Van juntas o no van.
- **F2/E2 cambia importes persistidos**: hace falta un script de migración que redondee
  `montoTotal`, `comisionMonto` y `montoSubtotal` de las reservas ya existentes, o los informes
  arrastrarán el ruido histórico.
- **F6 antes de subir umbrales**: subir el `coverageThreshold` primero rompería el CI. El orden es
  añadir tests → medir → subir el suelo al valor real menos 1 punto → repetir por tramos.
- **F3/E3 requiere backfill**: al añadir `comercioActivo` a `servicios` hay que rellenarlo para los
  documentos existentes en la misma migración.

---

## 5. Estado

### F0 — Blindaje de entrada (cerrada)

- `helmet` y `@nestjs/throttler` añadidos a `apps/api`.
- `main.ts`: helmet, `trust proxy` (sin él, tras el proxy de Coolify todo el
  tráfico compartiría un solo cubo de rate limit), CORS acotado con
  `origenesPermitidos`, y Swagger sólo fuera de producción o con
  `SWAGGER_ENABLED=true`.
- `ThrottlerGuard` global (300 req/min/IP) + límites estrechos: auth 10/min
  (reenvío de verificación 3/min), `ai-search` 5/min, `geo` 60/min,
  `lista-espera` 5/min, `eventos` 120/min. Exentos el webhook de Stripe
  (bloquearlo perdería confirmaciones de pago) y `GET /upload/:id`.
- Nuevos: `shared/cors-origenes.ts` (+ spec, 10 casos) y `app.module.spec.ts`,
  que vigila que ningún decorador de límite desaparezca sin romper la suite.
- `CORS_ORIGINS` y `SWAGGER_ENABLED` documentados en `apps/api/.env.example`.

**Decisión declarada:** `POST /ai-search` sigue siendo público. Exigir sesión
habría roto el buscador de la portada, que se usa sin iniciarla; el gasto queda
acotado por el límite de 5/min. Cerrarlo del todo es una decisión de producto.

### F1 — Autorización (cerrada)

- **S1** `agenda/oauth-state.service.ts` (nuevo, + spec de 7 casos): el `state`
  del OAuth de calendario va firmado (JWT, audiencia `agenda-oauth`, 10 min).
  El comentario que afirmaba que ya iba firmado era falso.
- **S2** `BookingsService.resolverServicio`: el comercio y el vertical se leen
  del servicio reservado; los que manda el cliente sólo se contrastan y, si no
  cuadran, la reserva se rechaza con 409. `CarritoService` toma también el
  vertical del servicio para no meter en el carrito algo que fallará al pagar.
- **S5** `jwt.strategy.ts`: `validate` relee la cuenta en cada petición (caché de
  30 s, tope de 5.000 entradas) y devuelve el **rol y el comercio vigentes**, no
  los del token. Una cuenta borrada o desactivada deja de tener acceso al
  momento, no siete días después.
- **S9** `POST /comercios` restringido a `Rol.ADMIN`. La web no lo usaba: el
  camino self-service es `/comercios/registro` y `/comercios/onboarding`.
- **S10** `RolesGuard` deniega en vez de lanzar `TypeError` cuando no hay usuario.

**Decisión declarada:** el TTL del token sigue en 7 días. Bajarlo sin un flujo de
refresh expulsaría a los usuarios a diario, y con la revalidación contra base de
datos ya no es lo que sostenía el riesgo. El refresh token queda como trabajo
aparte, no como parte de esta fase.

**Pendiente observado (no bloqueante):** `reserva-wizard.component.ts:2012` cae a
`VerticalKey.ALOJAMIENTO` si la ruta no trae el vertical. Con S2 en su sitio eso
ya no crea una reserva mal atribuida —devuelve 409—, pero conviene quitar ese
`??` para que el fallo se vea en el frontend. Anotado para F4.

### F2 — Camino del dinero (cerrada)

- **E1** `PaymentsService.aplicarPagoAprobado` (extraído): se confirma lo
  reservado **antes** de marcar el pago como aprobado. Si la confirmación falla,
  el pago queda en `INICIADO` y el reintento de Stripe puede rematarlo, en vez de
  quedarse cobrado y sin reserva para siempre. Los avisos por correo se envían al
  final, cuando ya no hay nada que deshacer.
- **E1 (derivado)** `BookingsService.confirmar` es ahora idempotente: si la
  reserva ya no está `PENDIENTE`, devuelve y sale. Sin esto, un reintento sobre
  un viaje parcialmente confirmado volvía a contar el uso del cupón.
- **E2** importes redondeados al céntimo en `crear`, con un único helper
  `redondearEuros` en todo el fichero. Añadido
  `scripts/redondear-importes-reservas.ts` (`bun run --cwd apps/api
  redondear:importes`, simulación por defecto) para limpiar lo ya persistido; no
  recalcula nada, sólo redondea.
- **E5** `aceptarAjuste` reutiliza el suplemento pendiente en vez de crear un
  segundo `PaymentIntent`: dos clics ya no son dos cargos.
- **E6** `crearIntent` sólo reutiliza el `clientSecret` pendiente si su importe
  sigue coincidiendo con el desglose actual; si no, lo descarta y crea uno nuevo.
- Tests nuevos: orden de confirmación (3 casos, incluido el de fallo), redondeo,
  idempotencia del suplemento y descarte del intent obsoleto.

**Corregido de paso:** `pagoMock.montoTotal` del spec seguía en 590, el total con
el IVA del 18 % de una etapa anterior. Con `IVA_RATE = 0.21` el total real es
605; el test de reutilización pasaba sólo porque nadie comparaba importes.

### F3 — Entrada y consistencia (cerrada)

- **S6** `escaparRegex` / `regexLiteral` viven ahora en `libs/shared/src/regex.ts`
  con su spec (7 casos, incluido uno de retroceso catastrófico). Se aplican en
  los cuatro buscadores públicos que no escapaban —catálogo, lugares (ciudad y
  provincia) y planificador— y sustituyen las **siete copias** de la misma línea
  repartidas por admin, auditoría, comercios, incidencias y reviews.
- **S8** `GET /upload/:id` envía `X-Content-Type-Options: nosniff` y
  `Content-Disposition: attachment` para todo lo que no sea una imagen conocida.
  Nuevo `upload/firma-fichero.ts` (+ spec, 14 casos): la subida comprueba los
  **magic bytes** y rechaza el contenido que no es del tipo que declara, que era
  lo que `ParseFilePipeBuilder` no miraba.
- **S11** las cuatro cachés de `GeoService` tienen tope de 5.000 entradas con
  desalojo de la más antigua. Antes sólo se limpiaban al volver a pedir la misma
  clave, así que crecían sin límite desde endpoints públicos.
- **E3** nuevo flag denormalizado `Servicio.comercioActivo`, exigido por el
  filtro del catálogo y mantenido por `ComerciosService.cambiarEstado`. El índice
  ESR pasa a `{estado, comercioActivo, vertical, ciudad, prioridad, precio}`.
- **E7** `DomainExceptionFilter` traduce `CastError` y `ValidationError` de
  Mongoose a 400 sin filtrar el nombre del campo ni el valor recibido. El fichero
  estaba al 0 % de cobertura; ahora tiene spec propia (7 casos).

**Requiere migración antes de desplegar:** `bun run --cwd apps/api
backfill:comercio-activo -- --aplicar`. El campo nace en `false`, así que hasta
que se ejecute **el buscador no devuelve ningún listado**. El script avisa de
ello en su salida de simulación.

**Corregido de paso:** `pagoMock` del spec de payments y las llamadas a
`repository.crear` del spec de catálogo estaban desactualizadas respecto a los
tipos reales; ahora compilan contra ellos.

### F4 — Bugs funcionales (cerrada)

- **E4** nuevo `auth/guards/jwt-opcional.guard.ts` (+ spec) aplicado a
  `POST /eventos`: la ruta sigue siendo pública, pero ahora rellena `req.user`
  cuando hay sesión. Sin él `evento.usuarioId` era siempre `undefined` y
  `GrowthService.recuperarAbandonos` descartaba el 100 % de los abandonos: la
  campaña de recuperación no enviaba nada a nadie.
- **E8** `PushService.enviarA` cumple por fin lo que prometía su propio
  comentario ("nunca lanza"): el cuerpo se movió a un privado y el público lo
  envuelve en try/catch. Se le llama con `void` desde `GrowthService`, así que un
  rechazo era un *unhandled rejection* y, en Node ≥ 15, la caída del proceso.
  Arreglar E4 es justo lo que hacía alcanzable esa línea.
- **E9** `AiSearchService.sanear` valida en ejecución lo que devuelve el modelo
  —vertical contra la lista, fechas contra `YYYY-MM-DD`, importes numéricos y no
  negativos, extras sólo de texto— en vez del `as SearchParams`, que no comprueba
  nada. El fichero estaba al 0 % de cobertura; ahora tiene spec (14 casos).
- **S7** un único mensaje para cualquier fallo de credenciales. El texto "Esta
  cuenta usa acceso con Google o Meta" sólo aparecía si el email existía, así que
  el login servía de buscador de cuentas. El test compara los tres mensajes
  (email inexistente, cuenta social, contraseña mala) y exige que sean idénticos.
- `CrearReservaDto.comercioId` y `.vertical` pasan a opcionales y marcados como
  `@deprecated`: el contrato refleja ya que la fuente de verdad es el servicio.

**Decisión declarada:** el `?? VerticalKey.ALOJAMIENTO` de
`reserva-wizard.component.ts:2012` se deja como está. La ruta `:vertical/:servicioId`
garantiza el parámetro, y con S2 en su sitio un valor equivocado devuelve 409 en
vez de crear una reserva mal atribuida. Tocarlo sería churn sin un fallo detrás.

### F5 — Recuperación de contraseña (cerrada)

- **S12** dos endpoints nuevos: `POST /auth/recuperar-password` (202 siempre,
  exista o no la cuenta) y `POST /auth/restablecer-password`, que devuelve la
  sesión ya iniciada.
- El token se guarda **hasheado** (SHA-256) en `recuperacionTokenHash`: en claro,
  cualquiera con lectura sobre la colección podría tomar la cuenta de otro. Se
  consume en la misma escritura que fija la contraseña, así que el enlace del
  correo sirve una sola vez. Caduca en 1 hora, no en 24 como la verificación:
  este enlace da acceso, no sólo activa.
- Las cuentas sólo sociales no reciben enlace: crearles contraseña por esta vía
  permitiría entrar sin pasar por el proveedor que verificó el email.
- Quien demuestra tener acceso al buzón queda con el email dado por verificado;
  si no, se quedaría con la contraseña cambiada y sin poder entrar.
- Frontend: `/auth/recuperar` y `/auth/restablecer` (+ specs, 14 casos). El login
  **ya enlazaba a `/auth/recuperar`**, una ruta que no existía: el botón
  "¿Olvidaste tu contraseña?" llevaba a una pantalla en blanco.

### F6 — Cobertura (cerrada)

Objetivo de CLAUDE.md §20 alcanzado en los dos workspaces, y umbrales subidos a
80/80/80/80 (antes 70/56/58/70 en el API y 80/70/74/80 en la web).

| | statements | branches | functions | lines |
|---|---|---|---|---|
| API — antes | 86,16 % | 75,08 % | 78,15 % | 86,66 % |
| **API — ahora** | **93,06 %** | **80,40 %** | **90,20 %** | **93,59 %** |
| Web — antes | 83,10 % | 71,01 % | 77,39 % | 85,28 % |
| **Web — ahora** | **89,38 %** | **80,06 %** | **85,11 %** | **90,68 %** |

Suites: API 83 → **103** (1.236 tests), Web 109 → **118** (1.721 tests), más el
workspace `libs/shared`, que no tenía ninguna.

Se cubrieron los 0 % críticos (`jwt.strategy`, `domain-exception.filter`,
`stripe.gateway`, `ai-search.service`, `auth.interceptor`, `role.guard`,
`rs-button`, `rs-input`), los 9 controllers del API sin test y los repositorios
flojos, además de los mayores huecos de ramas del frontend.

**Flakiness resuelta, no enmascarada.** La suite del API fallaba un `describe`
distinto en cada ejecución y siempre pasaba aislada. La causa no era el código:
Jest lanzaba un worker por CPU (19 aquí), cada uno con ts-jest, el grafo de
NestJS y todos los schemas de Mongoose; el equipo se iba a swap y suites de 5 s
pasaban de 130. Con `maxWorkers: '50%'` la suite bajó de **433 s estimados a
33 s** y dejó de fallar. Mismo ajuste en la web.

**Bug encontrado escribiendo los tests** (`comercio-reservas.component.ts`): la
clave de cada celda del calendario se generaba con `toISOString()` —UTC— pero se
comparaba contra medianoche **local**, así que sólo coincidían en UTC+0. En
España pulsar un día del calendario filtraba las reservas de otro día, o de
ninguno. Corregido con `claveDia`/`desdeClaveDia` y dos tests de regresión.

### F7 — E2E del flujo crítico (cerrada)

- **API** `test/reserva-pago.e2e-spec.ts` (16 casos): buscar → reservar → pagar →
  confirmar, con Nest y Mongo en memoria reales. Stripe es lo único simulado (se
  inyecta por `overrideProvider`, añadido a `crearAppE2E`). Cubre que el buscador
  esconde los comercios suspendidos, que la reserva deriva comercio y vertical
  del servicio (409 si el cliente miente), que el intent cobra el mismo importe
  que la reserva, que el webhook confirma, que una firma falsa se rechaza y que
  un webhook repetido no duplica nada.
- **Web** `e2e/reserva.spec.ts` (8 casos × 2 dispositivos): el mismo recorrido en
  navegador real, rellenando el formulario y los consentimientos como una
  persona, y comprobando el encadenado reserva → cobro.
- Total E2E: API 33 casos, web 24 (escritorio + móvil).

### Extra — Censo de municipios en `/explora` (cerrado 2026-08-18)

Fuera del plan de auditoría, a petición posterior: cargar
`docs/municipios_final.xlsx` en `/explora`.

La hoja censa los **542 municipios de la Comunitat Valenciana** (Alicante 141,
Castellón 135, Valencia 266) con tres columnas de recursos caninos. De ahí salen
**117 fichas** para la colección `lugares`, que es donde vive el contenido
pet-friendly no reservable:

| Columna del Excel | Tipo en `lugares` | Fichas |
|---|---|---|
| Playa canina | `playa` | 18 |
| Rio | `rio` | 94 |
| Pipican | `parque` | 5 |

- `core/lugares/municipios-cv.ts` (+ spec, 24 casos) hace la conversión: es lo
  que tiene la lógica y por eso vive fuera del script. Normaliza el nombre del
  municipio del formato INE (`Campello, el` → `El Campello`), distingue cuándo el
  paréntesis de la hoja es el **nombre** del sitio (`Cala Rocío`) y cuándo es una
  **aclaración** (`junto a la playa canina`), y marca las playas de acceso
  `Parcial` para que nadie conduzca hasta allí en agosto y se lo encuentre
  cerrado.
- `scripts/sembrar-lugares-cv.ts`: lee el fichero y guarda. Idempotente (upsert
  por tipo + ciudad + nombre), simula por defecto.
- Las fichas se publican directamente: la moderación existe para lo que aporta la
  comunidad, y esto es un censo revisado que se carga desde el servidor.
- **Filtro de provincia** en `/explora` (el backend ya lo soportaba, la UI no lo
  exponía). Sin él, el listado devuelve las 24 primeras fichas y casi todas son
  tramos del mismo río.

```
bun run --cwd apps/api sembrar:lugares-cv                  # simulación
bun run --cwd apps/api sembrar:lugares-cv -- --aplicar
bun run --cwd apps/api sembrar:lugares-cv -- --aplicar --geo
```

**El `--geo` importa.** El Excel no trae coordenadas, y sin ellas las fichas
salen en el listado y en los filtros pero **no en el mapa ni en "cerca de mí"**,
que es la mitad del valor de `/explora`. Con el flag se geolocaliza cada
municipio contra Places (New) —la misma API que usa `GeoService`— con una
consulta por municipio (~111) y una pausa entre ellas.

### Ejecución contra la base de datos (2026-08-18)

Los tres scripts se ejecutaron contra el Atlas configurado en `apps/api/.env`.

| Script | Resultado |
|---|---|
| `backfill:comercio-activo -- --aplicar` | 18 listados marcados; 0 visibles (ver abajo) |
| `redondear:importes -- --aplicar` | 0 reservas en la base: no había nada que redondear |
| `sembrar:lugares-cv -- --aplicar --geo` | **117 fichas creadas, 117 con coordenadas** |

Estado de `/explora` tras la carga: 18 playas, 94 tramos de río y 5 zonas
caninas, todas con punto en el mapa. Por provincia: Valencia 62, Alicante 34,
Castellón 21.

**Corregido de paso:** los scripts nuevos no fijaban los servidores DNS y morían
con `querySrv ECONNREFUSED` al resolver `mongodb+srv://` — sólo `main.ts` y
`seed-admin` lo hacían. Se extrajo a `scripts/entorno.ts`, que carga el `.env` y
fija los DNS antes de conectar, y lo usan los tres.

---

## 6. Dos cosas que quedan en tus manos

### 6.1 La clave de Google Maps está suspendida

`GOOGLE_MAPS_API_KEY` devuelve `403 CONSUMER_SUSPENDED` (proyecto
`788247983221`). No es un problema del código y no se puede arreglar desde aquí:
es facturación o una suspensión en Google Cloud.

**No afecta sólo a la siembra.** Con esa clave caída se quedan sin funcionar, en
la aplicación en marcha:

- el autocompletado de dirección del alta de comercio → los negocios nuevos se
  publican **sin coordenadas** y no salen en el mapa del buscador;
- el autocompletado de población del buscador;
- el cálculo de trayecto del vertical de transporte, que cae a la estimación en
  línea recta (marcada como tal, pero menos exacta).

Para la siembra se resolvió cayendo a Nominatim (OpenStreetMap), el mismo
respaldo que ya usa el mapa del frontend cuando falta la clave. `--geo` ahora
prueba Google una sola vez y, si no responde, cambia de fuente y lo dice.

### 6.2 El catálogo está vacío por datos huérfanos, no por la migración

Estado real de la base hoy:

- **1 comercio**: "Comercio Test", activo, **sin ningún listado**.
- **18 servicios publicados** que apuntan a 5 comercios (`b00000000000000000000001`
  … `0005`) que **no existen** en la colección. Son restos de una siembra
  anterior; el seeder actual usa el prefijo `e0`.
- **0 reservas.**

Por eso el buscador devuelve 0: no es que la migración lo haya vaciado, es que no
hay ni un listado con comercio detrás. Con el filtro anterior esos 18 se veían,
pero eran irreservables de todos modos — la reserva se habría atribuido a un
comercio inexistente.

Para tener catálogo:

```
bun run --cwd apps/api seed:europe     # 6 comercios activos + sus listados
```

Es aditivo (sólo limpia y recrea lo suyo, con prefijo `e0`): no toca los 18
huérfanos ni el comercio de prueba. Borrar los huérfanos es decisión tuya; se
dejan porque nadie los ve y no estorban.

Para comprobar cómo está la base en cualquier momento:

```
bun run --cwd apps/api diagnostico:catalogo   # sólo lectura
```

### Estado por fase

| Fase | Estado | Cerrada |
|---|---|---|
| F0 — Blindaje de entrada | **cerrada** | 2026-08-17 |
| F1 — Autorización | **cerrada** | 2026-08-17 |
| F2 — Camino del dinero | **cerrada** | 2026-08-18 |
| F3 — Entrada y consistencia | **cerrada** | 2026-08-18 |
| F4 — Bugs funcionales | **cerrada** | 2026-08-18 |
| F5 — Recuperación de contraseña | **cerrada** | 2026-08-18 |
| F6 — Cobertura | **cerrada** | 2026-08-18 |
| F7 — E2E del flujo crítico | **cerrada** | 2026-08-18 |
