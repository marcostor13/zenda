import {
  ConfigTransporte, ReglaTarifa, SuplementoTransporte, TramoDistancia,
} from './transporte.config';
import {
  AmbitoTransporte, AplicacionSuplemento, BaseKilometraje, CondicionSuplemento,
  FormaCalculoSuplemento, ModeloPrecio, RedondeoDistancia, TipoTrayecto, UnidadCobro,
} from './transporte.enums';

/**
 * Lo que el cliente ha pedido, ya traducido a números.
 *
 * Nada de esto se le pregunta con estas palabras: el wizard habla de «¿cuándo
 * lo necesitas?» y «¿quién viaja?», y aquí llega lo que de eso afecta al
 * precio. Esa traducción es el trabajo de Doogking, y el motivo de que el
 * cliente no tenga que entender el sistema tarifario de cada empresa.
 */
export interface SolicitudTransporte {
  /** Distancia del trayecto del cliente, recogida → destino. */
  readonly distanciaKm: number;
  /** Base de la empresa → recogida. Solo la usan algunas políticas de km. */
  readonly distanciaBaseRecogidaKm?: number;
  /** Destino → base de la empresa. Idem. */
  readonly distanciaDestinoBaseKm?: number;

  readonly mascotas: number;
  readonly pasajeros: number;
  readonly paradasExtra: number;
  readonly idaVuelta: boolean;
  readonly esperaMinutos: number;
  /** Horas contratadas; solo para el modelo por hora. */
  readonly horas?: number;

  readonly municipioOrigen?: string;
  readonly municipioDestino?: string;
  readonly ambito?: AmbitoTransporte;
  readonly tipoTrayecto?: TipoTrayecto;

  readonly urgente?: boolean;
  readonly nocturno?: boolean;
  readonly finDeSemana?: boolean;
  readonly fueraDeZona?: boolean;
  readonly aeropuertoPuerto?: boolean;

  /** Claves de suplementos «a petición» que el cliente ha marcado. */
  readonly suplementosPedidos?: readonly string[];
}

/** Una línea del desglose que ve el cliente antes de pagar. */
export interface LineaPrecio {
  readonly concepto: string;
  readonly importe: number;
}

export interface DesglosePrecioTransporte {
  /** `true` cuando ninguna regla puede cerrar un precio: se abre presupuesto. */
  readonly requierePresupuesto: boolean;
  readonly motivoPresupuesto?: string;
  readonly reglaAplicada?: string;
  readonly modelo?: ModeloPrecio;
  readonly distanciaKm: number;
  readonly kmFacturables: number;
  readonly lineas: readonly LineaPrecio[];
  readonly servicio: number;
  readonly suplementos: number;
  readonly total: number;
  readonly minimoAplicado: boolean;
}

const MINUTOS_HORA = 60;

/** Céntimos, no coma flotante: el desglose tiene que cuadrar con el cobro. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Aplica la política de redondeo de distancia que declaró la empresa. */
export function redondearDistancia(km: number, modo: RedondeoDistancia): number {
  if (km <= 0) return 0;
  switch (modo) {
    case RedondeoDistancia.KM_SUPERIOR: return Math.ceil(km);
    case RedondeoDistancia.BLOQUES_5: return Math.ceil(km / 5) * 5;
    case RedondeoDistancia.BLOQUES_10: return Math.ceil(km / 10) * 10;
    default: return redondear(km);
  }
}

/**
 * Kilómetros que se facturan, que no son los que recorre la mascota.
 *
 * Quien sale de una base a 40 km de la recogida hace 80 km que nadie ve en el
 * mapa del cliente; quien trabaja dentro de una ciudad no quiere cobrar el
 * regreso en vacío. Por eso la empresa elige la política y Doogking enseña
 * siempre las dos cifras: distancia del trayecto y kilómetros facturables.
 */
export function calcularKmFacturables(
  config: Pick<ConfigTransporte, 'baseKilometraje' | 'redondeoDistancia'>,
  solicitud: Pick<SolicitudTransporte, 'distanciaKm' | 'distanciaBaseRecogidaKm' | 'distanciaDestinoBaseKm' | 'idaVuelta'>,
): number {
  const trayecto = Math.max(0, solicitud.distanciaKm);
  const baseRecogida = Math.max(0, solicitud.distanciaBaseRecogidaKm ?? 0);
  const destinoBase = Math.max(0, solicitud.distanciaDestinoBaseKm ?? 0);

  let km: number;
  switch (config.baseKilometraje) {
    case BaseKilometraje.BASE_RECOGIDA_DESTINO:
      km = baseRecogida + trayecto;
      break;
    case BaseKilometraje.CIRCUITO_COMPLETO:
      km = baseRecogida + trayecto + destinoBase;
      break;
    // Cada tramo por separado suma lo mismo que el circuito completo; la
    // diferencia está en cómo se enseña en la factura, no en lo que se cobra.
    case BaseKilometraje.TRAMOS_SEPARADOS:
      km = baseRecogida + trayecto + destinoBase;
      break;
    default:
      km = trayecto;
  }

  // La ida y vuelta duplica el trayecto del cliente, no los desplazamientos de
  // la empresa hasta la base: esos ya se han contado una vez arriba.
  if (solicitud.idaVuelta) km += trayecto;

  return redondearDistancia(km, config.redondeoDistancia);
}

