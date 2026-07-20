import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { SexoPerro, TamanoPerro, TipoPelo, NivelSociabilidad } from 'shared';

export type PerroDocument = HydratedDocument<Perro>;

/**
 * Ficha Inteligente del Perro: se registra una sola vez y la reutilizan
 * todos los verticales (filtrado de compatibilidad, precálculo de precio,
 * contexto para el profesional). Ver docs/mejora_servicios.md.
 */
@Schema({ timestamps: true, collection: 'perros' })
export class Perro {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  propietarioId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ type: [String], default: [] })
  fotos!: string[];

  // Multi-especie: el MVP es canino, pero veterinaria/hotel ya admiten otras especies.
  @Prop({ type: String, default: 'perro' })
  especie!: string;

  @Prop()
  raza?: string;

  @Prop({ type: Boolean, default: false })
  esMestizo!: boolean;

  @Prop()
  fechaNacimiento?: Date;

  @Prop({ type: String, enum: SexoPerro })
  sexo?: SexoPerro;

  @Prop({ type: Boolean, default: false })
  esterilizado!: boolean;

  @Prop({ type: Number })
  peso?: number;

  @Prop()
  microchip?: string;

  @Prop()
  fechaImplantacionMicrochip?: Date;

  // --- Físico / grooming ---
  @Prop({ type: [String], enum: TipoPelo, default: [] })
  tipoPelo!: TipoPelo[];

  @Prop({ type: String, enum: TamanoPerro })
  tamano?: TamanoPerro;

  @Prop()
  estadoManto?: string;

  @Prop({ type: Boolean, default: false })
  esPPP!: boolean;

  // --- Salud ---
  @Prop({ type: [String], default: [] })
  vacunas!: string[];

  @Prop({ type: [String], default: [] })
  alergias!: string[];

  @Prop({ type: [String], default: [] })
  enfermedades!: string[];

  @Prop({ type: [String], default: [] })
  medicacion!: string[];

  @Prop()
  dieta?: string;

  // --- Comportamiento ---
  @Prop({ type: String, enum: NivelSociabilidad })
  sociabilidadPerros?: NivelSociabilidad;

  @Prop({ type: String, enum: NivelSociabilidad })
  sociabilidadPersonas?: NivelSociabilidad;

  @Prop({ type: Boolean, default: true })
  puedeQuedarseSolo!: boolean;

  @Prop({ type: Boolean, default: false })
  ansiedadSeparacion!: boolean;

  @Prop({ type: [String], default: [] })
  miedos!: string[];

  @Prop()
  temperamento?: string;

  @Prop({ type: Boolean, default: false })
  reactividadCorrea!: boolean;

  @Prop({ type: Boolean, default: false })
  protectorRecursos!: boolean;

  // --- Viaje / transporte ---
  @Prop({ type: Boolean, default: true })
  toleraTrayectosLargos!: boolean;

  @Prop({ type: Boolean, default: false })
  seMarea!: boolean;

  @Prop({ type: Boolean, default: false })
  requiereTransportin!: boolean;

  // --- Documentación ---
  @Prop()
  cartillaSanitariaUrl?: string;

  @Prop()
  pasaporteEuropeoUrl?: string;

  @Prop({ type: [String], default: [] })
  certificadosUrl!: string[];

  // --- Privacidad / diferenciales ---
  @Prop({ type: Boolean, default: true })
  autorizaCompartirHistorial!: boolean;

  @Prop({ type: Number, min: 1, max: 5 })
  nivelDoogking?: number;
}

export const PerroSchema = SchemaFactory.createForClass(Perro);
PerroSchema.index({ propietarioId: 1, createdAt: -1 });
