import {
  ConfigTransporte, SolicitudTransporte, AmbitoTransporte, TipoTrayecto,
  CONFIG_TRANSPORTE_DEFECTO, configDesdeLegado, tieneConfigTransporte,
} from 'shared';
import { Transporte } from './transporte.schema';

/** Hora a partir de la cual un servicio se considera nocturno. */
const HORA_NOCTURNA_DESDE = 22;
const HORA_NOCTURNA_HASTA = 7;

/**
 * Lee la configuración de tarifas de un servicio, venga del alta nueva o de la
 * antigua.
 *
 * Es el único sitio del API que sabe que existen dos formatos. Todo lo demás
 * —la estrategia, la simulación del panel, el desglose del cliente— recibe ya
 * una `ConfigTransporte` y no tiene que preguntarse de dónde salió.
 */
export function configDeServicio(servicio: Partial<Transporte>): ConfigTransporte {
  if (!tieneConfigTransporte(servicio as Partial<ConfigTransporte>)) {
    return configDesdeLegado({
      tarifaBase: servicio.tarifaBase,
      tarifaKm: servicio.tarifaKm,
      distanciaMinimaKm: servicio.distanciaMinimaKm,
      capacidadPerros: servicio.capacidadPerros,
      maxPerrosPorTrayecto: servicio.maxPerrosPorTrayecto,
      antelacionMinimaHoras: servicio.antelacionMinimaHoras,
      zonaCobertura: servicio.zonaCobertura,
      precioExclusivo: servicio.precioExclusivo,
      tarifaEsperaPorHora: servicio.tarifaEsperaPorHora,
      serviciosAdicionales: servicio.serviciosAdicionales,
    });
  }

  // Un servicio configurado puede tener huecos: el alta guarda borradores y los
  // campos que aún no se han tocado no están en el documento. Los valores por
  // defecto son los mismos que ve la empresa en el formulario.
  const base = CONFIG_TRANSPORTE_DEFECTO;
  return {
    plantilla: servicio.plantilla ?? base.plantilla,
    quienViaja: servicio.quienViaja ?? base.quienViaja,
    tiposTrayecto: servicio.tiposTrayecto?.length ? servicio.tiposTrayecto : base.tiposTrayecto,
    ambitos: servicio.ambitos?.length ? servicio.ambitos : base.ambitos,
    tipoRecogida: servicio.tipoRecogida ?? base.tipoRecogida,
    finalidades: servicio.finalidades ?? base.finalidades,

    modoCobertura: servicio.modoCobertura ?? base.modoCobertura,
    direccionBase: servicio.direccionBase,
    radioKm: servicio.radioKm ?? base.radioKm,
    distanciaMaximaKm: servicio.distanciaMaximaKm ?? null,
    municipiosCobertura: servicio.municipiosCobertura ?? servicio.zonaCobertura ?? [],
    paisesCobertura: servicio.paisesCobertura ?? [],
    puntosTrayecto: servicio.puntosTrayecto ?? base.puntosTrayecto,
    baseKilometraje: servicio.baseKilometraje ?? base.baseKilometraje,
    tipoIdaVuelta: servicio.tipoIdaVuelta ?? base.tipoIdaVuelta,
    politicaParadas: servicio.politicaParadas ?? base.politicaParadas,
    esperaIncluidaMin: servicio.esperaIncluidaMin ?? base.esperaIncluidaMin,
    politicaPeajes: servicio.politicaPeajes ?? base.politicaPeajes,

    reglasTarifa: servicio.reglasTarifa ?? [],
    redondeoDistancia: servicio.redondeoDistancia ?? base.redondeoDistancia,
    suplementos: servicio.suplementos ?? [],
    precioOrientativo: servicio.precioOrientativo,
    precioDesde: servicio.precioDesde,
    horasRespuestaPresupuesto: servicio.horasRespuestaPresupuesto,
    validezPresupuestoHoras: servicio.validezPresupuestoHoras,

    especiesAdmitidas: servicio.especiesAdmitidas ?? [],
    tamanosAdmitidos: servicio.tamanosAdmitidos ?? [],
    maxMascotasPorReserva: servicio.maxMascotasPorReserva
      ?? servicio.maxPerrosPorTrayecto ?? servicio.capacidadPerros ?? base.maxMascotasPorReserva,
    compartido: servicio.compartido ?? base.compartido,
    situacionesConfirmacion: servicio.situacionesConfirmacion ?? [],
    plazasAcompanantes: servicio.plazasAcompanantes ?? (servicio.acompananteHumano ? 1 : 0),
    precioAcompanante: servicio.precioAcompanante ?? base.precioAcompanante,
    equipajeAdmitido: servicio.equipajeAdmitido ?? [],
    equipamientoVehiculo: servicio.equipamientoVehiculo ?? servicio.caracteristicasVehiculo ?? [],
    requisitosDocumentales: servicio.requisitosDocumentales ?? [],

    modoDisponibilidad: servicio.modoDisponibilidad ?? base.modoDisponibilidad,
    antelacionMinimaHoras: servicio.antelacionMinimaHoras ?? base.antelacionMinimaHoras,
    ventanaRecogida: servicio.ventanaRecogida ?? base.ventanaRecogida,
    confirmacionHoras: servicio.confirmacionHoras ?? base.confirmacionHoras,
    frecuenciasRecurrencia: servicio.frecuenciasRecurrencia ?? [],
    periodoMaximoSemanas: servicio.periodoMaximoSemanas,
    salidas: servicio.salidas ?? [],
    respuestaUrgenteHoras: servicio.respuestaUrgenteHoras,

    politicaCancelacion: servicio.politicaCancelacionTransporte ?? base.politicaCancelacion,
    cortesiaMinutos: servicio.cortesiaMinutos ?? base.cortesiaMinutos,
    accionNoShow: servicio.accionNoShow ?? base.accionNoShow,
  };
}

