# PLAN — Auditoría SEO y UX (septiembre 2026)

> **Estado: implementado el 2026-09-11.** Se eligió la **opción A (SSR)** y se ejecutaron
> las olas 1 a 5 completas. Lo único que queda abierto es la Ola 6, que es carga de
> contenido y depende del cliente. El detalle de lo hecho está al final, en §6.
>
> Origen: `docs/auditor_a_seo_y_ux_doogking.md` (13 hallazgos + tabla de prioridades).
> Este plan **no repite el informe**: parte de una verificación en el código de qué
> está realmente hecho y qué falta, y convierte lo que falta en olas de trabajo
> con criterio de aceptación. Los hallazgos se numeran `SEO-1` … `SEO-13`
> siguiendo la numeración del informe.

---

## 0. Estado real verificado en el código

Antes de planificar se comprobó cada hallazgo contra el repositorio, no contra
los PLAN-*.md anteriores. Tres de los trece ya estaban resueltos o eran un falso
positivo derivado de revisar la web con una cuenta de administrador.

| # | Hallazgo del informe | Estado real | Evidencia en el código |
|---|---|---|---|
| **1** | Sin títulos/descripciones propios, sin Open Graph, sin canonical, sin datos estructurados | **Falta entero** | Ningún componente usa `Title`/`Meta` de `@angular/platform-browser`; `apps/web/src/index.html` tiene un único `<title>` y una única `<meta name="description">` para toda la web; no hay `og:*`, `twitter:*`, `<link rel="canonical">` ni JSON-LD; no existen `robots.txt` ni `sitemap.xml` en `apps/web/public/` |
| **2** | Sin banner de consentimiento de cookies | **Falta entero** | Sólo existe la página legal `features/legal/cookies.component.ts`. No hay servicio ni componente de consentimiento. Se cargan terceros: Google Maps (`shared/components/mapa/motores/google-maps.loader.ts`), Google Identity y Facebook SDK (`core/auth/social-sdk.service.ts`) |
| **3** | Sin página 404 | **Falta entero** | `app.routes.ts:227` → `{ path: '**', redirectTo: '' }`; `apps/web/nginx.conf` responde `try_files … /index.html` con **200** a cualquier ruta |
| **4** | `municipios_final.xlsx` visible en una ficha | **Ya resuelto** | `apps/api/src/core/lugares/lugares.service.ts:31` (`ATRIBUTOS_INTERNOS` + `.select('-atributos.fuente')`) y `features/explora/explora-detalle.component.ts:23`. Queda sólo **verificar en producción** |
| **5** | El buscador de portada abre con campos de alojamiento | **Parcial** | Existe el modo IA (`home.component.ts:1732`), pero arranca en `'filtros'` y `rs-search-bar` toma `VerticalKey.ALOJAMIENTO` por defecto (`rs-search-bar.component.ts:486`) → se piden Ingreso/Salida |
| **6** | Crematorios con contador «1 perro» | **Parcial** | Las etiquetas ya están adaptadas (`verticales.config.ts:235-237`, «¿Cuándo lo necesitas?»), pero el buscador pinta siempre «¿Para qué mascota?» + `rs-pet-picker` con stepper |
| **7** | URLs de Explora con ObjectId | **Falta entero** | `lugar.schema.ts` no tiene campo `slug`; `explora.routes.ts` resuelve por `:id` |
| **8** | Fotos de banco repetidas | **Trabajo de contenido** | El código ya soporta fotos reales (`lugar.fotos[]` + aportación de la comunidad). Es carga de contenido del cliente |
| **9** | Fichas de Explora muy parecidas y sin opiniones | **Infra hecha, contenido no** | `lugar-review.schema.ts`, `POST /lugares/:id/reviews` y el bloque «Opiniones de la comunidad» ya existen (`explora-detalle.component.ts:131`). Falta enriquecer las 24 fichas |
| **10** | Faltan textos alternativos | **Parcial** | La foto real sí lleva `alt` (`explora-detalle.component.ts:93`); la imagen de ambiente va como decorativa (`alt=""` + `aria-hidden`). Falta una pasada global |
| **11** | Sin menú de categorías en la cabecera | **Falso positivo (con matiz)** | La tira existe: `rs-navbar.component.ts:214` `@if (muestraCategorias())`, y `:727` la oculta a admin y comercio. El auditor navegaba **como admin**, por eso no la vio |
| **12** | Iconos sociales sin etiqueta accesible | **Parcial** | El `<svg>` recibe `aria-label` con el nombre de la red, pero el `<a>` sólo lleva `title`; falta «Instagram **de Doogking**» |
| **13** | Exceso de comentarios HTML invisibles | **Confirmado** | `shared/components/icon/rs-icon.component.ts`: un `@switch` con **105 `@case`** → cada `<rs-icon>` del DOM emite ~105 nodos comentario |

