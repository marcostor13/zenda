import { ExcepcionHorarioDto, HorarioDiaDto } from '../dtos/comunes/horario.dto';
import {
  ZONA_HORARIA_PLATAFORMA, TramoMinutos, claveDiaEnZona, esHoraValida, horaDeMinutos, instanteEnZona,
  minutosDelDia, partesEnZona, tramosDelDia,
} from './zona-horaria';

/**
 * Entrega y recogida de una estancia (alojamiento, hotel) contra el horario
 * del comercio.
 *
 * Una estancia ocupa noches, pero el perro se deja y se recoge en persona: si
 * el comercio cierra el día de entrada o el de salida, no hay nadie para
 * recibirlo. Hasta ahora sólo las citas miraban el horario y se podía pagar una
 * residencia con la entrada en domingo y la puerta cerrada.
 *
 * Las noches de en medio no cuentan: el perro ya está dentro. Un comercio sin
 * horario configurado no bloquea nada (no es "cerrado siempre", es un dato que
 * aún no ha rellenado), igual que en `comprobarHorario`.
 */

export type MomentoEstancia = 'entrada' | 'salida';

export interface PuntoEstancia {
  /** Día `YYYY-MM-DD` del comercio. */
  readonly fecha: string;
  /** Hora `HH:mm` de entrega o recogida, si el cliente la ha elegido. */
  readonly hora?: string | null;
}

export interface ProblemaHorarioEstancia {
  readonly momento: MomentoEstancia;
  readonly fecha: string;
  readonly motivo: string;
  /** Días válidos más cercanos para ese momento, el más próximo primero. */
  readonly alternativas: readonly string[];
}

export interface HorarioServicio {
  readonly horario?: readonly HorarioDiaDto[];
  readonly excepcionesHorario?: readonly ExcepcionHorarioDto[];
}

/** Hasta dónde se buscan alternativas, a cada lado del día pedido. */
const MAX_DIAS_ALTERNATIVA = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

const sumarDias = (fecha: string, dias: number): string =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);

/** «el sábado 4 de octubre». */
export function diaEnPalabras(fecha: string, zona = ZONA_HORARIA_PLATAFORMA): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaSemana = partesEnZona(instanteEnZona({ anio, mes, dia, hora: 12 }, zona), zona).diaSemana;
  return `el ${DIAS[diaSemana]} ${dia} de ${MESES[mes - 1]}`;
}

/** ¿Cierra el comercio ese día? Sin horario configurado, nunca. */
export function diaCerrado(servicio: HorarioServicio, fecha: string): boolean {
  return tramosDelDia(servicio.horario, servicio.excepcionesHorario, fecha).estado === 'cerrado';
}

/**
 * Horas a las que se puede entregar o recoger ese día, cada `pasoMin`.
 * `null` = el comercio no ha puesto horas: vale cualquiera. `[]` = cerrado.
 */
export function horasDeAtencion(servicio: HorarioServicio, fecha: string, pasoMin = 30): string[] | null {
  const dia = tramosDelDia(servicio.horario, servicio.excepcionesHorario, fecha);
  if (dia.estado === 'sin_horario') return null;
  if (dia.estado === 'cerrado') return [];
  const horas: string[] = [];
  for (const [abre, cierra] of dia.tramos) {
    for (let minuto = abre; minuto < cierra; minuto += pasoMin) horas.push(horaDeMinutos(minuto));
  }
  return horas;
}

/** ¿Cae la hora dentro de algún tramo abierto? El minuto del cierre ya no vale. */
function horaEnTramos(tramos: readonly TramoMinutos[], hora: string): boolean {
  const minuto = minutosDelDia(hora);
  return tramos.some(([abre, cierra]) => minuto >= abre && minuto < cierra);
}

