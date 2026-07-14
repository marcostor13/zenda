# Análisis de especificaciones — Doogking

> Análisis cruzado entre **el estado real del código** (`apps/api`, `apps/web`, `libs/shared`) y el **documento de especificaciones funcionales** aportado por el cliente (49 páginas: peluquería, residencias, adiestramiento, transporte, veterinaria, hotel pet-friendly, seguros, comunidad y modelo de comisiones).
>
> **Fecha:** 2026-07-14 · **Rama:** `claude/platform-specs-analysis-nfxypl` · **Mercado del documento:** Europa / España (EUR, kg, PPP, pasaporte europeo)

---

## 0. Resumen ejecutivo

El documento del cliente **no describe funcionalidades sueltas**: describe una vuelta de tuerca sobre el modelo de negocio. Doogking deja de ser "un Booking de servicios caninos" (reservar un slot y pagar) y pasa a girar alrededor de **un objeto central que hoy no existe en el código: el perro**.

Casi todas las funcionalidades nuevas del documento son, en el fondo, **la misma entidad `Perro` (Ficha Inteligente / Pasaporte Digital) vista desde cada vertical**:

- La **peluquería** filtra servicios según el pelo/tamaño/carácter del perro y guarda su comportamiento en la silla.
- La **residencia** aloja según compatibilidad social y guarda su adaptación.
- El **adiestramiento** recomienda según el motivo de conducta y guarda su "Nivel Doogking".
- El **transporte** prepara el viaje según cómo tolera el coche.
- El **veterinario** vuelca la historia clínica compartida.
- El **seguro** calcula la prima según edad/raza/historial y premia el "Índice de Bienestar".

Y una segunda idea transversal igual de importante: **el precio deja de ser fijo**. En 6 de los 7 verticales el documento pide un flujo **precio estimado → validación en recepción → solicitud de suplemento → aprobación del cliente → reembolso si rechaza**, con evidencia fotográfica para disputas.

Ninguna de estas dos ideas está hoy en el código. Son el corazón del trabajo.

### Veredicto rápido

| Bloque del documento | ¿Existe en el código hoy? | Esfuerzo |
|---|---|---|
| Los 5 verticales base (schemas, reservas, pago Stripe) | ✅ Sí, discriminadores + core operativo | — |
| **Ficha Inteligente del Perro** (entidad `Perro`) | ❌ No existe | Alto — fundacional |
| **Precio estimado + suplementos + aprobación** | ❌ No existe (reserva tiene precio cerrado) | Alto — transversal |
| **Filtrado de compatibilidad** por perfil del perro | ❌ No existe | Medio |
| **Reputación bidireccional + valoración del perro** | 🟡 `reviews` existe, solo cliente→comercio | Medio |
| **Evidencias fotográficas** anti-disputa | 🟡 hay `upload` a S3, sin vincular a reserva | Bajo-Medio |
| **Recomendador de servicio** (reglas por motivo/gravedad) | ❌ No existe | Medio |
| **Vertical Seguros** | ❌ No existe (nuevo vertical) | Alto |
| **Módulo Comunidad / "Explora con tu mascota"** | ❌ No existe (nuevo módulo, mapa/UGC) | Alto |
| **Modelo de comisiones por tramos + Socios Fundadores** | 🟡 `comision-configs` existe por vertical; falta por tramo | Bajo |

---

## 1. Estado real del código (base sobre la que se construye)

Auditoría de `apps/api/src`, `apps/web/src/app` y `libs/shared/src` a fecha de este análisis.

### 1.1 Backend (NestJS) — más maduro de lo que sugería `SCOPE.md`

**Core (`apps/api/src/core`):**

| Módulo | Estado | Observación relevante para el documento |
|---|---|---|
| `auth` | ✅ | JWT + roles (`cliente`, `comercio_admin`, `comercio_staff`, `admin`). |
| `users` | ✅ | `GET/PATCH /users/me`. **No cuelga ningún perro del usuario todavía.** |
| `comercios` | ✅ | Onboarding, estado, mis-servicios, mis-reservas, mis-reseñas. |
| `catalog` | ✅ | `Servicio` base discriminado + búsqueda con filtros. |
| `availability` | ✅ | Registry + `AvailabilityStrategy` por vertical, auto-registro. |
| `bookings` | ✅ | `crear/confirmar/cancelar` con `SlotHold`. Reserva con **precio cerrado**. |
| `payments` | ✅ | Stripe `PaymentIntent` + webhook idempotente; comisión + IVA + fee. |
| `comision-configs` | ✅ | Cascada `override comercio → vertical → global`. |
| `cupones` | ✅ | Validación + descuento por vertical. |
| `reviews` | ✅ | Reseña `cliente → comercio` + respuesta del comercio. **Unidireccional.** |
| `notifications` | ✅ | Outbox + `mailer`. Base lista para los avisos de suplemento. |
| `upload` | ✅ | Imágenes a S3 (base para evidencias fotográficas). |
| `ai-search` | ✅ | Búsqueda en lenguaje natural → parámetros. |
| `admin` | ✅ | Dashboard, comisiones, CRUD, reporte financiero. |

