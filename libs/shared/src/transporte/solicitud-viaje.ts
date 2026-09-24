import { TamanoPerro } from '../enums/perro.enum';
import { partesEnZona } from '../fechas/zona-horaria';
import { admiteEspecie } from '../mascotas/especie';
import { ConfigTransporte } from './transporte.config';
import { LineaPrecio, SolicitudTransporte, calcularPrecioTransporte } from './transporte-precio';
import {
  AmbitoTransporte, ModoCobertura, ModoDisponibilidadTransporte, NecesidadTransporte, PlantillaTransporte,
  PoliticaCancelacionTransporte, QuienViaja, TipoRecogida, TipoTrayecto, VentanaRecogida,
} from './transporte.enums';
import {
  FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, PatronRecurrenciaTransporte, PLAZO_ACEPTACION_MIN,
  VueltaTransporte,
} from './viaje.catalogo';

/**
 * El viaje tal como lo describe el cliente en el flujo por pantallas
 * (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md) y su traducción al motor de tarifas.
 *
 * El precio NO se calcula aquí: lo calcula `calcularPrecioTransporte`, el motor
 * que también usan el alta del comercio (simulación) y el asistente de reserva.
 * Este fichero sólo traduce «de Castellón a Valencia el viernes a las 23:00 con
 * dos perros, exclusivo» a lo que el motor entiende, decide si la empresa puede
 * hacer el viaje y si tiene que aceptarlo antes.
 */

/** Un punto del viaje: elegido en el autocompletado (`placeId`) o la ubicación actual (coordenadas). */
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
export interface SolicitudViaje {
  /** Qué necesita: solo ida, ida y vuelta, recurrente, urgente, larga distancia o viajar con su mascota. */
  tipoServicio: NecesidadTransporte;
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
  /** Valores de `NECESIDADES_MASCOTA`, más `otra` con texto libre. */
  necesidades: string[];
  necesidadOtra?: string;
  /** Valor de `COMPORTAMIENTOS_MASCOTA`. */
  comportamiento?: string;
  notaTransportista?: string;
  modalidad: ModalidadTransporte;
  personas?: number;
  /** Valor de `EQUIPAJE_TRANSPORTE`. */
  equipaje?: string;
  /** Valores de `PREFERENCIAS_VIAJE`. */
  preferencias: string[];
}

/** Datos del viaje que calcula el servidor, nunca el navegador. */
export interface ContextoViaje {
  km: number;
  ciudadOrigen?: string;
  ciudadDestino?: string;
  provinciaOrigen?: string;
  provinciaDestino?: string;
  paisOrigen?: string;
  paisDestino?: string;
  /** Instante de recogida: de él salen el nocturno y el fin de semana, en hora de Madrid. */
  instanteRecogida: Date;
  /** Horas desde ahora hasta la recogida. Negativo = ya pasó. */
  horasHastaRecogida: number;
  /** Km desde la base de la empresa a la recogida y del destino a la base, si se conocen. */
  kmBaseRecogida?: number;
  kmDestinoBase?: number;
}

export type EstadoCotizacionViaje = 'precio' | 'presupuesto' | 'no_disponible';

export interface CotizacionViaje {
  estado: EstadoCotizacionViaje;
  /** Por qué no hay precio automático o no se puede hacer, en lenguaje para el cliente. */
  motivo?: string;
  /** Precio de un viaje (ida, o ida y vuelta), IVA incluido. */
  total: number;
  desglose: LineaPrecio[];
  /** El transportista tiene que aceptar el viaje: no hay hora cerrada, es urgente o lo pide su alta. */
  requiereAceptacion: boolean;
  plazoAceptacionMin?: number;
}

/** Política de cancelación en horas y porcentaje, que es lo que se le enseña al cliente. */
export interface ResumenCancelacionTransporte {
  gratisHastaHoras: number;
  reembolsoTardioPct: number;
}

const HORA_INICIO_NOCHE = 22;
const HORA_FIN_NOCHE = 7;
const MINUTOS_HORA = 60;

/** Comportamientos que el alta del comercio agrupa como «conducta reactiva». */
const COMPORTAMIENTOS_REACTIVOS = ['reactivo_perros', 'reactivo_personas'];

/** Equipaje que ocupa como un bulto especial. */
const EQUIPAJE_ESPECIAL = ['varias_maletas', 'transportin_grande'];

/** Normaliza provincias, ciudades y países para comparar «Castellón» con «castellon». */
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

/**
 * Modalidades que puede ofrecer un servicio. Cada servicio se da de alta con
 * una plantilla (exclusivo, compartido, taxi pet-friendly…); un compartido
 * que venda el suplemento «servicio exclusivo» también hace exclusivos, y quien
 * admite acompañantes también hace «viajo con mi mascota».
 */
