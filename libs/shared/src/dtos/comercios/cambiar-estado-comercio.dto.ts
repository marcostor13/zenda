import { IsIn } from 'class-validator';

export type EstadoComercio = 'pendiente' | 'activo' | 'suspendido';

export class CambiarEstadoComercioDto {
  @IsIn(['pendiente', 'activo', 'suspendido'])
  estado!: EstadoComercio;
}
