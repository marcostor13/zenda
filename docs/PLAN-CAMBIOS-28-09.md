# Plan — «Cambiar en vez de» (feedback cliente 2026-09-28) + Explora: restaurantes y tiendas CV

Fuentes:
- `Cambiar en ves de.docx` (7 puntos con 5 capturas).
- `Doogking_restaurantes_pet_friendly_CV_primera_fase.pdf`: 32 restaurantes y cafeterías (Alicante 16, Castellón 5, Valencia 11).
- `Doogking_Tiendas_Animales_Comunidad_Valenciana_Verificadas_24-09-2026.pdf`: 62 tiendas (Alicante 19, Castellón 2, Valencia 41). Son las cadenas Miscota, Tiendanimal y Kiwoko, comprobadas con sus localizadores oficiales.

Estado: **IMPLEMENTADO** (2026-09-28), salvo C3, bloqueado a la espera del vídeo del cliente. Qué se hizo y qué queda por ejecutar en producción: §Implementación, al final.

---

## 0. Lectura del documento

| # | Texto del cliente | Captura | Qué significa |
|---|---|---|---|
| C1 | «Cambiar en vez de en crematorios» | img1 es lo que quiere; img2 es lo que hay ahora | Sustituir el reclamo del listado de funerarios, «Acompañamiento en el peor momento», por el diseño nuevo: «Acompañamiento respetuoso cuando más lo necesitas», firma manuscrita «Siempre a su lado ♡» y lema «CUIDAR TAMBIÉN ES DESPEDIR BIEN». |
| C2 | «Cambiar el botón por reservar» | img3, la tarjeta de crematorio con «Ver ficha» | El CTA de las tarjetas del listado debe decir **«Reservar»**. |
| C3 | «Falta indicaciones de Video, Viernes a las 3:27am, whatsapp» | — | **No se puede implementar todavía.** Se refiere a un vídeo con indicaciones que mandó el cliente por WhatsApp el viernes a las 3:27. Hay que conseguir ese vídeo. |
| C4 | «El flotante de ayuda no aparece en el móvil» | — | El asistente `rs-asistente` está oculto a propósito por debajo de 1025 px. El cliente lo quiere también en móvil. |
| C5 | «Siempre debe salir un resultado; si no lo encuentra, que busque en Explora tu mascota» | img4: «playa» → «No hemos sabido a qué categoría te refieres» | El buscador IA nunca debe terminar en ese error. Si no reconoce una categoría, debe caer en Explora (búsqueda por texto) y, en último caso, mostrar algo. |
| C6 | «Implementar puntuación y la distancia con respecto al centro, según la ciudad del comercio» | img5, tarjeta de Booking: «Fabuloso 8,6 · 953 comentarios», «a 8,1 km del centro» | Poner en la tarjeta del listado la nota con su etiqueta, el nº de reseñas y «a X km del centro» de la ciudad del comercio. |
| C7 | «Planificador de viaje: revisar mejoras, que termine en un servicio de la plataforma o lo muestre, y más preguntas para afinar el itinerario» | — | El planificador debe cerrar siempre con servicios reservables y hacer más preguntas. |
| C8 | *(petición en el chat)* Añadir los dos PDF a Explora | — | Importar los restaurantes y un tipo nuevo, **tienda**, a la colección `lugares`. |

Hallazgo extra (img3): la tarjeta muestra **«56,84 $»**. No es un fallo de datos. Ese navegador tiene guardado `doogking_moneda=USD` y `importe.ts` convierte y pinta `$`. Ver §C6.4.

---

## C1 — Reclamo de funerarios con el diseño nuevo

**Dónde está hoy**
- El texto: `apps/web/src/app/shared/verticales/verticales.config.ts:260-263`, en el campo `reclamo` de la entrada FUNERARIOS.
- El pintado: `apps/web/src/app/shared/components/listado/rs-listado.component.ts:86-96` (plantilla) y `:302-356` (estilos).
- **Fallo aparte:** `reclamoTitulo()` y `reclamoTexto()` se pintan sin `| t` (l.92-93). Las traducciones existen pero nunca se aplican.

