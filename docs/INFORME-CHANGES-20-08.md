# Informe de estado — Feedback cliente 2026-08-20

Revisión de `docs/changes-20-08.md` contra el código de la plataforma.
Análisis: 2026-08-20 · **Actualizado** con las respuestas del cliente a las 7 dudas abiertas.

> Plan de ejecución de lo pendiente: **`docs/PLAN-CHANGES-20-08.md`**.

> **Estado a 2026-08-20, tras ejecutar el plan:** 22 de los 23 puntos cerrados.
> Sólo queda **B7**, bloqueado a la espera de que el cliente envíe la fotografía.
> El detalle de cada punto, más abajo, describe el estado **previo** a la
> ejecución; lo implementado después está en `docs/PLAN-CHANGES-20-08.md`.

## Resumen

| Estado | Nº | Puntos |
|---|---|---|
| ✅ Ya estaba hecho | 12 | A1, A2, A3, A4, A5, A6, B1, B3, B4, B5, B8, B9 |
| ✅ Implementado ahora | 10 | B2, B6, B10, B11, B12, B13, B14, B15, B16, B17 |
| ⛔ Bloqueado (falta asset) | 1 | B7 |

**Nota:** los commits `13b0a59` ("changues mobile") y `c7b31eb` ("Feat") son de hoy mismo y ya cubren buena parte del bloque de portada, buscador y móvil (el buscador cita literalmente "feedback 2026-08-20" en un comentario). Queda **trabajo sin commitear** en el árbol que cubre A1.

### Respuestas del cliente que cierran puntos

| Pregunta | Respuesta | Efecto |
|---|---|---|
| ¿Se quita también el tipo de pelo de Peluquería? | **No** | A6 → ✅ cerrado |
| ¿Home tipo Booking cubierto? | **Ya está hecho** | B4 → ✅ cerrado |
| ¿"Explora" también en buscador/menú? | **No es reservable, es informativo** | B5 → ✅ cerrado |
| ¿Qué foto se cambia? | **La de "¿Por qué Doogking?"** | B7 → alcance fijado |
| ¿Buscador en iPhone? | **Ya está hecho** | B9 → ✅ cerrado |
| ¿Faltan opciones en los 3 puntos? | **No, es el overflow** | B13 → solo el arreglo CSS |
| ¿Cambiar también el texto de login/registro? | **No** | B11 → solo la portada |

---

## Grupo A — Revisados con Ale y Edgar

### A1 · No suben las fotos en formato iPhone — ✅ HECHO (pendiente de commit)

Commit `5976361` + trabajo en el árbol de trabajo.

- `apps/web/src/app/shared/media/preparar-imagen.ts` — conversión HEIC→JPEG por canvas, orientación EXIF con reintento para iOS 15 (`imageOrientation: 'from-image'` lanza `TypeError` en Safari < 16), decodificación de respaldo por etiqueta `<img>`, escalado progresivo hasta caber bajo el tope, margen de 128 KB porque `MaxFileSizeValidator` de Nest compara con `<`.
- `rs-image-upload.component.ts:126` — el `accept` pasa a `image/*` a secas: al declarar `.heic/.heif` se le decía a iOS "acepto HEIC" y entregaba el original sin convertir. Sin esas extensiones lo convierte iOS, que lo hace mejor.
- Preparación en serie (no en paralelo) para no agotar la memoria de un iPhone; el envío sí se solapa.
- Mensajes de error accionables por causa: archivo vacío (iCloud), HEIC sin convertir, demasiado grande.
- Mismo control en los documentos de verificación (`comercio-config.component.ts:1738`).

**Acción:** commitear y verificar en un iPhone real.

### A2 · Al pulsar continuar en guardar contacto, que pase a la siguiente — ✅ HECHO

`comercio-config.component.ts:459` → `(ngSubmit)="continuar(guardarContacto())"`.
`continuar()` (`:1649`) guarda y salta al siguiente paso salvo que sea el último. El botón dice "Guardar y continuar" / "Guardar y finalizar". Aplica a todos los pasos del asistente, no solo a contacto.

### A3 · Google Maps en ubicación — ✅ HECHO

`comercio-config.component.ts:359` autocompletado con `rs-place-autocomplete`; `:424` mapa de comprobación `<rs-mapa>`; `:431` botón "Comprobar en Google Maps".
Motor Google Maps con respaldo a OpenStreetMap si no hay clave o falla (`rs-mapa.component.ts:231-246`).

