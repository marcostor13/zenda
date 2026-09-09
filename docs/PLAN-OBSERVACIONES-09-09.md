# Plan — Observaciones del cliente del 9 de septiembre de 2026

Nueve observaciones recibidas por WhatsApp. Este documento recoge la causa real
de cada una (verificada en el código, no supuesta) y el trabajo para cerrarlas.

Estado: 🟡 en curso · ✅ cerrada

| # | Observación | Causa raíz | Estado |
|---|---|---|---|
| O1 | Alta de negocio: `each value in verticales must be one of…` + «sesión caducada» + botón visible estando logueado | Borrador en `localStorage` con categorías de un catálogo antiguo; sin interceptor de 401; `muestraAltaComercio` no miraba la sesión | ✅ |
| O2 | Búsqueda con IA: «Peluquería canina en Valencia» acaba en alojamiento y pierde la ciudad | `ai-search` depende de `DEEPSEEK_API_KEY`; sin clave devuelve todo `null` y `rutaDeVertical(null)` cae en alojamiento | ✅ |
| O3 | Términos, Cookies y Contacto llevan a la portada | Las rutas `/terminos`, `/cookies` y `/contacto` no existen y el comodín `**` redirige a `''` | ✅ |
| O4 | Planificador: «el asistente con IA no está disponible» | Mismo origen que O2: sin clave, el itinerario se arma con datos propios y el aviso lo anunciaba como avería | ✅ |
| O5 | Veterinaria muestra «medicina general», cirugía y especialidades | El catálogo cerrado ya existe, pero el listado y la ficha públicos seguían pintando `especialidades` | ✅ |
| O6 | En «para empresas», Planes/Ventajas llevan a la portada | `<base href="/">` + `href="#planes"` resuelve contra la base, no contra la URL actual | ✅ |
| O7 | En inglés gran parte sigue en español | Faltaban claves de diccionario y catálogos de datos sin traducir | ✅ |
| O8 | En Explora aparece «fuente: municipios_final.xlsx» | El sembrado guarda la procedencia en `atributos` y la ficha pinta todos los atributos | ✅ |
| O9 | En Explora aparecen hoteles pet-friendly | Tarjeta del bloque Explora de la portada que enlaza a un vertical de contratación | ✅ |

---

## O1 · Alta de negocio y sesión caducada

**Tres fallos distintos en un mismo síntoma.**

1. `RegistroComercioComponent` guarda un borrador con las categorías marcadas en
   `localStorage` y lo restaura sin validarlo. Quien empezó un alta antes del
   1-09-2026 tiene ahí `cuidadores`, que ya no existe en `VerticalKey`, y el API
   responde `each value in verticales must be one of…`.
   → Al restaurar se filtra contra el catálogo vigente.
2. No había ningún interceptor de `401`. Con el JWT caducado el token seguía en
   `localStorage`, cada pantalla mostraba su propio error y el usuario no era
   llevado a ninguna parte.
   → `sesionInterceptor`: cierra la sesión y lleva a `/auth/login?motivo=sesion`,
   conservando la URL de vuelta. El login lo explica en vez de dejar un error suelto.
3. `muestraAltaComercio` se mostraba también al cliente logueado.
   → Sólo se muestra a quien no ha entrado.

## O2 · Búsqueda con IA

**Dos causas, y la segunda sólo apareció al probarlo en un navegador real.**

El `<form>` del buscador escuchaba `(ngSubmit)`, un evento que emite una
directiva de formulario; allí no hay ninguna —un `[formControl]` suelto y sólo
`ReactiveFormsModule`—, así que nadie lo emitía nunca. El botón hacía un submit
del navegador y la portada se recargaba con un `?` al final: **pulsar «buscar»
no buscaba nada**. Es el mismo fallo que ya se corrigió una vez en el alta de
comercio. Ahora se escucha el `submit` nativo y se corta con `preventDefault`.

Y por debajo, `AiSearchService` devuelve todo `null` cuando no hay
`DEEPSEEK_API_KEY`, y el frontend navegaba con `rutaDeVertical(null)`, que cae
en alojamiento.

