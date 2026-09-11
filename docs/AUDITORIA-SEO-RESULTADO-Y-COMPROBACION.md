# Auditoría SEO y UX — qué se ha hecho y cómo comprobarlo

**Doogking · 11 de septiembre de 2026**
Informe de origen: `docs/auditor_a_seo_y_ux_doogking.md` (13 observaciones)
Plan y detalle técnico: `docs/PLAN-AUDITORIA-SEO-Y-UX.md`
Commit: `7fec988`

---

## ⚠️ Antes de nada: esto todavía no está en producción

La web publicada sigue sirviendo la versión anterior. Está comprobado, no es una
suposición:

```
$ curl -sI https://doogking.com | grep -i server
server: nginx/1.27.5          ← la versión nueva no usa nginx, usa Node
```

**El motivo:** el commit con todos los cambios está sólo en el ordenador local. La rama
`main` va **1 commit por delante** de `origin/main`, así que lo que Coolify volvió a
desplegar fue el commit anterior, el que ya estaba.

```
$ git status -sb
## main...origin/main [ahead 1]
```

Falta un `git push`. Hasta que se haga, nada de lo que sigue se ve en doogking.com.

### Y hay un detalle de orden que importa

La **migración de direcciones legibles de Explora ya se ejecutó contra la base de datos de
producción**: los documentos tienen su `slug`. Pero el API desplegado es todavía el
antiguo y no sabe resolverlos:

```
GET /api/v1/lugares/rio-jucar-a-su-paso-por-jalance-jalance  → 400
GET /api/v1/lugares/6a8451ca756a745fe5e230fd                 → 200
GET /api/v1/seo/sitemap.xml                                  → 404
```

Ahora mismo esto no rompe nada, porque la web publicada tampoco usa los slugs. Pero
**el API y la web tienen que desplegarse juntos**: si sube sólo la web, las fichas de
Explora empezarán a dar error, porque pedirán por slug a un API que aún no lo entiende.

> **Orden correcto:** `git push` → esperar a que **ambos** servicios terminen de
> desplegar → comprobar. No dar por buena la web hasta que el API también esté.

---

## 1. Resumen de lo hecho

De las 13 observaciones del informe, **11 están resueltas en código**. Las dos restantes
(fotos reales y textos propios de las fichas de *Explora*) son carga de contenido y
dependen de material que tiene que aportar el cliente.

El cambio de fondo es que **la web pasa a renderizarse en el servidor**. Era la única
forma de resolver los dos puntos que el informe marcaba como bloqueantes del
lanzamiento, y conviene entender por qué:

> Los rastreadores de WhatsApp, Facebook, LinkedIn y X **no ejecutan JavaScript**. Leen
> el HTML tal y como llega. Mientras la web fue una aplicación que se montaba en el
> navegador, compartir la ficha de una residencia enseñaba el título y la descripción
> genéricos de la portada, daba igual lo que la página escribiera después. Por el mismo
> motivo, una dirección inventada devolvía un «todo correcto» con la portada dentro en
> vez de un «esta página no existe».

| # | Observación del informe | Qué se ha hecho |
|---|---|---|
| **1** | Las páginas se ven genéricas para Google y redes | Cada página tiene título, descripción, imagen de vista previa y dirección canónica propias. Se añaden datos estructurados (los que permiten a Google enseñar estrellas, precio y dirección), `robots.txt` y un `sitemap.xml` que se genera con lo que está realmente publicado |
| **2** | No hay aviso de cookies | Aviso con **aceptar, rechazar y configurar al mismo nivel**. Sin consentimiento, el mapa se dibuja con OpenStreetMap en lugar de Google Maps y los servicios de acceso de Google y Meta no se descargan hasta que se pulsa su botón |
| **3** | No hay página 404 | Página propia con buscador y categorías, y con el código de respuesta correcto, que es lo que de verdad le dice a Google que esa dirección no existe |
| **4** | Se veía `municipios_final.xlsx` en una ficha | Ya estaba corregido antes de esta ronda. Verificado: no aparece |
| **5** | El buscador empieza pidiendo fechas de alojamiento | Ahora pregunta **primero qué servicio necesitas**, y sólo entonces pide lo que corresponda a esa categoría |
| **6** | Crematorios con contador de «1 perro» | Pregunta «¿Para qué mascota necesitas el servicio?» y desaparece el contador con botones «−» y «+», que era el tono de un carrito de la compra |
| **7** | Explora usa direcciones con códigos internos | `/explora/rio-jucar-a-su-paso-por-riola-riola` en lugar de `/explora/6a8451c2…`. Los enlaces antiguos siguen funcionando y llevan al nuevo |
| **8** | Fotos de banco repetidas | **Pendiente del cliente**: hacen falta fotografías reales |
| **9** | Fichas de Explora muy parecidas entre sí | **Pendiente del cliente**: hace falta escribir contenido propio. La plataforma ya admite opiniones de la comunidad |
| **10** | Faltan textos alternativos en imágenes | Las fotos de Explora describen el sitio y dónde está («Río Júcar, Riola, Valencia»). La imagen de ambiente sigue marcada como decorativa, que es lo correcto: no es una foto del lugar y el pie ya lo dice |
| **11** | No hay menú de categorías en la cabecera | **Sí lo había**, pero estaba oculto para las cuentas de administrador y de comercio, y el revisor entró como administrador. Ahora depende de dónde se está, no de quién mira: se ve en toda la web pública y se esconde sólo dentro de los paneles de gestión |
| **12** | Iconos sociales sin etiqueta | Cada uno se anuncia como «Instagram de Doogking», «Facebook de Doogking»… |
| **13** | Demasiado código invisible en la página | La portada pasa de **5.118 comentarios vacíos a 242**, y de 206,5 KB a 169,5 KB |

