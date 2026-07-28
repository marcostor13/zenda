# Plan de implementación — `docs/new-changes-27-07.md`

## Estado de implementación

- ✅ **Fase 0 completada** (bugs críticos): `auth.service.ts` consolidado a `APP_URL` (antes
  `FRONTEND_URL`, no seteada en prod → caía a localhost); `docs/VERIFICACION-EMAIL.md`
  actualizado. Logo con `routerLink="/"` en `registro.component.ts` y
  `registro-comercio.component.ts`.
- ✅ **Fase 1 completada** (sistema de diseño): nuevos `RsRatingComponent`,
  `RsChipComponent` (+ `.rs-chip`/`.rs-chip--active`), `RsTrustBlockComponent`,
  `.rs-sticky-panel`, función pura `calcularBadgesAutomaticos` (todo en `shared/`, con sus
  `.spec.ts`). `RsCardComponent` ampliado de forma aditiva (modo "tarjeta de resultado" con
  `imageUrl`, reutiliza `.rs-hotel-card` ya existente en `styles.scss`) sin romper sus ~40
  usos previos como card simple de título/subtítulo. Conectado en
  `alojamiento-detalle.component.ts` (rating + trust block + sticky), `vertical-browse.component.ts`
  (rating) y `alojamiento-lista.component.ts` (badge automático "Mejor valorado"). La
  migración completa de las 3 tarjetas de listado al `RsCardComponent` unificado queda para
  la Fase 3 (Listados), como estaba previsto. `ng build` + `nest build` + tests (66 web / 22
  auth) verdes.
- ✅ **Fase 2 completada** (Home y buscador): hero con nuevo titular "Todo para tu mascota en
  un solo lugar" (decisión del usuario: se descartó conservar el pun "tu rey", con el test que
  lo protegía actualizado), subtítulo y eslogan de apoyo nuevos, espacio hero→buscador
  reducido, frase orientadora sobre el buscador. Campos del buscador renombrados
  (`labelUbicacion` → "¿Dónde buscas el servicio?" en `verticales.config.ts`), botón Buscar
  +15% ancho, categoría activa con borde dorado + icono más grande. Buscador `strip` ahora
  `position: sticky` en los 3 listados (alojamiento/vertical-browse/transporte) — el contador
  de resultados en vivo ya existía. Copys de categoría actualizados (`claim` por vertical) y
  5ª categoría "Hoteles pet friendly" añadida al mosaico Explora (enlaza a `/hoteles`, no a
  `/explora`, porque Hoteles es un vertical reservable y no un `TipoLugar` de comunidad —
  decisión D-5 respetada). Tarjetas de "Alojamientos recomendados" migradas al
  `RsCardComponent` unificado (rating Booking-style vía `RsRatingComponent`); tarjetas de
  Ciudades mantienen su propio patrón overlay-sobre-foto (no encajan en el modo "hotel card"
  de `RsCardComponent`) con las mejoras de HU-1.6.1 aplicadas directamente. Footer ampliado:
  redes sociales, badges App Store/Google Play, métodos de pago, tercer certificado
  "Protección de reservas", cierre emocional de marca. 85 tests web verdes, `ng build` +
  `nest build` limpios.
- ✅ **Fase 3 completada** (Listados unificados): decisión de diseño confirmada con el
  usuario — los 3 listados pasan a grid vertical (imagen 70-75%, orden Imagen→Nombre→
  Valoración→Dirección→Servicios→Precio→Botón), no fila horizontal. `vertical-browse` y
  `transporte-lista` migrados a `<rs-card>` (ya eran grid). `alojamiento-lista` migrado de su
  fila horizontal (`grid-template-columns: 280px 1fr 200px`) a grid de 2 columnas — el cambio
  visual más grande de la fase. Para no perder la semántica de enlace real (SEO, ctrl+click)
  en la ficha de alojamiento, `RsCardComponent` ganó un modo `routerLink` (renderiza `<a>` en
  vez de `<article>` vía `*ngTemplateOutlet`, evitando duplicar el body del template). También
  se le añadió `rsImg` (fallback de imagen) internamente — antes se perdía al mover el `<img>`
  dentro del componente (afectaba también a "Recomendados" de la Fase 2, ya corregido).
  Filtros de alojamiento (valoración, servicios, extras) migrados a `RsChipComponent`
  (HU-3.3). Badges unificados con `calcularBadgesAutomaticos` en los 3 listados. 959 tests
  de frontend verdes, `ng build` + `nest build` limpios (un error de tipos de AOT —
  `badge()` podía ser `null`— no lo detectó Jest, solo `ng build`; recordatorio de por qué
  el build real es obligatorio, no solo los tests).
- ✅ **Fase 4 completada** (Fichas de detalle): Alojamiento ganó un bloque "🛡️ Compromiso
  Doogking" nombrado (bajo el nombre) y un bloque "Compatibilidad con [mascota]" real —
  inyecta `PerrosService`, compara `compatibilidadSocialAdmitida`/tamaño/ansiedad de la
  mascota elegida contra el alojamiento, sin inventar coincidencias. Se descubrió que el
  backend ya expone `GET /catalog/servicios/:id` genérico (vertical-agnóstico, con reseñas
  embebidas) y que `CatalogBrowseService.obtener(id)` ya existía sin usar — no hizo falta
  tocar el backend. Se amplió su tipo a `ServicioDetalle` (barrio, dirección, amenities,
  reseñas, comercioId) y se creó `VerticalDetalleComponent` (patrón `CONFIGS` como
  `vertical-browse`) que cubre las 3 fichas nuevas pedidas — **transportista** (qué ofrece el
  vehículo), **adiestrador** (chips de especialidades) y **hotel pet-friendly** (ventajas) —
  sin fichas de contenido inventado (sin "600 trayectos realizados" ni vídeos ni "selector de
  problema" que reordena resultados, porque no hay datos reales para eso; quedan como
  deuda conocida, no como feature). Rutas `:id` añadidas para transporte/adiestramiento/
  hoteles; sus tarjetas de listado ahora enlazan a la ficha (antes iban directo a "solicitar",
  lo cual quedó redundante y se eliminó junto a sus tests). Veterinaria/peluquería/seguros/
  cuidadores siguen sin ficha propia — no estaban en el alcance de esta fase. 968 tests
  frontend verdes, `ng build` + `nest build` limpios (sin cambios de backend).
