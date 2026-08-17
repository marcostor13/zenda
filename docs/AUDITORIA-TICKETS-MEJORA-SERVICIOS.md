# Auditoría de tickets — Mejora de servicios

> **Fuente de los tickets:** `docs/HISTORIAS-USUARIO-MEJORA-SERVICIOS.md` (69 historias, 13 épicas).
> **Método:** cada historia se verificó **contra el código real** (schemas, servicios, componentes,
> tests), no contra `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`. Ese plan está fechado el
> 2026-07-18 y quedó desactualizado: varias épicas que marca como "no iniciadas" (Seguros,
> Comunidad, el carrito multi-vertical de Hotel) ya están completas en el código, construidas en
> sesiones posteriores. Se señala cada caso donde el código contradice al plan.
> **Fecha de esta auditoría:** 2026-08-17.

## Resumen ejecutivo

| Épica | Historias | ✅ Hecho | 🟡 Parcial | ❌ Falta |
|---|---|---|---|---|
| N — Ficha Inteligente del Perro | 10 | 8 | 0 | 2 |
| S — Precio estimado y suplementos | 11 | 7 | 2 | 2 |
| CP — Compatibilidad y recomendación | 4 | 4 | 0 | 0 |
| R — Reputación bidireccional | 2 | 2 | 0 | 0 |
| PEL — Peluquería | 5 | 5 | 0 | 0 |
| RES — Residencias | 5 | 4 | 0 | 1 |
| ADI — Adiestramiento | 5 | 1 | 3 | 1 |
| TRA — Transporte | 5 | 1 | 3 | 1 |
| VET — Veterinaria | 6 | 5 | 1 | 0 |
| HOT — Hotel pet-friendly | 6 | 6 | 0 | 0 |
| SEG — Seguros | 4 | 4 | 0 | 0 |
| COM — Comunidad | 3 | 3 | 0 | 0 |
| COMI — Comisiones | 3 | 2 | 0 | 1 |
| **Total** | **69** | **52 (75%)** | **9 (13%)** | **8 (12%)** |

**Lectura rápida:**
- Los cimientos (Fase A/B del plan: Ficha del Perro, ciclo de suplementos, compatibilidad,
  reputación) y los 6 verticales enriquecidos (peluquería, residencia, hotel, adiestramiento,
  veterinaria, más transporte a medio construir) están **sólidos**.
- Lo que el plan daba por "no iniciado" (Fase D: Seguros, Comunidad, comisión por tramos) está
  **completo**, incluido el carrito multi-vertical que el plan decía expresamente que no existía.
- El patrón que más se repite en lo pendiente: **el backend existe pero no hay interfaz** para
  usarlo (recurrencia de transporte, importar historial veterinario desde Excel) — trabajo
  "a medias" en el sentido de que falta la mitad visible, no la mitad difícil.
- Una historia (COMI3, altar "cuidadores a domicilio") no solo está sin hacer: el vertical
  equivalente más cercano ("Cuidadores") fue **eliminado explícitamente** por decisión del
  cliente en otra ronda de tickets (TCK-8021). No es deuda pendiente, es una historia que el
  negocio ya descartó.

---

## Épica N — Ficha Inteligente del Perro (Pasaporte Digital)

| # | Historia (resumen) | Estado | Evidencia |
|---|---|---|---|
| N1 | Registrar perro (nombre, raza, nacimiento, peso, fotos, pelo, vacunas, alergias, medicación, miedos, sociabilidad) | ✅ | `apps/api/src/core/perros/perro.schema.ts` — los 20+ campos existen todos |
| N2 | Editar y eliminar perros del perfil | ✅ | `apps/web/src/app/features/perros/perros-lista.component.ts` + `perro-form.component.ts` |
| N3 | Elegir perro en el wizard de reserva | ✅ | `reserva-wizard.component.ts` — selector de perro paso 1, en los 6 verticales |
| N4 | Congelar snapshot del perro al crear la reserva | ✅ | `bookings.service.ts` + `perro-snapshot.util.ts`, antes de tomar el slot |
| N5 | Resumen legible por vertical para el comercio (ej. "miedo al secador") | ❌ | No existe generación de resumen; el comercio no ve un extracto curado del perfil salvo en la Historia Veterinaria (VET5) |
| N6 | Comercio anota valoración/nota tras el servicio | ✅ | `perro_valoraciones` (colección nueva) + `PerroValoracionesService.crear()` |
| N7 | Historial acumulado por vertical en la ficha | ✅ | `perros-lista.component.ts` muestra las últimas 3 entradas con `{{ h.vertical }} · {{ h.nota }}` — lista plana etiquetada por vertical, no en pestañas separadas |
| N8 | Recalcular precio estimado con el historial real del perro | ❌ | Sin rastro en `bookings.service.ts` ni `catalog.service.ts` |
| N9 | Elegir con qué verticales se comparte el historial sensible (RGPD) | ✅ | `perro-privacidad.component.ts` (HU-016): matriz tipo de historial × vertical, consentimientos granulares con revocación — **más completo que lo que documenta el plan** (que solo preveía un booleano) |
| N10 | Nivel Doogking (1-5) tras seguimiento de adiestramiento | ✅ | `PerroValoracionesService.crear()` actualiza `Perro.nivelDoogking` cuando la reserva valorada es de adiestramiento |