**Verticales (`apps/api/src/verticals`) — los 5 caninos existen como discriminadores:**

`alojamiento` · `transporte` · `veterinaria` · `peluqueria` · `adiestramiento`

Ejemplo del schema actual de **peluquería** (`peluqueria.schema.ts`):

```ts
serviciosGrooming: { nombre, precio, duracionMin, tamanoPerro }[]
duracionSlotMin, capacidadSimultanea, cuposDisponibles, aDomicilio, horario
```

> El schema modela **qué vende la peluquería**, pero no **para qué perro es apto** (tipo de pelo, estado del manto, temperamento) ni los **suplementos configurables** que pide el documento. Lo mismo aplica a los otros 4 verticales.

### 1.2 Schema de `Reserva` — el cuello de botella del precio dinámico

```ts
// core/bookings/reserva.schema.ts (actual)
detalle, fechaInicio, fechaFin, cantidad,
montoSubtotal, comisionMonto, montoTotal,   // ← todos cerrados al crear
descuentoMonto, cuponCodigo, estado, pagoId, holdId
```

No hay: `precioEstimado`, `suplementos[]`, `estadoAjuste`, `montoAjustado`, `perroId`, `evidencias[]`. **Todo el flujo de suplementos del documento vive aquí y hoy no cabe.**

### 1.3 Frontend (Angular)

Features presentes: `alojamiento`, `transporte`, `verticales` (browse genérico), `buscador`, `reservas`, `perfil-usuario`, `panel-comercio`, `panel-admin`, `auth`, `home`. No hay pantalla de "mis perros", ni wizard de compatibilidad, ni panel de suplementos para el comercio.

### 1.4 Conclusión de la base

El **motor de reservas/pago/comisiones está sano** y el patrón de extensibilidad (discriminador + strategy) es exactamente el que necesitamos. Lo que el documento pide **no rompe ese core**: se añade como (a) una entidad transversal nueva (`Perro`), (b) una extensión del ciclo de vida de la reserva (suplementos), (c) enriquecimiento de cada schema de vertical, y (d) dos módulos nuevos (Seguros, Comunidad).

---

## 2. Los dos conceptos transversales que redefinen el producto

### 2.1 Ficha Inteligente del Perro / Pasaporte Digital 🐶 *(el diferenciador central)*

El documento lo repite en cada vertical y lo nombra explícitamente como "lo que ninguna plataforma internacional ofrece de forma completa". La idea: **el cliente registra a su perro una sola vez** y cada comercio adapta automáticamente su servicio.

**Nueva colección propuesta: `perros`**

```
_id, propietarioId (Usuario), nombre, foto[],
// identidad
raza, esMestizo, fechaNacimiento, sexo, esterilizado, peso, microchip, fechaImplantacion,
// físico (peluquería/grooming)
tipoPelo: ['corto'|'medio'|'largo'|'rizado'|'duro'|'doble_capa'],
tamano: 'mini'|'pequeno'|'mediano'|'grande'|'gigante',   // derivable del peso
estadoManto, esPPP,
// salud (veterinaria/seguros/residencia)
vacunas[], alergias[], enfermedades[], medicacion[], dieta,
// comportamiento (todos)
sociabilidadPerros, sociabilidadPersonas, puedeQuedarseSolo, ansiedadSeparacion,
miedos[] (ej. secador, coche), temperamento, reactividadCorrea, protectorRecursos,
// viaje (transporte)
toleraTrayectos, seMarea, requiereTransportin, paradaCada,
// documentación
cartillaSanitariaUrl, pasaporteEuropeoUrl, certificadosUrl[],
createdAt, updatedAt
```

**Historiales acumulados por vertical (sub-documentos o colección `perro_historial`):** el documento pide que **el profesional escriba tras cada servicio** y que ese histórico se reutilice:

