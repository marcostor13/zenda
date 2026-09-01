# PLAN — Categoría "Servicios funerarios" (sustituye a "Paseadores y cuidado a domicilio")

> Fuente: `nuevoservicio.md` (2026-09-01). Reemplaza por completo el vertical
> `cuidadores`, que se elimina del código, del enum y de la navegación.

## 0. Decisiones de diseño

| Punto del brief | Cómo se resuelve | Por qué |
|---|---|---|
| Precio cerrado siempre que se pueda (§2, "IMPORTANTE") | El precio se calcula **entero en la estrategia de disponibilidad**: servicio según tramo de peso + recogida (fija/por km/por zona) + suplemento urgencia + extras elegidos. `precioCalculado` ya es el total que paga el cliente. | El motor de reservas ya toma `precioCalculado` como base (`bookings.service.ts`), así que no hace falta tocar el core para dar precio final. |
| Peso (§1, §3) | `tramosPeso[]` por servicio (`hastaKg` + `precio`). Sin tramos, `precioBase` del servicio. | Es la variable de precio real del sector; un `precioBase` plano no sirve. |
| Recogida (§6) | Bloque propio en el servicio: `ofreceRecogida`, `radioRecogidaKm`, `modoPrecioRecogida` (`fija`/`por_km`/`por_zona`), `precioRecogida`, `precioRecogidaPorKm`, `zonasRecogida[]`. Fuera de cobertura ⇒ `disponible: false` con motivo. | El brief exige impedir continuar fuera de radio. Se resuelve en la estrategia, que es quien puede decir "no". |
| Urgencia / 24 h (§3) | `servicioUrgente`, `suplementoUrgencia`, `atiende24h`, `tiempoEstimadoHoras`. | Filtro del buscador y suplemento de precio. |
| Extras (§4) | `extras[]` (`nombre`, `precio`, `descripcion`) configurables por la empresa; el cliente elige varios en el wizard y suman al total. | Cada empresa vende cosas distintas (urna, huella, ceremonia…). |
| Cremación colectiva (§8) | `tipo: 'cremacion_colectiva'` en el catálogo + aceptación **obligatoria** en el wizard antes de pagar cuando el servicio elegido no devuelve cenizas. | Requisito legal/ético explícito del brief. |
| Seguimiento (§7) | Hitos propios del vertical sobre la infraestructura existente (`reserva.seguimiento`, `PATCH mis-reservas/:id/seguimiento`), con los 8 estados del brief. Los que no apliquen simplemente no se marcan. | Ya existe el mecanismo (transporte, alojamiento); no se inventa uno nuevo. |
| Cancelaciones propias (§11) | `politicaCancelacion` con dos tramos: antes de la recogida y después de iniciado el servicio; se muestra en la ficha y en el resumen previo al pago. | El brief pide diferenciarlos explícitamente. |
| Alta y verificación (§10) | En el alta: declaración de autorizaciones/permisos y `cremacionPropia` (propia o con tercero, con el nombre del tercero). | Se suma a la declaración responsable general que ya existe. |
| Panel de empresa (§9) y Admin (§12) | Se sirven **con lo que ya existe** (Servicios, Reservas, Ingresos, Cancelaciones, Horarios, y el panel admin de comercios/servicios/reservas), más los hitos de recogida en Reservas. | Son pantallas transversales, no específicas del vertical: duplicarlas rompería el principio de core agnóstico (CLAUDE.md §3.3). |
| Reseñas (§13) | Aspectos propios: atención, profesionalidad, sensibilidad, claridad y cumplimiento. | `resena-aspectos.config.ts` ya es por vertical. |

**Fuera de alcance de esta entrega (anotado como deuda):** el retardo en la
petición de reseña (§13) depende del programador de notificaciones, que hoy no
tiene retardo por vertical; y los tests, que el cliente pidió dejar como deuda
técnica.

## 1. Olas de implementación

### Ola 0 · Contratos compartidos (`libs/shared`)
- `VerticalKey.CUIDADORES` → `VerticalKey.FUNERARIOS = 'funerarios'`; label
  "Servicios funerarios".
- `enums/funerarios.enum.ts`: `TipoServicioFunerario`, `LugarRecogida`,
  `FranjaHoraria`, `UrgenciaFunerario`, `HitoFunerario` + etiquetas.

