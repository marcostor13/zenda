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

/**
 * Situaciones conocidas por las que una residencia cobra un plus diario. Con
 * el tipo, el wizard puede marcar el plus solo a partir de la ficha del perro
 * (un perro reactivo, con medicación...). Un plus sin tipo se elige a mano.
 */
export enum TipoPlusAlojamiento {
  SIN_PIENSO = 'sin_pienso',
  NEVERA = 'nevera',
  AGRESIVO = 'agresivo',
  MIEDO = 'miedo',
  MEDICACION = 'medicacion',
}

export interface ServicioAdicionalAlojamientoBase {
  readonly nombre: string;
  readonly precio: number;
  /** Sin valor = `unico`: así se cobraban los extras dados de alta antes. */
  readonly cobro?: CobroServicioAdicional | string;
  /** Sólo en los pluses diarios que corresponden a una situación conocida. */
  readonly tipo?: TipoPlusAlojamiento | string;
}

/** Los pluses típicos, para que el comercio sólo tenga que poner el precio. */
export const PLUSES_DIARIOS_SUGERIDOS: ReadonlyArray<{ readonly tipo: TipoPlusAlojamiento; readonly nombre: string }> = [
  { tipo: TipoPlusAlojamiento.SIN_PIENSO, nombre: 'Sin pienso propio' },
  { tipo: TipoPlusAlojamiento.NEVERA, nombre: 'Alimentación de nevera' },
  { tipo: TipoPlusAlojamiento.AGRESIVO, nombre: 'Perro agresivo o reactivo' },
  { tipo: TipoPlusAlojamiento.MIEDO, nombre: 'Perro con mucho miedo' },
  { tipo: TipoPlusAlojamiento.MEDICACION, nombre: 'Administración de medicación' },
];

/** Un plus diario se suma cada día de la estancia; un servicio puntual, una vez. */
export function esPlusDiario(extra: Pick<ServicioAdicionalAlojamientoBase, 'cobro'>): boolean {
  return cobroDeServicioAdicional(extra) !== CobroServicioAdicional.UNICO;
}

/** Lo que la ficha del perro dice de él, en lo que afecta a los pluses. */
export interface PerfilPerroParaPluses {
  readonly temperamento?: string;
  readonly reactividadCorrea?: boolean;
  readonly protectorRecursos?: boolean;
  readonly sociabilidadPerros?: string;
  readonly ansiedadSeparacion?: boolean;
  readonly medicacion?: ReadonlyArray<string>;
}

/**
 * Pluses que la ficha del perro hace aplicables. Es una sugerencia: el
 * cliente puede desmarcarlos y el comercio puede cobrarlos en recepción si
 * la ficha no los reflejaba. La comida no se deduce de la ficha.
 */
export function tiposPlusSegunPerfil(perfil: PerfilPerroParaPluses | null | undefined): TipoPlusAlojamiento[] {
  if (!perfil) return [];
  const tipos: TipoPlusAlojamiento[] = [];
  const esAgresivo = !!perfil.reactividadCorrea || !!perfil.protectorRecursos
    || perfil.temperamento === 'Protector' || perfil.sociabilidadPerros === 'no_tolera';
  if (esAgresivo) tipos.push(TipoPlusAlojamiento.AGRESIVO);
  if (perfil.temperamento === 'Nervioso' || !!perfil.ansiedadSeparacion) tipos.push(TipoPlusAlojamiento.MIEDO);
  if ((perfil.medicacion ?? []).some((m) => m.trim() !== '')) tipos.push(TipoPlusAlojamiento.MEDICACION);
  return tipos;
}

/** Nombres de los pluses del servicio que encajan con la ficha del perro. */
export function plusesSugeridosParaPerro(
  disponibles: ReadonlyArray<ServicioAdicionalAlojamientoBase>,
  perfil: PerfilPerroParaPluses | null | undefined,
): string[] {
  const tipos = new Set<string>(tiposPlusSegunPerfil(perfil));
  return disponibles
    .filter((extra) => esPlusDiario(extra) && extra.tipo !== undefined && tipos.has(String(extra.tipo)))
    .map((extra) => extra.nombre);
}

/** «Sin pienso propio: 3,00 € × 2 = 6,00 €»; los puntuales, sólo el importe. */
export function resumenLineasServicioAdicional(lineas: ReadonlyArray<LineaServicioAdicional>): string {
  return lineas
    .map((linea) => linea.unidades > 1
      ? `${linea.nombre}: ${formatearEuros(linea.precioUnitario)} × ${linea.unidades} = ${formatearEuros(linea.importe)}`
      : `${linea.nombre}: ${formatearEuros(linea.importe)}`)
    .join(' · ');
}

function formatearEuros(importe: number): string {
  return `${importe.toFixed(2).replace('.', ',')} €`;
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
