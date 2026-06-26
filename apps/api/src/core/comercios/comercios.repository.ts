import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerticalKey } from 'shared';
import { Comercio, ComercioDocument, EstadoComercio, PlanComercio } from './comercio.schema';

export interface CrearComercioParams {
  razonSocial: string;
  vatNumber: string;
  nombreComercial: string;
  logoUrl?: string;
  verticales?: VerticalKey[];
  plan?: PlanComercio;
  estado?: EstadoComercio;
}

export interface ActualizarComercioParams {
  razonSocial?: string;
  nombreComercial?: string;
  logoUrl?: string;
  verticales?: VerticalKey[];
  plan?: PlanComercio;
  estado?: EstadoComercio;
  comisionPctOverride?: number;
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

  async actualizar(id: string, datos: ActualizarComercioParams): Promise<ComercioDocument | null> {
    return this.comercioModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }

  async eliminar(id: string): Promise<void> {
    await this.comercioModel.findByIdAndDelete(id).exec();
  }

  async actualizarEstado(id: string, estado: EstadoComercio): Promise<ComercioDocument | null> {
    return this.comercioModel.findByIdAndUpdate(id, { estado }, { new: true }).exec();
  }

  async listar(filtros: { estado?: EstadoComercio } = {}): Promise<ComercioDocument[]> {
    return this.comercioModel.find(filtros).sort({ createdAt: -1 }).lean().exec() as Promise<ComercioDocument[]>;
  }

  async listarPaginado(
    filtros: { estado?: EstadoComercio; buscar?: string },
    page = 1,
    limite = 20,
  ): Promise<{ items: ComercioDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filtros.estado) query['estado'] = filtros.estado;
    if (filtros.buscar) {
      const escaped = filtros.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query['$or'] = [{ nombreComercial: regex }, { razonSocial: regex }, { vatNumber: regex }];
    }
    const skip = (page - 1) * limite;
    const [items, total] = await Promise.all([
      this.comercioModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite).lean().exec() as Promise<ComercioDocument[]>,
      this.comercioModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }
}
