import { esHoraValida, esMedianocheUtc, fechaYHoraEnZona } from 'shared';

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO;
/** Duración supuesta de una cita antigua que no la guardó. */
const DURACION_CITA_POR_DEFECTO_MIN = 60;

interface ReservaConFechas {
  fechaInicio: Date;
  fechaFin?: Date | null;
  detalle?: Record<string, unknown> | null;
}

/**
 * Inicio real de una reserva de cita.
 *
 * Hasta septiembre de 2026 veterinaria y peluquería guardaban el día a
 * medianoche UTC y la hora aparte en `detalle.hora`. Las nuevas ya guardan el
 * instante; las antiguas se reconstruyen al leerlas, en hora del comercio, para
 * no tener que migrar datos.
 */
export function inicioDeLaReserva(reserva: ReservaConFechas): { inicio: Date; conHora: boolean } {
  const hora = reserva.detalle?.['hora'];
  if (esHoraValida(hora) && esMedianocheUtc(reserva.fechaInicio)) {
    return { inicio: fechaYHoraEnZona(reserva.fechaInicio.toISOString().slice(0, 10), hora), conHora: true };
  }
  return { inicio: reserva.fechaInicio, conHora: !esMedianocheUtc(reserva.fechaInicio) };
}

/**
 * Cuándo empieza y acaba lo reservado, tal y como se pinta en la agenda. Una
 * cita sin fin guardado dura lo que diga su `detalle.duracionMin` (o una hora);
 * lo que no tiene hora —una estancia, un día de adiestramiento— ocupa el día.
 */
export function tramoDeLaReserva(reserva: ReservaConFechas): { inicio: Date; fin: Date } {
  const { inicio, conHora } = inicioDeLaReserva(reserva);
  if (reserva.fechaFin) return { inicio, fin: reserva.fechaFin };

  if (conHora) {
    const guardada = Number(reserva.detalle?.['duracionMin']);
    const duracion = guardada > 0 ? guardada : DURACION_CITA_POR_DEFECTO_MIN;
    return { inicio, fin: new Date(inicio.getTime() + duracion * MS_POR_MINUTO) };
  }
  return { inicio, fin: new Date(inicio.getTime() + MS_POR_DIA) };
}

/**
 * Corrige en la respuesta el inicio y el fin de las citas antiguas, para que las
 * listas del cliente y del comercio enseñen la hora real y no las 02:00. No
 * guarda nada: sólo cambia lo que se envía.
 */
export function conHoraReal<TReserva extends ReservaConFechas>(reserva: TReserva): TReserva {
  const { inicio, conHora } = inicioDeLaReserva(reserva);
  if (!conHora || inicio.getTime() === reserva.fechaInicio.getTime()) return reserva;
  const { fin } = tramoDeLaReserva(reserva);
  return Object.assign(reserva, { fechaInicio: inicio, fechaFin: reserva.fechaFin ?? fin });
}
