# Plan de implementación — Mejora de servicios

> Plan técnico de ejecución para `docs/mejora_servicios.md` / `docs/HISTORIAS-USUARIO-MEJORA-SERVICIOS.md`, construido sobre el roadmap de `ANALISIS-ESPECIFICACIONES.md` §6. Este documento es el **estado de avance vivo**: se actualiza el checklist a medida que se completan tareas. Si el desarrollo se corta, retomar leyendo la sección "Estado actual" al final.

## Decisiones de modelado tomadas

Resolviendo `ANALISIS-ESPECIFICACIONES.md` §7 con la información disponible en el documento del cliente y las convenciones ya existentes en el código:

| # | Decisión | Resolución |
|---|---|---|
| 1 | Mercado/moneda | EUR + IVA 21%, Europa. Ya es lo asumido por `CLAUDE.md` y el código — confirmado, sin cambios. |
| 2 | Hotel pet-friendly vs residencia | **Discriminador separado**: nuevo `VerticalKey = 'hoteles'`. Mismo patrón que los 5 verticales existentes (schema discriminator + `AvailabilityStrategy` + `PricingStrategy` propios). No es un flag dentro de `alojamiento`. |
| 3 | Cobro del suplemento | **Segundo `PaymentIntent`** por la diferencia cuando el cliente acepta (reutiliza el patrón de pago ya existente en `payments`, más simple que pre-autorización ampliada). Si rechaza: reembolso del `PaymentIntent` original + cancelación. |
| 4 | Excepción veterinaria | Confirmada por el cliente: Doogking comisiona **solo** el importe de la consulta inicial reservada. Pruebas/tratamientos extra son fuera de plataforma. |
| 5 | Especies (Perro vs Mascota) | La entidad se llama `Perro` en el MVP (el documento es ~95% canino). Se añade campo `especie` (default `'perro'`) para no bloquear la generalización a otras especies en veterinaria/hotel (Fase D), sin renombrar la entidad ahora. |
| 6 | Consentimiento RGPD historial | Campo simple `autorizaCompartirHistorial: boolean` (default `true`) en `Perro` para el MVP. Modelo de consentimiento granular por profesional/reserva se deja para una fase posterior si el negocio lo requiere. |
| 7 | Seguros: mediador vs derivador | **Abierta** — no bloquea Fase A/B/C. Se resuelve antes de empezar Fase D.1 (Seguros). |
| 8 | Proveedor de mapas (Comunidad) | **Abierta** — no bloquea nada anterior. Se resuelve antes de Fase D.2 (Comunidad). |
| 9 | Transporte recurrente | Se modela como una **serie de reservas generadas por un patrón simple** (`recurrencia: { dias[], hora, fechaFin }` en la reserva origen que genera reservas hijas), no como infraestructura de scheduler nueva. |
| 10 | Paseadores / cuidadores a domicilio | Nuevos verticales — **Fase D**, alcance a confirmar con el cliente antes de empezar. |

---

## Fase A — Cimientos transversales (P0)

*Desbloquea todo lo demás. Es la única fase con dependencias duras entre tareas.*