**Conclusión del diagnóstico:** de los 4 puntos de prioridad alta, **3 están sin
empezar** (SEO, cookies, 404) y **1 ya está corregido** (dato interno). El resto
son ajustes acotados salvo el contenido de Explora, que depende del cliente.

---

## 1. La decisión que condiciona todo el bloque SEO

**Doogking es una SPA sin renderizado en servidor.** `apps/web/angular.json` no
declara `ssr` ni `prerender`, y nginx sirve `index.html` para todo.

Esto importa porque **los rastreadores de redes sociales no ejecutan JavaScript**:
WhatsApp, Facebook, LinkedIn, X y Telegram leen el HTML tal como llega. Poner
`Title`/`Meta` desde Angular arregla la pestaña del navegador y ayuda a Google
(que sí renderiza, con retraso), pero **no arregla la vista previa al compartir**,
que es justo la mitad del hallazgo SEO-1. Tampoco se puede devolver un `404` real
sin servidor.

Hay dos caminos, y hay que elegir uno antes de tocar nada:

### Opción A — SSR con `@angular/ssr` *(recomendada)*

- `ng add @angular/ssr` con `outputMode: 'server'`; el contenedor pasa de nginx a Node.
- Resuelve de golpe: vistas previas sociales reales, canonical, JSON-LD indexable,
  `404` con código HTTP correcto, y mejora el *first paint*.
- Coste: adaptar el `Dockerfile` de web, revisar todo acceso a `window`/`document`
  fuera de guardas (mapas, Stripe, SDK sociales, `localStorage`) y mantener una
  configuración `browser` aparte para el build de Capacitor, que **debe seguir
  siendo estático**.
- Estimación: 3–5 días de trabajo real, la mayor parte en depurar accesos a
  `window` y en el despliegue en Coolify.

### Opción B — Prerender selectivo (SSG) + meta dinámica en cliente

- `prerender` de las rutas fijas (portada, 8 categorías, legales, `para-comercios`)
  y meta dinámica por Angular para las fichas.
- Más barato y sin cambiar el contenedor, pero **las fichas de servicio y de
  Explora seguirían compartiéndose con la vista previa genérica**, y el `404`
  seguiría devolviendo 200.
- Sirve como paso intermedio si urge el lanzamiento.

> **Recomendación:** Opción A. El informe pide explícitamente vista previa social
> y 404 real, y ambos son imposibles sin servidor. La Opción B se queda a medias
> en los dos puntos que el cliente marcó como bloqueantes del lanzamiento.
>
> **Decisión pendiente del cliente.** Las olas 1 y 2 están escritas para que el
> trabajo de meta-datos sirva igual en A y en B: se implementa un servicio de SEO
> agnóstico, y sólo cambia dónde se ejecuta. Si se elige B, las tareas marcadas
> `[SSR]` quedan fuera de alcance y se documenta la limitación.

---

## 2. Olas de trabajo

Orden pensado para poder abrir la web al público al terminar la Ola 2.

### Ola 1 — Bloqueantes de lanzamiento: SEO técnico (SEO-1)

