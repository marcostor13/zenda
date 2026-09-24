import { TamanoPerro } from '../enums/perro.enum';
import {
  BULTOS_EQUIPAJE, EquipajeTransporte, EspecieMascota, FranjaTransporte, ModalidadTransporte,
  ModoHorarioTransporte, ModoPrecioTransporte, NecesidadTransporte, NECESIDADES_ESPECIALES_TRANSPORTE,
  PatronRecurrenciaTransporte, PLAZO_ACEPTACION_MIN, PreferenciaTransporte, TipoServicioTransporte,
  VueltaTransporte, normalizarEspecie,
} from './transporte.catalogo';

/**
 * Cotizador de Transporte: **la única fórmula de precio** del vertical.
 *
 * El API la usa para listar empresas con su precio y otra vez al crear la
 * reserva, así que lo que el cliente ve en resultados es lo que se le cobra.
 * Antes el precio se calculaba en el API y se copiaba en el asistente web, y
 * las dos copias podían separarse. También evita que el cliente vea nunca cómo
 * tarifica cada empresa: aquí entra la necesidad y sale un total con conceptos
 * («Trayecto», «Suplemento urgente»), nunca «€/km».
 *
 * Es una función pura: no consulta rutas ni reloj. Quien la llama le pasa la
 * distancia ya calculada en el servidor y las horas que faltan para la recogida.
 */

