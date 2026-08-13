# Plan unificado — Revisión de usuario + Nuevos módulos

> **Fuentes unificadas:**
> - `docs/REVISION-USUARIO-HISTORIAS.md` (42 historias: épicas N, O, P, Q, R, S, T) — feedback directo del cliente sobre la web actual.
> - `docs/new-modules.md` (57 historias: HU-001 → HU-057, fases A/B/C/D) — backlog funcional de módulos nuevos (Ignia v1.0).
> - Estado real del código a **2026-07-24** (rama `main`, commit `1b77eda`).
> - Planes previos vigentes: `docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md`, `docs/PLAN-MEJORAS-TODA-LA-APP.md`, `docs/PLAN-DOOGKING.md`.
>
> **Este documento sustituye a los dos backlogs de origen como fuente de verdad de ejecución.** Los documentos originales se conservan como trazabilidad hacia el cliente.

---

## 0. Resumen ejecutivo

**99 historias de origen → 74 historias unificadas** (25 fusiones por solapamiento entre ambos documentos).

De esas 74:

| Estado | Nº | Comentario |
|---|---|---|
| ✅ **Ya implementado** | 21 | Fases A y B del plan de mejora de servicios, más el rediseño de home y la unificación del buscador (commits `14a37aa` y `1b77eda`) |
| 🟡 **Parcial** (existe pero no cumple el criterio) | 12 | P. ej. selector de perros limitado a 4, vacunas en texto libre, consentimiento de historial como booleano único |
| 🔴 **Pendiente** | 41 | Carrito multi-vertical, Seguros, Comunidad, Agenda, comisión por tramos, marketing |

**Hallazgo clave del cruce de documentos:** tres de los cuatro "puntos abiertos" de la revisión del cliente **ya tienen respuesta dentro de `new-modules.md`** — no hacía falta esperar a una reunión:

| Punto abierto (revisión) | Resuelto por |
|---|---|
| **N4** — ¿"Seguros" es vertical o servicio transversal? | **HU-039** lo define explícitamente como vertical con `checkAvailability` = elegibilidad y colección `polizas` separada → **es un vertical**. |
| **P9** — ¿Qué significa el desplegable "Cualquier perro"/"Maya"? | **HU-002** — es el selector de mascota de la reserva. "Maya" es un perro registrado del usuario; "Cualquier perro" es el estado sin seleccionar. El problema es de *etiquetado*, no de concepto. |
| **P10** — ¿Qué filtros nuevos añadir? | **HU-017/HU-018** — el motor de compatibilidad servicio↔perro (ya implementado en backend) expone tipo de pelo, tamaño, temperamento y sociabilidad como filtros naturales. |

Solo queda **un punto realmente abierto**: **O2** (alcance del planificador de viajes con IA). Se aborda en la Ola 6 con una spec previa.

**Un conflicto explícito entre documentos** que exige decisión de negocio: el catálogo cerrado de servicios veterinarios (§2.3).

---

## 1. Estado real de la plataforma (auditoría del código)

### 1.1 Backend — `apps/api/src`

```
core/
  auth · users · comercios · catalog · availability · bookings · payments
  reviews · notifications · admin · upload
  perros            ← Ficha Inteligente + historial + valoraciones del perro (HU-001/002/005/019/020)
  suplementos       ← suplemento_configs + ciclo de ajuste (HU-009→012)
  recomendador      ← motor de reglas por motivo/gravedad (HU-022)
  comision-configs  ← comisión por vertical, plana (sin tramos)
  cupones           ← cupones básicos (sin campañas ni "quién asume el descuento")
  favoritos         ← favoritos de SERVICIOS (no de lugares)
  ai-search         ← búsqueda en lenguaje natural (usada en el hero del home)
verticals/
  alojamiento · transporte · veterinaria · peluqueria · adiestramiento · hoteles
```

**No existen** (confirmado por inspección de directorios): `carrito`/`checkout` combinado, `lugares`, `polizas`/`seguros`, `agenda`/`calendar-sync`, motor de eventos de abandono.

### 1.2 Frontend — `apps/web/src/app`

- **Home** (`features/home/home.component.ts`, 36 KB): rediseñado estilo Booking en `14a37aa`. Secciones actuales: Hero + buscador (modo Filtros / modo IA) · Garantías · *Explora por categoría* · *Servicios cerca de ti* · *Alojamientos recomendados* · *Reservar es así de fácil* · CTA comercios.
- **Buscador unificado** (`shared/components/search-bar/rs-search-bar.component.ts`): un único componente en home (`variant="card"`) y sobre cada listado (`variant="strip"`). La URL es la fuente de verdad. Ya resuelve Q6 y Q9.
- **Config de verticales** (`shared/verticales/verticales.config.ts`): fuente única de etiquetas, rutas, iconos, claim, descripción y `reservaPorNoches`. **Es el punto de entrada para todo el copy por vertical.**
- **Listados**: `features/verticales/vertical-browse.component.ts` (veterinaria, peluquería, adiestramiento, hoteles) + `features/alojamiento/` y `features/transporte/` con vistas propias.
- **Wizard de reserva** (`features/reservas/components/reserva-wizard.component.ts`): pasos por vertical, selector de perro ya integrado, Stripe con `SlotHold`.
- **Paneles**: `panel-comercio` (con `comercio-listado-form.component.ts`, ~1400 líneas, el formulario multi-vertical) y `panel-admin`.

### 1.3 Deltas concretos detectados frente a las historias

| Hallazgo | Archivo:línea | Historia afectada |
|---|---|---|
| Selector de perros del buscador: `opcionesPerros = [1, 2, 3, 4]` | `rs-search-bar.component.ts:253` | P8 |
| Wizard: `perros: [1, …Validators.max(3)]` y `<select>` con 3–4 opciones fijas | `reserva-wizard.component.ts:977, 164, 240` | S3 |
| Orden de resultados incluye `<option value="resenas">Más reseñas</option>` | `alojamiento-lista.component.ts:141` | P11 |
| Botón "Buscar" explícito en el buscador | `rs-search-bar.component.ts:92` | P4 |
| Ciudad = `<input>` de texto libre, sin autocompletado | `rs-search-bar.component.ts:57` | P6 |
| `labelCorto: 'Alojamiento'` en el chip de categoría | `verticales.config.ts:65` | P5 |
| Descripción de veterinaria menciona "cirugía, dermatología" | `verticales.config.ts:42` | Q7 (contradice la restricción de negocio) |
| Favicon = huella + corona, no la letra "D" | `apps/web/public/favicon.svg` | N7 |
| Hero: "Todo para su rey" (no "tu rey") | `home.component.ts:66` | N1 |
| `serviciosClinicos[].nombre` es `<input>` de texto libre | `comercio-listado-form.component.ts:367` | Q7 / HU-028 |
| `Perro.vacunas: string[]` (texto libre, sin fecha) | `perro.schema.ts:65` | HU-003 |
| `autorizaCompartirHistorial: boolean` (único, global) | `perro.schema.ts:127` | HU-016 |
| `ComisionConfig` sin tramos; `Comercio` sin `socioFundador` | `comision-config.schema.ts` | HU-046/047 |
| Sin bloque "¿Por qué Doogking?" en la home | `home.component.ts` | N3 / T2 |

---

## 2. Decisiones previas a la ejecución

### 2.1 Resueltas por el cruce de documentos (no requieren reunión)

1. **Seguros es un vertical** (`VerticalKey.SEGUROS`), con `AvailabilityStrategy` que implementa *elegibilidad* en vez de disponibilidad temporal, y colección `polizas` separada del `Servicio`. Fuente: HU-039.
2. **El desplegable "Cualquier perro"** es el selector de mascota (HU-002). Acción: renombrar a **"¿Para qué mascota?"** con opciones = perros del usuario + *"Aún no lo he decidido"*, y estado vacío con enlace a `/perros/nuevo`. No se elimina el componente.
3. **Los "filtros nuevos" de P10** son los del motor de compatibilidad (HU-017/018), ya disponibles en backend: `tamano`, `tipoPelo`, `temperamento`, `sociabilidadPerros`, `esPPP`, más `precioMax` y `distanciaKm`.

### 2.2 Decisión de producto necesaria — **catálogo de servicios veterinarios** ⚠️

Los dos documentos dan **listas incompatibles**:

| Revisión del cliente (Q7) | new-modules (HU-028) |
|---|---|
| Esterilización · Castración · Higiene dental · Consulta general · Urgencia · Vacunación · Microchip · Teleconsulta | Esterilización/castración · Primera consulta · Consulta de revisión · Segunda opinión · Consulta urgente · Limpieza dental |
| Excluye explícitamente **dermatología** y **cirugía** | Sin triaje elaborado ni precio abierto |

**Propuesta a validar (unión conservadora, 10 entradas):** `esterilizacion`, `castracion`, `consulta_general` (= primera consulta), `consulta_revision`, `segunda_opinion`, `consulta_urgente`, `higiene_dental` (= limpieza dental), `vacunacion`, `microchip`, `teleconsulta`.
Excluidos por regla de negocio: dermatología, cirugía y cualquier tratamiento de precio abierto (se facturan clínica↔cliente, coherente con HU-030 y con la excepción de comisión ya implementada en `BookingsService.solicitarAjuste`).

> **Bloqueante solo para DK-V05.** El resto de la Ola 4 avanza sin esta decisión.

### 2.3 Punto abierto real — **O2, planificador de viajes con IA**

Sin definir: fuente de datos de itinerarios, proveedor de LLM y nivel de personalización. Se aborda con `/speckit` al inicio de la Ola 6, reutilizando la infraestructura de `core/ai-search` ya existente.

### 2.4 Decisiones de arquitectura que este plan fija

| # | Decisión | Justificación |
|---|---|---|
| D-1 | El **carrito** no crea una "reserva compuesta": crea **N reservas independientes** vinculadas por `reservaMadreId`. | HU-033/035 exigen precio, comisión, disponibilidad y cancelación independientes por servicio. |
| D-2 | El **número de perros** deja de ser un entero y pasa a ser `perroIds: string[]`, con `numPerros` derivado. | Unifica P8, S3 y HU-002 en un solo modelo; elimina el límite artificial. |
| D-3 | Todo el **copy por vertical** vive en `verticales.config.ts` (nuevos campos `eyebrow`, `titular`, `subtitular`). Ningún componente hardcodea títulos. | Q1, Q4, Q5, Q8 se convierten en un cambio de datos, no de plantillas. |
| D-4 | La **comisión por tramos** extiende `ComisionConfig` con `tramos[]` opcional; si está vacío se usa `comisionPct` plano (compatibilidad hacia atrás). | HU-046 sin romper las liquidaciones existentes. |
| D-5 | **Lugares** (comunidad) es un módulo independiente del catálogo de `servicios`: no es reservable ni comisionable. | HU-042→045; evita contaminar el motor de reservas con entidades sin disponibilidad. |
| D-6 | La **compartición selectiva** se modela como colección `consentimientos` (perroId × tipoHistorial × vertical), no como flags en `Perro`. | HU-016 exige registro auditable RGPD con fecha. |

---

## 3. Backlog unificado

Leyenda de estado: ✅ hecho · 🟡 parcial · 🔴 pendiente.

### 3.1 Marca, home e identidad — `DK-M`

| ID | Historia | Origen | Prio | Estado | Dónde |
|---|---|---|---|---|---|
| DK-M01 | Titular del hero en tuteo: "Todo para **tu** rey" | N1 | P0 | 🔴 | `home.component.ts:66` |
| DK-M02 | Subtítulo del hero: "Reserva alojamientos premium, veterinarios de confianza, peluquerías caninas y mucho más…" | N2 | P0 | 🔴 | `home.component.ts` (hero) |
| DK-M03 | Bloque visual **"¿Por qué Doogking.com?"** con 4 pilares e iconos | N3 + T2 | P0 | 🔴 | nueva sección en `home.component.ts` |
| DK-M04 | Renombrar "Nuestros servicios reales" → **"Explora todos nuestros servicios"** | N5 | P1 | 🟡 | hoy es "Explora por categoría" (`:146`) |
| DK-M05 | Frase bajo el bloque de servicios: "Reserva en segundos con los mejores profesionales cerca de ti." | N6 | P1 | 🔴 | `home.component.ts:147` |
| DK-M06 | Logo y favicon con la inicial **"D"** (cabecera + pestaña + resultados de Google) | N7 | P0 | 🔴 | `public/favicon.svg`, `index.html`, `shared/media/images.ts` |
| DK-M07 | Home inspirada en la estructura de Booking | T1 | P1 | ✅ | commit `14a37aa` |
| DK-M08 | La home comunica "gestiona toda la vida de tu mascota", no un directorio | T5 | P1 | 🔴 | copy transversal de home |
| DK-M09 | Meta: completar cualquier reserva en **< 30 s** | T4 | P1 | 🔴 | objetivo transversal, se mide en Ola 2 |

### 3.2 Buscador y embudo de reserva — `DK-B`

