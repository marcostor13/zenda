import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Alta en la lista de espera del prelanzamiento (pantalla "muy pronto").
 * Es el único formulario público de la app mientras `underConstruction` está
 * activo: no crea cuenta ni contraseña, solo guarda el email para avisar.
 */
export class SuscribirListaEsperaDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Pantalla desde la que se suscribió; sirve para medir qué campaña convierte. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  origen?: string;
}

/**
 * Respuesta del alta. `yaRegistrado` permite al frontend decir "ya te teníamos
 * apuntado" sin filtrar si un email existe en la plataforma como cuenta.
 */
export class SuscripcionListaEsperaDto {
  email!: string;
  yaRegistrado!: boolean;
}

/** Fila de la lista de espera tal como la ve el admin. */
export class ListaEsperaItemDto {
  id!: string;
  email!: string;
  origen!: string;
  createdAt!: string;
}
