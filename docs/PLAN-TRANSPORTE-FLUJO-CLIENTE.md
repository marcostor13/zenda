# Plan: flujo de cliente de Transporte de mascotas

**Fecha:** 2026-09-24
**Fuentes:**
- `docs/Doogking_Transporte_Cliente_Flujo.pptx`: 13 diapositivas con la especificación funcional.
- `docs/WhatsApp Image 2026-09-20 at 3.17.21 PM.jpeg`: mockup móvil de 6 pantallas.

**Objetivo del cliente:** buscar → calcular → comparar → contratar → seguir el viaje.
**Flujo final exigido:** BUSCAR → RUTA → FECHA → MASCOTA → MODALIDAD → COMPARAR → ELEGIR → DATOS → PAGAR → SEGUIR → VALORAR.

Estados: ⬜ pendiente · 🟡 en curso · ✅ cerrada

> Todo lo que describe este documento como «hoy» está verificado en el código a fecha de hoy
> (no en planes anteriores). Las rutas de fichero son relativas a `apps/web/src/app/` o `apps/api/src/`.

---

## 1. Diagnóstico: qué hay hoy frente a lo que piden

### 1.1 El problema de fondo

Hoy el transporte funciona **al revés** de lo que pide el documento:

| Hoy | Documento |
|---|---|
| Se busca **por ciudad** y se ve una lista de empresas con «trayecto desde {tarifaBase}» | Se describe el viaje primero (origen, destino, fecha, mascota, modalidad) y **después** se comparan empresas con su **precio total personalizado** |
| El precio real (base + km × tarifaKm) sólo aparece **dentro** del asistente de reserva de una empresa concreta | Cada tarjeta de resultados muestra el **PRECIO TOTAL** del viaje |
| La ficha muestra «+ tarifa por km» y el asistente desglosa «Kilómetros (tarifaKm × km)» | Regla 12: **nunca** mostrar €/km, zona ni tarifa por servicio |
| Los km los calcula el navegador, el cliente puede editarlos y el servidor **se fía** (por defecto 10 km) | El precio que se muestra antes de pagar es el que se cobra; eso exige que el servidor lo calcule |

Por eso no basta con retocar pantallas. Hace falta un **cotizador en el servidor**: recibe la
necesidad del cliente, la traduce al tarifario de cada empresa y devuelve una lista de empresas
con precio cerrado. Es la regla 12 del documento: «el cliente describe su necesidad; Doogking la
traduce al sistema tarifario de cada empresa».

### 1.2 Cobertura punto por punto

✅ = existe y sirve · 🟠 = existe a medias · ❌ = no existe

**01 · Búsqueda del servicio**

| Punto | Estado | Detalle |
|---|---|---|
| Tipo de servicio (6 opciones) | ❌ | Sólo están los flags ida y vuelta y recurrente, dentro del asistente. «Urgente» y «Larga distancia» son textos sueltos en `tiposTransporteOfrecidos` sin lógica. «Viajo con mi mascota» no existe. |
| Origen y destino con autocompletado + mapa | 🟠 | En el buscador sólo hay «Ciudad de recogida» y no hay destino. En el asistente, origen y destino están en modo **ciudad**, no dirección, y no hay mapa. |
| Distancia automática | 🟠 | `GET /geo/trayecto` (Google Routes con respaldo en línea recta × 1,3). Sólo se usa dentro del asistente y el cliente puede editar el resultado. |

**02 · Fecha y horario**

| Punto | Estado | Detalle |
|---|---|---|
| Calendario | ✅ | `rs-calendario-rango` con `soloUnDia`. |
| Hora concreta, «Soy flexible» (franjas) o «Lo antes posible» | 🟠 | Sólo hora exacta, y sólo dentro del asistente. Las franjas existen únicamente en funerarios. |
| Variantes de la vuelta en ida y vuelta (hora, «tras X horas», «cuando avise», «otro día») | 🟠 | Sólo espera en minutos. |
| Recurrente (patrones + L–D + hora) | 🟠 | `RecurrenciaDto` con días de la semana y fecha fin, máximo 52 viajes. No hay patrones rápidos y no revisa la disponibilidad de cada ocurrencia. |

**03 · Mascota**

| Punto | Estado | Detalle |
|---|---|---|
| Elegir una mascota guardada | ✅ | Una sola, con `perroId` y su ficha guardada en la reserva. |
| + Añadir otra mascota | 🟠 | Sólo hay un enlace a `/perros/nuevo` que saca al usuario del flujo. La reserva guarda un único `perroId`. |
| Tipo de animal (perro, gato, ave…) | ❌ | La plataforma es canina: el modelo es `perro`. Ver la **decisión D1**. |
| Peso o tamaño | 🟠 | Se toma de la ficha del perro. No hay selector para quien no tiene cuenta o mascota guardada. |
| Número de mascotas | 🟠 | Existe el contador `perros`, pero la capacidad se valida con `cantidad`, que va fija a 1 (**bug**). |
| Necesidades especiales | ❌ | La ficha del perro sólo tiene `requiereTransportin`, `seMarea` y `toleraTrayectosLargos`. |
| Comportamiento | ❌ | — |
| «Información importante para el transportista» | 🟠 | Sólo existe el campo genérico `peticiones` del paso 2. |

**04 · Modalidad del viaje**

