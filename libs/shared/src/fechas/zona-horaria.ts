import { DIAS_SEMANA, ExcepcionHorarioDto, HorarioDiaDto } from '../dtos/comunes/horario.dto';

/**
 * Zona horaria de la plataforma: la de los comercios.
 *
 * Una cita "a las 10:00" son las 10:00 **en el comercio**, lo mire quien lo mire.
 * Hasta ahora cada pieza usaba la hora de la máquina en la que corría: el
 * servidor (UTC en producción) guardaba las 10:00 como 10:00 UTC —las 12:00 en
 * Madrid—, y el navegador pintaba cada fecha con su propia zona, así que desde
 * fuera de España las citas y hasta los días se desplazaban.
 *
 * TODO: cuando haya comercios fuera de la zona peninsular (Canarias, Portugal,
 * Grecia), guardar la zona en el comercio y pasarla a estas funciones.
 */
export const ZONA_HORARIA_PLATAFORMA = 'Europe/Madrid';

export interface PartesFecha {
  readonly anio: number;
  /** 1 = enero. */
  readonly mes: number;
  readonly dia: number;
  readonly hora: number;
  readonly minuto: number;
  /** 0 = domingo, como `Date.getDay()`. */
  readonly diaSemana: number;
}

export interface FechaDeCalendario {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
  readonly hora?: number;
  readonly minuto?: number;
}

const DIA_CORTO: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formateadores.set(zona, f);
  }
  return f;
}

/** Fecha y hora de pared de un instante en la zona indicada. */
export function partesEnZona(instante: Date | string | number, zona = ZONA_HORARIA_PLATAFORMA): PartesFecha {
  const partes = Object.fromEntries(
    formateador(zona).formatToParts(new Date(instante)).map((p) => [p.type, p.value]),
  );
  return {
    anio: Number(partes['year']),
    mes: Number(partes['month']),
    dia: Number(partes['day']),
    // Algunos motores devuelven "24" para la medianoche aun con h23.
    hora: Number(partes['hour']) % 24,
    minuto: Number(partes['minute']),
    diaSemana: DIA_CORTO[partes['weekday']] ?? 0,
  };
}

/** Minutos que la zona va por delante de UTC en ese instante (+120 en verano en Madrid). */
export function desfaseMinutos(instante: Date | string | number, zona = ZONA_HORARIA_PLATAFORMA): number {
  const fecha = new Date(instante);
  const p = partesEnZona(fecha, zona);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  const sinSegundos = Math.floor(fecha.getTime() / 60000) * 60000;
  return Math.round((comoUtc - sinSegundos) / 60000);
}

