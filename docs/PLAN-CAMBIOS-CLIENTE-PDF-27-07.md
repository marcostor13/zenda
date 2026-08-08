# Plan — `docs/doogking-cambios-cliente-27-07-2026 (1).pdf`

## ✅ Estado: olas A, B, C y D implementadas (08/08/2026)

Las 4 olas están hechas y verificadas: **619 tests API + 1224 tests frontend en
verde**, `tsc` (api+web), `nest build` y `ng build` limpios.

| Ola | Entregado |
|---|---|
| **A** | Los 3 valores del §4 con sus textos aprobados (y 2 iconos nuevos: `trust-rapidez`, `trust-atencion`) · título/subtítulo de §5 · tarjeta "Todo para tu mascota en un solo lugar" (§6) · eyebrow "PARA PROFESIONALES" a `--f-sm` (§10) · **marco dorado tipo Booking en el buscador** en sus dos variantes (§1) · "Registra tu empresa" con peso de botón e idioma/moneda atenuados (§1) · logo pequeño fuera de la home vía `[soloMarcaD]` (§1, decisión **D-1** resuelta por la opción A) |
| **B** | Flecha de categoría → botón circular dorado al hover (§5) · **carrusel de ciudades** con flechas, `scroll-snap`, rueda y gesto (§7) · **Recomendados con datos reales del catálogo** + corazón de favorito + enlace a ficha (§8) · CTAs "Ver lugares cercanos"/"Planificar mi viaje con IA" integrados en la sección (§9) · pasos ①──②──③ conectados con línea y números a 42px (§10) · beneficios y cierre aspiracional del bloque de captación (§10) · huecos de fotografía con placeholder (§6/§10, pendiente **D-3**) |
| **C** | `RsRangeSliderComponent` (doble asa + histograma, teclado accesible) · **facetas en el backend** con `$facet` (`GET /catalog/facetas`): histograma de precios por `$bucketAuto` y contadores por amenity y valoración · `RsMapaComponent` con Leaflet+OSM cargado con `import()` dinámico · miniatura de mapa sobre los filtros con "Ver en el mapa" · pines con precio que resaltan su tarjeta · **el mismo componente reutilizado en Explora**, cerrando el mapa de Comunidad pendiente de `ANALISIS-ESPECIFICACIONES` §4.2 |
| **D** | Políticas en acordeón `details/summary` con los 4 grupos del cliente (§13) · **"Índice Doogking"** nombrado sobre las medias reales por aspecto (§13) · "Invitar a un amigo" con Web Share + portapapeles (§16) · "Recomendados para ti" en Favoritos según categoría y ciudad más guardadas (§19) · selector **"¿Qué problema quieres resolver?"** que reordena adiestradores por especialidad declarada (§13) |

### Decisiones tomadas al implementar

- **D-1 (logo duplicado):** se aplicó la opción A recomendada — la home pasa
  `[soloMarcaD]="true"` al navbar, así que el logotipo completo solo vive en el
  hero y la barra conserva la "D" siempre visible, patrón Booking.
- **D-2 (mapas):** **Leaflet + OpenStreetMap**. Va en un chunk lazy (`import()`
  dinámico), de modo que el bundle inicial solo crece 11 kB —el CSS— y quien no
  abre el mapa no descarga la librería.
- **D-3 (fotografía):** maquetado con placeholder y un `TODO(D-3)` en el código;
  sustituir la foto es cambiar una ruta en `bandaPorQue` / `fotoProfesional`.
- **"Índice Doogking":** no se inventaron dimensiones nuevas (Sociabilidad,
  Tranquilidad…). Se nombró como tal el desglose que ya se calcula a partir de
  los aspectos reales de las reseñas — pintar barras sin datos detrás habría
  sido inventar puntuaciones.

### Dos hallazgos durante la implementación

