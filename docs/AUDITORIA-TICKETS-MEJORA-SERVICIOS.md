# Auditoría de tickets — Mejora de servicios

> **Fuente de los tickets:** `docs/HISTORIAS-USUARIO-MEJORA-SERVICIOS.md` (69 historias, 13 épicas).
> **Método:** cada historia se verificó **contra el código real** (schemas, servicios, componentes,
> tests), no contra `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`. Ese plan está fechado el
> 2026-07-18 y quedó desactualizado: varias épicas que marca como "no iniciadas" (Seguros,
> Comunidad, el carrito multi-vertical de Hotel) ya estaban completas en el código, construidas en
> sesiones posteriores. Se señala cada caso donde el código contradice al plan.
> **Fecha de la auditoría inicial:** 2026-08-17 (52 hechas / 9 parciales / 8 pendientes).
> **Actualizado:** 2026-08-17, tras ejecutar el plan de la sección final. **Estado actual: 69/69.**
> El detalle de cómo se cerró cada una está en `docs/PLAN-INFORME-GERENCIAL-MEJORA-SERVICIOS.md`.

## Resumen ejecutivo

| Épica | Historias | ✅ Hecho | 🟡 Parcial | ❌ Falta |
|---|---|---|---|---|
| N — Ficha Inteligente del Perro | 10 | 10 | 0 | 0 |
| S — Precio estimado y suplementos | 11 | 11 | 0 | 0 |
| CP — Compatibilidad y recomendación | 4 | 4 | 0 | 0 |
| R — Reputación bidireccional | 2 | 2 | 0 | 0 |
| PEL — Peluquería | 5 | 5 | 0 | 0 |
| RES — Residencias | 5 | 5 | 0 | 0 |
| ADI — Adiestramiento | 5 | 5 | 0 | 0 |
| TRA — Transporte | 5 | 5 | 0 | 0 |
| VET — Veterinaria | 6 | 6 | 0 | 0 |
| HOT — Hotel pet-friendly | 6 | 6 | 0 | 0 |
| SEG — Seguros | 4 | 4 | 0 | 0 |
| COM — Comunidad | 3 | 3 | 0 | 0 |
| COMI — Comisiones | 3 | 3 | 0 | 0 |
| **Total** | **69** | **69 (100%)** | **0** | **0** |

**Lectura rápida:**
- **Las 69 historias están entregadas.** Las 17 que esta auditoría encontró abiertas (9 parciales
  + 8 sin empezar) se cerraron en los 7 bloques descritos al final del documento.
- Verificación: `tsc` (shared/api/web app + spec), `nest build` y `ng build --configuration
  production` sin errores; **708 tests de backend** y **1364 de frontend**, todos en verde.
- Lo que el plan daba por "no iniciado" (Fase D: Seguros, Comunidad, comisión por tramos) ya
  estaba **completo** antes de esta auditoría, incluido el carrito multi-vertical que el plan
  decía expresamente que no existía. El estado real solo se conoce mirando el código.
- El patrón dominante en lo que faltaba no era funcionalidad ausente sino **motor sin interfaz**
  (recurrencia de transporte, importar historial veterinario desde Excel): fue lo más rápido de
  cerrar, porque faltaba la mitad visible, no la difícil.
- COMI3 ("cuidadores a domicilio") contradecía una decisión previa —el vertical "Cuidadores" se
  había eliminado en TCK-8021—, así que **se consultó antes de ejecutarla**. Con la confirmación
  del cliente de que esa decisión ya no aplica, el vertical se construyó.

---

## Épica N — Ficha Inteligente del Perro (Pasaporte Digital)

