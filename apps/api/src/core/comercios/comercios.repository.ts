import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerticalKey } from 'shared';
import { Comercio, ComercioDocument, EstadoComercio } from './comercio.schema';

export interface CrearComercioParams {
  razonSocial: string;
  vatNumber: string;
  nombreComercial: string;
  logoUrl?: string;
  verticales?: VerticalKey[];
}

@Injectable()
export class ComerciosRepository {
  constructor(
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
  ) {}

  async findById(id: string): Promise<ComercioDocument | null> {
    return this.comercioModel.findById(id).exec();
  }

  async findByVatNumber(vatNumber: string): Promise<ComercioDocument | null> {
    return this.comercioModel.findOne({ vatNumber }).exec();
  }

  async crear(params: CrearComercioParams): Promise<ComercioDocument> {
    const comercio = new this.comercioModel(params);
    return comercio.save();
  }

  async actualizarEstado(id: string, estado: EstadoComercio): Promise<ComercioDocument | null> {
    return this.comercioModel.findByIdAndUpdate(id, { estado }, { new: true }).exec();
  }

  async listar(filtros: { estado?: EstadoComercio } = {}): Promise<ComercioDocument[]> {
    return this.comercioModel.find(filtros).lean().exec() as Promise<ComercioDocument[]>;
  }
}