| ID | Historia | Origen | Prio | Estado | Dónde |
|---|---|---|---|---|---|
| DK-B01 | El buscador de cualquier página permite completar la reserva, no solo buscar ciudad | P1 + T4 | P0 | 🟡 | `rs-search-bar.component.ts` |
| DK-B02 | La búsqueda descarta sin disponibilidad y fuera de presupuesto | P2 | P0 | 🔴 | `catalog.service.ts` + `availability` |
| DK-B03 | Eliminar el botón "Buscar": pulsar servicio/provincia navega al resultado | P4 | P0 | 🔴 | `rs-search-bar.component.ts:92` |
| DK-B04 | Renombrar categoría a **"Alojamiento canino"** en el buscador | P5 | P0 | 🔴 | `verticales.config.ts:65` |
| DK-B05 | Autocompletado de población vía Google Maps desde la 1.ª letra | P6 | P1 | 🔴 | nuevo `rs-place-autocomplete` |
| DK-B06 | Selector de fechas muestra **Entrada** y **Salida** cuando corresponde | P7 | P0 | ✅ | `rs-search-bar.component.ts:70-78` |
| DK-B07 | "Número de perros" sin límite, con botón **+** | P8 + S3 | P0 | 🟡 | `:253` y `reserva-wizard:164,240,977` |
| DK-B08 | Clarificar el desplegable "Cualquier perro" → **"¿Para qué mascota?"** | P9 + HU-002 | P1 | 🟡 | selector de perro |
| DK-B09 | Más filtros en resultados (compatibilidad con el perfil del perro) | P10 + HU-017/018 | P1 | 🟡 | backend ✅, UI 🔴 |
| DK-B10 | Sustituir el orden "Más reseñas" por **"Distancia"** | P11 | P0 | 🔴 | `alojamiento-lista.component.ts:141` |
| DK-B11 | "Entrada y salida" solo en residencia y hotel | S1 | P0 | ✅ | `reservaPorNoches` |
| DK-B12 | Resto de verticales: solo campo "Entrada" | S2 | P0 | ✅ | idem |
| DK-B13 | Apartado "Descubre experiencias cerca de ti" en resultados | P3 | P1 | 🔴 | depende de la Ola 6 (comunidad) |
| DK-B14 | Peluquería: población + día + hora → resultados directos | Q10 | P0 | 🟡 | `vertical-browse` (falta la hora) |

### 3.3 Cabecera — `DK-H`

| ID | Historia | Origen | Prio | Estado | Dónde |
|---|---|---|---|---|---|
| DK-H01 | "REGISTRA TU EMPRESA" visible en la cabecera | R1 | P0 | 🟡 | existe como "Registra tu negocio" (`rs-navbar:73`) |
| DK-H02 | Selector de moneda | R2 | P1 | 🔴 | `rs-navbar` + servicio de divisas |
| DK-H03 | Selector de país/idioma por bandera | R3 | P1 | 🔴 | `rs-navbar` + i18n |
| DK-H04 | Icono de ayuda / atención al cliente | R4 | P0 | 🔴 | `rs-navbar` + página `/ayuda` |

### 3.4 Contenido y lógica por vertical — `DK-V`

| ID | Historia | Origen | Prio | Estado | Dónde |
|---|---|---|---|---|---|
| DK-V01 | Transporte: "MÁS QUE UN TRANSPORTE" / "Su bienestar es el destino más importante." | Q1 | P0 | 🔴 | `verticales.config.ts` |
| DK-V02 | Transporte: mantener la sección de vehículos y conductores | Q2 | P0 | ✅ | `transporte-lista` |
| DK-V03 | Transporte: cálculo automático de distancia recogida→destino | Q3 | P0 | 🔴 | nuevo servicio de distancias + `transporte` |
| DK-V04 | Alojamiento: "Más que un alojamiento. Un lugar donde sentirse como en casa." | Q4 | P1 | 🔴 | `verticales.config.ts` |
| DK-V05 | Veterinaria: "VETERINARIOS DE CONFIANZA" + subtítulo de coberturas | Q5 | P0 | 🔴 | `verticales.config.ts` |
| DK-V06 | Buscador de veterinaria idéntico al resto | Q6 | P0 | ✅ | commit `1b77eda` |
| DK-V07 | Catálogo **cerrado** de servicios clínicos (sin dermatología ni cirugía) | Q7 + HU-028 | P0 | 🔴 | ⚠️ requiere §2.2 |
| DK-V08 | Peluquería: "El cuidado que merece" + texto de acompañamiento | Q8 | P0 | 🔴 | `verticales.config.ts` |
| DK-V09 | Buscador de peluquería idéntico al resto | Q9 | P0 | ✅ | commit `1b77eda` |
| DK-V10 | Veterinaria: precio cerrado vs. orientativo ("desde") | HU-029 | P1 | ✅ | `esPrecioCerrado` en `veterinaria.schema.ts` |
| DK-V11 | Extras veterinarios facturados fuera de la plataforma | HU-030 | P1 | ✅ | excepción en `solicitarAjuste` |
| DK-V12 | Historia Veterinaria Compartida | HU-031 | P1 | ✅ | Fase C.5 |
| DK-V13 | Volcado rápido del historial por copiar/pegar (Excel/documento) | HU-032 | P1 | 🔴 | `perros` + UI de comercio |
| DK-V14 | Hotel pet-friendly: política, suplementos, normas, índice de comportamiento | HU-023→027 | P1 | ✅ | Fase C.3 |
| DK-V15 | Transporte: campos obligatorios/opcionales configurables (cierre de Fase C.6) | plan previo | P1 | 🔴 | `verticals/transporte` |

### 3.5 Ficha del perro y privacidad — `DK-F`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-F01 | Crear/editar/eliminar mascotas con identidad, físico, salud, conducta y viaje | HU-001 | P0 | ✅ |
| DK-F02 | Seleccionar mascota al reservar + snapshot congelado | HU-002 | P0 | ✅ |
| DK-F03 | **Vacunas por checkbox** con fecha opcional (hoy es texto libre) | HU-003 | P0 | 🟡 |
| DK-F04 | Campos de conducta específicos de alojamiento (orina en habitación, ladra solo) | HU-004 | P0 | 🔴 |
| DK-F05 | El comercio ve la ficha/foto antes de la llegada | HU-005 | P0 | ✅ |
| DK-F06 | El propietario edita/elimina lo que registran las empresas | HU-015 | P0 | 🟡 |
| DK-F07 | **Compartición selectiva** por tipo de historial × tipo de servicio (RGPD) | HU-016 | P0 | 🟡 |
| DK-F08 | Versionado con fecha de cada cambio de la ficha | HU-001 (CA) | P1 | 🔴 |

### 3.6 Precio, suplementos y evidencias — `DK-P`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-P01 | Precio mínimo + estimado según perfil del perro | HU-006 | P0 | ✅ |
| DK-P02 | Aviso legal de ajuste con consentimiento fechado | HU-007 | P0 | ✅ |
| DK-P03 | Pago del estimado (SlotHold + PaymentIntent) | HU-008 | P0 | ✅ |
| DK-P04 | Suplementos preconfigurados con foto obligatoria | HU-009 | P0 | ✅ |
| DK-P05 | Aprobación/rechazo del ajuste por el propietario | HU-010 | P0 | ✅ |
| DK-P06 | Reembolso con cargo mínimo de gestión | HU-011 | P0 | ✅ |
| DK-P07 | Aprendizaje del precio con el histórico del perro | HU-012 | P1 | ✅ |
| DK-P08 | Evidencias fotográficas en S3 vinculadas a la reserva | HU-013 | P0 | ✅ |
| DK-P09 | Comisión sobre el total ajustado (excepción veterinaria) | HU-014 | P0 | ✅ |
| DK-P10 | **Notificación proactiva** al cliente cuando se solicita un ajuste | pendiente del plan previo | P0 | 🔴 |

### 3.7 Inteligencia por perfil — `DK-I`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-I01 | "Apto para" configurable por servicio | HU-017 | P1 | ✅ |
| DK-I02 | Filtrado automático por perfil del perro | HU-018 | P1 | ✅ |
| DK-I03 | Valoración del perro privada y controlada | HU-019 | P1 | ✅ |
| DK-I04 | Valoración negativa con observaciones + foto | HU-020 | P1 | ✅ |
| DK-I05 | Valorar cómo de pet-friendly fue el alojamiento | HU-021 | P1 | ✅ |
| DK-I06 | Recomendador por motivo/gravedad | HU-022 | P1 | ✅ |

### 3.8 Carrito multi-vertical y "Mi viaje" — `DK-C`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-C01 | Carrito único, desacoplado por dentro (N reservas independientes) | HU-033 | P1 | 🔴 |
| DK-C02 | Reserva madre + servicios vinculados | HU-034 | P1 | 🔴 |
| DK-C03 | Cancelación independiente por servicio | HU-035 | P1 | 🔴 |
| DK-C04 | Validar disponibilidad real de cada servicio antes del pago | HU-036 | P1 | 🔴 |
| DK-C05 | Pantalla **"Mi viaje con mi mascota"** | HU-037 | P1 | 🔴 |
| DK-C06 | **Planificador de viajes con IA** por provincias | O2 | P1 | 🔴 ⚠️ spec |

### 3.9 Comunidad "Explora con tu mascota" — `DK-K`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-K01 | Apartado "Explora con tu mascota" en la home (playas, parques, ríos) | O1 + T3 | P1 | 🔴 |
| DK-K02 | Catálogo de lugares pet-friendly con fichas tipadas | HU-042 | P2 | 🔴 |
| DK-K03 | UGC: fotos, reseñas, consejos, incidencias | HU-043 | P2 | 🔴 |
| DK-K04 | Geolocalización y mapa interactivo (`2dsphere`) | HU-044 | P2 | 🔴 |
| DK-K05 | Favoritos de lugares + moderación de UGC | HU-045 | P2 | 🔴 |
| DK-K06 | "Descubre experiencias cerca de ti" en resultados de búsqueda | P3 | P1 | 🔴 |

### 3.10 Vertical Seguros — `DK-S`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-S01 | Seguros visible como categoría en la home y el buscador | N4 | P0 | 🔴 |
| DK-S02 | La aseguradora configura pólizas, coberturas, carencias y franquicias | HU-038 | P2 | 🔴 |
| DK-S03 | Elegibilidad y tipos de contratación (`checkAvailability` = elegibilidad) | HU-039 | P2 | 🔴 |
| DK-S04 | Veracidad declarada + precio orientativo sujeto a validación | HU-040 | P2 | 🔴 |
| DK-S05 | Seguro recomendado + Índice de Bienestar Doogking | HU-041 | P2 | 🔴 |

### 3.11 Negocio y monetización — `DK-N`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-N01 | Comisión por tramo de importe (8/10/12/15 %) | HU-046 | P2 | 🔴 |
| DK-N02 | Programa Socios Fundadores (comisión congelada 24 meses + cohorte) | HU-047 | P2 | 🔴 |
| DK-N03 | Alta del vertical **cuidadores a domicilio** (paseadores fuera de alcance) | HU-048 | P2 | 🔴 |

### 3.12 Agenda — `DK-A`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-A01 | Sincronización bidireccional Google Calendar / Outlook-M365 | HU-049 | P2 | 🔴 |
| DK-A02 | Agendas por trabajador y recursos reservables | HU-050 | P2 | 🔴 |
| DK-A03 | Reglas de agenda: márgenes, recurrencia, zonas horarias | HU-051 | P2 | 🔴 |
| DK-A04 | Anti-doble-reserva: bloqueo durante el pago + revalidación | HU-052 | P2 | 🟡 (`SlotHold` existe; falta revalidación final) |

### 3.13 Crecimiento y marketing — `DK-G`

| ID | Historia | Origen | Prio | Estado |
|---|---|---|---|---|
| DK-G01 | Solicitud automática de valoración al completar el servicio | HU-053 | P2 | 🔴 |
| DK-G02 | Panel de seguimiento de envíos de valoración | HU-054 | P2 | 🔴 |
| DK-G03 | Detección de abandono con el paso exacto (arquitectura por eventos) | HU-055 | P2 | 🔴 |
| DK-G04 | Notificaciones de recuperación (push / email / in-app) | HU-056 | P2 | 🔴 |
| DK-G05 | Campañas y cupones con atribución del descuento + consentimiento de marketing | HU-057 | P2 | 🟡 (cupones básicos existen) |

---

## 4. Plan de implementación por olas

Cada ola es entregable y desplegable de forma independiente. Al cierre de cada una: `bun run build:shared` → `tsc` en api y web → `nest build` → `ng build --configuration production` → tests de ambos workspaces (umbral 80 % vigente).

---

### Ola 1 — Percepción de marca y copy · P0 · sin backend

**Cubre:** DK-M01, M02, M03, M04, M05, M06, M08 · DK-B04 · DK-V01, V04, V05, V08 · DK-H01
**Riesgo:** bajo. **Dependencias:** ninguna.

#### 1.1 Copy del hero y de la home

`apps/web/src/app/features/home/home.component.ts`

- Línea 66: `Todo para su rey` → `Todo para tu rey`.
- Añadir bajo el `<h1>` un `<p class="hero__subtitle">` con: *"Reserva alojamientos premium, veterinarios de confianza, peluquerías caninas y mucho más…"* (token `--f-lg`, color `--t-200`; en móvil se oculta bajo 480 px para no empujar el buscador).
- Sección de categorías (`:146`): `Explora por categoría` → **`Explora todos nuestros servicios`**; el `<p>` de apoyo (`:147`) → *"Reserva en segundos con los mejores profesionales cerca de ti."*
- Revisar el `<title>` y la `<meta name="description">` de `apps/web/src/index.html` para el tuteo y para DK-M08.

#### 1.2 Bloque "¿Por qué Doogking.com?" (DK-M03 / T2)

Nueva sección en `home.component.ts`, insertada **entre el hero y "Explora todos nuestros servicios"** (es el bloque que sustenta la conversión):

```
Pilares (4, cada uno con icono propio de public/icons):
  1. Reserva en segundos              — icono "zap"
  2. Profesionales verificados        — icono "shield-check"
  3. Miles de servicios en un lugar   — icono "grid"
  4. Atención cuando la necesites     — icono "headset"
```

- Grid de 4 columnas ≥1024 px, 2 columnas en tablet, carrusel horizontal en móvil.
- Solo tokens del UI Kit (`--s-*`, `--dk-blue`, `--dk-gold`, `--f-*`). Prohibido hardcodear color o espaciado (§21.5 de `CLAUDE.md`).
- Datos en una constante `PILARES` del componente, no inline en la plantilla, para poder testearla.
- Test: `home.component.spec.ts` — "debería renderizar los cuatro pilares del bloque ¿Por qué Doogking?".