### A1. Entidad `Perro` (Ficha Inteligente) — ✅ completado 2026-07-18 (backend)
- [x] `apps/api/src/core/perros/perro.schema.ts` + `perro-historial.schema.ts` (colecciones `perros` y `perro_historial`).
- [x] `perros.service.ts` + `perros.controller.ts` + `perros.module.ts` — CRUD propio + historial (comercio añade notas vía `POST /perros/:id/historial`, cliente lista vía `GET /perros/:id/historial`).
- [x] DTOs en `libs/shared/src/dtos/perros/` + enums `TamanoPerro`, `TipoPelo`, `SexoPerro`, `NivelSociabilidad` en `libs/shared/src/enums/perro.enum.ts`.
- [x] Tests `perros.service.spec.ts` + `perros.controller.spec.ts` (16 tests, todos verdes).
- [ ] **Pendiente:** UI "Mis perros" en frontend (ver A2/A3 frontend, tarea #8 del backlog de sesión).

### A2. `Reserva.perroId` + snapshot — ✅ completado 2026-07-18 (backend)
- [x] `reserva.schema.ts`: `perroId?: ObjectId`, `perroSnapshot?: Record<string,unknown>`.
- [x] `bookings.service.ts`: `crear()` valida ownership del perro (`perrosService.obtenerPropio`) y congela snapshot vía `perro-snapshot.util.ts` **antes** de reservar el slot (falla rápido, no deja holds huérfanos).
- [x] `CrearReservaDto.perroId` opcional (no obligatorio aún por vertical — eso es trabajo de Fase C cuando cada vertical defina si lo requiere).
- [ ] **Pendiente:** selector de perro en `reserva-wizard.component.ts` (frontend, tarea #8).

### A3. Ciclo de suplementos y evidencias — ✅ completado 2026-07-18 (backend)
- [x] `ReservaEstado.AJUSTE_SOLICITADO` (un único estado nuevo, no 3 — simplificación deliberada: aceptar vuelve a `CONFIRMADA`, rechazar va a `CANCELADA`, ambos ya soportados por el resto del sistema).
- [x] `reserva.schema.ts`: `suplementos: SuplementoAplicado[]`, `montoAjustado?`, `ajusteSolicitadoAt?`, `ajusteResueltoAt?`, `evidencias: EvidenciaReserva[]` (interfaces TS + `@Prop({type:[Object]})`, mismo patrón que `EspacioCanino` en alojamiento).
- [x] `apps/api/src/core/suplementos/` — módulo nuevo completo (`suplemento-config.schema.ts` colección `suplemento_configs`, service, controller `POST/GET mis/PATCH/DELETE /suplementos`, module). **Nota:** catálogo desacoplado de la validación del ajuste (Fase A no valida que los suplementos elegidos vengan del catálogo — es una ayuda de UI, no una restricción server-side; se puede endurecer en Fase B si hace falta).
- [x] `BookingsService`: `solicitarAjuste` (comercio, valida CONFIRMADA, recalcula subtotal/IVA/total), `validarAjustePendiente`, `confirmarAjuste` (idempotente, llamado solo desde el webhook), `rechazarAjuste`.
- [x] `ComerciosService/Controller`: `PATCH mis-reservas/:reservaId/solicitar-ajuste` (mismo patrón que `completarReserva`).
- [x] `PaymentGateway.reembolsar()` + implementación Stripe (`stripe.refunds.create`).
- [x] `Pago.esSuplemento: boolean` — un 2º `PaymentIntent`/`Pago` por la diferencia, no se reutiliza el pago original.
- [x] `PaymentsService.aceptarAjuste` (cobra diferencia, nuevo Pago `esSuplemento:true`) + `.rechazarAjuste` (reembolsa el Pago original `APROBADO` más reciente + cancela reserva) + `procesarWebhook` ahora bifurca: si `pago.esSuplemento` → `confirmarAjuste`, si no → flujo `confirmar` de siempre.
- [x] `PaymentsController`: `POST payments/reservas/:id/ajuste/aceptar` y `.../rechazar`.
- [x] Recalcula comisión sobre el monto ajustado (mantiene el % de comisión efectivo de la reserva original: `comisionMonto/montoSubtotal`). La excepción de veterinaria (comisión solo sobre consulta inicial) **no aplica todavía** porque el flag `esPrecioCerrado`/`esPrecioOrientativo` es trabajo de Fase C — cuando se añada, `solicitarAjuste` deberá comprobarlo antes de permitir el ciclo en ese vertical.
- [x] Tests: 22 en `bookings.service.spec.ts` (incluye ajuste), 12 en `payments.service.spec.ts` (incluye aceptar/rechazar/webhook suplemento), 9+4 en `suplementos.*.spec.ts`, más los delegates en `comercios.service.spec.ts`/`comercios.controller.spec.ts`. Total 85 tests en los módulos tocados, todos verdes.
- [ ] **Pendiente (no bloqueante):** plantillas de `notifications` para avisar al cliente del ajuste solicitado — hoy el cliente solo se entera si consulta la reserva; falta el email/push proactivo. UI de comercio (botón solicitar ajuste) y UI de cliente (aceptar/rechazar) — tarea #9 del backlog de sesión.

### A4. Verificación — ✅ completado 2026-07-18
- [x] `npm run build --workspace=shared` + `npx tsc --noEmit` en `apps/api` — sin errores.
- [x] `npx nest build` — sin errores.
- [x] Test suite completo de `apps/api`: 187/188 (el único fallo es un timeout preexistente de bcrypt en `comercios.service.spec.ts` no relacionado, confirmado pasando en aislado).
- [x] `npx tsc --noEmit` en `apps/web` — sin errores.
- [x] `ng build --configuration production` — sin errores (solo warnings preexistentes de CommonJS en `class-validator`, no bloquean).
- [x] `npx jest` en `apps/web`: 81/81 verdes (se corrigió un mock de test desactualizado en `comercio-reservas.component.spec.ts` que no incluía el nuevo método `getMisSuplementos`).
- [ ] Prueba manual end-to-end con Stripe en modo test — no ejecutada esta sesión (requeriría levantar el stack completo + claves de Stripe test); el flujo de pago replica exactamente el patrón ya probado del wizard de reservas.

### A5. Frontend — ✅ completado 2026-07-18
- [x] `apps/web/src/app/features/perros/` — `perros.service.ts`, `perros-lista.component.ts` (listado + eliminar), `perro-form.component.ts` (alta/edición, reutiliza el mismo componente para ambos casos vía route param `:id`), `perros.routes.ts`. Registrado en `app.routes.ts` bajo `/perros` (authGuard) y enlazado desde `perfil-dashboard.component.ts`.
- [x] Selector de perro en `reserva-wizard.component.ts` (paso 1, común a los 5 verticales) — carga `misPerros()` en `ngOnInit`, preselecciona si solo hay uno, añade `perroId` a los 6 branches de `buildPayload()`.
- [x] Panel comercio: `comercio-suplementos.component.ts` (CRUD del catálogo, ruta `/comercio/suplementos`, nav item nuevo) + botón "Solicitar ajuste" en `comercio-reservas.component.ts` (panel expandible por fila: checkboxes del catálogo + `rs-image-upload` para evidencia + total en vivo).
- [x] Cliente: banner "ajuste pendiente" en `mis-reservas.component.ts` cuando `estado === 'ajuste_solicitado'` → enlaza a `apps/web/src/app/features/reservas/components/ajuste-pago.component.ts` (ruta `/reservas/:codigo/ajuste`), que replica el patrón Stripe Elements del wizard para cobrar la diferencia, con botón alternativo "Rechazar y cancelar".

**Fase A queda 100% completa** (backend + frontend + build verificado). Lo único explícitamente diferido: notificación proactiva (email/push) al cliente cuando se solicita un ajuste — hoy se entera al entrar a "Mis reservas" y ver el banner, no por email. Se puede añadir en cualquier momento sin cambios de modelo.

---

## Fase B — Inteligencia por perfil (P1)

**Estado: ✅ completada 2026-07-18.** Verificación: `tsc` (shared+api+web) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **241/241 tests backend**, **85/85 tests frontend**.

### B1. Motor de compatibilidad servicio↔perro — hecho
`Servicio.aptitud?: { tamanosAdmitidos?, tipoPeloAdmitido?, temperamentosNoAdmitidos? }` — campo genérico en el schema base (no por vertical), con `AptitudPerroDto` (`libs/shared/src/dtos/catalog/aptitud-perro.dto.ts`) en `CrearServicioDto`/`ActualizarServicioDto`. `CatalogRepository.construirFiltro` añade condiciones Mongo (`$or`/`$ne`) cuando se pasa `perfilPerro`; array vacío/ausente = sin restricción en ese eje. `CatalogService.buscarServicios` acepta `perroId`, resuelto vía `PerrosService.obtenerPerfilCompatibilidad` (nuevo método sin exigir propiedad, solo expone tamano/tipoPelo/temperamento). `GET /catalog/servicios?perroId=...`. Frontend: sección "¿Para qué perros es apto?" en `comercio-listado-form.component.ts`; selector "Solo apto para [mi perro]" en `alojamiento-lista.component.ts`, propagado hasta el wizard vía queryParams.

### B2. Reputación bidireccional — hecho
Nueva colección `perro_valoraciones` (comercio→perro, una por reserva, `puntuacion` + `atributos` libres + `comentario?`). `PerroValoracionesService` en el módulo `perros` (inyecta el modelo `Reserva` directamente para evitar ciclo con `BookingsModule`): `crear` (valida COMPLETADA/del comercio/del perro/no duplicada), `listarPorPerro`, `indiceComportamiento` (agregado público, sin exigir propiedad — pensado para cualquier profesional al reservar, como pide el "pasaporte digital"). Endpoints en `PerrosController`: `POST/GET :id/valoraciones`, `GET :id/indice-comportamiento`. Frontend: badge "★ promedio (N)" en `perros-lista.component.ts`; botón "★ Valorar perro" en `comercio-reservas.component.ts` para reservas completadas.

### B3. Recomendador de servicio — hecho
Módulo nuevo `apps/api/src/core/recomendador/` (sin persistencia, reglas puras): `recomendarAdiestramiento` (edad≤6 meses→curso cachorros; agresividad/protección de recursos→valoración previa, bloquea grupales si intensidad≠leve; resto→individual o grupal libre) y `recomendarVeterinaria` (gravedad grave/emergencia o síntoma urgente→urgencias inmediatas; vacunación→reserva directa; resto→consulta general). `POST /recomendador/adiestramiento`, `POST /recomendador/veterinaria`. Frontend: campos motivo/intensidad (adiestramiento) y motivo/gravedad (veterinaria) añadidos al paso 1 del wizard (no reemplazan los campos existentes); banner con el mensaje; "programa completo" se deshabilita y fuerza "sesión suelta" cuando `bloqueaGrupales`.

## Fase C — Enriquecer los 5 verticales existentes + Hotel pet-friendly (P1)

Un discriminador cada vez, en este orden (de menor a mayor complejidad de schema):
1. **Peluquería** — ✅ completado 2026-07-18. Matriz precio×tamaño, `tipoPeloCompatible`, `estadoManto` + suplementos, `politicaTemperamento`, servicios adicionales tipados. Ver detalle en "Fase C.1 — Peluquería" más abajo.
2. **Residencia** — ✅ completado 2026-07-18. Tipos de alojamiento activables por click, tamaño opcional, compatibilidad social, requisitos sanitarios configurables (no obligatorios globalmente), suplementos €/día. Ver detalle en "Fase C.2 — Residencia" más abajo.
3. **Hotel pet-friendly** — ✅ backend + frontend completo 2026-07-18 (política de mascotas, suplementos por mascota, servicios petfriendly, normas). Ver detalle en "Fase C.3 — Hotel pet-friendly" más abajo. **Pendiente**: paquete "Vacaciones Doogking" (carrito multi-vertical) — no implementado, requiere un módulo de carrito/checkout combinado que no existe hoy; se deja para cuando el negocio priorice esa combinación de verticales.
4. **Adiestramiento** — ✅ completado 2026-07-18. Catálogo de técnicas por checkbox, Nivel Doogking. Ver detalle en "Fase C.4 — Adiestramiento" más abajo. **Pendiente/fuera de alcance**: cuestionario de comportamiento extendido (historial previo, vínculo propietario-mascota, etc. — capturado hoy vía el campo libre de peticiones especiales, no como campos estructurados) y el objeto "plan personalizado/bono" con negociación en 4 niveles (valoración→plan→sesiones→seguimiento) — requeriría un flujo de negociación propio que no existe; se puede aproximar hoy con el ciclo de ajuste/suplemento genérico de Fase A.
5. **Veterinaria** — ✅ completado 2026-07-18. `esPrecioCerrado`, especies múltiples, Historia Veterinaria Compartida. Triaje ya existía desde Fase B (`RecomendadorService.recomendarVeterinaria`). Ver detalle en "Fase C.5 — Veterinaria" más abajo.
6. **Transporte** — campos obligatorios/opcionales explícitos, comportamiento en viaje, recurrencia (serie de reservas), ida-vuelta-espera.

### Fase C.1 — Peluquería (detalle, ✅ completado 2026-07-18)

El schema/estrategia backend (`peluqueria.schema.ts`, `peluqueria-availability.strategy.ts`, DTOs, `AptitudPerro` genérico de Fase B) ya existían de una sesión anterior a esta; esta sesión completó las piezas que faltaban para que el enriquecimiento funcionara de punta a punta:

- **Bug corregido**: `CatalogService.pickExtra()` no incluía los campos nuevos de peluquería (`politicaTemperamentoDificil`, `bozalObligatorioSiAgresivo`, `serviciosAdicionales`, `razasEspecificas`, `requiereVacunasAlDia`, `requiereMicrochip`) — estaban modelados en el schema y en `CAMPOS_EXTRA_POR_VERTICAL` (vista de gestión del comercio) pero nunca llegaban al `extra` público que consume el frontend. Corregido + test en `catalog.service.spec.ts`.
- **Ficha Inteligente conectada al precio real**: `BookingsService.crear()` ahora enriquece `parametrosExtra` con `perroTamano`/`perroTipoPelo` tomados del `perroSnapshot` (claves nuevas, no pisan `tamanoPerro` que ya usa alojamiento manualmente) — el cliente ya no tiene que re-indicar el tamaño/pelo de su perro, la matriz `preciosPorTamano` se aplica sola.
- **Bloqueo real de `tipoPeloCompatible`**: `PeluqueriaAvailabilityStrategy.validarCompatibilidadPelo` lanza 409 si el servicio de grooming solicitado no admite el tipo de pelo del perro (antes el campo existía en el schema pero no se usaba para nada). Tests en `peluqueria-availability.strategy.spec.ts` (matriz de tamaño + compatibilidad de pelo, 6 casos nuevos).
- **Panel comercio** (`comercio-listado-form.component.ts`): sección de peluquería ampliada — matriz `preciosPorTamano` anidada por servicio de grooming, checkboxes de `tipoPeloCompatible` por servicio, política ante temperamento difícil, bozal obligatorio, servicios adicionales (filas nombre+precio), razas específicas, requisitos de vacunas/microchip.
- **Wizard de reserva** (`reserva-wizard.component.ts`): ya no usa una lista estática de servicios de grooming — carga el servicio real vía `CatalogBrowseService.obtener()` (método nuevo, con spec), filtra las opciones por el `tipoPelo` del perro seleccionado, muestra el precio ajustado por `tamano`, y banners informativos de política de temperamento/bozal/servicios adicionales.
- **Gap de tests pre-existente identificado, no resuelto**: ni `reserva-wizard.component.ts` ni `comercio-listado-form.component.ts` tienen spec propio (archivos grandes, ~1000+ líneas, con integración Stripe/reactive forms multi-vertical) — la brecha ya existía antes de esta sesión y no se retrofiteó un spec completo por ser una tarea aparte de gran tamaño, desproporcionada al alcance de "continuar Fase C". Sí se añadió spec a los archivos nuevos/tocados que son razonablemente testeables de forma aislada (`catalog-browse.service.spec.ts`, más los backend ya mencionados).

Verificación: `tsc` (api+web) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **249 tests backend** (41 suites, +8 sobre el baseline de Fase B), **88 suites frontend**, todos verdes.

**Siguiente en el roadmap**: Fase C.2 — Residencia (tipos de alojamiento activables por click, compatibilidad social, requisitos sanitarios configurables, suplementos €/día).

### Fase C.2 — Residencia (detalle, ✅ completado 2026-07-18)

"Residencia" = el vertical `alojamiento` ya existente (es el más maduro: tiene páginas dedicadas de lista/detalle, a diferencia de peluquería/veterinaria/adiestramiento que comparten `vertical-browse.component.ts`). Cambios:

- **Bug de correctitud corregido**: `AlojamientoAvailabilityStrategy.checkAvailability` siempre usaba `espacios[0]` para calcular el precio, ignorando por completo qué `espacioId` había elegido y pagado el cliente en `alojamiento-detalle.component.ts`. Con varios tipos de espacio configurados esto significaba cobrar el precio equivocado. Corregido: `espacioSolicitado()` busca por `espacioId`; si no se indica, cae al primero con cupo (antes ni siquiera comprobaba cupo del primero).
- **`tamanoMaxPerro` ahora opcional** en `EspacioCanino` (antes era obligatorio pese a que el documento del cliente pide que sea configurable — "en mi residencia el tamaño no importa"). Sin restricción declarada = admite cualquier tamaño.
- **Nuevo bloqueo de compatibilidad de tamaño**: si el espacio declara `tamanoMaxPerro` y se conoce el tamaño del perro (`perroTamano` desde la Ficha, o `tamanoPerro` manual como fallback para reservas sin perro registrado), se bloquea (409) si el perro no cabe.
- **Nuevo campo `compatibilidadSocialAdmitida: string[]`** (cualquiera/solo_pequenos/solo_machos/solo_hembras/individual) — la residencia declara qué perfiles admite; el cliente declara el de su perro al reservar (nuevo select en el wizard); se bloquea (409) si no coincide. Mismo patrón que `tipoPeloCompatible` de peluquería (Fase C.1).
- **Nuevos campos informativos** (sin bloqueo, mismo patrón que los requisitos de peluquería): `requisitoMicrochip`, `requiereDesparasitacionInterna`, `requiereDesparasitacionExterna`, `requiereVacunaTosPerreras`, `serviciosAdicionales` (catálogo nombre+precio).
- **Bug corregido en `CatalogService`**: los campos nuevos de alojamiento no llegaban ni al `extra` público ni al `ServicioDetalleDto` (que tiene su propio mapeo explícito `toDetalle()`, distinto de peluquería que sí usa `extra` directamente) — había que actualizar `pickExtra()` **y** `toDetalle()`/`ServicioLean` para que `AlojamientoService.obtener()` (frontend) los reciba.
- **Tipos de espacio ampliados**: `TipoEspacio` pasa de 3 a 5 valores (+ `premium`, `climatizada`) en frontend y backend; `tipoLabel()`/`tamanoLabel()` actualizados (incluye `mini`, que faltaba).
- Frontend: `comercio-listado-form.component.ts` (checkboxes de compatibilidad social, requisitos sanitarios, servicios adicionales, tamaño opcional en cada espacio), `alojamiento-detalle.component.ts` (muestra los requisitos/compatibilidad/servicios adicionales al cliente), `reserva-wizard.component.ts` (nuevo select de compatibilidad social del perro).

Verificación: `tsc` (api+web, incluyendo `tsconfig.spec.json` que detectó fixtures desactualizados) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **257 tests backend** (+8 sobre Fase C.1), **88 suites frontend**, todos verdes.

**Siguiente en el roadmap**: Fase C.3 — Hotel pet-friendly (nuevo discriminador `hoteles`).

### Fase C.3 — Hotel pet-friendly (detalle, ✅ completado 2026-07-18)

Vertical nuevo desde cero (a diferencia de C.1/C.2 que enriquecían verticales existentes), siguiendo el patrón de extensibilidad del core (§3.3 de este documento): schema discriminador + `AvailabilityStrategy` + auto-registro, sin tocar el core.

**Backend** (`apps/api/src/verticals/hoteles/`):
- `VerticalKey.HOTELES = 'hoteles'` en `libs/shared`.
- `hoteles.schema.ts`: `admiteMascotas`, `maxMascotasPorReserva`/`pesoMaximoMascotaKg` (sin límite si no se indican), `razasRestringidas` (ninguna/ppp/razas_gigantes/especificas) + lista específica, `especiesPermitidas`, `suplementoPorTamanoMascota[]` (€/noche por tamaño), `suplementoSegundaMascotaPorNoche`, `serviciosPetfriendly[]`, normas (puede quedarse solo/acceso zonas comunes/correa/bozal), `checkIn/checkOut`, `fianza`, `unidadesDisponibles`.
- `hoteles-availability.strategy.ts`: precio = `precioBase`(habitación)×noches + suplemento por tamaño×noches + suplemento por mascota adicional×noches×(mascotas−1) — replica el ejemplo exacto del cliente (300€ + 30€ = 330€). Bloquea (409): exceso de mascotas por reserva, peso, especie no admitida, PPP/razas gigantes/razas específicas restringidas.
- `hoteles.module.ts` + `hoteles.seeder.ts` (3 hoteles demo Madrid) siguiendo el patrón exacto de `peluqueria.module.ts`.
- `BookingsService.construirParametrosExtra` ampliado con `perroPeso`, `perroEspecie`, `perroEsPPP`, `perroRaza` (desde el `perroSnapshot`) para que las validaciones de hoteles funcionen sin pedirle estos datos otra vez al cliente.
- `CatalogModule`/`CatalogService` (`CAMPOS_EXTRA_POR_VERTICAL`, `pickExtra`, `CAMPOS_DISPONIBILIDAD_POR_VERTICAL`, `CAMPOS_REQUERIDOS_POR_VERTICAL`) registrados para `hoteles`.

**Frontend**: como los demás verticales sin página dedicada (veterinaria/peluquería/adiestramiento), reutiliza `vertical-browse.component.ts` (nueva entrada en `CONFIGS` + ruta `/hoteles` en `app.routes.ts`) en vez de crear páginas propias de lista/detalle. `comercio-listado-form.component.ts` tiene su sección completa de creación/edición; `reserva-wizard.component.ts` tiene su paso 1 (check-in/out, nº mascotas, tamaño). Añadido también a los sitios con mapas `Record<VerticalKey,...>` no exhaustivos que el compilador no fuerza a actualizar: home (tarjeta de categoría + icono `building`), buscador (pestaña + ruta), `vertical-icon.ts`, `mis-reservas`/`reserva-detalle` (iconos/labels), panel admin (comercios/reportes).

**Nota de alcance**: el "paquete Vacaciones Doogking" (hotel + guardería + peluquería + transporte en un solo carrito, docs §6.4) NO está implementado — requeriría un módulo de carrito multi-vertical que no existe en el sistema actual (cada reserva es independiente, un vertical, un pago). Cada servicio individual (hotel, peluquería, transporte) ya es reservable por separado hoy.

Verificación: `tsc` (api, web app, web spec) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **275 tests backend** (+18 sobre Fase C.2: 17 del nuevo vertical hoteles + 1 de bookings.service), **88 suites frontend** (2 specs con listas exhaustivas de verticales tuvieron que actualizarse: `home.component.spec.ts`, `buscador.component.spec.ts`).

**Siguiente en el roadmap**: Fase C.4 — Adiestramiento (catálogo de técnicas por checkbox, cuestionario de comportamiento, plan personalizado/bono, "Nivel Doogking").

### Fase C.4 — Adiestramiento (detalle, ✅ completado 2026-07-18)

- `adiestramiento.schema.ts`: nuevo catálogo estructurado `serviciosAdiestramiento[]` (nombre, tipo: valoración/individual/grupal/curso/especial, precio, duración, máx. perros, edad mín/máx, lugar, material necesario) — mismo patrón que `serviciosGrooming` (peluquería) y `serviciosClinicos` (veterinaria). Nuevo `valoracionInicial?: { modalidad, precio }`.
- `AdiestramientoAvailabilityStrategy`: si el cliente solicita un servicio del catálogo por nombre, usa su precio/maxPerros/edad mín-máx propios (con fallback a los campos genéricos `precioSesion`/`precioPrograma`/`capacidadPorSesion`/`edadMinimaMeses` si no se especifica o no existe en el catálogo — mismo patrón de fallback que peluquería/residencia).
- **Nivel Doogking activado**: el campo `Perro.nivelDoogking` existía en el schema desde Fase A pero nunca se actualizaba (campo muerto). Ahora `PerroValoracionesService.crear()` — el mismo mecanismo de reputación bidireccional de Fase B — actualiza `nivelDoogking` (1-5) cuando la reserva valorada es de adiestramiento y el comercio informa el atributo `nivelDoogking`. No es un promedio: refleja la valoración más reciente del profesional.
- Frontend: `comercio-listado-form.component.ts` (catálogo de servicios/técnicas + valoración inicial), `reserva-wizard.component.ts` (selector de servicio real del catálogo, filtrado por edad del perro), `comercio-reservas.component.ts` (selector de Nivel Doogking en el panel "Valorar perro", solo visible para reservas de adiestramiento), `perros-lista.component.ts` (badge "🎓 Nivel Doogking N/5").
- **Deliberadamente fuera de alcance** (ver tabla de la Fase C más arriba): el cuestionario de comportamiento extendido del documento (historial previo, vínculo propietario-mascota 1-5, semanas con la madre, etc.) no se modeló como campos estructurados nuevos — se apoya en el campo libre de "peticiones especiales" ya existente en el wizard, evitando inflar el schema con datos de bajo reuso fuera de este vertical. El "plan personalizado/bono" con negociación en 4 niveles tampoco se implementó como flujo propio; el ciclo de ajuste/suplemento genérico (Fase A) ya permite a un centro proponer sesiones adicionales tras una valoración inicial.

Verificación: `tsc` (api, web app, web spec) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **282 tests backend** (+7 sobre Fase C.3), **88 suites frontend**, todos verdes.

**Siguiente en el roadmap**: Fase C.5 — Veterinaria (`esPrecioCerrado` vs `esPrecioOrientativo`, especies múltiples, historia clínica compartida, triaje).

### Fase C.5 — Veterinaria (detalle, ✅ completado 2026-07-18)

- `ServicioClinico.esPrecioCerrado?: boolean` — distingue servicios de precio cerrado y comisionable normal (vacunas, microchip, certificados, revisiones postop…) de los de precio orientativo (consulta general, dermatología, urgencias…), donde Doogking solo comisiona el importe inicial reservado (regla ya vigente desde Fase A vía el bloqueo de `solicitarAjuste` para todo el vertical — este campo es informativo/de transparencia hacia el cliente, no cambia esa lógica ya asentada).
- `Veterinaria.especiesAtendidas: string[]` (default `['perro']`) — "no es un vertical solo de perros" (docs §5.1). `VeterinariaAvailabilityStrategy` bloquea (409) si la especie de la mascota (`perroEspecie`, ya enriquecido automáticamente en `BookingsService` desde Fase C.3) no está en la lista.
- **Triaje automático**: ya existía completo desde Fase B (`RecomendadorService.recomendarVeterinaria`) — no se tocó, solo se verificó que sigue alineado con el documento.
- **Historia Veterinaria Compartida** (docs §5.5, el diferencial más pedido de esta sección): nuevo endpoint `GET /perros/:id/historia-veterinaria`, sin exigir propiedad de la ficha (a diferencia de `obtenerPropio`) — cualquier comercio puede consultarlo, bloqueado (403) si el propietario no marcó `autorizaCompartirHistorial`. Devuelve datos de salud (vacunas, alergias, enfermedades, medicación, dieta, documentos) + el historial completo de notas de **todos** los profesionales que atendieron al perro, no solo el que consulta. Reutiliza el `PerroHistorial` ya existente desde Fase A (con su campo libre `datosEstructurados` para que un veterinario pegue resultados de analíticas/Excel, ya cubría esa necesidad del documento).
- Frontend: `comercio-listado-form.component.ts` (checkbox `esPrecioCerrado` por servicio clínico, especies atendidas), `reserva-wizard.component.ts` (selector de servicio real del catálogo con aviso de precio cerrado/orientativo), `comercio-reservas.component.ts` (panel "🩺 Historia veterinaria" para reservas de ese vertical).

Verificación: `tsc` (api, web app, web spec) sin errores, `nest build` sin errores, `ng build --configuration production` sin errores, **292 tests backend** (+10 sobre Fase C.4), **91 suites frontend** (+3), todos verdes.

**Siguiente en el roadmap**: Fase C.6 — Transporte (campos obligatorios/opcionales configurables, comportamiento en viaje, recurrencia, ida-vuelta-espera). Con esto se completaría toda la Fase C.

## Fase D — Módulos nuevos y negocio (P2)

1. **Seguros** — nuevo vertical con semántica de póliza (`polizas` collection, carencias, franquicias, recomendador basado en Ficha del Perro, Índice de Bienestar).
2. **Comunidad "Explora con tu mascota"** — módulo independiente (`lugares`, `lugar_reviews`, `favoritos`, mapa 2dsphere, UGC moderado).
3. **Comisión por tramos + Socios Fundadores** — extender `comision-configs` y `comercios`; alta de verticales `paseadores` y `cuidadores_domicilio`.

---

## Verificación de cumplimiento post-Fase A (2026-07-18)

Auditoría (3 agentes en paralelo, uno por par de verticales) del código real contra `docs/mejora_servicios.md` y `docs/HISTORIAS-USUARIO-MEJORA-SERVICIOS.md`. Resultado: **ningún trabajo oculto** — todo lo que falta ya estaba listado en Fase B/C de este plan. Un hallazgo sí requirió acción inmediata:

**Bug conceptual corregido:** el ciclo de suplementos de Fase A es genérico por reserva y, antes de esta corrección, se podía usar también sobre reservas de **veterinaria** — lo cual viola la regla explícita del documento (§5: Doogking nunca comisiona pruebas/tratamientos extra, solo la consulta inicial reservada; esas pruebas se facturan directamente clínica↔cliente). Corregido: `BookingsService.solicitarAjuste` ahora lanza `DomainException` si `reserva.vertical === VETERINARIA` (con test), y el botón "Solicitar ajuste" se oculta para reservas de veterinaria en `comercio-reservas.component.ts`. El modelo correcto y completo (precio cerrado vs "desde X€") sigue siendo trabajo de Fase C.

**Confirmado sin sorpresas (coincide con lo ya documentado en Fase B/C):**
- Peluquería/Residencia: schemas siguen en su forma pre-mejora, sin matriz precio×tamaño, tipoPeloCompatible, compatibilidad social, ni requisitos configurables. Motor de compatibilidad servicio↔perro no existe.
- Adiestramiento/Transporte: sin catálogo por checkbox, cuestionario, recomendador, ni campos obligatorios/opcionales configurables en transporte. Recomendador de servicio (motivo→recomendación) no existe en ningún sitio.
- Veterinaria: sin especies múltiples, triaje, historia clínica ni distinción precio cerrado/orientativo.
- Hotel pet-friendly: vertical no existe (confirmado, ni el enum `VerticalKey` lo contempla).
- Reputación bidireccional: `reviews` sigue siendo unidireccional (cliente→comercio).

## Auditoría UX y correcciones aplicadas (2026-07-18)

Auditoría del embudo principal (home→buscador→listado→detalle→wizard de reserva, auth, navegación global) vía agente + revisión propia del código nuevo de Fase A. Problemas encontrados y corregidos:

1. **Fechas/perros se perdían entre pantallas** (home→buscador ya funcionaba; buscador→lista de alojamiento ya funcionaba; pero lista→detalle→wizard los descartaba, obligando a reintroducirlos). Corregido: `alojamiento-lista.component.ts` propaga `desde/hasta/perros` como queryParams al detalle (`queryParamsDetalle()`); `alojamiento-detalle.component.ts` los lee y los reenvía al wizard (`checkIn/checkOut/perros`); `reserva-wizard.component.ts` los usa para prellenar `paso1AlojamientoForm` en `ngOnInit`.
2. **Botón "Pagar" sin guard de doble envío**: no tenía `[disabled]` mientras Stripe cargaba o el pago se procesaba (riesgo de doble cobro). Corregido con `[disabled]="procesando() || !stripeListo()"` + estado "Preparando pago…".
3. **Total desincronizado si se vuelve al paso 1 tras preparar Stripe**: cambiar fechas/extras y volver al paso 3 mostraba el importe antiguo. Corregido: `irPaso(1)` resetea `stripeListo/clientSecret/totalFromApi/reservaIdReal` para forzar regenerar el PaymentIntent con el importe actualizado.
4. **Sin "Cerrar sesión" accesible desde la navegación global** (solo dentro de Perfil). Añadido botón "Salir"/"Cerrar sesión" en `rs-navbar.component.ts` (desktop + drawer móvil).
5. **"Mis perros" no estaba en la navegación global** (solo vía Perfil → Configuración). Añadido enlace directo en el navbar.
6. **Paso 2 del wizard sin mensajes de error inline** (el botón "Continuar" solo se deshabilitaba, sin decir qué campo falta). Añadidos `[class.rs-inp--error]` + mensajes por campo (nombre, apellidos, email, teléfono, términos) y `continuarPaso2()` que hace `markAllAsTouched()` si es inválido en vez de solo bloquear el botón.
7. **`<button>` anidado dentro de `<a>`** en `alojamiento-lista.component.ts` (HTML inválido, rompe tab-order y lectores de pantalla) — reemplazado por un `<span>` visual (la card entera ya es el enlace); eliminado el método `verDetalle()` y el `Router` ya no usados.
8. **Bug real en `RsImageUploadComponent`**: en modo `multiple=false` emitía igualmente un array (`string[]`) en vez de un `string`, rompiendo silenciosamente todo formulario en modo single (logo/portada de comercio, avatar de perfil, documentos de verificación, evidencia de ajuste) — el valor guardado no coincidía con lo que esperaba el backend. Corregido `emitValue()` para emitir `string | null` en modo single y `string[]` en modo multiple; añadido `rs-image-upload.component.spec.ts` (4 tests) para fijar el contrato.
9. Typo trivial: ruta del logo en `registro.component.ts` tenía espacios finales en el `src`.

**Sin aplicar (documentado, no bloqueante):** enlace directo "Nº de perros" del hero de home hacia una personalización real de resultados (hoy se envía pero no se usa en el buscador) — se dejó como está porque conectar completamente ese dato al backend de disponibilidad excede el alcance de un ajuste de UX puntual.

## Estado actual

**Última actualización:** 2026-07-18.

**Fase en curso:** Fase C — C.1 Peluquería, C.2 Residencia, C.3 Hotel pet-friendly, C.4 Adiestramiento y C.5 Veterinaria completas. Siguiente y última de la fase: C.6 Transporte.

**Fases A y B: 100% completas** (ver secciones propias arriba). El detalle de avance también se guarda en la memoria del proyecto (`project-mejora-servicios.md`) para poder retomar sin releer todo este documento.