- **Peluquería** → "Luna: siempre requiere deslanado intensivo, 2 profesionales, ~90 min" → precalcula el precio la próxima vez.
- **Residencia** → "mejor en habitación individual, medicación 2×/día, excelente con personas".
- **Adiestramiento** → objetivos trabajados, evolución, tareas para casa, **"Nivel Doogking" (1 Cachorro → 5 Excelente sociabilidad)**.
- **Transporte** → "Perfil de Viaje": se marea, necesita parada cada 2 h.
- **Veterinaria** → **Historia Veterinaria Compartida** (vacunas, cirugías, analíticas, informes; volcado por el vet con autorización del propietario; opción "pegar Excel/documento").
- **Alojamiento (hotel)** → índice de comportamiento (limpieza, ruido, respeto del mobiliario).

> **Regla de privacidad (del documento):** la historia clínica/comportamental se comparte **siempre con autorización del propietario**. Modelar consentimiento por tipo de historial.

**Impacto en el core:** `Reserva.detalle` ya es un `Record<string, unknown>`; añadir `Reserva.perroId` y **snapshot del perro** en el momento de la reserva (el precio se estimó con esos datos; hay que congelarlos para la disputa).

### 2.2 Precio estimado + suplementos con aprobación 💶 *(cambia el ciclo de vida de la reserva)*

Presente en **peluquería, residencia, transporte, hotel** (idéntico patrón) y en versión especial en **veterinaria**. Flujo canónico del documento:

```
1. Cliente reserva → ve PRECIO ESTIMADO (calculado con los datos del perro)
2. Antes de pagar acepta el aviso legal:
   "☑ Confirmo que la información es correcta.
    ⚠ El precio podrá ajustarse si en recepción se detectan circunstancias no indicadas."
3. Paga el estimado (SlotHold + PaymentIntent como hoy)
4. EN RECEPCIÓN el profesional detecta algo (nudos severos, 2º perro, +peso, agresividad…)
   → selecciona suplementos PRECONFIGURADOS por su comercio
   → adjunta 📷 foto del estado del perro al llegar
5. El cliente recibe notificación con: precio inicial → nuevo precio → motivo
   → 🟢 Aceptar modificación   🔴 Cancelar servicio
6a. Acepta → se cobra la diferencia (2º PaymentIntent) → servicio confirmado
6b. Rechaza → "Doogking retorna el dinero al usuario y cancela el servicio"
```

**Puntos clave que impone el documento:**
- Los suplementos **los define cada comercio** (no genéricos): "Nudos severos +15 €", "Transporte exclusivo +20 €", "Alojamiento individual +X €/día", "2ª mascota +15 €/noche"…
- **"Ningún coste adicional sin aprobación previa del propietario"** — frase legal repetida; es requisito, no adorno.
- **Evidencia fotográfica obligatoria** protege a las 3 partes (profesional, cliente, Doogking).
- Tras varias reservas, Doogking **aprende** y ya estima el precio corregido ("Basándonos en servicios anteriores de Luna, 58 €").

**Nuevo estado de reserva y campos:**

```
ReservaEstado += 'ajuste_solicitado' | 'ajuste_aceptado' | 'ajuste_rechazado'
Reserva += {
  precioEstimado, esPrecioOrientativo (bool),   // "desde X€"
  suplementos: [{ concepto, monto, aplicadoPor, motivo, evidenciaUrl, createdAt }],
  montoAjustado, ajusteEstado, ajusteSolicitadoAt, ajusteResueltoAt,
  evidencias: [{ tipo:'estado_llegada'|'cartilla'|'video', url }]
}
```

**Nueva colección `suplemento_configs`** (por comercio/servicio): catálogo de suplementos configurables que el profesional elige con un click en recepción.

**Impacto en comisión (importante):** cuando el suplemento se cobra por la plataforma, la comisión se recalcula sobre el total final. **Excepción veterinaria** (ver §3.5): las pruebas/tratamientos extra se facturan **fuera de Doogking**; la plataforma solo comisiona la consulta inicial reservada.

---

## 3. Análisis vertical por vertical (documento → requisitos concretos)

Para cada vertical: lo que pide el documento, qué falta en el schema actual y el trabajo derivado.

### 3.1 Peluquería canina ✂️

**Config de la empresa (nuevo en schema):** nombre de servicio (baño básico/baño+corte/tijera/stripping/deslanado/higiénico/spa), **precio y duración por tamaño** (mini→gigante, cada uno con precio/tiempo propio), **tipo de pelo compatible** (bloquea servicios incompatibles: stripping solo pelo duro, deslanado solo doble capa), estado del manto con **suplementos automáticos**, **temperamento** (aceptar/cobrar suplemento/requerir valoración; agresivos con bozal obligatorio; derecho a anular), servicios adicionales (uñas, oídos, glándulas, perfume, antiparasitario, mascarilla, ozono, spa, champú antialérgico), requisitos (vacunas/microchip — **solo confirmación, no demostración**), horarios (días, duración cita, nº perros simultáneos, margen entre citas).

