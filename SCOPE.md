# Doogking — Scope de la Plataforma

> Marketplace multi-vertical de reservas para el mercado peruano (stack actual: Angular 20 + NestJS + MongoDB Atlas + Stripe).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 20 (standalone components, signals, lazy loading) |
| Backend | NestJS 10 (modular monolith, REST, JWT) |
| Base de datos | MongoDB Atlas con Mongoose (discriminadores por vertical) |
| Pagos | Stripe (PaymentIntent + webhooks) |
| Almacenamiento | AWS S3 (imágenes) |
| Shared | `libs/shared` — DTOs, enums, constantes (npm workspace) |

---

## Verticales implementadas (5)

Todas comparten el motor de catálogo/disponibilidad/reserva/pago mediante el patrón Strategy + discriminador Mongoose.

| Vertical | Unidad reservable | Schema extra |
|---|---|---|
| **Hoteles** | Habitación por noches | habitaciones[], amenities, estrellas, checkIn/Out, cancelación gratis |
| **Taxis** | Traslado A→B | tipoVehiculo, zonaCobertura, tarifaBase + tarifaKm |
| **Vuelos** | Asiento en ruta/fecha | origen, destino, fechaSalida/Llegada, aerolinea, asientosTotales |
| **Transporte** | Carga por ruta | tipoCarga, capacidadKg/M3, rutasCubiertas, tarifas |
| **Guardería** | Cupo por hora/día/mes | rangoEdad, cuposTotales, modalidad, precioHora/Día/Mes, horario |

---

## API — Módulos core (`/api/v1`)

### Auth
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/auth/registro` | Registro de usuario |
| POST | `/auth/login` | Login → JWT |

### Users
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/users/me` | Perfil del usuario autenticado |
| PATCH | `/users/me` | Actualizar nombre, teléfono, avatar |
| PATCH | `/users/me/password` | Cambiar contraseña |

### Comercios
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/comercios` | Registrar comercio (queda en estado `pendiente`) |
| GET | `/comercios` | Listar comercios (admin) |
| GET | `/comercios/mi-comercio` | Datos del propio comercio |
| PATCH | `/comercios/mi-comercio` | Editar datos del comercio |
| GET | `/comercios/mis-reservas` | Reservas recibidas (últimas 50) |
| GET | `/comercios/mis-servicios` | Listados publicados |
| PATCH | `/comercios/mis-servicios/:id/estado` | Publicar / pausar servicio |
| GET | `/comercios/mis-resenas` | Reseñas recibidas |
| PATCH | `/comercios/mis-resenas/:id/respuesta` | Responder reseña |
| GET | `/comercios/:id` | Detalle de comercio (público) |
| PATCH | `/comercios/:id/estado` | Aprobar / suspender (admin) |

### Catálogo
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/catalog/servicios` | Crear servicio (comercio_admin) |
| GET | `/catalog/servicios` | Buscar servicios — filtros: vertical, ciudad, precioMin, precioMax, paginación |
| GET | `/catalog/servicios/:id` | Detalle de servicio |

### Reservas
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/reservas` | Crear reserva → genera `SlotHold` (TTL 15 min) |
| GET | `/reservas/mis` | Reservas del usuario autenticado |
| GET | `/reservas/codigo/:codigo` | Buscar por código `RES-XXXXXXXX` |
| GET | `/reservas/:id` | Detalle por ID |
| POST | `/reservas/:id/cancelar` | Cancelar → libera `SlotHold` |

### Pagos (Stripe)
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/payments/intent` | Crear PaymentIntent → devuelve `clientSecret` |
| POST | `/payments/webhook` | Webhook Stripe → confirma/rechaza reserva |

### Cupones
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/cupones/validar` | Validar cupón + preview descuento |
| POST | `/cupones` | Crear cupón (admin) |
| GET | `/cupones` | Listar cupones (admin) |
| PATCH | `/cupones/:id` | Editar cupón (admin) |
| DELETE | `/cupones/:id` | Eliminar cupón (admin) |

### Admin
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/admin/dashboard` | KPIs + reservas recientes + comercios pendientes |
| GET / PUT | `/admin/comisiones` | Leer / actualizar comisiones por vertical |
| GET / POST / PATCH / DELETE | `/admin/comercios` | CRUD de comercios |
| GET / POST / PATCH / DELETE | `/admin/usuarios` | CRUD de usuarios |
| GET | `/admin/reservas` | Listado paginado con filtros de estado |
| GET | `/admin/reportes/financiero` | Reporte financiero (GMV, comisiones, Stripe fees, margen) |

