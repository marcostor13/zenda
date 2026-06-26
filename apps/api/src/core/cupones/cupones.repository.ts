import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cupon, CuponDocument } from './cupon.schema';

@Injectable()
export class CuponesRepository {
  constructor(
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
  ) {}

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

  async actualizar(id: string, datos: Partial<Cupon>): Promise<CuponDocument | null> {
    return this.cuponModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }

  async eliminar(id: string): Promise<void> {
    await this.cuponModel.findByIdAndDelete(id).exec();
  }

  async listar(): Promise<CuponDocument[]> {
    return this.cuponModel.find().sort({ createdAt: -1 }).lean().exec() as Promise<CuponDocument[]>;
  }
}
