import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  AccionNoShow, AmbitoTransporte, BaseKilometraje, CompartidoTransporte, FinalidadTransporte,
  FrecuenciaRecurrencia, ModoCobertura, ModoDisponibilidadTransporte, PlantillaTransporte,
  PoliticaCancelacionTransporte, PoliticaParadas, PoliticaPeajes, PrecioAcompanante,
  PrecioOrientativo, PuntosTrayecto, QuienViaja, RedondeoDistancia, ReglaTarifa,
  RequisitoDocumental, SalidaProgramada, SuplementoTransporte, TipoIdaVuelta, TipoRecogida,
  TipoTrayecto, VentanaRecogida,
} from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TransporteDocument = HydratedDocument<Transporte>;

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

export interface ServicioAdicionalTransporte {
  nombre: string;
  precio: number;
}

/**
 * Discriminador del vertical Transporte de mascotas (Doogking): traslado de
 * mascotas A→B con vehículo acondicionado. Precio por trayecto:
 * tarifaBase + tarifaKm × distancia (+ suplemento de exclusividad si se solicita).
 */
/** Una parada del trayecto declarado, con su punto en el mapa. */
export interface ParadaTrayecto {
  /** Cómo se llama la parada: la población, el barrio, la clínica… */
  nombre: string;
  lat: number;
  lng: number;
  /** Identificador de Google Places, si la parada se eligió del buscador. */
  placeId?: string;
}

@Schema({ _id: false })
export class Transporte extends Servicio {
  @Prop({ type: String, default: 'van_acondicionada' })
  tipoVehiculo!: TipoVehiculoTransporte;

  @Prop({ type: Number, default: 4 })
  capacidadPerros!: number;

  @Prop({ type: [String], default: [] })
  zonaCobertura!: string[];

  @Prop({ type: Number, required: true })
  tarifaBase!: number;

  @Prop({ type: Number, required: true })
  tarifaKm!: number;

  /** Cargo por hora de espera en trayectos "ida y vuelta con espera" (Ref. TRA4). 0/ausente = no se cobra. */
  @Prop({ type: Number, default: 0 })
  tarifaEsperaPorHora!: number;

  @Prop({ type: Boolean, default: true })
  jaulasIncluidas!: boolean;

  @Prop({ type: Boolean, default: false })
  acompananteHumano!: boolean;

  @Prop({ type: Boolean, default: true })
  soloPerros!: boolean;

  /** Vehículos disponibles ahora mismo (modelo por trayecto). */
  @Prop({ type: Number, default: 1 })
  unidadesDisponibles!: number;

  // --- Enriquecimiento Fase C (docs/mejora_servicios.md §4.1) ---

  /** Tipos de trayecto que ofrece (local_urbano, provincial, nacional, internacional,
   * recogida_peluqueria, recogida_residencia, traslado_veterinario, traslado_urgente_veterinario,
   * traslado_aeropuerto, compartido, exclusivo…). */
  @Prop({ type: [String], default: [] })
  tiposTransporteOfrecidos!: string[];

  /** Suplemento €/trayecto si el cliente solicita transporte exclusivo (docs: +20€ ejemplo). */
  @Prop({ type: Number })
  precioExclusivo?: number;

  @Prop({ type: Boolean, default: false })
  requisitoMicrochip!: boolean;

  @Prop({ type: Boolean, default: false })
  requisitoVacunas!: boolean;

  /** climatizacion, gps, separacion_individual, puerta_a_puerta, paradas_programadas, recogida_central… */
  @Prop({ type: [String], default: [] })
  caracteristicasVehiculo!: string[];

  @Prop({ type: [Object], default: [] })
  serviciosAdicionales!: ServicioAdicionalTransporte[];

  // --- Cierre de Fase C.6: condiciones configurables del transportista ---

