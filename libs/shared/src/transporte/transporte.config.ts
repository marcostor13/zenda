import {
  AccionNoShow, AmbitoTransporte, AplicacionSuplemento, BaseKilometraje,
  CompartidoTransporte, CondicionSuplemento, ExigenciaRequisito, FinalidadTransporte,
  FormaCalculoSuplemento, FrecuenciaRecurrencia, ModeloPrecio, ModoCobertura,
  ModoDisponibilidadTransporte, PlantillaTransporte, PoliticaCancelacionTransporte,
  PoliticaParadas, PoliticaPeajes, PrecioAcompanante, PrecioOrientativo, PuntosTrayecto,
  QuienViaja, RedondeoDistancia, TipoIdaVuelta, TipoRecogida, TipoTrayecto, UnidadCobro,
  VentanaRecogida,
} from './transporte.enums';

/**
 * Cómo cobra una empresa un trayecto concreto.
 *
 * Es una **lista ordenada**: el motor aplica la primera regla que encaja con la
 * zona, la distancia y el tipo de trayecto pedidos. Así una misma empresa puede
 * tener «25 € en Castellón ciudad, 0,85 €/km en la provincia y 95 € al
 * aeropuerto de Valencia» sin que el cliente vea nunca esa mecánica.
 *
 * Cada regla usa solo los campos de su `modelo`; el resto se ignoran. Es más
 * feo que una unión discriminada, pero es lo que sobrevive a un documento de
 * Mongo sin `__typename` y a un formulario reactivo que cambia de modelo sin
 * perder lo ya escrito.
 */
export interface ReglaTarifa {
  readonly id: string;
  readonly nombre: string;
  readonly modelo: ModeloPrecio;
  readonly unidadCobro: UnidadCobro;

  /** Municipios o códigos postales a los que se limita (modelo `zona`). */
  readonly zonas?: readonly string[];
  /** Ámbitos a los que se limita. Vacío = cualquiera. */
  readonly ambitos?: readonly AmbitoTransporte[];
  /** Tipos de trayecto a los que se limita. Vacío = cualquiera. */
  readonly tiposTrayecto?: readonly TipoTrayecto[];

  /** `fijo` y `zona`: importe de solo ida. */
  readonly precioIda?: number;
  /** `fijo` y `zona`: importe de ida y vuelta, si no es el doble del de ida. */
  readonly precioIdaVuelta?: number;
  /** `fijo` y `zona`: mascotas incluidas antes de aplicar suplementos. */
  readonly mascotasIncluidas?: number;

  /** `km` y `base_mas_km`. */
  readonly precioKm?: number;
  /** `base_mas_km`: tarifa de salida que se cobra además de los km. */
  readonly tarifaSalida?: number;

  /** `tramos`: escalones de distancia, de menor a mayor. */
  readonly tramos?: readonly TramoDistancia[];

  /** `hora`. */
  readonly precioHora?: number;
  readonly duracionMinimaHoras?: number;
  /** Minutos de la fracción que se cobra pasada la duración mínima. */
  readonly fraccionMinutos?: number;

  /** `ruta_fija`. */
  readonly rutaOrigen?: string;
  readonly rutaDestino?: string;
  readonly precioRuta?: number;

  /** Suelo de la regla: por debajo se cobra este importe. */
  readonly importeMinimo?: number;
}

export interface TramoDistancia {
  readonly desdeKm: number;
  /** `null` = sin límite superior. */
  readonly hastaKm: number | null;
  readonly precioKm: number;
}

/** Un suplemento configurado por la empresa sobre el catálogo cerrado. */
export interface SuplementoTransporte {
  readonly clave: string;
  readonly nombre: string;
  readonly condicion: CondicionSuplemento;
  readonly forma: FormaCalculoSuplemento;
  readonly importe: number;
  readonly aplicacion: AplicacionSuplemento;
}

/** Documento que la empresa exige de la mascota, y cuándo lo exige. */
export interface RequisitoDocumental {
  readonly clave: string;
  readonly exigencia: ExigenciaRequisito;
}

/** Una salida concreta de una ruta programada, con sus plazas. */
export interface SalidaProgramada {
  readonly id: string;
  readonly fechaSalida: string;
  readonly paradas: readonly string[];
  readonly plazasTotales: number;
  readonly plazasOcupadas: number;
  /** Horas antes de la salida en que dejan de admitirse reservas. */
  readonly cierreHoras: number;
}

/**
 * Todo lo que una empresa declara sobre un servicio de transporte de mascotas.
 *
 * Es el contrato entre las tres capas: el alta lo rellena, el motor de tarifas
 * lo lee y el wizard del cliente decide con él qué preguntar. Todo es opcional
 * salvo `reglasTarifa`, porque el alta guarda borradores a medio hacer y porque
 * los servicios dados de alta antes de esta pantalla siguen existiendo: para
 * ellos, `configDesdeLegado()` construye la configuración equivalente.
 */
