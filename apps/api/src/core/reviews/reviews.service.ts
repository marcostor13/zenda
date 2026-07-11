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
import { CrearReviewDto } from './dto/reviews.dto';

// Estados de reserva sobre los que se permite reseñar (servicio ya prestado o en firme).
const ESTADOS_RESENABLES: ReservaEstado[] = [ReservaEstado.CONFIRMADA, ReservaEstado.COMPLETADA];

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
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
    });

    await this.recalcularRatingServicio(reserva.servicioId.toString());
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
}
