import { IsString, IsOptional, IsEmail, IsArray, IsIn, IsBoolean, IsNumber, ValidateNested, IsEnum, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';

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

export class HorarioDiaDto {
  @IsIn(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
  dia!: string;

  /** Primer tramo del día. */
  @IsOptional() @IsString() abre?: string;
  @IsOptional() @IsString() cierra?: string;

  /**
   * Segundo tramo, para la jornada partida. El esquema y el formulario del panel
   * ya lo contemplaban (TCK-8028: "muchos negocios cierran a mediodía"), pero
   * faltaba declararlo aquí, así que guardar el horario devolvía siempre 400
   * "property abre2 should not exist" — los catorce días de la semana a la vez.
   */
  @IsOptional() @IsString() abre2?: string;
  @IsOptional() @IsString() cierra2?: string;

  @IsBoolean()
  cerrado!: boolean;
}

/**
 * Documento que el comercio adjunta para su verificación.
 *
 * Sólo declara lo que aporta el comercio. `estado` y `subidoAt` los fija el
 * servidor a propósito: si el cliente pudiera enviar `estado`, un comercio
 * marcaría sus propios papeles como `verificado` y se saltaría la revisión del
 * administrador (HU J1).
 */
export class DocumentoVerificacionDto {
  @IsIn(['dni', 'cif', 'licencia', 'seguro_rc', 'certificado', 'otro'])
  tipo!: string;

  @IsOptional() @IsString() nombre?: string;
  @IsString() url!: string;
  @IsOptional() @IsString() fechaCaducidad?: string;
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
  /** Festivos, vacaciones y cierres puntuales (TCK-8028). */
  @IsOptional()
  @IsArray()
  excepcionesHorario?: Array<{ fecha: string; motivo?: string; cerrado: boolean; abre?: string; cierra?: string }>;

  /**
   * Datos fiscales. Son opcionales al registrarse (perfilado progresivo,
   * CLAUDE.md §4.2) y se completan después desde el panel — pero faltaban aquí,
   * así que no había forma de aportarlos: el paso "Datos fiscales (CIF/NIF)"
   * del panel del comercio se quedaba pendiente para siempre.
   */
  @IsOptional() @IsString() razonSocial?: string;
  @IsOptional() @IsString() vatNumber?: string;

  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galeria?: string[];

  @IsOptional()
  @IsIn(['flexible', 'moderada', 'estricta'])
  politicaCancelacion?: string;

  @IsOptional() @IsString() documentoIdentidadUrl?: string;
  @IsOptional() @IsString() licenciaNegocioUrl?: string;

  /**
   * Documentación adicional (seguro de RC, certificados…). El servicio ya sabía
   * tratarla, pero faltaba declararla aquí: con `forbidNonWhitelisted` el API
   * devolvía 400 "property documentos should not exist" y la pantalla de
   * verificación del panel no podía guardar nada.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoVerificacionDto)
  documentos?: DocumentoVerificacionDto[];

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

  /**
   * Categorías en las que trabaja el negocio.
   *
   * Faltaba aquí, así que el paso "Servicios que ofreces" del panel era de sólo
   * lectura y remitía a soporte: con `forbidNonWhitelisted`, mandarlas devolvía
   * 400. Un negocio que añade peluquería a su residencia no tenía forma de
   * reflejarlo. Se exige al menos una: sin ninguna, la ficha no dice a qué se
   * dedica el comercio.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Marca al menos una categoría de servicio' })
  @IsEnum(VerticalKey, { each: true })
  verticales?: VerticalKey[];
}