| Punto | Estado | Detalle |
|---|---|---|
| Exclusivo, compartido o «viajo con mi mascota» | 🟠 | El backend entiende `detalle.exclusivo` + `precioExclusivo`, pero el asistente nunca envía `exclusivo`. No hay nada para «viajo con mi mascota». |
| Personas que viajan y equipaje | ❌ | — |
| Preferencias opcionales | 🟠 | `caracteristicasVehiculo` guarda textos libres del comercio. No se cruzan con lo que pide el cliente. |

**05 · Resultados**

| Punto | Estado | Detalle |
|---|---|---|
| Cabecera resumen + MODIFICAR BÚSQUEDA | ❌ | Sólo hay un resumen plegado con la ciudad. |
| Ordenar por las 5 opciones | 🟠 | Existen Recomendados, Mejor valorados y Precio ↑/↓. Faltan «Recogida más próxima» y «Menor duración». |
| Filtros por modalidad e incluidos | 🟠 | Los filtros actuales son vehículo, jaulas, acompañante y soloPerros. |
| PRECIO TOTAL en la tarjeta | ❌ | Se muestra `tarifaBase`. |
| CTAs VER DETALLES / RESERVAR | 🟠 | Sólo hay «Ver ficha». |
| Conservar los datos al volver atrás | 🟠 | Sólo se conservan los parámetros de la URL. Orden, filtros y página se pierden. |

**06 · Ficha del transportista**

| Punto | Estado | Detalle |
|---|---|---|
| Valoración, nº de opiniones, empresa verificada, galería | ✅ | — |
| Resumen de ruta, fecha y mascota | ❌ | — |
| Servicios incluidos exactos | 🟠 | Hay una lista genérica «¿Qué ofrece?». |
| Desglose trayecto + suplementos + TOTAL | ❌ | Aparece «Desde X + tarifa por km». |
| Política de cancelación visible + «Ver política» | ❌ | En transporte no hay política. `cancelar()` no reembolsa. |
| Mensaje de precio cerrado | ❌ | — |
| CTA fijo «CONTINUAR · XX,XX €» | 🟠 | Existe `.mobile-cta`, pero sin precio. |

**07 · Recogida y entrega**

| Punto | Estado | Detalle |
|---|---|---|
| Quién entrega (Yo / otra persona) y quién recibe (Yo / otra persona / empresa) | ❌ | Sólo hay un contacto principal. |
| Indicaciones de recogida y de entrega | ❌ | — |
| Confirmación de entrega (aviso / aviso + foto / ninguna) | ❌ | Los hitos sólo llevan `{hito, nota}`, sin foto. |

**08 · Revisión y pago**

| Punto | Estado | Detalle |
|---|---|---|
| Resumen completo con direcciones exactas | 🟠 | Hay tarjeta de resumen, pero con ciudades, no direcciones. |
| Tarjeta, Apple Pay, Google Pay | 🟠 | Se usa Payment Element con `automatic_payment_methods`. Hay que verificar el dominio de Apple Pay y activar los monederos en Stripe. |
| Checkbox de condiciones + política de cancelación | 🟠 | Existe `aceptaTerminos`, pero no enlaza a la política de cancelación de la empresa. |
| CTA «CONFIRMAR Y PAGAR XX,XX €» | 🟠 | Es «Pagar {total}» y no pasa por la traducción. |

**09 · Confirmación**

| Punto | Estado | Detalle |
|---|---|---|
| Código de reserva y resumen | ✅ | — |
| VER MI RESERVA | ✅ | — |
| CONTACTAR CON EL TRANSPORTISTA | ❌ | — |
| AÑADIR AL CALENDARIO | 🟠 | Existe en Mis reservas y en el .ics del correo, pero no en la confirmación. |
| Guardar en Mis reservas → Transporte | ✅ | — |

**10 · Seguimiento**

| Punto | Estado | Detalle |
|---|---|---|
| Timeline de 6 hitos | 🟠 | Hay 4 hitos (recogida, en ruta, entregada, finalizada). Faltan «Transportista asignado» y «De camino». |
| Seguir el viaje en un mapa | ❌ | — |
| Chat y llamar | ❌ | — |
| Notificaciones de cada hito | 🟠 | El cliente sólo ve los cambios si abre la página (la consulta periódicamente). |
| Pedir valoración tras la entrega | ✅ | Existe `bookings.service` L698. |

**11 · Sin precio automático**

| Punto | Estado | Detalle |
|---|---|---|
| Solicitar presupuesto, respuesta de la empresa, aceptar y pagar, conversión en reserva | ❌ | No hay presupuestos. Lo más parecido es el ciclo de ajuste de precio (`AJUSTE_SOLICITADO` → pagar diferencia o reembolsar), que sirve de base. |

**12 · Reglas**

| Punto | Estado | Detalle |
|---|---|---|
| Campos condicionales, mobile-first, CTA fijo | 🟠 | Hay patrones sueltos (`.wizard-nav`, `.mobile-cta`). |
| Conservar los datos al volver | ❌ | El asistente no guarda borrador. |

### 1.3 Deuda que el plan arrastra y corrige

1. **El precio se calcula en dos sitios.** La fórmula está en `transporte-availability.strategy.ts`
   y otra vez en `reserva-wizard.component.ts` (`subtotal`, `costeKmTransporte`). Pasa lo mismo que en funerarios.