**Cliente:** selecciona su perro → raza, peso, edad, tipo de pelo, tamaño, carácter → **Doogking filtra automáticamente los servicios compatibles** (ej. Nala chihuahua 3 kg pelo corto → solo baño mini, higiénico, uñas, spa mini; nunca stripping ni deslanado de husky).

**Gap vs `peluqueria.schema.ts` actual:** falta matriz precio×tamaño, `tipoPeloCompatible`, `estadoManto`+suplementos, `politicaTemperamento`, servicios adicionales tipados, y **el motor de compatibilidad**. El `serviciosGrooming` actual es plano.

### 3.2 Residencias / Alojamiento canino 🏠

**Config residencia:** tipo de alojamiento (individual/compartida/**premium**/climatizada/suites — *y no todas lo tendrán*, marcado por click), tamaño admitido (con precio por tamaño), **compatibilidad social requerida** (solo pequeños/machos/hembras/individual), requisitos sanitarios **opcionales de exigir por la residencia** (microchip, vacunas, desparasitación, tos de perrera opcional — matiz del cliente: "en mi residencia el tamaño no importa"), conductas no admitidas (agresividad, ansiedad, escapista, destructor), servicios adicionales (medicación, dieta, paseos individuales, entrenamiento, peluquería de salida, recogida/entrega).

**Cliente:** datos + comportamiento + salud + alimentación (no obligatoria).

**Precio dinámico:** estancia estimada (5 noches × 22 € = 110 €) → en recepción detecta "no tolera machos, necesita individual" → 110 € → 150 € con motivo y foto → aceptar/cancelar. Suplementos configurables **€/día**.

**Diferencial:** valoración post-estancia del perro (sociabilidad, adaptación, energía, alojamiento recomendado) → "Historial Doogking" reutilizable = **pasaporte digital**.

**Gap:** el `alojamiento.schema.ts` modela espacios/noches pero no compatibilidad social, requisitos configurables ni suplementos €/día.

### 3.3 Hotel pet-friendly 🏨 *(¡es un vertical distinto de la residencia!)*

Matiz crítico del documento: aquí **el cliente reserva alojamiento para personas condicionado a la mascota** (compite con Booking/Airbnb, no con una residencia canina). Config: política de mascotas (nº máx, tamaño/peso, razas restringidas PPP, especies), **suplementos por mascota** (pequeña 10 €/noche…, 2ª mascota +5 €/noche, limpieza especial), servicios pet-friendly (camas, comederos, zona paseo, guardería, peluquería…), normas (puede quedarse solo, zonas comunes, correa/bozal).

**Tipos de reserva** — aquí aparece el **paquete multi-servicio "Vacaciones completas Doogking"**: Hotel + guardería diurna + peluquería + transporte al aeropuerto + actividades caninas, **todo desde una sola plataforma** → conecta con el carrito multi-vertical / Trips ya anticipado en `PLAN-CONTINUACION.md` (Épica N).

**Reputación bidireccional:** el alojamiento valora al perro y el propietario valora los servicios pet-friendly reales.

> **Decisión de modelado pendiente:** ¿"hotel pet-friendly" es un 6º discriminador separado de `alojamiento` (residencia canina), o un flag/subtipo dentro de `alojamiento`? El documento los trata como negocios distintos (alojar al perro vs. alojar a la persona con perro). **Recomendación: discriminador separado** para no meter `if` en el core.

### 3.4 Adiestramiento canino 🎓

**Config centro:** valoración inicial (presencial/online/domicilio), sesiones individuales, sesiones grupales (cachorros, obediencia, socialización, reactivos, deportivos), **cursos completos** (lista de ~23 técnicas — el cliente pide que **todo sea tipo click, no numerado**), servicios especiales (pre-adopción, llegada cachorro, convivencia bebés). Por servicio: precio, duración, nº máx perros, edad mín/máx, lugar, material.

**Cliente:** datos + nivel de experiencia + **motivo principal** (tirones, no acude, ansiedad, destrucción, ladridos, miedos, agresividad, niños, protección recursos…) + intensidad (leve/moderado/grave) + descripción libre + historial + **cuestionario** (edad de adquisición, tiempo con él, ¿estuvo con la madre 8 semanas?, salidas/día, vínculo 1-5) + **vídeos opcionales**.

