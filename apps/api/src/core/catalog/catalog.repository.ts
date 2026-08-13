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

export type OrdenServicios = 'relevancia' | 'precio_asc' | 'precio_desc' | 'valoracion' | 'distancia';

/**
 * Rectángulo visible del mapa (búsqueda por zona, estilo Booking). Se nombra
 * por sus esquinas suroeste y noreste porque es lo que devuelve `getBounds()`
 * de Leaflet, y así el frontend no tiene que traducir nada.
 */
export interface BboxParams {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface BuscarServiciosParams {
  vertical?: string;
  ciudad?: string;
  precioMin?: number;
  precioMax?: number;
  page: number;
  limit: number;
  perfilPerro?: PerfilCompatibilidad;
  orden?: OrdenServicios;
  /** Punto de referencia del usuario; obligatorio para ordenar por distancia. */
  lat?: number;
  lng?: number;
  /** Descarta lo que no se puede reservar ahora mismo (P2). */
  soloDisponibles?: boolean;
  /** Recorta la búsqueda al rectángulo que el usuario tiene delante en el mapa. */
  bbox?: BboxParams;
}

/** Pin del mapa: lo mínimo para dibujarlo y reconocerlo sin cargar la ficha entera. */
export interface PuntoServicio {
  id: string;
  titulo: string;
  precio: number;
  lat: number;
  lng: number;
  rating: number;
  imagen?: string;
}

/**
 * Tope de pines por consulta. El mapa no puede dibujar miles de marcadores sin
 * bloquear el hilo, y por encima de esta cifra el usuario ya no distingue nada:
 * lo correcto es que acerque el zoom, no que le enviemos el catálogo entero.
 */
const LIMITE_PUNTOS_MAPA = 300;

/** Contador de plazas libres de cada vertical: su nombre cambia según la categoría. */
const CAMPO_DISPONIBILIDAD: Record<string, string> = {
  alojamiento: 'espaciosDisponibles',
  hoteles: 'unidadesDisponibles',
  // Seguros no tiene contador de plazas: su "disponibilidad" es la elegibilidad
  // de la mascota, que solo se puede evaluar con un perro concreto delante.
  seguros: '',
  transporte: 'unidadesDisponibles',
  veterinaria: 'citasDisponibles',
  peluqueria: 'cuposDisponibles',
  adiestramiento: 'cuposDisponibles',
  cuidadores: 'cuposDisponibles',
};

const ORDEN_SORT: Record<Exclude<OrdenServicios, 'distancia'>, Record<string, 1 | -1>> = {
  relevancia: { destacado: -1, prioridadRanking: -1, precioBase: 1 },
  precio_asc: { precioBase: 1 },
  precio_desc: { precioBase: -1 },
  valoracion: { ratingPromedio: -1, totalReseñas: -1 },
};

/** Facetas de la búsqueda (PDF 27/07 §3, WA0009): contadores y distribución de precios. */
export interface FacetasResult {
  /** Histograma de precios por tramo, para el slider de presupuesto. */
  precios: Array<{ desde: number; hasta: number; n: number }>;
  /** Recuento por amenity, para los contadores de los checkboxes ("Parking 514"). */
  amenities: Array<{ valor: string; n: number }>;
  /** Recuento acumulado por valoración mínima (>=3, >=4, >=5). */
  valoracion: Array<{ minimo: number; n: number }>;
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
  /** Coordenadas del listado; sin ellas no aparece en la búsqueda por mapa. */
  lat?: number;
  lng?: number;
}

export interface ActualizarServicioParams {
  titulo?: string;
  descripcion?: string;
  ciudad?: string;
  precioBase?: number;
  imagenes?: string[];
  extra?: Record<string, unknown>;
  aptitud?: AptitudPerro;
  lat?: number;
  lng?: number;
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
    if (params.orden === 'distancia' && params.lat != null && params.lng != null) {
      const porDistancia = await this.buscarPorDistancia({
        ...params, lat: params.lat, lng: params.lng,
      });
      // Un servicio sin coordenadas no entra en `$geoNear`. Si ningún listado
      // las tiene todavía, es mejor devolver el orden por defecto que dejar la
      // pantalla vacía; el usuario pidió ordenar, no filtrar.
      if (porDistancia.total > 0) return porDistancia;
    }