**Cambios**
1. Añadir a `reclamo` dos campos opcionales:
   - `firma`: el texto manuscrito, «Siempre a su lado».
   - `lema`: la columna derecha en versalitas, «Cuidar también es despedir bien».
2. En FUNERARIOS:
   - titulo = «Acompañamiento respetuoso cuando más lo necesitas»
   - texto = «Encuentra centros verificados, recogida en domicilio o clínica y precios claros antes de contratar.»
   - firma y lema, como arriba.
3. `rs-listado`:
   - Usar un layout de tres columnas: icono · texto · firma + lema.
   - La firma lleva un corazón de trazo y un subrayado curvo en SVG.
   - El lema va en Montserrat, en mayúsculas, con una raya dorada debajo.
   - En móvil la firma y el lema bajan bajo el texto, o se ocultan por debajo de 600 px.
   - Añadir `| t` al título, al texto, a la firma y al lema.
4. Icono: huella con corazón dorado sobre un círculo lila. Es un SVG nuevo, `funerarios-reclamo.svg`, o se reutiliza `/icons/funerarios.svg` si encaja.
5. Tokens nuevos en `styles.scss`, respetando la regla §21 de no hardcodear:
   - `--dk-lila-soft`: fondo del círculo.
   - `--dk-lila`: color de la firma.
   - `--font-script`: fuente manuscrita. Se carga en `index.html` desde Google Fonts, por ejemplo *Caveat* o *Dancing Script*.
   - El fondo crema de la tarjeta ya existe (tono amber-tinted).
6. i18n: las claves nuevas en los 7 diccionarios `traducciones/<lang>/publico.ts`.
7. Documentar los tokens en `.claude/commands/design-tokens.md`.

**Verificación:** `/funerarios` en escritorio y a 375 px, y cambiando el idioma a EN.

---

## C2 — CTA «Reservar» en las tarjetas del listado

| Sitio | Texto actual | Cambio |
|---|---|---|
| `features/verticales/vertical-browse.component.ts:329` (veterinaria, peluquería, adiestramiento, funerarios…) | «Ver ficha» | **«Reservar»** |
| `features/alojamiento/components/alojamiento-lista.component.ts:100` | «Ver disponibilidad» | **«Reservar»** (para ser coherentes; confirmar) |
| `features/transporte/components/transporte-lista.component.ts:86` | «Ver ficha y calcular precio» | **«Reservar»** (el precio se calcula en la ficha) |
| `features/home/home.component.ts:327` | «Ver alojamiento» | No se toca: es un escaparate, no un listado |

- El botón sigue llevando a la ficha, que es donde se elige fecha, slot o trayecto. Sólo cambia el texto.
- «Reservar» ya está traducido en los 7 idiomas. Comprobarlo en cada diccionario.
- Ajustar los specs que buscan «Ver ficha» y los E2E de Playwright que lo usen como selector.

---

## C3 — Indicaciones del vídeo de WhatsApp *(bloqueado)*

- **Qué hace falta:** que el cliente reenvíe el vídeo del viernes, 3:27, por WhatsApp, o que transcriba las indicaciones.
- Hasta entonces no se estima. Cuando llegue, se añade como C3.1…C3.n en este documento.

---

## C4 — Asistente flotante también en móvil

**Causa:** `shared/components/asistente/rs-asistente.component.ts:144-145` tiene `:host{display:none}` y sólo lo muestra a partir de 1025 px. Fue una decisión intencionada para no tapar las barras fijas de abajo: la de reservar de las fichas y la navegación de la app nativa.

**Solución (mostrarlo sin tapar la acción)**
1. Quitar el `display:none` en móvil.
2. Por debajo de 1025 px el botón pasa a ser **sólo icono**, un círculo de 48 px sin la etiqueta «¿Te ayudo?».
3. Posición: `bottom: calc(var(--sp-5) + var(--dk-barra-inferior, 0px) + env(safe-area-inset-bottom))`.
   - Las barras fijas (`rs-barra-reserva` de las fichas y el bottom-nav de `dk-nativo`) publican su altura en `--dk-barra-inferior` sobre `:root`, con un `ResizeObserver` o una altura fija conocida.
   - Así el botón queda siempre encima de ellas.