1. **`alojamiento-lista` no limpiaba su suscripción a `queryParams`** (a
   diferencia de `transporte-lista`): se añadió `takeUntilDestroyed`.
2. **Los "Alojamientos recomendados" de la home eran datos estáticos.** Ahora
   salen del catálogo ordenado por valoración; el escaparate fijo queda solo
   como fallback y, al no tener `id` real, esas tarjetas no muestran corazón.

### Sigue pendiente (mismo motivo que antes)

"La experiencia de tu perro" (día típico), vídeos en galería y centro de ayuda,
carrusel de fotos por tarjeta e insignias emocionales: todas necesitan datos o
infraestructura que no existe (campo configurable por alojamiento, subida de
vídeo, atributos declarados por el comercio). Ver **D-4** y "Fuera de alcance".

---

> **Origen:** PDF de 21 páginas generado a partir del chat "MVP 2026" del 27/07/2026.
> 24 áreas · 145 cambios · 10 capturas + 1 vídeo del cliente.
> **Fecha del análisis:** 07/08/2026 · Auditoría hecha sobre el código, no sobre el PDF.

---

## 0. Qué es este documento y en qué se diferencia de lo ya hecho

El PDF **es el mismo feedback del 27/07** que ya está recogido en
`docs/new-changes-27-07.md` y ejecutado en las 13 fases de
`docs/PLAN-NEW-CHANGES-27-07.md`. No es un encargo nuevo: es la misma revisión
**reorganizada en 24 áreas y con las capturas originales de WhatsApp adjuntas**.

Eso lo hace valioso por dos motivos concretos:

1. **Aporta el material visual** que el `.md` no tenía: 9 capturas + 1 vídeo con
   anotaciones a mano del cliente (círculos verdes) señalando exactamente qué
   mirar. Eso desambigua varios puntos que en el `.md` eran texto suelto.
2. **Contiene un bloque nuevo (§1 "Marca e identidad") y una petición nueva
   (§3 "mapa + filtro de presupuesto")** que no aparecen en el `.md`.

La mayoría de los 145 puntos ya están implementados. Este plan cubre **sólo lo
que falta**, verificado fichero a fichero.

### Lo que el PDF añade respecto al `.md`

| Nuevo | Dónde | Origen |
|---|---|---|
| Bloque completo "Marca e identidad" (logo duplicado, favicon, marco amarillo, cabecera tipo Booking) | §1 | Capturas `WA0005` y `WA0006` |
| **Mapa de resultados + filtro de presupuesto con slider** | §3 | Captura `WA0009` — "Algo así nos falta" |
| Título/subtítulo nuevos de "Explora todos nuestros servicios" | §5 | Captura `WA0011` |
| Texto de tarjeta "Miles de servicios en un solo lugar" → "Todo para tu mascota en un solo lugar" | §6 | Captura `WA0010` |
| "PARA PROFESIONALES" un pelín más grande | §10 | Captura `WA0004` |

---

## 1. Lectura de las capturas del cliente

Las anotaciones a mano (círculo verde) marcan el punto exacto:

| Captura | Qué señala el círculo | Cita del cliente |
|---|---|---|
| `WA0006` | La pestaña del navegador, sin la "D" | *"Aquí faltaría añadir el D que hablamos"* |
| `WA0005` | La barra de categorías de Booking + botones de cuenta a la derecha | *"Quizás así. ¿Tú crees que se pueda hacer?"* |
| `WA0014` | La fila de iconos de categoría del buscador del hero | *"Aumentar el tamaño del icono seleccionado, fondo más claro, borde amarillo más grueso y una pequeña sombra"* |
| `WA0013` | El label "¿Qué servicio necesitas?" | *"Cambiar … por «¿Qué necesita tu mascota?»"* |
| `VID0008` | Vídeo de una web donde las tarjetas cambian de color al pasar el cursor | *"Cuando pones el cursor encima cambia de color. Algo así estaría bien"* |
| `WA0009` | **La columna izquierda de Booking**: miniatura de mapa con botón "Ver en el mapa", "Tu presupuesto (por noche)" con slider €10–€300+, y "Filtros populares" con contadores (707, 514…) | *"Algo así nos falta"* |
| `WA0011` | La cabecera de la sección de categorías | *"Todo lo que tu mascota necesita, en un solo lugar."* |
| `WA0010` | La tarjeta "Miles de servicios en un solo lugar" | *"Todo para tu mascota en un solo lugar"* |
| `WA0004` | El bloque azul de captación de empresas + footer | *"Esta parte me gusta, la combinación de colores súper chula; el texto de «para profesionales» un pelín más grande"* |
| `WA0007` | El listado de alojamiento en su layout de fila horizontal | *"Aquí la estructura nos gustaría que esté de la siguiente forma"* |

