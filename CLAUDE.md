# CLAUDE.md — Plataforma Multi-Reserva (estilo Booking, multi-vertical)

> **Nombre de trabajo del proyecto:** `Reservalo` (placeholder — reemplazar por el nombre comercial definitivo).
> Este documento es la **fuente de verdad** para Claude Code. Léelo completo antes de generar cualquier scaffold, módulo o esquema. Si una decisión no está aquí, sigue las *Convenciones* de la sección final y deja un `// TODO:` documentado.

---

## 0. Resumen ejecutivo

Marketplace de reservas multi-vertical para el mercado peruano. Un solo producto (web + móvil) que unifica **5 verticales de reserva** bajo un mismo buscador, perfil de usuario, pasarela de pago y panel administrativo, con una **arquitectura modular pensada para añadir más verticales sin reescribir el núcleo**.

**Verticales iniciales:**

| Vertical | Unidad reservable | Lógica de reserva | Sub-servicios |
|---|---|---|---|
| **Hoteles** | Habitación / alojamiento | Por noche (check-in/check-out), disponibilidad por fechas | Hospedaje, paquetes |
| **Vuelos** | Asiento en ruta/horario | Por trayecto + fecha/hora, inventario de asientos | Vuelos comerciales |
| **Taxis** | Traslado punto A→B | On-demand o programado, por trayecto/tarifa | Traslados, transfers aeropuerto |
| **Transporte** | Servicio de carga | Por ruta + peso/volumen, programado | Transporte de mercancías |
| **Guardería** | Cupo de cuidado infantil | Por día/hora/mensualidad, cupos por edad | Cuidado infantil |

> **Principio rector de diseño:** los 5 verticales NO se modelan como 5 sistemas separados. Se modelan como **instancias de un mismo motor de catálogo + disponibilidad + reserva + pago**, donde cada vertical aporta sólo su *esquema específico* y su *estrategia de disponibilidad/precio*. "Más servicios (que se pueda ampliar)" = añadir un módulo de vertical, no tocar el core.

---

## 1. Análisis del modelo de negocio (Booking) y adaptación

### 1.1 Cómo gana dinero Booking (referencia)

Booking.com es un **marketplace de dos lados** (oferta = proveedores / demanda = viajeros). Sus fuentes de ingreso:

1. **Comisión por transacción** — el proveedor paga ~15–25% del valor de cada reserva concretada.
2. **Modelo agencia vs. merchant:**
   - *Agencia:* el cliente paga al proveedor en destino; Booking factura la comisión después.
   - *Merchant:* Booking cobra al cliente y liquida al proveedor el monto menos comisión.
3. **Listados destacados / publicidad** (sponsored listings, mayor visibilidad en el buscador).
4. **Programa de fidelización** (Genius) para aumentar recurrencia.
5. **Reseñas y ranking** como mecanismo de confianza y de ordenamiento de resultados.
6. **Gestión de disponibilidad e inventario** en tiempo real desde un panel del proveedor.

### 1.2 Adaptación multi-vertical (este proyecto)

| Palanca de negocio Booking | Cómo se implementa aquí |
|---|---|
| Comisión por transacción | `comisionPct` configurable **por vertical y por comercio** (override). Se calcula en el momento de confirmar la reserva. |
| Merchant vs. agencia | Soportar ambos modos vía `modoLiquidacion: 'merchant' \| 'agencia'` a nivel de comercio. MVP arranca en *merchant* (cobramos online y liquidamos). |
| Listados destacados | Flag `destacado` + `prioridadRanking` en el listado; monetizable como add-on. |
| Fidelización | Fase posterior: `programaPuntos` por usuario. Dejar el gancho en el modelo, no implementar en MVP. |
| Reseñas + ranking | Módulo `reviews` transversal a todos los verticales. |
| Gestión de disponibilidad | Módulo `availability` con **estrategia por vertical** (calendario de noches, asientos, slots horarios, cupos). |

**Fuentes de ingreso del producto:**
1. Comisión por reserva (principal).
2. Suscripción mensual del comercio (planes: básico / pro / premium) → desbloquea destacados, más listados, analítica.
3. Listados/posiciones destacadas pay-per-feature.

> **Asunción declarada:** el MVP cobra online (modo *merchant*) con liquidación posterior al comercio. Si el negocio requiere arrancar en modo *agencia* (pago en destino), avísame y ajusto el flujo de pagos.

---

## 2. Perfiles de usuario (actores)

1. **Usuario / Cliente** — busca, compara, reserva y paga servicios en cualquier vertical. Un mismo usuario puede reservar hotel, taxi y guardería con un solo perfil.
2. **Comercio / Proveedor** — publica y gestiona sus listados, disponibilidad, precios, reservas recibidas y liquidaciones. Un comercio puede operar en uno o varios verticales.
3. **Administrador (plataforma)** — gestiona comercios, verticales, comisiones, disputas, contenido, reportes y configuración global.

---

## 3. Arquitectura técnica

### 3.1 Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend Web | **Angular 20+** (standalone components, signals) | SPA, lazy-loading por vertical |
| Frontend Móvil | **Angular + Capacitor** | Mismo código base que la web; build a Android/iOS |
| Backend API | **NestJS** (modular monolith) | REST + JWT; módulos por dominio y por vertical |
| Base de datos | **MongoDB Atlas** (Mongoose) | Discriminadores para verticales; índices ESR |
| Repositorio | **GitHub** (monorepo) | `nx` o workspace de carpetas `apps/` + `libs/` |
| Hosting Frontend | **Netlify** | Deploy automático del build de Angular |
| Hosting Backend | **Coolify** (self-hosted, EC2) | Contenedor del API NestJS |
| CI/CD | **GitHub Actions** | Lint + test + build + deploy automático |