4. En móvil el chat abierto ocupa la pantalla completa (`100dvh`), con botón de cerrar arriba.
5. Se oculta mientras hay un teclado o un modal abiertos, y en `/checkout`, para no distraer del pago.
6. Actualizar el comentario de cabecera del componente, que hoy dice «Sólo en escritorio».

**Verificación:** 375 px en home, en ficha con la barra de reservar y en la app Capacitor (APK de debug).

---

## C5 — El buscador IA siempre da un resultado

**Situación actual**
- «playa» ya se enruta a `/explora?tipo=playa` desde el commit `afc3ce3` (2026-09-20, en `main`). **La captura seguramente es de un despliegue anterior.** Hay que confirmar qué versión corre en producción.
- Aun así, el error sigue saliendo con cualquier texto que no case con una vertical ni con un tipo de lugar. Ejemplos: «tienda», «dónde comer con mi perro en Dénia», «Kiwoko». Viene de `home.component.ts:1965`.

**Cambios**
1. **API `GET /lugares?q=`:** búsqueda por texto sobre `nombre`, `ubicacion.ciudad`, `direccion` y la etiqueta de `tipo`.
   - Usar un índice de texto o una regex anclada sobre un campo normalizado sin acentos (`nombreNormalizado`).
   - Añadir el índice en `lugar.schema.ts`, siguiendo la regla de no hacer consultas sin índice.
   - Un filtro más en `lugares.service.ts#buscar`.
2. **`interpretacion-local.ts`:** añadir los tipos nuevos a `LUGARES`:
   - `tienda`: tienda, tiendas, pienso, accesorios, Kiwoko, Tiendanimal, Miscota.
   - Ampliar `restaurante` con comer, cenar, cafetería, terraza, bar y brunch.
   - Hacer lo mismo en el prompt de DeepSeek (`ai-search.service.ts:25-59`).
3. **Cascada en `buscarConIA()`**, sin ningún camino que termine en error:
   1. Vertical reconocida → listado de la vertical (como hoy).
   2. `tipoLugar` reconocido → `/explora?tipo=…&ciudad=…` (como hoy).
   3. Ninguno de los dos → `/explora?q=<texto>&ciudad=<si la hay>`. Explora busca por texto.
   4. Explora con `q` sin resultados → quitar `q` y mostrar los lugares de la ciudad o provincia detectada con el aviso «No encontramos "X"; esto es lo que hay para tu mascota cerca».
   5. Sin ciudad → los lugares mejor valorados, con el mismo aviso.
   - El mensaje «No hemos sabido…» se elimina, o queda sólo para el error de red.
4. **`explora-lista.component.ts`:** leer `q` de los query params (hoy sólo lee `tipo`, `provincia` y `ciudad`) y añadir un cajetín de búsqueda en la cabecera de Explora.
5. Si Explora queda vacía y hay ciudad, **sugerir servicios reservables** con el `buscarCercanos` del catálogo, para que el usuario acabe en la plataforma.

**Tests:**
- `interpretacion-local.spec.ts` con «playa», «tienda», «comer en Dénia» y «Kiwoko».
- `lugares.service.spec.ts` para `q`.
- Spec de `home` para la cascada.
- Un E2E con «playa» y otro con un texto sin sentido que debe llegar a Explora.

---

## C6 — Puntuación y distancia al centro en la tarjeta (estilo Booking)

### C6.1 Corregir la etiqueta de la nota (fallo)
- `apps/api/src/core/catalog/catalog.service.ts:982-988` `scoreLabel()` aplica los umbrales de Booking en escala /10 (≥9, ≥8, ≥7, ≥6) a un `ratingPromedio` que está en escala **1-5**. Resultado: **todos los servicios salen como «Correcto».**
- Umbrales nuevos en escala /5, en `libs/shared` para que web y API compartan la tabla:

  | Nota | Etiqueta |
  |---|---|
  | ≥ 4,7 | Excepcional |
  | ≥ 4,4 | Fabuloso |
  | ≥ 4,0 | Muy bueno |
  | ≥ 3,5 | Bueno |
  | resto | Correcto |