> **Nota:** `WA0007` y `WA0014` muestran el estado **anterior** de la plataforma
> (listado en fila horizontal, hero con "TODO PARA TU REY"). Ambos ya se
> rehicieron en las fases 2 y 3. Las capturas documentan el punto de partida, no
> una petición pendiente.

---

## 1b. Especificación visual derivada de las capturas (revisión a resolución completa)

Criterios de aceptación extraídos de las imágenes a 2048px — esto es lo que el
cliente **ve** en su referencia, no solo lo que el texto dice:

### `WA0005` — Cabecera de Booking (referencia para §1)
Lo que el círculo verde abarca, elemento a elemento:
- **Fila 1:** logo a la izquierda; a la derecha, en este orden: moneda (EUR),
  bandera de idioma, icono "?", enlace de texto "Registra tu alojamiento" y
  **dos botones blancos con texto azul**: "Hazte una cuenta" / "Inicia sesión".
  → En Doogking: "Registra tu empresa" como enlace + "Mi cuenta" como **botón
  blanco sobre el azul** (hoy es un botón azul sobre azul); idioma y moneda como
  texto plano sin botón.
- **Fila 2:** categorías como **pills con icono + texto**; la activa lleva
  **borde blanco redondeado completo** (pill contorneada), no subrayado.
- **Barra de búsqueda:** el famoso **marco amarillo de Booking** — cada segmento
  (destino / fechas / ocupación) es una celda blanca dentro de un marco amarillo
  continuo de ~3px, con el botón azul "Buscar" pegado al final.
  → Esto es el "aplicar bordes tipo marco amarillo en las zonas indicadas" de
  §1: **el marco va en el buscador**, tanto en el hero como en la variante
  sticky de los listados (en la captura `WA0009` se ve que Booking lo mantiene
  también en la página de resultados).

### `WA0006` — Favicon (§1) · ✅ ya cumplido
La captura muestra que en su momento la pestaña tenía un icono circular de
huella/corona; el cliente pedía la "D". El `favicon.svg` actual es exactamente
eso (D dorada sobre azul real). **Nada pendiente.**

### `WA0014` / `WA0013` — Selector de categorías y labels (§2) · ✅ ya cumplido
El tratamiento actual de la categoría activa (borde dorado 2px, fondo claro,
sombra, icono a 1.12×) cumple lo pedido. Los labels ya están cambiados.

### `WA0009` — Mapa + filtros de Booking (§3) — detalles que el texto no recogía
- La miniatura del mapa va **arriba de la columna de filtros**, con un botón
  azul "📍 Ver en el mapa" superpuesto sobre un mapa estático.
- El filtro de presupuesto lleva **histograma de distribución de precios**
  (barras grises) encima de un **slider de doble asa**; etiqueta
  "€ 10 – € 300+".
- "Filtros populares" = checkboxes con **contador a la derecha de cada opción**
  (Centro de Madrid **707**, Parking **514**…).