**Recomendador automático (regla de negocio explícita):**
- Cachorro 4m + socialización → ✅ Curso de cachorros.
- Agresividad + se lanza a la correa → ✅ **valoración individual previa**, ❌ **bloquea clases grupales**.
- Tirones + sociable → ✅ obediencia / individual / grupal.

**Precios variables:** valoración inicial (45 €) → el profesional propone plan (bono, curso, programa mixto: "1 valoración + 6 individuales + 4 grupales = 420 €") → **el cliente acepta desde la plataforma**. Modelo en 4 niveles (valoración → plan → reserva de sesiones → seguimiento).

**Diferencial:** historial por sesión + **"Nivel Doogking" del perro**.

**Gap:** `adiestramiento.schema.ts` no tiene el catálogo de técnicas por click, el cuestionario, el motor de recomendación ni el objeto "plan personalizado / bono".

### 3.5 Servicio veterinario 🩺 *(el más delicado y el de reglas comerciales distintas)*

Principio del documento: **se reserva tiempo profesional, no un tratamiento cerrado** (salvo servicios muy concretos). Config: consultas (primera/revisión/2ª opinión/urgente), medicina preventiva (vacunación, desparasitación, microchip, certificados, pasaporte), diagnóstico (analítica, RX, eco, citología, hormonas), cirugía (esterilización, dental), telemedicina; duración y **precio orientativo**; horarios y nº de veterinarios; especies (perros, gatos, conejos, hurones, aves, exóticos → **Doogking no es solo perros en este vertical**).

**Cliente:** motivo + descripción + duración de síntomas + gravedad (leve→emergencia) + síntomas asociados + archivos (fotos/vídeos/informes).

**Triaje automático:** vacuna anual → reserva directa; vómitos+sangre+apatía → ⚠ **urgencias inmediatas** (contratando la urgencia por Doogking); cojera leve → consulta general.

**Modelo económico especial (⚠ afecta a comisión):**
- **Precio cerrado** (comisionable normal): vacunas, microchip, certificados, pasaporte, revisiones postoperatorias, corte de uñas, esterilización, limpieza bucal.
- **Precio orientativo "desde X €"**: consulta general, dermatología, traumatología, urgencias, hospitalización.
- Las **pruebas/tratamientos extra durante la visita se presupuestan y facturan directamente cliente↔clínica, SIN mediar la plataforma**. Doogking **solo comisiona la consulta inicial** reservada. Consentimiento explícito del propietario.

> Requisito de sistema: distinguir `esPrecioCerrado` vs `esPrecioOrientativo` en el servicio, mostrar "Desde X €" en la UI, y **no** aplicar el flujo de suplementos comisionables de §2.2 a la parte clínica extra.

**Diferencial:** **Historia Veterinaria Compartida** (con autorización): vacunas, medicación, alergias, crónicas, cirugías, informes, analíticas; el vet la vuelca tras cada acto ("copiar/pegar Excel o documento para agilizar") → carpeta médica digital de la mascota.

### 3.6 Transporte de animales 🚐

**Config empresa** (con campos **obligatorios `*` vs opcionales** — el cliente insiste porque "cada repartidor trabaja muy diferente"): tipo (local/provincial/nacional/internacional, recogida-entrega para peluquerías/residencias, traslado veterinario/urgente, aeropuerto, compartido/exclusivo), **itinerario y días**, zona de cobertura (provincias, km máx, países, horarios), tamaños admitidos, requisitos sanitarios (los que cada empresa crea), características del vehículo (climatización, jaulas homologadas, separación, GPS, puerta a puerta, acompañado, paradas), servicios adicionales (medicación, alimentación, paseos en trayectos largos, urgente, seguro ampliado).

**Cliente (`*` obligatorios):** datos del perro, trayecto (recogida/entrega/fecha/hora), comportamiento en desplazamiento (tranquilo/se marea/ladra/ansiedad/miedo/transportín/no tolera otros), necesidades especiales, documentación (cartilla*, pasaporte*).

**Precio dinámico:** estimado (Castellón→Valencia compartido 55 €) → al recoger: pesa 40 kg, no tolera otros, necesita individual → 55 € → 85 € → aceptar/cancelar. Suplementos configurables (exclusivo +20 €, +30 kg +10 €, urgente +25 €, medicación +5 €, parada +10 €, nocturna +15 €).

**Tipos de contratación:** puntual, **ida y vuelta con espera**, **recurrente** ("todos los lunes y miércoles 09:00" → programación/cron), larga distancia, urgente prioritario. → El schema actual `transporte` (tarifaBase + tarifaKm) **no cubre recurrencia ni ida-vuelta-espera**.