- Las etiquetas van a los 7 diccionarios. Hoy ninguna está traducida.

### C6.2 Bloque de nota en la tarjeta horizontal
- Archivo: `shared/components/card/rs-card.component.ts`, líneas 96-109 y 166-189.
- Se añade arriba a la derecha, como en Booking:
  - la etiqueta, por ejemplo «Fabuloso»;
  - debajo, «953 reseñas»;
  - a su derecha, un cuadrado azul (`--dk-blue`) con la nota, por ejemplo «4,6».
- **Decisión pendiente:** mostrar la nota /5, coherente con las estrellas y las reseñas, o convertirla a /10 como Booking (`score × 2`). **Recomendación: /5.**
- Sin reseñas se mantiene la píldora «Nuevo · Aún sin valoraciones», sin cuadrado.
- Traducir también el «reseña/reseñas» de la línea meta, que hoy no pasa por `| t`.

### C6.3 «A X km del centro»
- **No existe.** No hay coordenadas de centros de ciudad (`libs/shared/src/ubicaciones/municipios.ts` sólo guarda nombre, provincia y alias). `distanciaKm` sólo se rellena en la caída a «cercanos».
- **Diseño:**
  1. **Centro de la ciudad:**
     - Crear la colección `centros_poblacion` con `{ ciudadClave, lat, lng, fuente }`.
     - Se rellena bajo demanda con `geoService.coordenadasDePoblacion(ciudad)` (Google, con Nominatim de respaldo) y se guarda en caché para siempre.
     - Script de siembra para los municipios que ya tienen servicios.
     - No se usa `centroDePoblacion()` (la media de los servicios), porque se desplaza hacia donde hay comercios.
  2. **Cálculo:**
     - Cuando el servicio tiene `ubicacion.geo`, se calcula la distancia haversine al centro de **la ciudad en la que está dado de alta el comercio** (`servicio.ubicacion.ciudad`, que ya se canoniza al guardar).
     - Se guarda como `servicio.distanciaCentroKm`, un campo desnormalizado que se recalcula al crear o editar la ubicación (`catalog.repository.ts:477/521`).
     - Así el buscador no calcula nada por petición.
     - Extraer la haversine privada de `geo.service.ts:570` a `libs/shared/geo/haversine.ts`.
  3. **Migración:** script `recalcular-distancia-centro.ts` para los servicios existentes, en modo simulación y con `--aplicar`.
  4. **Tarjeta:** el subtítulo pasa a «Castellón de la Plana · a 2,3 km del centro», usando la función existente `lugarConDistancia`.
     - Si el servicio no tiene geo, no se muestra la distancia.
     - Hoy la geo es opcional. Proponer que sea obligatoria en el alta de ubicación, con autocompletado de Google, que ya existe.
     - La distancia de «cercanos» (desde el usuario) tiene prioridad cuando existe.
  5. Opcional: un nuevo orden «Distancia al centro» en el listado.
- **Tests:**
  - spec de la haversine;
  - `catalog.service.spec` (`toCard` con y sin geo);
  - `rs-card.component.spec` (bloque de nota y distancia).

### C6.4 Moneda «$» (observación)
- El «$» sale porque ese navegador eligió USD en el selector de región. Es un importe convertido de EUR.
- Propuesta mínima: cuando `moneda.esConvertida()` es cierto, anteponer «≈» y poner en el `title` el precio en EUR, que es el que se cobra.
- **Hay que confirmar con el cliente si el selector de moneda debe seguir existiendo.**

---

## C7 — Planificador de viaje

**Situación actual**
- Front: `features/explora/planificador.component.ts`. Back: `core/planificador/planificador.service.ts`.
- Provincias fijas (l.51-56): Madrid, Barcelona, Valencia, Cádiz, Asturias y Málaga. **Faltan Alicante y Castellón**, y sólo Valencia tiene datos.
- Sólo pregunta: fechas, presupuesto y perro.
- El backend acepta `intereses`, pero el formulario no los pide.
- `serviciosDe` busca servicios cuya **ciudad** coincide con el nombre de la provincia, así que no encuentra los que están en otros municipios.

