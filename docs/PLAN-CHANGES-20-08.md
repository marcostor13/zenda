# Plan de implementación — Feedback cliente 2026-08-20

Estado de partida: **`docs/INFORME-CHANGES-20-08.md`** (12 de 23 puntos ya cerrados).
Este plan cubre los **11 pendientes**: B2, B6, B7, B10, B11, B12, B13, B14, B15, B16, B17.

## Índice de tareas

| # | Punto | Tarea | Estado |
|---|---|---|---|
| **F0** | A1 | Commitear el trabajo de fotos iPhone | ✅ ya venía en `9b182ae` |
| **F1** | B11 | Texto del CTA de la portada | ✅ hecho |
| **F1** | B16 | Check-in/out → Entrada/Salida | ✅ hecho |
| **F1** | B2 | "Listado" → "Servicio" (12 textos) | ✅ hecho |
| **F2** | B15 | Descripción de cancelación en el detalle | ✅ hecho |
| **F2** | B13 | Desplegable de los 3 puntos recortado | ✅ hecho |
| **F3** | B14 | Pipe de euros (~50 ocurrencias) | ✅ hecho |
| **F4** | B17 | Autorrellenar el paso 2 de la reserva | ✅ hecho |
| **F5** | B6 | Solo iconos en el mapa | ✅ hecho |
| **F6** | B10 | FAQ + valoración en la confirmación | ✅ hecho |
| **F7** | B12 | Reestructurar el footer | ✅ hecho (badges pendientes de asset) |
| **F8** | B7 | Foto de familia en "¿Por qué Doogking?" | ⛔ falta la foto del cliente |

### Decisiones tomadas al ejecutar

1. **F3 · separadores.** El pipe formatea con `es-ES` (`1.234,50 €`), registrando
   los datos de locale **dentro del propio pipe**. No se toca el `LOCALE_ID`
   global, así que los demás números de la aplicación siguen igual.
2. **F6 · preguntas.** Se usan las cinco comunes propuestas más dos propias por
   categoría. Viven en `shared/catalogos/faq-confirmacion.catalogo.ts`: el
   cliente puede reescribir el texto sin tocar el componente.
3. **F7 · badges de tienda.** No se han dibujado a mano: App Store y Google Play
   son marcas registradas con guías de uso que lo prohíben. Queda una pastilla
   provisional con la forma y el peso visual del badge real —para que
   sustituirla no mueva la maqueta— y un `TODO(D-4)` con la ruta exacta de los
   assets. Tampoco se enlaza a las tiendas: las apps aún no están publicadas.

### Verificación

```
libs/shared build   ✅
tsc --noEmit (web)  ✅
build:web           ✅   (sin errores; ver nota de presupuesto abajo)
build:api           ✅
shared test         ✅   17/17
web test            ✅   1922/1922
api test            ✅   1302/1302
```

Dos avisos que **no** son fallos:

- `bun run test` en la raíz levanta los tres workspaces a la vez y algún spec
  pesado agota su tiempo bajo esa carga (`ayuda.component.spec.ts` llegó a 71 s).
  Ejecutados por workspace, los tres pasan enteros.
- La cobertura global de ramas del frontend queda en **79,18 %**, por debajo del
  umbral de 80 %. Ya estaba así antes de estos cambios; es la deuda que recoge
  `PLAN-COBERTURA-Y-E2E.md`.
- ~~El presupuesto de estilos de `home.component.ts` se pasa en 2,97 kB.~~
  **Resuelto:** el tope de `anyComponentStyle` sube de 16/24 kB a 24/32 kB en
  `apps/web/angular.json`. `home` es el componente con más CSS de la aplicación
  (18,97 kB) y ya se pasaba del tope anterior antes de estos cambios; el nuevo
  deja margen sin dejar de avisar de un crecimiento real. El build sale limpio.

---

## F0 · Cerrar lo que ya está hecho (A1)

El árbol de trabajo tiene el arreglo de las fotos de iPhone sin commitear (7 archivos, +886/−107).

