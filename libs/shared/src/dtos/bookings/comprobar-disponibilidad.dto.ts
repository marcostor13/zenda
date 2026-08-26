import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/**
 * Consulta de disponibilidad previa a la reserva.
 *
 * Lleva los mismos datos que `CrearReservaDto` menos lo que sólo importa al
 * cobrar (cupón, recurrencia): responde si esas fechas se pueden reservar sin
 * crear la reserva ni bloquear cupo. Existe para que el cliente sepa en el
 * primer paso —al elegir las fechas— que no hay hueco, en vez de descubrirlo
 * al final del embudo cuando ya ha rellenado sus datos.
 */
export class ComprobarDisponibilidadDto {
  @IsString()
  servicioId!: string;

  @IsOptional()
  @IsString()
  comercioId?: string;

  @IsOptional()
  @IsEnum(VerticalKey)
  vertical?: VerticalKey;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;
}

export interface DisponibilidadRespuesta {
  disponible: boolean;
  /** Por qué no se puede reservar. Sólo viene cuando `disponible` es false. */
  motivo?: string;
  /** Precio que saldría con estos datos; informativo, el importe real se recalcula al reservar. */
  precioEstimado?: number;
  capacidadRestante?: number;
}

/**
 * Rango del calendario de un servicio. Va por query, no por cuerpo: es una
 * lectura, y el cliente la repite al cambiar de mes.
 */
export class CalendarioDisponibilidadDto {
  @IsString()
  servicioId!: string;

  @IsDateString()
  desde!: string;

  @IsDateString()
  hasta!: string;

  /** Limita la ocupación al espacio elegido; sin él, se mira el primero con cupo. */
  @IsOptional()
  @IsString()
  espacioId?: string;
}

/** Un día del calendario. `fecha` en `YYYY-MM-DD`. */
export interface DiaCalendarioApi {
  fecha: string;
  disponible: boolean;
  plazasLibres: number;
}

export interface CalendarioDisponibilidadRespuestaApi {
  /** false = este vertical no se reserva por rango de fechas y no tiene calendario. */
  soportado: boolean;
  dias: DiaCalendarioApi[];
}