**Aviso legal reforzado:** si no se aprueba la modificación, **Doogking reembolsa y cancela**.

**Diferencial:** "Perfil de Viaje del Perro" (tolera trayectos, se marea, requiere transportín, parada cada 2 h).

---

## 4. Módulos nuevos (no son extensión de un vertical existente)

### 4.1 Vertical SEGUROS 🛡️ *(nuevo, alto potencial de ingresos recurrentes)*

El documento lo presenta como "uno de los servicios más rentables" por **comisiones recurrentes** y encaje con el ecosistema. No es una reserva puntual: es **contratación de póliza**.

- **Config aseguradora:** tipos (RC obligatoria/ampliada, gastos vet por accidente/enfermedad, asistencia completa, robo/pérdida, fallecimiento, defensa jurídica, daños a terceros, asistencia en viaje, PPP, vida), límites de cobertura, condiciones (edad admitida — matiz: razas pequeñas viven más—, peso, razas excluidas, estado sanitario), **carencias** (enfermedad 30d, cirugía 60d, ortopédica 180d), **franquicias**.
- **Cliente:** datos del perro + identificación (microchip) + historial veterinario + uso (compañía/deporte/trabajo/terapia/asistencia) + entorno.
- **Tipos:** RC obligatoria, vet básico, vet premium, completo, **temporal** (vacaciones, viajes, eventos — "muy interesante para Doogking").
- **Precio orientativo** con validación final de la aseguradora; aviso sobre omisión de datos → revisión de prima/exclusión/cancelación.
- **Diferencial (usa la Ficha del Perro):** **"Seguro recomendado para tu perro"** (Doogking ya conoce edad/raza/peso/historial/viajes/uso de residencias) e **"Índice de Bienestar Doogking"** (vacunas al día, revisiones, peso, adiestramiento, prevención) → descuentos escalonados (5 %/10 %/coberturas extra), estilo bonus-malus de seguros de coche.

> **Modelado:** nuevo vertical `seguros` con su discriminador y una **`PricingStrategy` que no es por noche/slot/trayecto sino por prima anual/temporal**. El "checkAvailability" es más bien "elegibilidad" (edad/raza/carencias). Encaja en el patrón strategy pero con semántica de póliza. Requiere colección `polizas` (vigencia, renovación, carencias, franquicia) separada de `reservas`.

### 4.2 Módulo Comunidad y Exploración — "Explora con tu mascota" 🗺️ *(gratuito, fidelización)*

Objetivo explícito: **que el usuario entre aunque no vaya a reservar** → frecuencia, comunidad, crecimiento orgánico, barrera de entrada. Visión: *"Booking + Tripadvisor + Google Maps del mundo de las mascotas"*.

- **Contenidos geolocalizados:** playas caninas, parques caninos, restaurantes/cafeterías pet-friendly (cada uno con ficha rica: fotos, normativa, servicios, valoraciones, ocupación estimada).
- **UGC:** los usuarios suben fotos, valoran, comparten consejos, recomiendan lugares, reportan incidencias ("la fuente no funciona"), actualizan info existente.
- **Geolocalización** (con consentimiento) + **mapa interactivo** tipo Google Maps + **favoritos** de lugares y establecimientos + recomendaciones personalizadas.

> **Modelado:** módulo `comunidad` independiente del motor de reservas. Colecciones `lugares` (tipo, geo `2dsphere`, atributos por tipo), `lugar_reviews`, `favoritos`. Requiere integración de mapas (Google Maps/Mapbox) y moderación de UGC. **Sin monetización directa en v1** (es retención). El `2dsphere` ya está previsto en la convención de índices del proyecto.

### 4.3 Modelo de comisiones — de "por vertical" a "por tramo + Socios Fundadores" 💰

El documento propone una **política comercial concreta** que hoy el sistema soporta a medias (`comision-configs` es por vertical, no por tramo de importe ni con programa de fundadores):

**Comisión de lanzamiento (primeros 2 años):**

| Servicio | Ticket medio | Comisión lanzamiento | Objetivo 5 años |
|---|---|---|---|
| Peluquería | 20-45 € | 8 % | 10-12 % |
| Veterinarios | 40-120 € | 10 % | 12-14 % |
| Residencias | 20-40 €/día | 12 % | 14-16 % |
| Guarderías | 10-20 €/día | 10 % | 12-14 % |
| Adiestramiento | 25-60 € | 10 % | 12-14 % |
| Transporte | 30-250 € | 12 % | 15 % |
| Hoteles pet-friendly | 80-250 € | 12-15 % | 15-18 % |
| Paseadores | 10-20 € | 8 % | 10-12 % |
| Cuidadores a domicilio | 15-40 € | 10 % | 12-14 % |

