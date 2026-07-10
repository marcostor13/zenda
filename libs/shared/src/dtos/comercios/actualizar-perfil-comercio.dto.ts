import { IsString, IsOptional, IsEmail, IsArray, IsIn, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactoComercioDto {
  @IsOptional() @IsString() nombreContacto?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() whatsapp?: string;
}

export class DireccionComercioDto {
  @IsOptional() @IsString() calle?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() codigoPostal?: string;
  @IsOptional() @IsString() pais?: string;
  @IsOptional() @IsNumber() @Type(() => Number) lat?: number;
  @IsOptional() @IsNumber() @Type(() => Number) lng?: number;
}

export class RedesSocialesDto {
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() tiktok?: string;
}

export class HorarioDiaDto {
  @IsIn(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
  dia!: string;

  @IsOptional() @IsString() abre?: string;
  @IsOptional() @IsString() cierra?: string;

  @IsBoolean()
  cerrado!: boolean;
}

export class DatosBancariosDto {
  @IsOptional() @IsString() titular?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() swift?: string;
}

export class PreferenciasNotificacionDto {
  @IsOptional() @IsBoolean() nuevaReserva?: boolean;
  @IsOptional() @IsBoolean() cancelacion?: boolean;
  @IsOptional() @IsBoolean() resena?: boolean;
  @IsOptional() @IsBoolean() pagos?: boolean;
}

export class ActualizarPerfilComercioDto {
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galeria?: string[];

  @IsOptional() @IsString() sitioWeb?: string;

  @IsOptional()
  @IsIn(['flexible', 'moderada', 'estricta'])
  politicaCancelacion?: string;

  @IsOptional() @IsString() documentoIdentidadUrl?: string;
  @IsOptional() @IsString() licenciaNegocioUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactoComercioDto)
  contacto?: ContactoComercioDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DireccionComercioDto)
  direccion?: DireccionComercioDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RedesSocialesDto)
  redesSociales?: RedesSocialesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DatosBancariosDto)
  datosBancarios?: DatosBancariosDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferenciasNotificacionDto)
  preferenciasNotificacion?: PreferenciasNotificacionDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDiaDto)
  horario?: HorarioDiaDto[];
}
