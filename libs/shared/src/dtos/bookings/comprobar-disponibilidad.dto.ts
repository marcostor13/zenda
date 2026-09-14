import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject, Matches } from 'class-validator';
import { Type } from 'class-transformer';
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

/**
 * Citas libres de un servicio un día concreto. El cliente elige una de ellas en
 * lugar de escribir la hora a ciegas.
 */
export class HuecosDelDiaDto {
  @IsString()
  servicioId!: string;

  /** Día del comercio, `YYYY-MM-DD`. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  /** Servicio concreto (vacunación, baño…): cambia la duración de la cita. */
  @IsOptional()
  @IsString()
  servicio?: string;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;
}

export interface HuecoCitaApi {
  /** `HH:mm` en hora del comercio. */
  hora: string;
  /** Instante ISO del inicio. */
  inicio: string;
  disponible: boolean;
}

export type EstadoHuecosDia = 'abierto' | 'cerrado' | 'sin_horario';

export interface HuecosDelDiaRespuestaApi {
  /** false = este servicio no se reserva por citas con hora. */
  soportado: boolean;
  estado: EstadoHuecosDia;
  /** Por qué no hay citas ese día (cerrado, festivo…). */
  motivo?: string;
  duracionMin?: number;
  huecos: HuecoCitaApi[];
}

/**
 * Agenda de un servicio de cita a lo largo de un rango de días.
 *
 * Existe porque hasta ahora el cliente elegía el día a ciegas: escribía una
 * fecha en un `input type="date"` y sólo entonces descubría que el salón cerraba
 * ese día o que ya no quedaban citas. Con la agenda, el calendario llega con los
 * días cerrados y los llenos ya marcados, y el cliente elige entre lo que
 * existe.
 *
 * Es una consulta por rango, no día a día: pintar un mes pidiendo los huecos de
 * cada día serían treinta viajes al API, y en el servidor sesenta consultas.
 */
export class AgendaCitasDto {
  @IsString()
  servicioId!: string;

  /** Primer día del rango, `YYYY-MM-DD`. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde!: string;

  /** Último día del rango, incluido. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta!: string;

  /** Servicio concreto (vacunación, baño…): cambia la duración y con ella los huecos. */
  @IsOptional()
  @IsString()
  servicio?: string;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;
}

/**
 * Cómo está un día para reservar.
 *
 * `cerrado` y `completo` se distinguen a propósito: al cliente no le sirve lo
 * mismo «ese día no abren» que «ese día está lleno», y con un único estado
 * "no disponible" la ficha no podía explicar ninguno de los dos.
 */
export type EstadoDiaAgenda = 'libre' | 'completo' | 'cerrado' | 'pasado';

export interface DiaAgendaApi {
  /** `YYYY-MM-DD` en el día del comercio. */
  fecha: string;
  estado: EstadoDiaAgenda;
  /** Citas que quedan libres ese día. */
  huecosLibres: number;
  /** Primera hora libre, `HH:mm`. Ausente si no queda ninguna. */
  primeraHora?: string;
  /** Por qué está cerrado (festivo, cierre semanal…). */
  motivo?: string;
}

export interface PrimeraCitaLibreApi {
  fecha: string;
  hora: string;
}

export interface AgendaCitasRespuestaApi {
  /** false = este servicio no se reserva por citas con hora. */
  soportado: boolean;
  duracionMin?: number;
  /**
   * Por qué no hay agenda que pintar: el servicio no admite reservas ahora
   * mismo (sin cupos, perro incompatible…). Con motivo, `dias` viene vacío.
   */
  motivo?: string;
  dias: DiaAgendaApi[];
  /** Lo primero que se puede coger del rango: el atajo que evita buscar a mano. */
  primeraLibre?: PrimeraCitaLibreApi;
}
