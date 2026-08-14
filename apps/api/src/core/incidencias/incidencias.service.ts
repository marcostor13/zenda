import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActualizarIncidenciaDto, CrearIncidenciaDto, EstadoIncidencia, Rol, TipoIncidencia } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { UsersRepository } from '../users/users.repository';
import { IncidenciaDocument } from './incidencia.schema';
import { IncidenciasRepository } from './incidencias.repository';

@Injectable()
export class IncidenciasService {
  constructor(
    private readonly repo: IncidenciasRepository,
    private readonly usersRepo: UsersRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
  ) {}

  /**
   * Abre una incidencia. Si se refiere a una reserva se comprueba que quien la
   * abre esté en ella: si no, cualquiera podría reclamar sobre la reserva de
   * otro con sólo conocer el id.
   */
  async crear(usuarioId: string, rol: Rol, dto: CrearIncidenciaDto): Promise<IncidenciaDocument> {
    const usuario = await this.usersRepo.findById(usuarioId);
    if (!usuario) {
      throw new DomainException('Usuario no encontrado', 404);
    }

    const esComercio = rol === Rol.COMERCIO_ADMIN || rol === Rol.COMERCIO_STAFF;
    let reserva: ReservaDocument | null = null;

    if (dto.reservaId) {
      reserva = await this.reservaModel.findById(dto.reservaId).exec();
      if (!reserva) {
        throw new DomainException('Reserva no encontrada', 404);
      }
      const suya = esComercio
        ? String(reserva.comercioId) === String(usuario.comercioId)
        : String(reserva.usuarioId) === usuarioId;
      if (!suya) {
        throw new DomainException('Esa reserva no es tuya', 403);
      }
    }

    return this.repo.crear({
      reservaId: reserva?._id as Types.ObjectId | undefined,
      codigoReserva: reserva?.codigo,
      abiertaPorId: new Types.ObjectId(usuarioId),
      abiertaPorNombre: usuario.nombre,
      origen: esComercio ? 'comercio' : 'cliente',
      comercioId: esComercio && usuario.comercioId ? new Types.ObjectId(String(usuario.comercioId)) : reserva?.comercioId,
      tipo: dto.tipo,
      asunto: dto.asunto,
      descripcion: dto.descripcion,
      historial: [
        { estado: EstadoIncidencia.ABIERTA, por: usuario.nombre, at: new Date() },
      ],
    });
  }

  listar(
    filtros: { estado?: EstadoIncidencia; tipo?: TipoIncidencia; buscar?: string },
    page?: number,
    limite?: number,
  ): Promise<{ items: IncidenciaDocument[]; total: number }> {
    return this.repo.listar(filtros, page, limite);
  }

  listarPropias(usuarioId: string): Promise<IncidenciaDocument[]> {
    return this.repo.listarPorUsuario(usuarioId);
  }

  contarPorEstado(): Promise<Record<string, number>> {
    return this.repo.contarPorEstado();
  }

  /** Cada cambio de estado deja quién y cuándo: es el historial de actuaciones. */
  async actualizarEstado(
    id: string,
    dto: ActualizarIncidenciaDto,
    adminId: string,
  ): Promise<IncidenciaDocument> {
    // El nombre se resuelve aquí: el token sólo lleva el id, y el historial sin
    // nombre no sirve para saber quién tocó qué.
    const admin = await this.usersRepo.findById(adminId);
    const adminNombre = admin?.nombre ?? 'Administración';

    if (dto.estado === EstadoIncidencia.RESUELTA && !dto.resolucion?.trim()) {
      throw new DomainException('Para cerrar una incidencia hay que explicar cómo se resolvió', 400);
    }

    const incidencia = await this.repo.actualizarEstado(
      id,
      dto.estado,
      { estado: dto.estado, nota: dto.nota, por: adminNombre, at: new Date() },
      dto.resolucion,
    );

    if (!incidencia) {
      throw new DomainException('Incidencia no encontrada', 404);
    }
    return incidencia;
  }
}
