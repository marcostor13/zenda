import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
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

export interface CrearServicioParams {
  vertical: string;
  titulo: string;
  descripcion: string;
  ciudad: string;
  precioBase: number;
  imagenes: string[];
  comercioId: string;
  detalle: Record<string, unknown>;
}

export interface ActualizarServicioParams {
  titulo?: string;
  descripcion?: string;
  ciudad?: string;
  precioBase?: number;
  imagenes?: string[];
  detalle?: Record<string, unknown>;
}

/** Nombre del discriminador Mongoose registrado en catalog.module.ts para cada vertical. */
const DISCRIMINATOR_NAME: Record<string, string> = {
  [VerticalKey.ALOJAMIENTO]: 'Alojamiento',
  [VerticalKey.TRANSPORTE]: 'Transporte',
  [VerticalKey.VETERINARIA]: 'Veterinaria',
  [VerticalKey.PELUQUERIA]: 'Peluqueria',
  [VerticalKey.ADIESTRAMIENTO]: 'Adiestramiento',
};

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

  async obtenerPorIdYComercio(id: string, comercioId: string): Promise<ServicioDocument | null> {
    return this.servicioModel
      .findOne({ _id: new Types.ObjectId(id), comercioId: new Types.ObjectId(comercioId) })
      .lean()
      .exec() as Promise<ServicioDocument | null>;
  }

  async contarTotal(): Promise<number> {
    return this.servicioModel.estimatedDocumentCount().exec();
  }

  async crear(data: CrearServicioParams): Promise<ServicioDocument> {
    const Modelo = this.modeloDiscriminado(data.vertical);
    const doc = new Modelo({
      vertical: data.vertical,
      titulo: data.titulo,
      descripcion: data.descripcion,
      ubicacion: { ciudad: data.ciudad },
      precioBase: data.precioBase,
      imagenes: data.imagenes,
      comercioId: new Types.ObjectId(data.comercioId),
      estado: 'borrador',
      moneda: 'EUR',
      ...data.detalle,
    });
    return doc.save() as unknown as Promise<ServicioDocument>;
  }

  async actualizar(
    id: string,
    comercioId: string,
    data: ActualizarServicioParams,
  ): Promise<ServicioDocument | null> {
    const set: Record<string, unknown> = { ...data.detalle };
    if (data.titulo !== undefined) set.titulo = data.titulo;
    if (data.descripcion !== undefined) set.descripcion = data.descripcion;
    if (data.ciudad !== undefined) set['ubicacion.ciudad'] = data.ciudad;
    if (data.precioBase !== undefined) set.precioBase = data.precioBase;
    if (data.imagenes !== undefined) set.imagenes = data.imagenes;

    return this.servicioModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), comercioId: new Types.ObjectId(comercioId) },
        { $set: set },
        { new: true },
      )
      .exec();
  }

  /** Selecciona el modelo discriminador correcto para que Mongoose persista los campos propios del vertical. */
  private modeloDiscriminado(vertical: string): Model<ServicioDocument> {
    const nombre = DISCRIMINATOR_NAME[vertical];
    const discriminadores = this.servicioModel.discriminators as
      | Record<string, Model<ServicioDocument>>
      | undefined;
    return (nombre && discriminadores?.[nombre]) || this.servicioModel;
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