- ✅ **Fase 5 completada** (Flujos de reserva, sobre `reserva-wizard.component.ts`): los
  chips de solo-nombre del selector de mascota se sustituyeron por una tarjeta visual (foto +
  raza + edad calculada desde `fechaNacimiento` + peso) — dato que ya existía en `PerroApi`,
  cambio puramente de UI. El resumen del establecimiento (foto/nombre/precio/badge de
  categoría) se movió fuera del Paso 1 para quedar visible en los 4 pasos; se añadió un
  badge estático "✅ Profesional verificado" — **no** se añadió valoración/nº reseñas porque
  ese dato no viaja hoy en los query params del wizard (requeriría tocar 4+ páginas de origen
  para propagarlo; queda como deuda conocida, no como feature a medias). Barra de progreso:
  se detectó que `--c-teal` (el color usado para "completado") es en realidad azul-púrpura
  (#4156B9), no verde — se corrigió a `--c-success` (verde real) en el token global
  `.rs-steps` de `styles.scss`, y el círculo del paso activo ahora es más grande con
  resplandor, tal como pide HU-5.1.2. Los bloques específicos por vertical (5.2-5.7) y el
  cálculo de distancia por geocoding (5.5.1) quedan fuera de esta pasada — el primero es
  contenido/copy dentro de ramas ya existentes sin urgencia; el segundo necesita confirmar
  proveedor de mapas con el cliente. 971 tests frontend verdes, `ng build` + `nest build`
  limpios.
- ✅ **Fase 6 completada** (Ficha Inteligente de la mascota): el quick-win se confirmó — el
  backend ya calculaba el Índice de Bienestar (`GET /perros/:id/bienestar`, sin usar desde
  el frontend) y ahora se muestra en `perros-lista.component.ts` (badge "🟢/🟡/⚪ Bienestar
  X/100", sin tono de juicio para el nivel "inicial") y en el bloque de compatibilidad de
  `alojamiento-detalle.component.ts` (Fase 4). Se confirmó que `nivelDoogking` (badge
  "🎓 Nivel Doogking") es un dato **distinto** — nivel de sociabilidad asignado por un
  adiestrador tras una sesión — sin relación con el bienestar; ambos conviven sin duplicar
  información. Se añadió `% completitud` (`porcentajeCompletitud()`, función pura reusable)
  en la tarjeta de cada mascota. `perro-form.component.ts` se convirtió de formulario plano
  a wizard de 5 pasos (Datos básicos/Físico y pelo/Comportamiento/Salud/Alojamiento) con
  barra de progreso y **guardado automático real** al pulsar "Siguiente" (crea el borrador
  en el primer paso con nombre, luego actualiza) — sin bloquear la navegación si falla. El
  mismo `FormGroup` y `submit()` de siempre siguen intactos (valida el formulario completo
  sin importar el paso), por lo que los 19 tests preexistentes pasaron sin tocarlos; se
  sumaron 9 tests nuevos para el wizard/autoguardado/completitud. **Bug de testing
  descubierto**: `fixture.whenStable()` no basta cuando `ngOnInit` encadena 2+ llamadas
  `await` a servicios distintos (measured en `perros-lista.component.spec.ts`) — hace falta
  vaciar la cola de microtareas con un macrotask real (`await new Promise(r =>
  setTimeout(r, 0))`) antes de la aserción. 991 tests frontend verdes, `ng build` +
  `nest build` limpios (sin cambios de backend).
- ✅ **Fase 7 completada** (Registro de empresas + email): sobre el wizard ya existente
  (`registro-comercio.component.ts`) — la barra de progreso con nombres de paso (HU-6.1.3) y
  el feedback de selección de servicios (HU-6.1.2) **ya estaban resueltos**; se aplicaron los
  copys aprobados (HU-6.1.1: titular, subtextos por paso, "¿Dónde prestas tus servicios?",
  enlace a cuenta de cliente), un placeholder de nombre de negocio que cambia según el primer
  servicio elegido, un indicador de fuerza de contraseña real (Débil/Media/Segura/Muy segura,
  calculado en cliente por longitud+variedad, sin validación de servidor), la caja "¿Qué
  conseguirás al unirte?" en el paso 1, y el bloque de confianza antes de "Crear mi negocio".
  En el email de verificación (`notifications.service.ts`) se descubrió que el mismo método
  (`enviarVerificacionEmail`) sirve tanto al alta de cliente como de comercio — se añadió un
  parámetro `esComercio` (derivado de `usuario.rol` dentro de `auth.service.ts`, sin cambiar
  las firmas de los call-sites en `comercios.service.ts`) para que el saludo, el botón y el
  cierre emocional cambien según el destinatario, en vez de un texto genérico que sonaría mal
  para uno de los dos roles. 995 tests frontend + 549 tests API verdes, `ng build` +
  `nest build` limpios.
- ✅ **Fase 8 completada** (Área de cliente / perfil): el único gap real que necesitaba
  backend nuevo — `GET /reservas/proxima` (`bookings.service.ts`/`bookings.controller.ts`),
  con `.populate()` de `servicioId`/`comercioId` (ya tenían `ref` configurado, no hizo falta
  inyectar modelos nuevos) para traer nombre/imagen/ciudad reales de la próxima reserva
  confirmada, ordenada por `fechaInicio` ascendente. Bloque destacado en
  `perfil-dashboard.component.ts` justo bajo el header, con "Dentro de X días" calculado en
  frontend. Saludo "👋 Hola, [nombre]" (solo primer nombre). Reordenado el perfil según
  HU-7.4: Header → Próxima reserva → Mascotas → Puntos → Recordatorios → **Estadísticas**
  (antes iba justo bajo el header) → Reservas recientes/Configuración. Renombradas las
  tarjetas de estadísticas (HU-7.2) y las entradas de configuración (HU-7.9). 1000 tests
  frontend + 552 tests API verdes, `ng build` + `nest build` limpios. Quedan sin hacer de
  este bloque (P3, no bloqueantes): accesos rápidos (HU-7.6), "Mi actividad"/Logros (HU-7.7)
  y mensajes dinámicos personalizados (HU-7.8) — se dejaron fuera de alcance por ser
  refinamiento de baja prioridad, no gaps funcionales.
- ✅ **Fase 9 completada** (Mis reservas, Favoritos, Reseñas, Menú "Mi cuenta"):
  - **Menú "Mi cuenta"** (`rs-navbar.component.ts`): dropdown reagrupado en 3 bloques,
    contadores de mascotas/favoritos y punto rojo cuando hay una próxima reserva —
    reutilizando `PerrosService`/`ReservasService`/`FavoritosService` ya existentes. Cada
    llamada envuelta en try/catch (robustez: el navbar no debe romper la página si falla un
    contador — se descubrió al arreglar ~13 specs que mockeaban estos servicios parcialmente).
  - **Mis reservas**: botón "↻ Reservar de nuevo" (con deep-link a la ficha si el vertical la
    tiene) y checklist "🐶 Antes de ir" para alojamiento/hoteles confirmados o pendientes.
  - **Favoritos** (HU-10.3/10.4): orden (recientes/valorados/precio) y filtro por categoría en
    el frontend; alertas de precio en el backend — nuevo campo `precioGuardado` en
    `favorito.schema.ts` (fijado una sola vez vía `$setOnInsert`, nunca se pisa en altas
    repetidas) comparado contra el `precioBase` vivo del servicio en cada `listar()`. De paso
    se corrigió un bug preexistente: `favoritos.service.ts` devolvía siempre
    `createdAt: new Date().toISOString()` en vez de la fecha real de guardado (bloqueaba tanto
    el orden por recientes como cualquier badge de antigüedad futuro).
  - **Reseñas** (HU-11.2/11.3/11.4, el bloque de más esfuerzo): `resena.schema.ts` ampliado con
    `aspectos` (mapa libre validado como objeto), `fotos` (hasta 6) y `eliminada` (borrado
    lógico — así el filtro "Eliminadas" no pierde histórico y el rating del servicio se
    recalcula excluyéndolas). Catálogo de criterios por vertical en
    `resena-aspectos.config.ts` (mismo patrón que `verticales.config.ts`: entrada por
    `VerticalKey` + fallback genérico). Nuevo endpoint `GET /reviews/pendientes` (reservas
    confirmadas/completadas del usuario sin reseña aún, cruzando `Reserva` con los
    `reservaId` ya reseñados) y `PATCH`/`DELETE /reviews/:id` para editar/eliminar reseñas
    propias. `perfil-resenas.component.ts` reescrito: banner de pendientes con CTA "Escribir
    reseña", pestañas Todas/Pendientes/Publicadas/Con respuesta/Eliminadas, formulario modal
    con estrellas por aspecto + `rs-image-upload` reutilizado para las fotos. Reputación/
    gamificación del reseñador (HU-11.5) es P3, se deja fuera de alcance según lo previsto.
  - 566 tests API + 1031 tests frontend verdes, `tsc` (api+web) + `ng build` + `nest build`
    limpios.
- ✅ **Fase 10 completada** (Doogking Alpha, Bloque 13 — HU-13.1/13.2/13.4; HU-13.3 fuera de
  alcance por P3):
  - **Modelo de niveles configurable** (HU-13.4, P1): nueva colección `alpha_niveles`
    (`AlphaNivelConfig` — un documento por nivel, índice único en `nivel`), mismo patrón
    "colección + repository + admin" que `ComisionConfig`. `AlphaRepository.listarNiveles()`
    devuelve la config de BD o, si el admin no ha guardado nada aún, la escalera de fábrica
    `ALPHA_NIVELES_DEFAULT` (Alpha 1/2/5/10 reservas → Alpha 2/3, 0%/5%/10%) — el programa
    funciona desde el día uno sin intervención manual, tal y como exige "nada fijo en el
    código". Admin edita vía `GET`/`PUT /admin/alpha` (mismo guard `Roles(Rol.ADMIN)` que
    comisiones), nueva sección en `admin-dashboard.component.ts` bajo la tabla de comisiones.
  - **Nivel del usuario** (HU-13.1, P2): `AlphaService.obtenerEstado(usuarioId)` cuenta
    reservas con `estado: COMPLETADA` (estrictamente completadas, a diferencia del sistema de
    puntos existente en `bookings.service.ts` que suma `montoTotal` de `COMPLETADA +
    CONFIRMADA` — **el programa de puntos NO se tocó, sigue funcionando igual**, Alpha es
    aditivo como pedía el plan) y calcula nivel actual + progreso al siguiente. Expuesto en
    `GET /alpha/mi-estado` (nuevo módulo `alpha/`, no anidado en `bookings` ni `reviews`).
  - **Tarjeta premium en el perfil** (HU-13.2, P2): sustituye la banda amarilla plana de
    puntos por una tarjeta con degradado azul Doogking → dorado en
    `perfil-dashboard.component.ts` — nivel actual, barra de progreso, mensaje "Solo te faltan
    N reservas para desbloquear Alpha N", beneficios del nivel y botón "Ver ventajas Alpha →"
    que abre `/perfil/alpha` (nuevo `PerfilAlphaComponent`, lista completa de la escalera con
    el nivel actual resaltado). La banda de puntos se mantuvo como dato interno
    (`puntos`/`progresoPuntos` sin cambios) simplemente ya no se pinta — su UI queda
    sustituida, no su lógica.
  - **Cuidado de naming aplicado**: toda la UI dice "Nivel Alpha" / "Alpha 1/2/3", nunca
    "Nivel Doogking" (ese término sigue siendo exclusivo del bienestar de la mascota en
    `perro.schema.ts`, ver nota de Fase 6).
  - **Fuera de alcance (P3, deliberado)**: HU-13.3 (insignia "🏆 Beneficios Alpha" en listados
    + carrusel "Ventajas disponibles para ti") no se implementó — requeriría denormalizar un
    flag de comercio (`alphaAdherido`) hasta la tarjeta de servicio en los listados, no existe
    precedente de ese patrón en el código (se auditó `comercio.schema.ts`: el único flag de
    programa similar, `socioFundador`, tampoco se pinta en listados, solo afecta comisión).
  - 580 tests API + 1046 tests frontend verdes en total (incluye los nuevos de `alpha/` y de
    la sección Alpha del panel admin), `tsc` (api+web) + `ng build` + `nest build` limpios.
- ✅ **Fase 11 completada** (Centro de ayuda, Bloque 14 — HU-14.1.1/14.1.2/14.1.3/14.1.4/
  14.1.5/14.2.1/14.2.2/14.2.3; sin backend, todo cliente):
  - Reescrito `apps/web/src/app/features/ayuda/ayuda.component.ts` sobre la misma base que ya
    existía (2 tabs `cliente`/`comercio` + FAQ estático), manteniendo la API pública
    (`publico`, `preguntas`) para no romper el test previo.
  - **Buscador y categorías** (HU-14.1.2/14.2.1): filtrado en vivo por texto (pregunta +
    respuesta) y por categoría con icono, combinables. Categorías cliente: Mi mascota ·
    Reservas · Pagos · Cuenta y seguridad. Categorías comercio: Empezar en Doogking · Reservas
    · Cobros · Configuración · Valoraciones · Cuenta (las 2 últimas sin preguntas todavía —
    seguirán vacías con CTA a soporte hasta que haya contenido real, no se inventó relleno).
  - **Preguntas con icono** (HU-14.1.3): cada `Pregunta` lleva su propio icono además del de
    categoría.
  - **Ayuda personalizada** (HU-14.1.5): si hay sesión y el usuario tiene reservas, saludo
    "Hola [nombre], ¿necesitas ayuda con alguna de estas reservas?" con hasta 3 reservas y
    acciones "Modificar o cancelar" (enlaza al detalle de la reserva, que ya tiene cancelación
    — no se duplicó esa lógica aquí) y "Hablar con soporte" (mailto con el código
    precargado).
  - **Zona de contacto e info de confianza** (HU-14.1.4): añadida la línea de confianza
    (tiempo medio de respuesta, satisfacción, idiomas) bajo el CTA de contacto ya existente.
    El chat flotante queda "(Futuro)" según el propio documento de feedback, no se construyó.
  - **Vista profesional** (HU-14.2.2/14.2.3): tarjetas de datos rápidos (comisión, plazo de
    pago, tiempo de respuesta, estado de la plataforma — texto estático, no hay endpoint de
    "estado de plataforma"), sección "🚨 Incidencias rápidas" (5 accesos directos por mailto
    con asunto precargado), "🎓 Centro de aprendizaje Doogking" (lista informativa, sin
    contenido de vídeo/guías por no haber infraestructura de contenidos) y "🔥 Lo más
    consultado esta semana" (los 5 primeros FAQ del público activo — no hay analítica real de
    consultas, es una aproximación razonable sin inventar un sistema de tracking).
  - **Fuera de alcance (deliberado)**: el punto rojo con contador de "incidencia abierta" en
    el icono 💬 del navbar (parte de HU-14.1.1) no se implementó — no existe un sistema de
    tickets/incidencias en el backend; el icono y el enlace a `/ayuda` ya existían y se
    dejaron igual.
  - 580 tests API (sin cambios, fase 100% frontend) + 1057 tests frontend verdes, `tsc`
    (api+web) + `ng build` + `nest build` limpios.