**Regla simple por tramo de importe (la que el autor usaría para todo Doogking):**

```
< 30 €          → 8 %
30 – 100 €      → 10 %
100 – 300 €     → 12 %
> 300 €         → 15 %
```

**Programa Socios Fundadores:** comisión congelada 24 meses para los primeros comercios ("si entro hoy pago 8 % para siempre; dentro de 3 años, 12 %") → genera urgencia comercial.

> **Requisitos derivados:** (a) extender `comision-configs`/cálculo para soportar **tramos por importe**; (b) marca `socioFundador` + `comisionCongeladaHasta` en `comercios` con override que gana sobre el vertical; (c) el reporte financiero del admin ya calcula GMV/margen/fee — añadir dimensión "cohorte fundador vs. estándar". **Nota:** aparecen 2 verticales nuevos en la tabla (**paseadores**, **cuidadores a domicilio**) no contemplados hasta ahora.

---

## 5. Gap analysis consolidado y trabajo derivado

| # | Requisito del documento | Dónde impacta | Tipo | Prioridad |
|---|---|---|---|---|
| 1 | **Entidad `Perro` / Ficha Inteligente** | nueva colección + `Reserva.perroId` + snapshot | Fundacional | **P0** |
| 2 | **Precio estimado + suplementos + aprobación + reembolso** | `Reserva` (estados/campos) + `suplemento_configs` + notif | Fundacional | **P0** |
| 3 | **Evidencias fotográficas** por reserva | `Reserva.evidencias[]` sobre `upload` existente | Transversal | **P0** |
| 4 | **Filtrado de compatibilidad** servicio↔perro | motor en `catalog`/vertical + config por servicio | Transversal | **P1** |
| 5 | **Reputación bidireccional + valoración del perro** | extender `reviews` (comercio→perro) + historial | Transversal | **P1** |
| 6 | **Recomendador de servicio** (reglas por motivo/gravedad) | motor de reglas (adiestramiento, veterinaria) | Por vertical | **P1** |
| 7 | Enriquecer schema **peluquería** (pelo, manto, temperamento, precio×tamaño) | `peluqueria.schema.ts` | Vertical | **P1** |
| 8 | Enriquecer schema **residencia** (compatibilidad social, requisitos configurables) | `alojamiento.schema.ts` | Vertical | **P1** |
| 9 | **Hotel pet-friendly** como vertical/subtipo separado + paquete "Vacaciones Doogking" | nuevo discriminador + carrito multi-vertical | Vertical | **P1** |
| 10 | **Adiestramiento**: catálogo por click, cuestionario, planes/bonos, Nivel Doogking | `adiestramiento.schema.ts` + módulo plan | Vertical | **P1** |
| 11 | **Veterinaria**: precio cerrado vs "desde", factura externa, triaje, especies múltiples, historia clínica | `veterinaria.schema.ts` + reglas comisión | Vertical | **P1** |
| 12 | **Transporte**: obligatorios/opcionales, ida-vuelta-espera, **recurrente**, perfil de viaje | `transporte.schema.ts` + programación | Vertical | **P1** |
| 13 | **Vertical Seguros** (pólizas, carencias, franquicia, recomendador, Índice Bienestar) | nuevo módulo `seguros` + colección `polizas` | Nuevo vertical | **P2** |
| 14 | **Módulo Comunidad** (playas/parques/restaurantes, mapa, UGC, favoritos, geo) | nuevo módulo `comunidad` + mapas | Nuevo módulo | **P2** |
| 15 | **Comisión por tramos + Socios Fundadores** + 2 verticales nuevos (paseadores, cuidadores) | `comision-configs` + `comercios` + reporte | Negocio | **P2** |

---

## 6. Propuesta de roadmap (respetando el core agnóstico)

> Regla mantenida: nada de `if (vertical === ...)` en el core. La Ficha del Perro y los suplementos son **transversales**; los enriquecimientos son **por discriminador**; Seguros y Comunidad son **módulos aislados**.

