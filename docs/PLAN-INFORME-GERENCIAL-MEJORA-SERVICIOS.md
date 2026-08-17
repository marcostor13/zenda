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
| 4 | Transporte: campos obligatorios/opcionales, comportamiento en viaje visible, ida-vuelta con espera | ⬜ pendiente |
| 5 | Adiestramiento: vídeos, seguimiento estructurado, cuestionario ampliado, plan personalizado/bono | ⬜ pendiente |
| 6 | Reporte de ajustes de precio (admin) + presupuesto ajustado por historial del perro | ⬜ pendiente |
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

## Bloque 4 — Terminar de pulir Transporte (pendiente)

- **TRA1** Campos obligatorios/opcionales claros: marcar visualmente en el formulario del
  comercio (`comercio-listado-form.component.ts`, sección transporte) qué campos son obligatorios.
- **TRA2** Comportamiento del perro en viaje visible al transportista: panel dedicado en
  `comercio-reservas.component.ts` (mismo patrón que "Historia veterinaria"), leyendo
  `perroSnapshot.seMarea/requiereTransportin/toleraTrayectosLargos`.
- **TRA4** Ida y vuelta con espera en un solo servicio: nuevo tipo de detalle
  (`tipoTrayecto: 'ida_vuelta'`, `esperaMinutos`) en el schema de transporte + estrategia de
  precio (tarifa base ×2 + km ×2 + posible cargo por espera) + UI en el wizard. Requiere acordar
  con negocio cómo cobrar la espera antes de fijar la fórmula (el informe lo señala explícitamente).

## Bloque 5 — Ampliar Adiestramiento (pendiente)

- **ADI3** Subida de vídeos: extender `rs-image-upload` o componente nuevo de subida de vídeo en
  el wizard (paso 1 adiestramiento) + campo `videosUrl: string[]` en el detalle de la reserva.
- **ADI5** Seguimiento estructurado: nuevos campos en `PerroHistorial` (`objetivos`, `evolucion`,
  `tareasCasa`) específicos cuando `vertical === 'adiestramiento'`, formulario propio en
  `comercio-reservas.component.ts` en vez del textarea libre actual.
- **ADI2** Cuestionario de comportamiento ampliado: campos estructurados
  (historial previo, vínculo con el propietario) en el paso 1 del wizard de adiestramiento.
- **ADI4** Plan personalizado/bono: flujo dedicado (el ciclo de suplementos genérico no cubre
  "proponer sesiones futuras") — nuevo estado o colección `planes_adiestramiento` con
  propuesta del comercio → aceptación y pago del cliente. Es la tarea de mayor alcance del plan.

## Bloque 6 — Analítica e inteligencia de precio (pendiente)

- **S11** Reporte de ajustes de precio para el admin: nuevo agregado en `admin.service.ts`
  (reservas con `suplementos.length > 0`, conteo + impacto económico por comercio) + sección en
  el panel admin.
- **N8** Presupuesto ajustado por historial del perro: en `BookingsService`/`CatalogService`,
  usar el histórico de suplementos aceptados del perro para ajustar el precio estimado mostrado
  antes de reservar.

## Bloque 7 — Decisión pendiente del cliente (Ref. COMI3)

No es trabajo de desarrollo. El vertical "Cuidadores" (el más parecido a "paseadores y cuidado a
domicilio") fue retirado explícitamente por decisión del cliente (TCK-8021). **No empezar este
bloque sin confirmar con el cliente que esa decisión cambió.**
