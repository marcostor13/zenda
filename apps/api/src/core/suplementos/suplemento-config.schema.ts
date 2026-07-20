import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { UnidadSuplemento } from 'shared';

export type SuplementoConfigDocument = HydratedDocument<SuplementoConfig>;

/**
 * Catálogo de suplementos que un comercio predefine (docs/mejora_servicios.md §7),
 * para seleccionarlos con un click al solicitar un ajuste de precio en recepción.
 */
@Schema({ timestamps: true, collection: 'suplemento_configs' })
export class SuplementoConfig {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  // Si no se indica, el suplemento aplica a cualquier servicio del comercio.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio' })
  servicioId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  concepto!: string;

  @Prop({ required: true, type: Number })
  monto!: number;

  @Prop({ type: String, default: 'fijo' })
  unidad!: UnidadSuplemento;

  @Prop({ type: Boolean, default: true })
  activo!: boolean;
}

export const SuplementoConfigSchema = SchemaFactory.createForClass(SuplementoConfig);
SuplementoConfigSchema.index({ comercioId: 1, activo: 1 });