- Sobre el listado: recuento total ("1.492 alojamientos encontrados") — esto ya
  lo tenemos — y una línea de urgencia ("Un 76 % de los alojamientos no están
  disponibles en esas fechas") — **no** replicar sin dato real.

### `WA0011` — Sección de servicios (§5)
El círculo abarca título + subtítulo + primera tarjeta. Cambiar ambos textos;
la flecha de las tarjetas es hoy un `→` suelto → botón circular `○→` con hover
dorado.

### `WA0010` — Tarjeta "¿Por qué Doogking?" (§6)
La tarjeta del icono de globo: título → "Todo para tu mascota en un solo lugar"
y la descripción debe **enumerar todos los servicios** (hoy omite hoteles,
seguros y cuidadores).

### `WA0004` — Captación de empresas (§10)
El cliente **valida el diseño** ("la combinación de colores súper chula").
Único cambio: el eyebrow "PARA PROFESIONALES" un poco más grande. **No
rediseñar este bloque** — solo añadir lo que pide el texto del PDF (línea entre
pasos, foto, beneficios) sin tocar la combinación de colores aprobada.

### `WA0007` — Listado de alojamiento (§12) · ✅ ya rehecho en Fase 3
Documenta el layout antiguo de fila horizontal, ya sustituido por el grid.

---

## 2. Estado por área (auditoría sobre código)

| # | Área | Estado |
|---|---|---|
| 1 | Marca e identidad | ⚠️ Favicon con "D" ✅ hecho · resto pendiente |
| 2 | Hero y buscador | ⚠️ Titular, labels y selector ✅ · **franja de confianza con copy viejo ❌** · marco dorado del buscador ❌ |
| 3 | Microinteracciones y efectos | ⚠️ Hover/transiciones ✅ · **mapa + slider ❌** |
| 4 | Bloque de 3 valores | ❌ **Los 3 textos aprobados siguen sin aplicar** (hoy: "Reserva segura y garantizada" / "Tu mascota, nuestra prioridad") |
| 5 | "Explora todos nuestros servicios" | ⚠️ Copys de categoría ✅ · título/subtítulo y flecha circular ❌ |
| 6 | "¿Por qué Doogking?" | ⚠️ Texto de tarjeta y banda fotográfica ❌ |
| 7 | "Servicios cerca de ti" (Ciudades) | ⚠️ Tarjetas ✅ · **carrusel ❌** · dato dinámico ❌ |
| 8 | "Recomendados" | ⚠️ Tarjeta unificada ✅ · botón ❤️ al hover ❌ |
| 9 | "Explora con tu mascota" | ⚠️ Copys ✅ · botones y CTA de IA integrado ❌ |
| 10 | "Cómo funciona" + captación | ⚠️ Línea conectora, foto y tamaño del eyebrow ❌ |
| 11 | Footer | ✅ Completo |
| 12 | Listados unificados | ✅ Completo (ver §3 para mapa/slider) |
| 13 | Fichas de detalle | ⚠️ Galería, compromiso y compatibilidad ✅ · 4 puntos ❌ |
| 14 | Flujos de reserva | ✅ Completo |
| 15 | Registro empresas + email | ✅ Completo |
| 16 | Área de cliente | ⚠️ Todo ✅ salvo "Invitar a un amigo" |
| 17 | Ficha Inteligente | ✅ Completo |
| 18 | Mis reservas | ✅ Completo |
| 19 | Favoritos | ⚠️ Todo ✅ salvo "Recomendados para ti" |
| 20 | Mis reseñas | ✅ Completo |
| 21 | Menú "Mi cuenta" | ✅ Completo |
| 22 | Doogking Alpha | ✅ Completo |
| 23 | Centro de ayuda | ⚠️ Todo ✅ salvo vídeos cortos |
| 24 | Correcciones críticas | ✅ Ambas resueltas |

**Resumen: 10 áreas cerradas, 14 con trabajo pendiente, 23 puntos concretos que
implementar.**

> ⚠️ La primera pasada de auditoría (por texto) daba §2 y §4 por completos; la
> revisión de las capturas a resolución completa destapó que la **franja de
> confianza** bajo el buscador conserva el copy antiguo y que el **marco dorado
> del buscador** (lo más reconocible de la referencia Booking) no existe. Moraleja
> repetida: verificar contra lo que se ve, no contra un grep de una palabra.

---

## 3. Decisiones que necesito del cliente antes de tocar código

Estos cuatro puntos no los puedo resolver solo: cambian el resultado según la
respuesta y prefiero preguntarlos a asumirlos.

### D-1 · ¿Qué logo se elimina exactamente? (§1)
El cliente dice *"eliminar el logo pequeño donde aparece duplicado (ya sale en
grande)"*. Hoy conviven el logo grande del hero (`hero__logo`) y el de la barra
superior (`rs-navbar__mark` + `rs-navbar__wordmark`), que sigue el patrón de
Booking (marca siempre visible al hacer scroll).