/** ¿Se puede entregar o recoger ese día (y a esa hora, si la hay)? */
function puntoValido(servicio: HorarioServicio, punto: PuntoEstancia): { valido: boolean; motivo?: string } {
  const dia = tramosDelDia(servicio.horario, servicio.excepcionesHorario, punto.fecha);
  if (dia.estado === 'sin_horario') return { valido: true };
  if (dia.estado === 'cerrado') return { valido: false, motivo: `El comercio no atiende ${diaEnPalabras(punto.fecha)}.` };
  if (!esHoraValida(punto.hora) || horaEnTramos(dia.tramos, punto.hora)) return { valido: true };

  const horas = dia.tramos.map(([abre, cierra]) => `${horaDeMinutos(abre)}–${horaDeMinutos(cierra)}`).join(' y ');
  return {
    valido: false,
    motivo: `A las ${punto.hora} el comercio está cerrado ${diaEnPalabras(punto.fecha)} (atiende de ${horas}).`,
  };
}

/** ¿Abre ese día? Para buscar alternativas basta con el día: la hora se elige después. */
const diaAbierto = (servicio: HorarioServicio, fecha: string): boolean => !diaCerrado(servicio, fecha);

/**
 * Días abiertos más cercanos a `fecha` dentro de `[desde, hasta]` (ambos
 * incluidos y opcionales): el primero hacia atrás y el primero hacia delante,
 * el más próximo delante.
 */
export function diasAbiertosCercanos(
  servicio: HorarioServicio,
  fecha: string,
  limites: { readonly desde?: string; readonly hasta?: string } = {},
): string[] {
  const dentro = (dia: string): boolean =>
    (!limites.desde || dia >= limites.desde) && (!limites.hasta || dia <= limites.hasta);
  const buscar = (sentido: 1 | -1): { dia: string; distancia: number } | null => {
    for (let salto = 1; salto <= MAX_DIAS_ALTERNATIVA; salto++) {
      const dia = sumarDias(fecha, salto * sentido);
      if (!dentro(dia)) return null;
      if (diaAbierto(servicio, dia)) return { dia, distancia: salto };
    }
    return null;
  };
  return [buscar(-1), buscar(1)]
    .filter((r): r is { dia: string; distancia: number } => r !== null)
    .sort((a, b) => a.distancia - b.distancia)
    .map((r) => r.dia);
}

const textoMomento: Record<MomentoEstancia, string> = {
  entrada: 'la entrada (entrega)',
  salida: 'la salida (recogida)',
};

/**
 * Primer problema de horario de una estancia, o `null` si la entrada y la
 * salida caen en horas de atención. Las alternativas respetan el orden de la
 * estancia (la entrada antes de la salida) y no proponen días pasados.
 */
export function comprobarEntradaYSalida(
  servicio: HorarioServicio,
  entrada: PuntoEstancia,
  salida: PuntoEstancia | null,
  hoy: string = claveDiaEnZona(new Date()),
): ProblemaHorarioEstancia | null {
  const puntos: Array<[MomentoEstancia, PuntoEstancia]> = [['entrada', entrada]];
  if (salida) puntos.push(['salida', salida]);

  for (const [momento, punto] of puntos) {
    const resultado = puntoValido(servicio, punto);
    if (resultado.valido) continue;
    const limites = momento === 'entrada'
      ? { desde: hoy, hasta: salida ? sumarDias(salida.fecha, -1) : undefined }
      : { desde: sumarDias(entrada.fecha, 1) };
    const alternativas = diasAbiertosCercanos(servicio, punto.fecha, limites);
    // Si el día abre y sólo falla la hora, el mismo día sigue siendo la mejor opción.
    const mismoDia = diaAbierto(servicio, punto.fecha) ? [punto.fecha] : [];
    return {
      momento,
      fecha: punto.fecha,
      motivo: `${resultado.motivo} No se puede hacer ${textoMomento[momento]} entonces.`,
      alternativas: [...mismoDia, ...alternativas],
    };
  }
  return null;
}

/** El problema en una frase con las alternativas, para devolverlo desde el API. */
export function describirProblemaEstancia(problema: ProblemaHorarioEstancia): string {
  if (!problema.alternativas.length) return problema.motivo;
  const opciones = problema.alternativas.map((fecha) => diaEnPalabras(fecha)).join(' o ');
  return `${problema.motivo} Días más cercanos en que atiende: ${opciones}.`;
}