export interface ConfigTransporte {
  // 1 · Tipo
  readonly plantilla: PlantillaTransporte;
  readonly quienViaja: QuienViaja;
  readonly tiposTrayecto: readonly TipoTrayecto[];
  readonly ambitos: readonly AmbitoTransporte[];
  readonly tipoRecogida: TipoRecogida;
  readonly finalidades: readonly FinalidadTransporte[];

  // 2 · Cobertura
  readonly modoCobertura: ModoCobertura;
  readonly direccionBase?: string;
  readonly radioKm?: number;
  readonly distanciaMaximaKm?: number | null;
  readonly municipiosCobertura?: readonly string[];
  readonly paisesCobertura?: readonly string[];
  readonly puntosTrayecto: PuntosTrayecto;
  readonly baseKilometraje: BaseKilometraje;
  readonly tipoIdaVuelta: TipoIdaVuelta;
  readonly politicaParadas: PoliticaParadas;
  readonly esperaIncluidaMin: number;
  readonly politicaPeajes: PoliticaPeajes;

  // 3 · Precio
  readonly reglasTarifa: readonly ReglaTarifa[];
  readonly redondeoDistancia: RedondeoDistancia;
  readonly suplementos: readonly SuplementoTransporte[];
  readonly precioOrientativo?: PrecioOrientativo;
  readonly precioDesde?: number;
  readonly horasRespuestaPresupuesto?: number;
  readonly validezPresupuestoHoras?: number;

  // 4 · Mascotas y vehículo
  readonly especiesAdmitidas: readonly string[];
  readonly tamanosAdmitidos: readonly string[];
  readonly maxMascotasPorReserva: number;
  readonly compartido: CompartidoTransporte;
  readonly situacionesConfirmacion: readonly string[];
  readonly plazasAcompanantes: number;
  readonly precioAcompanante: PrecioAcompanante;
  readonly equipajeAdmitido: readonly string[];
  readonly equipamientoVehiculo: readonly string[];
  readonly requisitosDocumentales: readonly RequisitoDocumental[];

  // 5 · Disponibilidad
  readonly modoDisponibilidad: ModoDisponibilidadTransporte;
  readonly antelacionMinimaHoras: number;
  readonly ventanaRecogida: VentanaRecogida;
  /** Horas que tarda la empresa en confirmar. 0 = confirmación inmediata. */
  readonly confirmacionHoras: number;
  readonly frecuenciasRecurrencia: readonly FrecuenciaRecurrencia[];
  readonly periodoMaximoSemanas?: number;
  readonly salidas: readonly SalidaProgramada[];
  readonly respuestaUrgenteHoras?: number;

  // 6 · Condiciones
  readonly politicaCancelacion: PoliticaCancelacionTransporte;
  readonly cortesiaMinutos: number;
  readonly accionNoShow: AccionNoShow;
}

/** Valores por defecto de un alta nueva: lo que hace la mayoría de empresas. */
export const CONFIG_TRANSPORTE_DEFECTO: ConfigTransporte = {
  plantilla: PlantillaTransporte.EXCLUSIVO,
  quienViaja: QuienViaja.SOLO_MASCOTA,
  tiposTrayecto: [TipoTrayecto.SOLO_IDA, TipoTrayecto.IDA_VUELTA],
  ambitos: [AmbitoTransporte.LOCAL, AmbitoTransporte.PROVINCIAL],
  tipoRecogida: TipoRecogida.PUERTA_A_PUERTA,
  finalidades: [FinalidadTransporte.CUALQUIERA],

  modoCobertura: ModoCobertura.RADIO,
  radioKm: 50,
  distanciaMaximaKm: null,
  municipiosCobertura: [],
  paisesCobertura: [],
  puntosTrayecto: PuntosTrayecto.LIBRES,
  baseKilometraje: BaseKilometraje.RECOGIDA_DESTINO,
  tipoIdaVuelta: TipoIdaVuelta.ESPERA_MISMO_DIA,
  politicaParadas: PoliticaParadas.CON_SUPLEMENTO,
  esperaIncluidaMin: 30,
  politicaPeajes: PoliticaPeajes.INCLUIDOS,

  reglasTarifa: [],
  redondeoDistancia: RedondeoDistancia.KM_SUPERIOR,
  suplementos: [],

  especiesAdmitidas: ['Perro', 'Gato'],
  tamanosAdmitidos: [],
  maxMascotasPorReserva: 3,
  compartido: CompartidoTransporte.MISMA_FAMILIA,
  situacionesConfirmacion: [],
  plazasAcompanantes: 1,
  precioAcompanante: PrecioAcompanante.INCLUIDO,
  equipajeAdmitido: ['bolso'],
  equipamientoVehiculo: ['climatizacion', 'habitaculos', 'anclajes'],
  requisitosDocumentales: [],

  modoDisponibilidad: ModoDisponibilidadTransporte.CALENDARIO,
  antelacionMinimaHoras: 24,
  ventanaRecogida: VentanaRecogida.FRANJA_60,
  confirmacionHoras: 0,
  frecuenciasRecurrencia: [],
  salidas: [],

  politicaCancelacion: PoliticaCancelacionTransporte.ESTANDAR,
  cortesiaMinutos: 15,
  accionNoShow: AccionNoShow.COBRO_COMPLETO,
};