| # | Historia (resumen) | Estado | Evidencia |
|---|---|---|---|
| N1 | Registrar perro (nombre, raza, nacimiento, peso, fotos, pelo, vacunas, alergias, medicación, miedos, sociabilidad) | ✅ | `apps/api/src/core/perros/perro.schema.ts` — los 20+ campos existen todos |
| N2 | Editar y eliminar perros del perfil | ✅ | `apps/web/src/app/features/perros/perros-lista.component.ts` + `perro-form.component.ts` |
| N3 | Elegir perro en el wizard de reserva | ✅ | `reserva-wizard.component.ts` — selector de perro paso 1, en los 6 verticales |
| N4 | Congelar snapshot del perro al crear la reserva | ✅ | `bookings.service.ts` + `perro-snapshot.util.ts`, antes de tomar el slot |
| N5 | Resumen legible por vertical para el comercio (ej. "miedo al secador") | ✅ | `resumenPerro()` en `comercio-reservas.component.ts`: etiquetas automáticas con alergias, miedos, medicación y conductas, desde el `perroSnapshot`, visibles en cada fila sin abrir nada |
| N6 | Comercio anota valoración/nota tras el servicio | ✅ | `perro_valoraciones` (colección nueva) + `PerroValoracionesService.crear()` |
| N7 | Historial acumulado por vertical en la ficha | ✅ | `perros-lista.component.ts` muestra las últimas 3 entradas con `{{ h.vertical }} · {{ h.nota }}` — lista plana etiquetada por vertical, no en pestañas separadas |
| N8 | Recalcular precio estimado con el historial real del perro | ✅ | `PerrosService.estimarPrecioConHistorial()` + `GET /perros/:id/estimacion-precio`; banner informativo en el paso 2 del wizard. No altera el importe cobrado |
| N9 | Elegir con qué verticales se comparte el historial sensible (RGPD) | ✅ | `perro-privacidad.component.ts` (HU-016): matriz tipo de historial × vertical, consentimientos granulares con revocación — **más completo que lo que documenta el plan** (que solo preveía un booleano) |
| N10 | Nivel Doogking (1-5) tras seguimiento de adiestramiento | ✅ | `PerroValoracionesService.crear()` actualiza `Perro.nivelDoogking` cuando la reserva valorada es de adiestramiento |

---

## Épica S — Precio estimado y ciclo de suplementos

| # | Historia (resumen) | Estado | Evidencia |
|---|---|---|---|
| S1 | Ver precio estimado (no cerrado) donde el coste depende del perro | ✅ | Aviso unificado en el paso 2 del wizard, idéntico en los 6 verticales, conviviendo con los avisos específicos de cada uno |
| S2 | Checkbox explícito "confirmo que la info de mi mascota es correcta" antes de pagar | ✅ | Checkbox `confirmaDatosMascota` con `Validators.requiredTrue` en `paso2Form`, junto al de términos |
| S3 | Comercio configura catálogo de suplementos con motivo y precio | ✅ | `apps/api/src/core/suplementos/` + `comercio-suplementos.component.ts` |
| S4 | Comercio selecciona suplementos y ve el total recalculado | ✅ | Panel expandible en `comercio-reservas.component.ts` |
| S5 | Adjuntar foto de evidencia al solicitar el ajuste | ✅ | `rs-image-upload` en el mismo panel |
| S6 | Cliente recibe notificación del ajuste y acepta/rechaza con un botón | ✅ | `notifications.service.ts::notificarAjusteSolicitado` — **email proactivo real**, no solo el banner in-app que el plan daba como pendiente |
| S7 | Cobro automático de la diferencia al aceptar | ✅ | `PaymentsService.aceptarAjuste` — 2º PaymentIntent |
| S8 | Reembolso + cancelación automática al rechazar | ✅ | `PaymentsService.rechazarAjuste` |
| S9 | Comisión recalculada sobre el monto final ajustado | ✅ | `BookingsService.confirmarAjuste` |
| S10 | Ver en el detalle de la reserva el desglose de suplementos con motivo y evidencia | ✅ | Tarjeta "Cargos adicionales aplicados" en `reserva-detalle.component.ts`: concepto, importe, motivo y foto, de forma permanente |
| S11 | Admin ve en el reporte financiero cuántas reservas tuvieron ajuste y su impacto | ✅ | `AdminService.generarReporteAjustes()` + sección "Ajustes de precio por comercio" en `admin-reportes.component.ts` (nº, % e importe por comercio, resaltando ≥30%) |

---

