import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoPoliza, TipoSeguro } from 'shared';

export type PolizaDocument = HydratedDocument<Poliza>;

/**
 * Póliza contratada. Vive en su propia colección y **no** dentro de `reservas`
 * (HU-039): una reserva se presta en una fecha; una póliza tiene vigencia,
 * renovación, carencias y franquicia, que son un ciclo de vida distinto.
 */
@Schema({ timestamps: true, collection: 'polizas' })
export class Poliza {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio', required: true })
  servicioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  aseguradoraComercioId!: Types.ObjectId;

  /** Reserva que originó el cobro, para enlazar póliza y pago. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  @Prop({ type: [String], enum: Object.values(TipoSeguro), default: [] })
  coberturas!: TipoSeguro[];

  @Prop({ type: Number, required: true })
  primaAnual!: number;

  /** Recargo aplicado por perfil de riesgo, si lo hubo. */
  @Prop({ type: Number, default: 0 })
  recargoAplicadoPct!: number;

  @Prop({ type: Number, default: 0 })
  franquiciaEur!: number;

  /** Hasta esta fecha las garantías con carencia todavía no cubren. */
  @Prop()
  carenciaHasta?: Date;

  @Prop({ type: Date, required: true })
  vigenciaDesde!: Date;

  @Prop({ type: Date, required: true })
  vigenciaHasta!: Date;

  @Prop({ type: Boolean, default: true })
  renovacionAutomatica!: boolean;

  @Prop({
    type: String,
    enum: Object.values(EstadoPoliza),
    default: EstadoPoliza.PENDIENTE_VALIDACION,
  })
  estado!: EstadoPoliza;

  /**
   * El cliente declara que los datos de su mascota son ciertos. Se guarda con
   * fecha porque de ello depende que la aseguradora pueda revisar la prima o
   * excluir coberturas si hubo omisiones (HU-040).
   */
  @Prop({ type: Boolean, default: false })
  declaracionVeracidadAceptada!: boolean;

  @Prop()
  fechaDeclaracion?: Date;

  /** Datos del perro en el momento de contratar; sostiene la declaración. */
  @Prop({ type: Object, default: {} })
  perroSnapshot!: Record<string, unknown>;

  @Prop()
  motivoRechazo?: string;
}

export const PolizaSchema = SchemaFactory.createForClass(Poliza);

PolizaSchema.index({ usuarioId: 1, estado: 1, vigenciaHasta: -1 });
PolizaSchema.index({ perroId: 1, estado: 1 });
PolizaSchema.index({ aseguradoraComercioId: 1, estado: 1 });
// Renovaciones y vencimientos: se consultan por fecha con frecuencia.
PolizaSchema.index({ estado: 1, vigenciaHasta: 1 });
