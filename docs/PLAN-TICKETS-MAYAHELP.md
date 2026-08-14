# Plan de ejecución — 28 tickets de MayaHelp

> **Fuente de verdad del progreso.** Al cerrar un ticket, márcalo aquí con lo que se tocó.
> Origen: `docs/tickets-mayahelp (5).md`. Citar `TCK-80XX` en cada commit.

## Alcance real

28 tickets, la mayoría con 10–20 sub-puntos. En bruto son **más de 300 cambios**: no es
trabajo de una tanda. Las capturas son de **producción** (`doogking.com`), y los adjuntos se
descargan sin credenciales desde `r2.mayahelp.marcostorresalarcon.com`.

Se ordena por **tipo de trabajo**, no por número de ticket: primero los errores reales,
después los renombrados (mecánicos y muy visibles), y al final los rediseños de pantalla,
que son los que más tiempo consumen.

## Estado

| Fase | Contenido | Tickets | Estado |
|---|---|---|---|
| F0 | Auditoría de lo ya hecho | — | ✅ hecho |
| F1 | Errores reales | 8012 ⚠️ · **8021 ✅** | 🟡 en curso |
| F2 | Renombrados y textos · panel comercio | **8017 ✅ · 8022 ✅ · 8023 ✅ · 8024 ✅ · 8025 🟡 · 8026/8027 🟡** | 🟡 en curso |
| F3 | Alpha solo para clientes | **8029 ✅ · 8034 🟡 (parte Alpha) · 8035 🟡 (parte Alpha)** | 🟡 en curso |
| F4 | Panel comercio · estados, filtros y vacíos | **8018 ✅ · 8022 ✅ · 8025 ✅ · 8028 🟡** | 🟡 en curso |
| F5 | Panel admin · textos, resúmenes y filtros | **8034 🟡 · 8035 🟡** · resto 8030–8039 ⬜ | 🟡 en curso |
| F6 | Marca y público | 8004, 8008, 8009, 8010, 8011 | ⬜ |
| F7 | Módulos nuevos (producto) | 8040 | ⬜ planificar al terminar F1–F6 |

## F0 — Auditoría (hecho)

- **TCK-8008 / 8009 / 8010 (iconos en vez de emojis):** el sistema Lucide ya existe
  (`rs-icon` con 100 iconos) y hay un test que prohíbe emojis en el código de producción
  (`shared/sin-emojis.spec.ts`). **Probablemente ya cerrados**; queda verificar pantalla por
  pantalla las que citan las capturas antes de darlos por buenos.
- **TCK-8012 (no sale la foto del perro):** `perro-form.component.ts` ya tiene subida
  (`rs-image-upload formControlName="fotos"`), precarga al editar, envío en el payload y un
  mensaje de error propio si la subida falla o está en curso. **Probablemente ya cerrado**
  (el ticket es del 2026-08-02 y el formulario se rehízo después). Falta reproducirlo en la
  app antes de darlo por bueno: si aún falla, el problema estará en la subida del fichero,
  no en el formulario.
- **TCK-8021 (Cuidadores):** vivo en **14 ficheros** de web + api + shared. Pendiente — es
  el primero que hay que ejecutar.

## Detalle por fase

### F1 — Errores reales
- **TCK-8012** — al registrar un perro no se guarda/muestra la foto.
- **TCK-8021 ✅ hecho** — eliminado el vertical **Cuidadores** de toda la plataforma.
  Comprobado antes en Mongo que **no había ningún servicio con ese vertical**, así que no
  hizo falta migrar datos. Tocado:
  - `libs/shared/src/enums/vertical.enum.ts` — fuera del enum y de las etiquetas (al quitarlo
    de aquí, el compilador señaló solo todo lo demás).
  - API: `catalog.module.ts`, `app.module.ts`, `catalog.repository.ts` (filtros y contador),
    `catalog.service.ts` (campos extra, requeridos y disponibilidad); **borrado**
    `apps/api/src/verticals/cuidadores/`.
  - Web: `verticales.config.ts`, `filtros.config.ts`, `resena-aspectos.config.ts`,
    `images.ts`, `app.routes.ts` (ruta `/cuidadores`), `vertical-browse.component.ts`;
    **borrado** `public/icons/cuidadores.svg`.
  - Pendiente de deuda: 3 specs siguen citándolo (`home`, `vertical-browse`,
    `verticales.config`).

