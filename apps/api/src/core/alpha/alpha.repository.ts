import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ALPHA_NIVELES_DEFAULT, AlphaNivelDto } from 'shared';
import { AlphaNivelConfig, AlphaNivelConfigDocument } from './alpha-nivel.schema';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';

/** Tope del carrusel "Ventajas disponibles para ti": es un escaparate, no un listado. */
const MAX_VENTAJAS = 12;

@Injectable()
export class AlphaRepository {
  constructor(
    @InjectModel(AlphaNivelConfig.name)
    private readonly model: Model<AlphaNivelConfigDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  /**
   * Servicios publicados de comercios adheridos al programa Alpha (HU-13.3),
   * de cualquier vertical. Devuelve lista vacía si nadie está adherido todavía
   * — el carrusel simplemente no se pinta, no se rellena con negocios ajenos
   * al programa.
   */
  async listarVentajas(): Promise<ServicioDocument[]> {
    const adheridos = await this.comercioModel
      .find({ alphaAdherido: true, estado: 'activo' })
      .select('_id')
      .lean()
      .exec();
    if (adheridos.length === 0) return [];

    return this.servicioModel
      .find({ comercioId: { $in: adheridos.map((c) => c._id) }, estado: 'publicado' })
      .sort({ prioridadRanking: -1, ratingPromedio: -1 })
      .limit(MAX_VENTAJAS)
      .lean()
      .exec() as unknown as Promise<ServicioDocument[]>;
  }

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