/** Los campos mínimos de un servicio dado de alta con el formulario antiguo. */
export interface TransporteLegado {
  readonly tarifaBase?: number;
  readonly tarifaKm?: number;
  readonly distanciaMinimaKm?: number;
  readonly capacidadPerros?: number;
  readonly maxPerrosPorTrayecto?: number;
  readonly antelacionMinimaHoras?: number;
  readonly zonaCobertura?: readonly string[];
  readonly precioExclusivo?: number;
  readonly tarifaEsperaPorHora?: number;
  readonly serviciosAdicionales?: ReadonlyArray<{ nombre: string; precio: number }>;
}

/**
 * Traduce un servicio del formulario antiguo a la configuración nueva.
 *
 * Sin esto, publicar el motor de tarifas dejaría sin precio a todos los
 * transportistas ya dados de alta: su `tarifaBase` + `tarifaKm` no es más que
 * una regla `base_mas_km` sin zona, así que se construye y el resto del sistema
 * deja de tener que saber que existen dos formatos.
 */
export function configDesdeLegado(legado: TransporteLegado): ConfigTransporte {
  const regla: ReglaTarifa = {
    id: 'legado',
    nombre: 'Tarifa base más kilómetros',
    modelo: ModeloPrecio.BASE_MAS_KM,
    unidadCobro: UnidadCobro.VEHICULO,
    tarifaSalida: legado.tarifaBase ?? 0,
    precioKm: legado.tarifaKm ?? 0,
    importeMinimo: (legado.distanciaMinimaKm ?? 0) > 0
      ? (legado.tarifaBase ?? 0) + (legado.tarifaKm ?? 0) * (legado.distanciaMinimaKm ?? 0)
      : undefined,
  };

  const suplementos: SuplementoTransporte[] = [];
  if (legado.precioExclusivo) {
    suplementos.push({
      clave: 'servicio_exclusivo',
      nombre: 'Servicio exclusivo',
      condicion: CondicionSuplemento.SIEMPRE,
      forma: FormaCalculoSuplemento.IMPORTE_FIJO,
      importe: legado.precioExclusivo,
      aplicacion: AplicacionSuplemento.A_PETICION,
    });
  }
  if (legado.tarifaEsperaPorHora) {
    suplementos.push({
      clave: 'espera',
      nombre: 'Tiempo de espera',
      condicion: CondicionSuplemento.ESPERA,
      forma: FormaCalculoSuplemento.POR_HORA,
      importe: legado.tarifaEsperaPorHora,
      aplicacion: AplicacionSuplemento.AUTOMATICA,
    });
  }
  for (const extra of legado.serviciosAdicionales ?? []) {
    suplementos.push({
      clave: extra.nombre,
      nombre: extra.nombre,
      condicion: CondicionSuplemento.SIEMPRE,
      forma: FormaCalculoSuplemento.IMPORTE_FIJO,
      importe: extra.precio,
      aplicacion: AplicacionSuplemento.A_PETICION,
    });
  }

  return {
    ...CONFIG_TRANSPORTE_DEFECTO,
    reglasTarifa: [regla],
    suplementos,
    // Un servicio antiguo no declaraba redondeo: cobraba la distancia tal cual.
    redondeoDistancia: RedondeoDistancia.EXACTA,
    municipiosCobertura: legado.zonaCobertura ?? [],
    maxMascotasPorReserva: legado.maxPerrosPorTrayecto ?? legado.capacidadPerros ?? 3,
    antelacionMinimaHoras: legado.antelacionMinimaHoras ?? 0,
  };
}

/**
 * ¿Tiene este servicio una configuración nueva utilizable?
 *
 * Se mira si hay reglas de tarifa, no un número de versión: el alta guarda
 * borradores y un servicio a medio configurar tiene que seguir cobrando por lo
 * que tenía antes hasta que su primera regla esté completa.
 */
export function tieneConfigTransporte(config: Partial<ConfigTransporte> | undefined | null): boolean {
  return !!config?.reglasTarifa?.length;
}