---

## 2. Cómo comprobarlo tú mismo

Todo lo que sigue está pensado para hacerse **desde el navegador**, sin herramientas.
Sustituye `doogking.com` por la dirección donde lo estés probando.

### 2.1 Que la vista previa al compartir es la correcta *(observación 1)*

La prueba de verdad es compartir un enlace:

1. Copia la dirección de una categoría, por ejemplo `https://doogking.com/veterinaria`.
2. Pégala en un chat de WhatsApp **sin enviarla** y espera dos segundos.
3. Debe aparecer una tarjeta con el logotipo de Doogking sobre fondo azul, el título
   «Veterinarios · Doogking» y una descripción de la categoría.

Antes salía la descripción de la portada en todas las páginas.

> Si has compartido ese enlace antes, WhatsApp guarda la vista previa vieja durante unas
> horas. Prueba con una dirección que no hayas compartido nunca, o añádele `?x=1` al final.

**Para ver el título de cada página sin compartir nada:** abre cada una y mira el nombre
de la pestaña del navegador. Tienen que ser distintos entre sí:

| Página | Título esperado |
|---|---|
| `doogking.com` | Doogking · Todo para tu rey, en un solo lugar |
| `doogking.com/alojamiento` | Alojamiento canino · Doogking |
| `doogking.com/veterinaria` | Veterinarios · Doogking |
| `doogking.com/explora` | Explora con tu mascota · Doogking |

Y con la ciudad puesta, el título la recoge: entra en `/veterinaria`, busca «Valencia» y
la pestaña pasará a decir **«Veterinarios en Valencia · Doogking»**, que es como la gente
lo escribe en Google.

### 2.2 Que Google puede leer el sitio *(observación 1)*

Abre estas dos direcciones en el navegador:

- `doogking.com/robots.txt` → tiene que salir un texto plano con instrucciones, no la web.
- `doogking.com/sitemap.xml` → tiene que salir un listado de direcciones, no la web.

Si en cualquiera de las dos aparece la página de inicio, es que no están funcionando.

### 2.3 El aviso de cookies *(observación 2)*

1. Abre `doogking.com` **en una ventana de incógnito** (si no, ya tienes tu decisión
   guardada y el aviso no vuelve a salir).
2. Abajo debe aparecer el aviso con tres botones: **Aceptar todas**, **Rechazar todas** y
   **Configurar**. Los tres se ven a la vez y del mismo tamaño; rechazar cuesta un clic,
   igual que aceptar. Eso es lo que exige la normativa.
3. Pulsa **Configurar**: se despliegan tres familias (Preferencias, Medición, Publicidad),
   **todas apagadas**, más una fila de «Necesarias · Siempre activas» que no se puede tocar.
4. Pulsa **Rechazar todas** y entra en la ficha de cualquier servicio: el mapa se sigue
   viendo, pero dibujado con OpenStreetMap en lugar de Google Maps.
5. Ve a `doogking.com/cookies` y, al final del punto 4, pulsa **Configuración de cookies**:
   el aviso vuelve a salir. Retirar el permiso tiene que ser tan fácil como darlo.

También hay un enlace **Configuración de cookies** en el pie de la portada.

### 2.4 La página 404 *(observación 3)*

Escribe una dirección que no exista, por ejemplo `doogking.com/esto-no-existe`.

Debe salir una página que dice **«Esta página no existe»**, con el buscador, las categorías
y un botón para volver a la portada. Antes te llevaba a la portada sin decir nada.

> Hay una parte que no se ve pero es la importante para Google: la respuesta lleva el
> código «no encontrado». Para comprobarlo hace falta una herramienta; lo más fácil es
> `https://httpstatus.io`, pegar la dirección y ver que devuelve **404** y no 200.

### 2.5 El dato interno de la ficha *(observación 4)*

Entra en cualquier ficha de `doogking.com/explora` y baja hasta **«Qué vas a encontrar»**.
No debe aparecer ninguna línea que diga `municipios_final.xlsx` ni «Fuente:».

### 2.6 El buscador de la portada *(observación 5)*

En `doogking.com`, el primer campo del buscador es **«¿Qué servicio necesitas?»**.

- Mientras no elijas categoría, no se te piden ni fechas ni nada más, y el botón *Buscar*
  está apagado.