### Fase A — Cimientos transversales (P0) · *desbloquea todo lo demás*
1. Colección **`perros`** + CRUD + pantalla "Mis perros" en el perfil + selección del perro en el wizard de reserva + `Reserva.perroId` con snapshot.
2. **Ciclo de vida de suplementos** en `Reserva` (nuevos estados, campos, `suplemento_configs` por comercio) + panel del comercio para "solicitar ajuste en recepción" + notificación al cliente con aceptar/cancelar + **reembolso automático Stripe** al rechazar.
3. **Evidencias fotográficas** vinculadas a la reserva (reutiliza `upload`/S3).
4. Recalcular **comisión sobre el total ajustado** (con la excepción veterinaria ya prevista).

### Fase B — Inteligencia por perfil (P1)
5. **Motor de compatibilidad** servicio↔perro (config de "apto para" por servicio + filtro en búsqueda/detalle).
6. **Reputación bidireccional** + valoración del perro por el comercio → alimenta los historiales del pasaporte.
7. **Recomendador de servicio** (reglas declarativas por motivo/gravedad) empezando por adiestramiento y triaje veterinario.

### Fase C — Enriquecer los 5 verticales (P1) · *un discriminador cada vez*
8. Peluquería → 9. Residencia → 10. Hotel pet-friendly (+ paquete "Vacaciones Doogking" sobre el carrito multi-vertical de Épica N) → 11. Adiestramiento (planes/bonos/Nivel) → 12. Veterinaria (precio cerrado/orientativo + historia clínica) → 13. Transporte (recurrente/ida-vuelta/perfil de viaje).

### Fase D — Módulos nuevos y negocio (P2)
14. **Seguros** (módulo + `polizas` + recomendador + Índice de Bienestar Doogking).
15. **Comunidad "Explora con tu mascota"** (mapa + UGC + favoritos).
16. **Comisión por tramos + Socios Fundadores** + alta de verticales **paseadores** y **cuidadores a domicilio**.

---

## 7. Decisiones a confirmar con el cliente

1. **Mercado y moneda:** el documento es europeo (EUR, kg, PPP, pasaporte europeo). `SCOPE.md` menciona mercado peruano/IGV. **¿EUR + IVA 21 % Europa es la línea definitiva?** (el código y `CLAUDE.md` ya asumen EUR — hay que corregir `SCOPE.md`, que está desactualizado y habla de Hoteles/Vuelos/Taxis).
2. **Hotel pet-friendly vs. residencia canina:** ¿discriminador separado (recomendado) o subtipo de `alojamiento`?
3. **Cobro del suplemento:** ¿segundo `PaymentIntent` por la diferencia, o pre-autorización con captura ampliada? Impacta el diseño de pagos y el reembolso.
4. **Excepción veterinaria:** confirmar que Doogking **nunca** cobra las pruebas/tratamientos extra (solo la consulta) → tiene consecuencias fiscales y de comisión.
5. **Especies:** veterinaria y hotel admiten gatos/conejos/hurones/aves/exóticos. ¿La Ficha del Perro se generaliza a **Ficha de Mascota** (multi-especie) desde el diseño?
6. **Historia clínica / consentimiento:** modelo legal de compartición entre profesionales (RGPD): ¿opt-in por reserva, por profesional, global?
7. **Seguros:** ¿Doogking es **mediador de seguros** (regulación específica) o solo derivador con comisión? Cambia el alcance legal y técnico.
8. **Comunidad:** proveedor de mapas (Google Maps vs Mapbox) y política de **moderación de UGC**.
9. **Transporte recurrente:** ¿se modela como suscripción/serie de reservas programadas? Requiere scheduler.
10. **Nuevos verticales de la tabla de comisiones:** ¿entran **paseadores** y **cuidadores a domicilio** en el alcance?

---

## 8. Conclusión

El documento es coherente y muy valioso: **no pide más pantallas, pide un cambio de eje**. Doogking pasa de "marketplace de reservas caninas" a **"pasaporte digital + historia de servicios del perro, con reservas y precio inteligente encima"**. Ese giro descansa en dos piezas transversales que hoy no existen —**la entidad `Perro` y el ciclo de suplementos con aprobación**— y que, una vez construidas, hacen que los enriquecimientos por vertical, los seguros recomendados y la comunidad encajen de forma natural sobre el core actual **sin romper el patrón de extensibilidad**.

La buena noticia: el motor de reservas/pago/comisiones/availability ya está sano y el patrón discriminador + strategy es exactamente el correcto para absorber todo esto. El trabajo pesado es **fundacional (Fase A)**, no de reescritura.

---

*Documento de análisis. Fuentes: especificación del cliente (PDF, 49 pp.), `CLAUDE.md`, `SCOPE.md`, `PLAN-CONTINUACION.md` y auditoría del código (`apps/api`, `apps/web`, `libs/shared`).*
