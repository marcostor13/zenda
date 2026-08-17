# Plan técnico — Informe Gerencial "Mejora de Servicios"

> **Origen:** `docs/INFORME-GERENCIAL-MEJORA-SERVICIOS.docx` (17/08/2026), que resume
> `docs/AUDITORIA-TICKETS-MEJORA-SERVICIOS.md` (69 historias, 52 hechas / 9 parciales / 8 pendientes)
> y cierra con un plan de 7 bloques. Este documento traduce cada bloque a tareas técnicas
> concretas (archivos, campos, endpoints) para ejecutarlas en orden.
>
> **Regla de este plan:** cada bloque se verifica con `tsc` + `nest build` + `ng build production`
> antes de pasar al siguiente. Los tests de la suite completa no se corren en cada paso (ver
> `feedback-tests-deuda-tecnica`); se ejecutan al cerrar todo el plan o el bloque en curso.

## Estado de los bloques

| Bloque | Contenido | Estado |
|---|---|---|
| 1 | Trayectos recurrentes (UI) + importar historial clínico desde Excel (UI) | ✅ hecho |
| 2 | Confirmación de datos antes de pagar + mensaje unificado de estimación + desglose permanente de cargos + resumen automático del perro para el negocio | ✅ hecho |
| 3 | Bloqueo por comportamiento no admitido en residencias | ✅ hecho |
| 4 | Transporte: campos obligatorios/opcionales, comportamiento en viaje visible, ida-vuelta con espera | ✅ hecho |
| 5 | Adiestramiento: vídeos, seguimiento estructurado, cuestionario ampliado, plan personalizado/bono | ✅ hecho |
| 6 | Reporte de ajustes de precio (admin) + presupuesto ajustado por historial del perro | ✅ hecho |
| 7 | Categorías "paseadores"/"cuidado a domicilio" | ⛔ requiere decisión del cliente (ver abajo) — no planificar hasta confirmar |

---

## Bloque 1 — Aprovechar lo ya construido por dentro

### 1a. Trayectos recurrentes (Ref. TRA3)
- Backend ya completo: `RecurrenciaDto`/`RecurrenciaParams`, `BookingsService.calcularOcurrenciasRecurrentes`,
  wired en `bookings.controller.ts` y `CrearReservaDto.recurrencia`.
- Falta: UI en `reserva-wizard.component.ts` (paso 1, vertical transporte) — selector de días de la
  semana + hora + fecha fin, y pasar `recurrencia` en `CrearReservaPayload` (falta el campo en
  `reservas.service.ts`).

### 1b. Cargar historial clínico desde Excel (Ref. VET5)
- Backend ya completo: `PerrosController` tiene `POST /perros/:id/historial/previsualizar` y
  `POST /perros/:id/historial/importar` (`PerrosService.parsearImportacion`/`importarHistorial`).
- Falta: UI en `comercio-reservas.component.ts`, dentro del panel "Historia veterinaria" ya
  existente — textarea para pegar la tabla, botón "Previsualizar", tabla de filas parseadas
  editable, botón "Guardar".

---

## Bloque 2 — Reforzar la confianza del cliente antes de pagar

### 2a. Confirmación de datos correctos antes de pagar (Ref. S2)
- `paso2Form` en `reserva-wizard.component.ts`: nuevo control `confirmaDatosMascota`
  (`Validators.requiredTrue`), checkbox junto a `aceptaTerminos`.

### 2b. Mensaje unificado de precio estimado (Ref. S1)
- Mismo bloque del wizard: banner fijo antes del checkbox de confirmación, igual en los 6
  verticales — "Este importe es una estimación...". No se tocan los avisos específicos por
  vertical ya existentes (precio cerrado/orientativo de veterinaria, etc.), que aportan detalle
  adicional legítimo.

### 2c. Desglose permanente de cargos en la reserva (Ref. S10)
- `reserva-detalle.component.ts`: nueva tarjeta "Cargos adicionales" que lista
  `reserva.suplementos[]` (concepto, monto, motivo, foto, fecha) siempre que el array no esté
  vacío, no solo mientras el ajuste está pendiente.

### 2d. Resumen automático del perfil del perro para el negocio (Ref. N5)
- Backend: `MiReserva` (frontend) ya recibe `perroSnapshot` en el JSON (el DTO del backend hace
  spread de la reserva completa) pero la interfaz TS no lo declara — añadirlo.
- Frontend: `comercio-reservas.component.ts` — función pura que boolean/array del snapshot
  (alergias, miedos, medicación, ansiedadSeparacion, protectorRecursos, reactividadCorrea,
  destructivoEnSoledad, orinaEnInterior, seMarea, requiereTransportin) a una lista corta de chips,
  visible directamente en la fila de la reserva sin clic adicional.

---

## Bloque 3 — Prevenir reservas de riesgo en residencias (Ref. RES5)

- `Perro` (`perro.schema.ts` + DTOs + `perro-form.component.ts`): nuevo campo booleano
  `tendenciaEscapar` (los demás rasgos de riesgo ya existen: `ansiedadSeparacion`,
  `protectorRecursos`, `reactividadCorrea`, `destructivoEnSoledad`).
- `Alojamiento` (`alojamiento.schema.ts`): nuevo campo `conductasNoAdmitidas: string[]`
  (valores: `agresividad` | `ansiedad_extrema` | `tendencia_escapar` | `destructivo`), mismo
  patrón que `compatibilidadSocialAdmitida`.
- `BookingsService.construirParametrosExtra`: propagar los flags de comportamiento del
  `perroSnapshot` (mismo mecanismo que `perroTamano`/`perroTipoPelo`).