  /**
   * Trayecto declarado, parada a parada y en orden.
   *
   * Es la ruta habitual que el transportista quiere enseñar en su ficha —«hago
   * Madrid–Guadalajara–Zaragoza»—, no el camino que calculará el GPS el día del
   * viaje. Lleva coordenadas para poder pintarla en el mapa sin volver a
   * resolver cada nombre.
   */
  @Prop({ type: [Object], default: [] })
  trayecto!: ParadaTrayecto[];

  /**
   * @deprecated Ya no se pide en el alta: un radio en kilómetros mete dentro
   * pueblos a los que no se sube y deja fuera el que sí se hace por la autovía.
   * Se conserva para no borrar lo que declararon los transportistas antiguos.
   * La zona se declara con `zonaCobertura` (provincias) y el recorrido concreto
   * con `trayecto`.
   *
   * Radio de cobertura desde la ciudad base, en km. 0 = sin límite declarado.
   */
  @Prop({ type: Number, default: 0 })
  radioCoberturaKm!: number;

  /** Distancia mínima facturable: por debajo se cobra igualmente este trayecto. */
  @Prop({ type: Number, default: 0 })
  distanciaMinimaKm!: number;

  @Prop({ type: Boolean, default: false })
  aceptaPPP!: boolean;

  /** El cliente debe aportar su propio transportín (si no hay jaulas incluidas). */
  @Prop({ type: Boolean, default: false })
  requiereTransportinPropio!: boolean;

  /** Máximo de perros por trayecto, si difiere de la capacidad del vehículo. */
  @Prop({ type: Number })
  maxPerrosPorTrayecto?: number;

  /** Antelación mínima con la que hay que reservar, en horas. */
  @Prop({ type: Number, default: 0 })
  antelacionMinimaHoras!: number;

  // ── Alta guiada de "Transporte de mascotas" ───────────────────────────
  /*
   * Lo que sigue es la configuración que rellena el asistente de alta de seis
   * pasos. Convive con los campos de arriba en vez de sustituirlos: los
   * servicios publicados con el formulario anterior siguen cobrando por su
   * `tarifaBase` + `tarifaKm`, y `configDesdeLegado()` los traduce al vuelo
   * para que el motor de tarifas no tenga que conocer dos formatos.
   *
   * El criterio para decidir cuál manda es tener al menos una regla de tarifa
   * completa (`tieneConfigTransporte`), no un número de versión: el alta guarda
   * borradores y un servicio a medio configurar tiene que seguir vendiendo.
   */

  // 1 · Tipo
  @Prop({ type: String, default: PlantillaTransporte.EXCLUSIVO })
  plantilla!: PlantillaTransporte;

  @Prop({ type: String, default: QuienViaja.SOLO_MASCOTA })
  quienViaja!: QuienViaja;

  @Prop({ type: [String], default: [] })
  tiposTrayecto!: TipoTrayecto[];

  @Prop({ type: [String], default: [] })
  ambitos!: AmbitoTransporte[];

  @Prop({ type: String, default: TipoRecogida.PUERTA_A_PUERTA })
  tipoRecogida!: TipoRecogida;

  @Prop({ type: [String], default: [] })
  finalidades!: FinalidadTransporte[];

  // 2 · Cobertura y trayecto
  @Prop({ type: String, default: ModoCobertura.RADIO })
  modoCobertura!: ModoCobertura;

  @Prop({ type: String })
  direccionBase?: string;

  @Prop({ type: Number, default: 50 })
  radioKm!: number;

  /** `null` = sin límite declarado. */
  @Prop({ type: Number, default: null })
  distanciaMaximaKm?: number | null;

  @Prop({ type: [String], default: [] })
  municipiosCobertura!: string[];

  @Prop({ type: [String], default: [] })
  paisesCobertura!: string[];

  @Prop({ type: String, default: PuntosTrayecto.LIBRES })
  puntosTrayecto!: PuntosTrayecto;

  @Prop({ type: String, default: BaseKilometraje.RECOGIDA_DESTINO })
  baseKilometraje!: BaseKilometraje;

  @Prop({ type: String, default: TipoIdaVuelta.ESPERA_MISMO_DIA })
  tipoIdaVuelta!: TipoIdaVuelta;

