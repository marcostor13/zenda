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

import { instanteEnZona, partesEnZona } from 'shared';

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

/**
 * "Hoy" en el calendario del comercio, como medianoche local.
 *
 * Es el día de Madrid, no el del navegador: a las 20:00 en Lima ya es mañana en
 * España, y el horario de la ficha marcaba como "hoy" el día que no era.
 */
export function hoyLocal(): Date {
  const { anio, mes, dia } = partesEnZona(new Date());
  return new Date(anio, mes - 1, dia);
}

/**
 * Un instante convertido a "fecha de calendario del comercio": un `Date` cuyas
 * partes locales (`getDate()`, `getHours()`…) son la fecha y la hora de Madrid.
 *
 * Las rejillas de calendario trabajan con partes locales. Pasar los instantes
 * del API por aquí antes de colocarlos hace que una cita a las 10:00 de Madrid
 * caiga en la fila de las 10:00 aunque el navegador esté en otra zona.
 */
export function aCalendarioComercio(instante: Date | string): Date {
  const p = partesEnZona(instante);
  return new Date(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
}

/** Vuelta de {@link aCalendarioComercio}: el instante real de esa fecha y hora de Madrid. */
export function desdeCalendarioComercio(fecha: Date): Date {
  return instanteEnZona({
    anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate(),
    hora: fecha.getHours(), minuto: fecha.getMinutes(),
  });
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
