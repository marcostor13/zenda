# Revisión de usuario — Historias de usuario para ejecutar

> **Fuente:** `docs/Revisión usuario .pdf` (feedback directo del cliente sobre la web actual de Doogking).
> **Propósito:** traducir cada punto de la revisión en historias de usuario accionables, agrupadas por área funcional, con prioridad sugerida (**P0** bloqueante de percepción/UX, **P1** importante, **P2** deseable/roadmap). Formato: `Como <rol>, quiero <acción>, para <beneficio>`.
> Los puntos marcados **[ABIERTO]** requieren decisión o aclaración del cliente antes de implementar — no están completamente especificados en el documento fuente.

---

## Épica N — Home / Página principal

- **N1 (P0)** Como **usuario**, quiero ver el titular corregido a "Tu rey" en vez de "Su rey" en la pantalla principal, para que el tono sea cercano y consistente (tuteo) en toda la home.
- **N2 (P0)** Como **usuario**, quiero leer la frase inferior del hero como *"Reserva alojamientos premium, veterinarios de confianza, peluquerías caninas y mucho más…"*, para entender de un vistazo la amplitud de servicios disponibles.
- **N3 (P0)** Como **usuario**, quiero ver un bloque grande y visual **"¿Por qué Doogking.com?"** en la home (inspirado en la estructura de la primera página de Booking), para entender rápido por qué elegir la plataforma frente a alternativas.
  - Sub-bloques sugeridos (ver Épica R — Sugerencias): *Reserva en segundos · Profesionales verificados · Miles de servicios en un solo lugar · Atención cuando la necesites*, cada uno con icono propio.
- **N4 (P0)** Como **usuario**, quiero ver **Seguros** listado como categoría/servicio adicional en la home, para poder contratar seguros para mi perro desde la misma plataforma.
  - Nota: esto implica evaluar si "Seguros" se modela como un vertical nuevo (`VerticalKey`) o como un servicio complementario transversal — definir alcance antes de implementar (ver [[project-doogking]]).
- **N5 (P1)** Como **usuario**, quiero que el título *"Nuestros servicios reales"* se renombre a *"Explora todos nuestros servicios"*, para un tono más invitador y menos ambiguo (evitar la palabra "reales").
- **N6 (P1)** Como **usuario**, quiero ver debajo del bloque de servicios la frase *"Reserva en segundos con los mejores profesionales cerca de ti."*, para reforzar la propuesta de valor de rapidez y cercanía.
- **N7 (P0)** Como **usuario**, quiero un logo con la inicial **"D"** en la cabecera de la app y como favicon (pestaña del navegador / resultados de Google), en lugar de la huella con estrellas actual, para una identidad de marca más clara y reconocible (referencia: Booking usa la letra "B").

---

## Épica O — Nuevos apartados de la Home

- **O1 (P1)** Como **usuario**, quiero un apartado **"Explora con tu mascota"** debajo de "Alojamiento recomendado", con fotos de playas, parques caninos y ríos pet-friendly, para descubrir lugares donde llevar a mi perro además de servicios reservables.
- **O2 (P1)** Como **usuario**, quiero un apartado **"Planificador de viajes rápido y sencillo"** que muestre fotos de distintas provincias y, al entrar, permita que una IA genere un itinerario con varias opciones para viajar con mi perro, para planificar un viaje completo sin salir de Doogking.
  - Referencia de diseño: primera página de Booking o Airbnb.
  - **[ABIERTO]** Alcance técnico del planificador con IA (fuente de datos de itinerarios, proveedor de LLM, nivel de personalización) queda pendiente de definir en una spec aparte antes de estimar (candidato a `/speckit`).

---

## Épica P — Buscadores (todas las páginas)

