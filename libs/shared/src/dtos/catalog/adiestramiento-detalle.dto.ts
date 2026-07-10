import { IsString, IsOptional, IsArray, IsIn, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdiestramientoDetalleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tiposAdiestramiento?: string[];

  @IsOptional()
  @IsIn(['sesion', 'programa'])
  modalidad?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioSesion!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  precioPrograma?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sesionesPorPrograma?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  edadMinimaMeses?: number;

  @IsOptional()
  @IsBoolean()
  aDomicilio?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacidadPorSesion?: number;

  @IsOptional()
  @IsString()
  horario?: string;
}