---

## Épica S — Precio estimado y ciclo de suplementos

| # | Historia (resumen) | Estado | Evidencia |
|---|---|---|---|
| S1 | Ver precio estimado (no cerrado) donde el coste depende del perro | 🟡 | Avisos repartidos por vertical ("nudos importantes", "precio orientativo… se factura aparte"), no un mensaje centralizado de "esto es una estimación" |
| S2 | Checkbox explícito "confirmo que la info de mi mascota es correcta" antes de pagar | ❌ | El wizard solo tiene un checkbox de Términos y condiciones (`reserva-wizard.component.ts:755`); no existe una declaración específica sobre la mascota |
| S3 | Comercio configura catálogo de suplementos con motivo y precio | ✅ | `apps/api/src/core/suplementos/` + `comercio-suplementos.component.ts` |
| S4 | Comercio selecciona suplementos y ve el total recalculado | ✅ | Panel expandible en `comercio-reservas.component.ts` |
| S5 | Adjuntar foto de evidencia al solicitar el ajuste | ✅ | `rs-image-upload` en el mismo panel |
| S6 | Cliente recibe notificación del ajuste y acepta/rechaza con un botón | ✅ | `notifications.service.ts::notificarAjusteSolicitado` — **email proactivo real**, no solo el banner in-app que el plan daba como pendiente |
| S7 | Cobro automático de la diferencia al aceptar | ✅ | `PaymentsService.aceptarAjuste` — 2º PaymentIntent |
| S8 | Reembolso + cancelación automática al rechazar | ✅ | `PaymentsService.rechazarAjuste` |
| S9 | Comisión recalculada sobre el monto final ajustado | ✅ | `BookingsService.confirmarAjuste` |
| S10 | Ver en el detalle de la reserva el desglose de suplementos con motivo y evidencia | 🟡 | El motivo se ve mientras el ajuste está *pendiente* (`mis-reservas.component.ts`); no hay un desglose permanente en `reserva-detalle.component.ts` una vez resuelto |
| S11 | Admin ve en el reporte financiero cuántas reservas tuvieron ajuste y su impacto | ❌ | Sin rastro en `admin.service.ts` ni en el reporte financiero |

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
| RES5 | Marcar conductas no admitidas (agresividad, escapista…) para rechazar reservas de riesgo | ❌ | `compatibilidadSocialAdmitida` cubre tamaño/sexo, no conducta de riesgo; `alojamiento-availability.strategy.ts` no valida `protectorRecursos`/`ansiedadSeparacion` del perro |

---

## Épica ADI — Adiestramiento canino

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| ADI1 | Elegir servicios de un catálogo con checkboxes | ✅ | `adiestramiento.schema.ts::serviciosAdiestramiento` |
| ADI2 | Cuestionario de comportamiento estructurado al reservar valoración | 🟡 | No hay campos estructurados; se apoya en el campo libre de "peticiones especiales" (decisión de alcance documentada, no un olvido) |
| ADI3 | Subir vídeos opcionales del comportamiento | ❌ | Sin rastro en el wizard ni en el schema |
| ADI4 | Proponer plan personalizado (bono/curso) tras la valoración | 🟡 | No hay flujo propio; se aproxima con el ciclo de ajuste/suplemento genérico (S3-S9) |
| ADI5 | Registrar objetivos, evolución y tareas tras cada sesión | 🟡 | El mecanismo genérico de notas (`perro_historial`) existe y puede usarse, pero no hay campos estructurados de "objetivos/evolución/tareas" específicos de adiestramiento |