#### 1.3 Copy por vertical (DK-V01, V04, V05, V08 · DK-B04)

`apps/web/src/app/shared/verticales/verticales.config.ts` — **extender la interfaz `VerticalUi`** con tres campos opcionales de cabecera de listado:

```ts
/** Etiqueta corta sobre el titular (all-caps, --font-accent). */
readonly eyebrow?: string;
/** Titular de la página del vertical; si falta, se usa `label`. */
readonly titular?: string;
/** Subtitular emocional; si falta, se usa `descripcion`. */
readonly subtitular?: string;
```

Valores a cargar:

| Vertical | `eyebrow` | `titular` | `subtitular` |
|---|---|---|---|
| transporte | — | `MÁS QUE UN TRANSPORTE` | `Su bienestar es el destino más importante.` |
| alojamiento | — | `Más que un alojamiento` | `Un lugar donde sentirse como en casa.` |
| veterinaria | — | `VETERINARIOS DE CONFIANZA` | `Clínicas veterinarias para tu mascota: vacunación, citas, urgencias 24 h y más.` |
| peluqueria | — | `El cuidado que merece` | `Encuentra y reserva el cuidado ideal para su pelo, su piel y bienestar.` |

Además:
- `labelCorto` de alojamiento: `'Alojamiento'` → **`'Alojamiento canino'`** (DK-B04). Verificar que el chip no desborda en móvil (`min-width: 96px` en `.sb__cat`); si desborda, permitir dos líneas en `.sb__cat-label`.
- **Corregir la `descripcion` de veterinaria** (`:42`): elimina "cirugía, dermatología" — contradice la restricción de negocio de DK-V07. Nueva: *"Clínicas verificadas: consulta, vacunación, urgencias 24 h, higiene dental y teleconsulta."*

Consumidores a actualizar para que lean los campos nuevos:
- `apps/web/src/app/features/verticales/vertical-browse.component.ts:128-129`
- `apps/web/src/app/features/transporte/components/transporte-lista.component.ts:34`
- `apps/web/src/app/features/alojamiento/components/alojamiento-lista.component.ts` (cabecera)

Test: `verticales.config.spec.ts` — "todo vertical con `titular` define también `subtitular`".

#### 1.4 Identidad "D" (DK-M06)

