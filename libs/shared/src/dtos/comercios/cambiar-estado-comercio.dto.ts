import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Ciclo de vida de la cuenta de un comercio:
 *   - `pendiente`   alta sin aprobar todavía.
 *   - `activo`      visible y reservable.
 *   - `inactivo`    **standby voluntario**: el comercio se pausa a sí mismo y
 *                   puede reactivarse cuando quiera desde su panel.
 *   - `suspendido`  sanción del admin; solo el admin la levanta.
 *   - `eliminado`   baja lógica. No aparece en ningún listado y sus listados
 *                   quedan despublicados; se conserva por trazabilidad contable.
 */
export type EstadoComercio = 'pendiente' | 'activo' | 'suspendido' | 'inactivo' | 'eliminado';

/** Estados que un administrador puede fijar a mano. La baja va por su endpoint. */
export const ESTADOS_COMERCIO_ADMIN = ['pendiente', 'activo', 'suspendido', 'inactivo'] as const;

export class CambiarEstadoComercioDto {
  @IsIn([...ESTADOS_COMERCIO_ADMIN])
  estado!: Exclude<EstadoComercio, 'eliminado'>;

  /**
   * Obligatorio al suspender o rechazar: el comercio tiene derecho a saber por
   * qué, y queda en el historial administrativo (TCK-8034).
   */
  @IsOptional()
  @IsString()
  motivo?: string;
}