### Upload
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/upload/image` | Subir imagen → S3 (max 5 MB, JPEG/PNG/WebP/GIF) |

### AI Search
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/ai-search` | Búsqueda en lenguaje natural → parámetros estructurados |

---

## Frontend — Rutas

| Ruta | Feature | Auth | Componentes principales |
|---|---|---|---|
| `/` | Home | No | `HomeComponent` (landing) |
| `/auth/login` | Auth | No | `LoginComponent` |
| `/auth/registro` | Auth | No | `RegistroComponent` |
| `/buscador` | Buscador unificado | No | `BuscadorComponent` |
| `/hoteles` | Hoteles | No | `HotelesListaComponent`, `HotelDetalleComponent` |
| `/taxis` | Taxis | No | `TaxisListaComponent` |
| `/vuelos` | Vuelos | No | `VerticalBrowseComponent` |
| `/transporte` | Transporte | No | `VerticalBrowseComponent` |
| `/guarderia` | Guardería | No | `VerticalBrowseComponent` |
| `/reservas/mis-reservas` | Reservas | **Sí** | `MisReservasComponent` |
| `/reservas/:codigo` | Reservas | **Sí** | `ReservaDetalleComponent` |
| `/reservas/:vertical/:servicioId` | Checkout | **Sí** | `ReservaWizardComponent` (cupón + Stripe) |
| `/perfil` | Perfil usuario | **Sí** | Dashboard, Editar, Seguridad, Notificaciones, Pagos, Reseñas |
| `/comercio` | Panel comercio | **Sí** (rol) | Dashboard, Reservas, Listados, Ingresos, Reseñas, Config |
| `/admin` | Panel admin | **Sí** (rol) | Dashboard, Cupones, Comercios, Reservas, Usuarios, Reportes |

---

## Shared Components (UI Kit `rs-*`)

| Componente | Uso |
|---|---|
| `RsButtonComponent` | Botones con variantes y estados |
| `RsInputComponent` | Input con ControlValueAccessor (formControlName) |
| `RsCardComponent` | Tarjetas con variante glass |
| `RsBadgeComponent` | Badges de estado |
| `RsNavbarComponent` | Barra de navegación con auth state |
| `RsIconComponent` | Wrapper de iconos |
| `RsImageUploadComponent` | Upload de imágenes a S3 |
| `AnimateOnScrollDirective` | Animaciones on-scroll |
| `ImgFallbackDirective` | Fallback de imagen |

---

## Modelo financiero

```
montoSubtotal       → precio × cantidad
IGV (21%)           → montoSubtotal × 0.21          (configurable)
montoTotal          → montoSubtotal + igv
comisionPlataforma  → montoSubtotal × comisionPct    (15% default, por vertical)
stripeFee           → montoTotal × 1.5% + €0.25
montoLiquidacion    → montoTotal - comisionPlataforma - stripeFee
```

**Comisiones default por vertical** (editables desde admin sin redeploy):

| Vertical | Comisión |
|---|---|
| Hoteles | 15% |
| Vuelos | 8% |
| Taxis | 20% |
| Transporte | 12% |
| Guardería | 10% |

---

## Roles y permisos

| Rol | Acceso |
|---|---|
| `cliente` | Buscar, reservar, ver historial, perfil |
| `comercio_admin` | Panel comercio (listados, reservas, ingresos, reseñas, config) |
| `comercio_staff` | Panel comercio (solo operación, sin config) |
| `admin` | Panel admin completo (CRUD global + reportes + comisiones) |

---

## Colecciones MongoDB

| Colección | Descripción |
|---|---|
| `usuarios` | Cuentas de usuario |
| `comercios` | Negocios proveedores |
| `servicios` | Listados base + discriminadores por vertical |
| `reservas` | Bookings (código `RES-XXXXXXXX`) |
| `pagos` | Registro de intentos/estados Stripe |
| `cupones` | Descuentos (porcentaje o fijo, por vertical) |
| `comision_configs` | Comisiones configurables (global o por vertical) |

---

## Módulos pendientes / sin implementar

| Módulo | Estado |
|---|---|
| Notificaciones (email/WhatsApp/push) | Scaffold vacío |
| Reseñas (módulo frontend + backend) | Scaffold vacío |
| Fidelización / puntos | No iniciado |
| Facturación electrónica (SUNAT) | No iniciado |
| Login social (Google) | No iniciado |
| Build móvil (Capacitor) | No iniciado |
