import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EstadoComercio, MotivoBajaComercio, OrigenBajaComercio, VerticalKey } from 'shared';

export type ComercioDocument = HydratedDocument<Comercio>;

export type PlanComercio = 'basico' | 'pro' | 'premium';
// El ciclo de vida vive en `shared` para que panel, API y DTOs no se separen.
export type { EstadoComercio } from 'shared';
export type ModoLiquidacion = 'merchant' | 'agencia';
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

/** Una aceptación concreta, con la prueba de cuándo y sobre qué texto se dio. */
export interface Consentimiento {
  aceptado: boolean;
  fecha?: Date;
  /** Versión del texto aceptado, para saber a qué se comprometió exactamente. */
  version?: string;
}

export interface ConsentimientosComercio {
  /** Declara que opera legalmente y con los permisos necesarios. */
  operaLegalmente?: Consentimiento;
  /** Acepta las condiciones generales del servicio. */
  condicionesGenerales?: Consentimiento;
}

export interface DatosBancarios {
  titular?: string;
  iban?: string;
  banco?: string;
  swift?: string;
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

  /**
   * Población principal, la que el comercio indica al registrarse. Es el punto
   * de partida que rellena la ficha del primer servicio y la que sale en el
   * comprobante de reserva; la dirección exacta de cada servicio vive en el
   * propio servicio (`Servicio.ubicacion`).
   */
  @Prop({ type: Object })
  direccion?: DireccionComercio;

  @Prop({ type: String, enum: ['flexible', 'moderada', 'estricta'] })
  politicaCancelacion?: PoliticaCancelacion;

  @Prop({ type: Object })
  datosBancarios?: DatosBancarios;

  /**
   * Lo que el comercio declaró y aceptó al cerrar su alta. Guarda la fecha y la
   * versión del texto vigente, no sólo el "sí": sin ellas no hay forma de
   * demostrar qué aceptó ni cuándo, que es justo para lo que sirve el bloque.
   */
  @Prop({ type: Object })
  consentimientos?: ConsentimientosComercio;

  /**
   * El alta guiada llegó al final. El comercio puede aparcarla ("todavía no
   * tengo los datos"), así que esto no se deduce de tener los campos llenos: los
   * datos fiscales también se pueden completar más tarde desde el panel.
   */
  @Prop({ type: Boolean, default: false })
  altaCompletada!: boolean;

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