### F2 — Renombrados y textos (panel comercio)

**Hecho (8017, 8022, 8023, 8024):** menú lateral (`Inicio`, `Servicios`,
`Extras y suplementos`, `Ingresos y pagos`), títulos y subtítulos de Inicio y Mis servicios,
`Valoración media`, `Completa tu perfil de empresa`, `Nuevo servicio`, y la jerga de Ingresos
(`GMV` → *Ingresos brutos*, `Fee Stripe` → *Gastos de procesamiento de pago*,
`Comisión plataforma` → *Comisión Doogking*, `Liquidación neta` → *Total a recibir*) tanto en
la pantalla de Ingresos como en el resumen financiero del Inicio. En Suplementos:
`Concepto` → *Nombre del suplemento*, `Importe (€)` → *Precio*, `Unidad` → *Tipo de cobro*.

**Corregido de paso:** la cabecera decía *"Bienvenido, Comercio"* porque usaba el nombre del
**usuario**, no el del negocio; ahora usa `nombreComercial` y cae al del usuario solo como
último recurso.

**8025 Reseñas — parcial.** Ya existían promedio, total, sin responder y la distribución
5→1 con barras y recuentos, así que los puntos 1, 3, 4 y 6 estaban cubiertos. Añadido lo que
faltaba: **los indicadores y las barras ahora filtran la lista** (puntos 5, 7 y 8) — pulsar
"Sin responder" o una puntuación filtra, y volver a pulsar quita el filtro. Subtítulo
cambiado a *"Consulta y responde las opiniones de tus clientes."*
⚠️ **Sin verificar en la app**: compila y construye, pero no se ha comprobado el filtro con
datos reales.
**Falta:** ordenación (Más recientes / Mejor valoradas), punto 9.

**8026/8027 Equipo — parcial** (son el mismo ticket duplicado). Hecho el subtítulo:
*"Gestiona tu equipo, asigna roles y controla los accesos al panel de tu negocio."*
**Falta lo gordo:** fichas con avatar/puesto/rol, acciones por empleado (Editar · Permisos ·
Desactivar), separar *puesto* de *nivel de acceso*, permisos por empleado y estados
(Activo / Invitación pendiente / Desactivado). Esto último **necesita backend**: hoy no
existe el concepto de permisos por miembro.

Resto de renombrados previstos:
- `Dashboard` → **Inicio**; `Listados` → **Servicios**; `Ingresos` → **Ingresos y pagos**;
  `Rating promedio` → **Valoración media**; `Nuevo listado` → **Nuevo servicio**.
- `Suplementos` → **Extras y suplementos**; `Concepto` → **Nombre del suplemento**;
  `Importe (€)` → **Precio**; `Unidad` → **Tipo de cobro**.
- Ingresos: quitar jerga (`GMV`, `Fee Stripe`) → **Comisión Doogking**, **Gastos de
  procesamiento de pago**, **Total a recibir**.
- Subtítulos de Equipo, Reseñas, Servicios y Mi cuenta.
- `Bienvenido, Comercio` → nombre real del negocio.

### F3 — Alpha solo para clientes

**Regla adoptada:** Alpha aplica **sólo a cuentas con rol `cliente`**. Ni comercio ni admin
tienen nivel; la escalera de la empresa es el plan Básico / Pro / Premium.

**TCK-8029 ✅ hecho** — desplegable *Mi cuenta*:
- Botón `Mi Comercio` → **Panel de mi comercio** (escritorio y móvil).
- Cabecera: nombre de la persona (cae a *Mi cuenta* si no hay nombre, nunca el del negocio).
- *Cliente verificado* ya no es un sello fijo: sólo sale si la cuenta está realmente
  verificada. Para eso el login ahora devuelve `verificado` (`AuthResponseDto`,
  `auth.service.ts` del API y `UsuarioAutenticado` en web) y `AuthService` expone
  `esCliente` / `clienteVerificado`. **Las sesiones abiertas antes de este cambio no traen
  el dato: el sello no aparecerá hasta volver a entrar.**