2. **El servidor se fía de `distanciaKm`**, que envía el cliente.
3. **La capacidad se valida con `cantidad`**, que va fija a 1, en vez del número de perros.
4. **Hay reglas guardadas que nunca se aplican:** `distanciaMinimaKm`, `antelacionMinimaHoras`,
   `maxPerrosPorTrayecto`, `zonaCobertura`, `aceptaPPP`, `requisitoVacunas` y `requisitoMicrochip`.
5. **`bookings.cancelar()` no aplica política ni reembolsa.**
6. **Las retenciones de plaza (`SlotHold`) viven en un `Map` en memoria del proceso**: se pierden
   al reiniciar y no funcionarían con más de una instancia. Sólo se deja anotado; no bloquea este plan.
7. **Hay textos sin `| t`** en el pago («Pagar {total}», «Procesando…»).

---

## 2. Análisis UX/UI

### 2.1 El PPT y el mockup no dicen lo mismo, y el mockup acierta

El PPT describe **9 pasos antes de ver precios**: tipo → ruta → fecha → mascota → modalidad → …
El mockup los comprime en **2 pantallas antes de los resultados**:

1. **Busca tu transporte:** tipo de servicio (rejilla 3×2), origen, destino, fecha y hora.
2. **Mascota y preferencias:** mascota, tipo de transporte y necesidades especiales.

En un embudo de reserva, cada pantalla extra antes del precio pierde clientes. **Adoptamos la
estructura del mockup** y cubrimos todos los campos del PPT con *revelado progresivo*: cada campo
condicional aparece sólo cuando aplica, como pide la regla 12.

- Las franjas de «Soy flexible» se despliegan bajo el selector de hora.
- Las opciones de la vuelta sólo aparecen con «Ida y vuelta».
- El patrón L–D sólo aparece con «Recurrente».
- Personas y equipaje sólo aparecen con «Viajo con mi mascota».
- Comportamiento y la nota libre van en un bloque plegable «Añadir indicaciones», como en el mockup.

La distancia aproximada se muestra en la pantalla 1 bajo los campos, en cuanto están origen y
destino: «≈ 72 km · 1 h 05 min por carretera», con un mini mapa plegable.

### 2.2 Flujo final (7 pantallas + seguimiento)

```
/transporte                 (portada del vertical = pantalla 1)
 ├─ 1. Busca tu transporte          tipo · origen · destino · fecha · hora   [Continuar]
 ├─ 2. ¿Quién viaja y cómo?         mascota(s) · modalidad · necesidades    [Ver transportes disponibles]
 ├─ 3. Elige tu transporte          resumen + modificar · orden · filtros · tarjetas con TOTAL
 │     └─ 3b. Ficha                 incluidos · desglose · cancelación · opiniones  [Continuar · 64,90 €]
 ├─ 4. Completa tu reserva          recogida (Yo/Otra) · entrega (Yo/Otra/Empresa) · confirmación de entrega
 ├─ 5. Revisa y paga                resumen · direcciones · desglose · Payment Element · condiciones
 ├─ 6. ¡Reserva confirmada!         código · Ver reserva · Contactar · Calendario · estado del viaje
 └─ /reservas/:codigo               timeline 6 hitos · mapa · contacto · valorar
 Rama: sin precio automático → «Solicitar presupuesto» (usa los datos de las pantallas 1-2)
```

Las pantallas 1 y 2 van **fuera** del asistente genérico de reserva
(`reserva-wizard.component.ts`, 3.653 líneas compartidas por todos los verticales). Las pantallas
4 y 5 sí reutilizan sus piezas de pago y contacto, pero con un paso 1 de transporte que ya llega
relleno y sin nada que editar.

### 2.3 Traducción a la línea gráfica de Doogking

El mockup viene en **verde**; la plataforma es **azul real + dorado corona**. Se conserva la
estructura del mockup y se viste con los tokens de `styles.scss`, sin hardcodear nada:

| Elemento del mockup | En Doogking |
|---|---|
| Verde oscuro de botones, títulos y opción seleccionada | `--dk-blue` / `--c-accent`; fondo de seleccionada `--c-accent-lo` con borde `--dk-blue` |
| CTA principales («Buscar transportes», «Reservar», «Confirmar y pagar») | **Dorado** (`.rs-btn` variante gold / `--g-warm`), como el resto de CTAs de reserva de la plataforma |
| CTA secundarios («Ver detalles», «Modificar búsqueda») | `.rs-btn--outline` |
| Check verde de confirmación y hitos cumplidos | Token de éxito (`.rs-badge--success`); hito en curso en `--dk-gold` |
| Estrellas | `--dk-gold` (`rs-stars`) |
| Tarjetas con sombra suave | `.rs-card` + `--shadow-*` |
| Chips de necesidades | `rs-chip` |
| Rejilla 3×2 de tipo de servicio | Nueva `rs-opcion-tarjeta` (§2.4) con icono `rs-icon` |
| Barra inferior de confianza (verificados, pago seguro…) | `rs-trust-block` existente |
| Ruta en el mapa | `COLOR_RUTA` de `motor-mapa.ts` (ya azul de marca) |
| Titulares («¿A dónde llevamos a tu rey?») | `--font-display` 800, color `--dk-blue-text` |
| Etiquetas en mayúsculas | `.rs-label-caps` (Montserrat) |

