import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Datos con los que se reserva sin cuenta. Son los mínimos para que el comercio
 * pueda atender la reserva y el cliente reciba la confirmación: a quién, a qué
 * correo y a qué teléfono.
 */
export class IniciarInvitadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsEmail()
  email!: string;

  /*
   * Texto libre y no `IsPhoneNumber`: llegan teléfonos de toda la UE escritos
   * de mil maneras y el comercio sólo necesita poder llamar.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telefono!: string;

  /** Sin cuenta no hay otro momento de aceptar las condiciones: va aquí. */
  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar las condiciones para reservar' })
  aceptaCondiciones!: boolean;
}

/** Datos de contacto que se congelan en una reserva hecha como invitado. */
export interface ContactoInvitado {
  nombre: string;
  email: string;
  telefono?: string;
}