- **P1 (P0)** Como **usuario**, quiero que el buscador de cualquier página (no solo la home) me permita completar la reserva directamente, sin limitarse a buscar una ciudad o población, para no tener que repetir el proceso de búsqueda en distintas pantallas.
- **P2 (P0)** Como **usuario**, quiero que la búsqueda descarte automáticamente servicios sin disponibilidad y servicios fuera del presupuesto indicado (y cualquier opción que no se adapte a mis criterios), para ver solo resultados reservables y relevantes.
- **P3 (P1)** Como **usuario**, quiero ver un apartado **"Descubre experiencias cerca de ti"** en los resultados de búsqueda, para encontrar servicios y actividades adicionales en mi zona.
- **P4 (P0)** Como **usuario**, quiero que el apartado "Buscar" (botón separado) desaparezca del buscador de alojamiento, ya que pulsar directamente sobre el servicio o la provincia debe llevarme al resultado, para reducir pasos innecesarios.
- **P5 (P0)** Como **usuario**, quiero que la categoría "Alojamiento" se renombre a **"Alojamiento canino"** en el buscador, para no confundirlo con hoteles pet-friendly genéricos.
- **P6 (P1)** Como **usuario**, quiero que al escribir la primera letra de una población el buscador se conecte con Google Maps y me sugiera automáticamente todas las poblaciones que empiecen por esa letra, para encontrar mi ubicación más rápido y sin errores de escritura.
- **P7 (P0)** Como **usuario**, quiero que el selector de fechas muestre claramente **Entrada** y **Salida** cuando corresponda (ver Épica S — Reservas), para elegir el rango correcto sin ambigüedad.
- **P8 (P0)** Como **usuario**, quiero que el selector "Número de perros" no tenga límite fijo y use un botón **+** para añadir tantos perros como necesite, para reservar para grupos grandes sin restricciones artificiales.
- **P9 (P2) [ABIERTO]** Como **usuario**, quiero entender claramente qué significa el desplegable "Cualquier perro" (actualmente asociado a "Maya"), para saber qué estoy seleccionando. *El propio cliente indica que el concepto "no se acaba de entender" — se requiere una reunión de aclaración antes de tocar este componente; no implementar hasta definir el propósito real del desplegable.*
- **P10 (P1)** Como **usuario**, quiero más opciones de filtro en los resultados de búsqueda además de las actuales, para afinar mejor mi búsqueda. *(Alcance de los nuevos filtros pendiente de definir — el cliente lo deja abierto como "pendiente de ampliar".)*
- **P11 (P0)** Como **usuario**, quiero que el filtro "Más reseñas" se sustituya por **"Distancia"** en los resultados de búsqueda (manteniendo precio ascendente/descendente, relevancia, etc.), para priorizar servicios cercanos a mi ubicación.

---

## Épica Q — Contenido específico por vertical

### Transporte
- **Q1 (P0)** Como **usuario**, quiero ver el título grande **"MÁS QUE UN TRANSPORTE"** y el texto **"Su bienestar es el destino más importante."** en la página del vertical de transporte, para reforzar el enfoque en el bienestar del perro durante el traslado.
- **Q2 (P0)** Como **usuario**, quiero que la sección con vehículos acondicionados, conductores, etc. se mantenga con el formato actual, para no perder información ya validada.
- **Q3 (P0)** Como **usuario**, quiero que la distancia del trayecto se calcule automáticamente al indicar dirección de recogida y dirección de destino en la ficha del servicio, para ver el precio estimado sin tener que calcularlo manualmente (requiere integración con API de distancias/mapas, coherente con `tarifaBase + tarifaKm` del esquema `TransporteServicio`).

### Alojamiento
- **Q4 (P1)** Como **usuario**, quiero ver la frase **"Más que un alojamiento. Un lugar donde sentirse como en casa."** en la página del vertical de alojamiento, para reforzar la propuesta emocional del servicio.

### Veterinarios
- **Q5 (P0)** Como **usuario**, quiero ver el título **"VETERINARIOS DE CONFIANZA"** y el subtítulo **"Clínicas veterinarias para tu mascota: vacunación, citas, urgencias 24 h y más."** en la página del vertical de veterinaria, para transmitir confianza y cobertura de servicios.
- **Q6 (P0)** Como **usuario**, quiero que el buscador de veterinaria funcione igual que el resto de verticales (mismos componentes y lógica), para tener una experiencia consistente en toda la plataforma.
- **Q7 (P0)** Como **comercio veterinario**, quiero que la lista de servicios clínicos ofertables elimine **Desparasitación** y añada **Esterilización, Castración, Higiene dental, Consulta general, Urgencia, Vacunación, Microchip y Teleconsulta**, para reflejar el catálogo real de servicios que Doogking permite reservar.
  - Restricción de negocio confirmada: Doogking **no** intermedia reservas de **dermatología** ni **cirugía** — excluir explícitamente del catálogo de `serviciosClinicos[]` en `VeterinariaServicio`.

### Peluquería
- **Q8 (P0)** Como **usuario**, quiero ver el título **"El cuidado que merece"** en lugar de "Peluquería y spa para tu perro", y el texto **"Encuentra y reserva el cuidado ideal para su pelo, su piel y bienestar."**, para un mensaje más cercano.
- **Q9 (P0)** Como **usuario**, quiero que el buscador de peluquería funcione igual que el resto de verticales, para tener una experiencia consistente.
- **Q10 (P0)** Como **usuario**, quiero que al indicar población, día y hora desde la pantalla inicial, se muestren directamente los servicios de peluquería que mejor se adaptan a mi búsqueda, para reservar en el menor número de pasos posible.

