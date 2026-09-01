import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EstadoSolicitudSeguros, TipoSeguro } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type SegurosDocument = HydratedDocument<Seguros>;

/** Límite de cobertura de una garantía concreta de la póliza. */
export interface LimiteCobertura {
  tipo: TipoSeguro;
  /** Capital máximo cubierto al año, en euros. */
  limiteAnualEur: number;
  /** Días desde la contratación durante los que la garantía aún no cubre. */
  carenciaDias?: number;
  /** Importe que asume el cliente en cada siniestro. */
  franquiciaEur?: number;
}

/** Condiciones que debe cumplir la mascota para poder contratar. */
export interface CondicionesAdmision {
  edadMinimaMeses?: number;
  edadMaximaAnios?: number;
  pesoMaximoKg?: number;
  razasExcluidas?: string[];
  /** true = no admite perros de razas PPP en esta póliza. */
  excluyePPP?: boolean;
  /** true = exige vacunación al día para dar cobertura. */
  requiereVacunasAlDia?: boolean;
  /** Recargo sobre la prima cuando la mascota es admisible pero de mayor riesgo. */
  recargoRiesgoPct?: number;
}

/** Documento que la aseguradora aporta con su solicitud (póliza, registro…). */
export interface DocumentoSolicitud {
  nombre: string;
  url: string;
  subidoEn?: Date;
}

/**
 * Solicitud de alta de una aseguradora.
 *
 * Sustituye al formulario de listado que rellenan los demás verticales: una
 * compañía no publica un "servicio" con fotos y precio, entrega su información
 * y sus condiciones para que Doogking las revise. El listado real —coberturas,
 * primas, límites— lo configura el equipo después de aprobarla.
 */
export interface SolicitudSeguros {
  contacto: {
    nombre: string;
    cargo?: string;
    email: string;
    telefono: string;
  };
  aseguradora: {
    razonSocial: string;
    nifCif: string;
    /** Clave de registro en la DGSFP; es lo que permite comprobar que existe. */
    registroDgs?: string;
    web?: string;
    ambito?: string;
  };
  documentos: DocumentoSolicitud[];
  notas?: string;
  enviadaEn: Date;
}

/**
 * Discriminador del vertical Seguros.
 *
 * Es un vertical de pleno derecho, no un añadido transversal (HU-039): tiene su
 * propia semántica de "disponibilidad" —que aquí significa **elegibilidad de la
 * mascota**, no calendario— y su propio ciclo de vida en la colección `polizas`.
 */
@Schema({ _id: false })
export class Seguros extends Servicio {
  @Prop({ type: [String], enum: Object.values(TipoSeguro), default: [] })
  tiposSeguro!: TipoSeguro[];

  @Prop({ type: [Object], default: [] })
  limitesCobertura!: LimiteCobertura[];

  @Prop({ type: Object, default: {} })
  condicionesAdmision!: CondicionesAdmision;

  /**
   * Prima anual de referencia; el importe final lo valida la aseguradora.
   *
   * Ya no es obligatoria al crear: una solicitud de alta todavía no tiene
   * precios, y el listado se completa cuando el equipo la aprueba.
   */
  @Prop({ type: Number, default: 0 })
  primaAnualBase!: number;

  /** Descuento por pagar el año completo por adelantado. */
  @Prop({ type: Number, default: 0 })
  descuentoPagoAnualPct!: number;

  /** Duración de la póliza en meses; 12 = anual, valores menores = temporal. */
  @Prop({ type: Number, default: 12 })
  duracionMeses!: number;

  @Prop({ type: Boolean, default: true })
  renovacionAutomatica!: boolean;

  /** Pólizas que la aseguradora puede emitir a la vez; 0 = sin límite. */
  @Prop({ type: Number, default: 0 })
  cupoPolizas!: number;

  @Prop()
  documentoCondicionesUrl?: string;

  // ── Alta por solicitud revisada a mano ──────────────────────────────
  @Prop({ type: Object })
  solicitud?: SolicitudSeguros;

  @Prop({ type: String, default: EstadoSolicitudSeguros.PENDIENTE })
  estadoSolicitud!: EstadoSolicitudSeguros;

  /** Por qué no se aprobó; se le dice a la aseguradora, no se guarda para nosotros. */
  @Prop({ type: String })
  motivoRechazoSolicitud?: string;

  @Prop({ type: Date })
  revisadaEn?: Date;
}

export const SegurosSchema = SchemaFactory.createForClass(Seguros);