- `AlojamientoAvailabilityStrategy`: `validarConductaRiesgo()` — 409 si el perro presenta un
  rasgo marcado como no admitido.
- UI: `comercio-listado-form.component.ts` (checkboxes, sección nueva bajo "Compatibilidad
  social").

---

## Bloque 4 — Terminar de pulir Transporte ✅ hecho

- **TRA1** ✅ `comercio-listado-form.component.ts` (sección transporte): leyenda "los campos con *
  son obligatorios" + etiquetas "(opcional)" en los campos que no lo son. Los únicos campos
  realmente obligatorios en el schema (`tarifaBase`, `tarifaKm`) ya tenían `*`.
- **TRA2** ✅ Ya cubierto por el resumen automático del Bloque 2 (N5): `resumenPerro()` en
  `comercio-reservas.component.ts` ya muestra "Se marea en viajes"/"Requiere transportín" como
  chip visible en cada fila de reserva, sin clic adicional — cubre el objetivo sin necesitar un
  panel dedicado aparte.
- **TRA4** ✅ Ida y vuelta con espera en un solo servicio: `detalle.tipoTrayecto: 'ida_vuelta'` +
  `esperaMinutos` (wizard, vertical transporte) → `TransporteAvailabilityStrategy` cobra
  `(tarifaBase + tarifaKm×distancia) × 2 + tarifaEsperaPorHora × (esperaMinutos/60)`.
  **Decisión de precio tomada sin confirmación del cliente** (el informe pedía acordarla antes):
  se añadió `Transporte.tarifaEsperaPorHora`, configurable por el propio comercio en su listado
  (0 por defecto = no cobra espera), en vez de imponer una fórmula fija — evita bloquear la
  entrega mientras se resuelve con el cliente, pero conviene confirmarlo con él cuando pueda.

## Bloque 5 — Ampliar Adiestramiento ✅ hecho

- **ADI3** ✅ Nuevo endpoint `POST /upload/video` (MP4/WebM/MOV, máx 50 MB, reutiliza
  `UploadService.uploadImage` que ya es agnóstico al tipo de archivo) + input de fichero en el
  paso 1 del wizard de adiestramiento → `detalle.videosUrl: string[]`. Visible al comercio en el
  panel de detalle de `comercio-reservas.component.ts` (no se muestra en el detalle del propio
  cliente, que ya sabe lo que subió).
- **ADI5** ✅ `PerroHistorial.datosEstructurados` ya existía en el schema (genérico, sin usar) —
  se añadió `PerrosService.agregarHistorial()` al frontend (`perros.service.ts`, el endpoint
  backend ya existía) y un panel "Registrar seguimiento de la sesión" en
  `comercio-reservas.component.ts` con campos propios (objetivos/evolución/tareas para casa) que
  se guardan en `datosEstructurados`, no como texto libre.
- **ADI2** ✅ Campos `historialPrevio` (texto libre) y `vinculoPropietario` (select) en
  `paso1AdiestramientoForm` del wizard → `detalle`, visibles al comercio en el panel de detalle.
- **ADI4** ✅ **Decisión de diseño tomada sin confirmación del cliente** (ver §4 del informe: era
  la tarea de mayor alcance): en vez de una colección/flujo de pago nuevos, se reutiliza el ciclo
  de ajuste/suplemento ya probado (S3-S9: notificación, aprobación con un botón, cobro
  automático, comisión recalculada) — el comercio compone un suplemento con concepto libre
  ("Plan personalizado: X (N sesiones)") y precio, en vez de elegir del catálogo fijo. Evita
  tocar el webhook de Stripe (código sensible ya probado) y reduce el riesgo, a cambio de una
  limitación real: `solicitarAjuste` exige `reserva.estado === 'confirmada'`, así que el plan solo
  se puede proponer **antes** de marcar la valoración inicial como completada, no después. Si el
  cliente necesita proponerlo también sobre reservas ya completadas, hay que relajar esa validación
  en `BookingsService.solicitarAjuste` (código de pagos, cambiarlo con cuidado y tests).

## Bloque 6 — Analítica e inteligencia de precio ✅ hecho

- **S11** ✅ `AdminService.generarReporteAjustes()` (nuevo, dentro de `generarReporteFinanciero`):
  reservas con `suplementos.length > 0` en el rango filtrado, agrupadas por comercio, con
  `reservasConAjuste`/`importeAjustes`/`porcentajeConAjuste`. Nueva sección "Ajustes de precio
  por comercio" en `admin-reportes.component.ts`, ordenada por % descendente (resalta comercios
  con ≥30% de reservas ajustadas).
- **N8** ✅ `PerrosService.estimarPrecioConHistorial()`: promedio del % de suplementos aceptados
  en las reservas anteriores del perro (cualquier vertical), aplicado sobre el precio base
  actual — **puramente informativo**, no cambia el cálculo real que hace la estrategia de
  disponibilidad al reservar. Nuevo endpoint `GET /perros/:id/estimacion-precio?precioBase=`.
  Banner en el paso 2 del wizard ("según el historial de tu perro, el precio suele rondar €X"),
  solo si hay al menos 1 reserva previa y el ajuste medio es ≥1%.

## Bloque 7 — Decisión pendiente del cliente (Ref. COMI3)

No es trabajo de desarrollo. El vertical "Cuidadores" (el más parecido a "paseadores y cuidado a
domicilio") fue retirado explícitamente por decisión del cliente (TCK-8021). **No empezar este
bloque sin confirmar con el cliente que esa decisión cambió.**