| Tarea | Detalle | Archivos |
|---|---|---|
| **1.1** Servicio `SeoService` | `setTitle`, `setDescription`, `setCanonical`, `setOpenGraph`, `setJsonLd`, `setRobots`. Envuelve `Title` y `Meta`, es seguro en servidor y limpia las etiquetas de la ruta anterior al navegar | `core/seo/seo.service.ts` + `.spec.ts` (nuevo) |
| **1.2** Plantillas de metadatos por tipo de página | Una función pura por familia: portada, categoría, ficha de servicio, listado de Explora, ficha de Explora, legales, panel. Título ≤ 60 car., descripción 140–160, generados desde datos reales (nombre, ciudad, precio desde) | `core/seo/plantillas-seo.ts` + `.spec.ts` (nuevo) |
| **1.3** Etiquetas base en `index.html` | `og:site_name`, `og:type`, `og:locale`, `twitter:card=summary_large_image`, imagen por defecto de marca (1200×630, a crear en `public/images/`) | `apps/web/src/index.html` |
| **1.4** Aplicar SEO en las 8 categorías | Título y descripción propios por vertical, tomados de `verticales.config.ts` (`titular`, `descripcion`, `claim`), + canonical | `features/verticales/*`, `shared/components/listado/*` |
| **1.5** Aplicar SEO en fichas de servicio | Título `{título} en {ciudad} · Doogking`, descripción del servicio recortada, `og:image` = primera foto, canonical | vistas de detalle de cada vertical |
| **1.6** Aplicar SEO en Explora | Lista y ficha; en la ficha, `og:image` = foto real si la hay | `features/explora/*` |
| **1.7** JSON-LD | `Organization` + `WebSite`+`SearchAction` en la portada; `LocalBusiness`/`Place` con `aggregateRating` en fichas de servicio; `Place` con `address`/`geo` en Explora; `BreadcrumbList` en listados | `core/seo/json-ld.ts` (nuevo) |
| **1.8** `robots.txt` | Permitir público; bloquear `/admin`, `/comercio`, `/perfil`, `/reservas`, `/carrito`, `/auth`; apuntar al sitemap | `apps/web/public/robots.txt` (nuevo) |
| **1.9** `sitemap.xml` dinámico | Endpoint público en el API que emite el sitemap con las rutas fijas + servicios publicados + lugares publicados (`lastmod` = `updatedAt`). Se sirve desde nginx/SSR con proxy a `/sitemap.xml` | `apps/api/src/core/seo/` (nuevo módulo) + `nginx.conf` |
| **1.10** `[SSR]` Montar `@angular/ssr` | `outputMode: 'server'`, `Dockerfile` de web a Node, configuración `browser` separada para Capacitor, auditoría de accesos a `window`/`document` | `angular.json`, `apps/web/Dockerfile`, `DEPLOY.md` |

**Aceptación:** compartir una ficha de servicio, una de Explora y una categoría en
WhatsApp muestra título, descripción e imagen propios; el validador de resultados
enriquecidos de Google no da errores en los tres tipos de JSON-LD;
`/robots.txt` y `/sitemap.xml` responden 200 con contenido válido.

---

### Ola 2 — Bloqueantes de lanzamiento: cookies y 404 (SEO-2, SEO-3, SEO-4)

