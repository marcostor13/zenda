import { Types } from 'mongoose';
import { LineaPago } from './pago.schema';

/** Lo mínimo de un pago que hace falta para repartirlo entre sus reservas. */
export interface PagoConLineas {
  reservaId: Types.ObjectId;
  montoTotal: number;
  montoSubtotal: number;
  ivaMonto: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
  descuentoPlataforma?: number;
  importeReembolsado?: number;
  lineas?: LineaPago[];
}

/**
 * Las líneas de un pago, una por reserva.
 *
 * Un pago de viaje cobra a varios comercios a la vez y guarda el desglose de
 * cada uno en `lineas`; un pago normal no las tiene y su única línea son sus
 * propios totales. Quien reparte dinero por comercio o por reserva tiene que
 * pasar por aquí: leer los totales del pago atribuía el viaje entero al
 * comercio de la primera reserva.
 */
export function lineasDePago(pago: PagoConLineas): LineaPago[] {
  if (pago.lineas?.length) return pago.lineas;
  return [{
    reservaId: pago.reservaId,
    montoTotal: pago.montoTotal,
    montoSubtotal: pago.montoSubtotal,
    ivaMonto: pago.ivaMonto,
    comisionPlataforma: pago.comisionPlataforma,
    stripeFee: pago.stripeFee,
    montoLiquidacion: pago.montoLiquidacion,
    descuentoPlataforma: pago.descuentoPlataforma ?? 0,
    importeReembolsado: pago.importeReembolsado ?? 0,
  }];
}

/** Filtro de pagos que tocan alguna de estas reservas, sean normales o de viaje. */
export function filtroPagosDeReservas(reservaIds: Types.ObjectId[]): Record<string, unknown> {
  return { $or: [{ reservaId: { $in: reservaIds } }, { 'lineas.reservaId': { $in: reservaIds } }] };
}

/** Las líneas de estos pagos que son de alguna de estas reservas. */
export function lineasDeReservas(pagos: PagoConLineas[], reservaIds: Types.ObjectId[]): LineaPago[] {
  const ids = new Set(reservaIds.map(String));
  return pagos.flatMap(lineasDePago).filter((linea) => ids.has(String(linea.reservaId)));
}
