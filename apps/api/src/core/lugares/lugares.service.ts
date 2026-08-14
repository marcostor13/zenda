import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ActualizarLugarDto, CrearLugarDto, CrearLugarReviewDto, EstadoModeracion, ModerarDto, TipoLugar,
} from 'shared';
import { Lugar, LugarDocument } from './lugar.schema';
import { LugarReview, LugarReviewDocument } from './lugar-review.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

export interface BuscarLugaresParams {
  tipo?: TipoLugar;
  ciudad?: string;
  provincia?: string;
  /** Ordena por cercanía a este punto; requiere lat y lng. */
  lat?: number;
  lng?: number;
  radioKm?: number;
  limit?: number;
}

const LIMITE_POR_DEFECTO = 24;
const LIMITE_MAXIMO = 60;
const RADIO_POR_DEFECTO_KM = 25;

@Injectable()
export class LugaresService {
  constructor(
    @InjectModel(Lugar.name) private readonly lugarModel: Model<LugarDocument>,
    @InjectModel(LugarReview.name) private readonly reviewModel: Model<LugarReviewDocument>,
  ) {}

  /** Solo devuelve lo aprobado: el contenido pendiente no es público. */
  async buscar(params: BuscarLugaresParams): Promise<LugarDocument[]> {
    const limit = Math.min(LIMITE_MAXIMO, Math.max(1, params.limit ?? LIMITE_POR_DEFECTO));
    const filtro: FilterQuery<LugarDocument> = { estado: EstadoModeracion.PUBLICADO };

    if (params.tipo) filtro.tipo = params.tipo;
    if (params.ciudad) filtro['ubicacion.ciudad'] = new RegExp(params.ciudad, 'i');
    if (params.provincia) filtro['ubicacion.provincia'] = new RegExp(params.provincia, 'i');

    if (params.lat != null && params.lng != null) {
      const radioMetros = (params.radioKm ?? RADIO_POR_DEFECTO_KM) * 1000;
      filtro['ubicacion.geo'] = {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [params.lng, params.lat] },
          $maxDistance: radioMetros,
        },
      };
      // `$nearSphere` ya devuelve ordenado por distancia: añadir `sort` lo rompería.
      return this.lugarModel.find(filtro).limit(limit).exec();
    }

    return this.lugarModel
      .find(filtro)
      .sort({ ratingPromedio: -1, totalReviews: -1 })
      .limit(limit)
      .exec();
  }

  async obtener(id: string): Promise<LugarDocument> {
    const lugar = await this.lugarModel.findById(this.aObjectId(id)).exec();

    if (!lugar || lugar.estado !== EstadoModeracion.PUBLICADO) {
      throw new DomainException('Lugar no encontrado', 404);
    }
    return lugar;
  }

  /**
   * Alta aportada por un usuario. Nace **pendiente de moderación**: publicar
   * directamente lo que envía cualquiera expondría a la plataforma a contenido
   * falso o inapropiado.
   */
  async crear(dto: CrearLugarDto, usuarioId: string): Promise<LugarDocument> {
    return this.lugarModel.create({
      tipo: dto.tipo,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? '',
      fotos: dto.fotos ?? [],
      ubicacion: {
        ciudad: dto.ciudad,
        provincia: dto.provincia,
        direccion: dto.direccion,
        ...(dto.lat != null && dto.lng != null
          ? { geo: { type: 'Point' as const, coordinates: [dto.lng, dto.lat] } }
          : {}),
      },
      atributos: dto.atributos ?? {},
      estado: EstadoModeracion.PENDIENTE,
      creadoPor: new Types.ObjectId(usuarioId),
    });
  }

  /**
   * Corrección de datos aportada por la comunidad (HU-043). Vuelve a pasar por
   * moderación: si no, editar sería la puerta trasera para publicar sin revisión.
   */
  async proponerCambios(id: string, dto: ActualizarLugarDto): Promise<LugarDocument> {
    const lugar = await this.lugarModel.findById(this.aObjectId(id)).exec();
    if (!lugar) {
      throw new DomainException('Lugar no encontrado', 404);
    }

    if (dto.nombre !== undefined) lugar.nombre = dto.nombre;
    if (dto.descripcion !== undefined) lugar.descripcion = dto.descripcion;
    if (dto.fotos !== undefined) lugar.fotos = dto.fotos;
    if (dto.atributos !== undefined) lugar.atributos = { ...lugar.atributos, ...dto.atributos };

    lugar.estado = EstadoModeracion.PENDIENTE;
    return lugar.save();
  }

  // ── Aportaciones de la comunidad ──

  async listarReviews(lugarId: string): Promise<LugarReviewDocument[]> {
    return this.reviewModel
      .find({ lugarId: this.aObjectId(lugarId), estado: EstadoModeracion.PUBLICADO })
      .sort({ createdAt: -1 })
      .exec();
  }

  async crearReview(
    lugarId: string,
    usuarioId: string,
    usuarioNombre: string,
    dto: CrearLugarReviewDto,
  ): Promise<LugarReviewDocument> {
    await this.obtener(lugarId);

    try {
      return await this.reviewModel.create({
        lugarId: this.aObjectId(lugarId),
        usuarioId: new Types.ObjectId(usuarioId),
        usuarioNombre,
        puntuacion: dto.puntuacion,
        texto: dto.texto ?? '',
        fotos: dto.fotos ?? [],
        esIncidencia: dto.esIncidencia ?? false,
        estado: EstadoModeracion.PENDIENTE,
      });
    } catch (error) {
      // Índice único: ya valoró este lugar.
      if ((error as { code?: number }).code === 11000) {
        throw new DomainException('Ya has valorado este lugar', 409);
      }
      throw error;
    }
  }

  // ── Moderación (admin) ──

  /**
   * Contenido de la comunidad por estado. El admin no sólo aprueba: también
   * tiene que poder volver sobre lo ya publicado o rechazado (TCK-8039).
   */
  async listarPendientes(
    estado: EstadoModeracion = EstadoModeracion.PENDIENTE,
  ): Promise<{ lugares: LugarDocument[]; reviews: LugarReviewDocument[] }> {
    // Lo pendiente se atiende por antigüedad; lo ya resuelto interesa al revés.
    const orden = estado === EstadoModeracion.PENDIENTE ? 1 : -1;
    const [lugares, reviews] = await Promise.all([
      this.lugarModel.find({ estado }).sort({ createdAt: orden }).limit(100).exec(),
      this.reviewModel.find({ estado }).sort({ createdAt: orden }).limit(100).exec(),
    ]);
    return { lugares, reviews };
  }

  /** Cuántos hay en cada estado, para los contadores de las pestañas. */
  async contarPorEstado(): Promise<Record<string, number>> {
    const estados = Object.values(EstadoModeracion);
    const conteos = await Promise.all(
      estados.map(async (estado) => {
        const [lugares, reviews] = await Promise.all([
          this.lugarModel.countDocuments({ estado }).exec(),
          this.reviewModel.countDocuments({ estado }).exec(),
        ]);
        return [estado, lugares + reviews] as const;
      }),
    );
    return Object.fromEntries(conteos);
  }

  async moderarLugar(id: string, dto: ModerarDto): Promise<LugarDocument> {
    const lugar = await this.lugarModel
      .findByIdAndUpdate(
        this.aObjectId(id),
        { $set: { estado: dto.estado, motivoRechazo: dto.motivoRechazo } },
        { new: true },
      )
      .exec();

    if (!lugar) {
      throw new DomainException('Lugar no encontrado', 404);
    }
    return lugar;
  }

  async moderarReview(id: string, dto: ModerarDto): Promise<LugarReviewDocument> {
    const review = await this.reviewModel
      .findByIdAndUpdate(this.aObjectId(id), { $set: { estado: dto.estado } }, { new: true })
      .exec();

    if (!review) {
      throw new DomainException('Aportación no encontrada', 404);
    }

    // La puntuación media solo cuenta valoraciones ya aprobadas.
    await this.recalcularRating(review.lugarId.toString());
    return review;
  }

  /** Recalcula la media del lugar a partir de sus valoraciones publicadas. */
  private async recalcularRating(lugarId: string): Promise<void> {
    const publicadas = await this.reviewModel
      .find({
        lugarId: this.aObjectId(lugarId),
        estado: EstadoModeracion.PUBLICADO,
        esIncidencia: false,
      })
      .select('puntuacion')
      .lean()
      .exec();

    const total = publicadas.length;
    const media = total
      ? Math.round((publicadas.reduce((suma, r) => suma + r.puntuacion, 0) / total) * 10) / 10
      : 0;

    await this.lugarModel
      .updateOne({ _id: this.aObjectId(lugarId) }, { $set: { ratingPromedio: media, totalReviews: total } })
      .exec();
  }

  private aObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new DomainException('Identificador no válido', 400);
    }
    return new Types.ObjectId(id);
  }
}
