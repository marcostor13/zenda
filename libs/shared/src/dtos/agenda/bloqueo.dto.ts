import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/** Alta de un tramo cerrado en la agenda de un servicio. */
export class CrearBloqueoDto {
  @IsString()
  servicioId!: string;

  @IsDateString()
  desde!: string;

  /** Fin exclusivo del tramo: `[desde, hasta)`, igual que una estancia. */
  @IsDateString()
  hasta!: string;

  /**
   * Por qué se cierra. Se exige porque dentro de tres semanas nadie recuerda por
   * qué estaba bloqueado ese hueco, y sin el motivo la agenda deja de servir.
   */
  @IsString()
  @MinLength(3, { message: 'Explica brevemente por qué cierras este tramo' })
  motivo!: string;

  /**
   * Unidades cerradas. Sin valor se cierra el servicio entero; con ella sólo se
   * resta esa parte del inventario (dos de cinco suites).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad?: number;

  @IsOptional()
  @IsString()
  espacioTipo?: string;
}

/** Un tramo cerrado tal como lo pinta la agenda del panel. */
export interface BloqueoDto {
  _id: string;
  servicioId: string;
  desde: string;
  hasta: string;
  motivo: string;
  cantidad?: number;
  espacioTipo?: string;
}

/** Una reserva viva, para pintarla junto a los bloqueos en la agenda. */
export interface CitaAgendaDto {
  _id: string;
  codigo: string;
  servicioId: string;
  desde: string;
  hasta: string;
  estado: string;
  cliente: string;
  /** Nombre del perro, cuando la reserva lo lleva. */
  perro?: string;
}

/**
 * Edición de un tramo ya cerrado.
 *
 * Todos los campos son opcionales: lo que no viene, no se toca. `cantidad`
 * distingue los dos «vacíos» a propósito — ausente es «déjala como está» y
 * `null` es «pasa a cerrar el servicio entero», que es justo el cambio que hace
 * un comercio cuando lo que había reservado por fuera acaba ocupándolo todo.
 */
export class ActualizarBloqueoDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Explica brevemente por qué cierras este tramo' })
  motivo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad?: number | null;

  @IsOptional()
  @IsString()
  espacioTipo?: string;
}