/** ¿Encaja esta regla con lo que se pide? El orden de la lista decide el resto. */
function reglaAplica(regla: ReglaTarifa, solicitud: SolicitudTransporte, kmFacturables: number): boolean {
  if (regla.ambitos?.length && solicitud.ambito && !regla.ambitos.includes(solicitud.ambito)) {
    return false;
  }
  if (regla.tiposTrayecto?.length && solicitud.tipoTrayecto
      && !regla.tiposTrayecto.includes(solicitud.tipoTrayecto)) {
    return false;
  }
  if (regla.modelo === ModeloPrecio.ZONA) {
    return cubreZona(regla.zonas ?? [], solicitud);
  }
  if (regla.modelo === ModeloPrecio.RUTA_FIJA) {
    return coincideRuta(regla, solicitud);
  }
  if (regla.modelo === ModeloPrecio.TRAMOS) {
    return !!tramoDe(regla.tramos ?? [], kmFacturables);
  }
  return true;
}

/** Sin acentos ni mayúsculas: «Castellón» y «castellon» son el mismo municipio. */
function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Una zona cubre el trayecto cuando el origen está dentro.
 *
 * Es el origen y no el destino porque la zona describe dónde recoge la empresa:
 * «25 € en Castellón ciudad» es una tarifa urbana, y exigir que también el
 * destino esté en la zona dejaría sin precio el viaje de Castellón a Valencia,
 * que es exactamente el que se quiere cobrar por km.
 */
function cubreZona(zonas: readonly string[], solicitud: SolicitudTransporte): boolean {
  if (!zonas.length) return false;
  const origen = solicitud.municipioOrigen ? normalizar(solicitud.municipioOrigen) : '';
  if (!origen) return false;
  return zonas.some((z) => {
    const zona = normalizar(z);
    return origen === zona || origen.includes(zona) || zona.includes(origen);
  });
}

function coincideRuta(regla: ReglaTarifa, solicitud: SolicitudTransporte): boolean {
  if (!regla.rutaOrigen || !regla.rutaDestino) return false;
  if (!solicitud.municipioOrigen || !solicitud.municipioDestino) return false;
  const origen = normalizar(solicitud.municipioOrigen);
  const destino = normalizar(solicitud.municipioDestino);
  const rutaOrigen = normalizar(regla.rutaOrigen);
  const rutaDestino = normalizar(regla.rutaDestino);
  const directa = origen.includes(rutaOrigen) && destino.includes(rutaDestino);
  // La vuelta de una ruta fija es la misma ruta: Madrid→Barcelona vale para
  // Barcelona→Madrid, o habría que dar de alta cada sentido por separado.
  const inversa = origen.includes(rutaDestino) && destino.includes(rutaOrigen);
  return directa || inversa;
}

function tramoDe(tramos: readonly TramoDistancia[], km: number): TramoDistancia | undefined {
  return tramos.find((t) => km >= t.desdeKm && (t.hastaKm === null || km <= t.hastaKm));
}

/** Multiplicador de la unidad de cobro que declaró la empresa. */
function unidades(unidad: UnidadCobro, solicitud: SolicitudTransporte): number {
  switch (unidad) {
    case UnidadCobro.MASCOTA:
    case UnidadCobro.PLAZA:
      return Math.max(1, solicitud.mascotas);
    case UnidadCobro.PERSONA_Y_MASCOTA:
      return Math.max(1, solicitud.mascotas + Math.max(0, solicitud.pasajeros));
    case UnidadCobro.TRAYECTO:
      return solicitud.idaVuelta ? 2 : 1;
    case UnidadCobro.HORA:
      return Math.max(1, solicitud.horas ?? 1);
    default:
      return 1;
  }
}