- ✅ **Fase 12 completada** (Panel de administración / configurabilidad, Bloque 15 — última
  fase del plan):
  - **Auditoría previa** (agente Explore dedicado, no solo lectura superficial): HU-15.3 ya
    estaba cubierta por Fase 10 (Doogking Alpha). HU-15.4 (moderación de Explora) ya estaba
    **completa de extremo a extremo** desde antes de este plan —
    `GET /lugares/moderacion/pendientes` + `PATCH /lugares/:id/moderar` +
    `admin-comunidad.component.ts` con cola de pendientes y aprobar/rechazar — no requirió
    trabajo nuevo.
  - **HU-15.1/15.2 — gap real confirmado y corregido** (activar/configurar servicios y extras
    que "se muestran automáticamente ... en el paso de servicios adicionales de la reserva"):
    el backend y las tarjetas/fichas de listado ya leían datos reales del comercio (`extra`),
    pero el **wizard de reserva tenía dos bugs de precio concretos**, no solo un problema
    cosmético:
    1. **Alojamiento**: los "servicios adicionales" del paso 1 eran un array **hardcodeado**
       de 4 ítems idénticos para todos los comercios (paseo/baño/recogida/cámara), sumados al
       subtotal en pantalla pero **nunca enviados al backend** — el cliente veía un precio con
       extras que jamás se cobraba ni llegaba al comercio como pedido real. Corregido:
       `reserva-wizard.component.ts` ahora carga `serviciosAdicionales` reales vía
       `catalogBrowseService.obtener()` (mismo patrón ya usado por peluquería/veterinaria/
       adiestramiento), los envía en `detalle.extras` (array de nombres), y
       `alojamiento-availability.strategy.ts` los suma al `precioCalculado` buscándolos por
       nombre en `alojamiento.serviciosAdicionales` del comercio.
    2. **Hoteles**: el `suplementoPorTamanoMascota`/`suplementoSegundaMascotaPorNoche` del
       comercio **ya se cobraba correctamente en el backend** (`hoteles-availability.strategy.ts`
       no se tocó), pero el resumen de precio del wizard lo ignoraba por completo (`subtotal`
       solo hacía `base × noches`) — el cliente veía un importe menor al que Stripe le cobraba
       después. Corregido con un nuevo `computed suplementoHotel()` en el wizard que replica
       exactamente la fórmula del backend, más una fila "Suplemento por mascota" en el resumen.
  - **Fuera de alcance (deliberado, documentado para retomar)**: (a) `transporte.serviciosAdicionales`
    existe en el schema y en `CAMPOS_EXTRA_POR_VERTICAL` pero **no tiene UI en
    `comercio-listado-form.component.ts`** — ningún comercio lo ha configurado nunca, así que
    añadir un paso de extras en el wizard sin esa UI no aportaría nada; falta primero el
    FormArray de configuración (mismo patrón que `serviciosAdiestramiento`/`espacios`). (b) las
    tarjetas de listado de alojamiento no muestran una insignia "N servicios extra" (solo la
    ficha de detalle ya lo hace, en `alojamiento-detalle.component.ts`) — omisión cosmética,
    no de precio, se deja para un pase de pulido posterior.
  - 583 tests API + 1062 tests frontend verdes, `tsc` (api+web) + `ng build` + `nest build`
    limpios.