- **Opción A** — quitar el logotipo del hero y dejar solo el de la barra. Encaja
  con §2 ("el buscador debe ser el protagonista, reducir el espacio"): se gana
  altura y el buscador sube.
- **Opción B** — quitar el wordmark de la barra sólo en la home.

**Recomiendo A**: resuelve el duplicado *y* el punto de §2 a la vez, y mantiene
la marca visible en todo momento como en Booking.

### D-2 · Proveedor de mapas (§3)
El mapa es la petición más cara del PDF y necesita decidir proveedor:

- **Leaflet + OpenStreetMap** — sin coste, sin clave de API, sin límite de
  peticiones. Estética más sobria que Google.
- **Google Maps** — más reconocible y con mejor búsqueda de lugares, pero es de
  pago por carga de mapa y exige clave y facturación activa.

**Recomiendo Leaflet + OSM** para el MVP: el dato de coordenadas ya lo tenemos
(`ubicacion.geo`, con índice `2dsphere`, y `lat`/`lng` ya viajan en la tarjeta),
así que es sólo la capa visual y no añade coste recurrente.

> 🔑 **El mapa tiene un segundo consumidor ya especificado.**
> `ANALISIS-ESPECIFICACIONES.md` §4.2 pide un **mapa interactivo** para el módulo
> Comunidad ("Explora con tu mascota") — *"Booking + Tripadvisor + Google Maps
> del mundo de las mascotas"*. Ese módulo **ya está construido**
> (`features/explora/`, colección `lugares` con su `2dsphere` y `lat`/`lng` en el
> servicio), pero **el mapa nunca se hizo**.
>
> Es decir: el mapa que pide §3 y el que pide la Comunidad son el mismo
> componente con dos fuentes de datos. Eso cambia dos cosas del plan:
>
> 1. Hay que construirlo como **componente compartido** (`RsMapaComponent` en
>    `shared/`), parametrizado por lista de puntos, no incrustado en el listado
>    de alojamiento.
> 2. Sube el retorno de la inversión de la Ola C: el mismo trabajo cierra una
>    petición del cliente **y** un hueco de la especificación original.
>
> Sobre el proveedor: la especificación de Comunidad menciona "Google Maps /
> Mapbox", pero **sigo recomendando Leaflet + OSM** — el mapa de comunidad es el
> de más volumen de cargas (se entra a explorar sin reservar, que es justo su
> objetivo declarado), y es precisamente ahí donde el coste por carga de Google
> se dispararía.

### D-3 · Fotografía (§6 y §10)
Dos peticiones piden material que no tenemos:
- Banda fotográfica horizontal de "familia disfrutando con su mascota" (§6).
- Foto de un profesional trabajando en el bloque de captación (§10).

**Necesito que el cliente aporte las imágenes** (o autorización para comprar
banco de imágenes). Dejo el maquetado preparado y con un *placeholder* para que
sustituir la foto sea cambiar un fichero.

