# Deuda técnica — trayecto por carretera del transportista

**Fecha:** 2026-08-31
**Estado:** pendiente
**Motivo:** el cambio se pidió sin tests, para no frenar la entrega. Este
documento existe para que la deuda se pueda saldar sin volver a reconstruir el
contexto.

---

## 1. Qué se cambió

En `/comercio/alta` → paso «Detalles» → categoría **Transporte**:

| Antes | Ahora |
|---|---|
| Campo **Radio de cobertura (km)** en «Condiciones del servicio» | Eliminado del formulario |
| «Poblaciones donde trabajas» (existió brevemente) | Eliminado por completo, front y back |
| — | **Tu trayecto habitual**: puntos de recogida escritos como **direcciones** (calle y número), en orden, trazados **por carretera con Google Directions** y dibujados en el mapa, con su distancia y duración |

El radio se retiró porque un radio en kilómetros mete dentro pueblos a los que
el transportista no sube y deja fuera el que sí hace por la autovía. La zona
sigue declarándose con `zonaCobertura` (provincias), y el recorrido concreto con
`trayecto`.

**«Condiciones del servicio» conserva** distancia mínima facturable, antelación
mínima, máximo de perros por trayecto, razas PPP y transportín propio. Sólo
salieron de ahí el radio y las poblaciones.

### Archivos tocados

**Mapa (compartido, afecta a buscador y ficha):**
- `motores/motor-mapa.ts` — nuevos `PuntoRuta`, `ResumenRuta`, `COLOR_RUTA`,
  `MAX_PARADAS_INTERMEDIAS`, `distanciaEnLineaRecta()` y
  `MotorMapa.pintarRuta(): Promise<ResumenRuta | null>`.
- `motores/motor-google.ts` — `pintarRuta()` pide la ruta a
  `DirectionsService` y la dibuja con `DirectionsRenderer`
  (`suppressMarkers` + `preserveViewport`); si falla, cae a polilínea recta y
  devuelve `porCarretera: false`. `resumirTramos()` suma metros y segundos.
- `motores/motor-leaflet.ts` — sólo línea recta (OpenStreetMap no calcula
  rutas), devolviendo también `porCarretera: false`.
- `rs-mapa.component.ts` — input `ruta`, output `rutaTrazada`; las paradas
  entran en el encuadre junto a los pines.

**Formulario:** `comercio-listado-form.component.ts` — señales `trayecto` y
`rutaTrazada`, control `direccionParada`, operaciones de añadir/quitar/reordenar
puntos, computados `pinesTrayecto` / `lineaTrayecto` / `trayectoLleno`, y los
auxiliares `nombreDeParada()` y `duracionLegible()`.

El buscador de paradas va en modo `tipo="direccion"` con
`[sugerenciasIniciales]="0"`: **no propone nada al enfocar**, el desplegable sale
en blanco hasta que se escribe. Sugerir poblaciones invitaba a marcar «Madrid»
como punto de recogida, y una ciudad entera no es un sitio donde parar la
furgoneta.

**Backend:** `transporte.schema.ts` (nuevo `trayecto: ParadaTrayecto[]`,
`radioCoberturaKm` marcado `@deprecated`) y `catalog.service.ts` (`trayecto`
añadido a las dos listas de campos de transporte).

---

## 2. Tests pendientes

### 2.1 `motor-google.spec.ts`

El doble de `maps` necesita `DirectionsService`, `DirectionsRenderer`,
`TravelMode` y `Polyline`.

- [ ] Con dos o más puntos pide la ruta a Directions con **origen, destino y los
      intermedios como `waypoints` con `stopover`**, en el orden dado.
- [ ] Dibuja con `DirectionsRenderer` en modo `suppressMarkers` y
      `preserveViewport` — si no, Google pone sus propios marcadores encima de
      los pines numerados y reencuadra por su cuenta.
- [ ] Devuelve `{ distanciaKm, duracionMin, porCarretera: true }` sumando todos
      los tramos (`legs`), no sólo el primero.
- [ ] **Si Directions rechaza** (cuota, red, parada sin carretera) cae a la
      polilínea recta y devuelve `porCarretera: false`.
- [ ] Si Directions responde **sin rutas**, mismo respaldo.
- [ ] Corta en `MAX_PARADAS_INTERMEDIAS + 2` puntos: pedir más devuelve error y
      dejaría el trayecto sin dibujar.
- [ ] Con menos de dos puntos no dibuja nada, borra lo anterior y devuelve
      `null`.
- [ ] Llamarla dos veces deja un solo trazado (se limpian polilínea y renderer).
- [ ] `destruir()` retira ambos: si no, quedan colgados del mapa de Google.

### 2.2 `motor-leaflet.spec.ts`