- Elige **Veterinarios**: aparece «Fecha de la cita» y «Hora».
- Cambia a **Alojamiento canino**: aparecen «Ingreso» y «Salida».

Antes salían siempre «Ingreso» y «Salida», aunque vinieras buscando un veterinario.

### 2.7 El tono de crematorios *(observación 6)*

En `doogking.com/funerarios`, el campo de la mascota dice **«¿Para qué mascota necesitas
el servicio?»** y al abrirlo **no hay contador** con botones «−» y «+».

Compáralo con `doogking.com/peluqueria`, donde sí lo hay porque ahí tiene sentido llevar
dos perros a la vez.

### 2.8 Las direcciones de Explora *(observación 7)*

1. Entra en `doogking.com/explora` y abre cualquier ficha.
2. Mira la barra de direcciones: debe leerse algo como
   `doogking.com/explora/rio-jucar-a-su-paso-por-riola-riola`.
3. Los enlaces antiguos siguen valiendo: si abres uno con el código largo, la página se
   carga igual y la dirección se corrige sola a la versión legible.

### 2.9 El menú de categorías *(observación 11)*

Entra **con la cuenta de administrador** —que es como se hizo la auditoría— y quédate en
la parte pública de la web. Bajo la cabecera tiene que verse la tira de categorías
(Alojamiento, Seguros, Peluquería, Veterinarios…).

Entra luego en `/admin`: ahí la tira desaparece, porque dentro del panel estorba.

### 2.10 Los iconos de redes sociales *(observación 12)*

En el pie de la portada, pon el ratón encima de cualquier icono social: aparece su nombre.
Para quien usa un lector de pantalla, ahora se anuncian como «Instagram de Doogking» en
lugar de un botón sin nombre.

### 2.11 El peso de la página *(observación 13)*

Es una mejora técnica que no se ve, pero se mide: la portada ha pasado de **5.118 líneas
de código invisible a 242**, y de 206,5 KB a 169,5 KB. Se nota en que carga algo antes,
sobre todo en móvil con mala cobertura.

---

## 3. Comprobación que he hecho yo

Ejecuté 62 comprobaciones automáticas contra la versión nueva funcionando. **58
correctas.** Los cuatro fallos, revisados uno a uno:

| Comprobación | Veredicto |
|---|---|
| `sitemap.xml` devuelve 404 | **No es un fallo del código.** El sitemap lo genera el API, y en la prueba local el API que respondía era el de producción, que todavía no tiene el módulo. Queda por verificar tras desplegar |
| Crematorios «con contador de perros» | **Falso positivo de mi propia comprobación.** El texto que detecté estaba en la hoja de estilos, no en la página. El contador no se pinta y la etiqueta propia sí aparece |
| Ficha de Explora sin datos estructurados | **No es un fallo del código.** La ficha no cargó porque el API de producción aún no resuelve las direcciones legibles (ver el aviso del principio) |
| `/explora/planificador` sin título propio | **Era un hueco real.** Es una página pública y se quedaba con el título genérico. **Corregido**: ahora dice «Planifica una escapada con tu perro · Doogking» |

Además: 2.996 pruebas automáticas en la web y 1.695 en el API, todas correctas, y los
dos proyectos compilan.

### Lo que no he podido comprobar y habrá que mirar tras el despliegue

1. Que `sitemap.xml` devuelve el listado real (depende del API desplegado).
2. Que las fichas de Explora abren por su dirección legible en producción (mismo motivo).
3. Que la vista previa se ve bien en WhatsApp y Facebook de verdad, no sólo en el código.
4. Que el dato interno (`municipios_final.xlsx`) no aparece en ninguna de las fichas
   cargadas en producción.

---

## 4. Lo que queda pendiente

### Bloqueante para publicar

| Qué | Quién |
|---|---|
| **`git push`** del commit `7fec988` y esperar a que desplieguen **API y web** | Desarrollo |
| **Rellenar los datos legales** en `apps/web/src/app/features/legal/legal.datos.ts`: razón social, NIF/CIF y domicilio social. Mientras falten, los documentos legales salen con un aviso de «borrador sin publicar», y Meta y Google rechazan la política de privacidad sin esos datos | **Cliente** |

### Tras publicar

| Qué | Quién |
|---|---|
| Dar de alta `doogking.com/sitemap.xml` en Google Search Console | Desarrollo |
| Comprobar la vista previa en WhatsApp y en el depurador de enlaces de Facebook | Cualquiera |

### Mejoras de contenido (observaciones 8 y 9)

| Qué | Quién |
|---|---|
| Fotografías reales de las fichas principales de *Explora* | **Cliente** |
| Textos propios de cada ficha: acceso, mejor momento para ir, normas locales, sombra, agua, aparcamiento, restricciones | **Cliente** |
| Primeras opiniones de la comunidad, para que las fichas no salgan vacías | **Cliente** |

La imagen de vista previa (`apps/web/public/images/og-doogking.png`, 1200×630) se generó a
partir del logotipo. Funciona, pero si diseño quiere una propia basta con sustituir el
fichero por otro de la misma medida.