/** Desfase como lo pide `DatePipe`: `+0200`, `+0100`. */
export function desfaseIso(instante: Date | string | number, zona = ZONA_HORARIA_PLATAFORMA): string {
  const minutos = desfaseMinutos(instante, zona);
  const signo = minutos < 0 ? '-' : '+';
  const abs = Math.abs(minutos);
  return `${signo}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

/**
 * El instante en que en la zona es esa fecha y hora de pared.
 *
 * Se corrige una vez con el desfase del resultado para acertar en los días de
 * cambio de hora: el desfase de "las 10:00 UTC" y el de "las 10:00 en Madrid"
 * no tienen por qué ser el mismo si entre medias se cambió la hora.
 */
export function instanteEnZona(fecha: FechaDeCalendario, zona = ZONA_HORARIA_PLATAFORMA): Date {
  const comoUtc = Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia, fecha.hora ?? 0, fecha.minuto ?? 0);
  const primero = desfaseMinutos(comoUtc, zona);
  let resultado = comoUtc - primero * 60000;
  const segundo = desfaseMinutos(resultado, zona);
  if (segundo !== primero) resultado = comoUtc - segundo * 60000;
  return new Date(resultado);
}

/** `YYYY-MM-DD` del día de la zona en ese instante. */
export function claveDiaEnZona(instante: Date | string | number, zona = ZONA_HORARIA_PLATAFORMA): string {
  const p = partesEnZona(instante, zona);
  return `${p.anio}-${dosCifras(p.mes)}-${dosCifras(p.dia)}`;
}

/** `HH:mm` de la zona en ese instante. */
export function horaEnZona(instante: Date | string | number, zona = ZONA_HORARIA_PLATAFORMA): string {
  const p = partesEnZona(instante, zona);
  return `${dosCifras(p.hora)}:${dosCifras(p.minuto)}`;
}

/** Día `YYYY-MM-DD` y hora `HH:mm` de pared de la zona, como instante. */
export function fechaYHoraEnZona(clave: string, hora: string, zona = ZONA_HORARIA_PLATAFORMA): Date {
  const [anio, mes, dia] = clave.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  return instanteEnZona({ anio, mes, dia, hora: h || 0, minuto: m || 0 }, zona);
}

export function esFechaSinHora(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto);
}

export function esHoraValida(texto: unknown): texto is string {
  return typeof texto === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
}

/**
 * Lee una fecha que llega del cliente.
 *
 * - `2026-09-20`: un día, sin hora. Se queda a medianoche UTC, que es el
 *   convenio con el que ya se cuentan noches y días de inventario.
 * - `2026-09-20T10:00` (sin zona): hora de pared **de la plataforma**. Antes
 *   `new Date()` la interpretaba con la zona del servidor.
 * - Con `Z` o desfase explícito: el instante exacto que dice.
 */
export function parsearFechaPlataforma(texto: string, zona = ZONA_HORARIA_PLATAFORMA): Date {
  const valor = texto.trim();
  if (esFechaSinHora(valor)) return new Date(`${valor}T00:00:00.000Z`);

  const sinZona = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(valor);
  if (sinZona) return fechaYHoraEnZona(sinZona[1], `${sinZona[2]}:${sinZona[3]}`, zona);

  return new Date(valor);
}

/** ¿Es este instante la medianoche UTC de un día? El convenio de "sólo el día". */
export function esMedianocheUtc(fecha: Date): boolean {
  return fecha.getUTCHours() === 0 && fecha.getUTCMinutes() === 0
    && fecha.getUTCSeconds() === 0 && fecha.getUTCMilliseconds() === 0;
}

export function minutosDelDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export interface ComprobacionHorario {
  readonly permitido: boolean;
  readonly motivo?: string;
}

/**
 * ¿Cae la cita dentro del horario del servicio, en la hora del comercio?
 *
 * Sin horario configurado (o sin ninguna hora puesta) no se bloquea nada: es
 * un dato que el comercio aún no ha rellenado, no un "cerrado siempre". Un día
 * abierto sin horas ("Consultar") tampoco bloquea.
 */
export function comprobarHorario(
  horario: readonly HorarioDiaDto[] | undefined,
  excepciones: readonly ExcepcionHorarioDto[] | undefined,
  inicio: Date,
  fin: Date,
  zona = ZONA_HORARIA_PLATAFORMA,
): ComprobacionHorario {
  const clave = claveDiaEnZona(inicio, zona);
  const desde = minutosDeInstante(inicio, zona);
  // Una cita que acaba justo a medianoche cuenta como fin del día, no como minuto 0.
  const hasta = claveDiaEnZona(fin, zona) === clave ? minutosDeInstante(fin, zona) : 24 * 60;

  const excepcion = (excepciones ?? []).find((e) => e.fecha === clave);
  if (excepcion) {
    if (excepcion.cerrado) {
      return { permitido: false, motivo: `El comercio cierra ese día${excepcion.motivo ? ` (${excepcion.motivo})` : ''}.` };
    }
    return dentroDeTramos([[excepcion.abre, excepcion.cierra]], desde, hasta);
  }

  const configurado = (horario ?? []).some((d) => d.cerrado || (d.abre && d.cierra));
  if (!configurado) return { permitido: true };

  const nombreDia = DIAS_SEMANA[(partesEnZona(inicio, zona).diaSemana + 6) % 7];
  const dia = (horario ?? []).find((d) => d.dia === nombreDia);
  if (!dia || dia.cerrado) return { permitido: false, motivo: 'El comercio no atiende ese día de la semana.' };

  return dentroDeTramos([[dia.abre, dia.cierra], [dia.abre2, dia.cierra2]], desde, hasta);
}

function dentroDeTramos(
  tramos: Array<[string | undefined, string | undefined]>,
  desde: number,
  hasta: number,
): ComprobacionHorario {
  const validos = tramos.filter((t): t is [string, string] => esHoraValida(t[0]) && esHoraValida(t[1]));
  if (!validos.length) return { permitido: true };

  const cabe = validos.some(([abre, cierra]) => desde >= minutosDelDia(abre) && hasta <= minutosDelDia(cierra));
  if (cabe) return { permitido: true };

  const horas = validos.map(([abre, cierra]) => `${abre}–${cierra}`).join(' y ');
  return { permitido: false, motivo: `Esa hora está fuera del horario del comercio (${horas}).` };
}

function minutosDeInstante(instante: Date, zona: string): number {
  const p = partesEnZona(instante, zona);
  return p.hora * 60 + p.minuto;
}

function dosCifras(n: number): string {
  return String(n).padStart(2, '0');
}