### D-4 · "La experiencia de tu perro" y vídeos (§13, §23)
- El "día típico" (08:00 patio, 09:00 desayuno…) tiene que **configurarlo cada
  alojamiento**; hoy no existe ese campo. Implica schema + UI en el panel del
  comercio + pintarlo en la ficha.
- Los vídeos (galería del adiestrador y ayuda) necesitan **soporte de subida de
  vídeo**, que hoy no existe: `rs-image-upload` sólo acepta imagen.

**Recomiendo dejar ambos para una fase posterior** y avisar al cliente de que
son features con backend, no retoques visuales.

---

## 4. Plan de ejecución

Cuatro olas, ordenadas por relación impacto/coste. Cada una acaba con
`tsc` + `nest build` + `ng build` + tests en verde, como el resto del proyecto.

---

### 🌊 Ola A — Copys y marca · *~2 h · sin riesgo*

Sólo texto y tamaños. Es lo más barato del PDF y lo que el cliente nota al
instante porque son frases que él mismo escribió.

| Punto | Fichero | Cambio |
|---|---|---|
| §5 | `home.component.ts:154` | Título → **"Todo lo que tu mascota necesita, en un solo lugar."** · Subtítulo → **"Reserva con profesionales verificados cerca de ti, de forma rápida, segura y sin complicaciones."** |
| §6 | `home.component.ts:1166` | `titulo: 'Miles de servicios en un solo lugar'` → **"Todo para tu mascota en un solo lugar"**, con la descripción de todos los servicios |
| §10 | `home.component.ts` (`.pro-cta__eyebrow`) | Subir el tamaño de "PARA PROFESIONALES" un escalón de la escala tipográfica |
| §2/§4 | `home.component.ts:1146-1150` (`garantias`) | **Aplicar los 3 textos aprobados** con sus descripciones: "Reserva en menos de un minuto" · "Profesionales verificados" · "Atención 24/7" (hoy siguen "Reserva segura y garantizada" y "Tu mascota, nuestra prioridad") |
| §6 | `home.component.ts:1166-1167` (`motivos`) | La descripción de la tarjeta debe enumerar **todos** los servicios (hoy omite hoteles, seguros y cuidadores) |
| §1 | `rs-search-bar.component.ts` (`.sb__form`) | **Marco dorado tipo Booking en el buscador**: marco continuo ~3px envolviendo los segmentos blancos, en `variant="card"` (hero) y `variant="strip"` (listados). Es la lectura correcta de "bordes tipo marco amarillo" según `WA0005`/`WA0009` |
| §1 | `rs-navbar.component.ts` | "Mi cuenta" como **botón blanco con texto azul** sobre la barra (patrón Booking); idioma/moneda como texto plano con menos peso |
| §1 | según **D-1** | Resolver el logo duplicado |

⚠️ Los textos de §5 son `i18n` (`@@home.exploraServicios`, `@@home.exploraClaim`):
hay que actualizar también el ID o la traducción, no sólo el literal.

---

### 🌊 Ola B — Refinamientos visuales de la Home · *~1 día · riesgo bajo*

Todo es CSS y microinteracciones sobre secciones que ya existen. Ningún cambio
de datos.

1. **§5 · Flecha → botón circular** — `cat-card__go` pasa de icono suelto a
   botón circular `○→` que se vuelve dorado al hover.
2. **§7 · Carrusel de ciudades** — hoy es un grid estático (`cities-grid`).
   Convertir a carrusel con flechas laterales, scroll con rueda y gesto táctil
   (`scroll-snap` + `scrollBy()`, sin librería).
3. **§7 · Dato dinámico bajo el número** — `⭐ 4,8 valoración media` /
   `🏆 Más reservada este mes` / `🔥 Tendencia`, **sólo en ciudades destacadas y
   sólo si el dato es real**. Requiere que el backend devuelva media y volumen
   por ciudad; si no, se omite (no inventamos cifras).