**Qué se hereda del mockup:**
- tarjetas grandes de toque (≥ 44 px);
- un CTA principal por pantalla, fijo abajo en móvil;
- el precio siempre a la vista en resultados, ficha y pago;
- la ilustración del perro en la pantalla 1, con una foto de `docs/images-new*` o de marca.

**Qué corregimos del mockup:**
- **Destino con «intercambiar».** El botón ⇅ del mockup está bien; se implementa.
- **La hora es un `<select>`** en el mockup. Se sustituye por los tres modos del PPT (hora concreta / flexible / lo antes posible) como control segmentado. Hora concreta en pasos de 15 min.
- **El «Transporte exclusivo» del mockup sale como pill en la tarjeta de resultados.** Se mantiene, pero la modalidad se elige en la pantalla 2 y en resultados sólo es un filtro, para no pedir dos veces lo mismo.
- **En la pantalla 5 el mockup pinta un formulario de tarjeta propio** (número, caducidad, CVC). **No se construye**: se usa el Stripe Payment Element, que ya pone tarjeta, Apple Pay y Google Pay en pestañas. Construirlo a mano rompería PCI y el 3-D Secure.
- **«Precio del servicio 59,90 € + Suplementos 5,00 €».** Es correcto: el desglose muestra *conceptos* («Trayecto», «Suplemento urgente»), nunca €/km.
- **Accesibilidad:**
  - la rejilla de tipo de servicio es un `radiogroup` con navegación por flechas;
  - los chips son `checkbox`;
  - el timeline es una lista ordenada con `aria-current`;
  - contraste del dorado: el texto va sobre dorado en `--dk-blue-deep`, nunca en blanco.

### 2.4 Componentes nuevos o elevados a `shared/`

Hoy estos patrones existen **sólo dentro de un componente**. Se suben al UI Kit siguiendo §21.8:
token, clase `rs-*`, componente, barrel `shared/index.ts` y `design-tokens.md`.

| Componente | Origen | Uso |
|---|---|---|
| `rs-opcion-tarjeta` (+ `rs-opciones-grupo`, radio o multi) | `.perro-card.selected` y `.extra-item.selected` del asistente | Tipo de servicio, modalidad, persona de recogida o entrega, confirmación de entrega |
| `rs-segmentado` | nuevo | Modo de hora, orden en móvil |
| `rs-contador` | `.contador` del asistente | Nº de mascotas y de personas |
| `rs-barra-cta` (barra fija inferior con precio) | `.mobile-cta` y `.wizard-nav` | Todas las pantallas del flujo |
| `rs-timeline-viaje` | nuevo, vertical, 6 hitos | Confirmación, detalle de reserva, panel del comercio |
| `rs-desglose-precio` | panel de precio del asistente | Ficha, revisión y pago, presupuesto |
| `rs-resumen-viaje` | nuevo | Cabecera de resultados, ficha, revisión |

`rs-place-autocomplete` ya admite `tipo="direccion"`: en origen y destino se usa en ese modo,
porque para recoger un perro hace falta calle y número, no una ciudad.

---

## 3. Decisiones (cerradas el 2026-09-24)

| # | Decisión | Resuelto |
|---|---|---|
| **D1** | El PPT pide tipo de animal (perro, gato, ave, conejo, roedor, reptil). | **Todas las especies.** La ficha de mascota ya tiene `especie`; el transportista declara `especiesAceptadas` (por defecto, perro y gato) y el cotizador filtra por ella. |
| **D2** | Chat en la reserva. | **OK.** **Fase 1:** «Llamar» y «WhatsApp» con el teléfono del comercio, visibles sólo con la reserva confirmada. **Fase 2:** chat propio (módulo `mensajes`) si hay demanda. |
| **D3** | Seguimiento en mapa en vivo. | **Se hace en esta entrega.** El conductor comparte su posición desde el panel del comercio (web o app); el cliente la ve en el mapa de su reserva. |
| **D4** | «Lo antes posible», «Soy flexible» y el transporte urgente no tienen hora cerrada. | **OK.** La reserva se paga igual (precio cerrado), pero queda **pendiente de aceptación** del comercio con un plazo máximo (p. ej. 30 min para urgente y 12 h para flexible). Si no acepta, se reembolsa sola. Es la historia E4 del CLAUDE.md. |
| **D5** | Compartido: ¿se agrupan de verdad varios clientes en una ruta? | **OK. No en esta entrega.** «Compartido» es una modalidad con precio más bajo que el comercio ofrece y organiza él. La agrupación automática de rutas sería un producto aparte. |

---

## 4. Implementación (2026-09-24)

Todo el plan (F0–F9) está implementado. Este apartado dice **dónde** quedó cada pieza y en
qué se apartó de lo previsto; las fases de más abajo se conservan como especificación.

### 4.1 Dónde vive cada cosa

