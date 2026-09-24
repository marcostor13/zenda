import { claveDiaEnZona, fechaYHoraEnZona, instanteEnZona, partesEnZona } from '../fechas/zona-horaria';
import { SolicitudViaje } from './solicitud-viaje';
import { NecesidadTransporte } from './transporte.enums';
import {
  FranjaTransporte, HORA_REFERENCIA_FRANJA, ModoHorarioTransporte, PatronRecurrenciaTransporte,
} from './viaje.catalogo';

/** Tope de viajes que genera una serie: un año de un viaje a la semana. */
export const MAX_OCURRENCIAS_SERIE = 52;

/**
 * Hora de recogida que se guarda en la reserva, en hora del comercio.
 * «Lo antes posible» no tiene: se usa el instante de la petición.
 */
export function horaDeRecogida(solicitud: Pick<SolicitudViaje, 'modoHorario' | 'hora' | 'franja'>): string | null {
  if (solicitud.modoHorario === ModoHorarioTransporte.HORA_CONCRETA) return solicitud.hora ?? null;
  if (solicitud.modoHorario === ModoHorarioTransporte.FLEXIBLE) {
    return HORA_REFERENCIA_FRANJA[solicitud.franja ?? FranjaTransporte.CUALQUIERA];
  }
  return null;
}

/** El instante de recogida. Mismo cálculo en la web y en el API. */
export function instanteDeRecogida(
  solicitud: Pick<SolicitudViaje, 'fecha' | 'modoHorario' | 'hora' | 'franja'>,
  ahora: Date = new Date(),
): Date {
  const hora = horaDeRecogida(solicitud);
  if (!hora) return ahora;
  return fechaYHoraEnZona(solicitud.fecha, hora);
}

/** Días de la semana que implica cada atajo de recurrencia (0 = domingo). */
export function diasDelPatron(patron: PatronRecurrenciaTransporte, elegidos: number[]): number[] {
  if (patron === PatronRecurrenciaTransporte.DIARIO) return [0, 1, 2, 3, 4, 5, 6];
  if (patron === PatronRecurrenciaTransporte.LABORABLES) return [1, 2, 3, 4, 5];
  if (patron === PatronRecurrenciaTransporte.MENSUAL) return [];
  return [...new Set(elegidos)].sort();
}

export interface PatronSerie {
  diasSemana: number[];
  /** `YYYY-MM-DD`, último día incluido. */
  fechaFin: string;
  mensual?: boolean;
}

/**
 * Días (`YYYY-MM-DD`) de la serie **después** del primero, en el calendario del
 * comercio. La usa el API para crear las reservas hija y la web para decir
 * cuántos viajes son antes de pagar, así que el número no puede diferir.
 *
 * Devuelve `MAX_OCURRENCIAS_SERIE + 1` elementos como máximo: quien llama
 * decide si eso es un error.
 */
export function ocurrenciasDeSerie(primerDia: string, patron: PatronSerie): string[] {
  const ocurrencias: string[] = [];
  if (patron.mensual) {
    const [anio, mes, dia] = primerDia.split('-').map(Number);
    for (let i = 1; i <= MAX_OCURRENCIAS_SERIE + 1; i++) {
      const siguiente = diaDelMes(anio, mes + i, dia);
      if (siguiente > patron.fechaFin) break;
      ocurrencias.push(siguiente);
    }
    return ocurrencias;
  }

  let dia = siguienteDia(primerDia);
  while (dia <= patron.fechaFin && ocurrencias.length <= MAX_OCURRENCIAS_SERIE) {
    if (patron.diasSemana.includes(diaDeLaSemana(dia))) ocurrencias.push(dia);
    dia = siguienteDia(dia);
  }
  return ocurrencias;
}

/** Cuántos viajes supone la solicitud: 1, o la serie entera si es recurrente. */
export function viajesDeLaSolicitud(solicitud: SolicitudViaje): number {
  if (solicitud.tipoServicio !== NecesidadTransporte.RECURRENTE || !solicitud.recurrencia) return 1;
  const r = solicitud.recurrencia;
  const extra = ocurrenciasDeSerie(solicitud.fecha, {
    diasSemana: diasDelPatron(r.patron, r.diasSemana),
    fechaFin: r.hasta,
    mensual: r.patron === PatronRecurrenciaTransporte.MENSUAL,
  });
  return 1 + Math.min(extra.length, MAX_OCURRENCIAS_SERIE);
}

/** `YYYY-MM-DD` del día siguiente. Aritmética de calendario, sin horas de por medio. */
export function siguienteDia(clave: string): string {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha del calendario del comercio. */
export function diaDeLaSemana(clave: string): number {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return partesEnZona(instanteEnZona({ anio, mes, dia, hora: 12 })).diaSemana;
}

/** El mismo día del mes `mes` (1-12, puede desbordar); si no existe, el último de ese mes. */
function diaDelMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes - 1, Math.min(dia, ultimo))).toISOString().slice(0, 10);
}

/** Horas desde `ahora` hasta un instante. */
export function horasHasta(instante: Date, ahora: Date = new Date()): number {
  return (instante.getTime() - ahora.getTime()) / 3_600_000;
}

/** El día de hoy en el calendario del comercio. */
export function hoyEnZona(ahora: Date = new Date()): string {
  return claveDiaEnZona(ahora);
}
