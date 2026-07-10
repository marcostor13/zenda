import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AlojamientoDetalleDto } from './alojamiento-detalle.dto';
import { TransporteDetalleDto } from './transporte-detalle.dto';
import { VeterinariaDetalleDto } from './veterinaria-detalle.dto';
import { PeluqueriaDetalleDto } from './peluqueria-detalle.dto';
import { AdiestramientoDetalleDto } from './adiestramiento-detalle.dto';

/** El vertical de un servicio no se puede cambiar tras su creación. */
export class ActualizarServicioDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioBase?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AlojamientoDetalleDto)
  alojamiento?: AlojamientoDetalleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransporteDetalleDto)
  transporte?: TransporteDetalleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VeterinariaDetalleDto)
  veterinaria?: VeterinariaDetalleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PeluqueriaDetalleDto)
  peluqueria?: PeluqueriaDetalleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdiestramientoDetalleDto)
  adiestramiento?: AdiestramientoDetalleDto;
}
