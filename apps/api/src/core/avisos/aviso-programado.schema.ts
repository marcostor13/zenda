import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type AvisoProgramadoDocument = HydratedDocument<AvisoProgramado>;

/**
 * Qué dispara el aviso. Cada disparador sabe a quién le toca hoy; el texto y
 * la periodicidad los pone el administrador.
 */
export type DisparadorAviso =
  /** Reservas pendientes de pago desde hace más de `diasAntelacion`. */
  | 'pago_pendiente'
  /** Suscripciones de comercio que caducan dentro de `diasAntelacion` días. */
  | 'membresia_por_vencer'
  /** Estancias/citas que empiezan dentro de `diasAntelacion` días. */
  | 'reserva_proxima'
  /** A todos los destinatarios del segmento, sin más condición. */
  | 'difusion';

export type SegmentoAviso = 'todos' | 'clientes' | 'comercios';

/**
 * Aviso que sale solo, sin que nadie lo dispare a mano.
 *
 * Vive en base de datos y no en el código para que el administrador pueda
 * cambiar el texto, la hora y a quién llega sin un despliegue. El cron sólo
 * lee esta colección y ejecuta lo que encuentra activo.
 */
@Schema({ timestamps: true, collection: 'avisos_programados' })
export class AvisoProgramado {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({
    type: String,
    enum: ['pago_pendiente', 'membresia_por_vencer', 'reserva_proxima', 'difusion'],
    required: true,
  })
  disparador!: DisparadorAviso;

  @Prop({ type: String, enum: ['todos', 'clientes', 'comercios'], default: 'todos' })
  segmento!: SegmentoAviso;

  @Prop({ required: true, trim: true })
  titulo!: string;

  @Prop({ required: true, trim: true })
  cuerpo!: string;

  /** Ruta de la app que se abre al tocar el aviso. */
  @Prop({ default: '/' })
  ruta!: string;

  /**
   * Hora local de envío, `HH:mm`. Se guarda la hora y no una expresión cron
   * completa: un administrador sabe decir "a las 10:00", no
   * `0 0 10 * * *`, y una expresión mal escrita dejaría el aviso mudo.
   */
  @Prop({ default: '10:00' })
  hora!: string;

  /** Días de la semana en que corre (0 = domingo). Vacío = todos los días. */
  @Prop({ type: [Number], default: [] })
  diasSemana!: number[];

  /** Días de antelación del disparador. Ignorado en `difusion`. */
  @Prop({ type: Number, default: 3 })
  diasAntelacion!: number;

  @Prop({ type: Boolean, default: true })
  activo!: boolean;

  @Prop()
  ultimaEjecucion?: Date;

  /** Cuántos avisos salieron en la última ejecución. */
  @Prop({ type: Number, default: 0 })
  ultimoEnviados!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  actualizadoPor?: Types.ObjectId;
}

export const AvisoProgramadoSchema = SchemaFactory.createForClass(AvisoProgramado);

AvisoProgramadoSchema.index({ activo: 1, hora: 1 });