export function modalidadesDe(config: ConfigTransporte): ModalidadTransporte[] {
  const modalidades = new Set<ModalidadTransporte>();
  const compartida = config.plantilla === PlantillaTransporte.COMPARTIDO
    || config.plantilla === PlantillaTransporte.RUTA_PROGRAMADA;

  if (compartida) modalidades.add(ModalidadTransporte.COMPARTIDO);
  else if (config.plantilla !== PlantillaTransporte.TAXI_PETFRIENDLY) modalidades.add(ModalidadTransporte.EXCLUSIVO);
  if (compartida && config.suplementos.some((s) => s.clave === 'servicio_exclusivo')) {
    modalidades.add(ModalidadTransporte.EXCLUSIVO);
  }

  const llevaPersonas = config.quienViaja !== QuienViaja.SOLO_MASCOTA && config.plazasAcompanantes > 0;
  if (config.plantilla === PlantillaTransporte.TAXI_PETFRIENDLY || llevaPersonas) {
    modalidades.add(ModalidadTransporte.CON_PROPIETARIO);
  }
  // Un taxi que lleva también a la mascota sola hace además el viaje exclusivo.
  if (config.plantilla === PlantillaTransporte.TAXI_PETFRIENDLY && config.quienViaja !== QuienViaja.MASCOTA_Y_RESPONSABLE) {
    modalidades.add(ModalidadTransporte.EXCLUSIVO);
  }
  return [...modalidades];
}

/**
 * Lo que va incluido, en el vocabulario de `PREFERENCIAS_VIAJE` para que el
 * filtro «que incluya» de los resultados compare iguales con iguales.
 */
export function incluidosDe(config: ConfigTransporte): string[] {
  const equipamiento = new Set(config.equipamientoVehiculo);
  // Los avisos de recogida y entrega los manda Doogking en todos los viajes.
  const incluidos = ['aviso_recogida', 'aviso_entrega'];
  if (equipamiento.has('climatizacion')) incluidos.push('climatizacion');
  if (equipamiento.has('gps')) incluidos.push('gps');
  if (equipamiento.has('camara')) incluidos.push('camara');
  if (equipamiento.has('habitaculos')) incluidos.push('transportin_empresa');
  if (config.tipoRecogida === TipoRecogida.PUERTA_A_PUERTA) incluidos.push('puerta_a_puerta');
  if (config.plantilla === PlantillaTransporte.ESPECIAL) incluidos.push('conductor_especializado');
  return incluidos;
}

/** La política del alta, en horas y porcentaje. */
export function resumenCancelacionDe(config: ConfigTransporte): ResumenCancelacionTransporte {
  return config.politicaCancelacion === PoliticaCancelacionTransporte.NO_REEMBOLSABLE
    ? { gratisHastaHoras: 0, reembolsoTardioPct: 0 }
    : { gratisHastaHoras: 24, reembolsoTardioPct: 0 };
}

/**
 * ¿Opera la empresa en ese viaje? Se mira con lo que declaró en el alta. Una
 * lista vacía significa «no lo ha dicho»: se le enseña igual y, si el viaje no
 * encaja en sus tarifas, el motor lo manda a presupuesto.
 */
export function cubreViaje(config: ConfigTransporte, contexto: ContextoViaje): boolean {
  const lugares = [contexto.ciudadOrigen, contexto.provinciaOrigen, contexto.ciudadDestino, contexto.provinciaDestino]
    .map(normalizarTerritorio)
    .filter(Boolean);

  switch (config.modoCobertura) {
    case ModoCobertura.RADIO:
      return !config.radioKm || contexto.kmBaseRecogida === undefined || contexto.kmBaseRecogida <= config.radioKm;
    case ModoCobertura.MUNICIPIOS:
    case ModoCobertura.PROVINCIAS: {
      const zonas = (config.municipiosCobertura ?? []).map(normalizarTerritorio).filter(Boolean);
      return !zonas.length || lugares.some((l) => zonas.includes(l));
    }
    case ModoCobertura.PAISES: {
      const paises = (config.paisesCobertura ?? []).map(normalizarTerritorio).filter(Boolean);
      const extremos = [contexto.paisOrigen, contexto.paisDestino].map(normalizarTerritorio).filter(Boolean);
      return !paises.length || extremos.some((p) => paises.includes(p));
    }
    case ModoCobertura.NACIONAL:
      return !contexto.paisOrigen || !contexto.paisDestino
        || normalizarTerritorio(contexto.paisOrigen) === normalizarTerritorio(contexto.paisDestino);
    default:
      return true;
  }
}

