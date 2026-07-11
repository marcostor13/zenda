import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Servicio, ServicioDocument } from './servicio.schema';

export interface BuscarServiciosParams {
  vertical?: string;
  ciudad?: string;
  precioMin?: number;
  precioMax?: number;
  page: number;
  limit: number;
}

export interface BuscarServiciosResult {
  items: ServicioDocument[];
  total: number;
}

@Injectable()
export class CatalogRepository {
  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async buscar(params: BuscarServiciosParams): Promise<BuscarServiciosResult> {
    const filtro = this.construirFiltro(params);
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      this.servicioModel
        .find(filtro)
        .sort({ destacado: -1, prioridadRanking: -1, precioBase: 1 })
        .skip(skip)
        .limit(params.limit)
        .lean()
        .exec() as Promise<ServicioDocument[]>,
      this.servicioModel.countDocuments(filtro).exec(),
    ]);

    return { items, total };
  }

  async obtenerPorId(id: string): Promise<ServicioDocument | null> {
    return this.servicioModel.findById(id).lean().exec() as Promise<ServicioDocument | null>;
  }

  async contarTotal(): Promise<number> {
    return this.servicioModel.estimatedDocumentCount().exec();
  }

  async actualizarCampos(id: string, campos: Record<string, unknown>): Promise<ServicioDocument | null> {
    return this.servicioModel.findByIdAndUpdate(id, campos, { new: true }).lean().exec() as Promise<ServicioDocument | null>;
  }

  async crear(data: {
    vertical: string;
    titulo: string;
    descripcion: string;
    ciudad: string;
    precioBase: number;
    imagenes: string[];
    comercioId: string;
  }): Promise<ServicioDocument> {
    const doc = new this.servicioModel({
      vertical: data.vertical,
      titulo: data.titulo,
      descripcion: data.descripcion,
      ubicacion: { ciudad: data.ciudad },
      precioBase: data.precioBase,
      imagenes: data.imagenes,
      comercioId: new Types.ObjectId(data.comercioId),
      estado: 'borrador',
      moneda: 'PEN',
    });
    return doc.save() as unknown as Promise<ServicioDocument>;
  }

  private construirFiltro(params: BuscarServiciosParams): FilterQuery<ServicioDocument> {
    const filtro: FilterQuery<ServicioDocument> = { estado: 'publicado' };

    if (params.vertical) filtro.vertical = params.vertical;
    if (params.ciudad) filtro['ubicacion.ciudad'] = new RegExp(params.ciudad, 'i');

    if (params.precioMin != null || params.precioMax != null) {
      filtro.precioBase = {};
      if (params.precioMin != null) filtro.precioBase.$gte = params.precioMin;
      if (params.precioMax != null) filtro.precioBase.$lte = params.precioMax;
    }

    return filtro;
  }
}
