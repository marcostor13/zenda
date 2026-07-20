import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorito, FavoritoDocument } from './favorito.schema';

@Injectable()
export class FavoritosRepository {
  constructor(
    @InjectModel(Favorito.name) private readonly favoritoModel: Model<FavoritoDocument>,
  ) {}

  /** Alta idempotente: si ya existe, devuelve el existente (upsert por índice único). */
  async agregar(usuarioId: string, servicioId: string): Promise<FavoritoDocument> {
    return this.favoritoModel
      .findOneAndUpdate(
        { usuarioId: new Types.ObjectId(usuarioId), servicioId: new Types.ObjectId(servicioId) },
        { $setOnInsert: { usuarioId: new Types.ObjectId(usuarioId), servicioId: new Types.ObjectId(servicioId) } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async eliminar(usuarioId: string, servicioId: string): Promise<void> {
    await this.favoritoModel
      .deleteOne({ usuarioId: new Types.ObjectId(usuarioId), servicioId: new Types.ObjectId(servicioId) })
      .exec();
  }

  /** IDs de servicio favoritos del usuario (para pintar el estado del corazón). */
  async listarServicioIds(usuarioId: string): Promise<string[]> {
    const docs = await this.favoritoModel
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ createdAt: -1 })
      .select('servicioId')
      .lean()
      .exec();
    return docs.map((d) => String(d.servicioId));
  }

  async contar(usuarioId: string): Promise<number> {
    return this.favoritoModel.countDocuments({ usuarioId: new Types.ObjectId(usuarioId) }).exec();
  }
}
