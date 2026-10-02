import { minutosDelDia } from '../fechas/zona-horaria';

/**
 * Residencia y guardería canina.
 *
 * Un centro de alojamiento puede ofrecer estancias con pernoctación
 * (residencia), cuidado de día sin noche (guardería) o las dos. Vive en
 * `shared` porque el alta del comercio, el cobro del API y el resumen que ve
 * el cliente tienen que dar el mismo número: una copia de la fórmula en cada
 * lado acaba desincronizándose.
 */
export enum ModalidadAlojamiento {
  RESIDENCIA = 'residencia',
  GUARDERIA = 'guarderia',
}

export const MODALIDAD_ALOJAMIENTO_LABELS: Record<ModalidadAlojamiento, string> = {
  [ModalidadAlojamiento.RESIDENCIA]: 'Residencia con alojamiento',
  [ModalidadAlojamiento.GUARDERIA]: 'Guardería de día',
};

/** Cómo se reserva un día de guardería. */
export enum TramoGuarderia {
  HORAS = 'horas',
  MEDIA_JORNADA = 'media_jornada',
  DIA_COMPLETO = 'dia_completo',
}

export const TRAMO_GUARDERIA_LABELS: Record<TramoGuarderia, string> = {
  [TramoGuarderia.HORAS]: 'Por horas',
  [TramoGuarderia.MEDIA_JORNADA]: 'Media jornada',
  [TramoGuarderia.DIA_COMPLETO]: 'Día completo',
};

/** Horas que cubre una media jornada. */
export const HORAS_MEDIA_JORNADA = 5;

/**
 * Id de la «unidad» guardería en `reserva.detalle.espacioId`.
 *
 * Con él la ocupación de la guardería se cuenta aparte de la de las suites
 * sin tocar el repositorio de ocupación del core: una reserva de guardería no
 * gasta una noche de residencia, y al revés.
 */
export const ID_UNIDAD_GUARDERIA = 'guarderia';

/** Días de la semana ISO: 1 = lunes … 7 = domingo. */
export const DIAS_GUARDERIA_DEFECTO: readonly number[] = [1, 2, 3, 4, 5];

/** Configuración de la guardería de día de un alojamiento. Precios con IVA incluido. */
export interface ConfigGuarderia {
  /** Precio por hora; 0/ausente = no se vende por horas. */
  precioHora?: number;
  precioMediaJornada?: number;
  precioDiaCompleto?: number;
  /** Perros que el centro admite cada día en guardería. */
  plazasPorDia: number;
  /** Horario de la guardería, `HH:mm`. Sin él no se limita la hora de entrada. */
  apertura?: string;
  cierre?: string;
  /** Días abiertos (ISO, 1 = lunes). Vacío/ausente = todos los días. */
  diasSemana?: number[];
  /** Mínimo de horas cuando se reserva por horas. */
  horasMinimas?: number;
}

/** Lo que el cliente pide para un día de guardería. */
export interface SolicitudGuarderia {
  /** Día, `YYYY-MM-DD`. */
  fecha: string;
  tramo: TramoGuarderia | string;
  /** Sólo por horas: cuántas. */
  horas?: number;
  /** Hora de entrada, `HH:mm` (opcional). */
  horaEntrada?: string;
}

/** Lo mínimo de un servicio de alojamiento para saber qué modalidades vende. */
export interface ConModalidades {
  modalidades?: readonly string[] | null;
}

const MODALIDADES_VALIDAS: readonly string[] = Object.values(ModalidadAlojamiento);

/**
 * Modalidades que ofrece un alojamiento. Los servicios dados de alta antes de
 * que existiera la guardería no traen el campo: son residencias.
 */
export function modalidadesAlojamiento(servicio: ConModalidades | null | undefined): ModalidadAlojamiento[] {
  const declaradas = (servicio?.modalidades ?? [])
    .filter((m): m is ModalidadAlojamiento => MODALIDADES_VALIDAS.includes(m));
  return declaradas.length ? [...new Set(declaradas)] : [ModalidadAlojamiento.RESIDENCIA];
}

export const ofreceGuarderia = (servicio: ConModalidades | null | undefined): boolean =>
  modalidadesAlojamiento(servicio).includes(ModalidadAlojamiento.GUARDERIA);

export const ofreceResidencia = (servicio: ConModalidades | null | undefined): boolean =>
  modalidadesAlojamiento(servicio).includes(ModalidadAlojamiento.RESIDENCIA);

const positivo = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Precio de un tramo, o 0 si el centro no lo vende. */
function precioDelTramo(config: ConfigGuarderia, tramo: string): number {
  if (tramo === TramoGuarderia.HORAS) return positivo(config.precioHora);
  if (tramo === TramoGuarderia.MEDIA_JORNADA) return positivo(config.precioMediaJornada);
  if (tramo === TramoGuarderia.DIA_COMPLETO) return positivo(config.precioDiaCompleto);
  return 0;
}

/** Tramos que el centro vende: los que tienen precio. */
export function tramosOfrecidos(config: ConfigGuarderia | null | undefined): TramoGuarderia[] {
  if (!config) return [];
  return Object.values(TramoGuarderia).filter((tramo) => precioDelTramo(config, tramo) > 0);
}