  @Prop({ type: String, default: PoliticaParadas.CON_SUPLEMENTO })
  politicaParadas!: PoliticaParadas;

  /** Minutos de espera que van incluidos antes de empezar a cobrar el parón. */
  @Prop({ type: Number, default: 30 })
  esperaIncluidaMin!: number;

  @Prop({ type: String, default: PoliticaPeajes.INCLUIDOS })
  politicaPeajes!: PoliticaPeajes;

  // 3 · Precio
  /**
   * Reglas de tarifa **en orden**: gana la primera que encaja con la zona, la
   * distancia y el tipo de trayecto pedidos. El orden es el dato, no un detalle
   * de presentación: moverlas cambia lo que cobra la empresa.
   */
  @Prop({ type: [Object], default: [] })
  reglasTarifa!: ReglaTarifa[];

  @Prop({ type: String, default: RedondeoDistancia.KM_SUPERIOR })
  redondeoDistancia!: RedondeoDistancia;

  @Prop({ type: [Object], default: [] })
  suplementos!: SuplementoTransporte[];

  @Prop({ type: String, default: PrecioOrientativo.DESDE })
  precioOrientativo!: PrecioOrientativo;

  @Prop({ type: Number })
  precioDesde?: number;

  @Prop({ type: Number, default: 12 })
  horasRespuestaPresupuesto!: number;

  @Prop({ type: Number, default: 48 })
  validezPresupuestoHoras!: number;

  // 4 · Mascotas y vehículo
  @Prop({ type: [String], default: [] })
  especiesAdmitidas!: string[];

  @Prop({ type: [String], default: [] })
  tamanosAdmitidos!: string[];

  @Prop({ type: Number, default: 3 })
  maxMascotasPorReserva!: number;

  @Prop({ type: String, default: CompartidoTransporte.MISMA_FAMILIA })
  compartido!: CompartidoTransporte;

  /** Casos que la empresa quiere revisar antes de aceptar la reserva. */
  @Prop({ type: [String], default: [] })
  situacionesConfirmacion!: string[];

  @Prop({ type: Number, default: 0 })
  plazasAcompanantes!: number;

  @Prop({ type: String, default: PrecioAcompanante.INCLUIDO })
  precioAcompanante!: PrecioAcompanante;

  @Prop({ type: [String], default: [] })
  equipajeAdmitido!: string[];

  @Prop({ type: [String], default: [] })
  equipamientoVehiculo!: string[];

  @Prop({ type: [Object], default: [] })
  requisitosDocumentales!: RequisitoDocumental[];

  // 5 · Disponibilidad
  @Prop({ type: String, default: ModoDisponibilidadTransporte.CALENDARIO })
  modoDisponibilidad!: ModoDisponibilidadTransporte;

  @Prop({ type: String, default: VentanaRecogida.FRANJA_60 })
  ventanaRecogida!: VentanaRecogida;

  /** Horas que tarda la empresa en confirmar. 0 = confirmación inmediata. */
  @Prop({ type: Number, default: 0 })
  confirmacionHoras!: number;

  @Prop({ type: [String], default: [] })
  frecuenciasRecurrencia!: FrecuenciaRecurrencia[];

  @Prop({ type: Number, default: 12 })
  periodoMaximoSemanas!: number;

  @Prop({ type: [Object], default: [] })
  salidas!: SalidaProgramada[];

  @Prop({ type: Number })
  respuestaUrgenteHoras?: number;

  // 6 · Condiciones
  @Prop({ type: String, default: PoliticaCancelacionTransporte.ESTANDAR })
  politicaCancelacionTransporte!: PoliticaCancelacionTransporte;

  @Prop({ type: Number, default: 15 })
  cortesiaMinutos!: number;

  @Prop({ type: String, default: AccionNoShow.COBRO_COMPLETO })
  accionNoShow!: AccionNoShow;
}

export const TransporteSchema = SchemaFactory.createForClass(Transporte);
