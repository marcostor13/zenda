import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MotivoBajaComercio, OrigenBajaComercio } from '../../enums/baja-comercio.enum';

/**
 * Standby: el negocio deja de aparecer en el buscador y de aceptar reservas,
 * pero conserva listados, historial y equipo. Se reactiva desde el mismo panel
 * sin pasar por soporte.
 */
export class PausarComercioDto {
  @IsEnum(MotivoBajaComercio)
  motivo!: MotivoBajaComercio;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;

  /** Fecha ISO (YYYY-MM-DD) en la que el comercio piensa volver. Solo informativa. */
  @IsOptional()
  @IsString()
  reactivarEl?: string;
}

/**
 * Baja de la cuenta. Es irreversible para el comercio (solo el admin puede
 * restaurarla dentro del periodo de gracia), así que exige escribir el nombre
 * del negocio como confirmación, igual que un borrado de repositorio.
 */
export class BajaComercioDto {
  @IsEnum(MotivoBajaComercio)
  motivo!: MotivoBajaComercio;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  /** Debe coincidir con `nombreComercial`; sin esto no se ejecuta la baja. */
  @IsString()
  @MinLength(1)
  confirmacion!: string;

  /** El comercio autoriza que le escribamos para entender su marcha. */
  @IsOptional()
  @IsBoolean()
  aceptaContacto?: boolean;
}

/** Baja ejecutada por el admin sobre un comercio ajeno. */
export class EliminarComercioAdminDto {
  @IsOptional()
  @IsEnum(MotivoBajaComercio)
  motivo?: MotivoBajaComercio;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;

  /**
   * `true` borra los documentos de forma irreversible (comercio, listados y
   * cuentas del equipo). Reservado a datos de prueba: en producción se prefiere
   * la baja lógica, que conserva la trazabilidad contable.
   */
  @IsOptional()
  @IsBoolean()
  purgar?: boolean;
}

/** Resumen de lo que la baja ha tocado; lo pinta el panel tras confirmar. */
export interface ResultadoBajaComercioDto {
  readonly comercioId: string;
  readonly nombreComercial: string;
  readonly purgado: boolean;
  readonly serviciosAfectados: number;
  readonly usuariosAfectados: number;
  readonly reservasConservadas: number;
  readonly origen: OrigenBajaComercio;
  /** Hasta cuándo el admin puede restaurar la cuenta (solo en baja lógica). */
  readonly restaurableHasta?: string;
}

/** Contadores que se enseñan ANTES de confirmar una baja o una purga. */
export interface ImpactoBajaComercioDto {
  readonly servicios: number;
  readonly serviciosPublicados: number;
  readonly usuarios: number;
  readonly reservas: number;
  readonly reservasActivas: number;
  readonly resenas: number;
  /** Si es false, hay reservas vivas y hay que resolverlas antes de la baja. */
  readonly puedeDarseDeBaja: boolean;
}
