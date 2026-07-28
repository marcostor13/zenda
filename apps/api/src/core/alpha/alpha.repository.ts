import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ALPHA_NIVELES_DEFAULT, AlphaNivelDto } from 'shared';
import { AlphaNivelConfig, AlphaNivelConfigDocument } from './alpha-nivel.schema';

@Injectable()
export class AlphaRepository {
  constructor(
    @InjectModel(AlphaNivelConfig.name)
    private readonly model: Model<AlphaNivelConfigDocument>,
  ) {}

  /** Escalera efectiva: la configurada en BD, o la de fábrica si el admin no ha guardado nada aún. */
  async listarNiveles(): Promise<AlphaNivelDto[]> {
    const docs = await this.model.find({ activo: true }).sort({ nivel: 1 }).lean().exec();
    if (docs.length === 0) return ALPHA_NIVELES_DEFAULT.map((n) => ({ ...n }));
    return docs.map((d) => ({
      nivel: d.nivel,
      nombre: d.nombre,
      reservasRequeridas: d.reservasRequeridas,
      descuentoPct: d.descuentoPct,
      beneficios: d.beneficios,
    }));
  }

  upsert(nivel: number, datos: Partial<AlphaNivelConfig>, adminId: string): Promise<AlphaNivelConfigDocument> {
    return this.model
      .findOneAndUpdate(
        { nivel },
        { ...datos, nivel, actualizadoPor: adminId },
        { upsert: true, new: true },
      )
      .exec() as Promise<AlphaNivelConfigDocument>;
  }
}