/** Precio y condiciones de un viaje con una empresa, en una modalidad. */
export function cotizarViaje(config: ConfigTransporte, viaje: SolicitudViaje, contexto: ContextoViaje): CotizacionViaje {
  const imposible = motivoParaRechazar(config, viaje, contexto);
  if (imposible) return sinPrecio('no_disponible', imposible);

  if (config.modoDisponibilidad === ModoDisponibilidadTransporte.SOLO_PRESUPUESTO) {
    return sinPrecio('presupuesto', 'La empresa prepara cada viaje a medida.');
  }

  const desglose = calcularPrecioTransporte(config, solicitudParaElMotor(config, viaje, contexto));
  if (desglose.requierePresupuesto) {
    return sinPrecio('presupuesto', desglose.motivoPresupuesto ?? 'Este viaje necesita un presupuesto a medida.');
  }
  return {
    estado: 'precio',
    total: desglose.total,
    desglose: [...desglose.lineas],
    ...aceptacion(config, viaje),
  };
}

function sinPrecio(estado: EstadoCotizacionViaje, motivo: string): CotizacionViaje {
  return { estado, motivo, total: 0, desglose: [], requiereAceptacion: false };
}

/** Lo que hace imposible el viaje con esta empresa, aunque se pidiera presupuesto. */
function motivoParaRechazar(config: ConfigTransporte, viaje: SolicitudViaje, contexto: ContextoViaje): string | null {
  if (!modalidadesDe(config).includes(viaje.modalidad)) return 'Esta empresa no ofrece esa modalidad de viaje.';
  if (viaje.mascotas.some((m) => !admiteEspecie(config.especiesAdmitidas, m.especie))) {
    return 'Esta empresa no traslada ese tipo de animal.';
  }
  if (config.maxMascotasPorReserva > 0 && viaje.mascotas.length > config.maxMascotasPorReserva) {
    return `Esta empresa lleva como máximo ${config.maxMascotasPorReserva} mascota(s) por viaje.`;
  }
  const personas = viaje.modalidad === ModalidadTransporte.CON_PROPIETARIO ? Math.max(1, viaje.personas ?? 1) : 0;
  if (personas > config.plazasAcompanantes) return 'Esta empresa no tiene plazas para tantos acompañantes.';

  const trayecto = tipoTrayectoDe(viaje);
  if (config.tiposTrayecto.length && !config.tiposTrayecto.includes(trayecto)) {
    return 'Esta empresa no hace ese tipo de trayecto.';
  }
  return motivoDeHorario(config, viaje, contexto);
}

function motivoDeHorario(config: ConfigTransporte, viaje: SolicitudViaje, contexto: ContextoViaje): string | null {
  // Lo urgente y «lo antes posible» se piden precisamente para ya: la antelación
  // no aplica, la resuelve el transportista al aceptar o rechazar.
  if (esUrgente(viaje)) return null;
  if (contexto.horasHastaRecogida < 0) return 'La hora de recogida ya ha pasado.';

  // Como en el asistente de reserva: la antelación sólo se exige a quien
  // trabaja con calendario; un servicio bajo demanda existe para el último aviso.
  const exigeAntelacion = config.modoDisponibilidad === ModoDisponibilidadTransporte.CALENDARIO
    || config.modoDisponibilidad === ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS;
  if (exigeAntelacion && config.antelacionMinimaHoras > 0 && contexto.horasHastaRecogida < config.antelacionMinimaHoras) {
    return `Esta empresa necesita reservar con ${config.antelacionMinimaHoras} h de antelación.`;
  }
  return null;
}

function tipoTrayectoDe(viaje: SolicitudViaje): TipoTrayecto {
  switch (viaje.tipoServicio) {
    case NecesidadTransporte.IDA_VUELTA: return TipoTrayecto.IDA_VUELTA;
    case NecesidadTransporte.RECURRENTE: return TipoTrayecto.RECURRENTE;
    case NecesidadTransporte.URGENTE: return TipoTrayecto.URGENTE;
    default: return viaje.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE ? TipoTrayecto.URGENTE : TipoTrayecto.SOLO_IDA;
  }
}

function ambitoDe(contexto: ContextoViaje): AmbitoTransporte | undefined {
  const igual = (a?: string, b?: string): boolean => !!a && !!b && normalizarTerritorio(a) === normalizarTerritorio(b);
  if (contexto.paisOrigen && contexto.paisDestino && !igual(contexto.paisOrigen, contexto.paisDestino)) {
    return AmbitoTransporte.INTERNACIONAL;
  }
  if (contexto.provinciaOrigen && contexto.provinciaDestino && !igual(contexto.provinciaOrigen, contexto.provinciaDestino)) {
    return AmbitoTransporte.NACIONAL;
  }
  if (contexto.ciudadOrigen && contexto.ciudadDestino && !igual(contexto.ciudadOrigen, contexto.ciudadDestino)) {
    return AmbitoTransporte.PROVINCIAL;
  }
  return contexto.ciudadOrigen ? AmbitoTransporte.LOCAL : undefined;
}

