import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { ReservaEstado } from 'shared';
import { Cupon, CuponDocument } from './cupon.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';

/**
 * Una reserva cuenta como hecha cuando se ha pagado. Las que se quedaron sin
 * pagar o se cancelaron no gastan ni la «primera reserva» ni un uso del cupón.
 */
const ESTADOS_QUE_NO_CUENTAN = [ReservaEstado.PENDIENTE, ReservaEstado.CANCELADA];

@Injectable()
export class CuponesRepository {
  constructor(
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
  ) {}

  /** Reservas pagadas del cliente, con cupón o sin él. */
  async contarReservasPagadas(usuarioId: string): Promise<number> {
    return this.reservaModel
      .countDocuments({ usuarioId: new Types.ObjectId(usuarioId), estado: { $nin: ESTADOS_QUE_NO_CUENTAN } })
      .exec();
  }

  /** Cuántas veces ha gastado ya ese cliente ese cupón. */
  async contarUsosDe(codigo: string, usuarioId: string): Promise<number> {
    return this.reservaModel
      .countDocuments({
        usuarioId: new Types.ObjectId(usuarioId),
        estado: { $nin: ESTADOS_QUE_NO_CUENTAN },
        cuponCodigo: codigo.toUpperCase().trim(),
      })
      .exec();
  }

  async findByCodigo(codigo: string): Promise<CuponDocument | null> {
    return this.cuponModel.findOne({ codigo: codigo.toUpperCase().trim() }).exec();
  }

  async crear(datos: Partial<Cupon>): Promise<CuponDocument> {
    const cupon = new this.cuponModel(datos);
    return cupon.save();
  }

  async incrementarUso(codigo: string): Promise<void> {
    await this.cuponModel.updateOne({ codigo: codigo.toUpperCase().trim() }, { $inc: { usados: 1 } }).exec();
  }

  async actualizar(id: string, datos: UpdateQuery<CuponDocument>): Promise<CuponDocument | null> {
    return this.cuponModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }

  async eliminar(id: string): Promise<void> {
    await this.cuponModel.findByIdAndDelete(id).exec();
  }

  async listar(): Promise<CuponDocument[]> {
    return this.cuponModel.find().sort({ createdAt: -1 }).lean().exec() as Promise<CuponDocument[]>;
  }
}
