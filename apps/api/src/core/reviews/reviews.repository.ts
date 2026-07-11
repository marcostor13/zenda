import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Resena, ResenaDocument } from './resena.schema';

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
      .find({ servicioId: new Types.ObjectId(servicioId) })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  listarPorUsuario(usuarioId: string): Promise<ResenaDocument[]> {
    return this.resenaModel
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  listarPorComercio(comercioId: string): Promise<ResenaDocument[]> {
    return this.resenaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .lean<ResenaDocument[]>()
      .exec();
  }

  guardarRespuesta(id: string, respuesta: string): Promise<ResenaDocument | null> {
    return this.resenaModel.findByIdAndUpdate(id, { respuesta }, { new: true }).exec();
  }

  /** Media de puntuación y total de reseñas de un servicio. */
  async agregadoServicio(servicioId: string): Promise<{ promedio: number; total: number }> {
    const [row] = await this.resenaModel.aggregate<{ promedio: number; total: number }>([
      { $match: { servicioId: new Types.ObjectId(servicioId) } },
      { $group: { _id: null, promedio: { $avg: '$puntuacion' }, total: { $sum: 1 } } },
    ]);
    return { promedio: row?.promedio ?? 0, total: row?.total ?? 0 };
  }
}