4. **§8 · Botón ❤️ al hover en Recomendados** — ya existe
   `rs-favorito-btn` y `RsCardComponent` acepta `favoritoServicioId`: es
   conectarlo, no construirlo.
5. **§9 · Botones de la sección Explora** — "Ver lugares cercanos" y
   "Planificar mi viaje", e **integrar el CTA de IA dentro de la sección** (hoy
   está aislado como enlace de cabecera, que es justo lo que el cliente pide
   evitar).
6. **§10 · Pasos conectados** — línea fina entre ① ─── ② ─── ③, números más
   grandes con círculo dorado y hover con zoom del número.
7. **§6/§10 · Huecos de fotografía** — maquetar banda y foto con placeholder
   (ver **D-3**).

---

### 🌊 Ola C — Mapa y filtros tipo Booking · *~3–4 días · la más grande*

Es la petición nueva del PDF (`WA0009`) y la única que añade superficie técnica
real. Se apoya en datos que **ya existen**: `ubicacion.geo` con índice
`2dsphere`, `lat`/`lng` en la tarjeta y el orden por distancia ya implementado.

1. **Slider de presupuesto** — sustituir los dos `input type="number"`
   (`alojamiento-lista.component.ts:72-81`) por un slider de rango doble con
   etiqueta "€ X – € Y+", al estilo de la captura. Componente nuevo
   `RsRangeSliderComponent` en `shared/`, reutilizable por los demás listados.
   La referencia `WA0009` lleva además un **histograma de distribución de
   precios** sobre el slider: hacerlo como mejora opcional del mismo componente
   (las barras salen de la misma faceta de precios del punto 2 — coste marginal
   si las facetas ya existen; si se recorta algo de la ola, recortar esto).
2. **Contadores en los filtros** — cada checkbox con su recuento a la derecha,
   exactamente como en la captura ("Parking **514**"). Necesita que el endpoint
   de búsqueda devuelva **facetas** (recuento por valor de filtro) además de los
   resultados. Es un `$facet` de MongoDB sobre el mismo filtro base.
3. **Vista de mapa** — `RsMapaComponent` compartido (ver **D-2**), parametrizado
   por una lista de puntos. Primer consumidor: el patrón exacto de la captura —
   **miniatura de mapa estático arriba de la columna de filtros** con botón
   "📍 Ver en el mapa" superpuesto, que abre el mapa completo con pines de
   precio; al pulsar un pin, se resalta la tarjeta correspondiente.
4. **Segundo consumidor: mapa de la Comunidad** — reutilizar el mismo componente
   en `explora-lista.component.ts` con los `lugares` en vez de servicios. Cierra
   el hueco de `ANALISIS-ESPECIFICACIONES.md` §4.2. Coste marginal una vez
   construido el punto 3.

> **Alcance:** lo haría **primero sólo en Alojamiento** (el vertical con más
> volumen y el de la captura) y, una vez validado con el cliente, se propaga al
> resto de listados y a la Comunidad. Construir los tres listados a la vez antes
> de que él lo vea es arriesgar trabajo triple.

---

### 🌊 Ola D — Fichas de detalle y cabos sueltos · *~2 días*

1. **§13 · Políticas en acordeón** — hoy son una sección plana
   (`alojamiento-detalle.component.ts:241`). Pasar a `<details>` nativo
   (accesible y sin JS) por Entrada / Salida / Cancelación / Vacunas.
2. **§13 · "Índice Doogking" con barras** — Sociabilidad, Espacio exterior,
   Limpieza, Tranquilidad. **Ojo:** ya existe el *Índice de Bienestar* de la
   **mascota** (`bienestar.service.ts`) y no es lo mismo — esto es un índice del
   **alojamiento**. Hay que decidir de qué dato sale: lo natural es derivarlo de
   las medias por aspecto de las reseñas, que ya calculamos desde la Ola 13
   anterior. Si sale de ahí, es gratis; si el cliente quiere otra cosa, es
   backend nuevo.
