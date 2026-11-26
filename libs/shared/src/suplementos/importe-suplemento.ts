import { UnidadSuplemento } from '../dtos/suplementos/crear-suplemento-config.dto';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Días que se cobran de una reserva: las noches entre la entrada y la salida
 * (de viernes a domingo, 2). Se redondea porque la salida suele ser antes de
 * la hora de entrada (entra a las 14:00 y sale a las 11:00). Una reserva de un
 * solo día, como la guardería, cuenta 1.
 */
export function diasCobrablesReserva(fechaInicio: string | Date, fechaFin?: string | Date | null): number {
  if (!fechaFin) return 1;
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaFin).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return 1;
  return Math.max(1, Math.round((fin - inicio) / MS_POR_DIA));
}

/** Un suplemento «fijo» se suma una vez; uno «por día» o «por noche», cada día de la reserva. */
export function unidadesSuplemento(unidad: UnidadSuplemento | string | undefined, dias: number): number {
  if (unidad === 'por_dia' || unidad === 'por_noche') return Math.max(1, Math.floor(dias) || 1);
  return 1;
}

export function importeSuplemento(monto: number, unidad: UnidadSuplemento | string | undefined, dias: number): number {
  return Math.round(monto * unidadesSuplemento(unidad, dias) * 100) / 100;
}
