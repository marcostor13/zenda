import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

export class CrearReservaDto {
  @IsString()
  servicioId!: string;

  @IsString()
  comercioId!: string;

  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  cuponCodigo?: string;
}