### 3.2 Diagrama de alto nivel

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENTES                               │
│   Web (Netlify)            Móvil (Capacitor: Android/iOS)      │
└───────────────┬───────────────────────────┬──────────────────┘
                │  HTTPS / JWT               │
                ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│                 API NestJS (Coolify / EC2)                    │
│                                                              │
│  CORE        ┌───────────────────────────────────────────┐   │
│  ──────      │ auth · users · comercios · catalog ·       │   │
│              │ availability · bookings · payments ·       │   │
│              │ reviews · notifications · admin            │   │
│              └───────────────────────────────────────────┘   │
│  VERTICALES  ┌──────────┬─────────┬────────┬───────────┐     │
│  ─────────   │ hoteles  │ vuelos  │ taxis  │ transporte│ ... │
│              │          │         │        │ guarderia │     │
│              └──────────┴─────────┴────────┴───────────┘     │
└───────────────┬──────────────────────┬───────────────────────┘
                │                       │
                ▼                       ▼
        ┌──────────────┐        ┌────────────────────┐
        │ MongoDB Atlas│        │ Pasarela de pago   │
        │              │        │ (Culqi / Izipay)   │
        └──────────────┘        └────────────────────┘
```

### 3.3 Patrón de extensibilidad (clave del proyecto)

El núcleo (catálogo, disponibilidad, reserva, pago) es **agnóstico al vertical**. Cada vertical se conecta mediante tres puntos de extensión:

1. **Discriminador de esquema** (Mongoose `discriminator`): el documento base `Servicio` se extiende con campos propios (`HotelServicio`, `VueloServicio`, etc.).
2. **Estrategia de disponibilidad** (`AvailabilityStrategy`): interfaz que cada vertical implementa (calendario de noches vs. asientos vs. slots horarios vs. cupos).
3. **Estrategia de precio/reserva** (`PricingStrategy` / `BookingStrategy`): cómo se calcula el total y qué validaciones aplican (ej.: noches × tarifa, asiento único, trayecto fijo, cupo por edad).

```ts
// libs/core/availability/availability.strategy.ts
export interface AvailabilityStrategy {
  vertical: VerticalKey;
  checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult>;
  reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold>;
  releaseSlot(holdId: string): Promise<void>;
}
// Cada vertical registra su estrategia en un AvailabilityRegistry (token de DI).
```

> **Añadir un vertical nuevo = crear un módulo `verticals/<nuevo>` que aporte: schema (discriminator) + AvailabilityStrategy + PricingStrategy + se auto-registra.** El core no cambia.

---

## 4. Modelo de datos (MongoDB / Mongoose)

### 4.1 Colecciones núcleo

```
usuarios            // clientes y staff de comercios (rol + comercioId opcional)
comercios           // proveedores (multi-vertical, modo liquidación, comisión)
verticales          // catálogo de verticales activos (config dinámica)
servicios           // listing base (discriminado por vertical)
disponibilidad      // bloques/calendario/slots por servicio
reservas            // booking transversal a todos los verticales
pagos               // intentos y estados de pago
liquidaciones       // payout al comercio (monto - comisión)
reseñas             // reviews por reserva/servicio
notificaciones      // outbox de notificaciones (email/push/whatsapp)
```

### 4.2 Esquemas principales (resumen de campos)

**`usuarios`**
```
_id, nombre, email (único), passwordHash, telefono,
rol: 'cliente' | 'comercio_admin' | 'comercio_staff' | 'admin',
comercioId?: ObjectId,   // sólo para staff de comercio
verificado: bool, createdAt, updatedAt
```

**`comercios`**
```
_id, razonSocial, ruc, nombreComercial, logoUrl,
verticales: VerticalKey[],         // en qué verticales opera
modoLiquidacion: 'merchant' | 'agencia',
comisionPctOverride?: number,      // si difiere del default del vertical
plan: 'basico' | 'pro' | 'premium',
estado: 'pendiente' | 'activo' | 'suspendido',
datosBancarios, createdAt, updatedAt
```

**`servicios`** (base — discriminada)
```
_id, comercioId, vertical: VerticalKey,
titulo, descripcion, imagenes[], ubicacion { ciudad, geo },
precioBase, moneda: 'PEN',
destacado: bool, prioridadRanking: number,
estado: 'borrador' | 'publicado' | 'pausado',
ratingPromedio, totalReseñas, createdAt, updatedAt
// --- discriminadores ---
// HotelServicio:     habitaciones[], amenities[], politicaCancelacion, checkIn, checkOut
// VueloServicio:     origen, destino, fechaSalida, fechaLlegada, asientosTotales, aerolinea
// TaxiServicio:      tipoVehiculo, capacidad, zonaCobertura, tarifaBase, tarifaKm
// TransporteServicio:tipoCarga, capacidadKg, capacidadM3, rutasCubiertas[]
// GuarderiaServicio: rangoEdad, cuposTotales, horario, modalidad: 'hora'|'dia'|'mes'
```

**`reservas`**
```
_id, codigo (legible),
usuarioId, comercioId, servicioId, vertical: VerticalKey,
detalle: object,                 // payload específico del vertical
fechaInicio, fechaFin,           // o slot/trayecto según vertical
cantidad, montoSubtotal, comisionMonto, montoTotal, moneda: 'PEN',
estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada' | 'no_show',
pagoId?, createdAt, updatedAt
```

**`pagos`**
```
_id, reservaId, usuarioId, pasarela: 'culqi'|'izipay'|'yape',
montoTotal, moneda: 'PEN',
estado: 'iniciado'|'aprobado'|'rechazado'|'reembolsado',
referenciaPasarela, createdAt
```

### 4.3 Índices recomendados (ESR: Equality, Sort, Range)

```
servicios:    { vertical:1, 'ubicacion.ciudad':1, prioridadRanking:-1, precioBase:1 }
servicios:    { 'ubicacion.geo': '2dsphere' }
disponibilidad:{ servicioId:1, fecha:1 }
reservas:     { usuarioId:1, estado:1, createdAt:-1 }
reservas:     { comercioId:1, estado:1, fechaInicio:1 }
usuarios:     { email:1 } (unique)
comercios:    { ruc:1 } (unique)
```

---

## 5. Estructura del repositorio (monorepo)

```
/
├── apps/
│   ├── web/                  # Angular (web + Capacitor para móvil)
│   │   ├── src/app/
│   │   │   ├── core/         # auth, interceptors, guards
│   │   │   ├── shared/       # componentes UI reutilizables
│   │   │   ├── features/
│   │   │   │   ├── buscador/ # buscador unificado multi-vertical
│   │   │   │   ├── hoteles/
│   │   │   │   ├── vuelos/
│   │   │   │   ├── taxis/
│   │   │   │   ├── transporte/
│   │   │   │   ├── guarderia/
│   │   │   │   ├── reservas/
│   │   │   │   ├── perfil-usuario/
│   │   │   │   ├── panel-comercio/
│   │   │   │   └── panel-admin/
│   │   │   └── ...
│   │   └── capacitor.config.ts
│   └── api/                  # NestJS
│       └── src/
│           ├── core/         # auth, users, comercios, catalog,
│           │                 # availability, bookings, payments,
│           │                 # reviews, notifications, admin
│           └── verticals/
│               ├── hoteles/
│               ├── vuelos/
│               ├── taxis/
│               ├── transporte/
│               └── guarderia/
├── libs/                     # tipos y contratos compartidos (DTOs, enums)
├── .github/workflows/        # CI/CD
└── CLAUDE.md
```

---

## 6. CI/CD (GitHub Actions)

### 6.1 Frontend → Netlify
- Trigger: push a `main` que toque `apps/web/**`.
- Pasos: `install → lint → test → build (ng build)`.
- Deploy: Netlify conectado al repo (deploy automático del build) **o** `netlify deploy --prod` vía CLI con `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` en secrets.

### 6.2 Backend → Coolify (EC2)
- Trigger: push a `main` que toque `apps/api/**`.
- Pasos: `install → lint → test → build`.
- Deploy: **webhook de Coolify** (deploy automático por push) o llamada al webhook con `COOLIFY_WEBHOOK_URL` en secrets. Coolify construye el contenedor y lo levanta.

### 6.3 Esqueleto de workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint --workspace=api
      - run: npm run test --workspace=api
      - run: npm run build --workspace=api
      - name: Deploy API (Coolify webhook)
        if: github.ref == 'refs/heads/main'
        run: curl -fsSL -X POST "${{ secrets.COOLIFY_WEBHOOK_URL }}"
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build --workspace=web
      - name: Deploy Web (Netlify)
        if: github.ref == 'refs/heads/main'
        run: npx netlify deploy --prod --dir=apps/web/dist
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 7. Historias de usuario

Formato: `Como <rol>, quiero <acción>, para <beneficio>`. Prioridad: **P0** (MVP), **P1**, **P2**.

### Épica A — Cuentas y autenticación
- **A1 (P0)** Como **usuario**, quiero registrarme con email/teléfono, para crear mi cuenta única.
- **A2 (P0)** Como **usuario**, quiero iniciar sesión con JWT, para acceder a mis reservas.
- **A3 (P0)** Como **comercio**, quiero registrar mi negocio (RUC, razón social, verticales), para empezar a publicar.
- **A4 (P1)** Como **usuario**, quiero recuperar mi contraseña, para no perder el acceso.
- **A5 (P1)** Como **comercio**, quiero invitar staff con roles, para delegar la operación.
- **A6 (P2)** Como **usuario**, quiero login social (Google), para registrarme más rápido.

### Épica B — Buscador unificado
- **B1 (P0)** Como **usuario**, quiero un buscador único donde elijo el vertical (hotel/vuelo/taxi/transporte/guardería), para encontrar lo que necesito desde un solo lugar.
- **B2 (P0)** Como **usuario**, quiero filtrar por ciudad/zona, fechas y precio, para acotar resultados.
- **B3 (P0)** Como **usuario**, quiero ver resultados ordenados por relevancia/rating/precio, para comparar.
- **B4 (P1)** Como **usuario**, quiero buscar por geolocalización ("cerca de mí"), para encontrar servicios próximos.
- **B5 (P1)** Como **usuario**, quiero filtros específicos por vertical (amenities en hotel, tipo de vehículo en taxi, edad en guardería), para precisión.

### Épica C — Catálogo y listados (comercio)
- **C1 (P0)** Como **comercio**, quiero crear un listado en mi vertical (con fotos, precio, ubicación), para ofrecerlo.
- **C2 (P0)** Como **comercio**, quiero publicar/pausar un listado, para controlar su visibilidad.
- **C3 (P1)** Como **comercio**, quiero editar atributos específicos de mi vertical, para reflejar mi oferta real.
- **C4 (P2)** Como **comercio**, quiero pagar por destacar un listado, para ganar visibilidad.

### Épica D — Disponibilidad
- **D1 (P0)** Como **comercio**, quiero gestionar la disponibilidad de mi servicio según mi vertical (calendario de noches / asientos / slots horarios / cupos), para evitar sobreventa.
- **D2 (P0)** Como **usuario**, quiero ver disponibilidad en tiempo real antes de reservar, para no perder tiempo.
- **D3 (P1)** Como **comercio**, quiero bloquear fechas/slots manualmente, para mantenimiento o cierres.
- **D4 (P1)** Como **comercio**, quiero precios dinámicos por temporada/horario, para optimizar ingresos.

### Épica E — Reserva
- **E1 (P0)** Como **usuario**, quiero reservar un servicio y recibir un código de reserva, para confirmar mi compra.
- **E2 (P0)** Como **usuario**, quiero ver el detalle y total (subtotal + impuestos) antes de pagar, para transparencia.
- **E3 (P0)** Como **usuario**, quiero cancelar según la política del comercio, para flexibilidad.
- **E4 (P1)** Como **comercio**, quiero aceptar/rechazar reservas que requieran aprobación, para controlar el on-demand (ej. taxi, transporte).
- **E5 (P1)** Como **usuario**, quiero ver el historial y estado de mis reservas, para seguimiento.

### Épica F — Pagos online
- **F1 (P0)** Como **usuario**, quiero pagar online con tarjeta (Culqi/Izipay) o Yape, para completar la reserva.
- **F2 (P0)** Como **sistema**, quiero confirmar la reserva sólo cuando el pago es aprobado, para consistencia.
- **F3 (P1)** Como **usuario**, quiero recibir reembolso al cancelar dentro de la política, para confianza.
- **F4 (P1)** Como **comercio**, quiero ver mis liquidaciones (total − comisión), para mi contabilidad.
- **F5 (P0)** Como **comercio**, quiero que se calcule automáticamente la comisión de la plataforma por reserva, para el modelo de negocio.

### Épica G — Reseñas y confianza
- **G1 (P1)** Como **usuario**, quiero dejar reseña/calificación tras completar el servicio, para ayudar a otros.
- **G2 (P1)** Como **usuario**, quiero ver reseñas antes de reservar, para decidir mejor.
- **G3 (P2)** Como **comercio**, quiero responder reseñas, para gestionar mi reputación.

### Épica H — Perfil de usuario
- **H1 (P0)** Como **usuario**, quiero editar mi perfil y datos de contacto, para mantenerlos al día.
- **H2 (P0)** Como **usuario**, quiero un panel con mis reservas activas e históricas en todos los verticales, para centralizar.
- **H3 (P2)** Como **usuario**, quiero guardar favoritos, para reservar más rápido luego.

### Épica I — Panel de comercio
- **I1 (P0)** Como **comercio**, quiero un dashboard con mis reservas entrantes y estado, para operar.
- **I2 (P1)** Como **comercio**, quiero métricas (ingresos, ocupación, conversión), para tomar decisiones.
- **I3 (P1)** Como **comercio**, quiero gestionar mi plan de suscripción, para acceder a más funciones.

### Épica J — Panel de administrador
- **J1 (P0)** Como **admin**, quiero aprobar/suspender comercios, para controlar la calidad de la oferta.
- **J2 (P0)** Como **admin**, quiero configurar verticales y comisiones por defecto, para gobernar el negocio.
- **J3 (P1)** Como **admin**, quiero ver reportes globales (GMV, comisiones, reservas por vertical), para el control financiero.
- **J4 (P1)** Como **admin**, quiero gestionar disputas/cancelaciones conflictivas, para resolución.
- **J5 (P2)** Como **admin**, quiero activar/desactivar un vertical completo, para escalar la oferta.

### Épica K — Extensibilidad ("más servicios")
- **K1 (P1)** Como **admin**, quiero registrar un nuevo vertical desde configuración, para ampliar la plataforma sin nuevo deploy mayor.
- **K2 (P2)** Como **plataforma**, quiero que cada vertical se auto-registre (schema + estrategia de disponibilidad + precio), para que añadir verticales sea un módulo aislado.

### Épica L — Notificaciones
- **L1 (P0)** Como **usuario**, quiero confirmación de reserva por email/WhatsApp, para tener comprobante.
- **L2 (P1)** Como **comercio**, quiero alertas de nuevas reservas, para reaccionar a tiempo.

### Épica M — Móvil (Capacitor)
- **M1 (P0)** Como **usuario**, quiero usar la app en Android/iOS con las mismas funciones que la web, para reservar desde el móvil.
- **M2 (P1)** Como **usuario**, quiero notificaciones push de mis reservas, para estar informado.

---

## 8. Roadmap por fases

| Fase | Alcance | Verticales |
|---|---|---|
| **F1 — Núcleo + 1 vertical** | Auth, perfiles, buscador, catálogo, disponibilidad, reserva, pago online, panel comercio/admin básico. | **Hoteles** (mejor para validar el motor por noche/disponibilidad) |
| **F2 — Segundo vertical** | Validar el patrón de extensibilidad con una lógica distinta (slots/trayecto). | **Taxis** (traslados) |
| **F3 — Verticales restantes** | Añadir como módulos aislados. | **Vuelos, Transporte, Guardería** |
| **F4 — Monetización avanzada** | Suscripciones de comercio, destacados, fidelización, métricas. | Todos |
| **F5 — Móvil pulido** | Push, optimizaciones Capacitor, stores. | Todos |

> Construir primero **Hoteles** valida el motor de disponibilidad por fechas; luego **Taxis** prueba que el patrón de extensibilidad funciona con una lógica completamente distinta. Si esos dos encajan, los otros tres son repetición del patrón.

---

## 9. Consideraciones del mercado peruano

- **Moneda:** PEN (soles) en todo el sistema.
- **Impuestos:** IGV 18% — separar `subtotal`, `igv`, `total` en reservas y comprobantes; preparar para integración SUNAT (facturación electrónica) en fase posterior.
- **Pasarelas:** **Culqi** e **Izipay** para tarjeta; **Yape** para pago móvil. Diseñar `payments` con interfaz `PaymentGateway` para soportar varias.
- **Comprobantes:** dejar gancho para boleta/factura electrónica (no en MVP, pero el modelo de datos lo contempla).

---

## 10. Convenciones para Claude Code

- **Idioma:** código y comentarios en español/inglés mixto aceptable; nombres de dominio en español (`reservas`, `comercios`), términos técnicos en inglés.
- **Backend:** NestJS modular. Un módulo por dominio del core y uno por vertical en `verticals/`. DTOs validados con `class-validator`. Nada de lógica de vertical dentro del core.
- **Frontend:** Angular standalone + signals, lazy-loading por feature/vertical, servicios HTTP tipados con los DTOs de `libs/`.
- **DB:** Mongoose con discriminadores para `servicios`. Índices ESR según sección 4.3. Nunca consultas sin índice en colecciones de reservas/servicios.
- **Multi-tenant lógico:** todo dato de comercio filtrado por `comercioId`; los guards deben impedir que un comercio acceda a datos de otro.
- **Seguridad:** JWT + roles (`cliente`, `comercio_admin`, `comercio_staff`, `admin`) con guards. Passwords con bcrypt/argon2.
- **Pagos:** confirmar reserva **sólo** tras webhook/confirmación de pago aprobado. Idempotencia en el handler de pago.
- **Disponibilidad:** usar `SlotHold` temporal (TTL) al iniciar el pago para evitar sobreventa; liberar si el pago no se concreta.
- **Extender un vertical:** crear `verticals/<nombre>` con: schema discriminador + `AvailabilityStrategy` + `PricingStrategy` + auto-registro en el registry. **No tocar el core.**
- **Variables sensibles:** sólo por `.env` / secrets de GitHub y Coolify. Nunca hardcodear credenciales.
- **Propiedad del cliente:** repositorio GitHub, cuenta de Atlas, Netlify, Coolify y pasarelas a nombre del cliente final.

---

### Orden sugerido de construcción para Claude Code
1. Scaffold monorepo (`apps/web`, `apps/api`, `libs`, workflows).
2. Core backend: `auth`, `users`, `comercios`, `catalog` (servicios base), `availability` (interfaces + registry), `bookings`, `payments`.
3. Vertical **Hoteles** (discriminator + estrategias).
4. Frontend: auth, buscador unificado, flujo de reserva de hoteles, perfil usuario, panel comercio, panel admin.
5. Pagos (Culqi/Izipay/Yape) + confirmación por webhook.
6. CI/CD (Netlify + Coolify).
7. Vertical **Taxis** para validar extensibilidad → luego Vuelos, Transporte, Guardería.

---

## 11. Pagos — Stripe (único método de pago)

> **Decisión:** La única pasarela de pago es **Stripe**. No se integran Culqi, Izipay ni Yape en esta versión. Toda la lógica de pago se encapsula detrás de la interfaz `PaymentGateway` para poder añadir pasarelas en el futuro sin tocar el core.

### 11.1 Costos Stripe (a reflejar siempre en los reportes del admin)

| Tipo de transacción | Tarifa Stripe |
|---|---|
| Tarjeta nacional (Visa/MC Perú) | **2.9% + $0.30 USD** por transacción exitosa |
| Tarjeta internacional | **3.9% + $0.30 USD** |
| Conversión de moneda (USD→PEN) | +1.5% adicional si la tarjeta es en USD |

> **Convención del sistema:** El `stripeFee` se calcula sobre el `montoTotal` en PEN al tipo de cambio del momento. Para el MVP usar **2.9% + S/1.10** (equivalente aproximado de $0.30 USD a ~S/3.7; ajustar con tipo de cambio real). Esto se configura en `ComisionConfig` en la BD.

### 11.2 Modelo de comisiones por vertical

**Jerarquía de comisiones (de mayor a menor prioridad):**
1. `comisionPctOverride` del comercio (si está seteado, gana sobre todo)
2. `comisionPct` de la configuración del vertical (seteada por el admin)
3. `COMISION_PCT_DEFAULT` = 15% (fallback global en `constants.ts`)

```
comisionPlataforma = montoSubtotal × comisionPct (15% default)
stripeFee          = montoTotal × 0.029 + 1.10    (S/)
liquidacionComercio = montoTotal - comisionPlataforma - stripeFee
igv                = montoSubtotal × 0.18
montoTotal         = montoSubtotal + igv
```

**Comisiones iniciales por vertical (configurables desde el admin):**

| Vertical | Comisión plataforma (default) | Justificación |
|---|---|---|
| Hoteles | **15%** | Estándar mercado peruano |
| Vuelos | **8%** | Margen bajo por competencia |
| Taxis | **20%** | Operación on-demand de alto volumen |
| Transporte | **12%** | B2B, tickets altos |
| Guardería | **10%** | Servicio social, sensible al precio |

Estos valores se almacenan en la colección `comision_configs` y son editables desde el panel admin sin redeploy.

### 11.3 Esquema `comision_configs` (nueva colección)

```
_id
vertical: VerticalKey | 'global'   // 'global' = fallback para todos
comisionPct: number                 // 0.15 = 15%
stripePct: number                   // 0.029
stripeFijoSoles: number             // 1.10
activo: boolean
actualizadoPor: ObjectId (admin)
createdAt, updatedAt
```

### 11.4 Flujo de pago con Stripe (webhook-driven)

```
1. Cliente inicia reserva → BookingsService.crear() → SlotHold temporal
2. Frontend llama POST /payments/intent → PaymentsService crea PaymentIntent en Stripe
   - Devuelve clientSecret al frontend
3. Frontend confirma con Stripe.js (sin que el card data toque nuestro servidor)
4. Stripe llama al webhook POST /payments/webhook
   - payment_intent.succeeded → confirmar reserva + calcular liquidación
   - payment_intent.payment_failed → liberar SlotHold
5. Liquidación al comercio: monto - comisión plataforma - Stripe fee
```

> **Idempotencia:** el webhook handler verifica `pago.estado` antes de procesar; si ya es `aprobado`, ignora el evento duplicado.

### 11.5 Reportes financieros del admin

El panel admin debe mostrar **siempre** los tres niveles de la ganancia:

| Columna en reporte | Fórmula |
|---|---|
| GMV (valor bruto reservas) | Suma de `montoTotal` de reservas confirmadas |
| Ingresos plataforma | Suma de `comisionMonto` |
| Costos Stripe | Suma de `stripeFee` de cada pago |
| **Margen neto plataforma** | Ingresos plataforma − Costos Stripe |
| Liquidaciones a comercios | Suma de `montoLiquidacion` |

**Filtros de reporte:** rango de fechas, vertical, comercio específico, estado de reserva.

---

## 16. Monorepo — única fuente de código (front + back)

> **Regla absoluta:** frontend Angular y backend NestJS viven en el **mismo repositorio Git**. No hay repos separados. El monorepo usa **npm workspaces** para que ambas apps compartan el paquete `libs/shared` sin publicar a npm.

```
/                           ← raíz del monorepo (un solo git init)
├── apps/
│   ├── web/               ← Angular 20+ (workspace "web")
│   └── api/               ← NestJS    (workspace "api")
├── libs/
│   └── shared/            ← DTOs, enums, tipos compartidos (workspace "shared")
├── package.json           ← workspaces: ["apps/*", "libs/*"]
├── .github/workflows/
└── CLAUDE.md
```

**Reglas de workspace:**
- `npm run dev:api` → levanta NestJS en modo watch.
- `npm run dev:web` → levanta Angular en modo watch.
- `npm run test` → ejecuta tests en todos los workspaces.
- Imports del backend a shared: `import { CreateReservaDto } from 'shared'`.
- Imports del frontend a shared: idéntico; el build de Angular lo resuelve vía `paths` en `tsconfig`.

---

## 17. Skills y convenciones por tecnología

### 12.1 TypeScript (todos los workspaces)
- `strict: true` en todos los `tsconfig.json`. Sin `any` explícito; usar `unknown` + type-guard si aplica.
- Preferir `interface` sobre `type` para DTOs y contratos de dominio.
- Usar `readonly` en propiedades que no cambian tras construcción.
- Genéricos descriptivos: `T` sólo cuando es realmente genérico; preferir `TResult`, `TEntity`.
- No usar `!` non-null assertion sin comentario justificado.

### 12.2 NestJS (apps/api)
- Un módulo por dominio; cada módulo exporta sólo lo que otros módulos necesitan.
- Controllers: sólo orquestación (recibir, delegar al service, devolver). Sin lógica de negocio.
- Services: toda la lógica de negocio. Sin acceso directo a HTTP ni a `Request`/`Response`.
- Repositories: toda la lógica de acceso a datos. Los services no llaman a Mongoose directamente.
- Pipes de validación globales con `class-validator` + `class-transformer`.
- Exception filters personalizados: `DomainException` → HTTP status correcto.
- Guards: `JwtAuthGuard` + `RolesGuard` como decoradores en controllers.
- DTOs en `libs/shared` cuando son usados por el frontend; DTOs internos del API en el módulo.

### 12.3 Angular 20+ (apps/web)
- **Standalone components** en todos lados; no usar `NgModule` salvo integración de terceros.
- **Signals** para estado local (`signal()`, `computed()`, `effect()`). No `BehaviorSubject` para estado de UI.
- **`inject()`** en lugar de constructor injection en componentes.
- Lazy loading obligatorio por feature y por vertical. El `app.routes.ts` sólo tiene rutas vacías con `loadChildren`.
- Servicios HTTP tipados: `HttpClient.get<T>()` siempre con el tipo explícito.
- `OnPush` change detection en todos los componentes que no son page-level.
- No subscriptions manuales en componentes: usar `AsyncPipe` o `toSignal()`.
- Formularios: `ReactiveFormsModule` (no `FormsModule` / `ngModel`).

### 12.4 MongoDB / Mongoose (apps/api)
- Schemas en archivos `.schema.ts`; exportar el tipo `HydratedDocument<T>` y el token `@InjectModel`.
- Discriminadores para `servicios`: schema base en `catalog`, cada vertical registra su discriminador.
- Todas las consultas con proyección explícita (`.select()`); nunca devolver el documento completo si no se necesita.
- Queries en repositorios: siempre usar `.lean()` salvo que se necesite instancia Mongoose.
- Transacciones Mongoose para operaciones que tocan ≥2 colecciones (ej.: crear reserva + actualizar disponibilidad).
- Índices declarados en el schema con `{ index: true }` o en `createIndexes()` al bootstrap.

### 12.5 Jest (testing — back y front)
- Archivo de test junto al archivo fuente: `foo.service.spec.ts` al lado de `foo.service.ts`.
- Mocks con `jest.fn()` / `jest.spyOn()`; nunca importar módulos reales de infraestructura en tests unitarios.
- Describe/it en español (el dominio es en español): `describe('ReservasService', () => { it('debería confirmar la reserva cuando el pago es aprobado', ...) })`.
- Coverage mínima: **80% statements / 80% branches** por workspace. Configurado en `jest.config.ts` con `coverageThreshold`.
- No usar `any` en tests; tipar los mocks con `jest.Mocked<T>`.

---

## 18. Principios SOLID aplicados al proyecto

### S — Single Responsibility
- Cada clase/servicio hace **una sola cosa**: `ReservasService` gestiona reservas, no calcula precios.
- Cada módulo NestJS = un dominio cohesionado.
- Cada componente Angular = una pantalla o un widget, no ambos.

### O — Open/Closed
- El **core** (bookings, availability, catalog) está **cerrado a modificación**: no añadir `if vertical === 'hotel'` en el core.
- El sistema está **abierto a extensión**: añadir un vertical = crear un módulo nuevo que implementa las interfaces del core.

### L — Liskov Substitution
- `HotelAvailabilityStrategy`, `TaxiAvailabilityStrategy`, etc. son sustituibles en cualquier lugar que espere `AvailabilityStrategy`.
- Los discriminadores Mongoose extienden `Servicio`; cualquier código que reciba un `Servicio` funciona con cualquier subtipo.

### I — Interface Segregation
- Interfaces pequeñas y específicas: `AvailabilityStrategy`, `PricingStrategy`, `PaymentGateway`, `BookingStrategy`.
- No una interfaz `IVertical` enorme; cada aspecto del vertical tiene su propia interfaz.

### D — Dependency Inversion
- Los services dependen de interfaces/tokens (`AVAILABILITY_REGISTRY`, `PAYMENT_GATEWAY`), no de implementaciones concretas.
- NestJS DI resuelve las implementaciones; el service nunca hace `new HotelAvailabilityStrategy()`.

---

## 19. Clean Code — reglas obligatorias

### Nombres
- Variables, funciones y parámetros: **verbos para funciones** (`confirmarReserva`, `calcularComision`), **sustantivos para datos** (`reserva`, `comercioId`).
- No abreviaciones (`res` → `reserva`, `com` → `comercio`), excepto convenciones conocidas (`dto`, `id`, `req`).
- Booleanos con prefijo `es`, `tiene`, `puede`: `estaDisponible`, `tieneDescuento`.

### Funciones
- Máximo **20 líneas**. Si crece más, extraer función con nombre descriptivo.
- Un nivel de abstracción por función. No mezclar lógica de negocio con acceso a BD en la misma función.
- Máximo **3 parámetros**; si se necesitan más, usar un objeto (DTO o options object).

### Estructura
- No comentarios que explican el QUÉ (el código lo dice); sólo comentarios que explican el POR QUÉ (restricciones no obvias, reglas de negocio peruanas, workarounds).
- Sin código muerto (`// console.log`, funciones nunca llamadas).
- Sin magic numbers: `const IGV_RATE = 0.18` en `libs/shared/constants.ts`.
- Early return para casos de error/borde; no anidar `if` más de 2 niveles.

### Módulos
- Imports ordenados: 1) librerías externas, 2) imports del monorepo (`shared`), 3) imports del mismo módulo.
- Barrel exports (`index.ts`) en cada módulo para exponer sólo la superficie pública.

---

## 20. Convenciones de testing — regla de oro

> **Cada archivo de producción tiene su archivo `.spec.ts` correspondiente, creado en el mismo momento que el archivo de producción.** No hay PRs sin tests.

### Backend (NestJS + Jest)
```
apps/api/src/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts       ← siempre
│   │   ├── auth.controller.ts
│   │   ├── auth.controller.spec.ts    ← siempre
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   └── jwt.guard.spec.ts      ← siempre
```

**Patrón de test de service:**
```ts
describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: { findByEmail: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
    usersRepo = module.get(UsersRepository);
  });

  it('debería lanzar UnauthorizedException si el email no existe', async () => {
    usersRepo.findByEmail.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(UnauthorizedException);
  });
});
```

### Frontend (Angular + Jest)
```
apps/web/src/app/features/
├── auth/
│   ├── login/
│   │   ├── login.component.ts
│   │   ├── login.component.spec.ts    ← siempre
│   ├── auth.service.ts
│   └── auth.service.spec.ts           ← siempre
```

**Patrón de test de componente Angular (standalone + signals):**
```ts
describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = { login: jest.fn() } as any;
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
  });

  it('debería llamar a login con email y contraseña del formulario', async () => {
    authService.login.mockResolvedValue({ token: 'abc' });
    // ... set form values, trigger submit
    expect(authService.login).toHaveBeenCalledWith({ email: '...', password: '...' });
  });
});
```

### Cobertura mínima obligatoria
```json
// jest.config.ts (api y web)
coverageThreshold: {
  global: { statements: 80, branches: 80, functions: 80, lines: 80 }
}
```

---

## 21. UI Kit — Design System (OBLIGATORIO para toda UI)

> **Regla absoluta:** Todo componente Angular del proyecto debe usar los tokens CSS y las clases `rs-*` definidos en `apps/web/src/styles.scss`. **Nunca hardcodear colores, tipografías ni espaciados.**

### 21.1 Filosofía de diseño

Inspirado en helm.yt: **premium dark, whitespace generoso, tipografía clara, accent vibrante**.

| Atributo | Decisión |
|---|---|
| Tema base | **Dark navy** — `--bg-base: #080D1A` |
| Accent | Gradiente azul-índigo `#4F72F8 → #8B5CF6` |
| Fuente | **Inter** (Google Fonts, cargada en `index.html`) |
| Escala de espaciado | Base 4px — tokens `--s-1` a `--s-24` |
| Border radius estándar | `--r-lg` (12px) para inputs/cards, `--r-xl` (16px) para modales |

### 21.2 Tokens CSS (`:root` en `styles.scss`)

```scss
/* Fondos */
--bg-base, --bg-elevated, --bg-card, --bg-surface, --bg-subtle
--bg-light, --bg-light-2

