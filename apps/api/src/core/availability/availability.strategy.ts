import { VerticalKey } from 'shared';

export interface AvailabilityQuery {
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  parametrosExtra?: Record<string, unknown>;
}

export interface AvailabilityResult {
  disponible: boolean;
  /**
   * Por qué no hay disponibilidad, en lenguaje para el cliente.
   *
   * Sin esto la única respuesta posible era "no está disponible para las fechas
   * seleccionadas", que no distingue entre no quedar plazas, unas fechas mal
   * puestas o un espacio que no admite a ese perro. Opcional: una estrategia que
   * no lo rellene sigue cumpliendo el contrato.
   */
  motivo?: string;
  capacidadRestante?: number;
  precioCalculado?: number;
  metadata?: Record<string, unknown>;
}

export interface SlotHold {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
  metadata?: Record<string, unknown>;
}

export interface ReserveParams {
  usuarioId: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  parametrosExtra?: Record<string, unknown>;
}

export interface AvailabilityStrategy {
  readonly vertical: VerticalKey;
  checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult>;
  reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold>;
  releaseSlot(holdId: string): Promise<void>;
}

export interface RangoCalendario {
  desde: Date;
  hasta: Date;
  /** Filtra la ocupación al espacio/unidad elegido; sin él, cuenta todo el servicio. */
  espacioId?: string;
}

/**
 * Calendario de días reservables de un servicio.
 *
 * Va aparte de `AvailabilityStrategy` a propósito (segregación de interfaces):
 * sólo tiene sentido en los verticales que se reservan por rango de fechas
 * —alojamiento, hoteles—. Una peluquería se reserva por hueco horario, y
 * pintarle un calendario de noches libres no significaría nada. Un vertical
 * que no lo implemente hace que el API responda `soportado: false` y el
 * cliente siga con los campos de fecha de siempre.
 */
export interface CalendarioStrategy {
  calendario(servicioId: string, rango: RangoCalendario): Promise<DiaCalendario[]>;
}

export interface DiaCalendario {
  /** `YYYY-MM-DD`. */
  fecha: string;
  disponible: boolean;
  plazasLibres: number;
}

export const implementaCalendario = (
  estrategia: AvailabilityStrategy,
): estrategia is AvailabilityStrategy & CalendarioStrategy =>
  typeof (estrategia as Partial<CalendarioStrategy>).calendario === 'function';