**Cambios**
1. **Provincias según los datos:** sacar la lista de un nuevo `GET /planificador/destinos`, que devuelve las provincias o ciudades con al menos un lugar o servicio publicado. Adiós a la lista fija.
2. **Más preguntas.** Es un asistente por pasos; sólo el destino y las fechas son obligatorios:
   - Destino: provincia y, opcionalmente, municipio.
   - Fechas.
   - Perro o perros: se precargan tamaño, edad y energía desde su perfil.
   - Intereses, varios a la vez: playa, montaña o ruta, río, parques, gastronomía, compras. Se conectan al campo `intereses`, que ya existe.
   - Ritmo del viaje: tranquilo, equilibrado o intenso. Cambia el nº de paradas por día (2, 3 o 4).
   - ¿Necesitas alojamiento? Sí / No / Ya lo tengo.
   - ¿Cómo te desplazas? Coche propio / Necesito transporte de mascota. Si elige lo segundo, se mete una parada de la vertical transporte.
   - ¿Necesitarás algún servicio durante el viaje? Peluquería, veterinario, guardería o paseos.
   - Presupuesto.
3. **Siempre termina en un servicio de la plataforma:**
   - `serviciosDe` filtra por `ubicacion.provincia` (o por las ciudades de la provincia), no por ciudad == provincia.
   - Si no hay servicios en la provincia, usar `buscarCercanos` alrededor del destino.
   - Tanto `generarConIA` como `generarSinIA` deben incluir **al menos un servicio reservable** por itinerario:
     - alojamiento, si lo ha pedido;
     - más los servicios de las preguntas.
   - Si no queda ninguno, la validación (`depurarOpcion`) inyecta el mejor valorado.
   - Al final del itinerario va el bloque «Reserva tu viaje», con las tarjetas de servicio (C2: botón «Reservar») y **«Añadir todo al carrito»**, que usa el `CarritoService` existente.
   - Las paradas de Explora enlazan a su ficha. Las tiendas (C8) aparecen como parada del tipo «compras».
4. **Prompts de DeepSeek:** incluir intereses, ritmo, desplazamiento y necesidades, e indicar que los `servicioId` son obligatorios.
5. **Caché:** la clave debe incluir las respuestas nuevas, para no devolver un itinerario de otra combinación.

**Tests:**
- `planificador.service.spec`: el itinerario contiene siempre un servicio, hay fallback a cercanos y el filtro es por provincia.
- Spec del componente para los pasos.

---

## C8 — Explora: restaurantes pet friendly y tiendas de animales (los dos PDF)

**Modelo**
1. `libs/shared/src/enums/lugar.enum.ts`: añadir **`TIENDA = 'tienda'`**, con la etiqueta «Tienda de animales». `restaurante` ya existe.
2. Front:
   - icono y pestaña en `explora-lista.component.ts:15-20`;
   - pin del mapa;
   - filtros;
   - traducciones en 7 idiomas.
3. Atributos que se guardan en `atributos`, que es un objeto libre y no obliga a tocar el schema:
   - Restaurantes:
     - `zonaAdmitida`: `interior | terraza | ambas | por_confirmar`
     - `condiciones`: por ejemplo «perros educados»
   - Tiendas: `cadena`, que puede ser `Miscota | Tiendanimal | Kiwoko`.
   - Ambos: `fuente` (TheFork, Guía Repsol, web oficial…) y `fechaFuente`.
     - `fuente` ya se retira de las lecturas públicas en `lugares.service.ts:33`.
   - La ficha pública muestra la zona admitida y, si es «por confirmar», el aviso «Confirma con el local antes de ir».