→ **Intérprete local determinista** (`interpretacion-local.ts`): reconoce las ocho
categorías por sinónimos (ES/EN), la ciudad (patrón «en …» más censo de
poblaciones), fechas relativas, presupuesto y número de perros. Se usa siempre:
como respuesta cuando no hay modelo, y para rellenar lo que el modelo deje vacío.
El frontend deja de navegar a ciegas cuando no hay categoría.

## O3 · Términos, Cookies y Contacto

Se crean las tres páginas reales (`/terminos`, `/cookies`, `/contacto`) sobre el
marco `app-legal-documento` que ya usan privacidad y eliminación de datos, y se
retira el comodín que las estaba tragando para esas rutas.

## O4 · Planificador

Se mejora el itinerario sin modelo (más días, paradas agrupadas por tipo,
presupuesto real) y el aviso deja de anunciar una avería: el usuario recibe un
plan hecho con datos propios, que es lo que de verdad ocurre.

## O5 · Veterinaria

Regla de `veterinarios.md`: *si el cliente no puede saber cuánto va a pagar antes
de ir, no se publica*. El catálogo cerrado (`ServicioClinicoTipo`) ya estaba en el
alta del comercio; faltaba el lado público.

- Listado: la insignia pasa de `especialidades[0] ?? 'Medicina general'` al primer
  servicio contratable.
- Ficha: el bloque «Especialidades» pasa a «Servicios con precio cerrado» y lista
  los servicios reservables con su importe.
- Filtros: «Especialidades» se sustituye por «Servicios», sobre el catálogo cerrado.

## O6 · Anclas de /para-comercios

`<base href="/">` hace que `href="#planes"` resuelva a `/#planes`. Se cambian por
`routerLink` con `fragment`, que es lo que entiende `anchorScrolling`.

## O7 · Multiidioma

Tres huecos distintos, medidos con una auditoría sobre el código:

1. **Claves usadas en plantilla sin entrada en el diccionario** (184). La landing
   de empresas entera estaba sin traducir, más avisos sueltos de reservas y pagos.
2. **Catálogos de datos sin traducir** (amenities, conductas, servicios clínicos,
   servicios funerarios, coberturas de seguro, planes, permisos, motivos de baja,
   tipos de campaña, festivos, tamaños de perro, aspectos de reseña…). Se pintan
   con `| t` desde arrays, así que la auditoría de literales no los veía.
3. **Etiquetas que ni siquiera pasaban por el pipe.** La más visible: todo el
   panel de filtros de los listados (`rs-filtros-listado`) interpolaba
   `g.titulo` y `o.etiqueta` en crudo, así que seguía en castellano completo en
   cualquier idioma. Igual el orden del listado, los chips de filtro activo, los
   tamaños de perro, los estados de reserva del panel de administración, las
   fases del alta y los planes de suscripción.

Resultado: **439 cadenas nuevas × 7 idiomas** en dos módulos nuevos por idioma
(`catalogos.ts` y `paginas.ts`), más el pipe donde faltaba. Los nombres propios
no se traducen y se dejaron fuera a conciencia: poblaciones, razas de perro,
marcas (Stripe, Google, Meta) y los endónimos del selector de idioma
(«Deutsch», «Polski»), que deben leerse en su propia lengua.

Lo que **no** entra aquí, y queda anotado: el API sigue respondiendo siempre en
castellano (recibe `Accept-Language` y la ignora). Afecta a los mensajes de error
del servidor, a los correos y al aviso del planificador.

## O8 y O9 · Explora

- `fuente` es un dato interno de sembrado: se deja de exponer en el API y la ficha
  ignora los atributos internos.
- La tarjeta «Hoteles pet friendly» sale del bloque Explora: es un vertical de
  contratación, no un sitio de la comunidad.

---

## Verificación

**Unitarias**, junto a cada fichero tocado:

