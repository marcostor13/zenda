import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva, ReservaDocument } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado, IVA_RATE, COMISION_PCT_DEFAULT } from 'shared';
import { nanoid } from 'nanoid';

export interface CrearReservaParams {
  usuarioId: string;
  comercioId: string;
  servicioId: string;
  vertical: VerticalKey;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  comisionPct?: number;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly availabilityRegistry: AvailabilityRegistry,
  ) {}

  async crear(params: CrearReservaParams): Promise<ReservaDocument> {
    const estrategia = this.availabilityRegistry.obtener(params.vertical);

    const disponibilidad = await estrategia.checkAvailability(params.servicioId, {
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
    });

    if (!disponibilidad.disponible) {
      throw new DomainException('El servicio no está disponible para las fechas seleccionadas', 409);
    }

    const hold = await estrategia.reserveSlot(params.servicioId, {
      usuarioId: params.usuarioId,
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
    });

    const precioBase = disponibilidad.precioCalculado ?? 0;
    const montoSubtotal = precioBase;
    const comisionPct = params.comisionPct ?? COMISION_PCT_DEFAULT;
    const comisionMonto = montoSubtotal * comisionPct;
    const iva = montoSubtotal * IVA_RATE;
    const montoTotal = montoSubtotal + iva;

    const reserva = new this.reservaModel({
      codigo: this.generarCodigo(),
      usuarioId: params.usuarioId,
      comercioId: params.comercioId,
      servicioId: params.servicioId,
      vertical: params.vertical,
      detalle: params.detalle ?? {},
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      montoSubtotal,
      comisionMonto,
      montoTotal,
      estado: ReservaEstado.PENDIENTE,
      holdId: hold.holdId,
    });

    return reserva.save();
  }

  async confirmar(reservaId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findByIdAndUpdate(
      reservaId,
      { estado: ReservaEstado.CONFIRMADA, holdId: undefined },
      { new: true },
    ).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    return reserva;
  }

  async cancelar(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para cancelar esta reserva', 403);
    }

    if (reserva.estado === ReservaEstado.CANCELADA) {
      throw new DomainException('La reserva ya está cancelada', 400);
    }

    if (reserva.holdId) {
      const estrategia = this.availabilityRegistry.obtener(reserva.vertical);
      await estrategia.releaseSlot(reserva.holdId);
    }

    reserva.estado = ReservaEstado.CANCELADA;
    return reserva.save();
  }

  async obtenerPorId(id: string): Promise<ReservaDocument | null> {
    return this.reservaModel.findById(id).exec();
  }

  async obtenerDeUsuario(id: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(id).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }

    return reserva;
  }

  async listarPorUsuario(usuarioId: string): Promise<ReservaDocument[]> {
    return this.reservaModel
      .find({ usuarioId })
      .sort({ createdAt: -1 })
      .exec() as Promise<ReservaDocument[]>;
  }

  private generarCodigo(): string {
    return `RES-${nanoid(8).toUpperCase()}`;
  }
}