**Datos**
4. Pasar los PDF a un fichero versionado que alimente el script: `docs/datos/explora-cv-2026-09-24.json`.
   - Campos: `tipo`, `nombre`, `municipio`, `provincia`, `direccion`, `zonaAdmitida`, `fuente` y `fechaFuente`.
   - Son 94 filas.
   - El texto de los PDF ya está extraído y sólo hay que estructurarlo y revisarlo a mano: los nombres de municipio vienen en valenciano (Alacant, Castelló, Xàbia…) y se pasan por `resolver-municipio.ts` para canonizarlos.
5. Script `apps/api/src/scripts/sembrar-lugares-explora-json.ts`, basado en `sembrar-lugares-cv.ts`:
   - Upsert idempotente por `tipo + ciudad + nombre`.
   - `origenDatos = 'PDF 24-09-2026'`.
   - **Geocodifica por dirección completa**, no por el centroide del municipio como el seed anterior. Usa Google Places y Nominatim de respaldo, con la lógica que ya tiene el script.
   - Registra los que no geocodifiquen para revisarlos a mano.
   - Simula por defecto; se aplica con `--aplicar`.
   - Genera los slugs en la misma pasada, o después con `migrar:slugs-lugares`.
   - Nuevo script `sembrar:lugares-explora` en `apps/api/package.json`.
6. **Estado al importar:**
   - **Tiendas (62) → `publicado`:** vienen verificadas con fuente oficial.
   - **Restaurantes (32) → decisión pendiente:**
     - El PDF dice expresamente que es una «primera fase documental», que no se ha verificado por teléfono y que hay que confirmar con el local antes de publicar.
     - Recomendación: importarlos como **`pendiente`**. Así caen en la cola de moderación (`admin-comunidad.component.ts`) y se aprueban uno a uno tras la llamada.
     - Alternativa: publicarlos ya con el aviso «Admisión según fuente; confirma con el local».

**Tests:** spec del mapeo de filas a lugar (igual que `municipios-cv.spec`), incluidos los casos de municipio en valenciano y de zona «por confirmar».

---

## Orden de ejecución propuesto

| Fase | Bloques | Por qué en este orden |
|---|---|---|
| 1 | C2 (botón) · C1 (reclamo) · C6.1 (etiqueta de nota) | Rápidos y muy visibles. C6.1 es un fallo real. |
| 2 | C8 (tipo tienda + importación) | C5 y C7 se apoyan en esos datos. |
| 3 | C5 (búsqueda que nunca falla + `q` en lugares) | Depende del tipo `tienda` y de los sinónimos. |
| 4 | C6.2-C6.3 (nota en tarjeta + distancia al centro) | Toca schema, script de migración y geocodificación. |
| 5 | C4 (asistente en móvil) | Hay que probarlo en la app Capacitor. |
| 6 | C7 (planificador) | El bloque más grande; aprovecha C5, C6 y C8. |
| — | C3 | Bloqueado hasta tener el vídeo. |

Al terminar cada fase: `tsc` + `ng build` + `nest build` (rebuild de `shared` primero). La suite de tests completa se pasa en una sola vez al final.

## Decisiones pendientes del cliente
1. **C3:** reenviar el vídeo de WhatsApp (viernes, 3:27).
2. **C6.2:** nota en escala /5 (recomendado) o /10 como Booking.
3. **C8:** restaurantes como `pendiente` hasta confirmarlos por teléfono (recomendado) o publicados ya con aviso.
4. **C2:** ¿también «Reservar» en alojamiento y transporte, o sólo en las verticales de cita?
5. **C6.4:** ¿se mantiene el selector de moneda (USD/GBP/CHF) o se fija EUR?

---

## Implementación (2026-09-28)

Decisiones que se aplicaron siguiendo las recomendaciones de este plan: la nota va **sobre 5**; los **restaurantes entran pendientes** de moderación; **«Reservar»** está en todos los listados (citas, alojamiento y transporte); el **selector de moneda se mantiene** y los importes convertidos llevan «≈».

