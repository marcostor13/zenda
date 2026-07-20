import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { UnidadSuplemento } from './crear-suplemento-config.dto';

export class ActualizarSuplementoConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  concepto?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsIn(['fijo', 'por_dia', 'por_noche'])
  unidad?: UnidadSuplemento;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
