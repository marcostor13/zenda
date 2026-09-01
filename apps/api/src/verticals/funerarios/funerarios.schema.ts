import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  FranjaHoraria, ModoPrecioRecogida, TipoServicioFunerario,
} from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type FunerariosDocument = HydratedDocument<Funerarios>;

/**
 * Tramo de peso de un servicio. Es la variable de precio real del sector: no
 * cuesta lo mismo la cremación de un hurón que la de un mastín, y un precio
 * plano obligaría a la empresa a publicar el más caro.
 */
export interface TramoPesoFunerario {
  /** Límite superior del tramo, en kg. El último tramo cubre "y más". */
  hastaKg: number;
  precio: number;
}

/** Servicio concreto del catálogo de la empresa (cremación, recogida, entierro…). */
export interface ServicioFunerario {
  nombre: string;
  tipo: TipoServicioFunerario;
  descripcion?: string;
  /** Qué incluye, en frases sueltas que el cliente lee antes de contratar. */
  incluye?: string[];
  /** Precio cuando no hay tramos de peso, o cuando el peso queda fuera de todos. */
  precioBase: number;
  /** Tramos de peso ordenados de menor a mayor. Vacío = precio único. */
  tramosPeso?: TramoPesoFunerario[];
  /** Horas estimadas desde la recogida hasta la entrega. */
  tiempoEstimadoHoras?: number;
  devuelveCenizas: boolean;
  urnaIncluida: boolean;
  certificadoIncluido: boolean;
  /** La empresa puede tener publicado un servicio y desactivarlo sin borrarlo. */
  activo: boolean;
}

/** Extra opcional que el cliente añade al contratar (urna, huella, ceremonia…). */
export interface ExtraFunerario {
  nombre: string;
  precio: number;
  descripcion?: string;
  activo: boolean;
}

/** Zona de recogida con su propio precio, para quien no tarifica por km. */
export interface ZonaRecogida {
  nombre: string;
  precio: number;
}

/**
 * Política de cancelación propia de la categoría. El brief exige distinguir los
 * dos momentos: mientras el animal sigue en casa del cliente todo es reversible;
 * una vez recogido o iniciado el servicio, ya no.
 */
export interface PoliticaCancelacionFunerario {
  /** % del importe que se devuelve si se cancela antes de la recogida. */
  reembolsoAntesRecogidaPct: number;
  /** % que se devuelve una vez iniciado el servicio. Normalmente 0. */
  reembolsoIniciadoPct: number;
  notas?: string;
}

/**
 * Discriminador del vertical Servicios funerarios.
 *
 * A diferencia del resto de categorías, aquí el precio no sale de un campo
 * suelto: se compone del servicio elegido (según el peso del animal), del
 * desplazamiento de recogida, del suplemento de urgencia y de los extras. Toda
 * esa lógica vive en `FunerariosAvailabilityStrategy`, que es la que responde
 * con el precio cerrado que el cliente ve antes de pagar.
 */
@Schema({ _id: false })
export class Funerarios extends Servicio {
  /** Catálogo de servicios que la empresa presta y puede activar o desactivar. */
  @Prop({ type: [Object], default: [] })
  serviciosFunerarios!: ServicioFunerario[];

  /**
   * Tipos que cubre el catálogo, derivados de `serviciosFunerarios` al guardar.
   * El buscador filtra por aquí: una faceta no puede mirar dentro de un array
   * de objetos, y sin este campo "cremación individual" no sería filtrable.
   */
  @Prop({ type: [String], default: [] })
  tiposServicioFunerario!: string[];

  @Prop({ type: [Object], default: [] })
  extras!: ExtraFunerario[];

  // ── Recogida ────────────────────────────────────────────────────────
  @Prop({ type: Boolean, default: false })
  ofreceRecogida!: boolean;

  /** Radio máximo desde la ciudad base. Fuera de él no se puede contratar recogida. */
  @Prop({ type: Number, default: 25 })
  radioRecogidaKm!: number;

  @Prop({ type: String, default: ModoPrecioRecogida.FIJA })
  modoPrecioRecogida!: ModoPrecioRecogida;

  @Prop({ type: Number, default: 0 })
  precioRecogida!: number;

  @Prop({ type: Number, default: 0 })
  precioRecogidaPorKm!: number;

  @Prop({ type: [Object], default: [] })
  zonasRecogida!: ZonaRecogida[];

  /** Lugares desde los que recoge (domicilio, veterinario, residencia, otro). */
  @Prop({ type: [String], default: [] })
  lugaresRecogida!: string[];

  // ── Urgencia y horarios ─────────────────────────────────────────────
  @Prop({ type: Boolean, default: false })
  servicioUrgente!: boolean;

  @Prop({ type: Boolean, default: false })
  atiende24h!: boolean;

  @Prop({ type: Number, default: 0 })
  suplementoUrgencia!: number;

  /** Franjas en las que la empresa recoge o entrega. */
  @Prop({ type: [String], default: [FranjaHoraria.MANANA, FranjaHoraria.TARDE] })
  franjasDisponibles!: string[];

  // ── Alta y verificación (§10 del brief) ─────────────────────────────
  /**
   * La empresa declara que dispone de autorizaciones, registros o acuerdos para
   * prestar legalmente lo que publica. Se guarda porque es la prueba del
   * consentimiento, no un adorno del formulario.
   */
  @Prop({ type: Boolean, default: false })
  declaraAutorizaciones!: boolean;

  /** `true` = crema ella misma; `false` = trabaja con un tercero. */
  @Prop({ type: Boolean, default: true })
  cremacionPropia!: boolean;

  @Prop({ type: String })
  terceroCrematorio?: string;

  // ── Cancelaciones (§11) ─────────────────────────────────────────────
  @Prop({ type: Object })
  politicaCancelacionFunerario?: PoliticaCancelacionFunerario;

  /** Servicios que puede atender al día; es el contador de plazas del vertical. */
  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;
}

export const FunerariosSchema = SchemaFactory.createForClass(Funerarios);
