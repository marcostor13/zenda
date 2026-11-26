# Plan — Servicios y pluses diarios en alojamiento (observación 2026-11-26)

## 1. La observación

> Los servicios son puntuales (baño a la recogida: +25 € una vez). Los pluses se suman
> **cada día** de la estancia: sin pienso propio +3 €/día, comida de nevera, perro agresivo
> o con mucho miedo +5 €/día. «Necesito poder añadir cuánto suma al día».

Ejemplo del cliente: guardería 20 €/día · 5 días · no trae pienso · lavado a la recogida
→ 5 × 20 + 5 × 3 + 25 = **140 €**.

## 2. Lo que ya hay en el código (commit 7b7a7f2, 19-nov, ya en `main`)

- `libs/shared/src/alojamiento/servicios-adicionales.ts`: cada extra tiene `cobro`
  `unico | por_dia | por_dia_perro`, y la fórmula está en un solo sitio (`totalServiciosAdicionales`).
- El API (`alojamiento-availability.strategy.ts`) la usa: residencia `dias = noches`, guardería `dias = 1`.
- Formulario del comercio: lista «Servicios adicionales» con nombre, precio y un desplegable «Se cobra».
- Wizard del cliente: casillas con el sufijo «/ día» o «/ día y perro», y el total cuadra con el cobro.

**El cálculo ya está hecho.** Lo que falta es que se entienda: el comercio no ve la diferencia
entre «servicio» y «plus», no tiene a mano los pluses típicos, y el cliente marca «Perro agresivo»
como si comprara algo.

## 3. Lo que falta

| # | Hueco | Propuesta |
|---|---|---|
| G1 | En el formulario, servicios y pluses van mezclados en una sola lista y el nuevo extra sale por defecto como `por_dia_perro` | Partir la sección en dos bloques: **Servicios puntuales** (se cobran una vez) y **Pluses por día** (por día / por día y perro). Mismo array `serviciosAdicionales`: el bloque sólo filtra por `cobro`, así no hace falta migrar datos |
| G2 | El comercio tiene que inventarse los pluses | Botones de añadido rápido en «Pluses por día»: *Sin pienso propio*, *Alimentación de nevera*, *Perro agresivo / reactivo*, *Perro con mucho miedo*, *Medicación*. Rellenan el nombre y el modo de cobro, y el comercio sólo pone el precio |
| G3 | El cliente ve los pluses como productos que compra | En el wizard, separarlos: «Añade servicios» (casillas, como ahora) y «Cuéntanos sobre su estancia» (preguntas: *¿Traerás su pienso?*, *¿Necesita comida de nevera?*, *¿Es agresivo o muy miedoso?*). Cada respuesta activa su plus con el precio diario y el total de la estancia («3 € / día × 5 días = 15 €») |
| G4 | La ficha del perro ya guarda `temperamento`, `miedos`, `reactividadCorrea`… y no se usa | Marcar de antemano la pregunta de carácter con lo que diga la ficha del perro elegido (el cliente puede cambiarla). Requiere un campo `tipoPlus` en el extra: `pienso`, `nevera`, `caracter`, `medicacion` o `otro`. Los extras sin tipo quedan como `otro` |
| G5 | Si el cliente miente («es muy bueno»), el comercio no tiene un cobro diario en recepción | Los suplementos de recepción (`suplemento_configs`, `unidad: por_dia`) ya existen, pero hoy se suman como importe fijo. Al aplicar uno `por_dia`, multiplicarlo por los días de la reserva con la misma función de shared |
| G6 | El desglose de la reserva, el correo y el PDF puede que muestren sólo el total de extras | Guardar las `lineasServicioAdicional` en `reserva.detalle` y mostrar «Sin pienso propio · 3 € × 5 días = 15 €» en el detalle de la reserva, el panel del comercio y el correo de confirmación |

## 4. Fases

1. **Comercio (G1 + G2)**: sólo el formulario y las traducciones. No cambia el modelo. Es lo que pide
   literalmente la observación («que yo pueda añadir cuánto suma al día»).
2. **Cliente (G3 + G6)**: el wizard en dos bloques y el desglose línea a línea en la reserva, el correo
   y el comprobante. El total sigue saliendo de `totalServiciosAdicionales`.
3. **Ficha del perro (G4)**: el campo opcional `tipoPlus` en el schema y el DTO, y el premarcado desde el perfil.
4. **Recepción (G5)**: los suplementos `por_dia` se multiplican por la estancia.

En cada fase: el spec junto al fichero que se toca y las claves nuevas en los 8 idiomas.
Al final, `tsc`, `ng build`, `nest build` y la suite completa.

## 4 bis. Estado: IMPLEMENTADO (2026-11-26, rama `dev`, sin commit)

- **Shared** (`alojamiento/servicios-adicionales.ts`): `TipoPlusAlojamiento`, `PLUSES_DIARIOS_SUGERIDOS`,
  `esPlusDiario`, `tiposPlusSegunPerfil`, `plusesSugeridosParaPerro` y `resumenLineasServicioAdicional`.
  Nuevo `suplementos/importe-suplemento.ts` (`diasCobrablesReserva`, `importeSuplemento`).
- **G1/G2**: el formulario del comercio tiene ahora dos bloques, «Servicios puntuales» (sin desplegable,
  siempre `unico`) y «Pluses por día» (por día / por día y perro), con botones de añadido rápido. El
  `tipo` se guarda sólo si existe.
- **G3/G4**: el wizard separa los servicios de los pluses, enseña «(3 € × 5) = 15 €» y premarca los pluses
  de agresivo, miedo y medicación según la ficha del perro, con la nota «Marcado según la ficha de X».
  Si cambia el perro, se rehacen. Pienso y nevera nunca se premarcan.
- **G5**: en recepción, los suplementos `por_dia`/`por_noche` se multiplican por las noches de la reserva
  y el concepto queda como «X (2 días)».
- **G6**: el API guarda `detalle.extrasResumen`, que se ve en el detalle de la reserva del cliente, en la
  ficha de la reserva del comercio y en el correo, donde sustituye a la lista de nombres.

## 5. Decisiones tomadas (2026-11-26)

1. **Noches**: viernes→domingo = 2. Se queda como está (`dias = noches`; guardería = 1).
2. **Carácter**: (b) + (c). Se premarca desde la ficha del perro y el cliente puede quitarlo; el comercio
   puede además aplicarlo en recepción como suplemento diario.
3. **Por día / por día y perro**: lo decide el comercio en cada plus (el desplegable se mantiene).

### Preguntas que se plantearon

1. **¿Días o noches?** Hoy una residencia de viernes a domingo son 2 noches, así que el plus se cobra 2 veces.
   ¿Lo quiere así, o cuenta los días naturales (3)?
2. **¿Quién activa el plus de agresivo o miedoso?** (a) lo declara el cliente; (b) se premarca con la ficha
   del perro y el cliente puede quitarlo; (c) sólo lo aplica el comercio en recepción. Recomiendo (b) y (c) a la vez.
3. **¿«Por día» o «por día y perro»?** Con 2 perros y sin pienso, ¿son 3 € o 6 € al día? Hoy lo decide el comercio en cada plus,
   y propongo dejar «por día y perro» como valor por defecto de los pluses.