/** Lee un número de los parámetros sueltos de la consulta, con valor por defecto. */
function numero(valor: unknown, porDefecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

/**
 * La distancia se lee aparte porque un número negativo **no** es un valor que
 * haya que sustituir por el defecto: es una petición mal formada, y quien la
 * recibe tiene que rechazarla con un 400 en vez de cobrar diez kilómetros que
 * nadie pidió.
 */
function distancia(valor: unknown, porDefecto: number): number {
  if (valor === undefined || valor === null) return porDefecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

/**
 * Traduce lo que el cliente ha rellenado a lo que el motor necesita saber.
 *
 * Aquí es donde se cumple la regla del producto: el cliente dice «lo necesito
 * el domingo a las 23:00 para dos perros» y de eso salen `nocturno`,
 * `finDeSemana` y `mascotas` sin que nadie le enseñe un recargo. Lo que no
 * puede deducirse se queda a cero y no cobra de más.
 */
export function solicitudDesdeParametros(
  params: { fechaInicio: Date; cantidad?: number; parametrosExtra?: Record<string, unknown> },
  distanciaPorDefectoKm: number,
): SolicitudTransporte {
  const extra = params.parametrosExtra ?? {};
  const fecha = params.fechaInicio;
  const hora = fecha.getHours();
  const diaSemana = fecha.getDay();

  const idaVuelta = extra['tipoTrayecto'] === TipoTrayecto.IDA_VUELTA
    || extra['tipoTrayecto'] === 'ida_vuelta';

  const pedidos = Array.isArray(extra['suplementos'])
    ? (extra['suplementos'] as unknown[]).filter((s): s is string => typeof s === 'string')
    // `extras` es el nombre que usaba el wizard antes de los suplementos: se
    // sigue leyendo para que una reserva a medio hacer no pierda lo elegido.
    : Array.isArray(extra['extras'])
      ? (extra['extras'] as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];

  /*
   * `exclusivo: true` es como el wizard antiguo pedía la exclusividad, antes de
   * que fuera un suplemento más del catálogo. Se traduce a su clave para que
   * una reserva en curso no deje de cobrarlo al desplegar el motor nuevo.
   */
  if (extra['exclusivo'] === true && !pedidos.includes('servicio_exclusivo')) {
    pedidos.push('servicio_exclusivo');
  }

  const ambito = texto(extra['ambito']) as AmbitoTransporte | undefined;

  return {
    distanciaKm: distancia(extra['distanciaKm'], distanciaPorDefectoKm),
    distanciaBaseRecogidaKm: numero(extra['distanciaBaseRecogidaKm']),
    distanciaDestinoBaseKm: numero(extra['distanciaDestinoBaseKm']),
    mascotas: Math.max(1, numero(extra['perros'] ?? params.cantidad, 1)),
    pasajeros: numero(extra['pasajeros']),
    paradasExtra: numero(extra['paradasExtra']),
    idaVuelta,
    esperaMinutos: numero(extra['esperaMinutos']),
    horas: numero(extra['horas']) || undefined,
    municipioOrigen: texto(extra['municipioOrigen']) ?? texto(extra['origen']),
    municipioDestino: texto(extra['municipioDestino']) ?? texto(extra['destino']),
    ambito,
    tipoTrayecto: idaVuelta ? TipoTrayecto.IDA_VUELTA
      : extra['urgente'] === true ? TipoTrayecto.URGENTE : TipoTrayecto.SOLO_IDA,
    urgente: extra['urgente'] === true,
    nocturno: hora >= HORA_NOCTURNA_DESDE || hora < HORA_NOCTURNA_HASTA,
    finDeSemana: diaSemana === 0 || diaSemana === 6,
    fueraDeZona: extra['fueraDeZona'] === true,
    aeropuertoPuerto: ambito === AmbitoTransporte.AEROPUERTO || ambito === AmbitoTransporte.PUERTO,
    suplementosPedidos: pedidos,
  };
}