/** Importe de la regla antes de unidades, mínimos y suplementos. */
function importeDeRegla(
  regla: ReglaTarifa,
  solicitud: SolicitudTransporte,
  kmFacturables: number,
): number | null {
  switch (regla.modelo) {
    case ModeloPrecio.FIJO:
    case ModeloPrecio.ZONA: {
      const ida = regla.precioIda ?? 0;
      if (!solicitud.idaVuelta) return ida;
      // Sin precio propio de ida y vuelta se cobra el doble de la ida: es lo
      // que espera quien solo ha rellenado un importe.
      return regla.precioIdaVuelta ?? ida * 2;
    }
    case ModeloPrecio.KM:
      return (regla.precioKm ?? 0) * kmFacturables;
    case ModeloPrecio.BASE_MAS_KM:
      return (regla.tarifaSalida ?? 0) + (regla.precioKm ?? 0) * kmFacturables;
    case ModeloPrecio.TRAMOS: {
      const tramo = tramoDe(regla.tramos ?? [], kmFacturables);
      return tramo ? tramo.precioKm * kmFacturables : null;
    }
    case ModeloPrecio.HORA: {
      const minimo = regla.duracionMinimaHoras ?? 1;
      const pedidas = Math.max(minimo, solicitud.horas ?? minimo);
      const fraccion = regla.fraccionMinutos ?? MINUTOS_HORA;
      // Pasado el mínimo se cobra por fracciones, no por horas enteras: es lo
      // que distingue «1 h y 10 minutos» de «2 horas» en la factura.
      const extra = Math.max(0, pedidas - minimo);
      const fracciones = Math.ceil((extra * MINUTOS_HORA) / fraccion);
      return (regla.precioHora ?? 0) * minimo
        + (regla.precioHora ?? 0) * (fracciones * fraccion) / MINUTOS_HORA;
    }
    case ModeloPrecio.RUTA_FIJA:
      return regla.precioRuta ?? 0;
    default:
      return null;
  }
}

/** ¿Se cumple la condición de este suplemento automático? */
function condicionCumplida(suplemento: SuplementoTransporte, solicitud: SolicitudTransporte): boolean {
  switch (suplemento.condicion) {
    case CondicionSuplemento.SIEMPRE: return true;
    case CondicionSuplemento.MASCOTA_ADICIONAL: return solicitud.mascotas > 1;
    case CondicionSuplemento.PASAJERO_ADICIONAL: return solicitud.pasajeros > 1;
    case CondicionSuplemento.URGENCIA: return !!solicitud.urgente;
    case CondicionSuplemento.NOCTURNO: return !!solicitud.nocturno;
    case CondicionSuplemento.FIN_DE_SEMANA: return !!solicitud.finDeSemana;
    case CondicionSuplemento.PARADA_ADICIONAL: return solicitud.paradasExtra > 0;
    case CondicionSuplemento.ESPERA: return solicitud.esperaMinutos > 0;
    case CondicionSuplemento.FUERA_DE_ZONA: return !!solicitud.fueraDeZona;
    case CondicionSuplemento.AEROPUERTO_PUERTO: return !!solicitud.aeropuertoPuerto;
    default: return false;
  }
}

/**
 * Cuánto suma un suplemento.
 *
 * Los que se cobran «por» algo (mascota, pasajero) cuentan las unidades
 * **adicionales**: un suplemento de 10 € por mascota adicional con tres
 * mascotas son 20 €, no 30 €. Cobrarlo por todas convertiría el primer animal
 * en un recargo sobre un precio que ya lo incluía.
 */
function importeSuplemento(
  suplemento: SuplementoTransporte,
  solicitud: SolicitudTransporte,
  base: number,
  kmFacturables: number,
  esperaFacturable: number,
): number {
  switch (suplemento.forma) {
    case FormaCalculoSuplemento.PORCENTAJE:
      return base * (suplemento.importe / 100);
    case FormaCalculoSuplemento.POR_KM:
      return suplemento.importe * kmFacturables;
    case FormaCalculoSuplemento.POR_HORA:
      return suplemento.importe * (esperaFacturable / MINUTOS_HORA);
    case FormaCalculoSuplemento.POR_MASCOTA:
      return suplemento.condicion === CondicionSuplemento.MASCOTA_ADICIONAL
        ? suplemento.importe * Math.max(0, solicitud.mascotas - 1)
        : suplemento.importe * Math.max(1, solicitud.mascotas);
    case FormaCalculoSuplemento.POR_PASAJERO:
      return suplemento.condicion === CondicionSuplemento.PASAJERO_ADICIONAL
        ? suplemento.importe * Math.max(0, solicitud.pasajeros - 1)
        : suplemento.importe * Math.max(0, solicitud.pasajeros);
    case FormaCalculoSuplemento.POR_PARADA:
      return suplemento.importe * Math.max(0, solicitud.paradasExtra);
    default:
      return suplemento.importe;
  }
}

/** Sin precio cerrado posible: el cliente pedirá presupuesto sin rellenar nada más. */
function soloPresupuesto(motivo: string, distanciaKm: number, kmFacturables: number): DesglosePrecioTransporte {
  return {
    requierePresupuesto: true,
    motivoPresupuesto: motivo,
    distanciaKm,
    kmFacturables,
    lineas: [],
    servicio: 0,
    suplementos: 0,
    total: 0,
    minimoAplicado: false,
  };
}

