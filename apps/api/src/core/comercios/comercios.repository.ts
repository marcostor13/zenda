import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comercio, ComercioDocument, EstadoComercio } from './comercio.schema';

export interface CrearComercioParams {
  razonSocial: string;
  ruc: string;
  nombreComercial: string;
  logoUrl?: string;
}

@Injectable()
export class ComerciosRepository {
  constructor(
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
  ) {}

  async findById(id: string): Promise<ComercioDocument | null> {
    return this.comercioModel.findById(id).exec();
  }

  async findByRuc(ruc: string): Promise<ComercioDocument | null> {
    return this.comercioModel.findOne({ ruc }).exec();
  }

  async crear(params: CrearComercioParams): Promise<ComercioDocument> {
    const comercio = new this.comercioModel(params);
    return comercio.save();
  }

  async actualizarEstado(id: string, estado: EstadoComercio): Promise<ComercioDocument | null> {
    return this.comercioModel.findByIdAndUpdate(id, { estado }, { new: true }).exec();
  }

  async listar(filtros: { estado?: EstadoComercio } = {}): Promise<ComercioDocument[]> {
    return this.comercioModel.find(filtros).lean().exec();
  }
}
