import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EntidadAuditada, TipoAviso, VerticalKey } from 'shared';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CanalesAviso, ConfiguracionPlataforma, ConfiguracionPlataformaDocument } from './configuracion.schema';

/** Todo activado por email de partida: es como se comportaba la plataforma. */
const CANALES_POR_DEFECTO: CanalesAviso = { email: true, plataforma: true, push: false };

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectModel(ConfiguracionPlataforma.name)
    private readonly configModel: Model<ConfiguracionPlataformaDocument>,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Devuelve la configuración, creándola con valores por defecto la primera vez.
   * Nunca devuelve `null`: el panel necesita algo que pintar desde el día uno.
   */
  async obtener(): Promise<ConfiguracionPlataformaDocument> {
    const existente = await this.configModel.findOne({ clave: 'global' }).exec();
    if (existente) return this.completarAvisos(existente);

    return this.configModel.create({
      clave: 'global',
      notificaciones: this.avisosPorDefecto(),
      verticalesActivos: Object.values(VerticalKey),
    });
  }

  async actualizar(
    datos: Partial<ConfiguracionPlataforma>,
    adminId: string,
  ): Promise<ConfiguracionPlataformaDocument> {
    const actual = await this.obtener();
    const actualizada = await this.configModel
      .findOneAndUpdate({ clave: 'global' }, { $set: datos }, { new: true, upsert: true })
      .exec();

    await this.auditoria.registrar({
      actorId: adminId,
      entidad: EntidadAuditada.COMISION,
      entidadId: 'configuracion',
      descripcion: 'Configuración de la plataforma actualizada',
      antes: { modoMantenimiento: actual.modoMantenimiento, verticalesActivos: actual.verticalesActivos },
      despues: { modoMantenimiento: actualizada.modoMantenimiento, verticalesActivos: actualizada.verticalesActivos },
    });

    return actualizada;
  }

  /** ¿Sale este aviso por este canal? Lo consultan los envíos automáticos. */
  async avisoActivo(tipo: TipoAviso, canal: keyof CanalesAviso): Promise<boolean> {
    const config = await this.obtener();
    return config.notificaciones?.[tipo]?.[canal] ?? CANALES_POR_DEFECTO[canal];
  }

  private avisosPorDefecto(): Record<string, CanalesAviso> {
    return Object.fromEntries(Object.values(TipoAviso).map((t) => [t, { ...CANALES_POR_DEFECTO }]));
  }

  /** Un aviso añadido después no puede quedar sin fila en el panel. */
  private completarAvisos(config: ConfiguracionPlataformaDocument): ConfiguracionPlataformaDocument {
    const notificaciones = { ...(config.notificaciones ?? {}) };
    let faltaAlguno = false;
    for (const tipo of Object.values(TipoAviso)) {
      if (!notificaciones[tipo]) {
        notificaciones[tipo] = { ...CANALES_POR_DEFECTO };
        faltaAlguno = true;
      }
    }
    if (faltaAlguno) config.notificaciones = notificaciones;
    return config;
  }
}