| Pieza | Ficheros |
|---|---|
| Vocabulario, cotizador único, fechas de la serie, resumen legible | `libs/shared/src/transporte/{transporte.catalogo,cotizar-transporte,viaje-transporte,resumen-transporte}.ts` |
| DTOs (solicitud, entrega, hito, aceptación, posición, presupuestos) | `libs/shared/src/dtos/transporte/solicitud-transporte.dto.ts`, `dtos/presupuestos/presupuesto.dto.ts` |
| Tarifario del transportista (schema + deducción de fichas antiguas) | `verticals/transporte/transporte.schema.ts`, `transporte.tarifario.ts` |
| Cotizador en el servidor y búsqueda pública | `verticals/transporte/transporte-cotizador.service.ts`, `transporte.controller.ts` (`POST /transporte/cotizaciones[/:servicioId]`) |
| Precio de la reserva, política de cancelación, reglas de hitos | `verticals/transporte/transporte-availability.strategy.ts` (+ `transporte.validacion.ts`) |
| Interfaces opcionales del core | `core/availability/availability.strategy.ts`: `CancelacionStrategy`, `SeguimientoStrategy` |
| Reserva: varias mascotas, presupuesto, serie cobrada entera, aceptación, hitos con foto | `core/bookings/bookings.service.ts`, `reserva.schema.ts` |
| Cancelación con reembolso, aceptar/rechazar, caducidad de aceptaciones | `core/payments/cancelaciones.{service,controller}.ts` |
| Presupuestos a medida (genérico) | `core/presupuestos/*` |
| Ubicación en vivo y contacto | `core/seguimiento/*` (posiciones con TTL de 48 h) |
| Avisos (correo + push) | `core/notifications/notifications.service.ts`, `plantillas/viaje.plantillas.ts` |
| Pantallas del cliente | `apps/web/.../features/transporte/viaje/pantallas/*` (búsqueda, mascota, resultados, reserva, confirmada, mis-presupuestos) |
| Estado del flujo | `features/transporte/viaje/transporte-viaje.store.ts` (sessionStorage) |
| Ficha con precio cerrado, seguimiento | `features/transporte/viaje/componentes/{cotizacion-ficha,seguimiento-viaje,marco-viaje}.component.ts` |
| Panel del transportista | `features/panel-comercio/viaje/{gestion-viaje,tarifario-transporte}.component.ts`, `comercio-presupuestos.component.ts` |
| UI Kit nuevo | `shared/components/{opciones,contador,barra-cta,desglose-precio,timeline-viaje,resumen-viaje}` |
| Traducciones | `core/i18n/traducciones/<idioma>/transporte.ts` |

### 4.2 Rutas

`/transporte` (pantalla 1) · `/transporte/viaje/mascota` · `/transporte/viaje/resultados` ·
`/transporte/viaje/reserva` (con sesión) · `/transporte/viaje/confirmada/:codigo` ·
`/transporte/empresas` (listado antiguo, para SEO) · `/transporte/:id` (ficha) ·
`/presupuestos` · `/comercio/presupuestos`. `/reservas/transporte/:id` redirige a la ficha.

### 4.3 Cambios respecto al plan

- **Sin `cotizacionId` firmado.** La reserva recalcula con la misma solicitud, la misma ruta
  (cacheada) y la misma función. Si el precio cambió entre medias, la pantalla de pago enseña
  el nuevo antes de cobrar («El precio se ha actualizado…»).
- **La ruta admite coordenadas**, no sólo `placeId`: «Usar mi ubicación» no tiene `placeId`.
  `GeoService.trayectoEntre` calcula la ruta desde coordenadas con la misma caché.
- **La solicitud se valida en el servidor** con `SolicitudTransporteDto` aunque llegue dentro
  de `reserva.detalle` (objeto libre en el DTO de reserva).
- **Series recurrentes cobradas enteras.** Antes se cobraba un viaje y el resto se confirmaba
  gratis (sólo transporte usaba la recurrencia). Ahora la reserva origen lleva el total de la
  serie y las hijas van a 0 € con `detalle.cubiertaPorSerie`. Admite «una vez al mes».
- **Cancelación con política para todos los verticales**: la web cancela por
  `POST /reservas/:id/cancelacion`. Un vertical sin `CancelacionStrategy` cancela sin
  reembolso automático, igual que antes, pero ahora lo dice.
- **D2 fase 1**: contacto por teléfono y WhatsApp del comercio, visible con la reserva viva.

### 4.4 Pasos manuales pendientes (fuera del código)

1. **Apple Pay**: verificar el dominio en el panel de Stripe (Settings → Payment methods →
   Apple Pay) y servir el fichero `/.well-known/apple-developer-merchantid-domain-association`
   que da Stripe. Google Pay no necesita nada más que activarlo.
2. **Liquidaciones con reembolso parcial**: el pago guarda `importeReembolsado`; revisar con
   administración cómo se liquida al comercio la parte retenida de una cancelación tardía.
3. **Transportistas existentes**: sus fichas funcionan con el tarifario deducido. Conviene
   pedirles que entren en su ficha y completen modalidades, suplementos y cancelación.

## 5. Plan por fases

Orden pensado para que cada fase quede desplegable sola y el flujo antiguo siga funcionando
hasta que se active el nuevo (se activa en F5).

### F0 · Vocabulario común en `libs/shared` ✅

- **`libs/shared/src/catalogos/transporte.ts`**, con los catálogos cerrados:
  - `TipoServicioTransporte`: solo_ida, ida_vuelta, recurrente, urgente, larga_distancia, viajo_con_mascota;
  - `ModoHorario`: hora_concreta, flexible, lo_antes_posible; `FranjaHoraria`;
  - `VueltaIdaVuelta`: hora, tras_horas, cuando_avise, otro_dia;
  - `PatronRecurrencia`;
  - `ModalidadTransporte`: exclusivo, compartido, con_propietario;
  - `NecesidadTransporte` (11 valores) y `ComportamientoViaje` (6);
  - `Equipaje` y `PreferenciaTransporte` (8);
  - `HitoViaje` (6): confirmada, asignado, de_camino, recogida, en_trayecto, entregada;
  - `ConfirmacionEntrega`.

  Cada valor lleva su etiqueta en español, que sirve de clave i18n.