## Épica CP — Compatibilidad y recomendación por perfil

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| CP1 | Buscador filtra por compatibilidad con mi perro | ✅ | `CatalogRepository.construirFiltro` + selector "solo apto para [mi perro]" en listados |
| CP2 | Comercio define perfiles de perro aptos por servicio | ✅ | `Servicio.aptitud` + `AptitudPerroDto`, sección en `comercio-listado-form.component.ts` |
| CP3 | Recomendación automática de servicio según motivo de consulta | ✅ | `apps/api/src/core/recomendador/recomendador.service.ts` |
| CP4 | Bloquear clases grupales cuando el motivo es de riesgo | ✅ | `bloqueaGrupales` deshabilita "Programa completo" en el wizard (`reserva-wizard.component.ts:537`) |

---

## Épica R — Reputación bidireccional

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| R1 | Comercio valora al perro/cliente tras el servicio | ✅ | `perro_valoraciones`, botón "★ Valorar perro" en `comercio-reservas.component.ts` |
| R2 | Cliente ve el índice de comportamiento acumulado del perro | ✅ | `PerroValoracionesService.indiceComportamiento` + badge en `perros-lista.component.ts` |

---

## Épica PEL — Peluquería canina

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| PEL1 | Precio y duración por tamaño de perro | ✅ | `peluqueria.schema.ts::preciosPorTamano` |
| PEL2 | Bloquear tipos de pelo incompatibles | ✅ | `PeluqueriaAvailabilityStrategy.validarCompatibilidadPelo` → 409 |
| PEL3 | Suplementos automáticos por estado del manto | ✅ | `estadoManto` + suplementos configurables |
| PEL4 | Política ante temperamento difícil | ✅ | `politicaTemperamentoDificil` |
| PEL5 | Cliente solo confirma vacunas/microchip al día, sin subir documento | ✅ | Checkboxes `requiereVacunasAlDia`/`requiereMicrochip` en el wizard |

---

## Épica RES — Residencias caninas

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| RES1 | Activar solo los tipos de alojamiento que ofrezco | ✅ | Modelo "solo creas los espacios que tienes" — 5 `TipoEspacio` disponibles, sin lista fija que activar/desactivar |
| RES2 | Decidir si el tamaño del perro es un criterio relevante | ✅ | `tamanoMaxPerro` es opcional; sin él no hay restricción |
| RES3 | Requisitos sanitarios opcionales de exigir, no bloqueantes | ✅ | `requisitoMicrochip`, `requiereDesparasitacion*`, informativos, no bloquean |
| RES4 | Suplementos por día de cuidados especiales | ✅ | `serviciosAdicionales` (residencia) |
| RES5 | Marcar conductas no admitidas (agresividad, escapista…) para rechazar reservas de riesgo | ✅ | `Alojamiento.conductasNoAdmitidas[]` + `AlojamientoAvailabilityStrategy.validarConductaRiesgo()` (409). Campo nuevo `Perro.tendenciaEscapar` y conductas propagadas al snapshot |

---

## Épica ADI — Adiestramiento canino

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| ADI1 | Elegir servicios de un catálogo con checkboxes | ✅ | `adiestramiento.schema.ts::serviciosAdiestramiento` |
| ADI2 | Cuestionario de comportamiento estructurado al reservar valoración | ✅ | Campos `historialPrevio` y `vinculoPropietario` en el paso 1 del wizard, visibles para el centro en el detalle de la reserva |
| ADI3 | Subir vídeos opcionales del comportamiento | ✅ | `POST /upload/video` (MP4/WebM/MOV, máx 50 MB) + subida en el wizard → `detalle.videosUrl[]`, enlazados en el panel del comercio |
| ADI4 | Proponer plan personalizado (bono/curso) tras la valoración | ✅ | El centro compone el plan (nombre, sesiones, precio) y viaja por el ciclo de aprobación y cobro ya probado (S3-S9). **Matiz:** solo proponible mientras la reserva sigue `confirmada` |
| ADI5 | Registrar objetivos, evolución y tareas tras cada sesión | ✅ | Panel "Registrar seguimiento de la sesión" con campos propios de objetivos, evolución y tareas para casa → `PerroHistorial.datosEstructurados` |

---