- Nivel: *"Nivel ALPHA I · N reservas"*, en romanos aunque la BD guarde `Alpha 1`.
- `Mi nivel Alpha y recompensas` → **Nivel Alpha y recompensas**, y sólo para clientes.
- Fuera **Buscar servicios** del desplegable; menú más compacto (menos aire vertical).
- Panel de comercio: la marca lateral muestra **nombre + Comercio verificado + Plan X**,
  sin rastro de Alpha.
- El mismo criterio en `/perfil`: el sello de verificado sólo si es real y la tarjeta Alpha
  no se pide para cuentas que no son de cliente.

**TCK-8034 🟡 — sólo la parte Alpha.** Quitado el botón *Alpha* de la tabla de comercios del
admin. Para no perder la funcionalidad (HU-13.3: qué empresas aplican el descuento), la
gestión se ha movido al bloque **Programa Doogking Alpha** del inicio del admin: busca la
empresa por nombre/CIF y la adhiere o la da de baja; sin búsqueda lista las ya adheridas.
Backend: filtro `alphaAdherido` en `GET /admin/comercios` (controller → service →
`comercios.repository`). El resto del ticket (resumen superior, filtros, ficha del comercio,
menú ⋯, motivo de rechazo) es **F5**.

**TCK-8035 🟡 — sólo la parte Alpha.** La tabla de usuarios del admin **no tiene hoy columna
Alpha**, así que no había nada que quitar. La columna con `—` para quien no es cliente se
construirá con el resto del rediseño en **F5**, y necesita backend: `listarUsuarios` no
devuelve ni nivel Alpha ni número de reservas.

⚠️ **Sin verificar en la app**: compila (`tsc`, `build:web`, `build:api`) y los specs
tocados pasan, pero falta la comprobación visual con datos reales.

### F4 — Panel comercio: estados, filtros y vacíos

**TCK-8018 ✅ Reservas.** La pantalla deja de ser un historial y pasa a ser la herramienta
diaria: resumen superior (Reservas de hoy · Pendientes de confirmar · Próximas 7 días, los dos
primeros clicables como filtro), pills por estado con contador (Todas / Pendientes /
Confirmadas / En curso / Completadas / Canceladas), buscador por cliente, mascota o nº de
reserva, filtros de periodo (Hoy / Esta semana / Este mes / Elegir fechas) y por servicio,
selector **Lista / Calendario** (calendario mensual con el número de reservas por día; una
estancia ocupa todos sus días, no sólo el de entrada), y tarjetas en vez de tabla con mascota,
cliente, servicio, entrada/salida o fecha y hora según el vertical, importe, estado con icono y
nº de reserva. Acciones rápidas *Ver reserva · Contactar · Gestionar*; "Gestionar" recoge lo
que ya existía (completar, solicitar ajuste, hitos, valorar perro, historia veterinaria).
Estado vacío con el texto del ticket y botón *Crear o publicar un servicio*.
- **Backend:** `GET /comercios/mis-reservas` devolvía sólo códigos e importes; ahora resuelve
  en lote **cliente (nombre, email, teléfono), título del servicio y nombre de la mascota**
  (`comercios.service.ts` + `users.repository.findContactosByIds`). El nombre del perro sale
  del `perroSnapshot`, así que sigue estando aunque el cliente borre la ficha. Límite subido
  de 50 a 200 para que los contadores por estado no salgan cortos.
- **No se puede hoy:** filtro por *profesional* — no existe la asignación de una reserva a un
  miembro del equipo (mismo hueco que bloquea 8026/8027).

**TCK-8022 ✅ Servicios.** Pills de estado con contador (Todos / Publicados / Borradores /
Pausados), buscador por nombre y filtro por categoría (aparecen sólo con más de un servicio),
tarjetas con **foto real**, categoría, precio en los términos del vertical (`/noche`, `base`,
`/sesión`, `/cita`) y resumen de disponibilidad publicada. Acciones *Editar · Disponibilidad ·
Ver en Doogking* y un menú **⋯** con publicar/pausar. Estado vacío con el texto del ticket y
botón *Crear mi primer servicio*, con menos aire para que el botón pese más.