**Ojo:** en producción hace falta la clave de Google configurada (`GeoService.claveMapas()`), o cae al respaldo de Leaflet.

### A4 · Horarios partidos se ven cortados en mobile — ✅ HECHO

`comercio-config.component.ts:1450-1472` — `@media (max-width: 768px)` que convierte cada día en tarjeta, apila los tramos (Mañana / Tarde) y pasa los campos de hora de `width: 130px` a `flex: 1; min-width: 0`. El comentario documenta el diagnóstico (4 campos × 130px ≈ 700px no caben en 390px).

### A5 · En días especiales que pueda seleccionar varios — ✅ HECHO

`comercio-config.component.ts:671-695` — calendario mensual multi-selección: `alternarDiaExcepcion()` (`:1866`) gestiona un `Set` de días, más "Marcar el mes entero" (`:1878`) y "Quitar la selección". Se aplica un mismo motivo/horario a todos los días marcados de golpe.

### A6 · Quitar tipo de pelo de la creación de servicios — ✅ HECHO

Quitado del bloque **Aptitud** del formulario. `comercio-listado-form.component.ts:1608-1613` lo documenta: el campo ya no se edita, pero se conserva y se reenvía para no borrar lo que hubiera guardado un comercio antiguo.

El "Tipo de pelo compatible" de cada servicio de grooming en **Peluquería** (`:689`) **se mantiene** por decisión del cliente: ahí condiciona precio y duración.

---

## Grupo B — Revisados con Ale

### B1 · En políticas de cancelación falta descripción — ✅ HECHO

`comercio-listado-form.component.ts:363-388` — tarjetas de radio con nombre + descripción completa y una opción "Sin especificar".
Textos en `shared/catalogos/politicas-cancelacion.catalogo.ts` (fuente única: Flexible / Moderada / Estricta, cada una con `descripcion` y `resumen`).

### B2 · Cambiar "Listado" por "Servicio" en todo el módulo — ⬜ PENDIENTE

Hecho: menú lateral "Servicios" (`comercio-layout.component.ts:27`), título "Mis servicios" (`comercio-listados.component.ts:40`), botones "Crear servicio" / "Pausar servicio" / "Publicar servicio".

Falta (texto visible al usuario):

| Archivo | Línea | Texto actual |
|---|---|---|
| `comercio-listado-form.component.ts` | 115 | "Volver a listados" |
| `comercio-listado-form.component.ts` | 176 | "…después de crear el listado" |
| `comercio-listado-form.component.ts` | 1262 | "El listado se creará en estado Borrador… sección de listados" |
| `comercio-listado-form.component.ts` | 2334 | "¡Listado creado en borrador!" |
| `comercio-listado-form.component.ts` | 2338 | "Error al guardar el listado" |
| `comercio-listado-form.component.ts` | 2056 | "No se pudo cargar el listado" |
| `comercio-listados.component.ts` | 361 | "Error al cargar los listados" |
| `comercio-config.component.ts` | 98 | "Listados destacados en el buscador" |
| `comercio-config.component.ts` | 280 | "visibles en tus listados y en tu perfil" |
| `comercio-config.component.ts` | 455 | "no visible públicamente en los listados" |
| `comercio-config.component.ts` | 1020 | "Categorías de servicio en las que puedes publicar listados" |
| `comercio-config.component.ts` | 2160-2162 | "Listados ilimitados" / "Hasta 20 listados" / "Hasta 3 listados" |

Las rutas (`/comercio/listados`) y los nombres de clase/archivo se quedan: no los ve el cliente y renombrarlos rompería enlaces guardados.

### B3 · Quitar paseadores del buscador — ✅ HECHO

`verticales.config.ts:186` — `fueraDelEscaparate: true` en `CUIDADORES`; `VERTICALES_PUBLICOS` (`:207`) filtra por esa marca.
Lo consumen el buscador (`rs-search-bar.component.ts:357`), la navbar (`rs-navbar.component.ts:428`) y la portada (`home.component.ts:1566`). Los paneles de admin y comercio siguen viendo la lista completa, que es lo correcto.

### B4 · Modificación del home tipo booking — ✅ HECHO