| Tarea | Detalle | Archivos |
|---|---|---|
| **2.1** `ConsentimientoService` | Estado con `signal`: `necesarias` (siempre), `preferencias`, `analitica`, `marketing`. Persiste la decisión y su fecha; expira a los 12 meses (criterio AEPD); expone `haConsentido(categoria)` | `core/cookies/consentimiento.service.ts` + `.spec.ts` (nuevo) |
| **2.2** Banner `rs-cookies` | Tres acciones al mismo nivel visual — **Aceptar todas / Rechazar todas / Configurar** — como exige la AEPD: rechazar no puede costar más clics que aceptar. Panel de detalle con conmutadores por categoría y enlace a la política | `shared/components/cookies/rs-cookies.component.ts` + `.spec.ts` (nuevo) |
| **2.3** Bloquear terceros hasta el consentimiento | `google-maps.loader.ts` y `social-sdk.service.ts` piden permiso al servicio antes de inyectar el script. En el mapa, mostrar un marcador de posición con un botón «Ver mapa» que activa la categoría y carga | `shared/components/mapa/motores/google-maps.loader.ts`, `core/auth/social-sdk.service.ts` |
| **2.4** Reabrir preferencias | Enlace «Configuración de cookies» en el pie, obligatorio para poder retirar el consentimiento | pies de `home.component.ts`, `para-comercios.component.ts` |
| **2.5** Actualizar la política de cookies | El texto actual afirma que no hay nada que aceptar; hay que reflejar Google Maps, Google Identity y Meta, y el nuevo mecanismo. **Traducir a los 8 idiomas** | `features/legal/cookies.component.ts`, `core/i18n/traducciones/*/paginas.ts` |
| **2.6** Página 404 | Mensaje claro, buscador, accesos a las categorías y enlace a la portada, con el UI Kit (`rs-*`). Sustituye a `{ path: '**', redirectTo: '' }` | `features/errores/no-encontrado.component.ts` + `.spec.ts` (nuevo), `app.routes.ts` |
| **2.7** `[SSR]` 404 con código HTTP real | Que la ruta comodín devuelva `404` de verdad y `<meta name="robots" content="noindex">`. Sin SSR: al menos el `noindex` desde el cliente, y documentar la limitación | `core/seo/seo.service.ts`, servidor SSR |
| **2.8** Verificar SEO-4 en producción | Comprobar en la base de datos real que ninguna ficha publicada expone `atributos.fuente` ni `origenDatos`; si alguna se coló, script de limpieza | `apps/api/src/scripts/` |

**Aceptación:** en una sesión nueva no se carga ningún script de tercero antes de
decidir; rechazar es tan fácil como aceptar; la decisión sobrevive a recargar;
una URL inventada muestra la página 404 (y devuelve 404 si se eligió SSR).

---

### Ola 3 — Buscador y tono por categoría (SEO-5, SEO-6, SEO-11)

| Tarea | Detalle | Archivos |
|---|---|---|
| **3.1** Elegir servicio antes que fechas | En la portada, el buscador de filtros **no asume alojamiento**: arranca sin vertical seleccionado y muestra sólo la ubicación hasta que se elige categoría; al elegirla aparecen los campos que correspondan. Alternativa si se prefiere menos cambio: abrir la portada en modo **IA** por defecto, tal como sugiere el informe | `home.component.ts`, `shared/components/search-bar/rs-search-bar.component.ts` |
| **3.2** Mascota por categoría | Dos campos nuevos en `VerticalUi`: `labelMascota` y `mascotaSinContador`. En funerarios: «¿Para qué mascota necesitas el servicio?» y selector sin stepper (una sola mascota) | `shared/verticales/verticales.config.ts`, `shared/components/pet-picker/rs-pet-picker.component.ts`, `rs-search-bar.component.ts` |
| **3.3** Repaso de tono en funerarios | Revisar toda la cadena de ese vertical —buscador, listado, ficha, carrito, correos— buscando lenguaje de «reserva/producto» donde toca acompañamiento | `features/verticales/*`, plantillas de correo del API |
| **3.4** Categorías visibles también para admin y comercio | `muestraCategorias()` oculta la tira a admin y comercio; eso deja sin navegación de categorías a quien entra con esas cuentas y fue lo que generó el hallazgo SEO-11. Mostrarla siempre que la vista sea pública, y ocultarla sólo dentro de `/admin` y `/comercio` | `shared/components/navbar/rs-navbar.component.ts:727` |

**Aceptación:** buscar veterinario desde la portada no pide nunca entrada y
salida; el buscador de funerarios no muestra un contador de perros; con cuenta de
admin, navegando por la web pública, la tira de categorías está visible.

---

### Ola 4 — URLs legibles en Explora (SEO-7)