**Plan completo.** Las 12 fases de `docs/new-changes-27-07.md` están implementadas y
verificadas. Quedan documentados como fuera de alcance deliberado (no builds fallidos, no
deuda oculta): HU-11.5 (gamificación de reseñas, P3), HU-13.3 (insignia Alpha en listados,
P3), el contador de incidencias del icono de ayuda (parte de HU-14.1.1, sin sistema de
tickets) y la UI de `serviciosAdicionales` de transporte (sin la cual el paso de extras del
wizard no tendría contenido real que mostrar).


> Plan de ejecución para el feedback del cliente (Edgar y socio, 27/07/2026) recibido en
> `docs/new-changes-27-07.md` (16 bloques, ~150 historias `HU-*`). Este plan **cruza cada
> bloque con el estado real del código** (auditoría hecha sobre el repo, no sobre las
> capturas) para separar lo que ya existe de lo que es un gap real, igual que se hizo en
> `PLAN-MEJORAS-TODA-LA-APP.md`. Mensaje del propio feedback: no añadir elementos nuevos,
> dar más protagonismo a los que ya existen — por eso priorizamos **componentizar y
> reusar** sobre reescribir.

---

## 0. Resumen ejecutivo de la auditoría

| Área | Estado real |
|---|---|
| Sistema de diseño (Bloque 0) | ⚠️ Tokens (`--r-lg`, `--shadow-*`, `--t-*`, `.rs-badge`, `.rs-card`) existen en `styles.scss`, pero **no hay componente Card/Rating/Chip unificado**: alojamiento, `vertical-browse` y transporte reimplementan cada uno su propia tarjeta (`.aloja-card`, `.vb-card`, card propia de transporte). El "recuadro de valoración" tipo Booking (`.rs-rating`) está **duplicado** en 2 sitios como HTML crudo, no como componente. |
| Home (Bloque 1) | ✅ Estructura ya correcta y completa (hero → buscador → 3 valores → categorías → por qué → ciudades → recomendados → explora → cómo funciona → CTA empresas → footer). El trabajo es **copy + jerarquía visual + aplicar el Card unificado**, no reestructurar. |
| Buscador (Bloque 2) | ❌ Gap real: `rs-search-bar` no tiene modo *sticky* ni contador de resultados en vivo. |
| Listados (Bloque 3) | ❌ Gap real confirmado: **3 layouts de tarjeta distintos** (alojamiento, `vertical-browse`, transporte) — justo lo que el cliente pide unificar. |
| Fichas de detalle (Bloque 4) | ❌ Gap grande: **solo existe ficha de Alojamiento**. Transporte, Adiestramiento y Hoteles no tienen ficha de detalle propia (solo listado). Alojamiento le faltan reseñas por aspecto y un bloque "Compromiso Doogking" nombrado. |
| Reservas (Bloque 5) | ⚠️ Wizard único (`reserva-wizard.component.ts`) ya cubre las 6 verticales en el Step 1. Falta la tarjeta de establecimiento persistente y la **tarjeta visual de mascota** (hoy son solo chips de nombre) — dato de alto impacto porque el perro **ya tiene** foto/raza/edad/peso en el schema. |
| Onboarding empresa + email (Bloque 6) | 🐛 Los 2 bugs críticos (16.1/16.2) están **acotados y son baratos** (ver §1). El resto es copy sobre un wizard que ya existe. |
| Área de cliente (Bloque 7) | ⚠️ Ya tiene stats, mascotas, puntos. Falta bloque "próxima reserva" y greeting personalizado. |
| Ficha Inteligente mascota (Bloque 8) | ✅ **El mayor quick-win del documento**: el schema de `perros` ya tiene casi todos los campos pedidos (vacunas, temperamento, sociabilidad, microchip…) y el backend **ya calcula** un "Índice de Bienestar" (`bienestar.service.ts`) — pero **no se consume en ningún sitio del frontend**. Falta convertir el formulario en wizard por bloques con `%` de completitud. |
| Mis reservas (Bloque 9) | ✅ Más avanzado de lo que el feedback asume: ya hay timeline en tiempo real (`seguimiento()`, polling 15s) visible para el cliente. Faltan detalles menores (checklist, botón "reservar de nuevo"). |
| Favoritos (Bloque 10) | ❌ Gap real: sin orden, sin filtros, sin alertas de precio/disponibilidad. |
| Reseñas (Bloque 11) | ❌ Gap real: el modelo de datos solo tiene `puntuacion` + `comentario` (un único número). No hay aspectos por categoría ni fotos ni página de "pendientes de valorar". |
| Menú "Mi cuenta" (Bloque 12) | ❌ Gap menor: dropdown plano, sin contadores ni puntos de notificación. |
| Doogking Alpha (Bloque 13) | ⚠️ Hoy existe un sistema de **puntos** (400 pts = 5€), no de **niveles**. Es aditivo, no conflictivo, pero cuidado: ya existe un "Nivel Doogking" 1-5 **de la mascota** (bienestar) — hay que evitar colisión de nombres con los niveles Alpha del cliente. |
| Centro de ayuda (Bloque 14) | ❌ Gap real: hoy son solo 2 tabs + FAQ estática, sin buscador ni categorías. |
| Panel admin (Bloque 15) | ✅ Ya hay precedente de configurabilidad (comisiones, moderación de Explora) — el patrón para añadir config de Alpha ya existe. |
| Bugs críticos (Bloque 16) | 🐛 Ver §1 — ambos acotados. |