/* Accent */
--accent, --accent-hover, --accent-light, --accent-subtle, --accent-gradient

/* Texto */
--text-primary, --text-secondary, --text-muted
--text-dark, --text-dark-secondary

/* Tipografía */
--font-sans, --font-display
--text-xs (12) a --text-6xl (60)
--fw-normal (400) a --fw-extrabold (800)

/* Espaciado */
--s-1 (4px) a --s-24 (96px)

/* Otros */
--r-sm a --r-full    (border radius)
--shadow-sm a --shadow-accent
--t-fast, --t-base, --t-slow  (transiciones)
```

### 21.3 Clases globales `rs-*`

```
Botones:  .rs-btn .rs-btn--{primary|secondary|outline|ghost|danger}
          .rs-btn--{sm|lg|xl|block}

Formularios:
          .rs-form-group > .rs-label + .rs-input [.rs-input--error] + .rs-field-error
          
Cards:    .rs-card [.rs-card--glass]
Badges:   .rs-badge .rs-badge--{accent|success|warning|error|neutral}
Alertas:  .rs-alert .rs-alert--{error|success|warning|info}
Layout:   .rs-container [.rs-container--sm|md|lg|2xl]  .rs-section
Navbar:   .rs-navbar  (con __brand, __nav, __link, __actions)
Tabs:     .rs-vertical-tabs  .rs-vertical-tab  [.activo]
Auth:     .rs-auth-layout  .rs-auth-card  (con __brand, __footer)
Hero:     .rs-buscador-hero (con __content, __eyebrow, __heading, __subheading)
Utils:    .rs-gradient-text  .rs-spinner  .rs-divider [.rs-divider--text]
```

### 21.4 Componentes Angular del UI Kit (`apps/web/src/app/shared/`)

```
RsButtonComponent   → <rs-button variant="primary|secondary|outline|ghost|danger"
                                  size="sm|md|lg|xl" [block]="true" [loading]="true">
