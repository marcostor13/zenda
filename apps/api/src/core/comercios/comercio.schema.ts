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
  // Datos fiscales: opcionales al registrarse (perfilado progresivo); se exigen
  // en el panel antes del primer cobro/liquidación.
  @Prop()
  razonSocial?: string;

  @Prop()
  vatNumber?: string;

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

  // --- Programa Socios Fundadores (HU-047) ---
  /**
   * Comercios de la primera hornada: su comisión queda **congelada** durante 24
   * meses aunque la plataforma suba tarifas. Es un compromiso comercial, así que
   * gana sobre cualquier otra regla mientras esté vigente.
   */
  @Prop({ type: Boolean, default: false })
  socioFundador!: boolean;

  // --- Programa Doogking Alpha (HU-13.3) ---
  /**
   * El comercio ofrece las ventajas del programa Alpha a los clientes según su
   * nivel. Se muestra como insignia en los listados y alimenta el carrusel de
   * "Ventajas disponibles para ti"; el descuento concreto sale de la escalera
   * configurada por el admin, no de aquí.
   */
  @Prop({ type: Boolean, default: false })
  alphaAdherido!: boolean;

  @Prop({ type: Number })
  comisionPctCongelada?: number;

  /** Hasta cuándo se respeta la comisión congelada. */
  @Prop({ type: Date })
  congelacionHasta?: Date;

  /** Cohorte de captación (`2026-Q3`…), dimensión del reporte financiero. */
  @Prop()
  cohorte?: string;

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

// Único solo cuando hay CIF: el filtro parcial excluye documentos sin vatNumber
// (ausente o null), de modo que varios comercios sin CIF no colisionan.
ComercioSchema.index(
  { vatNumber: 1 },
  { unique: true, partialFilterExpression: { vatNumber: { $type: 'string' } } },
);