/** Horas facturables por horas: nunca menos del mínimo del centro ni de una. */
export function horasFacturables(config: ConfigGuarderia, horas: unknown): number {
  const minimo = Math.max(1, Math.round(positivo(config.horasMinimas)) || 1);
  return Math.max(minimo, Math.round(positivo(horas)) || minimo);
}

/** Minutos que dura lo reservado; `null` en día completo (se queda hasta el cierre). */
function duracionMinutos(config: ConfigGuarderia, solicitud: SolicitudGuarderia): number | null {
  if (solicitud.tramo === TramoGuarderia.HORAS) return horasFacturables(config, solicitud.horas) * 60;
  if (solicitud.tramo === TramoGuarderia.MEDIA_JORNADA) return HORAS_MEDIA_JORNADA * 60;
  return null;
}

/**
 * Precio de un día de guardería para `perros` perros, IVA incluido.
 * `null` si el centro no vende ese tramo.
 */
export function precioGuarderia(
  config: ConfigGuarderia,
  solicitud: Pick<SolicitudGuarderia, 'tramo' | 'horas'>,
  perros = 1,
): number | null {
  const unitario = precioDelTramo(config, solicitud.tramo);
  if (unitario <= 0) return null;

  const mascotas = Math.max(1, Math.round(perros) || 1);
  const unidades = solicitud.tramo === TramoGuarderia.HORAS ? horasFacturables(config, solicitud.horas) : 1;
  return Math.round(unitario * unidades * mascotas * 100) / 100;
}

/** El precio más bajo que se puede pagar en guardería, para el «desde». */
export function precioDesdeGuarderia(config: ConfigGuarderia | null | undefined): number | undefined {
  if (!config) return undefined;
  const precios = tramosOfrecidos(config)
    .map((tramo) => precioGuarderia(config, { tramo, horas: config.horasMinimas }) ?? 0)
    .filter((p) => p > 0);
  return precios.length ? Math.min(...precios) : undefined;
}

/** Día de la semana ISO (1 = lunes) de una fecha `YYYY-MM-DD`, sin depender de la zona del equipo. */
export function diaSemanaIso(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const domingoCero = new Date(Date.UTC(anio, (mes || 1) - 1, dia || 1)).getUTCDay();
  return domingoCero === 0 ? 7 : domingoCero;
}

export function guarderiaAbreElDia(config: ConfigGuarderia, fecha: string): boolean {
  const dias = config.diasSemana ?? [];
  return dias.length === 0 || dias.includes(diaSemanaIso(fecha));
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Por qué no se puede reservar lo pedido, en lenguaje para el cliente; `null`
 * si encaja con lo que vende el centro y con su horario. La ocupación (plazas
 * libres ese día) la comprueba el API aparte, porque necesita las reservas.
 */
export function motivoGuarderiaNoReservable(
  config: ConfigGuarderia | null | undefined,
  solicitud: SolicitudGuarderia,
): string | null {
  if (!config || positivo(config.plazasPorDia) <= 0) {
    return 'Este alojamiento no tiene plazas de guardería de día publicadas.';
  }
  if (precioDelTramo(config, solicitud.tramo) <= 0) {
    return 'Este centro no ofrece esa modalidad de guardería. Elige otra.';
  }
  if (!guarderiaAbreElDia(config, solicitud.fecha)) {
    return 'La guardería no abre ese día de la semana. Prueba con otra fecha.';
  }
  return motivoFueraDeHorario(config, solicitud);
}

function motivoFueraDeHorario(config: ConfigGuarderia, solicitud: SolicitudGuarderia): string | null {
  const { apertura, cierre } = config;
  const entrada = solicitud.horaEntrada;
  if (!entrada || !apertura || !cierre || !HORA.test(apertura) || !HORA.test(cierre)) return null;
  if (!HORA.test(entrada)) return 'La hora de entrada no es válida.';

  const desde = minutosDelDia(entrada);
  const duracion = duracionMinutos(config, solicitud) ?? 0;
  if (desde < minutosDelDia(apertura) || desde + duracion > minutosDelDia(cierre)) {
    return `La guardería abre de ${apertura} a ${cierre}: elige una hora de entrada que quepa en ese horario.`;
  }
  return null;
}

/**
 * «Guardería de día · Media jornada» / «Residencia»: cómo se nombra en el
 * panel del comercio lo que se reservó. `null` si la reserva no dice nada
 * (reservas anteriores a la guardería, o de otro vertical).
 */
export function etiquetaModalidadReserva(detalle: Record<string, unknown> | null | undefined): string | null {
  const modalidad = detalle?.['modalidad'];
  if (modalidad === ModalidadAlojamiento.RESIDENCIA) return 'Residencia';
  if (modalidad !== ModalidadAlojamiento.GUARDERIA) return null;

  const tramo = detalle?.['tramoGuarderia'] as TramoGuarderia | undefined;
  const etiqueta = tramo ? TRAMO_GUARDERIA_LABELS[tramo] : undefined;
  if (!etiqueta) return 'Guardería de día';
  const horas = Number(detalle?.['horasGuarderia']);
  const detalleHoras = tramo === TramoGuarderia.HORAS && horas > 0 ? ` (${horas} h)` : '';
  return `Guardería de día · ${etiqueta}${detalleHoras}`;
}
