import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EstadoPresupuesto } from 'shared';
import { Presupuesto, PresupuestoDocument } from './presupuesto.schema';

/** Todo el acceso a la colección de presupuestos; el service no toca Mongoose. */
@Injectable()
export class PresupuestosRepository {
  constructor(
    @InjectModel(Presupuesto.name) private readonly modelo: Model<PresupuestoDocument>,
  ) {}

  crear(datos: Partial<Presupuesto>): Promise<PresupuestoDocument> {
    return new this.modelo(datos).save();
  }

  porId(id: string): Promise<PresupuestoDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.modelo.findById(id).exec();
  }

  porCodigo(codigo: string): Promise<PresupuestoDocument | null> {
    return this.modelo.findOne({ codigo }).exec();
  }

  delUsuario(usuarioId: string): Promise<PresupuestoDocument[]> {
    return this.modelo.find({ usuarioId }).sort({ createdAt: -1 }).limit(100).exec();
  }

  delComercio(comercioId: string, estado?: EstadoPresupuesto): Promise<PresupuestoDocument[]> {
    return this.modelo
      .find({ comercioId, ...(estado ? { estado } : {}) })
      .sort({ createdAt: 1 })
      .limit(200)
      .exec();
  }

  /**
   * ¿Tiene ya este cliente una solicitud abierta para este servicio?
   *
   * Evita que pulsar dos veces «solicitar presupuesto» llene la bandeja de la
   * empresa con la misma petición repetida.
   */
  abiertoDe(usuarioId: string, servicioId: string): Promise<PresupuestoDocument | null> {
    return this.modelo.findOne({
      usuarioId,
      servicioId,
      estado: { $in: [EstadoPresupuesto.SOLICITADO, EstadoPresupuesto.OFERTADO] },
    }).exec();
  }
}