- **`SolicitudTransporteDto`** (`class-validator`) con todo lo que el cliente describe en las
  pantallas 1 y 2: origen y destino (`placeId` + texto + coordenadas), fecha y horario, vuelta,
  recurrencia, mascotas (`perroIds[]` o tamaño + número), necesidades, comportamiento, nota,
  modalidad, personas, equipaje y preferencias.
- **Función pura `cotizarTransporte(tarifario, solicitud, ruta)`** en `libs/shared`. Devuelve
  `{ total, desglose[], requierePresupuesto, motivos[] }`. Es la **única** fórmula: el API la usa para
  cotizar y para cobrar, y la web sólo la usaría para vista previa en el panel del comercio. Así se
  cierra la duplicidad de §1.3.1.
- Tests unitarios de la función con la tabla de ejemplos de `mejora_servicios.md` §4
  (Castellón→Valencia, labrador de 28 kg, compartido → 55 €).

### F1 · Tarifario del comercio (panel) ✅

El cliente nunca ve el tarifario, pero el cotizador lo necesita completo.
Afecta a `transporte.schema.ts` y a `comercio-listado-form.component.ts`.

- **Modo de precio:** `por_km` (el actual: base + km), `por_zona` (tabla provincia origen →
  provincia destino → precio) o `fijo` (precio por trayecto dentro de su zona). Se reutiliza el
  patrón `modoPrecioRecogida` de funerarios.
- **Modalidades que ofrece,** con precio de cada una: compartido = base, exclusivo = base +
  `precioExclusivo`, con propietario = base + precio por persona y por equipaje.
- **Suplementos estructurados** (sustituyen a los textos libres): urgente, nocturno, larga
  distancia (> X km), mascota adicional, perro > 30 kg, parada adicional, medicación.
- **Incluidos**, con el mismo catálogo `PreferenciaTransporte` para que casen con lo que pide el
  cliente: climatización, seguimiento, aviso de recogida, aviso de entrega, foto, transportín,
  puerta a puerta, conductor especializado.
- **Horario:** acepta «lo antes posible» (sí/no), franjas que atiende, antelación mínima.
- **Cuándo pedir presupuesto** en vez de precio automático: internacional, más de N mascotas,
  necesidades especiales marcadas, más de N km.
- **Política de cancelación estructurada** (se reutiliza `PoliticaCancelacion*` de funerarios):
  gratis hasta X h, % de reembolso después.
- Migración: todo servicio existente pasa a `por_km` con sus `tarifaBase` y `tarifaKm`, y
  «compartido/exclusivo» se derivan de `tiposTransporteOfrecidos`. Nadie deja de aparecer.
- El formulario se agrupa en pasos plegables; los campos obligatorios quedan marcados (TRA1).

### F2 · Cotizador en el servidor ✅

Nuevo `TransporteController` dentro de `verticals/transporte`, para no meter lógica de vertical
en el core.

- **`POST /transporte/cotizaciones`**, con `SolicitudTransporteDto`:
  1. Recalcula la ruta con `GeoService.trayecto(placeIdO, placeIdD)`. **Se ignoran los km que
     mande el cliente.**
  2. Filtra empresas válidas: publicadas y con `comercioActivo`, zona de cobertura, capacidad
     frente al nº real de perros, antelación, distancia mínima, modalidad, PPP, vacunas y
     microchip de las mascotas, y franja o «lo antes posible».
  3. Devuelve por empresa: `total`, `desglose[]` en conceptos, `duracionMin`, `recogidaEstimada`,
     `incluidos[]` y `cancelacion` (resumen). Las que requieren presupuesto vuelven marcadas.
  4. Orden: recomendados (`prioridadRanking` + rating), precio, valoración, recogida más
     próxima, duración. Usa los índices ESR existentes de `servicios`.
- **`POST /transporte/cotizaciones/:servicioId`**: la misma cotización para una sola empresa, para
  la ficha.
- Al crear la reserva (`bookings`) la estrategia **recalcula con la misma función y la misma
  ruta** y rechaza si no coincide con la cotización. La cotización se firma con un `cotizacionId`
  con TTL de 30 min. Se corrige `cantidad` = nº de perros.
- **Estrategia de transporte:** aplica por fin las reglas guardadas (§1.3.4) y deja de usar 10 km
  por defecto: si no hay ruta, la reserva no se crea.
- `detalle` de la reserva de transporte tipado (`DetalleReservaTransporte`): la solicitud completa
  + ruta + desglose + recogida y entrega (F5).

### F3 · Pantallas 1 y 2: describir el viaje ✅

Nueva feature `features/transporte/viaje/`, rutas lazy dentro de `transporte.routes.ts`.

- **`TransporteViajeStore`** (signals), una sola fuente del estado del flujo:
  - se persiste en `sessionStorage` (con try/catch) y se refleja en query params lo mínimo para
    compartir o recargar: origen, destino, fecha y tipo;
  - al volver atrás o pulsar «Modificar búsqueda» **nada se pierde**, como pide la regla 12;
  - si el usuario inicia sesión a mitad, el estado sobrevive al redirect.
