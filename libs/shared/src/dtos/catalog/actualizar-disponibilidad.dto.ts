import { IsOptional, IsNumber, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Actualiza la disponibilidad de un servicio ya publicado. Cada vertical solo
 * acepta el campo que le corresponde (validado en CatalogService según
 * `servicio.vertical`); el resto se ignora.
 */
export class ActualizarDisponibilidadDto {
  /** Alojamiento: reemplaza por completo la lista de espacios reservables. */
  @IsOptional()
  @IsArray()
  espacios?: Array<Record<string, unknown>>;

  /** Transporte: unidades (vehículos) disponibles. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unidadesDisponibles?: number;

  /** Veterinaria: citas disponibles. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  citasDisponibles?: number;

  /** Peluquería / Adiestramiento: cupos disponibles. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cuposDisponibles?: number;
}
