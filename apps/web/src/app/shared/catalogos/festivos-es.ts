import { claveDia } from '../fechas';

/** Un festivo con su fecha ISO corta y el nombre con el que se conoce. */
export interface Festivo {
  readonly fecha: string;
  readonly motivo: string;
}

/**
 * Festivos de ámbito **nacional** en España, los que se repiten en el
 * calendario laboral estatal año tras año (art. 37.2 del Estatuto de los
 * Trabajadores y el calendario que publica cada año el BOE).
 *
 * Deliberadamente **no incluye los autonómicos ni los locales**: varían por
 * comunidad y por municipio —y hasta por año—, y darlos por buenos aquí haría
 * que un negocio cerrase un día que sí abre, o al revés. El comercio los añade
 * a mano en el calendario, que para eso está.
 *
 * Tampoco traslada los que caen en domingo. Ese traslado es del calendario
 * laboral, no de la persiana: lo que la ficha tiene que decir es si el negocio
 * abre ese día concreto.
 */
const FIJOS: ReadonlyArray<{ mes: number; dia: number; motivo: string }> = [
  { mes: 1, dia: 1, motivo: 'Año Nuevo' },
  { mes: 1, dia: 6, motivo: 'Epifanía del Señor' },
  { mes: 5, dia: 1, motivo: 'Fiesta del Trabajo' },
  { mes: 8, dia: 15, motivo: 'Asunción de la Virgen' },
  { mes: 10, dia: 12, motivo: 'Fiesta Nacional de España' },
  { mes: 11, dia: 1, motivo: 'Todos los Santos' },
  { mes: 12, dia: 6, motivo: 'Día de la Constitución' },
  { mes: 12, dia: 8, motivo: 'Inmaculada Concepción' },
  { mes: 12, dia: 25, motivo: 'Natividad del Señor' },
];

/**
 * Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher (calendario
 * gregoriano). Hace falta porque el Viernes Santo es el único festivo nacional
 * móvil, y su fecha no se puede tabular: depende de la luna llena de primavera.
 */
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

/** Festivos nacionales de un año, ordenados por fecha. */
export function festivosNacionales(anio: number): Festivo[] {
  const viernesSanto = domingoDePascua(anio);
  viernesSanto.setDate(viernesSanto.getDate() - 2);

  const festivos: Festivo[] = [
    ...FIJOS.map(({ mes, dia, motivo }) => ({ fecha: claveDia(new Date(anio, mes - 1, dia)), motivo })),
    { fecha: claveDia(viernesSanto), motivo: 'Viernes Santo' },
  ];

  return festivos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Festivos nacionales que quedan por delante dentro de los próximos doce meses.
 *
 * Se mira una ventana móvil y no el año natural porque en noviembre lo útil no
 * es "lo que queda de este año" —dos días— sino la temporada que viene.
 */
export function festivosNacionalesProximos(desde: Date = new Date()): Festivo[] {
  const hasta = new Date(desde.getFullYear() + 1, desde.getMonth(), desde.getDate());
  const desdeClave = claveDia(desde);
  const hastaClave = claveDia(hasta);

  return [desde.getFullYear(), desde.getFullYear() + 1]
    .flatMap((anio) => festivosNacionales(anio))
    .filter((f) => f.fecha >= desdeClave && f.fecha <= hastaClave);
}