- **Pantalla 1 (`/transporte`):**
  - titular «Transporte de mascotas / ¿A dónde llevamos a tu rey?»;
  - rejilla de 6 `rs-opcion-tarjeta`;
  - origen y destino con `rs-place-autocomplete tipo="direccion"`, botón ⇅ y «Usar mi ubicación»;
  - distancia y duración en cuanto hay los dos puntos, con mini mapa `rs-mapa [ruta]` plegable;
  - fecha;
  - modo de hora (segmentado) y sus condicionales;
  - bloques condicionales de vuelta y recurrencia;
  - CTA dorado **Continuar**.
- **Pantalla 2 (`¿Quién viaja y cómo?`):**
  - **Con sesión:** tarjetas de sus perros (multi-selección con check) + «Añadir otra mascota».
    Este botón abre un **alta rápida en hoja inferior** (nombre, tamaño, raza) que crea el perro y
    vuelve sin salir del flujo.
  - **Sin sesión:** tamaño (5 rangos) + contador de mascotas. Se pide cuenta en la pantalla 4.
  - Modalidad (3 tarjetas). Con «Viajo con mi mascota» aparecen personas (1/2/3/Más) y equipaje.
  - Chips de necesidades.
  - Plegable «Añadir indicaciones» con comportamiento y nota libre.
  - Chips de preferencias.
  - Las necesidades se **precargan** desde la ficha del perro (`requiereTransportin`, `seMarea`…)
    y, al reservar, se ofrece guardar lo nuevo en su ficha.
  - CTA **Ver transportes disponibles**.
- **Buscador de la portada:** al elegir «Transporte», `verticales.config.ts` pide origen, destino
  y fecha, y «Buscar» lleva a la pantalla 2 con la pantalla 1 ya rellena.

### F4 · Pantalla 3 y ficha: comparar y elegir ✅

- **Resultados** (se reutiliza `rs-listado` para barra, panel de filtros y paginación):
  - **Cabecera `rs-resumen-viaje`:** «Castellón → Valencia · 25/09 · 10:30 · Hachi, 28 kg» +
    **Modificar búsqueda**, que abre una hoja con las pantallas 1 y 2 compactas.
  - Orden con las 5 opciones del PPT.
  - Filtros: modalidad (Todos, Exclusivo, Compartido, Con propietario) + incluidos + precio máximo + valoración.
  - **Tarjeta:**
    - empresa y valoración;
    - pill de modalidad;
    - recogida, duración e incluidos con ticks;
    - **PRECIO TOTAL** en grande con «IVA incluido»;
    - «Ver detalles» (outline) y **Reservar** (dorado), que salta directo a la pantalla 4.
  - Estado vacío útil: si nadie cubre la ruta, se ofrece «Solicitar presupuesto a transportistas
    de la zona» (F7) y ampliar la fecha.
  - Las empresas que sólo trabajan con presupuesto salen con «Precio a consultar» + «Solicitar
    presupuesto».
  - Orden, filtros y scroll se guardan en el store.
- **Ficha `/transporte/:id`**: el componente genérico de verticales no se toca. Se añade un bloque
  específico de transporte que **sólo aparece si hay un viaje en el store**:
  - resumen del viaje;
  - lista exacta de incluidos;
  - `rs-desglose-precio` (trayecto + suplementos + TOTAL);
  - política de cancelación con «Ver política»;
  - mensaje «Precio cerrado: sólo cambiará si solicitas extras después»;
  - `rs-barra-cta` **Continuar con la reserva · 64,90 €**.

  Sin viaje, la ficha muestra «Calcula tu precio», que lleva a la pantalla 1 con esta empresa
  preseleccionada. **Desaparecen «+ tarifa por km» y el «Desde tarifaBase»** de la ficha y del
  listado, conforme a la regla 12.
- Se dibuja el trayecto habitual del comercio en la ficha (hoy sólo se ve en su formulario).

### F5 · Pantallas 4, 5 y 6: datos, pago y confirmación ✅

- **Pantalla 4, «Completa tu reserva»:**
  - **Recogida:** Yo / Otra persona → nombre, teléfono (`rs-phone-input`), dirección exacta ya
    rellena desde el origen con piso y puerta, e indicaciones.
  - **Entrega:** Yo / Otra persona / Empresa → nombre o empresa, teléfono e indicaciones.
  - **Confirmación de entrega:** Notificación / Notificación + foto / No es necesario.
  - Si no hay sesión: login o registro en línea sin perder el estado.
- **Pantalla 5, «Revisa y paga»:**
  - resumen completo (ruta con direcciones, fecha, mascota, modalidad y transportista);
  - desglose + TOTAL destacado;
  - Payment Element (tarjeta / Apple Pay / Google Pay);
  - checkbox obligatorio con enlaces a condiciones **y a la política de cancelación de esa empresa**;
  - CTA **Confirmar y pagar 64,90 €**.
  - Se reutiliza la lógica de pago del asistente (`elements.create('payment')` / `confirmPayment`)
    extraída a un servicio `PagoReservaService`, para no duplicarla.
- **Monederos:**
  - activar Apple Pay y Google Pay en el panel de Stripe;
  - servir `/.well-known/apple-developer-merchantid-domain-association` desde el servidor SSR;
  - verificar en un iPhone real y en la app Capacitor.
