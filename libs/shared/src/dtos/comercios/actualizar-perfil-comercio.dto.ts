import { IsString, IsOptional, IsEmail, IsArray, IsIn, IsBoolean, ValidateNested, IsEnum, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';

export class ContactoComercioDto {
  @IsOptional() @IsString() nombreContacto?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() whatsapp?: string;
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

/**
 * Aceptaciones que el comercio firma al terminar su alta.
 *
 * Sólo viaja el "sí" del comercio: la fecha y la versión del texto las sella el
 * servidor. Si el cliente pudiera mandarlas, la prueba de consentimiento —que es
 * justo para lo que sirve este bloque— no valdría nada.
 */
export class ConsentimientosComercioDto {
  @IsBoolean()
  operaLegalmente!: boolean;

  @IsBoolean()
  condicionesGenerales!: boolean;
}

export class ActualizarPerfilComercioDto {
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
  @IsOptional()
  @IsIn(['flexible', 'moderada', 'estricta'])
  politicaCancelacion?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactoComercioDto)
  contacto?: ContactoComercioDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentimientosComercioDto)
  consentimientos?: ConsentimientosComercioDto;

  /**
   * Cierra el alta guiada. El comercio puede dejarla a medias ("todavía no tengo
   * los datos"), así que este flag es lo que distingue un alta terminada de una
   * aparcada; no se deduce de tener los campos llenos porque los datos fiscales
   * también se pueden completar más tarde desde el panel.
   */
  @IsOptional()
  @IsBoolean()
  altaCompletada?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DatosBancariosDto)
  datosBancarios?: DatosBancariosDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferenciasNotificacionDto)
  preferenciasNotificacion?: PreferenciasNotificacionDto;

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
