import { IsIn, IsOptional, IsString } from 'class-validator';

export type EstadoComercio = 'pendiente' | 'activo' | 'suspendido';

export class CambiarEstadoComercioDto {
  @IsIn(['pendiente', 'activo', 'suspendido'])
  estado!: EstadoComercio;

  /**
   * Obligatorio al suspender o rechazar: el comercio tiene derecho a saber por
   * qué, y queda en el historial administrativo (TCK-8034).
   */
  @IsOptional()
  @IsString()
  motivo?: string;
}