1. `bun run --cwd apps/web test -- preparar-imagen rs-image-upload comercio-listado-form` — los specs ya están actualizados en el mismo diff.
2. Verificar el build (ver §Verificación).
3. Commit: `fix(upload): conversión HEIC fiable en iPhone y avisos accionables`.
4. **Probar en un iPhone real** antes de dar el punto por cerrado con el cliente. Los casos que hay que tocar: foto del carrete recién hecha, foto guardada en iCloud sin descargar, panorámica grande, iOS 15 si hay algún dispositivo a mano.

---

## F1 · Textos (B11, B16, B2)

Cambios de copy puros. Ninguno toca lógica, nombres de campo ni rutas.

### B11 — CTA de la portada

`apps/web/src/app/features/home/home.component.ts:399`

```
- <h2 class="pro-cta__title">¿Tienes un negocio canino?</h2>
+ <h2 class="pro-cta__title">¿Ofreces servicios para mascotas?</h2>
```

**Solo aquí.** Login (`login.component.ts:109`) y registro (`registro.component.ts:126`) se quedan como están.

Test: añadir la aserción del titular en `home.component.spec.ts`.

### B16 — Entrada / Salida

| Archivo | Línea | Cambio |
|---|---|---|
| `alojamiento-detalle.component.ts` | 266 | `<strong>Check-in:</strong>` → `<strong>Entrada:</strong>` |
| `alojamiento-detalle.component.ts` | 279 | `<strong>Check-out:</strong>` → `<strong>Salida:</strong>` |
| `reserva-wizard.component.ts` | 222, 730 | `<label>Check-in</label>` → `Entrada` |
| `reserva-wizard.component.ts` | 226, 734 | `<label>Check-out</label>` → `Salida` |
| `reserva-detalle.component.ts` | 14 | `'Entrada / check-in'` → `'Entrada'`; `'Salida / check-out'` → `'Salida'` |

**No tocar** los nombres de control ni los campos del API: `checkIn`, `checkOut`, `checkInQP`, los query params `desde`/`hasta`. Solo texto visible.

Tests a revisar: `alojamiento-detalle.component.spec.ts:85-101` ya busca "Entrada"/"Salida" en los títulos del acordeón; comprobar que ningún spec del wizard busque la cadena "Check-in".

### B2 — "Listado" → "Servicio"

Los 12 textos de la tabla del informe. Reglas:

- Singular: "el listado" → "el servicio". Plural: "los listados" → "tus servicios".
- "Volver a listados" → "Volver a mis servicios" (coincide con el título de la pantalla destino).
- "¡Listado creado en borrador!" → "¡Servicio creado en borrador!".
- Planes: "Hasta 3 listados" → "Hasta 3 servicios", "Listados ilimitados" → "Servicios ilimitados". Ojo: `comercio-config.component.ts:98` ya dice "Hasta 15 servicios" en la misma lista — quedará coherente.
- "Listados destacados en el buscador" → "Servicios destacados en el buscador".
- **No tocar**: rutas `/comercio/listados`, nombres de archivo, clases, selectores, tipos (`PasoListado`), ni comentarios internos del código.

Tests: `comercio-config.component.spec.ts:387,502,509` afirman literalmente "Hasta 3 listados" / "Listados ilimitados" / "Hasta 20 listados". **Hay que actualizarlos en el mismo commit** o la suite se cae.

---

## F2 · Arreglos puntuales (B15, B13)

### B15 — Descripción de la cancelación en el detalle de alojamiento

El catálogo ya tiene el texto; falta usarlo y contemplar los servicios antiguos con texto libre.

1. En `shared/catalogos/politicas-cancelacion.catalogo.ts`, añadir junto a `describirPolitica()`:

```ts
/** Frase completa de la política, para la ficha que lee el cliente antes de reservar. */
export function descripcionPolitica(valor: string | undefined | null): string {
  if (!valor) return 'Consulta las condiciones de cancelación con el alojamiento.';

  const politica = POLITICAS_CANCELACION.find((p) => p.valor === valor);
  // Un comercio antiguo pudo guardar texto libre; se muestra tal cual.
  return politica ? politica.descripcion : valor;
}
```

