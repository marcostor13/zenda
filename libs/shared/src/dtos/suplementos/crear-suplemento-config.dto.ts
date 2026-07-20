import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export type UnidadSuplemento = 'fijo' | 'por_dia' | 'por_noche';

export class CrearSuplementoConfigDto {
  @IsOptional()
  @IsString()
  servicioId?: string;

  @IsString()
  @MinLength(1)
  concepto!: string;

  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsIn(['fijo', 'por_dia', 'por_noche'])
  unidad?: UnidadSuplemento;
}

// Reexport para que los consumidores no dependan de un enum inexistente en runtime.
export const UNIDADES_SUPLEMENTO: UnidadSuplemento[] = ['fijo', 'por_dia', 'por_noche'];