/** Un punto del viaje tal como lo eligió el cliente en el autocompletado. */
export interface PuntoViaje {
  texto: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

/** Una mascota del viaje: guardada en su ficha (`perroId`) o descrita a mano. */
export interface MascotaViaje {
  perroId?: string;
  nombre?: string;
  especie: string;
  tamano: TamanoPerro;
}

export interface VueltaViaje {
  modo: VueltaTransporte;
  /** `HH:mm`, para `hora` y `otro_dia`. */
  hora?: string;
  /** Horas de espera, para `tras_horas`. */
  horas?: number;
  /** `YYYY-MM-DD`, para `otro_dia`. */
  fecha?: string;
}

export interface RecurrenciaViaje {
  patron: PatronRecurrenciaTransporte;
  /** 0 = domingo … 6 = sábado. Vacío en el mensual. */
  diasSemana: number[];
  hora: string;
  /** `YYYY-MM-DD`, último día incluido. */
  hasta: string;
}

/** Todo lo que describe el cliente en las pantallas 1 y 2. */
export interface SolicitudTransporte {
  tipoServicio: TipoServicioTransporte;
  origen: PuntoViaje;
  destino: PuntoViaje;
  /** `YYYY-MM-DD`, día de la recogida en hora del comercio. */
  fecha: string;
  modoHorario: ModoHorarioTransporte;
  hora?: string;
  franja?: FranjaTransporte;
  vuelta?: VueltaViaje;
  recurrencia?: RecurrenciaViaje;
  mascotas: MascotaViaje[];
  necesidades: NecesidadTransporte[];
  necesidadOtra?: string;
  comportamiento?: string;
  notaTransportista?: string;
  modalidad: ModalidadTransporte;
  personas?: number;
  equipaje?: EquipajeTransporte;
  preferencias: PreferenciaTransporte[];
}

/** Tarifa por pareja de provincias. Sirve en los dos sentidos. */
export interface ZonaPrecioTransporte {
  origen: string;
  destino: string;
  precio: number;
}

/** Suplementos que declara el transportista. Ausente o 0 = no se cobra. */
export interface SuplementosTransporte {
  urgente?: number;
  nocturno?: number;
  largaDistanciaDesdeKm?: number;
  largaDistancia?: number;
  mascotaAdicional?: number;
  mascotaGrande?: number;
  medicacion?: number;
  porPersona?: number;
  porMaleta?: number;
}

/** Cuándo prefiere el transportista presupuestar a mano en vez de dar precio. */
export interface ReglasPresupuestoTransporte {
  internacional?: boolean;
  /** Más de N mascotas. 0 = nunca. */
  masDeMascotas?: number;
  necesidadesEspeciales?: boolean;
  /** Más de N km. 0 = nunca. */
  masDeKm?: number;
  /** Especies distintas de perro y gato. */
  especiesExoticas?: boolean;
}

/** Lo que el cotizador necesita saber de una empresa. Es un subconjunto del schema. */
export interface TarifarioTransporte {
  modoPrecio?: ModoPrecioTransporte;
  tarifaBase: number;
  tarifaKm: number;
  precioFijo?: number;
  zonasPrecio?: ZonaPrecioTransporte[];
  distanciaMinimaKm?: number;
  tarifaEsperaPorHora?: number;
  modalidades?: ModalidadTransporte[];
  precioExclusivo?: number;
  suplementos?: SuplementosTransporte;
  capacidadPerros: number;
  maxPerrosPorTrayecto?: number;
  plazasPasajeros?: number;
  especiesAceptadas?: string[];
  aceptaLoAntesPosible?: boolean;
  aceptaUrgentes?: boolean;
  antelacionMinimaHoras?: number;
  reglasPresupuesto?: ReglasPresupuestoTransporte;
}

/** Datos del viaje que se calculan en el servidor, nunca en el navegador. */
export interface ContextoCotizacion {
  km: number;
  provinciaOrigen?: string;
  provinciaDestino?: string;
  paisOrigen?: string;
  paisDestino?: string;
  /** Horas desde ahora hasta la recogida. Negativo = ya pasó. */
  horasHastaRecogida: number;
}

export interface LineaDesglose {
  concepto: string;
  importe: number;
}

export type EstadoCotizacion = 'precio' | 'presupuesto' | 'no_disponible';

export interface CotizacionTransporte {
  estado: EstadoCotizacion;
  /** Por qué no hay precio automático, en lenguaje para el cliente. */
  motivo?: string;
  /** Precio de un viaje (ida, o ida y vuelta), IVA incluido. */
  total: number;
  desglose: LineaDesglose[];
  /** El transportista tiene que aceptar el viaje: no hay hora cerrada o es urgente. */
  requiereAceptacion: boolean;
  /** Minutos que tiene para aceptarlo. */
  plazoAceptacionMin?: number;
}

const redondear = (importe: number): number => Math.round(importe * 100) / 100;

const TAMANOS_GRANDES: readonly TamanoPerro[] = [TamanoPerro.GRANDE, TamanoPerro.GIGANTE];

const ESPECIES_COMUNES: readonly EspecieMascota[] = [EspecieMascota.PERRO, EspecieMascota.GATO];

/** Primera hora que cuenta como recogida nocturna y última de la madrugada. */
const HORA_INICIO_NOCHE = 22;
const HORA_FIN_NOCHE = 7;

/** Normaliza provincias y países para comparar «Castellón» con «castellon». */
export function normalizarTerritorio(valor?: string): string {
  return (valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(provincia de |province of )/, '')
    .split('/')[0]
    .trim();
}

export function cotizarTransporte(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  contexto: ContextoCotizacion,
): CotizacionTransporte {
  const noDisponible = comprobarCompatibilidad(tarifa, solicitud, contexto);
  if (noDisponible) return sinPrecio('no_disponible', noDisponible);

  const presupuesto = motivoPresupuesto(tarifa, solicitud, contexto);
  if (presupuesto) return sinPrecio('presupuesto', presupuesto);

  const trayecto = precioTrayecto(tarifa, contexto);
  if (trayecto === null) {
    return sinPrecio('presupuesto', 'Esta empresa no tiene precio publicado para esta ruta.');
  }

  const desglose = [
    ...lineasTrayecto(tarifa, solicitud, trayecto),
    ...lineasModalidad(tarifa, solicitud),
    ...lineasSuplementos(tarifa, solicitud, contexto),
  ].filter((linea) => linea.importe > 0);

  return {
    estado: 'precio',
    total: redondear(desglose.reduce((suma, linea) => suma + linea.importe, 0)),
    desglose,
    ...aceptacion(solicitud),
  };
}

function sinPrecio(estado: EstadoCotizacion, motivo: string): CotizacionTransporte {
  return { estado, motivo, total: 0, desglose: [], requiereAceptacion: false };
}

/** Lo que hace imposible el viaje con esta empresa, aunque se pidiera presupuesto. */
function comprobarCompatibilidad(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  contexto: ContextoCotizacion,
): string | null {
  const modalidades = tarifa.modalidades?.length ? tarifa.modalidades : [ModalidadTransporte.COMPARTIDO];
  if (!modalidades.includes(solicitud.modalidad)) {
    return 'Esta empresa no ofrece esa modalidad de viaje.';
  }

  const especies = (tarifa.especiesAceptadas?.length ? tarifa.especiesAceptadas : [EspecieMascota.PERRO])
    .map(normalizarEspecie);
  if (solicitud.mascotas.some((m) => !especies.includes(normalizarEspecie(m.especie)))) {
    return 'Esta empresa no traslada ese tipo de animal.';
  }

  const maximo = Math.min(tarifa.capacidadPerros || 1, tarifa.maxPerrosPorTrayecto || Infinity);
  if (solicitud.mascotas.length > maximo) {
    return `Esta empresa lleva como máximo ${maximo} mascota(s) por viaje.`;
  }

  if (solicitud.modalidad === ModalidadTransporte.CON_PROPIETARIO
    && (solicitud.personas ?? 1) > (tarifa.plazasPasajeros ?? 0)) {
    return 'Esta empresa no tiene plazas para tantos acompañantes.';
  }

  return comprobarHorario(tarifa, solicitud, contexto);
}

function comprobarHorario(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  contexto: ContextoCotizacion,
): string | null {
  const esUrgente = solicitud.tipoServicio === TipoServicioTransporte.URGENTE;
  const loAntesPosible = solicitud.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE;

  if (esUrgente && tarifa.aceptaUrgentes === false) return 'Esta empresa no hace traslados urgentes.';
  if (loAntesPosible && tarifa.aceptaLoAntesPosible === false) {
    return 'Esta empresa necesita una hora de recogida concreta.';
  }
  // Lo urgente y «lo antes posible» se piden precisamente para ya: la antelación
  // mínima no aplica, la resuelve el transportista al aceptar o rechazar.
  if (esUrgente || loAntesPosible) return null;

  if (contexto.horasHastaRecogida < 0) return 'La hora de recogida ya ha pasado.';
  const antelacion = tarifa.antelacionMinimaHoras ?? 0;
  if (contexto.horasHastaRecogida < antelacion) {
    return `Esta empresa necesita reservar con ${antelacion} h de antelación.`;
  }
  return null;
}

/** Cuándo la empresa prefiere estudiar el viaje antes de poner precio. */
function motivoPresupuesto(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  contexto: ContextoCotizacion,
): string | null {
  const reglas = tarifa.reglasPresupuesto ?? {};
  const paisOrigen = normalizarTerritorio(contexto.paisOrigen);
  const paisDestino = normalizarTerritorio(contexto.paisDestino);

  if (reglas.internacional && paisOrigen && paisDestino && paisOrigen !== paisDestino) {
    return 'Los viajes internacionales se presupuestan a medida.';
  }
  if (reglas.masDeMascotas && solicitud.mascotas.length > reglas.masDeMascotas) {
    return 'Para tantas mascotas la empresa prepara un presupuesto a medida.';
  }
  if (reglas.masDeKm && contexto.km > reglas.masDeKm) {
    return 'Las rutas tan largas se presupuestan a medida.';
  }
  if (reglas.necesidadesEspeciales
    && solicitud.necesidades.some((n) => NECESIDADES_ESPECIALES_TRANSPORTE.includes(n))) {
    return 'Las necesidades especiales se presupuestan a medida.';
  }
  if (reglas.especiesExoticas
    && solicitud.mascotas.some((m) => !ESPECIES_COMUNES.includes(normalizarEspecie(m.especie)))) {
    return 'El traslado de este animal se presupuesta a medida.';
  }
  return null;
}

/** Precio de un trayecto sencillo según cómo tarifique la empresa; `null` = sin precio para esa ruta. */
function precioTrayecto(tarifa: TarifarioTransporte, contexto: ContextoCotizacion): number | null {
  const modo = tarifa.modoPrecio ?? ModoPrecioTransporte.POR_KM;

  if (modo === ModoPrecioTransporte.FIJO) return tarifa.precioFijo ?? null;

  if (modo === ModoPrecioTransporte.POR_ZONA) {
    const origen = normalizarTerritorio(contexto.provinciaOrigen);
    const destino = normalizarTerritorio(contexto.provinciaDestino);
    const zona = (tarifa.zonasPrecio ?? []).find((z) => {
      const a = normalizarTerritorio(z.origen);
      const b = normalizarTerritorio(z.destino);
      return (a === origen && b === destino) || (a === destino && b === origen);
    });
    return zona ? zona.precio : null;
  }

  const km = Math.max(contexto.km, tarifa.distanciaMinimaKm ?? 0);
  return (tarifa.tarifaBase ?? 0) + (tarifa.tarifaKm ?? 0) * km;
}

function lineasTrayecto(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  trayecto: number,
): LineaDesglose[] {
  const lineas: LineaDesglose[] = [{ concepto: 'Trayecto', importe: redondear(trayecto) }];
  if (solicitud.tipoServicio !== TipoServicioTransporte.IDA_VUELTA || !solicitud.vuelta) return lineas;

  lineas.push({ concepto: 'Trayecto de vuelta', importe: redondear(trayecto) });
  if (solicitud.vuelta.modo === VueltaTransporte.TRAS_HORAS) {
    const horas = Math.max(0, solicitud.vuelta.horas ?? 0);
    lineas.push({ concepto: 'Espera', importe: redondear((tarifa.tarifaEsperaPorHora ?? 0) * horas) });
  }
  return lineas;
}

function lineasModalidad(tarifa: TarifarioTransporte, solicitud: SolicitudTransporte): LineaDesglose[] {
  if (solicitud.modalidad === ModalidadTransporte.EXCLUSIVO) {
    return [{ concepto: 'Transporte exclusivo', importe: redondear(tarifa.precioExclusivo ?? 0) }];
  }
  if (solicitud.modalidad !== ModalidadTransporte.CON_PROPIETARIO) return [];

  const suplementos = tarifa.suplementos ?? {};
  const bultos = BULTOS_EQUIPAJE[solicitud.equipaje ?? EquipajeTransporte.SIN_EQUIPAJE] ?? 0;
  return [
    { concepto: 'Acompañantes', importe: redondear((suplementos.porPersona ?? 0) * (solicitud.personas ?? 1)) },
    { concepto: 'Equipaje', importe: redondear((suplementos.porMaleta ?? 0) * bultos) },
  ];
}

function lineasSuplementos(
  tarifa: TarifarioTransporte,
  solicitud: SolicitudTransporte,
  contexto: ContextoCotizacion,
): LineaDesglose[] {
  const s = tarifa.suplementos ?? {};
  const trayectos = solicitud.tipoServicio === TipoServicioTransporte.IDA_VUELTA && solicitud.vuelta ? 2 : 1;
  const lineas: LineaDesglose[] = [];

  if (esUrgente(solicitud)) lineas.push({ concepto: 'Suplemento urgente', importe: s.urgente ?? 0 });
  if (esNocturno(solicitud)) lineas.push({ concepto: 'Recogida nocturna', importe: s.nocturno ?? 0 });
  if (s.largaDistanciaDesdeKm && contexto.km >= s.largaDistanciaDesdeKm) {
    lineas.push({ concepto: 'Larga distancia', importe: s.largaDistancia ?? 0 });
  }

  const adicionales = Math.max(0, solicitud.mascotas.length - 1);
  lineas.push({ concepto: 'Mascotas adicionales', importe: (s.mascotaAdicional ?? 0) * adicionales * trayectos });

  const grandes = solicitud.mascotas.filter((m) => TAMANOS_GRANDES.includes(m.tamano)).length;
  lineas.push({ concepto: 'Mascota de talla grande', importe: (s.mascotaGrande ?? 0) * grandes * trayectos });

  if (solicitud.necesidades.includes(NecesidadTransporte.MEDICACION)) {
    lineas.push({ concepto: 'Administración de medicación', importe: s.medicacion ?? 0 });
  }
  return lineas.map((l) => ({ ...l, importe: redondear(l.importe) }));
}

function esUrgente(solicitud: SolicitudTransporte): boolean {
  return solicitud.tipoServicio === TipoServicioTransporte.URGENTE
    || solicitud.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE;
}

function esNocturno(solicitud: SolicitudTransporte): boolean {
  if (solicitud.modoHorario !== ModoHorarioTransporte.HORA_CONCRETA || !solicitud.hora) return false;
  const hora = Number(solicitud.hora.split(':')[0]);
  return Number.isFinite(hora) && (hora >= HORA_INICIO_NOCHE || hora < HORA_FIN_NOCHE);
}

/**
 * Sin hora cerrada, el transportista tiene que aceptar el viaje; el cliente
 * paga igual y, si nadie lo acepta en plazo, se le devuelve el dinero.
 */
function aceptacion(solicitud: SolicitudTransporte): Pick<CotizacionTransporte, 'requiereAceptacion' | 'plazoAceptacionMin'> {
  if (esUrgente(solicitud)) {
    return { requiereAceptacion: true, plazoAceptacionMin: PLAZO_ACEPTACION_MIN.urgente };
  }
  const sinHoraCerrada = solicitud.modoHorario === ModoHorarioTransporte.FLEXIBLE
    || solicitud.vuelta?.modo === VueltaTransporte.CUANDO_AVISE;
  return sinHoraCerrada
    ? { requiereAceptacion: true, plazoAceptacionMin: PLAZO_ACEPTACION_MIN.normal }
    : { requiereAceptacion: false };
}