---

## 1. FASE 0 — Bugs críticos (P0, día 1, en paralelo con todo lo demás)

### HU-16.1 / HU-6.2.1 — Enlace de verificación a localhost
`apps/api/src/core/auth/auth.service.ts:161` ya lee `FRONTEND_URL` con fallback a
`http://localhost:4200`. **No es un literal hardcodeado** — el bug real es que la variable
de entorno no está seteada (o no llega) en producción/Coolify. Además `notifications.service.ts:217`
y `agenda.controller.ts:212` usan `APP_URL` (con fallback `https://doogking.com`), una
**variable distinta** para el mismo propósito.
- Acción: consolidar a un único nombre de variable (`APP_URL`, ya el más usado) en
  `auth.service.ts:161`, y verificar que esté seteada en `.env` de producción y en Coolify.
- No mostrar el enlace completo en el cuerpo del email (HU-6.2.1) — usar solo el botón +
  enlace secundario corto.

### HU-16.2 / HU-6.1.10 — Sin retorno a Home en registro de empresa
Confirmado: `registro-comercio.component.ts` (logo `<img>` sin `routerLink`, ~L24-25) y
`registro.component.ts` (mismo patrón, ~L17) no tienen forma de volver a `/`.
- Acción: envolver el logo en `<a routerLink="/">` en ambos componentes (cambio de 2 líneas
  por archivo).