**TCK-8025 ✅ Reseñas.** Añadida la ordenación que faltaba: **Más recientes / Mejor valoradas**,
más un atajo para quitar el filtro activo. Con esto el ticket queda cerrado.

**TCK-8028 🟡 Configuración.** Hecho lo que el cliente marcó como prioritario nº 1 y nº 2:
la página deja de ser un scroll interminable y se organiza en **11 pestañas** (Perfil ·
Ubicación · Contacto · Redes · Horarios · Políticas y cobros · Verificación · Documentación ·
Notificaciones · Verticales · Plan), con un indicador **"Perfil completado XX %"** que lista
qué falta y lleva de un clic a la pestaña donde se rellena.
*(La pestaña "Verticales" no estaba en la lista del ticket, pero esa sección existe y hay que
poder llegar a ella.)*
**Falta:** horarios partidos y excepciones, subida real de documentos + avisos de caducidad,
mapa en Ubicación, contador de caracteres, sección de Plan completa y guardado automático.
Casi todo eso **necesita backend** (schema de horario, documentos, plan).

### F5 — Panel admin (avance parcial)

**TCK-8035 🟡 Usuarios.** Resumen superior real (Totales · Clientes · Usuarios de comercios ·
Administradores Doogking · Nuevos este mes) vía nuevo `GET /admin/usuarios/resumen`; filtro por
verificación; columnas **Alpha** y **Reservas** (Alpha sólo para clientes, `—` para el resto), y
las acciones dentro de un menú **⋯** en lugar de la papelera suelta. El backend calcula reservas
y nivel Alpha por lote y **sólo para cuentas de cliente**.
**Falta:** ficha administrativa del usuario, roles internos de administración, historial de
acciones y exportación CSV.

**TCK-8034 🟡 Comercios.** Resumen superior (Totales · Activos · Pendientes · Suspendidos ·
Verificados) vía `GET /admin/comercios/resumen`; filtros por verificación, vertical y plan;
**Estado y Verificación en columnas separadas**; máximo 2 verticales + "+X"; acciones dentro de
**⋯**, con *Revisar solicitud* destacado en los pendientes y *Rechazar solicitud* en vez de
*Suspender* cuando el comercio aún está pendiente.
**Falta:** ficha administrativa del comercio, motivo obligatorio en rechazo/suspensión con
historial (necesita backend), y reservas/facturación/valoración por comercio.

> **TCK-8032 y TCK-8033 son el mismo ticket duplicado** (Reportes financieros, texto
> idéntico). Confirmado con el cliente: se tratan como uno solo.

### F5 — Panel admin (lo que queda)
Es la fase más grande. Por pantalla: Dashboard, Analítica, Reportes, Usuarios, Comercios,
Reservas, Cupones, Campañas, Comunidad. Patrón repetido en casi todas: **resumen superior con
tarjetas**, **filtros de periodo**, **estados vacíos trabajados** y **textos de cabecera**.
TCK-8040 añade módulos nuevos (pagos y liquidaciones, incidencias y disputas) que son
desarrollo de producto, no ajustes.

### F6 — Marca y público
- **TCK-8004** — revisado en código: la pantalla `proximamente` **ya lleva** el badge
  *"Estamos preparando algo muy grande"*, el texto largo que pedía el cliente, las tres
  ventajas con check y los iconos con etiqueta. Se dio por hecho en el PDF 27/07; queda
  comprobarlo en la app antes de cerrarlo.
- **TCK-8011** — Doogking Alpha con imagen más premium.
- **TCK-8008 / 8009 / 8010** — verificar que no queda ningún emoji en las pantallas citadas.

## Verificación

Por fase: `bunx tsc --project apps/web/tsconfig.app.json --noEmit`, `bun run build:web` y
`bun run build:api` cuando toque backend. Comprobación visual en la app con datos reales.
**Los tests van aparte**, como deuda ya registrada.
