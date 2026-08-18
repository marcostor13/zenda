/**
 * Claves de día para los calendarios de la aplicación.
 *
 * Existe por un fallo real: una celda se identificaba con
 * `fecha.toISOString().slice(0, 10)` —que convierte a UTC— y luego se comparaba
 * contra medianoche **local**. Sólo coincidían en UTC+0: en España la celda que
 * ponía "3" filtraba las reservas del día 2, o de ninguno.
 *
 * Toda la aplicación trabaja en la hora local del comercio, así que la clave se
 * construye y se lee con las partes locales de la fecha, nunca en UTC.
 */

/** `YYYY-MM-DD` a partir de las partes **locales** de la fecha. */
export function claveDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Vuelta de {@link claveDia}: medianoche **local**, no UTC. */
export function desdeClaveDia(clave: string): Date {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Medianoche local de hoy, para comparar días sin que estorbe la hora. */
export function hoyLocal(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

/**
 * Las seis semanas de la rejilla de un mes, **empezando en lunes**.
 *
 * Seis y no las justas para que la rejilla no cambie de alto al pasar de mes,
 * que da un salto muy feo.
 */
export function celdasDelMes(primerDia: Date): Date[] {
  const inicio = new Date(primerDia);
  // `getDay()` da 0 para domingo; en España la semana empieza en lunes.
  inicio.setDate(primerDia.getDate() - ((primerDia.getDay() + 6) % 7));

  return Array.from(
    { length: 42 },
    (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i),
  );
}