---

## 2. FASE 1 — Sistema de diseño transversal (Bloque 0)

Se hace primero porque Home, Listados, Fichas y Reservas lo reutilizan. **No es "crear
tokens"** (ya existen) — es **crear los 3 componentes que faltan y migrar** las tarjetas
duplicadas a ellos.

1. **`RsCardComponent`** (`shared/components/card/rs-card.component.ts`) — hoy solo acepta
   `title/subtitle/glass/padding`. Ampliar con inputs para imagen, badges (proyección),
   rating, precio, texto de botón/CTA, altura uniforme por fila (CSS `align-items:stretch`
   en el grid contenedor) y todo el card clickable (`(click)` + `cursor:pointer`). Aplica
   HU-0.1/0.2/0.11.
2. **`RsRatingComponent`** nuevo — extrae el patrón `.rs-rating` (score + etiqueta
   cualitativa "Excepcional"/"Muy bueno" + nº reseñas) ya duplicado en
   `alojamiento-detalle.component.ts:323-328` y `vertical-browse.component.ts:195-199`.
   Un solo componente parametrizado por `score`/`label`/`count`. Aplica HU-0.8.
3. **`.rs-chip` / `RsChipComponent`** — sustituye clases ad-hoc (`sb__cat`, `ai__chip`) por
   un chip con radio 20-24px y estado activo amarillo. Aplica HU-0.5.
4. **Clase `.rs-sticky-panel`** en `styles.scss` — generaliza el `position: sticky` que hoy
   está repetido inline en `alojamiento-lista.component.ts:317` y
   `alojamiento-detalle.component.ts:284`. Aplica HU-0.6/3.4/4.1.4/5.1.4.
5. **`RsTrustBlockComponent`** — generaliza `.booking-panel__trust` (ya existe como texto
   libre) en un componente con checks configurables (Stripe, confirmación inmediata, sin
   cargos ocultos, cancelación, soporte). Aplica HU-0.7/5.1.5/6.1.6.
6. **Badges automáticos** (HU-0.9): función pura `calcularBadgesAutomaticos(servicio)` en
   `shared/` (Recomendado / Más reservado / Mejor valorado / Respuesta rápida / Últimas
   plazas) consumida por el Card — nunca texto manual.
7. **Migración progresiva**: primero `alojamiento-lista` + `vertical-browse` (comparten más
   lógica) al nuevo Card; `transporte-lista` y `favoritos` en un segundo pase. No migrar
   todo en un solo cambio — cada migración lleva su propio build+test.

---

## 3. FASE 2 — Home y buscador (Bloques 1-2)

Estructura ya correcta; trabajo de copy, jerarquía y componentes de Fase 1.

- Hero: nuevo titular "Todo para tu mascota en un solo lugar" + subtítulo (HU-1.1.1);
  reducir espacio hero→buscador; frase orientadora sobre el buscador (HU-1.1.2).
