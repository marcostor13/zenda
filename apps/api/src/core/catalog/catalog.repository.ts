import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { MONEDA_DEFAULT, TamanoPerro, TipoPelo } from 'shared';
import { AptitudPerro, Servicio, ServicioDocument } from './servicio.schema';
import { Alojamiento } from '../../verticals/alojamiento/alojamiento.schema';
import { Transporte } from '../../verticals/transporte/transporte.schema';
import { Veterinaria } from '../../verticals/veterinaria/veterinaria.schema';
import { Peluqueria } from '../../verticals/peluqueria/peluqueria.schema';
import { Adiestramiento } from '../../verticals/adiestramiento/adiestramiento.schema';

export interface PerfilCompatibilidad {
  tamano?: TamanoPerro;
  tipoPelo?: TipoPelo[];
  temperamento?: string;
}

export interface BuscarServiciosParams {
  vertical?: string;
  ciudad?: string;
  precioMin?: number;
  precioMax?: number;
  page: number;
  limit: number;
  perfilPerro?: PerfilCompatibilidad;
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
  extra?: Record<string, unknown>;
  aptitud?: AptitudPerro;
}

export interface ActualizarServicioParams {
  titulo?: string;
  descripcion?: string;
  ciudad?: string;
  precioBase?: number;
  imagenes?: string[];
  extra?: Record<string, unknown>;
  aptitud?: AptitudPerro;
}

@Injectable()
export class CatalogRepository {
  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Alojamiento.name) private readonly alojamientoModel: Model<ServicioDocument>,
    @InjectModel(Transporte.name) private readonly transporteModel: Model<ServicioDocument>,
    @InjectModel(Veterinaria.name) private readonly veterinariaModel: Model<ServicioDocument>,
    @InjectModel(Peluqueria.name) private readonly peluqueriaModel: Model<ServicioDocument>,
    @InjectModel(Adiestramiento.name) private readonly adiestramientoModel: Model<ServicioDocument>,
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

  /** Actualiza sólo los campos de disponibilidad/cupos de un servicio (D1), sin tocar el resto. */
  async actualizarCampos(id: string, campos: Record<string, unknown>): Promise<ServicioDocument | null> {
    return this.servicioModel.findByIdAndUpdate(id, campos, { new: true }).lean().exec() as Promise<ServicioDocument | null>;
  }

  async crear(data: CrearServicioParams): Promise<ServicioDocument> {
    // El documento debe crearse con el modelo del discriminador correspondiente
    // para que Mongoose acepte y persista los campos propios del vertical
    // (espacios, tarifas, servicios clínicos/grooming…); el modelo base
    // `Servicio` desconoce esos campos y los descartaría silenciosamente.
    const Modelo = this.modeloPorVertical(data.vertical);
    const doc = new Modelo({
      vertical: data.vertical,
      titulo: data.titulo,
      descripcion: data.descripcion,
      ubicacion: { ciudad: data.ciudad },
      precioBase: data.precioBase,
      imagenes: data.imagenes,
      comercioId: new Types.ObjectId(data.comercioId),
      estado: 'borrador',
      moneda: MONEDA_DEFAULT,
      aptitud: data.aptitud,
      ...data.extra,
    });
    return doc.save() as unknown as Promise<ServicioDocument>;
  }

  /** Edita los datos base y los campos propios del vertical de un listado ya existente. */
  async actualizar(
    id: string,
    comercioId: string,
    data: ActualizarServicioParams,
  ): Promise<ServicioDocument | null> {
    const set: Record<string, unknown> = { ...data.extra };
    if (data.titulo !== undefined) set.titulo = data.titulo;
    if (data.descripcion !== undefined) set.descripcion = data.descripcion;
    if (data.ciudad !== undefined) set['ubicacion.ciudad'] = data.ciudad;
    if (data.precioBase !== undefined) set.precioBase = data.precioBase;
    if (data.imagenes !== undefined) set.imagenes = data.imagenes;
    if (data.aptitud !== undefined) set.aptitud = data.aptitud;

    return this.servicioModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), comercioId: new Types.ObjectId(comercioId) },
        { $set: set },
        { new: true },
      )
      .exec();
  }

  private modeloPorVertical(vertical: string): Model<ServicioDocument> {
    const mapa: Record<string, Model<ServicioDocument>> = {
      alojamiento: this.alojamientoModel,
      transporte: this.transporteModel,
      veterinaria: this.veterinariaModel,
      peluqueria: this.peluqueriaModel,
      adiestramiento: this.adiestramientoModel,
    };
    return mapa[vertical] ?? this.servicioModel;
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

    const condicionesAptitud = this.condicionesCompatibilidad(params.perfilPerro);
    if (condicionesAptitud.length) filtro.$and = condicionesAptitud;

    return filtro;
  }

  /**
   * Un array vacío/ausente en `aptitud` significa "sin restricción" en ese eje;
   * si el comercio declaró una lista, el perro debe encajar en ella.
   */
  private condicionesCompatibilidad(perfil?: PerfilCompatibilidad): FilterQuery<ServicioDocument>[] {
    if (!perfil) return [];
    const condiciones: FilterQuery<ServicioDocument>[] = [];

    if (perfil.tamano) {
      condiciones.push({
        $or: [
          { 'aptitud.tamanosAdmitidos': { $exists: false } },
          { 'aptitud.tamanosAdmitidos': { $size: 0 } },
          { 'aptitud.tamanosAdmitidos': perfil.tamano },
        ],
      });
    }

    if (perfil.tipoPelo?.length) {
      condiciones.push({
        $or: [
          { 'aptitud.tipoPeloAdmitido': { $exists: false } },
          { 'aptitud.tipoPeloAdmitido': { $size: 0 } },
          { 'aptitud.tipoPeloAdmitido': { $in: perfil.tipoPelo } },
        ],
      });
    }

    if (perfil.temperamento) {
      condiciones.push({ 'aptitud.temperamentosNoAdmitidos': { $ne: perfil.temperamento } });
    }

    return condiciones;
  }
}
