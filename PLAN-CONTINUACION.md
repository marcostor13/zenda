# PLAN DE CONTINUACIÓN — Reservalo (Plataforma Multi-Reserva)

> Documento de planificación derivado del análisis de las historias de usuario (CLAUDE.md §7), el modelo de negocio de Booking (CLAUDE.md §1) y el **estado real del código** a la fecha. Mantiene los **5 verticales** (Hoteles, Vuelos, Taxis, Transporte, Guardería) y respeta la Constitución del proyecto (`.specify/CONSTITUTION.md`).
>
> **Fecha de análisis:** 2026-06-25 · **Rama:** `claude/frontend-styles-design-9flagt`

---

## 1. Estado actual (gap analysis)

Resultado de la auditoría módulo por módulo del backend (`apps/api`) y del frontend (`apps/web`).

### 1.1 Backend (NestJS) — ~70% del vertical Hoteles

| Módulo | Estado | Detalle |
|---|---|---|
| `auth` | ✅ Completo | Login/registro JWT, bcrypt, `JwtAuthGuard` + `RolesGuard`, tests. |
| `users` | 🟡 Solo repositorio | CRUD de repo, sin controller (se gestiona vía auth/admin). |
| `comercios` | 🟡 Solo repositorio | Sin controller → onboarding de comercio no expuesto por API. |
| `catalog` | 🟡 Solo schema | `Servicio` base + discriminador. **Falta controller de búsqueda/listado.** |
| `availability` | ✅ Core listo | Registry + interfaz `AvailabilityStrategy`, auto-registro por vertical. |
| `bookings` | 🟡 Solo service | `crear/confirmar/cancelar` con SlotHold. **Falta controller (API directa).** |
| `payments` | ✅ Completo | Stripe `PaymentIntent` + webhook idempotente, cálculo de comisión + IGV + fee. |
| `comision-configs` | ✅ Completo | Cascada vertical → global → default, editable por admin. |
| `admin` | ✅ Completo | Gestión de comisiones + reporte financiero (GMV, margen, liquidaciones). |
| `reviews` | 🔴 Stub | Módulo vacío. Sin service/controller/schema. |
| `notifications` | 🔴 Stub | Módulo vacío. Sin outbox ni envío. |
| **Hoteles** (vertical) | ✅ Completo | Strategy de noches + SlotHold TTL 15 min, schema discriminador, tests. |
| **Vuelos / Taxis / Transporte / Guardería** | 🔴 Ausentes | 0 archivos. La arquitectura está lista para añadirlos sin tocar el core. |

**Persistencia de SlotHold:** hoy es en memoria (válido para MVP de 1 nodo). Para escalar → Redis con TTL.

### 1.2 Frontend (Angular) — Hoteles funcional, resto mock

| Feature | Estado | Detalle |
|---|---|---|
| `auth` (login/registro) | ✅ Real | Formularios reactivos + `AuthService` + guards + interceptor JWT. |
| `home` (landing) | ✅ Showcase | Hero, 5 verticales, destacados (hardcoded). |
| `hoteles` (lista/detalle) | ✅ Real | Filtros, orden, paginación, HTTP a `catalog`; fallback a mock. |
| `reservas` (wizard) | 🟡 Casi | Wizard 4 pasos funcional; **pago es placeholder (sin Stripe.js)**. |
| `reservas/mis-reservas` | 🔴 Mock | UI lista, datos hardcoded, sin API. |
| `buscador` (unificado) | 🔴 Stub | `onBuscar()` vacío; no rutea a resultados por vertical. |
| `perfil-usuario` | 🔴 Mock | Dashboard sin sub-rutas reales. |
| `panel-comercio` | 🔴 Mock | KPIs y tablas hardcoded; sin alta/edición de listados ni calendario. |
| `panel-admin` | 🔴 Mock | KPIs, aprobación y comisiones hardcoded; sin `AdminService`. |
| **Vuelos / Taxis / Transporte / Guardería** | 🔴 Ausentes | Ninguna pantalla. |
| Reviews / Notificaciones / Favoritos UI | 🔴 Ausentes | Botones cosméticos. |

### 1.3 Conclusión del gap

El **motor core está probado** con un vertical (Hoteles) end-to-end salvo el último tramo de pago real. Lo que falta se agrupa en cuatro frentes:

1. **Cerrar el MVP de Hoteles** (cableado real FE↔BE + Stripe.js + controllers faltantes).
2. **Validar extensibilidad** añadiendo **Taxis** (lógica on-demand, distinta a noches).
3. **Completar los 3 verticales restantes** (Vuelos, Transporte, Guardería) como módulos aislados.
4. **Módulos transversales pendientes** (reviews, notifications) y **nuevas palancas de negocio tipo Booking**.

---

## 2. Análisis ampliado de Booking → palancas faltantes

CLAUDE.md §1 ya cubre las palancas base (comisión, merchant/agencia, destacados, reseñas, disponibilidad). De un análisis más profundo de Booking.com surgen **palancas presentes en el producto real que aún no están en las historias de usuario** y que encajan perfecto con una plataforma multi-vertical:

| Palanca de Booking | Por qué importa | Adaptación multi-vertical (Reservalo) |
|---|---|---|
| **Trips / itinerario unificado** | Booking agrupa vuelo + hotel + auto en un "Trip". | **Carrito de viaje multi-vertical**: un usuario combina hotel + taxi + vuelo en una sola reserva/itinerario. Diferenciador clave del producto. |
| **Cross-sell contextual** | "Reservaste vuelo a Cusco → ¿hotel?". | Tras confirmar una reserva, sugerir servicios de otros verticales en el mismo destino/fecha. |
| **Mensajería huésped–proveedor** | Resuelve dudas pre/post reserva. | Hilo de mensajes por reserva entre cliente y comercio (transversal a verticales). |
| **Genius / fidelización** | Recurrencia y descuentos por nivel. | `programaPuntos` ya está como gancho (CLAUDE.md). Definir niveles + créditos. |
| **Wishlist / favoritos** | Retención y reserva rápida. | H3 (P2) existe; elevar a feature transversal con colecciones. |
| **Búsqueda con autocompletar y "cerca de mí"** | Reduce fricción de entrada. | B4 (geo) existe; añadir autocompletar de ciudades/zonas y destinos populares. |
| **Free cancellation / políticas claras** | Confianza y conversión. | Política de cancelación por servicio + reembolso automático (E3/F3). Formalizar reglas. |
| **Best price / ofertas y cupones** | Conversión y urgencia. | Motor de **promociones y cupones** por comercio/vertical (descuento %, monto, fechas). |
| **Programa de referidos** | Adquisición de bajo costo. | Código de referido → crédito al referente y referido. |
| **Wallet / métodos guardados** | Checkout más rápido. | Guardar método de pago Stripe (Customer + PaymentMethod) por usuario. |
| **Verificación y badges de proveedor** | Calidad de la oferta. | Estado `verificado` del comercio + badge en resultados (ya hay `destacado`). |
| **Centro de ayuda / disputas** | Soporte y resolución. | J4 existe; añadir flujo de tickets/disputas vinculado a reserva. |
| **Comprobante / voucher descargable** | Necesidad operativa + SUNAT futuro. | Voucher PDF + gancho boleta/factura electrónica (ya contemplado en datos). |

> **Principio mantenido:** ninguna de estas palancas rompe el core agnóstico. Trips, cross-sell, mensajería, favoritos, promociones, referidos y wallet son **módulos transversales** que operan sobre `reservas`/`servicios` sin `if vertical === ...`.

---

## 3. Nuevas historias de usuario

Se **amplían** las épicas existentes y se **añaden** épicas nuevas (N–S). Prioridades: **P0** (MVP), **P1**, **P2**.

### 3.1 Ampliaciones a épicas existentes

**Épica B — Buscador unificado**
- **B6 (P0)** Como **usuario**, quiero que el buscador me lleve a la pantalla de resultados del vertical elegido con mis filtros aplicados, para completar la búsqueda (hoy `onBuscar()` está vacío).
- **B7 (P1)** Como **usuario**, quiero autocompletar de ciudades/zonas y ver destinos populares, para buscar más rápido.

**Épica E — Reserva**
- **E6 (P1)** Como **usuario**, quiero modificar fechas/datos de una reserva según la política del comercio, para no cancelar y volver a reservar.
- **E7 (P1)** Como **usuario**, quiero descargar el voucher/comprobante de mi reserva (PDF), para presentarlo en destino.

**Épica F — Pagos**
- **F6 (P0)** Como **usuario**, quiero completar el pago con **Stripe.js** (clientSecret) en el checkout, para que la reserva se confirme por webhook (hoy el pago es placeholder).
- **F7 (P1)** Como **usuario**, quiero guardar mi método de pago (wallet), para próximos checkouts más rápidos.

