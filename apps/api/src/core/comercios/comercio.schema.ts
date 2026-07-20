import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { VerticalKey } from 'shared';

export type ComercioDocument = HydratedDocument<Comercio>;

export type PlanComercio = 'basico' | 'pro' | 'premium';
export type EstadoComercio = 'pendiente' | 'activo' | 'suspendido';
export type ModoLiquidacion = 'merchant' | 'agencia';
export type EstadoVerificacion = 'sin_verificar' | 'pendiente' | 'verificado' | 'rechazado';
export type PoliticaCancelacion = 'flexible' | 'moderada' | 'estricta';

export interface ContactoComercio {
  nombreContacto?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
}

export interface DireccionComercio {
  calle?: string;
  numero?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  pais?: string;
  lat?: number;
  lng?: number;
}

export interface RedesSociales {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface HorarioDia {
  dia: string;
  abre?: string;
  cierra?: string;
  cerrado: boolean;
}

export interface DatosBancarios {
  titular?: string;
  iban?: string;
  banco?: string;
  swift?: string;
}

export type TipoDocumento = 'dni' | 'cif' | 'licencia' | 'seguro_rc' | 'certificado' | 'otro';
export type EstadoDocumento = 'pendiente' | 'verificado' | 'rechazado' | 'caducado';

export interface DocumentoVerificacion {
  tipo: TipoDocumento;
  nombre?: string;
  url: string;
  fechaCaducidad?: string;
  estado: EstadoDocumento;
  subidoAt?: Date;
}

export interface VerificacionComercio {
  estado: EstadoVerificacion;
  documentoIdentidadUrl?: string;
  licenciaNegocioUrl?: string;
  documentos?: DocumentoVerificacion[];
  motivoRechazo?: string;
}

export interface PreferenciasNotificacion {
  nuevaReserva: boolean;
  cancelacion: boolean;
  resena: boolean;
  pagos: boolean;
}

@Schema({ timestamps: true, collection: 'comercios' })
export class Comercio {
  @Prop({ required: true })
  razonSocial!: string;

  @Prop({ required: true, unique: true })
  vatNumber!: string;

  @Prop({ required: true })
  nombreComercial!: string;

  @Prop()
  descripcion?: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  coverUrl?: string;

  @Prop({ type: [String], default: [] })
  galeria!: string[];

  @Prop()
  sitioWeb?: string;

  @Prop({ type: [String], enum: VerticalKey, default: [] })
  verticales!: VerticalKey[];

  @Prop({ type: String, default: 'merchant' })
  modoLiquidacion!: ModoLiquidacion;

  @Prop({ type: Number })
  comisionPctOverride?: number;

  @Prop({ type: String, enum: ['basico', 'pro', 'premium'], default: 'basico' })
  plan!: PlanComercio;

  @Prop({ type: String, enum: ['pendiente', 'activo', 'suspendido'], default: 'pendiente' })
  estado!: EstadoComercio;

  @Prop({ type: Object })
  contacto?: ContactoComercio;

  @Prop({ type: Object })
  direccion?: DireccionComercio;

  @Prop({ type: Object })
  redesSociales?: RedesSociales;

  @Prop({ type: [Object], default: [] })
  horario!: HorarioDia[];

  @Prop({ type: String, enum: ['flexible', 'moderada', 'estricta'] })
  politicaCancelacion?: PoliticaCancelacion;

  @Prop({ type: Object })
  datosBancarios?: DatosBancarios;

  @Prop({ type: Object, default: () => ({ estado: 'sin_verificar' }) })
  verificacion!: VerificacionComercio;

  @Prop({
    type: Object,
    default: () => ({ nuevaReserva: true, cancelacion: true, resena: true, pagos: true }),
  })
  preferenciasNotificacion!: PreferenciasNotificacion;
}

export const ComercioSchema = SchemaFactory.createForClass(Comercio);

ComercioSchema.index({ vatNumber: 1 }, { unique: true });