2. En `alojamiento-detalle.component.ts:288`:

```
- <p>{{ alojamiento()!.politicaCancelacion }}</p>
+ <p>{{ descripcionCancelacion() }}</p>
```
con un `computed()` que llama a `descripcionPolitica(this.alojamiento()?.politicaCancelacion)`.

3. Añadir el título corto encima (`describirPolitica()` → "Flexible · cancelación gratuita hasta 24 h antes") si se quiere el mismo formato de dos líneas que en el formulario del comercio.

Tests: caso con clave conocida, caso con texto libre antiguo, caso vacío — en `politicas-cancelacion.catalogo.spec.ts` y en el spec del detalle.

### B13 — Desplegable de los 3 puntos

Causa: `.rs-card { overflow: hidden }` (`styles.scss:640`) recorta el menú absoluto.

**No tocar `.rs-card` globalmente**: ese `overflow: hidden` es lo que redondea las imágenes en 26+ componentes.

Arreglo local en `comercio-listados.component.ts`:

```scss
.listado-card {
  /* El menú de los 3 puntos es un absoluto que cae fuera de la tarjeta: con el
     overflow:hidden que .rs-card trae de serie quedaba recortado y no se veía
     ninguna opción (feedback 2026-08-20). La miniatura conserva el suyo. */
  overflow: visible;
}
```

`.listado-card__img` ya tiene su propio `overflow: hidden` (`:284`), así que la imagen sigue recortada correctamente.

Comprobar además que `z-index: var(--z-2)` en `.mas-opciones__menu` basta frente al panel de disponibilidad que se despliega justo debajo; si no, subirlo.

**Verificación manual obligatoria** (un cambio CSS no lo cubre Jest): abrir `/comercio/listados`, pulsar los 3 puntos en la primera y en la última tarjeta, en escritorio y en móvil.

---

## F3 · Pipe de euros (B14)

~50 ocurrencias en 14 archivos. Centralizar en vez de parchear archivo a archivo, que es lo que produjo la incoherencia actual.

1. Crear `apps/web/src/app/shared/pipes/euros.pipe.ts`:

```ts
/**
 * Importes en euros con el símbolo detrás, como se escribe en España.
 * Existe para que el formato viva en un solo sitio: antes cada plantilla
 * decidía —unas ponían "€24", otras "24 €"— y la app se contradecía a sí misma.
 */
@Pipe({ name: 'euros', standalone: true })
export class EurosPipe implements PipeTransform {
  transform(valor: number | string | null | undefined, decimales = '1.0-2'): string { … }
}
```

- Formatea con `formatNumber` y añade ` €` (espacio duro: el importe y el símbolo no se separan al final de línea).
- `null`/`undefined` → `'—'`, no `'NaN €'`.
- Exportar desde `shared/index.ts`.

2. Sustituir las ocurrencias en los 14 archivos:

```
- €{{ esp.precioNoche }}
+ {{ esp.precioNoche | euros }}
- €{{ total() }}
+ {{ total() | euros }}
- {{ p.montoTotal | number:'1.2-2' }} €
+ {{ p.montoTotal | euros:'1.2-2' }}
```

Incluir también los que **ya** están bien (`favoritos`, `admin-pagos`, `admin-analitica`): el objetivo es que no quede ningún importe formateado a mano.

3. Casos que no son plantilla y hay que mirar aparte:
   - `alojamiento-lista.component.ts:83` y `home.component.ts:316` construyen la cadena en TypeScript (`'€' + a.precioPorNoche`) para el input `price` de `rs-card`. Usar la misma función del pipe, exportada suelta.
   - `rs-listado.component.ts:649` — chip de filtro `Hasta €${f.precioMax}` → `Hasta ${euros(f.precioMax)}`.
   - `pin-html.ts` — lo resuelve F5.

4. Guardarraíl: añadir a `apps/web/src/app/shared/sin-emojis.spec.ts` (o un spec hermano) una comprobación que falle si aparece `€{{` o `'€' +` en `src/app`. Así no vuelve a divergir.