| Tarea | Detalle | Archivos |
|---|---|---|
| **4.1** Campo `slug` en `lugares` | `slug` único e indexado, generado del nombre + municipio (`rio-jucar-riola`), sin tildes ni signos, con sufijo numérico ante colisión | `apps/api/src/core/lugares/lugar.schema.ts`, `slug.util.ts` (nuevo) |
| **4.2** Generación automática | Al crear y al renombrar; el slug **no cambia** una vez publicado salvo petición explícita, para no romper enlaces | `lugares.service.ts` |
| **4.3** Script de migración | Rellenar el slug de las 24 fichas existentes (y de las que haya en producción) | `apps/api/src/scripts/migrar-slugs-lugares.ts` (nuevo) |
| **4.4** Resolver por slug **o** por id | `GET /lugares/:idOSlug` acepta ambos; si llega un ObjectId, responde con el slug canónico para que el front redirija | `lugares.controller.ts`, `lugares.service.ts` |
| **4.5** Redirección 301 en el front | `/explora/6a8451c2…` → `/explora/rio-jucar-riola` reemplazando la entrada del historial; el canonical apunta siempre al slug | `features/explora/explora.routes.ts`, `explora-detalle.component.ts` |
| **4.6** Enlaces internos al slug | Listado, planificador, «experiencias cerca» y el sitemap emiten ya la URL legible | `features/explora/*`, módulo de sitemap |

**Aceptación:** las 24 fichas abren por URL legible; los enlaces antiguos por id
siguen funcionando y redirigen; el sitemap sólo publica URLs con slug.

> **Nota:** el mismo problema existirá en las fichas de servicio (`/veterinaria/:id`).
> Queda **fuera de esta ola** por alcance —el informe sólo señala Explora—, pero
> conviene abrirlo como trabajo siguiente con el mismo patrón.

---

### Ola 5 — Accesibilidad y peso de página (SEO-10, SEO-12, SEO-13)

| Tarea | Detalle | Archivos |
|---|---|---|
| **5.1** Auditoría de `alt` | Barrido de todos los `<img>`: los informativos con texto descriptivo, los decorativos con `alt=""` + `aria-hidden` **de forma explícita y justificada**. En Explora, alt del tipo «Río Júcar a su paso por Riola» compuesto con nombre + municipio | todo `apps/web/src/app` |
| **5.2** Etiqueta accesible en redes sociales | `aria-label="Instagram de Doogking"` en el `<a>`, en los tres pies que las pintan | `home.component.ts:461`, `para-comercios.component.ts:384`, `contacto.component.ts:80` |
| **5.3** Refactor de `rs-icon` | Sustituir el `@switch` de 105 casos por un mapa `nombre → path[]` renderizado con un único nodo, eliminando ~105 comentarios por icono. Es un cambio interno: la API del componente (`name`, `size`, `stroke`, `filled`) no cambia y ningún consumidor se toca | `shared/components/icon/rs-icon.component.ts` + `.spec.ts` |
| **5.4** Medir antes y después | Contar nodos comentario y peso del DOM de la portada antes y después del 5.3, y dejar la cifra en el commit | — |

**Aceptación:** Lighthouse Accesibilidad ≥ 95 en portada, listado y ficha; la
portada pierde al menos el 80 % de sus nodos comentario.

---

### Ola 6 — Contenido de Explora (SEO-8, SEO-9) · *depende del cliente*

Esta ola es **carga y edición de contenido**, no desarrollo. El código ya tiene lo
necesario (fotos, atributos por tipo, opiniones de la comunidad). Lo que aporta
desarrollo:

| Tarea | Detalle |
|---|---|
| **6.1** Campos guiados en el editor de lugares del admin | Acceso, mejor momento para ir, normas locales, sombra, agua, aparcamiento, restricciones para perros: como campos con etiqueta, no como texto libre, para que las fichas dejen de parecerse |
| **6.2** Aviso de ficha incompleta | En el panel admin, marcar las fichas que sólo tienen la descripción importada, para priorizar cuáles enriquecer |
| **6.3** Prioridad de foto real | Que la ficha y el listado muestren la foto de banco sólo si no hay ninguna real, y que la etiqueta «Imagen de ambiente» desaparezca en cuanto se suba una |
| **6.4** *(Cliente)* | Fotografías reales y textos propios de las fichas principales; primeras opiniones sembradas por el equipo |