## Épica TRA — Transporte de animales

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| TRA1 | Marcar campos del formulario como obligatorios u opcionales | ✅ | Leyenda de obligatorios y etiquetas "(opcional)" en toda la sección de transporte del formulario de listado |
| TRA2 | Indicar comportamiento en desplazamientos (marea, ladra, ansiedad, transportín) | ✅ | Cubierto por el resumen automático de N5: "Se marea en viajes" y "Requiere transportín" salen como etiqueta en la propia fila de la reserva |
| TRA3 | Programar transporte recurrente (ej. L y X a las 09:00) | ✅ | Control de recurrencia en el paso 1 del wizard (días, hora, fecha fin) conectado al motor `calcularOcurrenciasRecurrentes` que ya existía |
| TRA4 | Trayecto de ida y vuelta con espera, como un único servicio | ✅ | `tipoTrayecto: 'ida_vuelta'` + `esperaMinutos`; cobra (base + km)×2 + `tarifaEsperaPorHora`×horas, configurable por transportista (0 = no cobra espera) |
| TRA5 | Cancelar y reembolsar automáticamente si se rechaza el ajuste | ✅ | Regla genérica (S8) aplica a transporte — solo veterinaria está explícitamente excluida |

---

## Épica VET — Servicio veterinario

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| VET1 | Marcar cada servicio como precio cerrado u orientativo | ✅ | `ServicioClinico.esPrecioCerrado` |
| VET2 | Cliente entiende que solo cubre la consulta inicial | ✅ | Mensaje explícito en el wizard (`reserva-wizard.component.ts:412`) |
| VET3 | Comisionar solo sobre la consulta inicial | ✅ | `solicitarAjuste` lanza excepción si `vertical === VETERINARIA` |
| VET4 | Recomendación de triaje automático | ✅ | `RecomendadorService.recomendarVeterinaria` |
| VET5 | Volcar vacunas/medicación/historial (con autorización), incluyendo pegar Excel | ✅ | Pantalla de importación en el panel "Historia veterinaria": pegar tabla/Excel → previsualizar → revisar → guardar, sobre los endpoints que ya existían |
| VET6 | Atender especies distintas al perro | ✅ | `Veterinaria.especiesAtendidas` + bloqueo 409 si no coincide |

---

## Épica HOT — Hotel / alojamiento pet-friendly

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| HOT1 | Configurar política de mascotas (nº, tamaño, razas, especies) | ✅ | `hoteles.schema.ts` |
| HOT2 | Suplementos por tamaño y mascota adicional | ✅ | `suplementoPorTamanoMascota` + `suplementoSegundaMascotaPorNoche` |
| HOT3 | Reservar habitación para personas, condicionada a la mascota | ✅ | Vertical propio `hoteles`, discriminador independiente de `alojamiento` |
| HOT4 | Solicitar ajuste si el nº/tamaño de mascotas no coincide al llegar | ✅ | Ciclo genérico de suplementos (S3-S9), hoteles no está excluido |
| HOT5 | Reservar paquete "Vacaciones completas" (hotel+guardería+peluquería+transporte) en un carrito | ✅ | **Contradice al plan** (que lo daba explícitamente por no implementado): `apps/api/src/core/carrito/` — carrito multi-vertical real (HU-033), cada item se convierte en su propia reserva al hacer checkout |
| HOT6 | Valorar comportamiento del perro tras la estancia | ✅ | Mecanismo genérico `perro_valoraciones` (B2), aplica a cualquier vertical incluido hoteles |

---

## Épica SEG — Vertical Seguros

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| SEG1 | Configurar tipos de póliza con límites, carencias, franquicias | ✅ | **Contradice al plan** (Fase D "no iniciada"): `apps/api/src/verticals/seguros/` completo. `TipoSeguro` con las 10 coberturas exactas del documento (RC, gastos vet, asistencia, robo/pérdida, fallecimiento, defensa jurídica, viaje, PPP, vida) |
| SEG2 | Contratar usando los datos ya existentes de la Ficha del Perro | ✅ | `Poliza.perroId` + `perroSnapshot` |
| SEG3 | Recomendar seguro y calcular Índice de Bienestar Doogking con descuento | ✅ | `BienestarService.calcular()` + `seguros.service.ts` aplica `descuentoBienestarPct` a la prima |
| SEG4 | Contratar seguro temporal (vacaciones, evento) sin permanencia anual | ✅ | `duracionMeses` configurable por producto (el comercio publica pólizas de la duración que quiera, no solo anuales) |

---