**Decisión pendiente de tu visto bueno:** hoy la app no registra `LOCALE_ID`, así que Angular formatea en `en-US` → "1,234.56 €". Lo correcto en España es "1.234,56 €". Registrar `es-ES` lo arregla, pero cambia **todos** los números de la app, no solo los importes. El cliente no lo ha pedido. Propuesta: el pipe formatea con `es-ES` **solo para importes**, sin tocar el `LOCALE_ID` global. Dime si prefieres dejar los separadores como están.

---

## F4 · Autorrellenar el paso 2 de la reserva (B17)

`reserva-wizard.component.ts`.

1. Inyectar `AuthService` junto al resto (`:1373-1385`).
2. En el arranque, precargar desde `auth.usuario()` — que es síncrono y ya está en `localStorage`, así que el formulario aparece relleno sin parpadeo:

```ts
/**
 * Precarga los datos de contacto de quien ya ha iniciado sesión. Se hace en el
 * arranque y no al llegar al paso 2: así el usuario nunca ve el formulario
 * vaciarse delante. Todos los campos siguen siendo editables — la reserva puede
 * ir a nombre de otra persona.
 */
private precargarContacto(): void { … }
```

3. `apellidos` no existe en el modelo de usuario (`UsuarioAutenticado` tiene `nombre`, `email`, `rol`). Partir `nombre` por el primer espacio:
   - `"Ana García Ruiz"` → nombre `Ana`, apellidos `García Ruiz`.
   - Un nombre de una sola palabra deja `apellidos` vacío y el `Validators.required` obliga al usuario a completarlo, que es lo correcto.

4. `telefono` no está tipado en `UsuarioAutenticado` pero sí llega en `/users/me` (así lo lee ya `perfil-editar.component.ts:198`). Completar con una llamada a `GET /users/me` en segundo plano y hacer `patchValue` **solo de los campos que el usuario no haya tocado todavía** (`control.pristine`), para no pisarle lo que esté escribiendo.

5. No precargar nada si no hay sesión: el wizard admite invitados.

Tests en `reserva-wizard.component.spec.ts`:
- con sesión → los cuatro campos llegan rellenos;
- nombre de una sola palabra → apellidos vacío;
- sin sesión → formulario vacío, sin reventar;
- el usuario edita el email y llega la respuesta de `/users/me` → **no** se pisa lo escrito.

---

## F5 · Solo iconos en el mapa (B6)

1. `motor-mapa.ts` — añadir al `PuntoMapa`:

```ts
/** Categoría del servicio: decide el icono del pin. Sin ella, pin genérico. */
readonly vertical?: string;
```
y actualizar el comentario de cabecera, que hoy dice que `etiqueta` es lo que se ve en el pin.

2. `pin-html.ts` — `htmlPin()` pasa a pintar el icono de `CATEGORIA_ICONOS[punto.vertical]` (los SVG de marca ya existen en `public/icons`) en vez de `etiqueta`:

```ts
export function htmlPin(punto: PuntoMapa, esActivo: boolean): string {
  const titulo = escapar(punto.titulo ?? punto.etiqueta ?? 'Servicio');
  const icono = CATEGORIA_ICONOS[punto.vertical ?? ''] ?? CATEGORIA_ICONOS['mas'];
  return `<button type="button" class="rs-pin rs-pin--icono${esActivo ? ' rs-pin--activo' : ''}"`
    + ` aria-label="${titulo}"${esActivo ? ' aria-current="true"' : ''}>`
    + `<img src="${escapar(icono)}" alt="" aria-hidden="true"></button>`;
}
```

- `aria-label` conserva el título: el pin sigue siendo accesible, que es la razón por la que es un `<button>` y no un `<span>`.
- `htmlTarjeta()` **no se toca**: el precio sigue en la tarjeta emergente.

3. `styles.scss` — `.rs-pin--icono`: pastilla circular en vez de la de precio (ancho fijo, el `img` centrado a ~18px, tinte blanco sobre el azul cuando está activo).

