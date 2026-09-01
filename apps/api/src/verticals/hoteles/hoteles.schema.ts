import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type HotelesDocument = HydratedDocument<Hoteles>;

/** Un tipo de habitación pet-friendly del hotel, con sus fotos propias. */
export interface EspacioHotel {
  id?: string;
  /** Nombre del tipo tal como lo vende el hotel: «Doble pet-friendly», «Suite». */
  tipo: string;
  descripcion?: string;
  precioNoche: number;
  cantidad: number;
  amenities?: string[];
  imagenes?: string[];
  disponible?: boolean;
  cancelacionGratis?: boolean;
}

export type RazasRestringidas = 'ninguna' | 'ppp' | 'razas_gigantes' | 'especificas';

export interface SuplementoPorTamanoMascota {
  tamano: string; // 'mini' | 'pequeno' | 'mediano' | 'grande' | 'gigante'
  precioPorNoche: number;
}

/**
 * Discriminador del vertical Hotel/alojamiento pet-friendly: aquí el cliente reserva
 * alojamiento para las PERSONAS, condicionado a las características de su mascota —
 * distinto de `Alojamiento` (residencia canina), donde se reserva un espacio para el perro
 * (docs/mejora_servicios.md §6, decisión de modelado #2 del plan de implementación).
 */
@Schema({ _id: false })
export class Hoteles extends Servicio {
  /**
   * Tipos de habitación pet-friendly que el hotel ofrece, cada uno con sus
   * fotos. Comparte forma y nombre con los `espacios` de alojamiento a
   * propósito: el detalle público, la agenda y el contador de plazas ya saben
   * leer esa lista, así que el hotel entra en todo eso sin tocar el core.
   *
   * `unidadesDisponibles` se deduce de la suma de sus `cantidad`
   * (`CONTADOR_DISPONIBILIDAD`), y no se pide a mano.
   */
  @Prop({ type: [Object], default: [] })
  espacios!: EspacioHotel[];

  @Prop({ type: Boolean, default: true })
  admiteMascotas!: boolean;

  /** Sin límite si no se indica. */
  @Prop({ type: Number })
  maxMascotasPorReserva?: number;

  /** Sin límite de peso si no se indica. */
  @Prop({ type: Number })
  pesoMaximoMascotaKg?: number;

  @Prop({ type: String, enum: ['ninguna', 'ppp', 'razas_gigantes', 'especificas'], default: 'ninguna' })
  razasRestringidas!: RazasRestringidas;

  @Prop({ type: [String], default: [] })
  razasEspecificasRestringidas!: string[];

  @Prop({ type: [String], default: ['perro'] })
  especiesPermitidas!: string[];

  /** Suplemento €/noche según el tamaño de la mascota (docs §6.1: pequeña 10€, mediana 15€, grande 20€…). */
  @Prop({ type: [Object], default: [] })
  suplementoPorTamanoMascota!: SuplementoPorTamanoMascota[];

  @Prop({ type: Number })
  suplementoSegundaMascotaPorNoche?: number;

  @Prop({ type: [String], default: [] })
  serviciosPetfriendly!: string[];

  @Prop({ type: Boolean, default: true })
  puedeQuedarseSoloEnHabitacion!: boolean;

  @Prop({ type: Boolean, default: true })
  accesoZonasComunes!: boolean;

  @Prop({ type: Boolean, default: true })
  debeIrConCorrea!: boolean;

  @Prop({ type: Boolean, default: true })
  debeLlevarBozalSiCorresponde!: boolean;

  @Prop()
  checkIn?: string;

  @Prop()
  checkOut?: string;

  @Prop({ type: Number })
  fianza?: number;

  @Prop({ type: Number, default: 0 })
  unidadesDisponibles!: number;
}

export const HotelesSchema = SchemaFactory.createForClass(Hoteles);
