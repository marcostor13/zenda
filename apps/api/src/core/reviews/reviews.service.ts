import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { ReviewsRepository } from './reviews.repository';
import { ResenaDocument } from './resena.schema';
import { ActualizarReviewDto, CrearReviewDto } from './dto/reviews.dto';
import { GrowthService } from '../eventos/growth.service';

// Estados de reserva sobre los que se permite reseñar (servicio ya prestado o en firme).
const ESTADOS_RESENABLES: ReservaEstado[] = [ReservaEstado.CONFIRMADA, ReservaEstado.COMPLETADA];

export interface PendienteDeValorarDto {
  reservaId: string;
  servicioId: string;
  servicioTitulo: string;
  vertical: string;
  imagen: string | null;
  fechaInicio: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly growthService: GrowthService,
  ) {}

  async crear(usuarioId: string, dto: CrearReviewDto): Promise<ResenaDocument> {
    const reserva = await this.reservaModel.findById(dto.reservaId).exec();
    if (!reserva || reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('Reserva no encontrada', 404);
    }
    if (!ESTADOS_RESENABLES.includes(reserva.estado)) {
      throw new DomainException('Solo puedes reseñar reservas confirmadas o completadas', 400);
    }
    if (await this.repo.findByReserva(dto.reservaId)) {
      throw new DomainException('Ya has reseñado esta reserva', 409);
    }

    const [servicio, usuario] = await Promise.all([
      this.servicioModel.findById(reserva.servicioId).select('titulo').lean().exec(),
      this.usuarioModel.findById(usuarioId).select('nombre').lean().exec(),
    ]);

    const resena = await this.repo.crear({
      reservaId: reserva._id,
      servicioId: reserva.servicioId,
      comercioId: reserva.comercioId,
      usuarioId: reserva.usuarioId,
      usuarioNombre: usuario?.nombre ?? 'Usuario',
      servicioTitulo: servicio?.titulo ?? '',
      vertical: reserva.vertical,
      puntuacion: dto.puntuacion,
      comentario: dto.comentario,
      aspectos: dto.aspectos,
      fotos: dto.fotos,
    });

    await this.recalcularRatingServicio(reserva.servicioId.toString());

    // Cierra la solicitud automática: sin esto, el recordatorio de los 3 días
    // llegaría a alguien que ya ha valorado.
    await this.growthService.marcarCompletada(reserva._id.toString());

    return resena;
  }

  listarPorServicio(servicioId: string): Promise<ResenaDocument[]> {
    return this.repo.listarPorServicio(servicioId);
  }

  listarPorUsuario(usuarioId: string): Promise<ResenaDocument[]> {
    return this.repo.listarPorUsuario(usuarioId);
  }

  listarPorComercio(comercioId: string): Promise<ResenaDocument[]> {
    return this.repo.listarPorComercio(comercioId);
  }

  async actualizar(usuarioId: string, resenaId: string, dto: ActualizarReviewDto): Promise<ResenaDocument> {
    const resena = await this.repo.findById(resenaId);
    if (!resena || resena.usuarioId.toString() !== usuarioId || resena.eliminada) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    const actualizada = await this.repo.actualizar(resenaId, {
      puntuacion: dto.puntuacion,
      comentario: dto.comentario,
      aspectos: dto.aspectos,
      fotos: dto.fotos,
    });
    if (!actualizada) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    if (dto.puntuacion !== undefined) {
      await this.recalcularRatingServicio(resena.servicioId.toString());
    }
    return actualizada;
  }

  async eliminar(usuarioId: string, resenaId: string): Promise<void> {
    const resena = await this.repo.findById(resenaId);
    if (!resena || resena.usuarioId.toString() !== usuarioId) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    await this.repo.eliminar(resenaId);
    await this.recalcularRatingServicio(resena.servicioId.toString());
  }

  /** Reservas confirmadas/completadas del usuario que todavía no tienen reseña (HU-11.2). */
  async pendientesDeValorar(usuarioId: string): Promise<PendienteDeValorarDto[]> {
    const [reservas, reservaIdsReseñados] = await Promise.all([
      this.reservaModel
        .find({ usuarioId: new Types.ObjectId(usuarioId), estado: { $in: ESTADOS_RESENABLES } })
        .select('servicioId vertical fechaInicio')
        .sort({ fechaInicio: -1 })
        .lean()
        .exec(),
      this.repo.listarReservaIdsReseñados(usuarioId),
    ]);

    const yaReseñados = new Set(reservaIdsReseñados);
    const pendientes = reservas.filter((r) => !yaReseñados.has(String(r._id)));
    if (pendientes.length === 0) return [];

    const servicioIds = pendientes.map((r) => r.servicioId);
    const servicios = await this.servicioModel
      .find({ _id: { $in: servicioIds } })
      .select('titulo imagenes')
      .lean()
      .exec();
    const porServicio = new Map(servicios.map((s) => [String(s._id), s]));

    return pendientes.map((r) => {
      const servicio = porServicio.get(String(r.servicioId));
      return {
        reservaId: String(r._id),
        servicioId: String(r.servicioId),
        servicioTitulo: servicio?.titulo ?? '',
        vertical: r.vertical,
        imagen: servicio?.imagenes?.[0] ?? null,
        fechaInicio: r.fechaInicio.toISOString(),
      };
    });
  }

  async responder(resenaId: string, comercioId: string, respuesta: string): Promise<ResenaDocument> {
    const resena = await this.repo.findById(resenaId);
    if (!resena || resena.comercioId.toString() !== comercioId) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    const actualizada = await this.repo.guardarRespuesta(resenaId, respuesta);
    if (!actualizada) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    return actualizada;
  }

  /** Recalcula ratingPromedio y totalReseñas del servicio tras una nueva reseña. */
  private async recalcularRatingServicio(servicioId: string): Promise<void> {
    const { promedio, total } = await this.repo.agregadoServicio(servicioId);
    await this.servicioModel
      .findByIdAndUpdate(new Types.ObjectId(servicioId), {
        ratingPromedio: Math.round(promedio * 10) / 10,
        totalReseñas: total,
      })
      .exec();
  }

  /** Todas las reseñas para el panel admin, ocultas incluidas (TCK-8040 §3). */
  listarParaAdmin(
    filtros: { buscar?: string; ocultas?: boolean; puntuacion?: number },
    page?: number,
    limite?: number,
  ): Promise<{ items: ResenaDocument[]; total: number }> {
    return this.repo.listarParaAdmin(filtros, page, limite);
  }

  /**
   * Oculta o repone una reseña desde administración. Al cambiar la visibilidad
   * hay que recalcular la media del servicio: si no, un comercio seguiría
   * arrastrando la nota de una reseña que ya no se ve.
   */
  async fijarOcultaComoAdmin(id: string, oculta: boolean): Promise<ResenaDocument> {
    const resena = await this.repo.fijarOculta(id, oculta);
    if (!resena) {
      throw new DomainException('Reseña no encontrada', 404);
    }
    await this.recalcularRatingServicio(String(resena.servicioId));
    return resena;
  }
}