**Épica H — Perfil**
- **H3 (P1)** *(reclasificada de P2)* Como **usuario**, quiero guardar favoritos en colecciones, para reservar más rápido luego.

### 3.2 Épicas nuevas

### Épica N — Viaje multi-vertical (Trips) *(diferenciador)*
- **N1 (P1)** Como **usuario**, quiero agrupar varias reservas (hotel + taxi + vuelo) en un mismo **Viaje**, para organizar mi itinerario en un solo lugar.
- **N2 (P1)** Como **usuario**, quiero añadir servicios a un carrito multi-vertical y pagarlos en un solo checkout, para no pagar por separado.
- **N3 (P2)** Como **usuario**, quiero una vista cronológica de mi viaje (timeline), para ver qué sigue.

### Épica O — Cross-sell y recomendaciones
- **O1 (P1)** Como **sistema**, quiero sugerir servicios de otros verticales en el mismo destino/fecha tras una reserva, para aumentar el ticket promedio.
- **O2 (P2)** Como **usuario**, quiero ver "reservados juntos frecuentemente", para descubrir combinaciones útiles.

### Épica P — Promociones y cupones
- **P1 (P1)** Como **comercio**, quiero crear cupones (% o monto fijo, vigencia, tope), para impulsar la demanda.
- **P2 (P1)** Como **usuario**, quiero aplicar un cupón en el checkout y ver el descuento, para pagar menos.
- **P3 (P2)** Como **admin**, quiero crear promociones globales por vertical, para campañas de plataforma.

### Épica Q — Mensajería y soporte
- **Q1 (P1)** Como **usuario**, quiero enviar mensajes al comercio sobre una reserva, para resolver dudas.
- **Q2 (P1)** Como **comercio**, quiero responder mensajes de mis clientes, para dar soporte.
- **Q3 (P2)** Como **usuario**, quiero abrir una disputa sobre una reserva, para que el admin la resuelva (conecta con J4).

### Épica R — Fidelización y referidos
- **R1 (P2)** Como **usuario**, quiero acumular puntos por reserva completada, para canjearlos por descuentos.
- **R2 (P2)** Como **usuario**, quiero un código de referido que da crédito a mí y a quien invito, para ganar invitando.

### Épica S — Confianza y verificación
- **S1 (P1)** Como **admin**, quiero verificar comercios y marcarlos con un badge, para señalar calidad.
- **S2 (P1)** Como **usuario**, quiero ver el badge de "verificado" y políticas de cancelación claras en cada resultado, para reservar con confianza.

> Las épicas N–O (Trips + cross-sell) son las que **monetizan la naturaleza multi-vertical**: solo tienen sentido porque hay 5 verticales bajo un mismo perfil y checkout.

---

## 4. Plan de continuación por fases

Cada fase es entregable y deja el producto en estado demostrable. Se respeta la regla de oro: **cada archivo de producción con su `.spec.ts`** y cobertura ≥80%.

### Fase 0 — Cerrar el MVP de Hoteles (P0) · *fundacional*
Objetivo: un flujo real reservar→pagar→confirmar de punta a punta, sin mocks.

**Backend**
- `catalog`: controller `GET /catalog/servicios` (filtros: vertical, ciudad, fechas, precio, orden, paginación) + `GET /catalog/servicios/:id`. Índices ESR (CLAUDE.md §4.3).
- `bookings`: controller `POST /bookings`, `GET /bookings/:id`, `GET /bookings` (mías), `DELETE /bookings/:id`.
- `comercios`: controller de onboarding/gestión (alta, estado, datos) gated por rol.
- `users`: controller `GET/PATCH /users/me` (perfil).

**Frontend**
- `buscador`: implementar `onBuscar()` → ruteo a resultados con queryParams (cierra B6).
- `reservas`: integrar **Stripe.js** en el paso de pago (clientSecret → confirmación → polling/estado por webhook) (cierra F6).
- `reservas/mis-reservas` y `perfil`: cablear a `bookings`/`users` reales (quitar mocks).
- `panel-comercio`: alta/edición de listado + gestión de disponibilidad (calendario de noches).
- `panel-admin`: `AdminService` real sobre `/admin/comisiones` y `/admin/reportes/financiero`.

**Salida:** Hoteles 100% real, paneles comercio/admin operativos con datos de API.