- Textos de campos del buscador (HU-1.2.1), botón "Buscar" +15% ancho (HU-1.2.2), categoría
  seleccionada resaltada (HU-1.2.3).
- **Gap real**: sticky del buscador en listados + contador de resultados en tiempo real
  (HU-2.1/2.2) — requiere ampliar `rs-search-bar` variante `strip` con `position: sticky` y
  un `output`/señal de nº de resultados que la página de listado alimente.
- Copys por categoría (HU-1.4.1), confirmar 5ª categoría "Hoteles pet friendly" en el
  mosaico Explora (HU-1.8.1 — verificar si ya está o falta añadir).
- Recomendados/Ciudades: migrar a `RsCardComponent` + `RsRatingComponent` de Fase 1; badges
  emocionales (HU-1.7.1).
- Footer (HU-1.10.1): gap real — añadir redes sociales, badges App Store/Google Play,
  logos de métodos de pago.

---

## 4. FASE 3 — Listados unificados (Bloque 3)

Con el Card de Fase 1 ya migrado a alojamiento + `vertical-browse`, aplicar:
- Orden de lectura fijo, foto 70-75% del alto, precio protagonista con unidad ("por
  trayecto"/"/noche"/"por sesión").
- HU-3.5 (servicios mostrados según configuración del profesional): verificar que el schema
  de `servicios`/`comercios` ya expone qué extras activó el profesional (hay precedente en
  `comercio-suplementos.component.ts`); si falta el campo, añadirlo — si no, es solo wiring
  de frontend.
- Dejar `transporte-lista` para el final de esta fase (layout más distinto).

---

## 5. FASE 4 — Fichas de detalle (Bloque 4)

**Gap más grande del documento**: crear 3 fichas nuevas + mejorar la existente.

- **Alojamiento** (ya existe, `alojamiento-detalle.component.ts`): añadir reseñas por
  aspecto (limpieza/trato/instalaciones/comunicación — requiere ampliar el modelo de
  reseñas, ver Fase 9); nombrar el bloque "🛡️ Compromiso Doogking" agrupando los checks ya
  dispersos; promover "compatibilidad con tu perro" (hoy un ítem de política,
  L229-232) a bloque destacado usando los datos ricos del perro (temperamento,
  sociabilidad) — mismo dato que alimenta el Índice de Bienestar de Fase 6.
- **Transportista** (nueva): galería del vehículo, bloque "¿Qué ofrece este transportista?"
  con servicios configurados, "¿Por qué elegir…?" con dato de experiencia.
- **Adiestrador** (nueva): chips de especialidades, selector previo "¿Qué problema quieres
  resolver?" que reordena resultados, galería con vídeo.
- **Hotel pet-friendly** (nueva): badges configurables, línea de ventajas, datos desde la
  ficha del hotel.
- Todas reusan `RsRatingComponent`/`RsTrustBlockComponent`/`.rs-sticky-panel` de Fase 1 —
  no reinventar layout por vertical.

---

## 6. FASE 5 — Flujos de reserva (Bloque 5)

Sobre `reserva-wizard.component.ts` (ya único y multi-vertical):

- **Quick win de alto impacto**: sustituir los chips de nombre del selector de mascota
  (L157-160) por una tarjeta visual (foto + raza + edad + peso) — el dato ya existe en
  `perro.schema.ts`, es solo de UI (HU-5.1.3).
- Tarjeta de establecimiento (foto, rating, verificado) hoy solo aparece en Step 1
  (L135-144) y desaparece — hacerla persistente en los 4 pasos (HU-5.1.1).
- Barra de progreso ya tiene checks (✓) — solo falta el estilo visual pedido (círculos,
  etiquetas de texto) (HU-5.1.2).
- Bloques específicos por vertical (5.2-5.7: ficha médica en veterinario, extras
  seleccionables en alojamiento, cálculo de distancia en transporte, etc.) se añaden dentro
  de las ramas ya existentes por vertical en Step 1 — no son un flujo nuevo.
- HU-5.5.1 (cálculo automático de distancia en transporte): requiere integración de
  geocoding/distancia (Google Maps Distance Matrix o similar) — confirmar con el cliente si
  ya hay proveedor de mapas contratado antes de estimar esfuerzo.

---

## 7. FASE 6 — Ficha Inteligente de la mascota (Bloque 8)

Prioridad alta pese a estar tarde en el orden del documento, porque **desbloquea** Fase 4 y
Fase 5 (compatibilidad con el perro / tarjeta de mascota en reserva).

- **Exponer el Índice de Bienestar ya calculado** (`bienestar.service.ts`, backend) en:
  la tarjeta del perro (`perros-lista.component.ts`), la ficha de detalle del perro, y el
  bloque "compatibilidad con tu perro" de Fase 4. Es back-to-front wiring, no cálculo nuevo.
- Convertir `perro-form.component.ts` (formulario single-page) en wizard por bloques con
  barra de progreso ("Paso X de 6") — reutilizar las secciones que ya existen (Datos
  básicos, Físico y pelo, Comportamiento, Salud, Alojamiento) como los 5-6 pasos.
- `%` de completitud: calcular en frontend a partir de campos rellenos del mismo DTO (no
  requiere cambio de schema).
- Guardado automático por bloque + mensaje "Guardado automáticamente" (HU-8.2.6).
- Vacunas como tarjetas visuales en vez de lista (dato ya existe: `vacunasDetalle`).

---

## 8. FASE 7 — Registro de empresas + email (Bloque 6, sin contar bugs de Fase 0)

- Copys del wizard existente (HU-6.1.1), barra de progreso con nombres de paso (ya hay
  estructura de pasos, falta el estilo), indicador de seguridad de contraseña, caja "¿Qué
  conseguirás al unirte?", bloque de confianza antes de "Crear mi negocio".
- Plantilla de email: branding, contenido emocional, botón "Activar mi cuenta" (contenido
  puro, sin lógica nueva — mismo servicio de notificaciones ya usado en HU-16.1).

---

## 9. FASE 8 — Área de cliente / perfil (Bloque 7)

- **Gap real**: bloque "Próxima reserva" — requiere endpoint que devuelva la siguiente
  reserva confirmada del usuario (filtrar `reservas` por `fechaInicio > now` y estado
  confirmada, ordenar asc, tomar la primera). Front: bloque destacado arriba del perfil.
- Greeting header "👋 Hola, [Nombre]" + sello "Cliente verificado" (falta, confirmado en
  auditoría).
- Reordenar secciones (HU-7.4), renombrar textos de configuración (HU-7.9) — cambios de
  plantilla sin lógica.
- "Logros" (HU-7.7): definir un set simple de hitos calculables de datos ya existentes
  (primera reserva, primera reseña, 10 reservas) — no requiere tabla nueva, se puede derivar
  de agregaciones existentes (`bookings.service.ts`).

---

## 10. FASE 9 — Mis reservas, Favoritos, Reseñas, Menú "Mi cuenta" (Bloques 9-12)

- **Mis reservas**: ya tiene timeline en tiempo real y filtros por estado con color — solo
  faltan detalles menores: checklist "antes de ir" (residencias/hoteles), botón "Reservar de
  nuevo", iconos de cabecera (👤 personas, 🐶 mascotas, 🕒 hora).
- **Favoritos** (gap real): añadir orden (recientes/valorados/cercanos/precio), filtro por
  categoría, y alertas de precio/disponibilidad — esto último requiere guardar un
  `precioAnterior` o snapshot al añadir a favoritos y compararlo en cada carga (backend +
  frontend).
- **Reseñas** (gap real, el de más esfuerzo de este bloque): el modelo actual
  (`reviews.service.ts`) solo tiene `puntuacion` + `comentario`. Para HU-11.4 (valoración
  por aspectos según categoría) hay que:
  1. Ampliar el schema de reseñas con un mapa `aspectos: { limpieza, trato, ... }` (los
     aspectos varían por vertical — definir un catálogo por categoría, similar a
     `verticales.config.ts`).
  2. Añadir subida de fotos (reusar `rs-image-upload.component.ts`, ya existe).
  3. Nueva pantalla cliente "pendientes de valorar" (hoy solo existe la vía token de email,
     `valorar-token.component.ts`).
  4. Reputación/gamificación del reseñador (HU-11.5) es P3 — dejar para el final.
- **Menú "Mi cuenta"** (gap menor): agrupar el dropdown ya existente en 3 bloques,
  contadores (mascotas/favoritos/reseñas — datos ya se piden en otros lados del perfil,
  reutilizar) y punto rojo de notificación.

---

## 11. FASE 10 — Programa Doogking Alpha (Bloque 13)

Aditivo sobre el sistema de puntos existente (`bookings.service.ts:596-618`, 400pts=5€):

- **Cuidado de naming**: ya existe "Nivel Doogking" 1-5 a nivel de **mascota** (bienestar,
  `nivelDoogking` en `perro.schema.ts`). El nuevo programa es de **niveles del cliente**
  (Alpha 1/2/3) — nombrar explícitamente "Nivel Alpha" en toda la UI para no confundir con
  el nivel de bienestar de la mascota.
- Nuevo modelo: niveles por nº de reservas completadas (no por puntos), configurable desde
  admin — seguir el patrón ya usado para `ComisionConfig` (colección + panel admin +
  service), aplicado a niveles/beneficios/descuentos de Alpha (HU-13.4).
- Tarjeta premium en el perfil sustituyendo la banda de puntos actual; insignia "🏆
  Beneficios Alpha" en listados para comercios adheridos.

---

## 12. FASE 11 — Centro de ayuda (Bloque 14)

Gap real — hoy son 2 tabs + FAQ estática sin buscador:
- Buscador de preguntas con filtrado en vivo sobre el array `FAQ` ya existente (cliente,
  sin backend).
- Más categorías con icono (hoy son 2 tabs planos).
- Ayuda personalizada para usuario logueado (HU-14.1.5) — requiere leer las reservas
  activas del usuario, ya expuestas por `reservas.service.ts`.
- Incidencias rápidas y centro de aprendizaje para profesional (P2/P3, al final).

---

## 13. FASE 12 — Panel de administración (Bloque 15)

- Ya existe el patrón de configurabilidad (comisiones, moderación Explora) — replicar para
  la config de Doogking Alpha de Fase 10.
- Verificar cobertura completa de HU-15.1/15.2 (servicios/badges configurables por el
  profesional alimentando listados/fichas/reservas) — parcialmente cubierto por
  `comercio-listados`/`comercio-suplementos`, confirmar que todo dato mostrado en las nuevas
  fichas de Fase 4 (transporte/adiestrador/hotel) sea configurable, no fijo.

---

## 14. Orden de ejecución recomendado

```
Fase 0  (bugs)              ── en paralelo con todo, día 1
Fase 1  (design system)     ── primero, todo lo demás depende de esto
Fase 2  (home/buscador)
Fase 3  (listados)
Fase 4  (fichas detalle)
Fase 6  (ficha mascota)     ── mover antes de Fase 5 si es posible: desbloquea la
                                tarjeta de mascota del wizard y "compatibilidad" de fichas
Fase 5  (reservas)
Fase 7  (onboarding empresa)
Fase 8  (área cliente)
Fase 9  (mis reservas/favoritos/reseñas/menú)
Fase 10 (Doogking Alpha)
Fase 11 (centro de ayuda)
Fase 12 (panel admin)
```

Cada fase termina con `npm run test` + `ng build`/`nest build` (regla de verificación de
builds ya establecida en el proyecto) antes de pasar a la siguiente.
