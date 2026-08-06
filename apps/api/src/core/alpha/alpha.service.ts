import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActualizarAlphaNivelDto, AlphaEstadoDto, AlphaNivelDto, ReservaEstado } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { AlphaRepository } from './alpha.repository';
import { AlphaNivelConfigDocument } from './alpha-nivel.schema';

/** Negocio adherido al programa Alpha tal como lo pinta el carrusel del perfil. */
export interface AlphaVentajaDto {
  id: string;
  nombre: string;
  ciudad: string;
  vertical: string;
  imagenes: string[];
}

@Injectable()
export class AlphaService {
  constructor(
    private readonly repo: AlphaRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
  ) {}

  listarNiveles(): Promise<AlphaNivelDto[]> {
    return this.repo.listarNiveles();
  }

  /** Escaparate de negocios adheridos al programa Alpha (HU-13.3). */
  async listarVentajas(): Promise<AlphaVentajaDto[]> {
    const servicios = await this.repo.listarVentajas();
    return servicios.map((s) => {
      const lean = s as unknown as Record<string, unknown>;
      return {
        id: String(lean['_id']),
        nombre: (lean['titulo'] as string) ?? '',
        ciudad: ((lean['ubicacion'] as { ciudad?: string } | undefined)?.ciudad) ?? '',
        vertical: (lean['vertical'] as string) ?? '',
        imagenes: (lean['imagenes'] as string[] | undefined) ?? [],
      };
    });
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