/** Lo que el motor necesita saber de este viaje. Los suplementos «a petición» que el cliente implica sin nombrarlos. */
function solicitudParaElMotor(config: ConfigTransporte, viaje: SolicitudViaje, contexto: ContextoViaje): SolicitudTransporte {
  const partes = partesEnZona(contexto.instanteRecogida);
  const conHora = viaje.modoHorario === ModoHorarioTransporte.HORA_CONCRETA;
  const idaVuelta = viaje.tipoServicio === NecesidadTransporte.IDA_VUELTA && !!viaje.vuelta;
  const compartida = config.plantilla === PlantillaTransporte.COMPARTIDO || config.plantilla === PlantillaTransporte.RUTA_PROGRAMADA;

  const pedidos: string[] = [];
  if (viaje.modalidad === ModalidadTransporte.EXCLUSIVO && compartida) pedidos.push('servicio_exclusivo');
  if (viaje.necesidades.includes('medicacion')) pedidos.push('medicacion');
  if (viaje.preferencias.includes('transportin_empresa')) pedidos.push('transportin_empresa');
  if (viaje.equipaje && EQUIPAJE_ESPECIAL.includes(viaje.equipaje)) pedidos.push('equipaje_especial');

  const ambito = ambitoDe(contexto);
  return {
    distanciaKm: contexto.km,
    distanciaBaseRecogidaKm: contexto.kmBaseRecogida,
    distanciaDestinoBaseKm: contexto.kmDestinoBase,
    mascotas: viaje.mascotas.length,
    pasajeros: viaje.modalidad === ModalidadTransporte.CON_PROPIETARIO ? Math.max(1, viaje.personas ?? 1) : 0,
    paradasExtra: 0,
    idaVuelta,
    esperaMinutos: idaVuelta && viaje.vuelta?.modo === VueltaTransporte.TRAS_HORAS
      ? Math.max(0, viaje.vuelta.horas ?? 0) * MINUTOS_HORA
      : 0,
    municipioOrigen: contexto.ciudadOrigen,
    municipioDestino: contexto.ciudadDestino,
    ambito,
    tipoTrayecto: tipoTrayectoDe(viaje),
    urgente: esUrgente(viaje),
    nocturno: conHora && (partes.hora >= HORA_INICIO_NOCHE || partes.hora < HORA_FIN_NOCHE),
    finDeSemana: partes.diaSemana === 0 || partes.diaSemana === 6,
    fueraDeZona: false,
    aeropuertoPuerto: ambito === AmbitoTransporte.AEROPUERTO || ambito === AmbitoTransporte.PUERTO,
    suplementosPedidos: pedidos,
  };
}

function esUrgente(viaje: SolicitudViaje): boolean {
  return viaje.tipoServicio === NecesidadTransporte.URGENTE || viaje.modoHorario === ModoHorarioTransporte.LO_ANTES_POSIBLE;
}

/**
 * ¿Tiene que aceptar el viaje la empresa? Sí cuando no hay hora cerrada o es
 * urgente, y también cuando lo pide su alta: confirma siempre, o confirma las
 * situaciones que marcó (medicación, conducta reactiva…). El cliente paga
 * igual; si nadie acepta a tiempo, se le devuelve el dinero.
 */
function aceptacion(config: ConfigTransporte, viaje: SolicitudViaje): Pick<CotizacionViaje, 'requiereAceptacion' | 'plazoAceptacionMin'> {
  if (esUrgente(viaje)) {
    const horas = config.respuestaUrgenteHoras;
    return { requiereAceptacion: true, plazoAceptacionMin: horas ? horas * MINUTOS_HORA : PLAZO_ACEPTACION_MIN.urgente };
  }

  const situaciones = new Set([
    ...viaje.necesidades,
    ...(viaje.comportamiento && COMPORTAMIENTOS_REACTIVOS.includes(viaje.comportamiento) ? ['conducta_reactiva'] : []),
  ]);
  const pideSuAlta = config.confirmacionHoras > 0
    || config.ventanaRecogida === VentanaRecogida.CONFIRMA_EMPRESA
    || config.situacionesConfirmacion.some((s) => situaciones.has(s));
  const sinHoraCerrada = viaje.modoHorario === ModoHorarioTransporte.FLEXIBLE
    || viaje.vuelta?.modo === VueltaTransporte.CUANDO_AVISE;

  if (!pideSuAlta && !sinHoraCerrada) return { requiereAceptacion: false };
  return {
    requiereAceptacion: true,
    plazoAceptacionMin: config.confirmacionHoras > 0 ? config.confirmacionHoras * MINUTOS_HORA : PLAZO_ACEPTACION_MIN.normal,
  };
}
