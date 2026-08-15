import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConfiguracionPlataformaDocument = HydratedDocument<ConfiguracionPlataforma>;

/** Por qué canales sale un aviso. Push se declara ya, aunque llegue después. */
export interface CanalesAviso {
  email: boolean;
  plataforma: boolean;
  push: boolean;
}

/**
 * Ajustes globales de Doogking (TCK-8040 §6 y §8). Es un **documento único**:
 * la plataforma tiene una sola configuración y así se lee y se escribe sin
 * inventar claves sueltas repartidas por la base.
 */
@Schema({ timestamps: true, collection: 'configuracion_plataforma' })
export class ConfiguracionPlataforma {
  /** Discriminador del singleton; siempre 'global'. */
  @Prop({ required: true, unique: true, default: 'global' })
  clave!: string;

  @Prop({ type: Object, default: {} })
  notificaciones!: Record<string, CanalesAviso>;

  @Prop({ default: 'Doogking' })
  nombrePlataforma!: string;

  @Prop({ default: 'soporte@doogking.com' })
  emailSoporte!: string;

  @Prop()
  telefonoSoporte?: string;

  /** Días de antelación con los que se avisa de una documentación que caduca. */
  @Prop({ default: 30 })
  diasAvisoCaducidad!: number;

  /** Verticales abiertos al público; el resto no se ofrecen (TCK-8040 §8). */
  @Prop({ type: [String], default: [] })
  verticalesActivos!: string[];

  /**
   * Con el modo mantenimiento el público ve el aviso, pero el panel de
   * administración sigue accesible: si no, no se podría desactivar.
   */
  @Prop({ default: false })
  modoMantenimiento!: boolean;

  @Prop()
  mensajeMantenimiento?: string;
}

export const ConfiguracionPlataformaSchema = SchemaFactory.createForClass(ConfiguracionPlataforma);