    const filtro = this.construirFiltro(params);
    const skip = (params.page - 1) * params.limit;
    const sort = ORDEN_SORT[(params.orden as Exclude<OrdenServicios, 'distancia'>) ?? 'relevancia']
      ?? ORDEN_SORT.relevancia;

    const [items, total] = await Promise.all([
      this.servicioModel
        .find(filtro)
        .sort(sort)
        .skip(skip)
        .limit(params.limit)
        .lean()
        .exec() as Promise<ServicioDocument[]>,
      this.servicioModel.countDocuments(filtro).exec(),
    ]);

    return { items, total };
  }

  /**
   * Facetas de la búsqueda actual (PDF 27/07 §3): histograma de precios para el
   * slider, contadores por amenity y por valoración mínima. El filtro base
   * ignora el propio rango de precio a propósito — el histograma describe el
   * paisaje completo del destino, como en Booking, no solo el tramo elegido.
   */
  async facetas(params: BuscarServiciosParams): Promise<FacetasResult> {
    const filtro = this.construirFiltro({ ...params, precioMin: undefined, precioMax: undefined });

    interface FacetasCrudas {
      precios: Array<{ _id: { min: number; max: number }; n: number }>;
      amenities: Array<{ _id: string; n: number }>;
      valoracion: Array<{ tres: number; cuatro: number; cinco: number }>;
    }

    const [crudas] = await this.servicioModel.aggregate<FacetasCrudas>([
      { $match: filtro },
      {
        $facet: {
          precios: [
            { $match: { precioBase: { $type: 'number' } } },
            { $bucketAuto: { groupBy: '$precioBase', buckets: 16, output: { n: { $sum: 1 } } } },
          ],
          amenities: [
            { $unwind: '$amenities' },
            { $group: { _id: '$amenities', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
          ],
          valoracion: [
            {
              $group: {
                _id: null,
                tres:   { $sum: { $cond: [{ $gte: ['$ratingPromedio', 3] }, 1, 0] } },
                cuatro: { $sum: { $cond: [{ $gte: ['$ratingPromedio', 4] }, 1, 0] } },
                cinco:  { $sum: { $cond: [{ $gte: ['$ratingPromedio', 5] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ]).exec();

    const valoracion = crudas?.valoracion?.[0];
    return {
      precios: (crudas?.precios ?? []).map((b) => ({ desde: b._id.min, hasta: b._id.max, n: b.n })),
      amenities: (crudas?.amenities ?? []).map((a) => ({ valor: a._id, n: a.n })),
      valoracion: valoracion
        ? [
            { minimo: 3, n: valoracion.tres },
            { minimo: 4, n: valoracion.cuatro },
            { minimo: 5, n: valoracion.cinco },
          ]
        : [],
    };
  }

  /**
   * Orden por cercanía real usando el índice `2dsphere`. `$geoNear` debe ser la
   * primera etapa del pipeline, por eso no reutiliza el `find` de arriba.
   */
  private async buscarPorDistancia(
    params: BuscarServiciosParams & { lat: number; lng: number },
  ): Promise<BuscarServiciosResult> {
    const filtro = this.construirFiltro(params);
    const skip = (params.page - 1) * params.limit;

    const [resultado] = await this.servicioModel.aggregate<{
      items: ServicioDocument[];
      total: Array<{ n: number }>;
    }>([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [params.lng, params.lat] },
          distanceField: 'distanciaMetros',
          spherical: true,
          query: filtro,
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: params.limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]).exec();

    return { items: resultado?.items ?? [], total: resultado?.total?.[0]?.n ?? 0 };
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
      ubicacion: { ciudad: data.ciudad, geo: this.aGeoJson(data.lat, data.lng) },
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

    const geo = this.aGeoJson(data.lat, data.lng);
    if (geo) set['ubicacion.geo'] = geo;

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

  /**
   * Punto GeoJSON para el índice `2dsphere`, que guarda [lng, lat] y no al
   * revés. Devuelve `undefined` si falta alguna de las dos: un punto a medias
   * rompería el índice, y el servicio debe poder publicarse sin coordenadas.
   */
  private aGeoJson(lat?: number, lng?: number): { type: 'Point'; coordinates: [number, number] } | undefined {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return { type: 'Point', coordinates: [lng as number, lat as number] };
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

    // La zona del mapa manda sobre la ciudad escrita: si el usuario arrastró el
    // mapa hasta otra comarca, quiere ver lo que hay ahí, no lo que casaba con
    // el texto que tecleó antes.
    const zona = this.condicionZona(params.bbox);
    if (zona) {
      delete filtro['ubicacion.ciudad'];
      filtro['ubicacion.geo'] = zona;
    }

    if (params.precioMin != null || params.precioMax != null) {
      filtro.precioBase = {};
      if (params.precioMin != null) filtro.precioBase.$gte = params.precioMin;
      if (params.precioMax != null) filtro.precioBase.$lte = params.precioMax;
    }

    const condiciones = this.condicionesCompatibilidad(params.perfilPerro);

    const condicionDisponible = this.condicionDisponibilidad(params);
    if (condicionDisponible) condiciones.push(condicionDisponible);

    if (condiciones.length) filtro.$and = condiciones;

    return filtro;
  }

  /**
   * Traduce el rectángulo del mapa a un polígono GeoJSON para el índice
   * `2dsphere`. Se descarta un rectángulo degenerado (esquinas invertidas o
   * coordenadas fuera de rango): MongoDB lo rechazaría con un error de consulta
   * y tumbaría la búsqueda entera por un dato de interfaz mal formado.
   */
  private condicionZona(bbox?: BboxParams): FilterQuery<ServicioDocument> | null {
    if (!bbox) return null;

    const { swLat, swLng, neLat, neLng } = bbox;
    const finitos = [swLat, swLng, neLat, neLng].every(Number.isFinite);
    const enRango = Math.abs(swLat) <= 90 && Math.abs(neLat) <= 90
      && Math.abs(swLng) <= 180 && Math.abs(neLng) <= 180;
    if (!finitos || !enRango || swLat >= neLat || swLng >= neLng) return null;

    return {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[
            [swLng, swLat],
            [neLng, swLat],
            [neLng, neLat],
            [swLng, neLat],
            [swLng, swLat],
          ]],
        },
      },
    };
  }

  /**
   * Pines de la zona visible. Va aparte de `buscar` porque el mapa y la lista
   * responden a necesidades distintas: la lista se pagina de diez en diez, pero
   * el mapa tiene que enseñar todo lo que hay en pantalla o el usuario creería
   * que la zona está vacía.
   */
  async puntos(params: BuscarServiciosParams): Promise<PuntoServicio[]> {
    const filtro = this.construirFiltro(params);
    // Sin coordenadas no hay pin que pintar; pedirlas aquí evita traer
    // documentos que luego habría que descartar en memoria.
    filtro['ubicacion.geo.coordinates'] = { $exists: true, $ne: null };

    const docs = await this.servicioModel
      .find(filtro)
      .select('titulo precioBase ubicacion.geo ratingPromedio imagenes')
      .limit(LIMITE_PUNTOS_MAPA)
      .lean()
      .exec();

    return docs.flatMap((doc) => {
      const coordenadas = (doc as unknown as {
        ubicacion?: { geo?: { coordinates?: number[] } };
      }).ubicacion?.geo?.coordinates;
      // GeoJSON guarda [lng, lat]; el mapa espera el orden inverso.
      const [lng, lat] = coordenadas ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

      const lean = doc as unknown as {
        _id: unknown; titulo: string; precioBase: number;
        ratingPromedio?: number; imagenes?: string[];
      };
      return [{
        id: String(lean._id),
        titulo: lean.titulo,
        precio: lean.precioBase,
        lat: lat as number,
        lng: lng as number,
        rating: Math.round((lean.ratingPromedio ?? 0) * 10) / 10,
        imagen: lean.imagenes?.[0],
      }];
    });
  }

  /**
   * Descarta los servicios sin plazas libres (P2). Un contador ausente se trata
   * como "sin declarar" y no oculta el listado: solo se esconde el que dice
   * explícitamente que está a cero.
   */
  private condicionDisponibilidad(params: BuscarServiciosParams): FilterQuery<ServicioDocument> | null {
    if (!params.soloDisponibles) return null;

    const campos = params.vertical
      ? [CAMPO_DISPONIBILIDAD[params.vertical]].filter(Boolean)
      : [...new Set(Object.values(CAMPO_DISPONIBILIDAD))].filter(Boolean);
    if (!campos.length) return null;

    return {
      $or: campos.flatMap((campo) => [
        { [campo]: { $exists: false } },
        { [campo]: { $gt: 0 } },
      ]),
    };
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