/**
 * Calcula lo que cuesta un trayecto con la configuración de una empresa.
 *
 * Es la única fuente del precio del vertical: la usa el API para cobrar y el
 * frontend para enseñar el desglose, así que el resumen del wizard y el cargo
 * de Stripe no pueden discrepar. Devuelve siempre un desglose línea a línea
 * porque el cliente tiene derecho a ver **precio final antes de pagar**, y una
 * cifra sola no se puede discutir en una incidencia.
 */
export function calcularPrecioTransporte(
  config: ConfigTransporte,
  solicitud: SolicitudTransporte,
): DesglosePrecioTransporte {
  const distanciaKm = redondear(Math.max(0, solicitud.distanciaKm));
  const kmFacturables = calcularKmFacturables(config, solicitud);

  if (config.distanciaMaximaKm && distanciaKm > config.distanciaMaximaKm) {
    return soloPresupuesto(
      `El trayecto supera los ${config.distanciaMaximaKm} km que cubre este servicio.`,
      distanciaKm, kmFacturables,
    );
  }

  const candidata = config.reglasTarifa.find((r) => reglaAplica(r, solicitud, kmFacturables));

  if (!candidata) {
    return soloPresupuesto(
      'Este trayecto no encaja en ninguna tarifa publicada.',
      distanciaKm, kmFacturables,
    );
  }
  if (candidata.modelo === ModeloPrecio.PRESUPUESTO) {
    return soloPresupuesto(
      'La empresa calcula este servicio a medida.',
      distanciaKm, kmFacturables,
    );
  }

  const importeUnitario = importeDeRegla(candidata, solicitud, kmFacturables);
  if (importeUnitario === null) {
    return soloPresupuesto(
      'Este trayecto no encaja en ninguna tarifa publicada.',
      distanciaKm, kmFacturables,
    );
  }

  const multiplicador = unidades(candidata.unidadCobro, solicitud);
  const bruto = importeUnitario * multiplicador;
  const minimo = candidata.importeMinimo ?? 0;
  const minimoAplicado = minimo > 0 && bruto < minimo;
  const servicio = redondear(minimoAplicado ? minimo : bruto);

  const lineas: LineaPrecio[] = [{ concepto: candidata.nombre, importe: servicio }];

  // La espera incluida no se cobra: es el margen que la empresa regala para no
  // penalizar al cliente por una consulta que se alarga cinco minutos.
  const esperaFacturable = Math.max(0, solicitud.esperaMinutos - config.esperaIncluidaMin);
  const pedidos = new Set(solicitud.suplementosPedidos ?? []);

  let suplementos = 0;
  for (const suplemento of config.suplementos) {
    if (suplemento.aplicacion === AplicacionSuplemento.CONFIRMA_EMPRESA) continue;
    const activo = suplemento.aplicacion === AplicacionSuplemento.A_PETICION
      ? pedidos.has(suplemento.clave)
      : condicionCumplida(suplemento, solicitud);
    if (!activo) continue;

    const importe = redondear(
      importeSuplemento(suplemento, solicitud, servicio, kmFacturables, esperaFacturable),
    );
    if (importe <= 0) continue;
    lineas.push({ concepto: suplemento.nombre, importe });
    suplementos += importe;
  }

  suplementos = redondear(suplementos);

  return {
    requierePresupuesto: false,
    reglaAplicada: candidata.nombre,
    modelo: candidata.modelo,
    distanciaKm,
    kmFacturables,
    lineas,
    servicio,
    suplementos,
    total: redondear(servicio + suplementos),
    minimoAplicado,
  };
}

/**
 * Precio «desde» de un servicio, para la tarjeta del listado.
 *
 * Es el trayecto corto más barato que puede salir de sus reglas, no una media:
 * en una tarjeta el cliente lee un número y decide si abre la ficha, y prometer
 * menos de lo que costará es la forma más rápida de perderlo en el paso de
 * pago.
 */
export function precioDesdeTransporte(config: ConfigTransporte, kmReferencia = 10): number {
  const precios = config.reglasTarifa
    .filter((r) => r.modelo !== ModeloPrecio.PRESUPUESTO)
    .map((regla) => {
      const km = redondearDistancia(kmReferencia, config.redondeoDistancia);
      const importe = importeDeRegla(regla, {
        distanciaKm: kmReferencia, mascotas: 1, pasajeros: 0, paradasExtra: 0,
        idaVuelta: false, esperaMinutos: 0, horas: regla.duracionMinimaHoras ?? 1,
      }, km);
      if (importe === null) return null;
      return Math.max(importe, regla.importeMinimo ?? 0);
    })
    .filter((p): p is number => p !== null && p > 0);

  return precios.length ? redondear(Math.min(...precios)) : 0;
}
