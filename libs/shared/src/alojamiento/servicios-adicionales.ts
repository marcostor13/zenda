/**
 * Servicios adicionales de un alojamiento (medicación, comida de frigorífico,
 * peluquería durante la estancia...).
 *
 * Unos se pagan una vez por reserva y otros son un plus que se cobra cada día
 * que el perro pasa en la residencia, y a veces por cada perro. Vive en
 * `shared` porque el cobro del API y el resumen que ve el cliente tienen que
 * dar el mismo total.
 */
export enum CobroServicioAdicional {
  /** Una sola vez por reserva, dure lo que dure. */
  UNICO = 'unico',
  /** Precio × días de estancia. */
  POR_DIA = 'por_dia',
  /** Precio × días de estancia × perros. */
  POR_DIA_PERRO = 'por_dia_perro',
}

export const COBRO_SERVICIO_ADICIONAL_LABELS: Record<CobroServicioAdicional, string> = {
  [CobroServicioAdicional.UNICO]: 'Una vez por reserva',
  [CobroServicioAdicional.POR_DIA]: 'Por día',
  [CobroServicioAdicional.POR_DIA_PERRO]: 'Por día y perro',
};

/** Texto corto que acompaña al precio: «3 € / día y perro». */
export const COBRO_SERVICIO_ADICIONAL_SUFIJOS: Record<CobroServicioAdicional, string> = {
  [CobroServicioAdicional.UNICO]: '',
  [CobroServicioAdicional.POR_DIA]: '/ día',
  [CobroServicioAdicional.POR_DIA_PERRO]: '/ día y perro',
};

export interface ServicioAdicionalAlojamientoBase {
  readonly nombre: string;
  readonly precio: number;
  /** Sin valor = `unico`: así se cobraban los extras dados de alta antes. */
  readonly cobro?: CobroServicioAdicional | string;
}

export interface EstanciaParaExtras {
  /** Noches de residencia; en guardería de día, 1. */
  readonly dias: number;
  readonly perros: number;
}

export interface LineaServicioAdicional {
  readonly nombre: string;
  readonly precioUnitario: number;
  readonly cobro: CobroServicioAdicional;
  readonly unidades: number;
  readonly importe: number;
}

/** Normaliza el modo de cobro: cualquier valor desconocido se lee como `unico`. */
export function cobroDeServicioAdicional(extra: Pick<ServicioAdicionalAlojamientoBase, 'cobro'>): CobroServicioAdicional {
  const valores = Object.values(CobroServicioAdicional) as string[];
  return valores.includes(String(extra.cobro)) ? (extra.cobro as CobroServicioAdicional) : CobroServicioAdicional.UNICO;
}

/** Cuántas veces se cobra el extra en esa estancia. */
export function unidadesServicioAdicional(cobro: CobroServicioAdicional, estancia: EstanciaParaExtras): number {
  const dias = Math.max(1, Math.floor(estancia.dias) || 1);
  const perros = Math.max(1, Math.floor(estancia.perros) || 1);
  if (cobro === CobroServicioAdicional.POR_DIA) return dias;
  if (cobro === CobroServicioAdicional.POR_DIA_PERRO) return dias * perros;
  return 1;
}

/** Desglose de los extras elegidos (por nombre, que es su identificador). */
export function lineasServicioAdicional(
  disponibles: ReadonlyArray<ServicioAdicionalAlojamientoBase>,
  seleccionados: ReadonlyArray<string>,
  estancia: EstanciaParaExtras,
): LineaServicioAdicional[] {
  return seleccionados.flatMap((nombre) => {
    const extra = disponibles.find((e) => e.nombre === nombre);
    if (!extra) return [];
    const precioUnitario = Number(extra.precio) || 0;
    const cobro = cobroDeServicioAdicional(extra);
    const unidades = unidadesServicioAdicional(cobro, estancia);
    return [{ nombre, precioUnitario, cobro, unidades, importe: redondearCentimos(precioUnitario * unidades) }];
  });
}

/** Total de los extras elegidos para esa estancia. */
export function totalServiciosAdicionales(
  disponibles: ReadonlyArray<ServicioAdicionalAlojamientoBase>,
  seleccionados: ReadonlyArray<string>,
  estancia: EstanciaParaExtras,
): number {
  const lineas = lineasServicioAdicional(disponibles, seleccionados, estancia);
  return redondearCentimos(lineas.reduce((suma, linea) => suma + linea.importe, 0));
}

function redondearCentimos(importe: number): number {
  return Math.round(importe * 100) / 100;
}