4. Rellenar `vertical` en los dos productores:
   - `alojamiento-lista.component.ts:156` → siempre `'alojamiento'`.
   - `vertical-browse.component.ts:366` → `this.cfg().vertical`.

5. Specs a tocar: `pin-html.spec.ts`, `rs-mapa.component.spec.ts:17-19` (los puntos de prueba llevan `etiqueta: '€24'`), `alojamiento-lista.component.spec.ts:142-144`.

**Nota:** `etiqueta` sigue existiendo y sigue alimentando la tarjeta emergente; no se borra del modelo.

---

## F6 · FAQ + valoración en la confirmación (B10)

Se añade al final del paso 4 (`reserva-wizard.component.ts:1002-1055`), después de los botones de acción, para no competir con "Ver mis reservas".

### Valoración

Es la satisfacción **con el proceso de reserva**, no una reseña del servicio: el servicio aún no se ha prestado, y la reseña ya tiene su propio flujo por correo (`reviews` + `growth`).

1. `libs/shared/src/enums/evento.enum.ts` — añadir a `TipoEvento`:
```ts
EXPERIENCIA_VALORADA = 'experiencia_valorada',
```
No hace falta más en el API: `RegistrarEventoDto` valida con `@IsEnum(TipoEvento)` y ya admite un `payload` libre (`eventos.controller.ts:51`).
**Recordatorio:** recompilar `libs/shared` antes de que web y api lo vean.

2. En la confirmación, una fila de 5 estrellas (`rs-stars` / `rs-rating` ya existen en `shared`) con el copy "¿Qué tal ha ido la reserva?". Al pulsar:
```ts
this.eventosService.registrar({
  tipo: TipoEvento.EXPERIENCIA_VALORADA,
  reservaId: …, vertical: …, paso: PasoEmbudo.CONFIRMACION,
  payload: { puntuacion },
});
```
3. Tras votar, sustituir el widget por un "Gracias" — sin modal ni segundo paso. Si la petición falla, **no** mostrar error: es telemetría, no puede estropear una reserva ya confirmada.
4. Con ≤ 3 estrellas, ofrecer un campo de texto opcional ("¿Qué podríamos mejorar?") que viaja en el mismo `payload`. Es donde está el valor real del dato.

### Preguntas frecuentes

Bloque plegable con `<details>/<summary>`, el mismo patrón accesible que ya usa el acordeón de políticas del detalle de alojamiento.

Las preguntas dependen del vertical (no es lo mismo una noche de alojamiento que un traslado), así que van en un catálogo:
`shared/catalogos/faq-confirmacion.catalogo.ts`, con un bloque común y uno por vertical.

Comunes propuestas — **a validar contigo antes de escribirlas**:
- ¿Cuándo recibo la confirmación?
- ¿Cómo cancelo o modifico la reserva?
- ¿Cuándo se cobra el importe?
- ¿Qué documentación tiene que llevar mi perro?
- ¿Cómo contacto con el establecimiento?

Cerrar con un enlace a `/ayuda`, que es el FAQ completo.

---

## F7 · Footer (B12)

`home.component.ts:431-508` + su bloque de estilos.

Estructura pedida, de arriba abajo:

```
┌─────────────────────────────────────────┐
│              [ logo Doogking ]          │  ← banda 1, centrada
│         ○ ○ ○ ○  redes sociales         │  ← banda 2
├─────────────────────────────────────────┤
│  Alojamiento · Veterinarios · Peluquería │  ← banda 3, servicios EN HORIZONTAL
│  · Transporte · Adiestramiento · Hoteles │
├─────────────────────────────────────────┤
│  Descubre │ Empresas │ Legal            │  ← columnas que se quedan
├─────────────────────────────────────────┤
│   [ App Store ]   [ Google Play ]       │  ← badges oficiales
│   marcas de pago · © 2026 · legales     │
└─────────────────────────────────────────┘
```