Rehecho hoy en `c7b31eb`: hero en dos zonas (`hero__top` / `hero__main` / `hero__cap`), buscador sobre navy como elemento de más contraste, navbar en pastillas con icono al estilo de las pestañas de servicio de Booking. Confirmado por el cliente.

### B5 · Agregar "Explora con tu mascota" a las opciones de categoría — ✅ HECHO

`home.component.ts:205-216` — tarjeta destacada `cat-card--explora` en la rejilla de categorías de la portada, enlazando a `/explora`.
No va en el buscador ni en la navbar **a propósito**: no es reservable, es informativo (confirmado por el cliente). El propio código ya lo razona así en el comentario de esa tarjeta.

### B6 · Que salgan solo iconos en el mapa — ⬜ PENDIENTE

`shared/components/mapa/motores/pin-html.ts:23-27` — el pin se pinta con `punto.etiqueta`, que es el **precio**:
```ts
const etiqueta = escapar(punto.etiqueta ?? '·');
… <button class="rs-pin">${etiqueta}</button>
```
Hay que sustituirlo por el icono de la categoría. Ya existen los SVG de marca en `public/icons` (`CATEGORIA_ICONOS`). El precio se queda en la tarjeta emergente (`htmlTarjeta`, mismo archivo), que ya lo muestra.

`PuntoMapa` (`motor-mapa.ts:2-12`) no lleva hoy el vertical: hay que añadirlo y que lo rellenen sus dos productores (`alojamiento-lista.component.ts:156` y `vertical-browse.component.ts:366`).

### B7 · Cambiar foto de perro largo por foto con familia — ⬜ PENDIENTE (falta el asset)

Confirmado por el cliente: es la del bloque **"¿Por qué Doogking?"**.

`shared/media/images.ts` → `BANDA_POR_QUE`:
```ts
movil:      '/images/hero-home.jpg',
escritorio: '/images/alojamiento-exterior.jpg',
```
Son **dos** encuadres a propósito (la banda de escritorio es muy apaisada y recorta casi todo el alto). Hacen falta las dos versiones, o una sola lo bastante alta para recortarla.

**Bloqueado hasta que el cliente envíe la fotografía.**

### B8 · Arreglar el scroll lateral en mobile — ✅ HECHO

`styles.scss:158-200` — red de seguridad con `overflow-x: clip` en `html` **y** en `body` (con `hidden` de respaldo para navegadores viejos), y el razonamiento de por qué `clip` y no `hidden` (no romper los `sticky`).
En `c7b31eb` se redujo además el `gap` de la navbar de `--sp-8` a `--sp-4` "para que las 7 entradas quepan sin activar el scroll lateral" (`styles.scss:361`).

### B9 · Reparar comportamiento del buscador en iPhone — ✅ HECHO

Confirmado por el cliente. `rs-search-bar.component.ts:307-311` fija objetivos táctiles de 44px y texto de 16px para que iOS no haga zoom al enfocar; la fila de categorías pasó a mostrarse solo en móvil (`:341-347`), donde es el único acceso rápido.

### B10 · Preguntas frecuentes y valoración al finalizar el proceso — ⬜ PENDIENTE

La pantalla de confirmación (paso 4) está en `reserva-wizard.component.ts:1002-1055`: código de reserva, resumen, gancho de "¿Completamos el viaje?" y dos botones. **No hay ni FAQ ni valoración.**
El único FAQ del proyecto está en `features/ayuda/ayuda.component.ts`, en otra página.

Para la valoración ya existe la vía: el wizard inyecta `EventosService` (`:1385`) y `RegistrarEventoDto` admite un `payload` libre (`eventos.controller.ts:51`). Basta añadir un `TipoEvento` nuevo.
Ojo: **no** es una reseña del servicio (ese flujo ya existe aparte, por correo, en `reviews` + `growth`); el servicio todavía no se ha prestado. Es la satisfacción con el proceso de reserva.

### B11 · "¿Tienes un negocio canino?" → "¿Ofreces servicios para mascotas?" — ⬜ PENDIENTE

`home.component.ts:399`
```html
<h2 class="pro-cta__title">¿Tienes un negocio canino?</h2>
```
**Solo la portada.** Login (`:109`) y registro (`:126`) se quedan como están, por decisión del cliente.

### B12 · Footer: nueva estructura + iconos de las tiendas — ⬜ PENDIENTE