---

## Épica TRA — Transporte de animales

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| TRA1 | Marcar campos del formulario como obligatorios u opcionales | 🟡 | Los campos existen (`transporte.schema.ts`) pero sin una etiqueta explícita obligatorio/opcional visible al comercio |
| TRA2 | Indicar comportamiento en desplazamientos (marea, ladra, ansiedad, transportín) | 🟡 | Los campos viven en `Perro` (`seMarea`, `requiereTransportin`, `toleraTrayectosLargos`) y viajan en el snapshot de la reserva, pero no hay un panel dedicado que se lo muestre claramente al transportista (a diferencia de la Historia Veterinaria) |
| TRA3 | Programar transporte recurrente (ej. L y X a las 09:00) | 🟡 | Motor completo en el backend (`bookings.service.ts::calcularOcurrenciasRecurrentes`, `RecurrenciaParams` en el DTO), **sin ninguna UI**: no hay ningún control de recurrencia en `reserva-wizard.component.ts` |
| TRA4 | Trayecto de ida y vuelta con espera, como un único servicio | ❌ | Sin rastro de "ida_vuelta" ni "espera" en schema, DTOs o wizard |
| TRA5 | Cancelar y reembolsar automáticamente si se rechaza el ajuste | ✅ | Regla genérica (S8) aplica a transporte — solo veterinaria está explícitamente excluida |

---

## Épica VET — Servicio veterinario

| # | Historia | Estado | Evidencia |
|---|---|---|---|
| VET1 | Marcar cada servicio como precio cerrado u orientativo | ✅ | `ServicioClinico.esPrecioCerrado` |
| VET2 | Cliente entiende que solo cubre la consulta inicial | ✅ | Mensaje explícito en el wizard (`reserva-wizard.component.ts:412`) |
| VET3 | Comisionar solo sobre la consulta inicial | ✅ | `solicitarAjuste` lanza excepción si `vertical === VETERINARIA` |
| VET4 | Recomendación de triaje automático | ✅ | `RecomendadorService.recomendarVeterinaria` |
| VET5 | Volcar vacunas/medicación/historial (con autorización), incluyendo pegar Excel | 🟡 | Historia Veterinaria Compartida (`GET /perros/:id/historia-veterinaria`) ✅ completa; el endpoint de importar/previsualizar CSV-Excel (`POST /perros/:id/historial/previsualizar` + `importarHistorial`) existe **solo en el backend**, sin ningún componente frontend que lo use |
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
| COMI3 | Dar de alta verticales "paseadores" y "cuidadores a domicilio" | ❌ | No existen en `VerticalKey`. Más relevante aún: el vertical más próximo, **"Cuidadores", fue dado de baja explícitamente** por decisión del cliente (TCK-8021, "Cuidadores no es un servicio que queramos incorporar. Esa parte elimínala") — esta historia no es deuda técnica, es una decisión de negocio que va en sentido contrario |

---

## Backlog de lo pendiente, priorizado

**Falta real (❌), por prioridad del documento original:**
- P0: ninguna — todos los ❌ son P1/P2.
- P1: S2 (checkbox de veracidad del perro), S11 (reporte admin de ajustes), RES5 (bloqueo por conducta de riesgo), ADI3 (vídeos), TRA4 (ida+vuelta+espera), N5 (resumen por vertical), N8 (precio por historial).
- P2: COMI3 (descartada por el cliente, no priorizar).

**Backend listo, falta solo la interfaz (🟡 "fruta a media altura"):**
- TRA3 — recurrencia de transporte: el motor ya existe, falta el control en el wizard.
- VET5 (parte Excel) — importar historial: falta el textarea/preview en el frontend.
- S10 — desglose permanente de suplementos en el detalle de la reserva.

**Decisiones de alcance ya documentadas, no bugs (🟡 con nota):**
- ADI2, ADI4, ADI5 — el plan de implementación ya explicó por qué se aproximaron con mecanismos genéricos en vez de campos dedicados.

## Nota metodológica

Esta auditoría no sustituye a `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md` como registro
histórico de decisiones de modelado (sigue siendo la referencia para el "por qué" de cada
elección). Sí lo sustituye como **fuente de verdad del estado actual**: ese plan quedó congelado
el 2026-07-18 y varias fases avanzaron después sin que se volviera a actualizar. Recomendación:
al retomar esta línea de trabajo, partir de esta auditoría, no del plan.