| Bloque | Qué cambió | Dónde |
|---|---|---|
| C1 | Reclamo con firma manuscrita («Siempre a su lado ♡»), lema en versales, icono propio sobre círculo lila. Tokens nuevos: `--dk-lila`, `--dk-lila-soft`, `--c-crema`, `--c-crema-borde` y `--font-script` (Caveat). Los reclamos ya pasan por `\| t`. | `verticales.config.ts`, `rs-listado.component.ts`, `styles.scss`, `index.html`, `public/icons/funerarios-reclamo.svg` |
| C2 | CTA «Reservar» en las tarjetas de citas, alojamiento y transporte. | `vertical-browse`, `alojamiento-lista`, `transporte-lista` |
| C4 | El asistente se ve también en móvil: círculo de 48 px encima de `--dk-nav-inferior-h` + `--dk-barra-reserva-h`, que se deduce con `:has()` de `.mobile-cta`, `.cf-movil` y `rs-barra-cta`. El panel abierto ocupa toda la pantalla. | `rs-asistente.component.ts`, `styles.scss` |
| C5 | `GET /lugares?q=`: todas las palabras primero y, si no hay resultados, basta con alguna. Ignora tildes y reconoce sinónimos de tipo. Explora amplía el filtro en cascada y avisa. El buscador de la portada manda a `/explora?q=` lo que no entiende, y también cuando falla la red. Se reconocen tiendas y más formas de «comer». | `lugares/busqueda-texto.ts`, `explora-lista`, `home.component.ts`, `interpretacion-local.ts` |
| C6.1 | Etiquetas de la nota en escala /5: `etiquetaPuntuacion` en shared. | `libs/shared/src/catalogos/puntuacion.ts` |
| C6.2 | Bloque de nota estilo Booking en la tarjeta apaisada: etiqueta, nº de reseñas y cuadrado azul con la nota. | `rs-card.component.ts`, `styles.scss` |
| C6.3 | Colección `centros_poblacion`, que se geocodifica una vez por población. `servicio.distanciaCentroKm` se calcula al crear el servicio o editar su ubicación. La tarjeta muestra «a X km del centro». | `geo/centros-poblacion.*`, `catalog.service.ts`, `shared/distancia.ts` |
| C6.4 | Importes convertidos con «≈» delante. | `core/moneda/importe.ts` |
| C7 | `GET /planificador/destinos`: provincias con contenido. Preguntas nuevas: municipio, intereses, ritmo, alojamiento, desplazamiento y servicios extra. Nº de días según las fechas. Servicios buscados por provincia; si no hay, alrededor (80 km). Toda opción acaba en un servicio. Bloque «Reserva tu viaje» con «Añadir todo al viaje». | `planificador/armar-itinerario.ts`, `planificador.service.ts`, `planificador.component.ts`, `shared/enums/planificador.enum.ts` |
| C8 | Tipo `tienda`, `ZonaAdmitidaLugar`. 94 fichas en `docs/datos/explora-cv-2026-09-24.json`. Script de importación que geocodifica por dirección. | `lugar.enum.ts`, `lugares/explora-cv.ts`, `scripts/sembrar-lugares-explora.ts` |

### Pendiente de ejecutar en producción

1. `bun run --cwd apps/api sembrar:lugares-explora -- --aplicar`
   - Publica las 62 tiendas y deja los 32 restaurantes pendientes de moderación.
   - Al final lista los que no se pudieron situar por dirección, para revisarlos a mano.
2. Aprobar los restaurantes uno a uno desde **Admin → Comunidad**, después de llamar al local (protocolo del PDF).
3. `bun run --cwd apps/api recalcular:distancia-centro -- --aplicar`
   - Rellena «a X km del centro» en los servicios anteriores que ya tienen coordenadas.
4. Desplegar. La captura de «playa» es anterior a `afc3ce3`; con este despliegue, cualquier texto acaba en Explora.

### Limitaciones conocidas

- En móvil la tarjeta oculta la línea de población (`.rs-hotel-card__meta-loc`, decisión anterior para que quepan 4 resultados por pantalla). Por eso en móvil tampoco se ve la distancia al centro, sólo el cuadrado de la nota.
- Las tiendas no tienen fotos propias: usan el respaldo genérico de Explora hasta que se suban.
- **C3** sigue bloqueado hasta recibir el vídeo de WhatsApp.