### Fase 1 — Transversales del core (P0/P1)
- **Reviews** (G1/G2): schema `reseñas`, service, controller (`POST` tras reserva completada, `GET` por servicio), recálculo de `ratingPromedio`. UI de envío y listado.
- **Notifications** (L1/L2): outbox + envío email (confirmación de reserva, alerta a comercio). Gancho WhatsApp/push para fases móviles.
- **Voucher PDF** (E7) y política de cancelación + reembolso Stripe (E3/F3).

### Fase 2 — Vertical Taxis (P0) · *valida extensibilidad*
- `verticals/taxis`: schema discriminador (`tipoVehiculo`, `capacidad`, `zonaCobertura`, `tarifaBase`, `tarifaKm`), `TaxiAvailabilityStrategy` (on-demand/programado, slots/trayecto), `PricingStrategy` por trayecto, auto-registro. **Sin tocar el core.**
- Flujo de aceptar/rechazar reserva on-demand (E4).
- Frontend: feature `taxis` (búsqueda por origen→destino, detalle, reserva).

**Criterio de éxito:** el motor soporta una lógica completamente distinta a "noches" sin modificar `bookings`/`availability`/`payments`.

### Fase 3 — Verticales restantes (P1)
Repetir el patrón de Taxis para **Vuelos** (asientos por ruta/horario), **Transporte** (carga por ruta + peso/volumen) y **Guardería** (cupos por edad, hora/día/mes). Cada uno = módulo aislado BE + feature FE.

### Fase 4 — Palancas de negocio tipo Booking (P1/P2)
- **Trips + carrito multi-vertical + checkout único** (Épica N) — el diferenciador.
- **Cross-sell contextual** (Épica O).
- **Promociones y cupones** (Épica P).
- **Mensajería + disputas** (Épica Q / J4).
- **Verificación y badges** (Épica S).

### Fase 5 — Crecimiento y móvil (P2 / Fase posterior)
- **Fidelización + referidos** (Épica R), **wallet** (F7), favoritos por colecciones (H3).
- **Capacitor**: build Android/iOS, push notifications (Épicas M).
- Gancho **boleta/factura electrónica SUNAT** y pasarelas alternativas (fuera de MVP por Constitución).

---

## 5. Backlog técnico inmediato (Fase 0, accionable)

| # | Tarea | Capa | Cierra |
|---|---|---|---|
| 1 | `CatalogController` + `CatalogService` de búsqueda con índices ESR | api | B6, C1 lectura |
| 2 | `BookingsController` (CRUD reservas del usuario) | api | E1, E5 |
| 3 | `ComerciosController` (onboarding/gestión) | api | A3, C1/C2 |
| 4 | `UsersController` `GET/PATCH /users/me` | api | H1 |
| 5 | DTOs nuevos en `libs/shared` (catalog, bookings) | libs | contrato FE↔BE |
| 6 | `buscador.onBuscar()` → ruteo a resultados | web | B6 |
| 7 | Stripe.js en wizard de pago + estado por webhook | web | F6, F2 |
| 8 | `ReservasService` + cablear `mis-reservas`/`perfil` | web | E5, H2 |
| 9 | Panel comercio: alta/edición de listado + disponibilidad | web | C1, D1 |
| 10 | `AdminService` real (comisiones + reporte) | web | J2, J3 |

> Cada tarea incluye su `.spec.ts` (regla de oro, Constitución §Tests). Trabajar sobre la rama `claude/frontend-styles-design-9flagt`.

---

## 6. Riesgos y decisiones a confirmar con el cliente

1. **SlotHold en memoria → Redis**: necesario antes de producción multi-nodo. ¿Se aprovisiona Redis en Coolify?
2. **Checkout único multi-vertical (Trips)**: un solo `PaymentIntent` para servicios de varios comercios implica **split payments** (Stripe Connect). Confirmar si el MVP de Trips paga por servicio o usa Connect.
3. **Modo de liquidación**: MVP arranca en *merchant* (CLAUDE.md). Confirmar antes de Fase 1.
4. **Tipo de cambio USD→PEN** para el fee fijo de Stripe (hoy S/1.10 fijo): ¿se actualiza manual o vía API de tipo de cambio?
5. **Notificaciones**: ¿proveedor de email (Resend/SES) y de WhatsApp (Twilio/Meta) elegidos?

---

*Fin del plan. Próximo paso sugerido: ejecutar Fase 0 (backlog §5) para dejar Hoteles 100% real de punta a punta.*