3. **§16 · "Invitar a un amigo"** — falta el acceso rápido. Sin sistema de
   referidos, el alcance realista es **compartir un enlace** (Web Share API con
   copia al portapapeles de reserva). Un programa de referidos con recompensa es
   otro proyecto.
4. **§19 · "Recomendados para ti"** en Favoritos — basado en las categorías y
   ciudades de lo que el usuario ya ha guardado. Reutiliza
   `recomendador.service.ts`, que ya existe.
5. **§13 · Adiestrador — selector "¿Qué problema quieres resolver?"** — el
   selector es fácil; lo que no existe es el **criterio de ordenación por
   especialidad**. `tiposAdiestramiento` ya está en el schema, así que se puede
   priorizar por coincidencia. Es la opción honesta: ordenar por especialidad
   declarada, no inventar un ranking.

---

### 🚧 Fuera de alcance de este plan (con motivo)

| Punto | Por qué |
|---|---|
| §13 · "La experiencia de tu perro" (día típico) | Necesita campo configurable por alojamiento: schema + UI de panel + ficha. Es una feature, no un retoque. Ver **D-4** |
| §13 · Galería del adiestrador con vídeos | No hay soporte de subida de vídeo (`rs-image-upload` es sólo imagen) |
| §23 · Vídeos cortos en el centro de ayuda | Mismo motivo + no hay contenido grabado |
| §12 · Carrusel de fotos por tarjeta | El propio PDF lo marca "(futuro)" |
| §8 · Insignias emocionales (🏊 Piscina para perros, 📹 Cámaras en directo) | Requiere que los comercios declaren esos atributos. `camaras24h` existe; el resto no. Se puede hacer parcialmente cuando se decida la lista definitiva |

---

## 5. Orden recomendado

```
Ola A  (copys + marca)          →  cliente ve cambios el mismo día
   ↓
Ola B  (refinamientos Home)     →  la Home queda cerrada
   ↓
   ├─ D-1, D-2, D-3 respondidas por el cliente
   ↓
Ola C  (mapa + slider, sólo Alojamiento)  →  validar con cliente
   ↓
Ola D  (fichas + cabos sueltos)
   ↓
Propagar mapa/slider al resto de verticales
```

**Las olas A y B no dependen de ninguna decisión** y pueden empezar ya. La C
está bloqueada por **D-2** (proveedor de mapas) y la parte fotográfica de la B
por **D-3**.

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| El mapa se convierte en un pozo sin fondo (clustering, rendimiento, sincronía con el listado) | Acotar a Alojamiento y a un MVP: pines con precio + clic que resalta la tarjeta. Sin clustering ni dibujo de área en la primera versión |
| Los datos "dinámicos" (§7 ciudades, §8 insignias) tientan a rellenar con cifras falsas | Regla ya aplicada en todo el proyecto: si el dato no es real, el elemento no se pinta |
| La foto de familia/profesional bloquea la Ola B | Maquetar con placeholder y sustituir cuando llegue el material |
| Confundir "Índice Doogking" (alojamiento) con "Índice de Bienestar" (mascota) | Nombrarlos distinto en UI desde el primer commit, como ya se hizo con "Nivel Alpha" vs "Nivel Doogking" |

---

## 7. Estimación

| Ola | Trabajo | Bloqueada por |
|---|---|---|
| A | ~2 h | — |
| B | ~1 día | D-3 (sólo la parte de fotos) |
| C | ~3–4 días (+½ día el mapa de Comunidad) | **D-2** |
| D | ~2 días | D-4 (parcial) |

**Total ≈ 7–8 días de desarrollo** para los 22 puntos pendientes, sin contar lo
marcado como fuera de alcance. El medio día extra de la Ola C cierra además el
mapa de la Comunidad, que venía pendiente de la especificación original.