---

## Épica R — Cabecera (header) de la web

- **R1 (P0)** Como **comercio potencial**, quiero ver la opción **"REGISTRA TU EMPRESA"** en la cabecera de la web, para encontrar fácilmente el flujo de alta de comercio (historia A3 de `CLAUDE.md`).
- **R2 (P1)** Como **usuario**, quiero un **selector de moneda** en la cabecera, para ver precios en mi divisa preferida (alineado con la sección 9 de `CLAUDE.md` — moneda base EUR, con gancho para expansión futura).
- **R3 (P1)** Como **usuario**, quiero un **selector de país mediante bandera** en la cabecera, para adaptar idioma/región de la plataforma, igual que en Booking.
- **R4 (P0)** Como **usuario**, quiero un **icono de ayuda / atención al cliente** (signo de interrogación) visible en la cabecera, para acceder rápido a soporte cuando lo necesite.

---

## Épica S — Flujo de reserva (fechas y número de perros)

- **S1 (P0)** Como **usuario**, quiero que el campo **"Entrada y salida"** solo aparezca para servicios de tipo **residencia** y **hotel** (alojamiento), para no confundirme en verticales donde no aplica un rango de noches.
- **S2 (P0)** Como **usuario**, quiero que en el resto de servicios (transporte, veterinaria, peluquería, adiestramiento) el formulario de reserva muestre únicamente el campo **"Entrada"** (fecha/hora del servicio), para simplificar el flujo según la lógica de reserva de cada vertical.
- **S3 (P0)** Como **usuario**, quiero que el número de perros en cualquier flujo de reserva nunca esté limitado a 4, usando un botón **+** para añadir tantos perros como necesite, para reservar servicios con grupos grandes de perros.

---

## Épica T — Sugerencias del cliente (roadmap de percepción de marca)

> Estos puntos los marca el propio cliente como **recomendaciones**, no como requisitos cerrados. Priorizar tras validar con negocio/diseño.

- **T1 (P1)** Como **usuario**, quiero que la primera pantalla de Doogking se inspire más fuertemente en la estructura de Booking, para reconocer de inmediato el patrón de buscador y generar confianza desde el primer segundo.
- **T2 (P1)** Como **usuario**, quiero que el bloque **"¿Por qué Doogking?"** sea uno de los más visuales de la home, con iconos y mensajes cortos: *Reserva en segundos · Profesionales verificados · Miles de servicios en un solo lugar · Atención cuando la necesites* (detalle de N3).
- **T3 (P2)** Como **producto**, quiero dar mucho protagonismo al apartado **"Explora con tu mascota"**, para diferenciar a Doogking de la competencia mediante contenido de comunidad/planificación de viajes que ningún competidor ofrece integrado.
- **T4 (P1)** Como **usuario**, quiero poder completar cualquier reserva en **menos de 30 segundos** desde el buscador, para minimizar el abandono del flujo de reserva. *(Meta de producto transversal — debe guiar el diseño de todos los formularios de búsqueda/reserva, no una feature aislada.)*
- **T5 (P1)** Como **usuario**, quiero que la home transmita desde el primer segundo que Doogking es la plataforma para **gestionar toda la vida de mi mascota** (no un simple directorio de servicios), para que la marca tenga identidad propia y no se perciba como "otro Booking para perros".

---

## Resumen de puntos abiertos (requieren decisión antes de implementar)

| # | Punto | Bloqueo |
|---|---|---|
| N4 | Alcance de "Seguros" como categoría | ¿Vertical nuevo (`VerticalKey`) o servicio transversal? |
| O2 | Planificador de viajes con IA | Proveedor de IA, fuente de datos de itinerarios, alcance de personalización |
| P9 | Desplegable "Cualquier perro" / "Maya" | El propio cliente no entiende el concepto actual — aclarar antes de tocar |
| P10 | Nuevos filtros de búsqueda | Lista de filtros a añadir no especificada |

---

## Siguiente paso sugerido

1. Priorizar con el cliente las historias **P0** de esta lista (copy/UX de home, cabecera, buscador de alojamiento, reservas, veterinaria) como primer sprint de ejecución.
2. Resolver los 4 puntos abiertos de la tabla anterior antes de estimar N4, O2 y P9/P10.
3. Usar `/speckit` para las historias que impliquen nueva lógica de negocio (O2 — planificador IA, Q3 — cálculo automático de distancia, N4 — Seguros) antes de implementar.
4. El resto de historias (copy, renombrados, orden de filtros, componentes de cabecera) son cambios de UI/contenido directos sobre `apps/web` — aplicar el UI Kit (`rs-*`, tokens de `styles.scss`) según sección 21 de `CLAUDE.md`.