- [ ] Dibuja la polilínea con las paradas en orden y devuelve
      `porCarretera: false`.
- [ ] Menos de dos paradas: nada dibujado, `null`, y se borra la anterior.
- [ ] `destruir()` la retira.

### 2.3 `motor-mapa.spec.ts`

- [ ] `distanciaEnLineaRecta` con dos puntos conocidos (p. ej. Madrid–Zaragoza,
      ~270 km) cae dentro de un margen razonable.
- [ ] Suma los tramos cuando hay tres o más puntos.
- [ ] Devuelve 0 con menos de dos.

### 2.4 `rs-mapa.component.spec.ts`

- [ ] Cambiar el input `ruta` vuelve a trazar.
- [ ] Emite `rutaTrazada` con lo que devuelve el motor.
- [ ] **No emite si el componente ya se destruyó** mientras Directions
      respondía: el trazado va a la red y puede tardar más que la pantalla.
- [ ] Las paradas entran en el encuadre (pines en Madrid + parada en Zaragoza →
      `encuadrar` recibe ambos).
- [ ] Con `autoencuadre` en `false` no reencuadra aunque cambie la ruta.
- [ ] Un fallo del motor no rompe el pintado de los pines.

### 2.5 `comercio-listado-form.component.spec.ts`

Usar el helper `dejarListoParaPublicar()` que ya existe antes de cada `submit()`.

- [ ] `anadirParada` guarda nombre y coordenadas.
- [ ] **El nombre es la dirección formateada**, no la población: entre dos
      recogidas de la misma ciudad la calle es lo único que las distingue.
- [ ] Si Places no devuelve el detalle, `nombreDeParada` compone con calle,
      número y población; y si tampoco hay, queda la población sola.
- [ ] **El campo se vacía** tras añadir la parada: si se quedara lo anterior
      escrito, teclear la siguiente obligaría a borrarlo a mano cada vez.
- [ ] Con el campo en modo dirección y `sugerenciasIniciales` a 0, **enfocar sin
      escribir no despliega ninguna sugerencia**. Es el comportamiento pedido:
      las direcciones se escriben, no se eligen de una lista de partida.
- [ ] **Descarta una parada sin coordenadas**: una parada que no sale en el mapa
      no es una parada.
- [ ] No pasa de `MAX_PARADAS_INTERMEDIAS + 2`; `trayectoLleno()` se pone a
      `true` y el aviso sale en pantalla.
- [ ] `subirParada` / `bajarParada` cambian el orden; en los extremos no hacen
      nada.
- [ ] `quitarParada` retira la de ese índice.
- [ ] `pinesTrayecto` numera desde 1 y en orden; `lineaTrayecto` devuelve sólo
      lat/lng en el mismo orden.
- [ ] Se guarda en `extra.trayecto` y se precarga al editar.
- [ ] `duracionLegible`: `45` → «45 min», `190` → «3 h 10 min», `120` → «2 h».
- [ ] El grupo de transporte ya **no** tiene `radioCoberturaKm` ni
      `poblaciones`, y el payload no los manda. Un listado antiguo que los tenga
      guardados no los pierde (el API sólo pisa las claves que recibe).

### 2.6 `catalog.service.spec.ts` (API)

- [ ] `crearServicio` de transporte persiste `trayecto`.
- [ ] `poblaciones` **se ignora** si llega: ya no está en la lista blanca.

---

## 3. Cosas que quedaron fuera y conviene decidir

1. **Coste de Directions.** Cada repintado del trayecto es una petición
   facturable. Hoy se traza en cada cambio de la lista de puntos, que en el alta
   son unas pocas veces; si se lleva a la ficha pública conviene **guardar la
   polilínea codificada** (`overview_polyline`) junto al trayecto y pintarla sin
   volver a llamar al API.
2. **La ficha pública no pinta el trayecto todavía.** El dato ya viaja en
   `extra.trayecto`; falta enseñarlo en el detalle de transporte con el mismo
   `rs-mapa [ruta]`.
3. **El buscador no filtra por el trayecto.** La búsqueda de transporte sigue
   usando `ubicacion.ciudad` y `zonaCobertura`. Cruzar una solicitud contra el
   recorrido declarado pide un índice geoespacial sobre las paradas.
4. **`radioCoberturaKm` sigue en el esquema y en la lista blanca del API.** Es
   deliberado —no se borran datos de comercios vivos—, pero conviene una
   migración que lo retire cuando ya nadie lo consulte.
5. **La clave de Maps necesita Directions habilitado** en la consola de Google.
   Sin ese permiso el trazado cae a la línea recta en silencio (la pantalla lo
   dice, pero conviene comprobarlo al desplegar).