- **Pantalla 6, «¡Reserva confirmada!»:**
  - check de éxito y código `DK-TR-XXXXX`;
  - **Ver mi reserva**, **Contactar con el transportista** (llamar / WhatsApp según D2) y **Añadir al calendario** (el .ics que ya existe);
  - `rs-timeline-viaje` con el estado;
  - «Te avisaremos cuando el transportista esté de camino».
- **Activación:** `/transporte` pasa a ser la pantalla 1. El listado antiguo por ciudad queda en
  `/transporte/empresas` para SEO (con SSR), con enlaces a «Calcula tu precio».

### F6 · Seguimiento, avisos y valoración ✅

- **Hitos:** `HitoViaje` sustituye a los textos libres. El panel del comercio pasa de 4 a 6 botones
  (**Asignar conductor**, **Salgo hacia la recogida**, Recogida, En trayecto, Entregada, Finalizar).
  El hito «entregada» **exige foto** si el cliente la pidió; la foto va a `evidencias[]` con el
  hito.
- **Notificaciones** por hito: email y push en la app. WhatsApp si el canal está activo.
  Van al cliente y, en la entrega, a la persona que recibe si es otra.
- **Detalle de reserva:** timeline vertical de 6 hitos, foto de entrega, contacto,
  «Cómo llegar» y cancelar según la política.
- **Cancelación con reembolso:** `cancelar()` aplica la política estructurada y reembolsa por
  `PaymentGateway`. Es de interés general, así que la política se resuelve por estrategia del
  vertical, no con un `if` en el core.
- **Aceptación del comercio** (D4) para urgente, flexible y lo antes posible: botones
  aceptar/rechazar en el panel, plazo y reembolso automático si vence.
- **Valoración** tras «entregada»: ya existe; se enlaza desde el aviso de entrega.

### F7 · Presupuestos (diapositiva 11) ✅

Módulo genérico `core/presupuestos`. Servirá también a otros verticales, como el plan
personalizado de adiestramiento (ADI4).

- Colección `solicitudes_presupuesto`: `usuarioId`, `vertical`, `solicitud` (la
  `SolicitudTransporteDto` completa, **sin volver a pedir nada**), `comercioIds[]` (a uno o a
  varios de la zona), estado y `respuestas[]` `{comercioId, importe, condiciones, validoHasta}`.
- **Cliente:** CTA **Solicitar presupuesto** en resultados, ficha y estado vacío. Recibe el aviso
  «Presupuesto recibido: XXX €» por email y push, y en Mis reservas → Presupuestos compara
  respuestas y pulsa **Aceptar y pagar**.
- **Comercio:** bandeja «Presupuestos» en el panel con los datos del viaje, importe, condiciones
  y validez.
- **Aceptar y pagar:** crea la reserva con `detalle` = solicitud + importe cerrado, pasa por las
  pantallas 4 y 5 y, al confirmarse el pago por webhook, marca la solicitud como convertida.
  Idempotente.

### F8 · Seguimiento en vivo ✅ · chat propio pendiente (fase 2 de D2)

- **Ubicación en vivo:** con el viaje «de camino» o «en trayecto», el panel del conductor
  (web o Capacitor con `@capacitor/geolocation`) envía su posición cada 30 s. El cliente ve
  **Seguir en tiempo real** en `rs-mapa` con el vehículo y la ruta. Las posiciones se guardan con
  TTL de 24 h tras la entrega (RGPD).
- **Chat** en la reserva (D2, fase 2).

### F9 · Cierre ✅

- **i18n:** todas las cadenas nuevas con `| t` en los 8 idiomas. De paso se arreglan
  «Pagar {total}» y «Procesando…».
- **Tests:**
  - unitarios de `cotizarTransporte`, cotizador, store, estrategia y presupuestos;
  - un E2E Playwright del recorrido completo (buscar → pagar en modo test → hitos → valorar);
  - uno de la rama de presupuesto;
  - saldar `DEUDA-TESTS-TRANSPORTE-COBERTURA-Y-TRAYECTO.md` de paso.
- **QA móvil a 360 px:** una mano, CTA siempre visible y teclado sin tapar el CTA (`dvh`), más la
  app Capacitor en Android.
- **Builds:** `tsc` + `ng build` + `nest build`, reconstruyendo `shared` primero.

---

## 6. Prioridad

| Prioridad | Fases | Resultado |
|---|---|---|
| **P0** (lo que pide el documento para funcionar) | F0 → F5 + los hitos y avisos de F6 | Flujo completo buscar → comparar con precio total → pagar → confirmación con timeline |
| **P1** | Resto de F6 (cancelación con reembolso, aceptación) + F7 | Casos sin precio automático y cancelaciones reales |
| **P2** | F8 | Mapa en vivo y chat |

## 7. Trazabilidad diapositiva → fase

| Diapositiva | Fases |
|---|---|
| 01 Búsqueda | F0, F3 |
| 02 Fecha y horario | F0, F3, F6 (aceptación D4) |
| 03 Mascota | F3 (D1) |
| 04 Modalidad | F1, F3 |
| 05 Resultados | F2, F4 |
| 06 Ficha | F4 |
| 07 Recogida y entrega | F5 |
| 08 Revisión y pago | F5 |
| 09 Confirmación | F5 |
| 10 Seguimiento | F6, F8 |
| 11 Presupuesto | F7 |
| 12 Reglas | F2 (nunca €/km, precio final), F3 (condicionales, estado), F9 (mobile-first) |
