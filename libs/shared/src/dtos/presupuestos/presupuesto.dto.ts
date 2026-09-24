import {
  IsDateString, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';
import { EstadoPresupuesto } from '../../transporte/transporte.enums';

/** Lo que manda el cliente al pedir un precio a medida. */
export class SolicitarPresupuestoDto {
  @IsString()
  servicioId!: string;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsDateString()
  fechaServicio!: string;

  /**
   * El viaje tal y como lo describió el cliente. Se guarda entero para que
   * aceptar la oferta no le obligue a rellenarlo otra vez.
   */
  @IsObject()
  solicitud!: Record<string, unknown>;
}

/** Respuesta de la empresa con el importe. */
export class OfertarPresupuestoDto {
  @IsNumber()
  @Min(0.01)
  importe!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  condiciones?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  // Un mes es ya más de lo que nadie sostiene un precio de transporte.
  @Max(720)
  validezHoras?: number;
}

/**
 * Al aceptar la oferta, lo que el cliente todavía no había dicho al pedirla:
 * en transporte, quién entrega y quién recibe a la mascota. Se añade al
 * detalle de la reserva; el vertical lo valida al crearla.
 */
export class AceptarPresupuestoDto {
  @IsOptional()
  @IsObject()
  detalleExtra?: Record<string, unknown>;
}

export class RechazarPresupuestoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

/** Vista de un presupuesto para cliente y comercio. */
export interface PresupuestoDto {
  id: string;
  codigo: string;
  vertical: VerticalKey;
  servicioId: string;
  comercioId: string;
  estado: EstadoPresupuesto;
  fechaServicio: string;
  solicitud: Record<string, unknown>;
  importe?: number;
  moneda: string;
  condiciones?: string;
  validoHasta?: string;
  reservaId?: string;
  /** Nombre del servicio, para que las listas digan de quién es cada oferta. */
  tituloServicio?: string;
  createdAt: string;
}
