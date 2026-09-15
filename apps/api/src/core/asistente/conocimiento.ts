/**
 * Lo que el asistente sabe de Doogking.
 *
 * Es la única fuente de la que puede responder: el prompt le prohíbe inventar
 * fuera de aquí. Un asistente de producto que improvisa condiciones de pago o
 * pasos de un panel que no existen hace más daño que no tenerlo, porque el
 * cliente actúa sobre lo que lee.
 *
 * Al cambiar un flujo de la web, este texto se cambia con él. Vive en el API y
 * no en la página de ayuda porque es el servidor quien habla con el modelo, y
 * porque la ayuda pública son once preguntas frecuentes mientras que esto
 * describe cómo funciona la plataforma entera.
 */
export const CONOCIMIENTO_DOOGKING = `
## Qué es Doogking
Doogking es un marketplace de servicios para perros en España: el dueño busca,
compara, reserva y paga en un solo sitio, y el negocio recibe la reserva ya
pagada. Los precios se muestran en euros con el IVA (21 %) ya incluido: lo que
se ve es lo que se paga.

## Categorías
- Alojamiento canino: residencias y guarderías. Se reserva por noches.
- Hoteles pet-friendly: hoteles donde viaja la persona con su perro.
- Veterinarios: citas con hora.
- Peluquerías caninas: citas con hora.
- Adiestramiento: sesiones sueltas o programas.
- Transporte de animales: traslados punto a punto.
- Seguros para mascotas: pólizas anuales.
- Crematorios y servicios funerarios.

## Para el dueño de un perro

### Buscar
Desde el buscador de la portada se elige la categoría y la ciudad. También se
puede escribir en lenguaje normal ("peluquería en Valencia el sábado") con
"Buscar con IA". En los resultados se filtra por precio, valoración y por lo
propio de cada categoría, se ordena, y se puede ver el mapa.

### Reservar
1. Se abre la ficha del comercio desde los resultados.
2. En las categorías con cita (veterinaria, peluquería) la ficha muestra la
   primera cita libre y los servicios con su precio; al pulsar "Reservar" en uno
   de ellos, el asistente de reserva abre con ese servicio ya elegido.
3. En el asistente se elige el día en un calendario donde los días cerrados y
   los llenos ya salen apagados, y después la hora entre las libres. En
   alojamiento y hoteles se eligen las fechas de entrada y salida.
4. Se rellenan los datos y se paga con tarjeta.
La reserva se confirma sólo cuando el pago se aprueba, y llega un correo con el
código de reserva.

### Pagar, cancelar y reembolsos
El cobro es con tarjeta a través de Stripe; los datos de la tarjeta no pasan por
Doogking. El importe queda retenido hasta que el servicio se presta. Se cancela
desde "Mis reservas" y el reembolso depende de la política de cancelación del
comercio, que se ve en su ficha antes de reservar. Ningún suplemento se cobra
sin que el cliente lo apruebe: llega un correo con el precio anterior, el nuevo
y el motivo.

### La ficha del perro
En "Mis perros" se registra cada perro: raza, edad, peso, tamaño, tipo de pelo,
vacunas, alergias, medicación, conducta y documentos. Cuanto más completa, mejor
se adapta la búsqueda —hay comercios que exigen vacunas al día o no admiten
ciertos tamaños— y menos hay que repetir al reservar. Se puede descargar en PDF
para llevarla a una clínica de fuera, y se controla qué ve cada profesional
desde su pantalla de privacidad.

## Para un negocio

### Darse de alta
Desde "Para comercios" se registra el negocio con su razón social y número de
IVA. La cuenta queda pendiente hasta que Doogking la aprueba; después ya se
puede publicar.

### Crear un servicio (listado)
En el panel, "Mis listados" → "Crear listado". El alta va por pasos:
1. Categoría.
2. Ubicación y datos del sitio.
3. Horarios: la semana de atención de **ese** servicio —no la del negocio— y las
   excepciones (festivos, vacaciones, cierres puntuales).
4. Detalles propios de la categoría: en peluquería los servicios de grooming con
   su precio y duración; en veterinaria los servicios clínicos con precio
   cerrado; en alojamiento los tipos de espacio con su precio por noche y
   cuántos hay; etcétera.
5. Aptitud: qué perros se admiten.
El listado se guarda como borrador y se publica cuando está listo. Publicar o
pausar se hace desde la lista de listados.

### Agenda y disponibilidad
La disponibilidad sale de lo que declara el comercio: el horario del servicio,
sus excepciones y su capacidad. Lo que se vende fuera de Doogking se cierra en
"Mi agenda" → "Bloquear un tramo", indicando desde cuándo, hasta cuándo y el
motivo; en las categorías de cita el bloqueo va con hora, y en alojamiento se
puede cerrar sólo parte del inventario. Lo bloqueado deja de ofrecerse en el
buscador, que es lo que evita cobrar dos veces la misma plaza.

### El historial de las mascotas atendidas
En "Mascotas" están los perros que han reservado con el negocio. Al abrir uno se
anota lo que se hizo en cada visita ("Nuevo registro"): título, fecha,
profesional, los datos propios de la categoría, observaciones y la próxima cita
recomendada. En ese mismo formulario se adjuntan documentos —analíticas,
informes o fotos, en PDF, Word o imagen, hasta 10 MB cada uno y seis por
registro—, y el dueño los ve y se los descarga desde la ficha de su perro. De
todo el historial sale un informe en PDF.

### Reservas y cobros
Las reservas entrantes se ven en el panel. Doogking cobra al cliente y liquida
al comercio el importe menos la comisión de la plataforma y la comisión de
Stripe. La comisión por defecto depende de la categoría y el panel de
administración puede ajustarla. Las liquidaciones se consultan en "Ingresos".

## Lo que Doogking NO hace
- No cobra al cliente hasta que confirma la reserva.
- No comparte los datos del perro con quien el dueño no autorice.
- No fija los precios de los comercios: los pone cada negocio.
`;
