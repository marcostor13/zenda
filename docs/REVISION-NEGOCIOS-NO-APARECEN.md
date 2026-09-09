# Revisión — «hay negocios aprobados que no aparecen en la búsqueda»

Reporte del cliente del 10 de septiembre de 2026. Este documento recoge la
revisión completa de la cadena *aprobación → publicación → buscador*, las causas
encontradas, lo corregido y cómo comprobar y reparar los datos que ya están en
producción.

---

## Por qué puede pasar

El buscador **no consulta el estado del comercio**. Filtra por `comercioActivo`,
una copia de ese estado que cada listado lleva encima:

```ts
// catalog.repository.ts · construirFiltro
{ estado: 'publicado', comercioActivo: true, … }
```

Está desnormalizado a propósito: cruzar cada búsqueda contra `comercios` rompería
el índice ESR (CLAUDE.md §4.3). El precio de esa decisión es que **la copia hay
que mantenerla al día**, y el comentario del esquema decía que lo hacía
`ComerciosService.cambiarEstado`. Resultó no ser la única puerta.

De ahí el síntoma: en el panel el negocio dice «activo» y en la web no aparece,
porque son dos sitios distintos y decían cosas distintas.

---

## Causas encontradas

### C1 · Aprobar desde la edición de la ficha no propagaba la copia ⚠️ principal

El panel tiene **dos** formas de aprobar:

| Vía | Endpoint | Propagaba |
|---|---|---|
| Botón «Aprobar» | `PATCH /comercios/:id/estado` | Sí |
| Desplegable «Estado» del formulario de edición | `PATCH /admin/comercios/:id` | **No** |

La segunda escribía el estado con un `$set` junto al nombre comercial, el plan y
la comisión. El comercio quedaba `activo` y sus listados con `comercioActivo:
false`: **aprobado y sin aparecer**. Y al revés era peor — suspender desde ahí
dejaba los listados visibles y reservables, sin nota de auditoría y sin el
motivo obligatorio de TCK-8034.

**Corregido**: `AdminService.actualizarComercio` separa el estado del resto de
campos y lo delega en `ComerciosService.cambiarEstado`, que propaga, audita y
exige motivo para suspender. Si el estado que llega es el que ya tenía, no se
toca nada: guardar la ficha no debe generar una entrada de auditoría por edición.

### C2 · Los datos de demostración nacían invisibles

Ninguno de los siete seeders fijaba `comercioActivo`, y el esquema lo deja en
`false`. Todos los listados sembrados existían en la base y no salían en ninguna
búsqueda. Es la misma forma del fallo, en los datos de demostración.

**Corregido**: los seis seeders de categoría y `seed-europe.ts` los siembran ya
visibles, con una prueba en cada spec que lo exige.

### C3 · Un listado sin plazas desaparece del buscador

La búsqueda descarta por defecto lo que no se puede reservar
(`soloDisponibles = true`). El contador de plazas se deduce de la capacidad que
declara el comercio —espacios de la residencia, citas por día, cupos por
sesión—; si no la declara, el contador se queda a 0 y **el listado es invisible
aunque esté publicado y el negocio aprobado**.

Esto **no es un fallo**: está decidido y documentado en `catalog/disponibilidad.ts`.
Pero es la tercera explicación posible del mismo síntoma, y desde el panel no se
ve: la ficha dice «publicado». Queda cubierto por pruebas y lo señala el
diagnóstico.

### C4 · Un listado en borrador tampoco se ve

Un listado nace publicado sólo si el comercio **cerró el alta guiada** y subió
al menos `MIN_FOTOS_SERVICIO` (5) fotos. Si no, queda en borrador. Es correcto,
y también explica el síntoma.

---

## Qué hacer con los datos que ya están en producción

Los dos primeros pasos **no escriben nada**:

```bash
# 1. Qué se ve y qué no, y por qué exactamente, listado a listado
bun run --cwd apps/api diagnostico:visibilidad

# Acotado a un negocio concreto, para responder a un ticket
bun run --cwd apps/api diagnostico:visibilidad -- --comercio "Royal Dog"

# 2. Simulación de la reparación
bun run --cwd apps/api backfill:comercio-activo

# 3. Reparación: iguala la copia de cada listado al estado de su comercio
bun run --cwd apps/api backfill:comercio-activo -- --aplicar
```

El diagnóstico separa lo que **bloquea** (no se ve en ninguna búsqueda: flag
desincronizado, listado en borrador, contador de plazas a 0, comercio inexistente
o `comercioId` guardado como texto) de lo que es **parcial** (se ve, pero queda
fuera de búsquedas corrientes: sin ciudad, sin coordenadas, sin fotos). Y lo
primero que dice es cuántos listados están desincronizados, que es la pregunta
del ticket.

El backfill es idempotente: se puede volver a ejecutar sin riesgo.

---

## Verificación

`apps/api/test/catalogo-visibilidad.e2e-spec.ts` — 15 pruebas contra el API
ensamblado. No miran el documento: **preguntan al buscador**, que es lo que ve
el cliente.

| Bloque | Qué comprueba |
|---|---|
| Para aparecer | No sale mientras está pendiente; sale al aprobar; sale si se publica con el negocio ya aprobado; **no sale sin plazas declaradas** y sí con `soloDisponibles=false`; no sale en borrador |
| Aprobar desde la edición (C1) | Lo hace visible igual que el botón; negocio y listados dicen lo mismo; queda auditado; exige motivo para suspender; guardar otro campo no lo esconde |
| Al dejar de estar aprobado | Desaparece al suspender por las dos vías; desaparece al pausar la cuenta y vuelve al reactivarla; vuelve si se aprueba de nuevo |

Más: `admin.service.spec.ts` (5 pruebas del reparto entre edición y cambio de
estado) y los siete specs de seeder.

---

## Lo que queda abierto

**No hay nada que impida que esto vuelva a pasar por una vía nueva.** La copia
se mantiene en tres sitios (`cambiarEstado`, `pausar`/`reactivar`, `bajaLogica`)
y ahora la edición del admin delega en el primero, pero quien añada mañana otro
camino que escriba `comercios.estado` volverá a desincronizarla. Cerrar la clase
entera pide una de dos cosas, y las dos son decisión tuya:

- Un hook de Mongoose en el esquema de `Comercio` que propague en cualquier
  escritura de `estado`. Cierra el agujero del todo, a cambio de que una
  colección escriba en otra desde el esquema.
- Una comprobación periódica que avise de desincronizaciones, en vez de
  impedirlas.
