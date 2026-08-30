import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EstadoComercio, MotivoBajaComercio, OrigenBajaComercio, VerticalKey } from 'shared';

export type ComercioDocument = HydratedDocument<Comercio>;

export type PlanComercio = 'basico' | 'pro' | 'premium';
// El ciclo de vida vive en `shared` para que panel, API y DTOs no se separen.
export type { EstadoComercio } from 'shared';
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

export interface HorarioDia {
  dia: string;
  /** Primer tramo. Se mantienen `abre`/`cierra` sueltos por compatibilidad. */
  abre?: string;
  cierra?: string;
  /**
   * Segundo tramo del día. Muchos negocios cierran a mediodía y sin esto había
   * que declarar la jornada partida como continua (TCK-8028).
   */
  abre2?: string;
  cierra2?: string;
  cerrado: boolean;
}

/** Festivo, vacaciones o cierre puntual que se salta el horario semanal. */
export interface ExcepcionHorario {
  /** Fecha en formato ISO corto (YYYY-MM-DD). */
  fecha: string;
  motivo?: string;
  cerrado: boolean;
  abre?: string;
  cierra?: string;
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
  /**
   * Sólo para los documentos que la plataforma revisa. La documentación
   * adicional no se verifica, así que va sin estado; ahí el único valor posible
   * es `caducado`, que es un hecho de la fecha y no un veredicto del admin.
   */
  estado?: EstadoDocumento;
  subidoAt?: Date;
}

export interface VerificacionComercio {
  estado: EstadoVerificacion;
  documentoIdentidadUrl?: string;
  licenciaNegocioUrl?: string;
  documentos?: DocumentoVerificacion[];
  motivoRechazo?: string;
}

/**
 * Por qué se pausó o se dio de baja la cuenta. Se conserva aunque el comercio
 * vuelva: es la única fuente del reporte de churn, y al reactivarse queremos
 * saber si el motivo anterior se resolvió.
 */
export interface BajaComercio {
  motivo: MotivoBajaComercio;
  comentario?: string;
  fecha: Date;
  origen: OrigenBajaComercio;
  /** Usuario que la ejecutó (comercio_admin o admin de plataforma). */
  actorId?: string;
  /** Estado que tenía la cuenta justo antes, para poder restaurarla. */
  estadoPrevio?: EstadoComercio;
  /** Fecha ISO en la que el comercio dice que volverá (solo en standby). */
  reactivarEl?: string;
  /** El comercio autoriza que le contactemos por su marcha. */
  aceptaContacto?: boolean;
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

  @Prop({
    type: String,
    enum: ['pendiente', 'activo', 'suspendido', 'inactivo', 'eliminado'],
    default: 'pendiente',
  })
  estado!: EstadoComercio;

  /**
   * Motivo del último standby o baja. Nunca se borra al reactivar: el histórico
   * de por qué se fue un comercio vale más que el hueco que deja limpiarlo.
   */
  @Prop({ type: Object })
  baja?: BajaComercio;

  /**
   * Momento de la baja lógica. Marca el inicio del periodo de gracia en el que
   * el admin todavía puede restaurar la cuenta; pasado ese plazo el purgador la
   * borra de verdad.
   */
  @Prop({ type: Date })
  eliminadoAt?: Date;

  @Prop({ type: Object })
  contacto?: ContactoComercio;

  @Prop({ type: Object })
  direccion?: DireccionComercio;

  @Prop({ type: [Object], default: [] })
  horario!: HorarioDia[];

  /** Festivos, vacaciones y cierres puntuales (TCK-8028). */
  @Prop({ type: [Object], default: [] })
  excepcionesHorario!: ExcepcionHorario[];

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
// Todo listado (admin, buscador, contadores) filtra primero por estado: sin
// este índice, excluir los comercios dados de baja obligaba a un COLLSCAN.
ComercioSchema.index({ estado: 1, createdAt: -1 });

ComercioSchema.index(
  { vatNumber: 1 },
  { unique: true, partialFilterExpression: { vatNumber: { $type: 'string' } } },
);