1. Nuevo `apps/web/public/favicon.svg`: disco `--dk-blue` (#08258B) con la letra **D** en Plus Jakarta Sans 800, color `--dk-gold` (#FBAE17). Convertir a `favicon.png` 512×512 y añadir `apple-touch-icon.png` 180×180.
   - El `favicon.png` actual pesa **1.7 MB** — regenerarlo a ≤ 20 KB (afecta al LCP).
2. `apps/web/src/index.html`: añadir `<link rel="apple-touch-icon">` y `<link rel="mask-icon">`.
3. Nuevo `apps/web/public/images/logo-doogking-mark-d.svg` y actualizar `shared/media/images.ts:14` (hoy apunta a un `.jpg`, cambiar a SVG por nitidez y peso).
4. Revisar los usos de `logoMark`: hero de home, `rs-navbar`, `registro.component.ts`, `registro-comercio`, y las plantillas de email de `notifications/mailer.service.ts`.

#### 1.5 Cabecera "REGISTRA TU EMPRESA" (DK-H01)

`rs-navbar.component.ts:75` y `:131`: `Registra tu negocio` → **`REGISTRA TU EMPRESA`** con `text-transform: uppercase`, `--font-accent`, `letter-spacing: .06em`. Debe verse también **con sesión iniciada** cuando el rol es `cliente` (hoy solo aparece en el bloque `@else` de no autenticado) — es la principal vía de captación de oferta.

**Criterios de aceptación de la Ola 1**
- Ninguna cadena "su rey" en `apps/web`.
- Bloque "¿Por qué Doogking?" visible sin scroll horizontal en 360 px.
- Favicon "D" en la pestaña y `favicon.png` < 20 KB.
- Los cuatro titulares por vertical se leen desde `verticales.config.ts`, sin literales en plantillas.
- `ng build --configuration production` sin errores; tests de web en verde.

---

### Ola 2 — Buscador y embudo de reserva · P0

**Cubre:** DK-B01, B02, B03, B07, B08, B09, B10, B14 · DK-M09 · DK-F03, F04 · DK-P10
**Riesgo:** medio-alto (toca el camino crítico de conversión). **Dependencias:** Ola 1 para el copy.

#### 2.1 Perros sin límite y selector de mascota (DK-B07 + DK-B08 + D-2)

Modelo nuevo del contrato de búsqueda (`rs-search-bar.component.ts`):

```ts
export interface BusquedaParams {
  vertical: string;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  /** Perros registrados seleccionados; vacío = búsqueda genérica. */
  perroIds: string[];
  /** Nº de perros de la reserva; ≥ perroIds.length, sin tope. */
  numPerros: number;
}
```

- Sustituir el `<select>` de `:84-88` por un **popover "¿Para qué mascota?"**:
  - Lista de perros del usuario con checkbox + miniatura (`PerrosService`).
  - Fila inferior *"Perros sin ficha"* con contador `– N +` (sin `max`).
  - Estado vacío / no autenticado: contador simple `– N +` y enlace *"Registra a tu perro para ver precios ajustados"*.
  - Resumen en el trigger: `"Maya + 1 perro"`, `"2 perros"`, `"Cualquier perro"` solo cuando `numPerros === 0`.
- Query params: `perros=<n>&perroIds=<id,id>` (retrocompatible: si solo llega `perros`, `perroIds` queda vacío).
- `reserva-wizard.component.ts`: eliminar `Validators.max(3)` (`:977`) y los `<select>` de `:164` y `:240`; reutilizar el **mismo componente** del popover. Ya existe `perros()` y `perroSeleccionado()` — pasan a `perrosSeleccionados: string[]`.
- Backend: `CrearReservaDto.perroIds?: string[]` (mantener `perroId` deprecado un ciclo para no romper clientes móviles); `BookingsService.crear` valida ownership de **todos** los ids y guarda un array de snapshots.
- Revisar `PricingStrategy` de alojamiento y hoteles: hoy multiplican por `perros`; deben usar `numPerros`.

Tests: `rs-search-bar.component.spec.ts` (el contador supera 4; el resumen se compone bien), `bookings.service.spec.ts` ("debería rechazar la reserva si algún perro no pertenece al usuario").

#### 2.2 Buscar sin botón (DK-B03)

- Eliminar el `<button type="submit" class="sb__cta">` (`:92-95`).
- La navegación se dispara desde:
  1. Clic en un chip de categoría (ya funciona con `buscarAlCambiar`; extenderlo a `variant="card"` del home).
  2. Selección de una sugerencia de población (Ola 3, DK-B05).
  3. `Enter` en cualquier campo del formulario (`(keydown.enter)` en `.sb__form`).
  4. `blur` con cambios en fechas o mascotas, con `debounce` de 250 ms, **solo en `variant="strip"`** (en los listados, donde ya hay resultados que refrescar).
- Mantener el `<form (ngSubmit)>` para accesibilidad con teclado y lectores de pantalla.
- **Riesgo:** quitar el CTA principal puede reducir la conversión de usuarios no habituados. Mitigación: conservar en el home un CTA gold **solo cuando el formulario está vacío** ("Explorar servicios"), que desaparece al primer input.

#### 2.3 Filtrado por disponibilidad y presupuesto (DK-B02)

`apps/api/src/core/catalog/catalog.service.ts` — la búsqueda debe descartar en origen:

1. **Sin disponibilidad**: cruzar con `AvailabilityRegistry.checkAvailability` del vertical para el rango pedido. Para no hacer N llamadas por página, añadir a `Servicio` un campo denormalizado `proximaDisponibilidad?: Date` y `sinDisponibilidadHasta?: Date`, refrescados por el `AvailabilityStrategy` al reservar/bloquear. La comprobación exacta se mantiene en el detalle y antes del pago.
2. **Fuera de presupuesto**: `precioMax` como filtro `$lte` sobre `precioBase` (ya parcialmente soportado; verificar que llega desde la URL).
3. **Incompatible con el perro**: reutilizar el motor de compatibilidad de HU-018 cuando llegan `perroIds`.

Índice a añadir en `servicios`:
```
{ vertical: 1, 'ubicacion.ciudad': 1, estado: 1, precioBase: 1, prioridadRanking: -1 }
```
(ESR: igualdad en vertical/ciudad/estado, rango en precio, orden por ranking.)

Test: `catalog.service.spec.ts` — "no devuelve servicios cuyo precio supera `precioMax`" y "no devuelve servicios marcados sin disponibilidad en el rango".

#### 2.4 Orden por distancia (DK-B10)

- `alojamiento-lista.component.ts:141`: `<option value="resenas">Más reseñas</option>` → `<option value="distancia">Distancia</option>`. Conservar relevancia, precio ↑, precio ↓ y valoración.
- Backend: `catalog.service.ts` acepta `orden=distancia` con `lat`/`lng` y usa `$geoNear` sobre el índice `2dsphere` ya declarado (`ubicacion.geo`).
- Frontend: pedir geolocalización **solo al elegir ese orden** (nunca al cargar), con fallback al centroide de la ciudad buscada si el usuario deniega el permiso.
- Aplicar el mismo cambio en `vertical-browse.component.ts` y `transporte-lista.component.ts` si exponen ordenación.

#### 2.5 Filtros de compatibilidad en resultados (DK-B09)

Panel lateral en los listados, alimentado por el motor ya existente (HU-017/018): `tamano`, `tipoPelo`, `temperamento`, `sociabilidadPerros`, `esPPP`, `precioMax`, `distanciaKm`, `cancelacionGratis`.
Si hay `perroIds` en la URL: chip destacado **"Compatible con Maya"** activo por defecto, desactivable con un clic.

#### 2.6 Peluquería: población + día + **hora** (DK-B14)

`verticales.config.ts`: nuevo flag `readonly pideHora?: boolean` (true en peluquería, veterinaria y adiestramiento).
`rs-search-bar`: cuando `pideHora`, añadir un `<input type="time">` junto a la fecha y propagarlo como `hora` en la URL.
`vertical-browse.component.ts`: si llega `hora`, ordenar por proximidad al slot pedido y marcar *"Disponible a las HH:mm"* en la tarjeta.

#### 2.7 Ficha del perro: vacunas y conducta de alojamiento (DK-F03, DK-F04)

`libs/shared/src/enums/perro.enum.ts` — nuevo enum:
```ts
export enum Vacuna {
  TOS_PERRERA = 'tos_perrera', PUPPY = 'puppy', TETRAVALENTE = 'tetravalente',
  ANTIRRABICA = 'antirrabica', HEPTAVALENTE = 'heptavalente', MOQUILLO = 'moquillo',
  HEPATITIS = 'hepatitis', PARVOVIRUS = 'parvovirus', LEISHMANIA = 'leishmania',
}
```
`apps/api/src/core/perros/perro.schema.ts`:
```ts
@Prop({ type: [{ tipo: String, fecha: Date }], default: [] })
vacunasDetalle!: { tipo: Vacuna; fecha?: Date }[];

// Conducta específica de alojamiento (HU-004)
@Prop({ type: Boolean, default: false }) orinaEnInterior!: boolean;
@Prop({ type: Boolean, default: false }) ladraAlQuedarseSolo!: boolean;
@Prop({ type: Boolean, default: false }) destructivoEnSoledad!: boolean;
@Prop() notasAlojamiento?: string;
```
- Mantener `vacunas: string[]` un ciclo y **migrar** con un script en `apps/api/src/scripts/` que mapee por normalización de texto lo migrable y deje el resto en `notasAlojamiento`/`observaciones`.
- UI: `features/perros/` — checkboxes con date picker opcional por vacuna; los campos de conducta de alojamiento aparecen agrupados y se muestran al comercio de alojamiento en el detalle de reserva (ya hay canal por `perroSnapshot`).

#### 2.8 Notificación proactiva de ajuste (DK-P10)

Pendiente heredado del plan anterior: al pasar la reserva a `AJUSTE_SOLICITADO`, `NotificationsService` debe encolar un email con `precio inicial → nuevo precio → motivo → enlace de aceptar/rechazar`. Nuevo `TipoNotificacion.AJUSTE_SOLICITADO` y plantilla en `mailer.service.ts`.

#### 2.9 Medición de DK-M09 (< 30 s)

Instrumentar el embudo con marcas de tiempo (`performance.mark`) en: `busqueda_iniciada` → `servicio_abierto` → `wizard_paso1` → `pago_confirmado`. Volcar a la colección `eventos` (la misma que consumirá DK-G03). Sin esta medición, T4 no es verificable.

**Criterios de aceptación de la Ola 2**
- Se puede reservar para 7 perros sin tocar código.
- Un servicio sin disponibilidad en el rango buscado no aparece en resultados.
- El orden "Distancia" reordena correctamente con y sin permiso de geolocalización.
- Sin botón "Buscar" en el buscador; navegación por chip, Enter y selección.
- El cliente recibe email al solicitarse un ajuste.

---

### Ola 3 — Cabecera, ubicación y soporte · P0/P1

**Cubre:** DK-B05 · DK-H02, H03, H04
**Dependencias:** Ola 2 (el autocompletado sustituye al input de ciudad ya refactorizado).

#### 3.1 Autocompletado de población (DK-B05)

Nuevo componente `apps/web/src/app/shared/components/place-autocomplete/rs-place-autocomplete.component.ts` (`ControlValueAccessor`, para encajar en el `FormGroup` del buscador).

- Proveedor: **Google Places Autocomplete (New)** restringido a `types=(cities)` y `components=country:es|pt|fr|it|de` (mercado europeo, §9 de `CLAUDE.md`).
- **La clave de API no va en el frontend.** Proxy en el backend: nuevo `apps/api/src/core/geo/` con `GET /geo/autocomplete?q=&session=` y `GET /geo/geocode?placeId=`, con la clave en `.env` (`GOOGLE_MAPS_API_KEY`) y caché en memoria de 24 h por término (control de coste: Places factura por sesión).
- Dispara desde el **primer carácter** (requisito explícito de P6), con `debounce` de 200 ms y `distinctUntilChanged`.
- Al seleccionar: guarda `ciudad`, `lat`, `lng` y `placeId` en la URL → alimenta directamente el orden por distancia de DK-B10.
- Accesibilidad: `role="combobox"`, `aria-expanded`, navegación con flechas, `aria-activedescendant`.
- Fallback: si `/geo/autocomplete` falla, el campo degrada a texto libre (la búsqueda por nombre de ciudad debe seguir funcionando).

Tests: `rs-place-autocomplete.component.spec.ts` (sugerencias desde la 1.ª letra, selección con teclado) y `geo.service.spec.ts` (caché, error del proveedor → array vacío sin excepción).

#### 3.2 Selector de moneda (DK-H02)

- `libs/shared/src/constants.ts`: `MONEDAS_SOPORTADAS = ['EUR', 'GBP', 'CHF', 'USD']`, base **EUR** (§9 de `CLAUDE.md`).
- Nuevo `apps/web/src/app/core/moneda/moneda.service.ts` con `signal<Moneda>` persistido en `localStorage` y un `CurrencyPipe` propio (`rsPrecio`) que convierte para **visualización**.
- **Regla no negociable:** el cobro sigue siendo en EUR. La conversión es informativa y se etiqueta como tal ("≈ £42 · se cobra en EUR"). Cambiar la moneda de cobro implicaría Stripe multi-divisa y reescribir liquidaciones — fuera de alcance.
- Tipos de cambio: nuevo `GET /geo/fx` en el backend, refrescado a diario desde el BCE, cacheado 24 h.

#### 3.3 Selector de país/idioma (DK-H03)

- Banderas SVG en `public/icons/flags/`.
- Fase 1 (esta ola): el selector fija **país** (afecta a la restricción del autocompletado y a la ciudad por defecto) y deja el idioma en `es` con la infraestructura preparada.
- Fase 2 (posterior): `@angular/localize` con `es`/`en`. Extraer los literales a `messages.xlf` es un trabajo grande y transversal — **no** se incluye aquí; se documenta como deuda explícita.

#### 3.4 Ayuda y atención al cliente (DK-H04)

- Icono `?` en `rs-navbar` (desktop y drawer) → nueva ruta `/ayuda` con lazy loading.
- Contenido: FAQ por rol (cliente / comercio), formulario de contacto que crea una `Notificacion` de tipo `soporte` dirigida a admin, y teléfono/email de contacto.
- El icono debe ser visible **autenticado y sin autenticar**.

---

### Ola 4 — Cierre de la Fase C y privacidad de la ficha · P0/P1

**Cubre:** DK-V03, V07, V13, V15 · DK-F06, F07, F08
**Dependencias:** §2.2 resuelto para DK-V07.

#### 4.1 Catálogo cerrado de servicios veterinarios (DK-V07) ⚠️

`libs/shared/src/enums/servicio-clinico.enum.ts` (nuevo):
```ts
export enum ServicioClinicoTipo {
  CONSULTA_GENERAL = 'consulta_general',   CONSULTA_REVISION = 'consulta_revision',
  CONSULTA_URGENTE = 'consulta_urgente',   SEGUNDA_OPINION  = 'segunda_opinion',
  ESTERILIZACION   = 'esterilizacion',     CASTRACION       = 'castracion',
  HIGIENE_DENTAL   = 'higiene_dental',     VACUNACION       = 'vacunacion',
  MICROCHIP        = 'microchip',          TELECONSULTA     = 'teleconsulta',
}
```
- `veterinaria.schema.ts`: `ServicioClinico.nombre: string` → `tipo: ServicioClinicoTipo` (+ `nombrePersonalizado?: string` solo para matices, nunca para crear servicios fuera del catálogo).
- `comercio-listado-form.component.ts:361-380`: el `<input>` libre pasa a `<select>` con las 10 opciones; el resto de la fila (precio, duración, `esPrecioCerrado`) no cambia.
- **Validación de negocio en backend**: `CatalogService` rechaza con `DomainException` cualquier `tipo` fuera del enum, cerrando la puerta a dermatología y cirugía por API.
- Migración: script en `apps/api/src/scripts/migrar-servicios-clinicos.ts` que normaliza los nombres existentes; los no mapeables se desactivan (`activo: false`) y se listan en un informe para revisión manual — **no se borran**.
- `veterinaria.seeder.ts` y `seed-europe.ts`: actualizar los datos de ejemplo.

#### 4.2 Cálculo automático de distancia en transporte (DK-V03)

- Reutiliza el módulo `core/geo/` de la Ola 3: nuevo `GET /geo/distancia?origen=&destino=` sobre Google Distance Matrix, caché de 7 días por par de `placeId` (las distancias no cambian).
- `verticals/transporte/transporte-pricing.strategy.ts`: `total = tarifaBase + tarifaKm × km`, con `km` de la API, redondeado al alza a 0,5 km.
- UI (`features/transporte/`): dos campos con `rs-place-autocomplete` (recogida y destino); al completar ambos se muestra *"~34 km · 42 min · estimado 68 €"*. El precio se marca **orientativo** hasta la confirmación del transportista.
- Guardar `distanciaKm` y `duracionMin` en `Reserva.detalle` para trazabilidad y disputas.
- Fallback sin API: fórmula Haversine sobre `ubicacion.geo` con un factor de corrección de 1,3 (ruta real vs. línea recta) y aviso de "estimación aproximada".

#### 4.3 Cierre de Fase C.6 — Transporte (DK-V15)

Última pieza pendiente del plan de mejora de servicios: campos obligatorios/opcionales configurables por el comercio de transporte (transportín propio, acompañante humano, número máximo de perros por trayecto, aceptación de PPP, zona de cobertura por radio en km).

#### 4.4 Volcado rápido del historial (DK-V13)

- `POST /perros/:id/historial/importar` con `{ texto: string, vertical, formato: 'tsv' | 'texto' }`.
- Parser en `perros.service.ts`: detecta tabulaciones (pegado desde Excel) y construye filas `{ fecha, concepto, detalle }`; en texto plano crea una única entrada.
- UI en el panel de comercio: `<textarea>` con vista previa de la tabla parseada **antes** de confirmar. Nada se guarda sin confirmación explícita.
- Toda entrada importada queda marcada `origen: 'comercio'` → editable/eliminable por el propietario (DK-F06).

#### 4.5 Compartición selectiva RGPD (DK-F07 + D-6)

Nueva colección `consentimientos`:
```
_id, perroId, propietarioId,
tipoHistorial: 'veterinario' | 'grooming' | 'conducta' | 'alojamiento' | 'transporte',
verticalDestino: VerticalKey,
concedido: boolean,          // opt-in explícito; por defecto false fuera del vertical de origen
fechaConcesion, fechaRevocacion?, ipOrigen, createdAt, updatedAt
```
Índice: `{ perroId: 1, tipoHistorial: 1, verticalDestino: 1 }` único.

- `PerrosService.historialVisiblePara(perroId, vertical)` filtra por consentimiento. **Regla por defecto: el historial generado por un vertical solo es visible para ese mismo vertical.**
- Sustituye a `Perro.autorizaCompartirHistorial` (mantener el campo un ciclo, migrándolo a consentimientos por vertical para no perder las autorizaciones ya dadas).
- UI: pantalla "Privacidad de {nombre}" en `features/perros/` con una matriz de interruptores tipo historial × vertical, y un botón "Revocar todo".
- Test obligatorio: *"la peluquería no ve el informe veterinario sin consentimiento explícito"* — es el ejemplo literal de HU-016.

#### 4.6 Versionado de la ficha (DK-F08)

`perro_versiones`: `{ perroId, snapshot, cambiadoPor, campos: string[], createdAt }`, escrito en el `PerrosService.actualizar` dentro de la misma transacción. Vista "Historial de cambios" en la ficha, solo lectura.

---

### Ola 5 — Carrito multi-vertical y "Mi viaje" · P1

**Cubre:** DK-C01 → C05
**Riesgo:** alto — es el cambio estructural más profundo del plan. **Dependencias:** Ola 2 (contrato `perroIds`).

#### 5.1 Modelo (D-1)

Nueva colección `carritos`:
```
_id, usuarioId, estado: 'abierto' | 'procesando' | 'confirmado' | 'abandonado',
items: [{
  servicioId, vertical, comercioId, detalle, perroIds[],
  fechaInicio, fechaFin?, montoSubtotal, comisionMonto, montoTotal,
  slotHoldId?, politicaCancelacion, esReservaMadre: boolean
}],
createdAt, updatedAt, expiraEn   // TTL 24 h
```
`reserva.schema.ts` — dos campos nuevos:
```ts
@Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' }) reservaMadreId?: Types.ObjectId;
@Prop({ type: SchemaTypes.ObjectId, ref: 'Carrito' }) carritoId?: Types.ObjectId;
```
Índice: `{ reservaMadreId: 1 }` y `{ carritoId: 1 }`.

**Invariante:** una reserva nunca depende de otra para su estado. `reservaMadreId` es **solo** una relación de presentación y agrupación; cancelar la madre no cancela las hijas (HU-035).

#### 5.2 Nuevo módulo `apps/api/src/core/carrito/`

`carrito.schema.ts` · `carrito.repository.ts` · `carrito.service.ts` · `carrito.controller.ts` · `carrito.module.ts` + specs.

Endpoints:
```
GET    /carrito                      → carrito abierto del usuario
POST   /carrito/items                → añadir servicio (crea SlotHold del vertical)
DELETE /carrito/items/:itemId        → quitar (libera el SlotHold)
POST   /carrito/validar              → HU-036: revalida disponibilidad de TODOS los items
POST   /carrito/checkout             → crea N reservas + 1 PaymentIntent agregado
```

**Flujo de checkout (crítico):**
1. `validar()` revalida cada item con su `AvailabilityStrategy`. Si alguno falla → `409` con el detalle de qué item cayó; el resto del carrito se conserva.
2. Se crean N reservas en estado `PENDIENTE` dentro de **una transacción Mongoose** (§12.4 de `CLAUDE.md`).
3. Un único `PaymentIntent` por la suma, con `metadata.reservaIds`.
4. El webhook `payment_intent.succeeded` confirma **todas** las reservas y calcula la liquidación **por comercio** (cada comercio cobra lo suyo, con su propia comisión de vertical).
5. Fallo de pago → libera todos los `SlotHold` y las reservas quedan `CANCELADA`.

**Idempotencia**: el handler ya verifica `pago.estado`; extenderlo para que un evento duplicado no confirme dos veces un lote.

#### 5.3 Cancelación independiente (DK-C03)

`BookingsService.cancelar` ya opera por reserva. Añadir: si la reserva cancelada es la madre, las hijas **siguen vivas** y se notifica al usuario del cambio de contexto ("Has cancelado el hotel; tu cita de peluquería del día 14 sigue confirmada").

#### 5.4 Frontend

- `features/carrito/` — panel lateral con el resumen agrupado por comercio, importe y política de cancelación por línea.
- `features/reservas/mi-viaje/` — pantalla **"Mi viaje con mi mascota"** (DK-C05): timeline cronológico con alojamiento, servicios, horarios, direcciones (con enlace a mapa), importes, estados y acción de cancelar por línea.
- Punto de entrada: tras confirmar una reserva de alojamiento u hotel, banner *"¿Añades peluquería o transporte para estas fechas?"* con servicios compatibles en esa ciudad y fechas. Es el gancho comercial del carrito.

---

### Ola 6 — Comunidad y planificador de viajes · P1/P2

**Cubre:** DK-K01 → K06 · DK-C06 · DK-B13
**Dependencias:** Ola 3 (geo) y Ola 5 (para que el planificador pueda volcar al carrito).

#### 6.0 Spec previa obligatoria (DK-C06) ⚠️

`/speckit` para el planificador con IA antes de estimar. La spec debe cerrar: proveedor de LLM (por defecto Claude, coherente con `core/ai-search`), fuente de datos de itinerarios (¿solo lugares propios de `lugares` + servicios de Doogking, o fuentes externas?), nivel de personalización (perfil del perro, presupuesto, duración) y coste por generación.

#### 6.1 Módulo `apps/api/src/core/lugares/` (D-5)

```
lugares:        _id, tipo: 'playa'|'parque'|'restaurante'|'ruta'|'rio',
                nombre, descripcion, fotos[], ubicacion { ciudad, provincia, geo },
                atributos: Record<string, unknown>,   // tipados por `tipo`
                ratingPromedio, totalReviews, estado: 'publicado'|'pendiente'|'rechazado',
                creadoPor, createdAt, updatedAt
lugar_reviews:  _id, lugarId, usuarioId, puntuacion, texto, fotos[],
                estado: 'publicada'|'en_moderacion'|'rechazada', createdAt
```
Índices: `{ 'ubicacion.geo': '2dsphere' }`, `{ tipo: 1, 'ubicacion.provincia': 1, ratingPromedio: -1 }`.

Atributos por tipo (HU-042): playas (normativa, temporada, aparcamiento, duchas, fuentes, ocupación), parques (superficie, vallado, sombra, iluminación, agility), restaurantes (interior/terraza, bebederos, menú canino).

#### 6.2 UGC y moderación (DK-K03, K05)

- Subida de fotos por el mismo `core/upload` (S3) ya en uso.
- Toda aportación entra en `en_moderacion`. Panel en `panel-admin` con cola, aprobar/rechazar y motivo.
- Extender `core/favoritos` con `tipo: 'servicio' | 'lugar'` (hoy solo servicios) — **no** crear una colección paralela.

#### 6.3 Frontend comunidad

- Home (DK-K01): sección **"Explora con tu mascota"** bajo "Alojamientos recomendados", con tarjetas de playas, parques y ríos pet-friendly y CTA a `/explora`.
- `/explora` — listado + **mapa interactivo** (Leaflet + tiles OSM; evita el coste por carga de Google Maps JS y no requiere clave). Geolocalización con consentimiento explícito.
- `/explora/:id` — ficha con fotos, atributos, reseñas, favorito y *"Servicios de Doogking cerca de aquí"* (enlaza comunidad ↔ marketplace: es la razón de negocio del módulo).
- DK-B13/K06: en los resultados de búsqueda, carrusel "Descubre experiencias cerca de ti" con lugares en un radio de 25 km de la ciudad buscada.

#### 6.4 Planificador de viajes (DK-C06)

- `/planificador` — grid de provincias con foto (patrón visual de Booking/Airbnb, según O2).
- Al entrar: formulario (provincia, fechas, perro, presupuesto, intereses) → `POST /ai/itinerario` en `core/ai-search`.
- El LLM recibe como contexto **solo datos propios**: lugares de `lugares` y servicios reservables de la provincia. Devuelve 2–3 opciones de itinerario por días.
- Cada elemento reservable del itinerario lleva botón **"Añadir al viaje"** → alimenta el carrito de la Ola 5. Ese es el retorno de inversión del módulo.
- Límite de coste: rate limit por usuario y caché por (provincia, mes, perfil) durante 7 días.

---

### Ola 7 — Vertical Seguros · P0 (visibilidad) / P2 (funcional)

**Cubre:** DK-S01 → S05
**Dependencias:** ninguna técnica; sí comercial (hace falta al menos una aseguradora partner).

#### 7.1 Alta del vertical

- `libs/shared/src/enums/vertical.enum.ts`: `SEGUROS = 'seguros'` + label `'Seguros para mascotas'`.
- `verticales.config.ts`: entrada nueva con icono propio, `reservaPorNoches: false`, titular *"Protege a tu rey"*.
- `apps/api/src/verticals/seguros/`: `seguros.schema.ts` (discriminador de `Servicio`), `seguros-availability.strategy.ts` (**`checkAvailability` = elegibilidad**, no calendario), `seguros-pricing.strategy.ts`, `seguros.module.ts` con auto-registro en el registry. **El core no se toca** (§3.3 de `CLAUDE.md`).

#### 7.2 Modelo

```
SegurosServicio (discriminador):
  tiposSeguro[]        // rc_obligatoria, rc_ampliada, gastos_vet_accidente,
                       // gastos_vet_enfermedad, asistencia, robo_perdida,
                       // fallecimiento, defensa_juridica, viaje, ppp, vida
  limitesCobertura[], carencias[], franquicia,
  condicionesAdmision { edadMinMeses, edadMaxAnios, razasExcluidas[], pesoMax,
                        requiereEstadoSanitario }

polizas (colección propia):
  _id, usuarioId, perroId, servicioId, aseguradoraComercioId,
  tipoSeguro, primaAnual, franquicia, carenciaHasta,
  vigenciaDesde, vigenciaHasta, renovacionAutomatica,
  estado: 'pendiente_validacion'|'vigente'|'suspendida'|'cancelada'|'rechazada',
  declaracionVeracidadAceptada: boolean, fechaDeclaracion
```

#### 7.3 Elegibilidad, veracidad y recomendación

- `checkAvailability` evalúa el perfil del perro (edad, raza, peso, PPP, historial) contra `condicionesAdmision` → *elegible / no elegible / elegible con recargo*.
- Precio siempre **orientativo** hasta validación de la aseguradora (HU-040): la póliza nace `pendiente_validacion`; el cobro se retiene hasta la validación (reutiliza `PAGO_RETENIDO`, ya en el enum de estados).
- Checkbox de veracidad con registro fechado, con el aviso literal de que la omisión puede revisar prima, excluir coberturas o cancelar.
- **Índice de Bienestar Doogking** (HU-041): puntuación 0–100 calculada desde la ficha (vacunas al día, revisiones, peso, prevención, uso de servicios) → descuentos escalonados tipo bonus-malus. Servicio `bienestar.service.ts` en `core/perros`, reutilizable después en marketing.
- DK-S01: "Seguros" aparece en el buscador, en el bloque de categorías de la home y en el menú.

---

### Ola 8 — Comisiones por tramos y Socios Fundadores · P2

**Cubre:** DK-N01 → N03

#### 8.1 Comisión por tramos (D-4)

`comision-config.schema.ts`:
```ts
@Prop({ type: [{ hastaEur: Number, comisionPct: Number }], default: [] })
tramos!: { hastaEur: number; comisionPct: number }[];
```
Valores por defecto (HU-046): `[{30, 0.08}, {100, 0.10}, {300, 0.12}, {Infinity, 0.15}]`.

**Jerarquía de resolución** (extiende §11.2 de `CLAUDE.md`, de mayor a menor prioridad):
1. `comercio.comisionPctCongelada` (socio fundador vigente)
2. `comercio.comisionPctOverride`
3. `comisionConfig.tramos` del vertical (si no está vacío)
4. `comisionConfig.comisionPct` del vertical
5. `COMISION_PCT_DEFAULT` (15 %)

Extraer esta cadena a un único `ComisionResolverService` con tests exhaustivos — hoy la lógica está repartida y añadir tramos sin centralizarla generaría discrepancias entre el importe cobrado y el reportado.

#### 8.2 Socios Fundadores (DK-N02)

`comercio.schema.ts`: `socioFundador: boolean`, `comisionPctCongelada?: number`, `congelacionHasta?: Date` (24 meses).
Panel admin: marcar/desmarcar socio fundador y **cohorte** como dimensión del reporte financiero (§11.5 de `CLAUDE.md`).
Job diario que descongela comercios cuya `congelacionHasta` ha vencido, con notificación previa a 30 días.

#### 8.3 Cuidadores a domicilio (DK-N03)

Alta ligera sobre el patrón discriminador (`verticals/cuidadores/`): `VerticalKey.CUIDADORES`, reserva por sesión o por días, a domicilio del cliente o del cuidador, comisión por defecto 12 %. **Paseadores queda fuera de alcance** (indicado explícitamente en HU-048).

---

### Ola 9 — Agenda y anti-doble-reserva · P2

**Cubre:** DK-A01 → A04. Módulo grande; se ejecuta al final por su coste y por depender de OAuth con terceros.

- `apps/api/src/core/agenda/` con `CalendarConnector` como interfaz (§18-I): `GoogleCalendarConnector` y `MicrosoftGraphConnector`. OAuth2 con refresh token cifrado en BD.
- Sincronización bidireccional con webhooks entrantes (Google `watch`, Graph `subscription`), reconciliación por `externalEventId` y política de conflicto *el bloqueo más restrictivo gana*.
- `agendas` (por trabajador) y `recursos` (habitaciones, vehículos, mesas) como entidades reservables independientes del `Servicio`; `AvailabilityStrategy` de los verticales de cita pasa a consultarlas.
- Reglas: márgenes entre citas, recurrencia (RRULE), jornada partida, zonas horarias (`Europe/Madrid` por defecto, `luxon` o `Temporal`).
- **DK-A04**: el `SlotHold` ya existe; añadir **revalidación inmediatamente antes de confirmar** en el webhook de pago. Es una salvaguarda barata contra la sobreventa y debe implementarse aunque el resto de la ola se posponga — **adelantarla a la Ola 5** (el carrito multiplica el riesgo).

---

### Ola 10 — Valoraciones automáticas, abandonos y marketing · P2

**Cubre:** DK-G01 → G05

#### 10.1 Motor de eventos (base de DK-G03)

Colección `eventos`: `{ tipo, usuarioId?, reservaId?, carritoId?, paso?, payload, createdAt }` + `EventBus` interno (`@nestjs/event-emitter`). Tipos iniciales: `reserva_iniciada`, `paso_completado`, `reserva_abandonada`, `reserva_confirmada`, `servicio_completado`, `carrito_abandonado`.
Este bus también recibe las marcas de tiempo de DK-M09 (Ola 2), así que la instrumentación ya estará puesta.

#### 10.2 Valoraciones automáticas (DK-G01, G02)

- Al emitirse `servicio_completado` (o al pasar la reserva a `COMPLETADA`), encolar email con **enlace único firmado** (JWT de un solo uso, 30 días) a la valoración de esa reserva concreta.
- Una valoración por servicio; un único recordatorio a los 3 días.
- Exclusiones (HU-053): reserva cancelada, reembolsada o con incidencia (`EN_DISPUTA`).
- Panel admin: tracking de envío / entrega / apertura / reenvío por solicitud (requiere webhooks del proveedor de email).

#### 10.3 Recuperación de abandonos (DK-G04)

- Scheduler que detecta carritos y reservas sin actividad 1 h / 24 h / 72 h.
- Canales: email (existe), in-app (`notificaciones`, existe) y **push** (nuevo: Capacitor + FCM/APNs, historia M2 de `CLAUDE.md`).
- Contenido personalizado según el paso exacto del abandono.

#### 10.4 Campañas y cupones (DK-G05)

Extender `cupon.schema.ts`: `asumeDescuento: 'plataforma' | 'comercio'`, `campanaId`, `condiciones` (vertical, importe mínimo, primera reserva, cohorte).
Nueva colección `campanas` + panel admin con métricas (envíos, aperturas, conversión, coste del descuento por parte asumida).
**Gestión de consentimiento de marketing** en `Usuario`: `aceptaMarketing: boolean` con fecha — sin él, ningún envío promocional (RGPD).

---

## 5. Cronograma y dependencias

```
Ola 1  Marca y copy          ██████                      P0  · sin dependencias
Ola 2  Buscador y embudo         ████████████            P0  · ← Ola 1 (copy)
Ola 3  Cabecera y geo                    ███████         P0/P1 · ← Ola 2
Ola 4  Cierre Fase C + RGPD              ██████████      P0/P1 · ← §2.2 · geo ← Ola 3
Ola 5  Carrito y Mi viaje                    ██████████████  P1 · ← Ola 2
Ola 6  Comunidad + IA                              ████████████  P1/P2 · ← Olas 3 y 5
Ola 7  Seguros                                     ██████████    P0/P2 · independiente
Ola 8  Comisiones y fundadores                            ██████ P2 · independiente
Ola 9  Agenda                                             ██████████ P2 (DK-A04 se adelanta a Ola 5)
Ola 10 Valoraciones y marketing                              ████████ P2 · ← instrumentación de Ola 2
```

**Ruta crítica:** Ola 1 → Ola 2 → Ola 5 → Ola 6. Las olas 7 y 8 pueden ejecutarse en paralelo por otra persona sin conflicto de archivos (verticales nuevos + `comision-configs`, ambos aislados del embudo).

---

## 6. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-1 | Quitar el botón "Buscar" (DK-B03) baja la conversión | Alto | CTA condicional en el home cuando el formulario está vacío; medir con la instrumentación de DK-M09 y revertir si cae. |
| R-2 | Coste de Google Places/Distance Matrix | Medio | Proxy en backend, caché 24 h/7 días, `sessiontoken` en autocompletado, cuota diaria con alerta. |
| R-3 | El carrito multi-vertical desestabiliza el pago (camino crítico) | Alto | Ruta de checkout separada; el flujo de reserva simple actual **no se modifica**; feature flag `carritoHabilitado`. |
| R-4 | Migración del catálogo de servicios clínicos rompe listados publicados | Alto | Migración no destructiva (`activo: false` + informe), ventana de revisión con los comercios antes de forzar el enum. |
| R-5 | El selector de moneda induce a creer que se cobra en esa divisa | Medio-legal | Etiqueta explícita "se cobra en EUR" junto a todo importe convertido. |
| R-6 | UGC sin moderar (comunidad) | Medio-legal | Todo entra `en_moderacion`; nada se publica sin aprobación de admin. |
| R-7 | `perroIds` rompe clientes móviles ya publicados | Medio | `perroId` se mantiene deprecado un ciclo; el backend acepta ambos contratos. |
| R-8 | Sobreventa con el carrito | Alto | Adelantar DK-A04 (revalidación pre-confirmación) a la Ola 5. |

---

## 7. Verificación (aplicable a toda ola)

1. `bun run build:shared` **primero** (el resto depende de sus tipos).
2. `tsc --noEmit` en `apps/api` y `apps/web`.
3. `nest build` y `ng build --configuration production`.
4. `bun run test` en ambos workspaces, umbral 80 % statements/branches (§20 de `CLAUDE.md`).
5. Cada archivo de producción nuevo con su `.spec.ts` en el mismo commit — sin excepciones.
6. Auditoría de design system (`/ui-kit audit`) en las olas con UI: cero colores y espaciados hardcodeados.
7. Actualizar el **Estado actual** de este documento y la memoria del proyecto al cerrar cada ola.

---

## 8. Trazabilidad origen → unificado

| Origen | IDs unificados |
|---|---|
| N1–N7 | DK-M01, M02, M03, M06 · DK-S01 · DK-M04, M05 |
| O1–O2 | DK-K01 · DK-C06 |
| P1–P11 | DK-B01, B02, B13, B03, B04, B05, B06, B07, B08, B09, B10 |
| Q1–Q10 | DK-V01, V02, V03, V04, V05, V06, V07, V08, V09 · DK-B14 |
| R1–R4 | DK-H01, H02, H03, H04 |
| S1–S3 | DK-B11, B12, B07 |
| T1–T5 | DK-M07, M03, K01, M09, M08 |
| HU-001→016 | DK-F01→F08 · DK-P01→P09 |
| HU-017→022 | DK-I01→I06 |
| HU-023→032 | DK-V14, V07, V10, V11, V12, V13 |
| HU-033→037 | DK-C01→C05 |
| HU-038→048 | DK-S02→S05 · DK-K02→K05 · DK-N01→N03 |
| HU-049→057 | DK-A01→A04 · DK-G01→G05 |

---

## 9. Estado actual

**Última actualización:** 2026-07-24.

### Ola 1 — ✅ completada 2026-07-24

Historias cerradas: **DK-M01, M02, M03, M04, M05, M06, M08 · DK-B04 · DK-V01, V04, V05, V08 · DK-H01**.

- `home.component.ts` — hero en tuteo ("Todo para **tu** rey") + subtítulo de amplitud de servicios; sección de categorías retitulada a "Explora todos nuestros servicios" con el claim "Reserva en segundos con los mejores profesionales cerca de ti."; **nueva sección `#por-que`** con los cuatro pilares (`motivos`), situada entre categorías y ciudades para no repetir mensaje con la franja de garantías del hero.
- `verticales.config.ts` — nuevos campos `titular`/`subtitular` + helpers `titularDeVertical()` / `subtitularDeVertical()`. Cargado el copy de transporte, alojamiento, veterinaria y peluquería. `labelCorto` de alojamiento → **"Alojamiento canino"**. Corregida la descripción de veterinaria, que anunciaba cirugía y dermatología (servicios que Doogking no intermedia).
- Cabeceras de listado (`vertical-browse`, `transporte-lista`) — el `<h1>` pasa a ser el titular de marca y la ciudad buscada se traslada a la línea de recuento, donde aporta contexto sin romper el copy. En `alojamiento-lista` el claim va como *eyebrow* dorado sobre el título contextual, porque esa vista es pantalla de resultados y su `<h1>` debe seguir siendo "Alojamiento canino en {ciudad}".
- Identidad "D" — nuevos `public/favicon.svg` y `public/images/logo-doogking-d.svg` (geometría pura, legible a 16 px), `BRAND.logoD`, `theme-color`, `mask-icon` y `apple-touch-icon` en `index.html`.
- `rs-navbar` — marca compacta "D" siempre visible + logotipo completo por encima de 1180 px (patrón Booking); **"Registra tu empresa"** en versalitas y visible también para el cliente autenticado (`muestraAltaComercio`), no solo para visitantes. En el drawer móvil queda al final, por debajo de los accesos del propio usuario.
- `styles.scss` — la fila de categorías del navbar no parte etiquetas (`white-space: nowrap` + desplazamiento horizontal): la etiqueta más larga ya no puede romper la altura de la barra.

**Verificación:** `tsc --noEmit` sin errores · `ng build --configuration production` correcto (612 kB inicial) · **134/134 tests en verde** (5 nuevos: pilares, subtítulo del hero, copy de categorías, marca "D" y alta de empresa, copy por vertical con guarda de "sin cirugía ni dermatología").

> ⚠️ **Deuda preexistente detectada, no introducida por esta ola:** `bun run test:web` falla el umbral global de cobertura (24 % statements frente al 80 % exigido en `jest.config.ts`). Afecta a todo `apps/web`, no a los archivos tocados aquí. Debe abordarse como tarea propia; hasta entonces, verificar con `--coverage=false` para distinguir fallos reales de este umbral.

**Pendiente menor de la Ola 1:** regenerar `apps/web/public/favicon.png` (hoy **1.7 MB**) a ≤ 20 KB. No está referenciado desde `index.html`, así que no penaliza el LCP actual, pero conviene sustituirlo o eliminarlo.

### Ola 2 — 🟡 mayoría completada 2026-07-24

Historias cerradas: **DK-B02, B03, B07, B08, B09, B10, B14 · DK-F03, F04 · DK-P10**.

**Selector de mascotas (DK-B07 + DK-B08).** Nuevo `shared/components/pet-picker/rs-pet-picker.component.ts`, con `model()` de dos valores: `perroIds` (mascotas registradas) y `numPerros` (total, **sin tope**). Sustituye al desplegable "Cualquier perro" que el cliente no entendía: ahora se ve el nombre y la foto de cada perro. Reglas: el total nunca baja del número de mascotas elegidas, ni de 1. Sin sesión degrada a un contador simple con enlace a login. El resumen se compone solo (`"Maya y Toby + 1 perro"`).

**Sin botón "Buscar" (DK-B03).** Se elimina de `variant="strip"` — la que se usa en `/alojamiento` y en el resto de listados, que es exactamente la que el cliente señaló. **Se conserva en el home** (`variant="card"`): allí no hay resultados que refrescar y sin botón el usuario que escribe ciudad y fechas se queda sin forma visible de confirmar. La navegación se dispara además al pulsar una categoría (en cualquier variante), con Enter, y sobre los listados con `debounce` de 400 ms al cambiar cualquier campo.

**Descarte de lo no reservable (DK-B02).** `catalog.repository.ts` filtra por el contador de plazas de cada vertical (`espaciosDisponibles`, `citasDisponibles`, `cuposDisponibles`, `unidadesDisponibles`). Un contador **ausente** no oculta el listado; solo se esconde el que declara cero. Activo por defecto; `soloDisponibles=false` devuelve el catálogo completo. `precioMax` ya filtraba.

**Orden por distancia (DK-B10).** "Más reseñas" → **"Distancia"**, y "score" → `valoracion`. Backend: nuevo parámetro `orden` con `$geoNear` sobre el índice `2dsphere` existente, en un `$facet` que resuelve página y total en una sola consulta. Si `$geoNear` no devuelve nada (listados aún sin coordenadas) **cae al orden por defecto** en vez de dejar la pantalla vacía. El permiso de ubicación se pide **solo al elegir ese orden**, nunca al cargar, y si se deniega se explica en pantalla y se sigue ordenando por la ciudad buscada.
> **Bug preexistente corregido de paso:** el desplegable de ordenación de `/alojamiento` no enviaba nada al API — cambiar el orden refrescaba la lista sin reordenarla. Ahora `orden` viaja en la petición.

**Hora en verticales de cita (DK-B14).** Nuevo flag `pideHora` en `verticales.config.ts` (peluquería, veterinaria, adiestramiento). El buscador muestra `<input type="time">` y propaga `hora` en la URL.

**Compatibilidad en resultados (DK-B09).** La mascota elegida en el buscador viaja como `perroIds` y alimenta el filtro de compatibilidad ya existente en backend, tanto en `/alojamiento` como en `vertical-browse`, sin que el usuario la vuelva a seleccionar.

**Contexto de búsqueda visible.** Al quitar el botón "Buscar" no quedaba confirmación de que la búsqueda se aplicó: se añaden chips junto al recuento con fecha, hora y "Compatible con tu mascota".

**Perros sin tope en el wizard (S3).** Fuera `Validators.max(3)` y los `<select>` de 3–4 opciones en alojamiento y transporte; en su lugar un contador `− N +` sin máximo.

**Ficha del perro (DK-F03, F04).** Nuevo enum `Vacuna` + `VACUNA_LABELS` en `shared`; `vacunasDetalle: { tipo, fecha? }[]` en schema y DTOs, con UI de casillas y date picker que aparece al marcar. El campo `vacunas` de texto libre **se conserva** para no perder lo ya registrado. Nuevos campos de conducta de alojamiento (`orinaEnInterior`, `ladraAlQuedarseSolo`, `destructivoEnSoledad`, `notasAlojamiento`), incluidos en `construirSnapshotPerro` para que el alojamiento los vea **antes** de la llegada.

**Aviso proactivo de ajuste (DK-P10).** Nuevo `TipoNotificacion.ajuste_solicitado` y `NotificationsService.notificarAjusteSolicitado`, invocado desde `BookingsService.solicitarAjuste`. El correo detalla importe inicial → nuevo importe → **desglose real de los suplementos**, no un mensaje genérico. Se envía sin `await` y no lanza: el ajuste ya está registrado y un fallo de correo no debe revertirlo.

**Verificación:** `tsc` limpio en shared, api y web · `nest build` y `ng build --configuration production` correctos · **366/366 tests de backend** y **149/149 de frontend** en verde (26 nuevos).

#### Pendiente de la Ola 2

| Historia | Qué falta | Por qué se aparta |
|---|---|---|
| **DK-M09** (< 30 s) | Instrumentar `performance.mark` en el embudo y volcar a la colección `eventos` | La colección `eventos` es la base de DK-G03 (Ola 10). Crearla aquí a medias duplicaría trabajo; conviene hacerla una sola vez con su motor de eventos. |
| **DK-B01** | Que el buscador complete la reserva de principio a fin | Depende del carrito de la Ola 5: hoy el buscador lleva al listado, y el wizard es quien reserva. |
| **DK-B14** (parcial) | Ordenar por cercanía real al slot horario pedido | Requiere que los verticales de cita expongan sus slots libres por hora; hoy solo publican un contador de cupos. Es trabajo de la Ola 9 (agenda). |
| **DK-B05** | Autocompletado de población con Google Maps | Es la Ola 3, con su proxy de backend para no exponer la clave de API. |

### Ola 3 — ✅ completada 2026-07-24

Historias cerradas: **DK-B05 · DK-H02, H03, H04**.

**Módulo `geo` en el backend.** Nuevo `apps/api/src/core/geo/` con tres endpoints públicos: `GET /geo/autocomplete`, `GET /geo/geocode` y `GET /geo/fx`. Existe para que **la clave de Google nunca llegue al navegador** y para cachear: sugerencias 24 h, coordenadas 30 días (una ciudad no se mueve) y tipos de cambio 24 h. Places factura por sesión, así que el frontend envía un `sessionToken` que se renueva al elegir una población. Degrada siempre en silencio: sin `GOOGLE_MAPS_API_KEY` o con el proveedor caído devuelve vacío y el buscador sigue aceptando texto libre. Nueva variable documentada en `.env.example`.

**Autocompletado de población (DK-B05).** Nuevo `shared/components/place-autocomplete/rs-place-autocomplete.component.ts`, `ControlValueAccessor` para encajar tal cual en el formulario del buscador. Sugiere **desde el primer carácter**, con `debounce` de 200 ms. Accesible: `role="combobox"`, navegación con flechas, `aria-activedescendant`, Escape cierra. **Elegir una población es una acción de búsqueda**, no solo de escritura — cierra el círculo de P4 ("pulsar la provincia debe llevarme al resultado").
> Efecto secundario valioso: al elegir la población ya tenemos sus coordenadas, así que el orden por distancia de la Ola 2 **deja de necesitar el permiso de geolocalización** cuando el usuario llegó por el buscador. El permiso solo se pide si no hay ciudad elegida.

**Moneda y país (DK-H02, DK-H03).** `MONEDAS_SOPORTADAS`, `MONEDA_SIMBOLOS` y `PAISES_SOPORTADOS` en `shared`; nuevo `core/moneda/moneda.service.ts` con persistencia en `localStorage`; nuevo `shared/components/region/rs-region-selector.component.ts` con dos controles separados (bandera y moneda) en cabecera y drawer.
> **El cobro sigue siendo en euros y así se dice en pantalla**, junto al selector. Cambiar la divisa de cobro exigiría Stripe multi-divisa y rehacer las liquidaciones — fuera de alcance. Si falta la tasa de cambio se muestra el importe en euros en vez de inventar una conversión.
> Los tipos de cambio se piden **solo si el usuario elige una divisa distinta del euro**: la mayoría nunca toca el selector y no debe pagar una petición extra al cargar la cabecera.

**Ayuda y soporte (DK-H04).** Icono siempre visible en la cabecera (con y sin sesión) hacia la nueva ruta `/ayuda`, con FAQ separada por rol — las dudas de un dueño y las de un comercio no se parecen — y contacto directo. Responde explícitamente a lo que el propio producto promete: que ningún suplemento se cobra sin aprobación y que el cobro es siempre en euros.

**Verificación:** `tsc` limpio en shared, api y web · `nest build` y `ng build --configuration production` correctos (616 kB inicial) · **382/382 tests de backend** y **168/168 de frontend** en verde (35 nuevos).

#### Correcciones de paso

- `crypto.randomUUID` no existe en contextos no seguros (http sin TLS) ni en jsdom: el token de sesión de Places ahora tiene alternativa. Era un fallo real en producción sobre http, no solo en pruebas.
- Los tipos de cambio se pedían al renderizar la cabecera (es decir, en **toda** la aplicación). Ahora son bajo demanda.

#### Pendiente de la Ola 3

**Idioma (fase 2 de DK-H03).** El selector fija país —lo que restringe el autocompletado y la región del buscador— pero el idioma sigue en `es`. Traducir la interfaz exige extraer todos los literales a `messages.xlf` con `@angular/localize`: es un trabajo transversal a toda la aplicación y merece su propia ola, no un apaño dentro de esta. Queda como deuda declarada.

### Ola 4 — ✅ completada 2026-07-24

**§2.2 resuelto:** el cliente confirma el catálogo de 10 entradas propuesto. Historias cerradas: **DK-V03, V07, V13, V15 · DK-F06, F07, F08**.

**Catálogo cerrado de servicios veterinarios (DK-V07).** Nuevo enum `ServicioClinicoTipo` en `shared` con las 10 entradas de §2.2. `ServicioClinico.tipo` pasa a ser la fuente de verdad; `nombre` queda como texto heredado. El formulario del comercio cambia el `<input>` libre por un `<select>`, y **la regla se valida también en `CatalogService`**, no solo en la UI: una llamada directa al API con `dermatologia` o `cirugia` recibe un 400 con el motivo de negocio explicado, no un "valor no permitido" genérico. Los listados antiguos sin `tipo` se toleran para no bloquear al comercio.
> **Migración no destructiva**: `bun run --cwd apps/api migrar:servicios-clinicos` corre en **simulación por defecto** y solo escribe con `--aplicar`. Reconoce etiquetas oficiales y sinónimos frecuentes ("limpieza dental" → higiene dental, "urgencias" → urgencia, "chip" → microchip); lo que no reconoce lo marca `activo: false` **y lo lista en el informe** para revisarlo con el comercio. No borra nada.
> El seeder de veterinaria contenía radiografía, ecografía, cirugía menor y consulta de dermatología: sustituidos por servicios del catálogo.

**Distancia automática en transporte (DK-V03).** `GET /geo/trayecto` sobre Google Routes, cacheado 7 días por par de poblaciones. La UI del wizard sustituye los dos campos de dirección por `rs-place-autocomplete` y rellena la distancia sola, mostrando *"73,5 km · 60 min por carretera"*. **Sin proveedor cae a Haversine con factor de sinuosidad 1,3** y lo etiqueta como estimación aproximada, en vez de dar un precio como si fuera firme. Los kilómetros se redondean al alza a 0,5 km. El campo sigue siendo editable: si el cliente conoce su ruta real, manda su dato. `distanciaKm` y el resumen del cálculo se guardan en `Reserva.detalle` para trazabilidad ante disputas.

**Compartición selectiva RGPD (DK-F07).** Nueva colección `consentimientos` (perro × tipo de historial × vertical destino), con índice único y fechas de concesión y revocación. Nuevo `PerrosService.historialVisiblePara()`: **cada vertical ve solo lo que él mismo generó**; ver lo de otro exige consentimiento explícito y vigente. Es opt-in — la ausencia de consentimiento nunca autoriza. Sustituye al booleano único `autorizaCompartirHistorial`, que se mantiene un ciclo. Nueva pantalla `/perros/:id/privacidad` con la matriz de permisos: las casillas del propio vertical salen bloqueadas y marcadas, para que el dueño vea que por defecto **no está compartiendo nada**.
> Test obligatorio en verde: *"la peluquería no ve el informe veterinario sin consentimiento explícito"* — el ejemplo literal de HU-016.

**Control del historial por el propietario (DK-F06).** `PATCH` y `DELETE` sobre entradas del historial: los datos de la mascota son suyos y puede corregir o borrar lo que escriba una empresa. Nuevos campos `origen` y `editadaAt` en `perro_historial`.

**Versionado de la ficha (DK-F08).** Nueva colección `perro_versiones`: antes de cada cambio se guarda el estado anterior y qué campos se tocaron. Importa porque el precio se calcula con los datos declarados: ante una disputa por un suplemento hay que poder demostrar qué decía la ficha y cuándo cambió. No se guarda versión si el cambio no altera nada.

**Volcado copiar/pegar (DK-V13).** `POST /perros/:id/historial/previsualizar` convierte el texto pegado en filas **sin guardar nada**, y `POST .../importar` confirma lo ya revisado. Detecta el tabulado de Excel, reconoce fechas en la primera columna y descarta líneas vacías.

**Cierre de Fase C.6 — Transporte (DK-V15).** Condiciones configurables por el transportista: radio de cobertura, distancia mínima facturable, antelación mínima, máximo de perros por trayecto, aceptación de PPP y transportín propio. Con esto, **la Fase C del plan de mejora de servicios queda completa**.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (617 kB) · **407/407 tests de backend** y **175/175 de frontend** en verde (32 nuevos).

#### Correcciones de paso

- Un identificador malformado en la URL del historial reventaba con `BSONError` → **500**. Ahora se valida y devuelve un 400 con mensaje claro.
- `rs-sr-only` no existía en el design system pese a hacer falta para etiquetar controles de solo icono. Añadida como utilidad global en `styles.scss`.

### Ola 5 — ✅ completada 2026-07-24

Historias cerradas: **DK-C01, C02, C03, C04, C05 · DK-A04** (adelantada desde la Ola 9, como preveía el plan).

**Modelo (D-1 confirmado).** Nueva colección `carritos` con TTL de 24 h, y dos campos nuevos en `reservas`: `reservaMadreId` y `carritoId`, con sus índices. **`reservaMadreId` es solo una relación de presentación**: cancelar la madre no cancela a las hijas. Es lo único compatible con que cada línea tenga su comercio, su precio, su comisión y su política de cancelación (HU-035).

**El carrito no bloquea plaza (decisión de diseño).** Añadir al viaje comprueba disponibilidad pero **no toma `SlotHold`**: el bloqueo se produce en el checkout. Así un carrito abandonado no retiene inventario durante horas, que en un marketplace es dinero perdido para el comercio.

**Checkout ordenado a propósito** (`CarritoService.checkout`): primero se revalida **todo** (HU-036); si algo falla no se crea ninguna reserva y el viaje se conserva intacto, con el mensaje nombrando **qué servicio** cayó para que el usuario corrija solo esa línea. Después se crean las reservas, con la madre primero para poder vincular el resto. Si una línea falla a mitad, **se liberan las plazas ya tomadas** y el carrito vuelve a `abierto`.

**Un pago, comisiones por comercio.** `PaymentsService.crearIntentDeViaje` calcula el desglose **reserva a reserva** —cada vertical tiene su comisión— y solo después agrega. El fijo de Stripe se añade **una sola vez**: es por transacción, y el viaje es una. El webhook confirma todas las reservas del lote y notifica a cada comercio por separado.

**DK-A04 — revalidación anti-doble-reserva.** `BookingsService.confirmar` comprueba, antes de confirmar, que la plaza sigue siendo del cliente. Si el `SlotHold` sigue vivo no hace nada. Si caducó (el pago tardó más de sus 15 minutos) revalida; y si ya no hay plaza **deja la reserva en `EN_DISPUTA` en vez de venderla dos veces**, porque el cliente ya pagó y dejarle sin nada en silencio sería peor. Un fallo al comprobar nunca bloquea una reserva ya pagada.

**Frontend.** `features/carrito/` con servicio de estado por señales y panel lateral que **agrupa por comercio** y avisa de que cada servicio es una reserva independiente — esconderlo generaría la expectativa equivocada de que cancelar uno cancela todo. Nueva pantalla **"Mi viaje con mi mascota"** (`/reservas/viaje/:reservaMadreId`): timeline cronológico con el estado propio de cada línea, porque un viaje con el hotel confirmado y la peluquería cancelada es normal, no una inconsistencia. Nueva pantalla de pago del viaje (`/reservas/viaje-pago`) que reutiliza `StripeService`.

**Gancho comercial.** Tras confirmar una reserva de alojamiento u hotel aparece *"¿Completamos el viaje?"* con la ciudad y las fechas ya propagadas: es el momento en que añadir servicios cuesta un clic. Es el retorno de inversión del carrito.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (622 kB) · **426/426 tests de backend** y **187/187 de frontend** en verde (31 nuevos).

#### Pendiente de la Ola 5

**DK-C06 — planificador de viajes con IA.** Sigue siendo trabajo de la Ola 6 y **exige su spec previa** (§6.0): proveedor de LLM, fuente de itinerarios, nivel de personalización y coste por generación. El carrito ya está listo para recibir sus resultados: el planificador solo tiene que llamar a `POST /carrito/items`.

### Ola 6 — 🟡 comunidad completada 2026-07-25 · planificador pendiente de decisión

Historias cerradas: **DK-K01, K02, K03, K04, K05, K06**. Pendiente: **DK-C06** (planificador con IA), bloqueado por §6.0.

**Módulo `lugares` (D-5 confirmado).** Nuevas colecciones `lugares` y `lugar_reviews` con índice `2dsphere`, **fuera del catálogo de servicios**: no son reservables ni comisionables, y meterlos en `servicios` habría contaminado el motor de reservas con entidades sin disponibilidad ni precio.

**Nada se publica sin moderación (HU-045).** Lugares y aportaciones nacen en `pendiente`. **Editar también devuelve a moderación**: si no, corregir sería la puerta trasera para publicar sin revisión. La búsqueda pública solo devuelve `publicado`, y la media del lugar se recalcula contando únicamente valoraciones aprobadas — las incidencias no puntúan. Nueva pantalla `/admin/comunidad` con la cola de revisión.

**Consulta pública, aportación con sesión.** `GET /lugares` no exige token a propósito: es contenido de descubrimiento que debe indexarse y atraer a quien todavía no tiene cuenta. Aportar y moderar sí requieren sesión.

**Favoritos extendidos, no duplicados (§6.2).** `favoritos` gana `tipo` y `lugarId` con índices únicos parciales, en vez de una colección paralela: guardar un servicio y guardar un lugar son la misma acción del usuario, y separarlas obligaría a consultar dos veces para pintar una sola lista.

**Frontend.** `/explora` con filtros por tipo y orden por cercanía —**el permiso de ubicación solo se pide cuando el usuario lo solicita**, nunca al abrir—; `/explora/:id` con atributos tipados, opiniones e incidencias destacadas. La ficha **cierra el círculo con el marketplace**: enlaza los servicios de Doogking en esa ciudad, que es la razón de negocio del módulo. Nueva sección "Explora con tu mascota" en la home y carrusel "Descubre experiencias cerca de ti" bajo los resultados de búsqueda, que **se oculta entero si no hay nada que enseñar**.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (623 kB) · **444/444 tests de backend** y **199/199 de frontend** en verde (30 nuevos).

#### Pendiente de la Ola 6 — requiere decisión

**DK-C06, planificador de viajes con IA.** Sigue bloqueado por §6.0. Hacen falta cuatro decisiones antes de escribir código:
1. **Proveedor de LLM** — por defecto reutilizar el de `core/ai-search` (DeepSeek), o cambiar.
2. **Fuente de itinerarios** — ¿solo datos propios (`lugares` + servicios de Doogking) o fuentes externas?
3. **Nivel de personalización** — perfil del perro, presupuesto, duración.
4. **Coste por generación** y límite de uso por usuario.

Todo lo demás está listo para recibirlo: el planificador solo tendrá que leer de `lugares` y volcar sus resultados con `POST /carrito/items`.

### Ola 7 — ✅ completada 2026-07-25

Historias cerradas: **DK-S01, S02, S03, S04, S05**.

**El patrón de extensibilidad, verificado.** `VerticalKey.SEGUROS` + `apps/api/src/verticals/seguros/` con discriminador, estrategia y auto-registro en el `AvailabilityRegistry`. **El core no se ha modificado para añadirlo** — solo se han declarado los campos del vertical en las listas de `catalog.service.ts` y el discriminador en `catalog.module.ts`, que es exactamente el punto de extensión previsto en §3.3 de `CLAUDE.md`. Es la prueba de que añadir un vertical no obliga a tocar el núcleo.

**`checkAvailability` significa elegibilidad, no calendario** (HU-039). La misma interfaz del core con otra semántica: evalúa edad, peso, raza, PPP y vacunación contra las condiciones de admisión de la póliza. Devuelve **el primer motivo de rechazo**, no una lista: al cliente le sirve más saber qué corregir que recibir un muro de incumplimientos. Y cuando la póliza lo permite, **cubre con recargo en vez de rechazar**.

**Pólizas en colección propia** (`polizas`), no dentro de `reservas`: una reserva se presta en una fecha; una póliza tiene vigencia, renovación, carencias y franquicia — otro ciclo de vida. Nace `pendiente_validacion` porque el precio mostrado es **orientativo** hasta que la aseguradora revisa los datos (HU-040), y se guarda un `perroSnapshot` con la declaración de veracidad fechada, que es lo que sostiene la reclamación si más tarde hubo omisiones.

**Índice de Bienestar Doogking** (HU-041) en `core/perros/bienestar.service.ts`: cuatro ejes (vacunas 35, revisiones 25, peso 20, prevención 20) que dan una puntuación 0–100 y un descuento **por tramos** (5/10/15 %), no continuo, para que sea explicable al cliente. Cada eje devuelve **qué haría subirlo**, no solo una nota. Dos decisiones deliberadas: sin peso registrado se da media puntuación y se pide el dato, en vez de penalizar a ciegas; y las revisiones decaen progresivamente entre el año y los dos años, no de golpe.

**Recomendador de seguro** que ordena por prima **ya con el descuento aplicado** —mostrar primas antes del bonus-malus daría un orden que no es el que el cliente va a pagar— y **no oculta lo no elegible**: lo manda al final con su motivo, porque saber por qué una póliza no encaja es información útil.

**Frontend.** Entrada en `verticales.config.ts` con icono propio, ruta `/seguros` reutilizando `vertical-browse`, y bloque completo en el formulario de comercio: coberturas por casillas, prima, vigencia y condiciones de admisión. En el formulario los porcentajes son enteros y en el modelo fracciones; la conversión está aislada en la (de)serialización.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (625 kB) · **473/473 tests de backend** y **200/200 de frontend** en verde (29 nuevos).

#### Nota de negocio

El vertical está **operativo pero vacío**: falta dar de alta al menos una aseguradora partner con pólizas reales. Hasta entonces `/seguros` mostrará el estado vacío. La comisión por defecto de Seguros cae en `COMISION_PCT_DEFAULT` (15 %) mientras el admin no configure una propia en `comision_configs`.

### Ola 8 — ✅ completada 2026-07-25

Historias cerradas: **DK-N01, N02, N03**.

**`ComisionResolverService`: una sola fuente de verdad.** Antes de esta ola la jerarquía de comisiones estaba repartida entre el repositorio de configuración y `BookingsService`. Con la llegada de los tramos y de los socios fundadores, mantenerla dispersa habría hecho que **el importe cobrado y el reportado dejaran de coincidir**. Ahora está entera y en orden: socio fundador → override del comercio → tramo por importe → vertical → defecto. Cada resolución devuelve además su `origen`, que se guarda en la reserva (`comisionOrigen`) para poder explicar cualquier comisión sin recalcularla.

**Comisión por tramos (DK-N01).** `ComisionConfig.tramos[]`, opcional: **vacío = comportamiento anterior**, así que activarlos no rompe ninguna liquidación existente. Valores del plan: <30 € → 8 %, 30–100 € → 10 %, 100–300 € → 12 %, resto → 15 %. Los límites son inclusivos y los tramos se ordenan solos aunque lleguen desordenados.

**Socios Fundadores (DK-N02).** `socioFundador`, `comisionPctCongelada`, `congelacionHasta` (24 meses por defecto) y `cohorte` —calculada por trimestre (`2026-Q3`)— como dimensión del reporte financiero. Endpoint `PATCH /comercios/:id/socio-fundador` solo para admin. **Una congelación vencida deja de aplicarse sola** y el comercio vuelve a la tarifa vigente, que es el trato acordado; al dar de baja se borran los campos en vez de dejarlos a null, para que no puedan reactivarse por error.

**Cuidadores a domicilio (DK-N03).** Alta ligera sobre el patrón existente: `VerticalKey.CUIDADORES` con discriminador propio y estrategia de cupos diarios reutilizando el patrón ya probado en adiestramiento. Tres modalidades (visita, día completo, noche) con su precio, tamaños admitidos, PPP, administración de medicación y radio de desplazamiento. **Paseadores queda fuera de alcance**, como indica HU-048, y hay un test que lo fija.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (626 kB) · **488/488 tests de backend** y **201/201 de frontend** en verde (24 nuevos).

#### Corrección de fondo aplicada de paso

`PaymentsService.calcularDesglose` **recalculaba la comisión con la tarifa vigente** en lugar de usar la pactada al crear la reserva. Sin tramos ni congelaciones daba el mismo número y pasaba inadvertido; con la Ola 8 habría cobrado a un socio fundador la tarifa nueva en cuanto la plataforma la subiera. Ahora usa `reserva.comisionMonto`, con un test que lo fija.

### Ola 10 — ✅ completada 2026-07-26

Historias cerradas: **DK-G01, G02, G03, G04, G05 · DK-M09** (pendiente desde la Ola 2, que esperaba precisamente esta colección de eventos).

**Motor de eventos.** Nueva colección `eventos`, alimentada por el frontend (marcas de tiempo del embudo) y el backend (confirmaciones, servicios completados). **No guarda datos personales más allá de identificadores**, así que puede purgarse: TTL de 180 días, porque es telemetría, no contabilidad.

**DK-M09 cerrado: la meta de los 30 segundos ya es verificable.** El cronómetro arranca al buscar, marca cada paso del wizard y se cierra al confirmar el pago. `GET /eventos/metricas/embudo` devuelve el porcentaje bajo 30 s y la **mediana** —no la media: un usuario que dejó la pestaña abierta media hora no puede falsear el dato—. La instrumentación nunca bloquea: si el envío falla se pierde una traza, no una venta.

**Solicitud automática de reseñas (DK-G01, G02).** Colección `solicitudes_valoracion` con índice único por reserva, así que **repetir la tanda no reenvía nada**. Enlace único por correo a `/valorar/:token`: el usuario llega desde su bandeja, puntúa y envía sin buscar qué reserva era. Un solo recordatorio a los 3 días, y publicar la reseña **cierra la solicitud** para que ese recordatorio no llegue a quien ya valoró. Exclusiones aplicadas: cancelada, reembolsada, en disputa y no-show. Panel de seguimiento con envíos, aperturas, completadas y tasa de conversión.

**Detección de abandonos (DK-G03, G04).** Agregación por sesión que descarta lo confirmado y lo ya avisado — **perseguir a quien sí reservó es la forma más rápida de acabar en la carpeta de spam**. Solo cuenta como abandono lo que llegó a iniciar una reserva: mirar un listado y marcharse es navegar, no abandonar. El aviso exige `aceptaMarketing`: **sin consentimiento no hay envío**, por mucho que el abandono esté detectado (RGPD). Los correos transaccionales no dependen de ese flag.

**Campañas y atribución del descuento (DK-G05).** `Cupon.asumeDescuento` (plataforma o comercio) —el dato que separa un coste de la plataforma de una promoción del negocio; sin él el margen del reporte sería falso—, más `campanaId`, `soloPrimeraReserva` y `cohorte`. Nueva colección `campanas` con canales, vigencia y envíos. `Usuario.aceptaMarketing` con su fecha de consentimiento.

#### Decisión de arquitectura: las tandas se disparan desde fuera

No hay temporizador en proceso. Las tandas son endpoints de admin (`POST /eventos/tandas/…`) que invoca el cron de la plataforma. **Con más de una instancia del API, un `setInterval` enviaría el mismo correo una vez por instancia**; un disparador externo se ejecuta una sola vez. Añade además la ventaja de poder relanzar una tanda a mano.

Cron sugerido en Coolify: valoraciones cada hora, recordatorios una vez al día, abandonos cada 6 horas.

**Verificación:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (626 kB) · **517/517 tests de backend** y **208/208 de frontend** en verde (49 nuevos). Nueva variable `APP_URL` documentada en `.env.example`.

#### Pendiente de la Ola 10

- **Tracking de aperturas real**: hoy la apertura se marca cuando el usuario pulsa el enlace, no con el píxel del proveedor de correo. Cerrar el hueco exige webhooks del proveedor (entrega, apertura, rebote), que dependen de contratar uno.
- **Push (DK-G04, canal móvil)**: el aviso de abandono sale por email e in-app. El push necesita Capacitor + FCM/APNs, que es la historia M2 de `CLAUDE.md` y trabajo de la fase móvil.
- **Panel de campañas en el admin**: el modelo está completo; falta la pantalla de gestión.

### Ola 6 — ✅ cerrada 2026-07-26 · DK-C06 completado

**§6.0 resuelto por decisión propia**, con las cuatro respuestas que el plan ya proponía y que el cliente confirmó al pedir seguir adelante:

1. **Proveedor**: se reutiliza el de `core/ai-search` (DeepSeek). Ni dependencia ni clave nuevas.
2. **Fuente de datos**: **solo datos propios** — lugares moderados y servicios publicados de la provincia. El modelo redacta y ordena; **no inventa**. Las paradas cuyo identificador no exista en el catálogo sobreviven como texto pero **pierden el botón de reservar**: no se puede ofrecer algo que no está.
3. **Personalización**: provincia, fechas, presupuesto, intereses y perfil del perro (un perro que se marea no hace rutas largas).
4. **Coste**: caché de 7 días por provincia + mes + presupuesto, y tope de 10 generaciones por usuario y día.

**Sin clave configurada no da error: arma el itinerario con los datos propios** y lo etiqueta como tal. Nueva pantalla `/explora/planificador` con rejilla de provincias, formulario y resultados; cada parada reservable tiene **"Añadir al viaje"** que vuelca al carrito de la Ola 5 — el enlace que convierte el plan en reservas.

> **Corrección de seguridad aplicada de paso:** `POST /carrito/items` exigía `comercioId` del cliente. Ahora **se deduce del propio servicio**: la aplicación no debe fiarse de quien llama para saber a qué comercio pertenece un servicio.

### Ola 9 — ✅ completada 2026-07-26

Historias cerradas: **DK-A01, A02, A03** (DK-A04 se adelantó a la Ola 5).

**Conectores tras una interfaz (§18-I, §18-D).** `CalendarConnector` con implementaciones de Google Calendar y Microsoft Graph, inyectadas como **lista tras un token de DI**: añadir un proveedor —o un CRM mañana— es registrarlo en el módulo, sin tocar `AgendaService`. Ambos conectores se declaran "no configurados" si faltan sus credenciales, y **la agenda sigue funcionando entera**: jornadas, bloqueos y huecos no dependen de la nube.

**Agendas por trabajador y recursos reservables (DK-A02).** `agendas` (una por trabajador, o general del comercio) y `recursos` (habitaciones, vehículos, mesas). Un comercio no es una sola disponibilidad: dos peluqueros del mismo salón atienden en paralelo y un cupo único no puede representarlo.

**Reglas de agenda (DK-A03).** Jornada por franjas —**varias el mismo día = jornada partida**—, margen entre citas y zona horaria IANA. El margen se aplica **después** de cada cita, no antes: aplicarlo antes bloquearía el primer hueco de la jornada sin motivo.

**Sincronización bidireccional (DK-A01).** Flujo OAuth completo con `state` firmado (el callback lo invoca el proveedor, no el frontend, así que no puede exigir sesión), refresco automático del acceso caducado y reconciliación por `externalEventId`: **lo que desaparece del proveedor se borra aquí**, porque una cita cancelada fuera no puede seguir bloqueando la agenda para siempre. Política de conflicto: **el bloqueo más restrictivo gana**. Los tokens llevan `select: false`, así que nunca salen en una respuesta.

Credenciales documentadas en `.env.example` (Google Cloud y Azure), con las URIs de redirección exactas.

**Verificación de ambas olas:** `tsc` limpio en shared, api y web (incluidos specs) · `nest build` y `ng build --configuration production` correctos (626 kB) · **548/548 tests de backend** y **208/208 de frontend** en verde (31 nuevos).

---

## Estado final del plan

**Las 10 olas están completas.** Las 74 historias unificadas quedan cerradas, salvo la deuda declarada más abajo.

| Ola | Estado |
|---|---|
| 1 · Marca y copy | ✅ |
| 2 · Buscador y embudo | ✅ |
| 3 · Cabecera, geo y soporte | ✅ |
| 4 · Cierre Fase C y privacidad | ✅ |
| 5 · Carrito y "Mi viaje" | ✅ |
| 6 · Comunidad y planificador | ✅ |
| 7 · Seguros | ✅ |
| 8 · Comisiones y fundadores | ✅ |
| 9 · Agenda | ✅ |
| 10 · Valoraciones y marketing | ✅ |

### Deuda declarada — estado tras la tanda de saneamiento

| Qué | Estado |
|---|---|
| **Cobertura de tests del frontend** | ✅ **Resuelta.** De 24 % a **84,01 % sentencias / 80,57 % ramas / 80,53 % funciones / 85,62 % líneas** en `apps/web`; el umbral global del 80 % se cumple en las cuatro métricas. 876 tests en 71 suites. |
| **Tracking de aperturas de correo** | ✅ **Resuelta** con píxel propio (`GET /eventos/valoracion/:token/pixel.gif`); no hace falta contratar proveedor. |
| **Panel de campañas en el admin** | ✅ **Resuelta**: backend + pantalla `/admin/campanas` + entrada de navegación. |
| **`favicon.png` de 1.7 MB** | ✅ **Resuelta**: eliminado tras comprobar que no se referenciaba. |
| **Push móvil** | 🟡 **Parcial.** Backend listo (alta de dispositivo + envío FCM + integración con recuperación de abandonos). Falta la capa nativa Capacitor/APNs, que pertenece a la fase móvil. |
| **Idioma** (fase 2 de DK-H03) | ✅ **Tubería resuelta.** `bun run --cwd apps/web i18n:extract` genera `src/locale/messages.xlf`; `bun run --cwd apps/web build:en` produce `dist/web-en` con los textos traducidos. Queda el trabajo de contenido: marcar con `i18n` el resto de literales y traducirlos. |

**Dos defectos reales encontrados al escribir los tests** (ambos corregidos):

1. **Resumen de precio congelado en el wizard de reserva.** `subtotal`, `total`, `paso1Valido` y `lineaResumen` son `computed()` que leen `FormGroup.value`, que no es una señal: al cambiar fechas o extras el importe mostrado no se recalculaba. Corregido con una señal de revisión alimentada por `valueChanges`.
2. **Vista previa del avatar obsoleta en el perfil.** Mismo patrón: `avatarPreview` leía el `FormControl` de la imagen subida sin reactividad, así que tras subir una foto seguía viéndose la anterior. Corregido con `toSignal(valueChanges)`.

**Ajuste de infraestructura de tests:** `setup-jest.ts` registra el locale `es` (`registerLocaleData`); sin él, cualquier plantilla con `| date:…:'es'` lanzaba NG0701 en los tests aunque funcionara en la aplicación.

**Causa del bloqueo de i18n (resuelta):** `@angular/localize` estaba declarado como `^20.3.26`, pero esa versión exige por *peer dependency* `@angular/compiler-cli` **exactamente** 20.3.26, mientras el resto del monorepo está en 20.3.25. npm no podía izarlo a la raíz —donde el CLI lo busca— y lo dejaba anidado en `apps/web/node_modules`; instalarlo en la raíz daba ERESOLVE. Al fijarlo a `20.3.25`, la misma versión que sus paquetes hermanos, se iza correctamente y la extracción funciona.

**Flujo de traducción, para cuando toque el contenido:**

1. Marcar los literales con el atributo `i18n` (con id propio: `i18n="@@home.heroSubtitulo"`).
2. `bun run --cwd apps/web i18n:extract` → actualiza `src/locale/messages.xlf`.
3. Copiar las unidades nuevas a `src/locale/messages.en.xlf` y rellenar sus `<target>`.
4. `bun run --cwd apps/web build:en` → `dist/web-en`, listo para servir bajo `/en` en Netlify.

### Requisitos externos para poner en producción

Nada de esto es código: son datos y credenciales que dependen del negocio.

1. **Aseguradora partner** con pólizas reales — sin ella `/seguros` muestra el estado vacío.
2. **`GOOGLE_MAPS_API_KEY`** — autocompletado de población y distancias de transporte.
3. **`GOOGLE_CALENDAR_*` y `MICROSOFT_CALENDAR_*`** — sincronización de agenda.
4. **`DEEPSEEK_API_KEY`** — búsqueda con IA y planificador (ambos degradan sin ella).
5. **SMTP** — todos los correos transaccionales y de crecimiento.
6. **Cron en Coolify** para las tandas de crecimiento: valoraciones cada hora, recordatorios diarios, abandonos cada 6 h.
7. **Migración de servicios clínicos** (`bun run --cwd apps/api migrar:servicios-clinicos`), primero en simulación y luego con `--aplicar`.
