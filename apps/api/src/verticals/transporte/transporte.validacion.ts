import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DatosEntregaViajeDto, SolicitudTransporte, SolicitudTransporteDto } from 'shared';

/**
 * La solicitud llega dentro de `reserva.detalle`, que el DTO de reserva acepta
 * como objeto libre (cada vertical guarda ahí lo suyo). Antes de cotizar con
 * ella se valida con el mismo DTO que la búsqueda: un `mascotas` que no sea una
 * lista o una fecha rota no pueden llegar al cálculo del precio.
 */
export async function solicitudValida(bruta: unknown): Promise<SolicitudTransporte | null> {
  if (!bruta || typeof bruta !== 'object') return null;
  const dto = plainToInstance(SolicitudTransporteDto, bruta);
  const errores = await validate(dto, { whitelist: true });
  return errores.length ? null : dto;
}

/** Quién entrega y quién recibe. Opcional en la reserva, pero si viene tiene que tener forma. */
export async function datosEntregaValidos(brutos: unknown): Promise<boolean> {
  if (brutos === undefined || brutos === null) return true;
  if (typeof brutos !== 'object') return false;
  const errores = await validate(plainToInstance(DatosEntregaViajeDto, brutos));
  return errores.length === 0;
}
