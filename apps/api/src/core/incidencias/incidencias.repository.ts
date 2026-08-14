import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EstadoIncidencia, TipoIncidencia } from 'shared';
import { ActuacionIncidencia, Incidencia, IncidenciaDocument } from './incidencia.schema';

export interface CrearIncidenciaData {
  reservaId?: Types.ObjectId;
  codigoReserva?: string;
  abiertaPorId: Types.ObjectId;
  abiertaPorNombre: string;
  origen: 'cliente' | 'comercio';
  comercioId?: Types.ObjectId;
  tipo: TipoIncidencia;
  asunto: string;
  descripcion: string;
  historial: ActuacionIncidencia[];
}

@Injectable()
export class IncidenciasRepository {
  constructor(
    @InjectModel(Incidencia.name) private readonly incidenciaModel: Model<IncidenciaDocument>,
  ) {}

  crear(datos: CrearIncidenciaData): Promise<IncidenciaDocument> {
    return this.incidenciaModel.create(datos);
  }

  findById(id: string): Promise<IncidenciaDocument | null> {
    return this.incidenciaModel.findById(id).exec();
  }

  async listar(
    filtros: { estado?: EstadoIncidencia; tipo?: TipoIncidencia; buscar?: string },
    page = 1,
    limite = 20,
  ): Promise<{ items: IncidenciaDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filtros.estado) query['estado'] = filtros.estado;
    if (filtros.tipo) query['tipo'] = filtros.tipo;
    if (filtros.buscar) {
      const escaped = filtros.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query['$or'] = [{ asunto: regex }, { abiertaPorNombre: regex }, { codigoReserva: regex }];
    }

    const skip = (page - 1) * limite;
    const [items, total] = await Promise.all([
      this.incidenciaModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite).lean<IncidenciaDocument[]>().exec(),
      this.incidenciaModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  listarPorUsuario(usuarioId: string): Promise<IncidenciaDocument[]> {
    return this.incidenciaModel
      .find({ abiertaPorId: new Types.ObjectId(usuarioId) })
      .sort({ createdAt: -1 })
      .lean<IncidenciaDocument[]>()
      .exec();
  }

  /** Cambia el estado y deja la actuación en el historial, en una sola escritura. */
  actualizarEstado(
    id: string,
    estado: EstadoIncidencia,
    actuacion: ActuacionIncidencia,
    resolucion?: string,
  ): Promise<IncidenciaDocument | null> {
    return this.incidenciaModel
      .findByIdAndUpdate(
        id,
        {
          $set: resolucion !== undefined ? { estado, resolucion } : { estado },
          $push: { historial: actuacion },
        },
        { new: true },
      )
      .exec();
  }

  async contarPorEstado(): Promise<Record<string, number>> {
    const filas = await this.incidenciaModel
      .aggregate<{ _id: string; total: number }>([{ $group: { _id: '$estado', total: { $sum: 1 } } }])
      .exec();
    return Object.fromEntries(filas.map((f) => [f._id, f.total]));
  }
}
