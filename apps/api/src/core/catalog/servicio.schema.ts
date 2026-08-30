import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey, TamanoPerro, TipoPelo, HorarioDiaDto, ExcepcionHorarioDto } from 'shared';

export type ServicioDocument = HydratedDocument<Servicio>;

export type EstadoServicio = 'borrador' | 'publicado' | 'pausado';

/**
 * Requisitos de aptitud declarados por el comercio (motor de compatibilidad
 * servicio↔perro, docs/mejora_servicios.md §7). Un array vacío/ausente
 * significa "sin restricción" en ese eje.
 */
export interface AptitudPerro {
  tamanosAdmitidos?: TamanoPerro[];
  tipoPeloAdmitido?: TipoPelo[];
  temperamentosNoAdmitidos?: string[];
}

@Schema({ timestamps: true, collection: 'servicios', discriminatorKey: 'vertical' })
export class Servicio {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  // `vertical` es el discriminatorKey: Mongoose lo gestiona automáticamente.
  // No debe declararse como @Prop, o los discriminadores (Hotel, Taxi, …)
  // fallan al registrarse con "cannot have field with name vertical".
  vertical!: VerticalKey;

  @Prop({ required: true })
  titulo!: string;

  @Prop({ required: true })
  descripcion!: string;

  @Prop({ type: [String], default: [] })
  imagenes!: string[];

  /**
   * Dónde se presta ESTE servicio. La dirección completa cuelga del listado y no
   * del comercio: un mismo negocio puede tener la residencia canina a las
   * afueras y la peluquería en el centro, y con una única dirección de empresa
   * la ficha enseñaba al cliente un sitio al que no tenía que ir.
   */
  @Prop({
    type: {
      ciudad: { type: String, required: true },
      calle: { type: String },
      numero: { type: String },
      provincia: { type: String },
      codigoPostal: { type: String },
      pais: { type: String },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined },
      },
    },
  })
  ubicacion!: {
    ciudad: string;
    calle?: string;
    numero?: string;
    provincia?: string;
    codigoPostal?: string;
    pais?: string;
    geo?: { type: 'Point'; coordinates: [number, number] };
  };

  /**
   * Horario de atención del servicio, día a día, y sus excepciones (festivos,
   * vacaciones, cierres puntuales). Antes vivían en el comercio, donde no podían
   * distinguir una peluquería que abre de tarde de la residencia del mismo
   * negocio que sólo admite entradas por la mañana.
   */
  @Prop({ type: [Object], default: [] })
  horario!: HorarioDiaDto[];

  @Prop({ type: [Object], default: [] })
  excepcionesHorario!: ExcepcionHorarioDto[];

  /**
   * Dirección visible en la ficha. Vive en el documento base, no en un
   * discriminador: el bloque "Dónde está" es igual en una residencia canina que
   * en una clínica, y tenerla sólo en alojamiento dejaba al resto de verticales
   * enseñando la ciudad a secas.
   */
  @Prop()
  direccion?: string;

  @Prop()
  barrio?: string;

  @Prop({ required: true, type: Number })
  precioBase!: number;

  @Prop({ default: 'EUR' })
  moneda!: string;

  @Prop({ default: false })
  destacado!: boolean;

  @Prop({ default: 0 })
  prioridadRanking!: number;

  @Prop({ type: String, enum: ['borrador', 'publicado', 'pausado'], default: 'borrador' })
  estado!: EstadoServicio;

  @Prop({ default: 0 })
  ratingPromedio!: number;

  @Prop({ default: 0 })
  totalReseñas!: number;

  @Prop({ type: Object })
  aptitud?: AptitudPerro;

  /**
   * Copia del estado del comercio: `true` sólo si el comercio está `activo`.
   *
   * Está denormalizado a propósito. El buscador filtraba únicamente por
   * `estado: 'publicado'` del listado, así que suspender un comercio (HU J1) no
   * lo sacaba del catálogo ni impedía reservarlo. Cruzarlo en cada búsqueda con
   * un `$in` sobre `comercios` rompería el índice ESR de CLAUDE.md §4.3, de modo
   * que el flag viaja aquí y lo mantiene `ComerciosService.cambiarEstado`.
   */
  @Prop({ default: false })
  comercioActivo!: boolean;
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);

// `estado` y `comercioActivo` van primero: son las igualdades que aplica toda
// búsqueda del catálogo (ESR, CLAUDE.md §4.3).
ServicioSchema.index({
  estado: 1, comercioActivo: 1, vertical: 1, 'ubicacion.ciudad': 1, prioridadRanking: -1, precioBase: 1,
});
ServicioSchema.index({ 'ubicacion.geo': '2dsphere' }, { sparse: true });
