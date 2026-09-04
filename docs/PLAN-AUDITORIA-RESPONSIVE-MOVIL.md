# Plan — Auditoría responsive y correcciones de móvil

> Fecha: 2026-09-04 · Alcance: `apps/web` (web de escritorio, web en móvil y app Capacitor).
> La app Capacitor empaqueta el mismo build de Angular, así que **toda** corrección
> aquí aplica a la vez a la web de escritorio, a la web vista en móvil y al APK.

## 0. Método

Auditoría programática sobre los 427 ficheros de `apps/web/src` (113 componentes),
con un analizador que sigue el anidamiento de `@media` para distinguir una regla
**incondicional** (se aplica también en un móvil de 320px) de una ya protegida
tras `min-width`. Sólo se listan como hallazgo las incondicionales.

## 1. Lo que ya estaba bien (no se toca)

Para no rehacer trabajo ya hecho, se verificó y se confirma correcto:

- `index.html`: `viewport-fit=cover` + `width=device-width`, sin bloquear el zoom.
- `styles.scss`: `overflow-x: clip` en `html`/`body`, `img/video/svg { max-width: 100% }`,
  y `font-size: 16px` en todos los campos por debajo de 768px (evita el zoom de iOS al enfocar).
- Rejillas de layout de dos columnas (paneles, fichas, wizard, listado): **todas**
  llevan ya su `@media (max-width: N) { grid-template-columns: 1fr }`.
- Barras laterales de `panel-admin` y `panel-comercio`: por debajo de 1024px pasan a
  tira horizontal desplazable, no se ocultan. La navegación no queda inaccesible.
- Menú móvil de la navbar: ya tiene `max-height: calc(100dvh - 64px)` + scroll.
- `nav-inferior`: respeta `env(safe-area-inset-bottom)` y el body reserva su alto.
- Campos de formulario: **0 inputs sin enlace** a `formControlName`/`ngModel`/handler.
  No hay ningún input "muerto".
- Tabla de `admin-reservas` y de `panel-comercio-dashboard`: ya se convierten en
  tarjetas por debajo de 768px. Sirven de patrón de referencia para el resto.

## 2. Hallazgos

### H1 · Tablas que no se convierten en lista en móvil — **8 tablas** (P0)

Petición explícita del cliente ("tablas que tienen que estar como lista"). Hoy se
resuelven con scroll horizontal, o directamente desbordan.

| Fichero | Síntoma |
|---|---|
| `panel-admin/admin-avisos` | `nowrap` + scroll lateral |
| `panel-admin/admin-campanas` | `min-width: 860px` |
| `panel-comercio/comercio-ingresos` | `nowrap` en `th` **y** `td` |
| `panel-comercio/comercio-reservas` (importar) | sin envoltorio ni scroll |
| `panel-comercio/comercio-suplementos` | scroll lateral |
| `panel-comercio/comercio-suscripcion` | scroll lateral |
| `perros/perro-privacidad` | `min-width: 640px` |
| `legal/privacidad` | tabla desnuda, sin envoltorio |

**Corrección:** una única clase global `.rs-tabla` en `styles.scss` que por debajo
de 768px apaga el `thead`, convierte cada `tr` en tarjeta y muestra el nombre de
la columna con `td::before { content: attr(data-label) }`. Cada `<td>` recibe su
`data-label`. Es el patrón que ya usan `admin-reservas` y el dashboard de comercio;
se extrae a global para no repetirlo ocho veces.

### H2 · Rejillas `auto-fit/auto-fill` que desbordan en móvil — **16 sitios** (P0)

`repeat(auto-fit, minmax(NNNpx, 1fr))` **no** se encoge por debajo de `NNN`: en un
móvil de 320–360px (Galaxy Fold 280px, iPhone SE 375px) menos el relleno del
contenedor, la columna es más ancha que la pantalla y estira la página.

Peores casos: `planificador` (340px), `admin-dashboard` (300px), `comercio-alta`
y `perfil-alpha` (260px), `perros-lista` (260px), `favoritos` (240px),
`admin-configuracion` (240px), `perro-form` (230px), `ayuda` y `admin-usuarios`
(220px), `admin-reservas` (210px), y cinco más a 200px.

**Corrección:** `minmax(min(NNNpx, 100%), 1fr)`. Mantiene el comportamiento en
escritorio y permite que la columna baje del suelo cuando la pantalla no da más.

### H3 · `100vh` sin `dvh` — **40 sitios** (P0)

Es la causa directa de *"la pantalla se alarga"*. En Chrome/Safari de móvil `100vh`
mide la ventana **con la barra del navegador retraída**, así que una página con
`min-height: 100vh` siempre es más alta que lo visible y aparece un scroll vertical
fantasma que no lleva a ningún contenido.