## Épica COM — Módulo Comunidad "Explora con tu mascota"

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| COM1 | Explorar mapa de lugares pet-friendly con fichas ricas | ✅ | **Contradice al plan**: `apps/api/src/core/lugares/lugar.schema.ts` + `explora-lista.component.ts` |
| COM2 | Subir fotos, valorar y reportar incidencias en lugares | ✅ | `lugares.service.ts` — reportar/moderación |
| COM3 | Guardar favoritos y recibir recomendaciones personalizadas | ✅ | `favoritos.component.ts` — sección "Recomendados para ti" |

---

## Épica COMI — Modelo de comisiones

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| COMI1 | Comisión por tramo de importe | ✅ | `comision-config.schema.ts::TramoComision` + `ComisionResolverService` |
| COMI2 | Marcar comercio "Socio Fundador" con comisión congelada 24 meses | ✅ | Campo y lógica en `comercio.schema.ts` / `comercios.service.ts` |
| COMI3 | Dar de alta verticales "paseadores" y "cuidadores a domicilio" | ✅ | Vertical `cuidadores` — "Paseadores y cuidado a domicilio" (paseo/visita/día completo/noche), alta autogestionada por el comercio y reserva desde el wizard. Mantiene la verificación de profesionales: exige alta de comercio y aprobación del admin |

---

## Cómo se cerró el backlog (7 bloques)

El backlog que detectó esta auditoría —17 historias— se agrupó en 7 bloques por esfuerzo, riesgo
y valor, y se ejecutó entero. Detalle técnico por bloque en
`docs/PLAN-INFORME-GERENCIAL-MEJORA-SERVICIOS.md`.

| Bloque | Contenido | Historias | Estado |
|---|---|---|---|
| 1 | Aprovechar lo ya construido por dentro (motor sin interfaz) | TRA3, VET5 | ✅ |
| 2 | Confianza del cliente antes de pagar | S1, S2, S10, N5 | ✅ |
| 3 | Seguridad: bloqueo de reservas de riesgo en residencias | RES5 | ✅ |
| 4 | Cierre del vertical Transporte | TRA1, TRA2, TRA4 | ✅ |
| 5 | Adiestramiento avanzado | ADI2, ADI3, ADI4, ADI5 | ✅ |
| 6 | Analítica e inteligencia de precio | S11, N8 | ✅ |
| 7 | Paseadores y cuidado a domicilio (vertical nuevo) | COMI3 | ✅ |

**Decisiones tomadas por criterio técnico, pendientes de validar con negocio.** Ninguna bloquea
la operación: las tres funcionan hoy con un valor por defecto razonable.

- **TRA4** — el tiempo de espera en los trayectos de ida y vuelta se cobra con una tarifa por hora
  que configura cada transportista (0 por defecto), en vez de una fórmula fija impuesta. El
  informe pedía acordarla antes con negocio y se optó por no bloquear la entrega.
- **ADI4** — el bono/plan de adiestramiento reutiliza el ciclo de ajuste ya probado en lugar de un
  circuito de pago nuevo. Reduce el riesgo sobre el webhook de Stripe, a cambio de que el plan
  solo pueda proponerse mientras la reserva sigue `confirmada`, no una vez `completada`. Si el
  negocio necesita lo segundo, es relajar una validación en `BookingsService.solicitarAjuste`.
- **COMI3** — el motivo original de retirar "Cuidadores" (TCK-8021) fue que Doogking lista
  profesionales verificados y no particulares por libre. El vertical reintroducido mantiene esa
  condición porque publicar exige alta de comercio + aprobación del admin, igual que el resto.
  Conviene confirmar que esa equivalencia le vale al cliente.

## Nota metodológica

Esta auditoría no sustituye a `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md` como registro
histórico de decisiones de modelado (sigue siendo la referencia para el "por qué" de cada
elección). Sí lo sustituye como **fuente de verdad del estado actual**: ese plan quedó congelado
el 2026-07-18 y varias fases avanzaron después sin que se volviera a actualizar.

La lección se aplica también a este documento: se mantuvo al día al cerrar el programa en vez de
dejar que volviera a divergir. Si se retoma esta línea de trabajo, partir de aquí —y de
`docs/PLAN-INFORME-GERENCIAL-MEJORA-SERVICIOS.md` para el detalle de la ejecución—, no del plan
antiguo.