---

## 3. Resumen de dependencias y orden

```
Decisión SSR (A o B)
        │
        ├─► Ola 1 · SEO técnico ──────┐
        │                             ├─► ABRIR AL PÚBLICO
        ├─► Ola 2 · Cookies + 404 ────┘
        │
        ├─► Ola 3 · Buscador y tono        (antes de campañas)
        ├─► Ola 4 · URLs Explora           (se apoya en el sitemap de la Ola 1)
        ├─► Ola 5 · Accesibilidad y peso   (independiente)
        └─► Ola 6 · Contenido Explora      (bloqueada por el cliente)
```

**Ruta crítica al lanzamiento: Olas 1 y 2.** Las olas 3, 4 y 5 son independientes
entre sí y pueden ir en paralelo o después.

---

## 4. Convenciones de ejecución

- **Cada archivo de producción nuevo lleva su `.spec.ts`** en el mismo commit
  (regla de oro de `CLAUDE.md` §20). Aplica a `SeoService`, plantillas de meta,
  JSON-LD, `ConsentimientoService`, banner de cookies, 404 y utilidad de slug.
- **UI Kit obligatorio**: banner de cookies y página 404 con tokens `var(--…)` y
  clases `rs-*`. Nada de colores ni espaciados a mano (§21).
- **i18n**: todo texto nuevo pasa por la clave en español + pipe `| t`, y se
  traduce a los 8 idiomas. Afecta sobre todo a la Ola 2.
- **El core no se ensucia por vertical**: el tono de funerarios se resuelve con
  campos nuevos en `VerticalUi`, nunca con un `if (vertical === 'funeraria')` en
  el buscador (§18 Open/Closed).
- **Verificar compilación al cerrar cada ola**: `tsc` + `ng build` + `nest build`,
  reconstruyendo `libs/shared` primero.
- **Suite de tests en una sola pasada al final de cada ola**, no durante.

---

## 5. Fuera de alcance de este plan

Lo recoge el propio informe y se deja anotado para que no se dé por perdido:

- **Área de cliente sin validar**: el auditor no tenía cuenta de cliente real, así
  que perfil, reservas y mascotas quedaron sin revisar. Conviene una segunda
  pasada de auditoría con esa cuenta antes de abrir.
- **Cifras de la portada**: hoy son de demostración. Sustituirlas por datos reales
  antes del lanzamiento, o retirarlas.
- **Categorías sin comercios**: normal en esta fase; no es incidencia.
- **URLs legibles en fichas de servicio**: mismo problema que Explora, pero fuera
  del informe (ver nota de la Ola 4).


---

## 6. Lo que se hizo (2026-09-11)

Se eligió la **Opción A**: `@angular/ssr` con Express, porque es la única que permite
vistas previas sociales reales y un 404 con código HTTP correcto, los dos puntos que el
informe marcaba como bloqueantes del lanzamiento.

### Estado por hallazgo

| # | Hallazgo | Estado |
|---|---|---|
| **1** | SEO, vista previa social, canonical, datos estructurados | **Hecho** |
| **2** | Consentimiento de cookies | **Hecho** |
| **3** | Página 404 | **Hecho**, con código HTTP 404 real |
| **4** | `municipios_final.xlsx` visible | Ya estaba; queda **verificar en producción** |
| **5** | El buscador arranca en alojamiento | **Hecho**: pregunta el servicio primero |
| **6** | Tono de crematorios | **Hecho**: etiqueta propia y sin contador |
| **7** | URLs con ObjectId en Explora | **Hecho**; falta **ejecutar la migración** |
| **8** | Fotos de banco repetidas | **Pendiente del cliente** (Ola 6) |
| **9** | Fichas de Explora repetitivas | **Pendiente del cliente** (Ola 6) |
| **10** | Textos alternativos | **Hecho** en Explora y redes; barrido global pendiente |
| **11** | Menú de categorías | **Hecho**: ya no depende del rol |
| **12** | Iconos sociales sin etiqueta | **Hecho** |
| **13** | Comentarios HTML sobrantes | **Hecho**: −95 % |