| Fichero | Qué cubre |
|---|---|
| `core/interceptors/sesion.interceptor.spec.ts` | 401 cierra sesión y redirige; login y alta quedan fuera |
| `core/guards/auth.guard.spec.ts` | conserva la ruta pedida para volver a ella |
| `features/auth/registro-comercio/…spec.ts` | borrador caducado, 400 del API, 409 de email |
| `shared/components/navbar/…spec.ts` | el alta sólo se ofrece al visitante |
| `features/legal/terminos|cookies|contacto…spec.ts` | las tres páginas nuevas |
| `shared/verticales/filtros.config.spec.ts` | veterinaria filtra por servicio, no por especialidad |
| `features/verticales/vertical-browse…spec.ts` | la insignia es un servicio contratable |
| `features/verticales/vertical-detalle…spec.ts` | chips con precio y encabezado por vertical |
| `features/home/home.component.spec.ts` | búsqueda con IA y bloque Explora sin hoteles |
| `api/core/ai-search/interpretacion-local.spec.ts` | 44 casos del intérprete determinista |
| `api/core/ai-search/ai-search.service.spec.ts` | combinación de modelo e interpretación local |
| `api/core/lugares/lugares.service.spec.ts` | los atributos internos no salen del API |
| `api/core/lugares/municipios-cv.spec.ts` | la procedencia va fuera de `atributos` |
| `api/core/planificador/planificador.service.spec.ts` | el itinerario propio no se anuncia como avería |

**E2E** (`apps/web/e2e/observaciones-09-09.spec.ts`), para lo que sólo se ve en un
navegador real: que las anclas no salten a la portada, que las rutas legales
existan, que un 401 expulse al login, que la búsqueda con IA no acabe en
alojamiento, que veterinaria no publique especialidades y que Explora no filtre
información interna ni ofrezca hoteles.

```bash
bun run test:api && bun run test:web    # unitarias
bun run --cwd apps/web e2e              # Playwright (levanta ng serve solo)
```

---

## Anexo · Cobertura del alta de comercio

El alta es el recorrido que trae la oferta a la plataforma y de donde salió la
observación O1, así que se cubrió entera, en las dos capas.

**`apps/api/test/comercio-alta.e2e-spec.ts`** — 38 pruebas contra el API
ensamblado y una Mongo en memoria:

| Bloque | Qué comprueba |
|---|---|
| Alta rápida | Cuenta pendiente sin token; negocio con sus categorías; nace `pendiente` y plan `basico`; rol `comercio_admin` vinculado; contraseña sólo como hash bcrypt; nombre comercial provisional; no se inventa la razón social; alta sin categorías |
| Validación | **Categoría retirada del catálogo → 400 sin dejar rastro** (la regresión de O1); las ocho vigentes; categorías repetidas; email y contraseña; campos no declarados (`rol: admin`, `estado: activo`) |
| Colisiones | Email duplicado → 409 sin dejar un negocio huérfano; identificador fiscal repetido → 409; dos negocios distintos conviven |
| Verificación | Sesión con rol y `comercioId`; login posterior; **no se entra sin confirmar el correo**; token inventado |
| Primer acceso | Lee su comercio; empieza sin reservas ni servicios; es la única persona del equipo; completa el perfil; **no puede cambiar su estado ni su plan**; no alcanza el panel de plataforma; no vincula un segundo negocio |
| Onboarding | Crea el negocio y devuelve **token nuevo** (el viejo no lleva `comercioId`); nace pendiente; exige los datos fiscales; sin sesión → 401 |
| Aprobación | La plataforma lo pasa a activo; aparece en el listado de pendientes |

**`apps/web/e2e/alta-comercio.spec.ts`** — 24 pruebas en navegador: las ocho
categorías, no se sigue sin marcar ninguna, contador y desmarcado, el borrador
(recuperado, depurado, vaciado e ilegible), validación de campos sin llamar al
API, ver la contraseña, enlaces legales, el envío con las categorías correctas,
**que no se recargue la página**, limpieza del borrador, reenvío del correo,
y los tres errores del API (409 con enlace a entrar, 400 que devuelve al paso 1,
500 conservando lo escrito).

### Dos fallos que aparecieron al probarlo

1. **El botón de la búsqueda con IA no buscaba** (O2). Sólo se veía en navegador.
2. **El aviso de error desaparecía al volver al paso 1.** Lo introdujo el propio
   arreglo de O1: el alerta vivía dentro del formulario del paso 2, así que al
   rebotar al paso 1 se iba con él y el comercio se encontraba de vuelta en la
   primera pantalla sin explicación. El aviso pasa a estar por encima de los dos
   pasos.

```bash
bun run --cwd apps/api test:e2e   # incluye comercio-alta.e2e-spec.ts
bun run --cwd apps/web e2e        # incluye alta-comercio.spec.ts
```
