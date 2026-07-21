import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

/** Confirma la verificación de email con el token recibido por correo. */
export class VerificarEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/** Reenvía el correo de verificación a una cuenta pendiente. */
export class ReenviarVerificacionDto {
  @IsEmail()
  email!: string;
}

/**
 * Respuesta de un registro local (email/contraseña): la cuenta queda pendiente
 * de verificar el email, por eso NO se devuelve sesión todavía.
 */
export class RegistroPendienteDto {
  requiereVerificacion!: boolean;
  email!: string;
}
