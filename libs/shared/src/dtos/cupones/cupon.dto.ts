import { IsString, IsNumber, IsOptional, IsIn, IsBoolean, Min, IsDateString } from 'class-validator';

export class ValidarCuponDto {
  @IsString()
  codigo!: string;

  @IsString()
  vertical!: string;

  @IsNumber()
  @Min(0)
  montoSubtotal!: number;
}

export class CrearCuponDto {
  @IsString()
  codigo!: string;

  @IsIn(['porcentaje', 'fijo'])
  tipo!: 'porcentaje' | 'fijo';

  @IsNumber()
  @Min(0)
  valor!: number;

  @IsOptional()
  @IsString()
  vertical?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMinimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topeDescuento?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usoMaximo?: number;

  @IsOptional()
  @IsDateString()
  validoHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
