import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PerroValoracion, PerroValoracionDocument } from './perro-valoracion.schema';
import { Perro, PerroDocument } from './perro.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { ReservaEstado, VerticalKey, CrearPerroValoracionDto } from 'shared';

const NIVEL_DOOGKING_MIN = 1;
const NIVEL_DOOGKING_MAX = 5;

export interface IndiceComportamiento {
  puntuacionPromedio: number;
  totalValoraciones: number;
  atributosPromedio: Record<string, number>;
}

@Injectable()
export class PerroValoracionesService {
  constructor(
    @InjectModel(PerroValoracion.name)
    private readonly valoracionModel: Model<PerroValoracionDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
  ) {}

  async crear(
    perroId: string,
    comercioId: string,
    dto: CrearPerroValoracionDto,
  ): Promise<PerroValoracionDocument> {
    const reserva = await this.validarReserva(perroId, comercioId, dto.reservaId);

    const existente = await this.valoracionModel.findOne({ reservaId: dto.reservaId }).exec();
    if (existente) {
      throw new DomainException('Ya se valoró esta reserva', 409);
    }

    const valoracion = await this.valoracionModel.create({
      perroId,
      comercioId,
      reservaId: dto.reservaId,
      vertical: reserva.vertical,
      puntuacion: dto.puntuacion,
      atributos: dto.atributos ?? {},
      comentario: dto.comentario,
    });

    if (reserva.vertical === VerticalKey.ADIESTRAMIENTO) {
      await this.actualizarNivelDoogking(perroId, dto.atributos);
    }

    return valoracion;
  }

  /**
   * "Nivel Doogking" (docs/mejora_servicios.md §3.5): un centro de adiestramiento puede
   * proponer, tras completar una sesión, el nivel actual del perro (1-Cachorro a
   * 5-Excelente sociabilidad). No es un promedio: refleja la valoración más reciente.
   */
  private async actualizarNivelDoogking(perroId: string, atributos?: Record<string, number>): Promise<void> {
    const nivel = atributos?.['nivelDoogking'];
    if (nivel === undefined) return;
    if (!Number.isInteger(nivel) || nivel < NIVEL_DOOGKING_MIN || nivel > NIVEL_DOOGKING_MAX) return;

    await this.perroModel.updateOne({ _id: perroId }, { $set: { nivelDoogking: nivel } }).exec();
  }

  listarPorPerro(perroId: string): Promise<PerroValoracionDocument[]> {
    return this.valoracionModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Resumen público (sin datos sensibles) que cualquier profesional puede consultar al reservar. */
  async indiceComportamiento(perroId: string): Promise<IndiceComportamiento> {
    const valoraciones = await this.valoracionModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .lean()
      .exec();

    if (!valoraciones.length) {
      return { puntuacionPromedio: 0, totalValoraciones: 0, atributosPromedio: {} };
    }

    const sumaAtributos: Record<string, { total: number; count: number }> = {};
    let sumaPuntuacion = 0;

    for (const v of valoraciones) {
      sumaPuntuacion += v.puntuacion;
      for (const [clave, valor] of Object.entries(v.atributos ?? {})) {
        sumaAtributos[clave] ??= { total: 0, count: 0 };
        sumaAtributos[clave].total += valor;
        sumaAtributos[clave].count += 1;
      }
    }

    const atributosPromedio: Record<string, number> = {};
    for (const [clave, { total, count }] of Object.entries(sumaAtributos)) {
      atributosPromedio[clave] = Math.round((total / count) * 10) / 10;
    }

    return {
      puntuacionPromedio: Math.round((sumaPuntuacion / valoraciones.length) * 10) / 10,
      totalValoraciones: valoraciones.length,
      atributosPromedio,
    };
  }

  private async validarReserva(
    perroId: string,
    comercioId: string,
    reservaId: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }
    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }
    if (!reserva.perroId || reserva.perroId.toString() !== perroId) {
      throw new DomainException('Esta reserva no corresponde a ese perro', 400);
    }
    if (reserva.estado !== ReservaEstado.COMPLETADA) {
      throw new DomainException('Solo se puede valorar tras completar el servicio', 400);
    }

    return reserva;
  }
}
