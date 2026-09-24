import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/**
 * Presupuestos a medida (diapositiva 11 del flujo de transporte).
 *
 * El módulo es genérico: la solicitud guarda en `detalle` lo que describió el
 * cliente en el vertical —en transporte, la `SolicitudTransporte` entera—, así
 * que el cliente no vuelve a rellenar nada y el comercio lo ve tal cual.
 */

export enum EstadoSolicitudPresupuesto {
  ABIERTA = 'abierta',
  ACEPTADA = 'aceptada',
  CONVERTIDA = 'convertida',
  CANCELADA = 'cancelada',
  CADUCADA = 'caducada',
}

export enum EstadoRespuestaPresupuesto {
  PENDIENTE = 'pendiente',
  RESPONDIDA = 'respondida',
  RECHAZADA_POR_COMERCIO = 'rechazada_por_comercio',
  ACEPTADA = 'aceptada',
  DESCARTADA = 'descartada',
}

/** Máximo de empresas a las que se pide presupuesto a la vez. */
export const MAX_EMPRESAS_PRESUPUESTO = 5;

/** Días que vale un presupuesto si el comercio no dice otra cosa. */
export const VALIDEZ_PRESUPUESTO_DIAS = 3;

export class CrearSolicitudPresupuestoDto {
  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EMPRESAS_PRESUPUESTO)
  @IsString({ each: true })
  servicioIds!: string[];

  /** Lo que describió el cliente en el vertical, sin volver a pedirlo. */
  @IsObject()
  detalle!: Record<string, unknown>;

  /** Día del servicio, `YYYY-MM-DD` o ISO. */
  @IsString()
  fechaServicio!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}

export class ResponderPresupuestoDto {
  /** Precio final, IVA incluido. */
  @IsNumber()
  @Min(1)
  @Max(100000)
  importe!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  condiciones?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  validezDias?: number;
}

export class RechazarPresupuestoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

/** Una respuesta tal como la ve el cliente. */
export interface RespuestaPresupuestoVista {
  servicioId: string;
  comercioId: string;
  titulo: string;
  imagen?: string;
  rating: number;
  estado: EstadoRespuestaPresupuesto;
  importe?: number;
  condiciones?: string;
  validoHasta?: string;
  motivoRechazo?: string;
  respondidaAt?: string;
}

export interface SolicitudPresupuestoVista {
  id: string;
  codigo: string;
  vertical: VerticalKey;
  estado: EstadoSolicitudPresupuesto;
  detalle: Record<string, unknown>;
  fechaServicio: string;
  comentario?: string;
  respuestas: RespuestaPresupuestoVista[];
  reservaId?: string;
  reservaCodigo?: string;
  createdAt: string;
}

/** La misma solicitud vista por un comercio: sólo su respuesta y los datos del cliente justos. */
export interface SolicitudPresupuestoComercioVista {
  id: string;
  codigo: string;
  vertical: VerticalKey;
  estadoSolicitud: EstadoSolicitudPresupuesto;
  servicioId: string;
  tituloServicio: string;
  detalle: Record<string, unknown>;
  fechaServicio: string;
  comentario?: string;
  clienteNombre: string;
  respuesta: Omit<RespuestaPresupuestoVista, 'titulo' | 'imagen' | 'rating'>;
  createdAt: string;
}