RsInputComponent    → <rs-input label="..." type="..." placeholder="..." [error]="...">
                       (ControlValueAccessor — compatible con formControlName)
RsCardComponent     → <rs-card title="..." subtitle="..." [glass]="true">
RsBadgeComponent    → <rs-badge variant="accent|success|warning|error|neutral">
RsNavbarComponent   → <rs-navbar /> (incluye auth state automático)
```

Importar: `import { RsButtonComponent } from '../../shared';`

### 21.5 Reglas de uso obligatorias

1. **Sin hardcoded colors.** Siempre `var(--xxx)`. Si un color nuevo es necesario, añadir el token a `:root` en `styles.scss` primero.
2. **Sin hardcoded spacing.** Siempre `var(--s-N)`. Nunca `margin: 16px` o `padding: 8px`.
3. **Botones:** siempre `<button class="rs-btn rs-btn--[variante]">` o `<rs-button>`. Nunca `<button style="background:blue">`.
4. **Inputs:** siempre `<input class="rs-input">` o `<rs-input>`. Incluir `.rs-input--error` cuando hay error de validación.
5. **Formularios:** siempre dentro de `.rs-form-group` con `.rs-label` y `.rs-field-error`.
6. **Componentes de layout compartidos** → usar la clase global. Si necesitas estilo específico de un componente, defínelo en el `styles: [...]` del componente usando `var(--xxx)`.

### 21.6 Skills Claude Code disponibles

| Skill | Qué hace |
|---|---|
| `/ui-kit` | Audita, mantiene y extiende el design system |
| `/ui-kit audit` | Busca violaciones del design system en el código |
| `/ui-kit nuevo [nombre]` | Crea un nuevo componente shared siguiendo el UI Kit |
| `/design-tokens` | Referencia rápida de todos los tokens y clases |
| `/nuevo-componente [nombre]` | Scaffolding de componente Angular con UI Kit integrado |
| `/speckit` | Spec-Driven Development: spec → plan → tasks → implement |

### 21.7 spec-kit — Spec-Driven Development

El directorio `.specify/` contiene:
```
.specify/
├── CONSTITUTION.md          ← principios del proyecto (leer al inicio de sesión)
└── templates/
    ├── spec.md              ← template de especificación funcional
    ├── plan.md              ← template de plan técnico
    └── tasks.md             ← template de task breakdown
```

Flujo: `spec` → `plan` → `tasks` → `implement` → `converge`. Usar `/speckit [paso]`.

### 21.8 Añadir un nuevo elemento al design system

Si necesitas un color, componente o patrón nuevo:

1. Añade el token a `:root` en `apps/web/src/styles.scss` con nombre `--rs-nuevo-token`.
2. Si es una clase global, añade la clase `.rs-nuevo-elemento` en la sección correcta de `styles.scss`.
3. Si es un componente Angular reutilizable, créalo en `shared/components/[nombre]/rs-[nombre].component.ts`.
4. Añádelo al barrel `shared/index.ts`.
5. Documenta el nuevo token/clase en `.claude/commands/design-tokens.md`.
6. Nunca eliminar tokens existentes sin revisar qué los usa (`grep -r "var(--token)"`).
