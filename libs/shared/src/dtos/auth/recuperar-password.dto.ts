import { IsEmail, IsString, MinLength } from 'class-validator';

/** Paso 1: el usuario pide el enlace de recuperación indicando su email. */
export class RecuperarPasswordDto {
  @IsEmail()
  email!: string;
}

/** Paso 2: llega del enlace del correo con la contraseña nueva. */
export class RestablecerPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  nuevaPassword!: string;
}
