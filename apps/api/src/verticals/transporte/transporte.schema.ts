import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ModalidadTransporte, ModoPrecioTransporte, PreferenciaTransporte, ReglasPresupuestoTransporte,
  SuplementosTransporte, ZonaPrecioTransporte, PoliticaCancelacionTransporte,
} from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TransporteDocument = HydratedDocument<Transporte>;

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

export interface ServicioAdicionalTransporte {
  nombre: string;
  precio: number;
}

/**
 * Discriminador del vertical Transporte de animales (Doogking): traslado de
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

  // --- Tarifario del flujo de cliente (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md, F1) ---
  // El cliente no ve nada de esto: describe su viaje y el cotizador lo traduce
  // a este tarifario. Los campos ausentes en fichas antiguas los rellena
  // `tarifarioDe` a partir de los de antes, así que nadie deja de aparecer.

  /** Cómo tarifica el trayecto. Ausente = `por_km`, que es como tarificaban todos. */
  @Prop({ type: String, enum: Object.values(ModoPrecioTransporte) })
  modoPrecio?: ModoPrecioTransporte;

  /** Precio de un trayecto dentro de su zona, en modo `fijo`. */
  @Prop({ type: Number })
  precioFijo?: number;

  /** Precio por pareja de provincias, en modo `por_zona`. Vale en los dos sentidos. */
  @Prop({ type: [Object], default: undefined })
  zonasPrecio?: ZonaPrecioTransporte[];

  /** Modalidades que ofrece. Ausente = se deduce de `tiposTransporteOfrecidos` y `precioExclusivo`. */
  @Prop({ type: [String], default: undefined })
  modalidades?: ModalidadTransporte[];

  /** Asientos para acompañantes en la modalidad «viajo con mi mascota». 0 = no lleva pasajeros. */
  @Prop({ type: Number, default: 0 })
  plazasPasajeros!: number;

  /** Minutos que suele añadir un viaje compartido por las paradas de otros clientes. */
  @Prop({ type: Number, default: 0 })
  tiempoExtraCompartidoMin!: number;

  @Prop({ type: Object })
  suplementos?: SuplementosTransporte;

  /** Especies que traslada (valores de `EspecieMascota`). Ausente = según `soloPerros`. */
  @Prop({ type: [String], default: undefined })
  especiesAceptadas?: string[];

  @Prop({ type: Boolean, default: true })
  aceptaLoAntesPosible!: boolean;

  @Prop({ type: Boolean, default: true })
  aceptaUrgentes!: boolean;

  /** Cuándo prefiere estudiar el viaje y presupuestarlo a mano. */
  @Prop({ type: Object })
  reglasPresupuesto?: ReglasPresupuestoTransporte;

  /** Lo que va incluido en el precio. Ausente = se deduce de las características del vehículo. */
  @Prop({ type: [String], default: undefined })
  incluidos?: PreferenciaTransporte[];

  /** Política de cancelación. Ausente = gratis hasta 24 h antes, sin reembolso después. */
  @Prop({ type: Object })
  cancelacion?: PoliticaCancelacionTransporte;
}

export const TransporteSchema = SchemaFactory.createForClass(Transporte);
