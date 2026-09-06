import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cierre de una cuenta desde el panel admin. Por defecto es **lógico**: la
 * cuenta pierde el acceso pero conserva su historial, igual que la baja de un
 * comercio, porque borrarla dejaría sin autor sus reservas y sus reseñas.
 */
export class EliminarUsuarioAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  /**
   * Borrado físico e irreversible. Sólo se permite en cuentas sin historial:
   * las reservas son facturación del comercio y no pueden quedarse huérfanas.
   */
  @IsOptional()
  @IsBoolean()
  purgar?: boolean;
}

/** Resumen de lo que la baja ha hecho; lo pinta el panel tras confirmar. */
export interface ResultadoBajaUsuarioDto {
  readonly usuarioId: string;
  readonly nombre: string;
  readonly purgado: boolean;
  /** Hasta cuándo el admin puede restaurar la cuenta (sólo en baja lógica). */
  readonly restaurableHasta?: string;
}