Estado actual (`home.component.ts:431-508`):
- Logo y redes sociales están juntos, **pero dentro de la primera columna de un grid**, no como bandas centradas sobre el resto.
- Los servicios son una **lista vertical** en una columna (`rs-footer__col`), no horizontales.
- Las tiendas son **texto**: "Próximamente en App Store" / "Próximamente en Google Play" con iconos genéricos `smartphone` y `play` (`:489-491`). No existen los badges oficiales: `grep -i "app-store|google-play"` en `apps/web` no devuelve nada.

Falta reestructurar a bandas (logo → redes → servicios en horizontal) y añadir los assets de los badges oficiales.

### B13 · En "Mis servicios" no se ven las opciones en los 3 puntos — ⬜ PENDIENTE (causa localizada)

Confirmado por el cliente: **es el overflow**, no faltan opciones.

- `.listado-card` es una `.rs-card`.
- `styles.scss:636-641` → `.rs-card { … overflow: hidden; }`
- `.mas-opciones__menu` (`comercio-listados.component.ts:293`) es `position: absolute; top: calc(100% + 4px)` → cae fuera de la tarjeta y el padre lo recorta.

El menú se queda con su única opción actual (Pausar / Publicar).

### B14 · Símbolo de euro al final en todos los lugares — ⬜ PENDIENTE

Unas **50 ocurrencias con el € delante** en 14 archivos:

`alojamiento-detalle.component.ts`, `alojamiento-lista.component.ts`, `favoritos.component.ts`, `home.component.ts`, `admin-reportes.component.ts`, `comercio-reservas.component.ts`, `comercio-suplementos.component.ts`, `ajuste-pago.component.ts`, `mis-reservas.component.ts`, `reserva-detalle.component.ts`, `reserva-wizard.component.ts`, `transporte-lista.component.ts`, `vertical-browse.component.ts`, `vertical-detalle.component.ts`.

Ejemplos: `alojamiento-detalle.component.ts:231` `€{{ esp.precioNoche }}`; `reserva-wizard.component.ts` `€{{ total() }}`; `admin-reportes.component.ts:152` `€ {{ … }}`.

Convive con sitios que **ya** lo hacen bien (`favoritos.component.ts:99` → `{{ … }} €`, todo `admin-pagos` y `admin-analitica`): hoy la app es incoherente consigo misma.

Se resuelve con un pipe único, no parcheando archivo a archivo.

### B15 · Descripción de la cancelación en el detalle de alojamiento — ⬜ PENDIENTE

`alojamiento-detalle.component.ts:288`
```html
<p>{{ alojamiento()!.politicaCancelacion }}</p>
```
Pinta el valor **crudo** (`flexible`, `moderada`, `estricta`). El catálogo ya tiene el texto que el cliente pide en `descripcion`, y una función `describirPolitica()` (`politicas-cancelacion.catalogo.ts:44`) que devuelve el resumen.

### B16 · Cambiar Check-in / Check-out por Entrada y Salida — ⬜ PENDIENTE

- Los títulos del acordeón del detalle ya dicen "Entrada" y "Salida" (`alojamiento-detalle.component.ts:263`, `:276`).
- Dentro sigue el texto `<strong>Check-in:</strong>` (`:266`) y `<strong>Check-out:</strong>` (`:279`).
- **En la reserva**, que es donde se pidió: `reserva-wizard.component.ts:222`, `:226`, `:730`, `:734`.
- `reserva-detalle.component.ts:14` → `'Entrada / check-in'`, `'Salida / check-out'`.

Los nombres de campo del formulario y del API (`checkIn`, `checkOut`) no se tocan.

### B17 · Paso 2 en reserva, que llene los datos automáticamente — ⬜ PENDIENTE

`reserva-wizard.component.ts:1698-1707` — `paso2Form` arranca **vacío**. El componente **no inyecta `AuthService`** (ver `inject()` en `:1373-1385`) y no hay ningún `paso2Form.patchValue(...)` con datos del usuario.

Existe `GET /users/me` (`users.controller.ts:46`) y `AuthService.usuario()` con `nombre` y `email`. **No hay `apellidos`** en el modelo de usuario: el wizard los pide por separado, así que hay que partir `nombre` por el primer espacio y dejar ambos campos editables.
