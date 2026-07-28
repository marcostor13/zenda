import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActualizarAlphaNivelDto, AlphaEstadoDto, AlphaNivelDto, ReservaEstado } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { AlphaRepository } from './alpha.repository';
import { AlphaNivelConfigDocument } from './alpha-nivel.schema';

@Injectable()
export class AlphaService {
  constructor(
    private readonly repo: AlphaRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
  ) {}

  listarNiveles(): Promise<AlphaNivelDto[]> {
    return this.repo.listarNiveles();
  }

  actualizarNivel(dto: ActualizarAlphaNivelDto, adminId: string): Promise<AlphaNivelConfigDocument> {
    return this.repo.upsert(
      dto.nivel,
      {
        nombre: dto.nombre,
        reservasRequeridas: dto.reservasRequeridas,
        descuentoPct: dto.descuentoPct,
        beneficios: dto.beneficios,
      },
      adminId,
    );
  }

  /** Nivel Alpha actual del usuario (por reservas COMPLETADA, no por puntos) y progreso al siguiente. */
  async obtenerEstado(usuarioId: string): Promise<AlphaEstadoDto> {
    const [niveles, reservasCompletadas] = await Promise.all([
      this.repo.listarNiveles(),
      this.reservaModel
        .countDocuments({ usuarioId: new Types.ObjectId(usuarioId), estado: ReservaEstado.COMPLETADA })
        .exec(),
    ]);

    const ordenados = [...niveles].sort((a, b) => a.reservasRequeridas - b.reservasRequeridas);
    const actual = [...ordenados].reverse().find((n) => reservasCompletadas >= n.reservasRequeridas) ?? ordenados[0];
    const siguiente = ordenados.find((n) => n.reservasRequeridas > reservasCompletadas) ?? null;

    return {
      nivelActual: actual.nivel,
      nombreNivel: actual.nombre,
      descuentoPct: actual.descuentoPct,
      beneficios: actual.beneficios,
      reservasCompletadas,
      reservasParaSiguiente: siguiente ? siguiente.reservasRequeridas - reservasCompletadas : null,
      siguienteNivel: siguiente,
      esMaximoNivel: !siguiente,
    };
  }
}
