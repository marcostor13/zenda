import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Resena, ResenaDocument } from './resena.schema';
import { regexLiteral } from 'shared';

export interface CrearResenaData {
  reservaId: Types.ObjectId;
  servicioId: Types.ObjectId;
  comercioId: Types.ObjectId;
  usuarioId: Types.ObjectId;
  usuarioNombre: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  aspectos?: Record<string, number>;
  fotos?: string[];
}

export interface ActualizarResenaData {
  puntuacion?: number;
  comentario?: string;
  aspectos?: Record<string, number>;
  fotos?: string[];
}

@Injectable()
export class ReviewsRepository {
  constructor(
    @InjectModel(Resena.name) private readonly resenaModel: Model<ResenaDocument>,
  ) {}

  crear(data: CrearResenaData): Promise<ResenaDocument> {
    return this.resenaModel.create(data);
  }

  findByReserva(reservaId: string): Promise<ResenaDocument | null> {
    return this.resenaModel.findOne({ reservaId: new Types.ObjectId(reservaId) }).exec();
  }

  findById(id: string): Promise<ResenaDocument | null> {
    return this.resenaModel.findById(id).exec();
  }

  listarPorServicio(servicioId: string): Promise<ResenaDocument[]> {
    return this.resenaModel
      .find({ servicioId: new Types.ObjectId(servicioId), eliminada: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  /** Incluye las reseñas eliminadas: el propio usuario debe poder verlas en el filtro "Eliminadas". */
  listarPorUsuario(usuarioId: string): Promise<ResenaDocument[]> {
    return this.resenaModel
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  /**
   * Listado para administración: incluye las ocultas, porque el admin tiene que
   * poder revisar (y revertir) lo que ya se retiró (TCK-8040 §3).
   */
  async listarParaAdmin(
    filtros: { buscar?: string; ocultas?: boolean; puntuacion?: number },
    page = 1,
    limite = 20,
  ): Promise<{ items: ResenaDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filtros.ocultas !== undefined) query['eliminada'] = filtros.ocultas ? true : { $ne: true };
    if (filtros.puntuacion) query['puntuacion'] = filtros.puntuacion;
    if (filtros.buscar) {
      const regex = regexLiteral(filtros.buscar);
      query['$or'] = [{ usuarioNombre: regex }, { servicioTitulo: regex }, { comentario: regex }];
    }

    const skip = (page - 1) * limite;
    const [items, total] = await Promise.all([
      this.resenaModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite).lean<ResenaDocument[]>().exec(),
      this.resenaModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Oculta o repone una reseña sin borrarla: el contenido sigue auditable. */
  async fijarOculta(id: string, oculta: boolean): Promise<ResenaDocument | null> {
    return this.resenaModel.findByIdAndUpdate(id, { eliminada: oculta }, { new: true }).exec();
  }

  listarPorComercio(comercioId: string): Promise<ResenaDocument[]> {
    return this.resenaModel
      .find({ comercioId: new Types.ObjectId(comercioId), eliminada: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  /** IDs de reserva ya reseñados (con o sin borrado lógico) por el usuario, para excluirlos de "pendientes de valorar". */
  async listarReservaIdsReseñados(usuarioId: string): Promise<string[]> {
    const docs = await this.resenaModel
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .select('reservaId')
      .lean()
      .exec();
    return docs.map((d) => String(d.reservaId));
  }

  actualizar(id: string, data: ActualizarResenaData): Promise<ResenaDocument | null> {
    return this.resenaModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  eliminar(id: string): Promise<ResenaDocument | null> {
    return this.resenaModel.findByIdAndUpdate(id, { eliminada: true }, { new: true }).exec();
  }

  guardarRespuesta(id: string, respuesta: string): Promise<ResenaDocument | null> {
    return this.resenaModel.findByIdAndUpdate(id, { respuesta }, { new: true }).exec();
  }

  /** Media de puntuación y total de reseñas activas (no eliminadas) de un servicio. */
  async agregadoServicio(servicioId: string): Promise<{ promedio: number; total: number }> {
    const [row] = await this.resenaModel.aggregate<{ promedio: number; total: number }>([
      { $match: { servicioId: new Types.ObjectId(servicioId), eliminada: { $ne: true } } },
      { $group: { _id: null, promedio: { $avg: '$puntuacion' }, total: { $sum: 1 } } },
    ]);
    return { promedio: row?.promedio ?? 0, total: row?.total ?? 0 };
  }
}