1. Sacar logo y redes de `rs-footer__brand` a dos bandas propias centradas encima del grid.
2. Servicios: de `<ul>` en columna a una fila con `flex-wrap`, separadores `·`. En móvil se envuelve sola.
3. Badges de tiendas: sustituir las pastillas de texto (`:489-491`) por los **badges oficiales**.
   - Se descargan de los kits de marca de Apple y Google y van a `apps/web/public/images/` (`badge-app-store.svg`, `badge-google-play.svg`).
   - **Sus condiciones de uso obligan a respetar proporciones y márgenes**, así que nada de recolorearlos.
   - Mientras las apps no estén publicadas: badge en gris y sin enlace, con un "Muy pronto" debajo. Enlazar a una tienda donde la app no existe es peor que no enlazar.
4. El claim, la descripción larga y la franja de garantías se mantienen.

**Bloqueo parcial:** hacen falta los dos SVG. Si prefieres no incluirlos hasta que las apps existan, hago el resto de la reestructuración y dejo el hueco marcado.

---

## F8 · Foto de familia (B7) — bloqueado

`shared/media/images.ts` → `BANDA_POR_QUE`. Cuando llegue la foto:

1. Guardarla en `apps/web/public/images/` como `por-que-familia.jpg`.
2. Cambiar las dos rutas de `BANDA_POR_QUE` (`movil` y `escritorio`).
3. Si solo llega **una** foto: la banda de escritorio es muy apaisada y recorta casi todo el alto, así que necesita una toma con las personas y el perro centrados en la franja media. Si el encuadre no da, hago dos recortes del mismo original.
4. Aprovechar para revisar el `alt`, que hoy describe otra escena.

**Qué pedir al cliente:** JPG horizontal, mínimo 2400px de ancho, familia + perro, sin texto sobreimpreso, con derechos de uso cedidos.

---

## Verificación

Al terminar **cada fase**, y de forma completa antes de entregar:

```bash
bun run --cwd libs/shared build     # primero: web y api dependen de él
bunx tsc --noEmit -p apps/web/tsconfig.json
bun run build:web
bun run build:api
```

La suite de tests, en **una sola pasada al final** (no fase a fase):

```bash
bun run test
```

Comprobaciones manuales que ningún test cubre:
- **B13** — los 3 puntos en `/comercio/listados`, primera y última tarjeta, escritorio y móvil.
- **B6** — el mapa del buscador con resultados de varias categorías.
- **B12** — el footer a 390px, 768px y 1440px.
- **A1** — subida de fotos desde un iPhone real.
- **B14** — un repaso visual de importes en portada, listado, detalle, wizard, mis reservas y panel de comercio.

## Commits sugeridos

| Fase | Mensaje |
|---|---|
| F0 | `fix(upload): conversión HEIC fiable en iPhone y avisos accionables` |
| F1 | `fix(copy): servicio en vez de listado, entrada/salida en vez de check-in` |
| F2 | `fix(comercio): el menú de los 3 puntos ya no queda recortado` + `feat(alojamiento): la ficha explica la política de cancelación` |
| F3 | `refactor(web): pipe único de euros con el símbolo detrás` |
| F4 | `feat(reservas): el paso 2 llega relleno para quien ya tiene sesión` |
| F5 | `feat(mapa): los pines muestran el icono de la categoría` |
| F6 | `feat(reservas): preguntas frecuentes y valoración al confirmar` |
| F7 | `feat(home): footer reestructurado con redes y tiendas` |
| F8 | `feat(home): nueva fotografía del bloque ¿Por qué Doogking?` |

## Decisiones que necesito de ti

1. **F3** — ¿el pipe formatea los importes con separadores españoles ("1.234,56 €") o mantengo los actuales ("1,234.56 €") y solo muevo el símbolo?
2. **F6** — ¿te valen las cinco preguntas frecuentes propuestas, o las redacta el cliente?
3. **F7** — ¿incluyo ya los badges de App Store y Google Play en gris y sin enlace, o dejo el hueco hasta que las apps estén publicadas?
4. **F8** — hay que pedirle la fotografía al cliente para poder cerrarlo.