### Ola 1 · Backend
- Borrar `apps/api/src/verticals/cuidadores/**`.
- `verticals/funerarios/funerarios.schema.ts` (discriminador), 
  `funerarios-availability.strategy.ts` (disponibilidad + precio cerrado),
  `funerarios.module.ts` (auto-registro).
- Core: `app.module.ts`, `catalog.module.ts` (discriminador),
  `catalog.repository.ts` (facetas + contador de plazas),
  `catalog.service.ts` (campos de disponibilidad, extra, requeridos y
  proyección del detalle).

### Ola 2 · Configuración de UI (web)
- `verticales.config.ts` (entrada nueva, en el escaparate), `media/images.ts`
  (icono), `app.routes.ts` (listado + ficha), `filtros.config.ts` (servicio,
  recogida, urgencia, cenizas), `resena-aspectos.config.ts`.

### Ola 3 · Alta del comercio (`/comercio/alta`)
- Sección `funerarios` en `comercio-listado-form.component.ts`: catálogo de
  servicios con tramos de peso, recogida y su tarificación, urgencias, extras,
  cenizas/urna/certificado, tiempos, política de cancelación propia y la
  declaración de autorizaciones + quién realiza la cremación.

### Ola 4 · Escaparate
- `vertical-browse.component.ts` y `vertical-detalle.component.ts`: tarjeta,
  metadatos y ficha con lo que de verdad decide aquí (recogida, 24 h, cenizas).

### Ola 5 · Reserva
- Paso 1 propio en `reserva-wizard.component.ts`: servicio → mascota/peso →
  recogida (lugar, dirección, urgencia) → fecha y franja → extras, con la
  aceptación obligatoria de la cremación colectiva y la política de
  cancelación antes del pago.

### Ola 6 · Seguimiento
- Hitos del vertical en `comercio-reservas.component.ts` y sus etiquetas en
  `reserva-detalle.component.ts`.

### Ola 7 · Limpieza y verificación
- Cero referencias a `cuidadores` en `apps/**/src` y `libs/**/src`.
- `tsc` de shared + `ng build` + `nest build`.

## 2. Estado de la ejecución (2026-09-01)

Todas las olas quedan implementadas y verificadas con `tsc` (shared), `nest build`
(api) y `ng build` (web).

| Ola | Estado | Archivos |
|---|---|---|
| 0 · Contratos | ✅ | `libs/shared/src/enums/funerarios.enum.ts` (nuevo), `vertical.enum.ts`, `index.ts` |
| 1 · Backend | ✅ | `verticals/funerarios/{schema,availability.strategy,module}` (nuevos); `cuidadores/**` borrado; `app.module`, `catalog.{module,repository,service}` |
| 2 · Config UI | ✅ | `verticales.config`, `media/images`, `app.routes`, `filtros.config`, `resena-aspectos.config`, `public/icons/funerarios.svg` (nuevo, `cuidadores.svg` borrado) |
| 3 · Alta comercio | ✅ | `comercio-listado-form.component.ts` (sección funerarios completa + validaciones) |
| 4 · Escaparate | ✅ | `vertical-browse`, `vertical-detalle`, `shared/verticales/funerarios.util.ts` (nuevo) |
| 5 · Reserva | ✅ | `reserva-wizard.component.ts` (paso 1 propio, precio cerrado, aceptación de cremación colectiva, política de cancelación) |
| 6 · Seguimiento | ✅ | `comercio-reservas.component.ts` (hitos), `reserva-detalle.component.ts` (etiquetas) |
| 7 · Limpieza | ✅ | Cero referencias a `cuidadores` en `apps/**/src` y `libs/**/src` (salvo el puesto de trabajo "Cuidador/a" del equipo del comercio, que no es la categoría) |

### Deuda declarada
- **Tests**: los `.spec.ts` que citaban `cuidadores` (`reserva-wizard`, `vertical-browse`,
  `vertical-detalle`, `rs-navbar`, `verticales.config`) siguen apuntando al vertical
  retirado; el cliente pidió dejarlos como deuda técnica.
- **§13 · Retardo de la petición de reseña**: el programador de notificaciones no
  admite hoy un retardo por vertical; queda pendiente.