Reparto: 14 son `style="min-height:100vh"` **en línea** en la plantilla, 22 en
`styles` de componente, 4 en `styles.scss`.

**Corrección:** par `100vh` → `100dvh` (la primera queda de reserva para navegadores
viejos). Los 14 en línea se sustituyen por una clase global `.dk-pagina`, que
además quita valores fijos del marcado, como pide el design system.

### H4 · Modales sin altura máxima — **3 sitios** (P1)

`admin-comercios`, `admin-reservas` y `cupones-admin` definen
`.modal { width: 100%; max-width: NNNpx; padding }` dentro de un backdrop
`position: fixed; inset: 0; display: flex; align-items: center`. Sin `max-height`,
un formulario más alto que la pantalla se sale por arriba y por abajo **sin scroll
posible**: los botones de guardar quedan inalcanzables en móvil.

**Corrección:** `max-height: calc(100dvh - var(--sp-10)); overflow-y: auto;`.

### H5 · Teclado móvil equivocado — **75 campos** (P1)

Campos `type="number"`/`"email"` sin `inputmode`. En Android el teclado abre en modo
texto y hay que buscar los números; en los precios falta la coma decimal.

**Corrección:** `inputmode="decimal"` en los campos con `step="0.01"` (precios,
tarifas), `inputmode="numeric"` en los enteros (cantidades, días, cupos),
`inputmode="email"` en los correos.

### H6 · `100vw` en el panel del carrito (P2)

`width: min(420px, 100vw)` incluye el ancho de la barra de scroll y provoca un
desplazamiento lateral de unos pocos píxeles. Se cambia a `100%`.

## 3. Orden de ejecución

1. Base global en `styles.scss`: clase `.rs-tabla` y clase `.dk-pagina`.
2. H3 — `dvh` (40 sitios).
3. H2 — suelos de `minmax` (16 sitios).
4. H1 — las 8 tablas a lista.
5. H4 — altura de los 3 modales.
6. H5 — `inputmode` (75 campos).
7. H6 — carrito.
8. Verificación: `tsc` + `ng build` + `nest build` + suite de tests.
9. Merge a `main` y generación del APK firmado.

## 4. Criterio de aceptación

- Ningún desbordamiento horizontal entre 280px y 430px de ancho.
- Ninguna página más alta que el viewport sin contenido que lo justifique.
- Las 10 tablas se leen como lista de tarjetas por debajo de 768px.
- Toda vista modal y todo menú es alcanzable y desplazable en una pantalla de 568px de alto.
- Build de web y API en verde; suite de tests sin regresiones.

---

## 5. Resultado (2026-09-04) — COMPLETADO

| Hallazgo | Corrección aplicada |
|---|---|
| H1 · tablas | 8 tablas con `.rs-tabla` + 40 celdas con `data-label`; patrón único en `styles.scss` |
| H2 · rejillas | 16 `minmax(NNNpx…)` → `minmax(min(NNNpx, 100%)…)` |
| H3 · `100vh` | 24 pares `vh`/`dvh` + 16 `style` en línea sustituidos por `.dk-pagina` |
| H4 · modales | `max-height: calc(100dvh − …)` + `overflow-y: auto` en los 3 modales |
| H5 · teclado | 101 campos con `inputmode` (36 decimal · 53 numeric · 12 email) |
| H6 · carrito | `100vw` → `100%` |

### Verificación

- `bun run build:shared` · `build:web` · `build:api` → **los tres en verde**.
- `bun run test:web` → **2 784 de 2 785 pasan**. El único fallo
  (`admin-dashboard` · "recargar en cuanto están las dos fechas") es un problema
  de zona horaria previo: falla **igual** con el árbol limpio, sin estos cambios.
- Comprobación en Chrome sobre el build real, con la app dentro de un iframe del
  ancho de un móvil para que las media queries evalúen contra ese ancho:
  - **320px y 360px**, rutas `/`, `/alojamiento`, `/veterinaria`, `/peluqueria`,
    `/transporte`, `/adiestramiento`, `/explora`, `/ayuda`, `/privacidad`:
    `scrollWidth === clientWidth` en todas → **cero desbordamiento horizontal**.
  - Tabla de `/privacidad` a 360px: cabecera oculta (pero anunciada por lectores
    de pantalla), fila como tarjeta, celda en flex y etiqueta pintada desde
    `data-label`. A 1100px vuelve a ser tabla con su cabecera visible.

### Nota para quien siga

En `styles: [\`…\`]` de un componente Angular **no se pueden usar comillas
invertidas dentro de un comentario CSS**: cierran la plantilla y el compilador
falla con un `Failed to resolve styles at position N`, sin decir en qué fichero.
Pasó una vez durante este trabajo. En `styles.scss` no hay problema.