### Render de servidor

`ng build` produce ahora un servidor de Node (`dist/web/server/server.mjs`) además del
bundle del navegador. El contenedor pasó de nginx a Node y `apps/web/nginx.conf` se
eliminó: lo que hacía —caché, `env.js` sin guardar, reparto de estáticos, fallback de
rutas— vive en `apps/web/src/server.ts`.

Reparto de render (`app.routes.server.ts`): las páginas públicas se renderizan en
servidor; los paneles, el perfil, las reservas y el acceso siguen siendo sólo de cliente,
porque no se indexan ni se comparten y renderizarlos obligaría a resolver la sesión en el
render.

Cosas que hubo que arreglar para que el render de servidor no reventara:

- **Almacenamiento del navegador** (`core/plataforma/almacen.ts`): `localStorage` no existe
  en Node y `AuthService` lo leía al construirse. De paso cubre Safari en modo privado, que
  lanza una excepción al *acceder* a la propiedad.
- **El guard de "muy pronto"** guardaba el acceso anticipado sólo en `localStorage`, que el
  servidor no ve: todo el mundo acababa en la pantalla de espera y la página sólo se
  corregía al hidratar, con un salto visible. Ahora va también en cookie
  (`core/plataforma/cookies.service.ts`), que es lo que viaja en la petición.
- **`IntersectionObserver`** en `animate-on-scroll`: no existe en Node, y además su clase
  deja el contenido transparente hasta que entra en pantalla —justo lo contrario de lo que
  busca renderizar en servidor—.
- `ThemeService`, `I18nService`, `rs-nav-inferior` y `rs-listado` tocaban `window` o
  `document` globales.

**El build de móvil no lleva SSR.** `ng build --configuration movil` hace un build estático
clásico en `dist/web-movil`, que es lo que empaqueta Capacitor: con la salida de SSR la app
quedaría en blanco, porque dentro del móvil no hay ningún Node.

### Medición del hallazgo 13

Portada renderizada en servidor, antes y después de convertir el `@switch` de 105 ramas de
`rs-icon` en un mapa de datos:

| | Antes | Después |
|---|---|---|
| Nodos comentario | 5.118 | 242 |
| Peso en comentarios | 36,6 KB | 3,2 KB |
| HTML total | 206,5 KB | 169,5 KB |

El `innerHTML` no puede ir **dentro** de un `<svg>` de la plantilla: el DOM del render de
servidor no lo implementa para elementos SVG y los iconos salían vacíos justo en el HTML que
ven los buscadores. Por eso el `<svg>` entero se compone como texto y se inserta en el
propio `<rs-icon>`.

### Queda por hacer

1. **Ejecutar la migración de slugs** contra producción:
   `bun run --cwd apps/api migrar:slugs-lugares` (simula) y luego `-- --aplicar`.
   Hasta entonces las fichas se sirven por id, que sigue funcionando.
2. **Declarar `WEB_HOSTS_PERMITIDOS`** en Coolify antes de desplegar, o la web responderá
   400 a todo: `doogking.com,www.doogking.com`.
3. **Cambiar el puerto del servicio web en Coolify** de `8085:80` a `8085:4000`.
4. **Dar de alta el sitemap en Google Search Console** una vez abierta la web.
5. **Verificar el hallazgo 4 en producción**: que ninguna ficha publicada exponga
   `atributos.fuente`.
6. **Ola 6**: fotos reales y contenido propio de las fichas de Explora (cliente).
7. La imagen de vista previa (`public/images/og-doogking.png`) se generó a partir del
   logotipo; si diseño quiere una propia, basta con sustituir el fichero.
