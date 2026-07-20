import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva, ReservaDocument, SuplementoAplicado } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { CuponesService } from '../cupones/cupones.service';
import { PerrosService } from '../perros/perros.service';
import { construirSnapshotPerro } from '../perros/perro-snapshot.util';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado, IVA_RATE, COMISION_PCT_DEFAULT } from 'shared';
import { nanoid } from 'nanoid';

export interface SuplementoSolicitado {
  concepto: string;
  monto: number;
  motivo?: string;
}

export interface RecurrenciaParams {
  diasSemana: number[];
  hora: string;
  fechaFin: Date;
}

export interface CrearReservaParams {
  usuarioId: string;
  comercioId: string;
  servicioId: string;
  vertical: VerticalKey;
  perroId?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  comisionPct?: number;
  cuponCodigo?: string;
  recurrencia?: RecurrenciaParams;
}

const MAX_OCURRENCIAS_RECURRENCIA = 52;

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly availabilityRegistry: AvailabilityRegistry,
    private readonly cuponesService: CuponesService,
    private readonly perrosService: PerrosService,
  ) {}

  async crear(params: CrearReservaParams): Promise<ReservaDocument> {
    // Validar la recurrencia antes de tocar disponibilidad: falla rápido, no deja holds huérfanos.
    const ocurrenciasRecurrentes = params.recurrencia
      ? this.calcularOcurrenciasRecurrentes(params.fechaInicio, params.recurrencia)
      : [];

    const perroSnapshot = params.perroId
      ? construirSnapshotPerro(await this.perrosService.obtenerPropio(params.perroId, params.usuarioId))
      : undefined;

    const estrategia = this.availabilityRegistry.obtener(params.vertical);

    const disponibilidad = await estrategia.checkAvailability(params.servicioId, {
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      parametrosExtra: this.construirParametrosExtra(params.detalle, perroSnapshot),
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
    let montoSubtotal = precioBase;
    let descuentoMonto = 0;

    if (params.cuponCodigo) {
      const descuento = await this.cuponesService.validar(params.cuponCodigo, params.vertical, montoSubtotal);
      descuentoMonto = descuento.descuento;
      montoSubtotal = Math.round((montoSubtotal - descuentoMonto) * 100) / 100;
    }

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
      perroId: params.perroId,
      perroSnapshot,
      detalle: params.detalle ?? {},
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      montoSubtotal,
      comisionMonto,
      montoTotal,
      descuentoMonto,
      cuponCodigo: params.cuponCodigo,
      estado: ReservaEstado.PENDIENTE,
      holdId: hold.holdId,
    });

    const guardada = await reserva.save();

    if (ocurrenciasRecurrentes.length) {
      await this.reservaModel.insertMany(
        ocurrenciasRecurrentes.map((fecha) => ({
          codigo: this.generarCodigo(),
          usuarioId: params.usuarioId,
          comercioId: params.comercioId,
          servicioId: params.servicioId,
          vertical: params.vertical,
          perroId: params.perroId,
          perroSnapshot,
          detalle: params.detalle ?? {},
          fechaInicio: fecha,
          cantidad: params.cantidad ?? 1,
          montoSubtotal,
          comisionMonto,
          montoTotal,
          descuentoMonto,
          cuponCodigo: params.cuponCodigo,
          estado: ReservaEstado.PENDIENTE,
          reservaOrigenId: guardada._id,
        })),
      );
    }

    return guardada;
  }

  /**
   * Patrón simple de recurrencia (docs §4.3): NO revalida disponibilidad por ocurrencia
   * (no es un scheduler), solo genera reservas hija con los mismos datos/precio que la
   * reserva origen, en cada día de la semana solicitado hasta `fechaFin`.
   */
  private calcularOcurrenciasRecurrentes(fechaInicio: Date, recurrencia: RecurrenciaParams): Date[] {
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const [horas, minutos] = recurrencia.hora.split(':').map(Number);

    if (recurrencia.fechaFin.getTime() <= fechaInicio.getTime()) {
      throw new DomainException('La fecha de fin de la recurrencia debe ser posterior a la fecha de inicio', 400);
    }

    // UTC en todo el cálculo: `fechaFin`/`fechaInicio` llegan de strings ISO (parseadas en
    // UTC); mezclar con métodos locales (setHours/getDay) desplaza el resultado según el
    // huso horario del servidor.
    const ocurrencias: Date[] = [];
    let cursor = new Date(fechaInicio.getTime() + MS_POR_DIA);
    cursor.setUTCHours(0, 0, 0, 0);
    const fin = new Date(recurrencia.fechaFin);
    fin.setUTCHours(23, 59, 59, 999);

    while (cursor.getTime() <= fin.getTime()) {
      if (recurrencia.diasSemana.includes(cursor.getUTCDay())) {
        const ocurrencia = new Date(cursor);
        ocurrencia.setUTCHours(horas || 0, minutos || 0, 0, 0);
        ocurrencias.push(ocurrencia);

        if (ocurrencias.length > MAX_OCURRENCIAS_RECURRENCIA) {
          throw new DomainException(
            `La recurrencia generaría más de ${MAX_OCURRENCIAS_RECURRENCIA} reservas; acorta la fecha de fin`,
            400,
          );
        }
      }
      cursor = new Date(cursor.getTime() + MS_POR_DIA);
    }

    return ocurrencias;
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

    // El uso del cupón se contabiliza al confirmar la reserva (pago aprobado).
    if (reserva.cuponCodigo) {
      await this.cuponesService.aplicar(reserva.cuponCodigo);
    }

    // La serie recurrente comparte un único pago con la reserva origen: al confirmarse
    // esta, se confirman también todas sus reservas hija (docs §4.3).
    await this.reservaModel.updateMany(
      { reservaOrigenId: reserva._id, estado: ReservaEstado.PENDIENTE },
      { estado: ReservaEstado.CONFIRMADA },
    ).exec();

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

  /** El comercio marca como prestado un servicio ya confirmado. */
  async completar(reservaId: string, comercioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }

    if (reserva.estado !== ReservaEstado.CONFIRMADA) {
      throw new DomainException('Solo se pueden completar reservas confirmadas', 400);
    }

    reserva.estado = ReservaEstado.COMPLETADA;
    return reserva.save();
  }

  /** El comercio propone suplementos en recepción; la reserva queda pendiente de aprobación del cliente. */
  async solicitarAjuste(
    reservaId: string,
    comercioId: string,
    suplementos: SuplementoSolicitado[],
    evidenciaUrl?: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }

    if (reserva.estado !== ReservaEstado.CONFIRMADA) {
      throw new DomainException('Solo se puede solicitar un ajuste sobre una reserva confirmada', 400);
    }

    // Veterinaria factura pruebas/tratamientos extra directamente con el cliente, fuera de la
    // plataforma (docs/mejora_servicios.md §5); Doogking nunca comisiona esa parte.
    if (reserva.vertical === VerticalKey.VETERINARIA) {
      throw new DomainException(
        'En veterinaria, las pruebas y tratamientos adicionales se presupuestan y facturan directamente con la clínica, fuera de Doogking.',
        400,
      );
    }

    if (!suplementos.length) {
      throw new DomainException('Indica al menos un suplemento', 400);
    }

    const ahora = new Date();
    const nuevos: SuplementoAplicado[] = suplementos.map((s) => ({
      ...s,
      aplicadoPor: comercioId,
      evidenciaUrl,
      createdAt: ahora,
    }));

    const sumaSuplementos = suplementos.reduce((acc, s) => acc + s.monto, 0);
    const nuevoMontoSubtotal = Math.round((reserva.montoSubtotal + sumaSuplementos) * 100) / 100;
    const montoAjustado = Math.round(nuevoMontoSubtotal * (1 + IVA_RATE) * 100) / 100;

    reserva.suplementos.push(...nuevos);
    if (evidenciaUrl) {
      reserva.evidencias.push({ tipo: 'estado_llegada', url: evidenciaUrl, createdAt: ahora });
    }
    reserva.montoAjustado = montoAjustado;
    reserva.estado = ReservaEstado.AJUSTE_SOLICITADO;
    reserva.ajusteSolicitadoAt = ahora;

    return reserva.save();
  }

  /** Valida que el ajuste pertenezca al cliente y esté pendiente (lo usa PaymentsService antes de cobrar). */
  async validarAjustePendiente(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.obtenerDeUsuario(reservaId, usuarioId);

    if (reserva.estado !== ReservaEstado.AJUSTE_SOLICITADO) {
      throw new DomainException('No hay ningún ajuste pendiente de aprobar en esta reserva', 400);
    }

    return reserva;
  }

  /** Se llama al confirmarse el pago de la diferencia (webhook), nunca directamente desde el cliente. */
  async confirmarAjuste(reservaId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    // Idempotencia: si el webhook llega duplicado ya no hay ajuste pendiente.
    if (reserva.estado !== ReservaEstado.AJUSTE_SOLICITADO || reserva.montoAjustado === undefined) {
      return reserva;
    }

    const comisionPctEfectivo = reserva.montoSubtotal > 0 ? reserva.comisionMonto / reserva.montoSubtotal : COMISION_PCT_DEFAULT;
    const nuevoMontoSubtotal = Math.round((reserva.montoAjustado / (1 + IVA_RATE)) * 100) / 100;

    reserva.montoSubtotal = nuevoMontoSubtotal;
    reserva.comisionMonto = Math.round(nuevoMontoSubtotal * comisionPctEfectivo * 100) / 100;
    reserva.montoTotal = reserva.montoAjustado;
    reserva.montoAjustado = undefined;
    reserva.estado = ReservaEstado.CONFIRMADA;
    reserva.ajusteResueltoAt = new Date();

    return reserva.save();
  }

  /** El cliente rechaza el ajuste: se cancela la reserva (el reembolso lo dispara PaymentsService). */
  async rechazarAjuste(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.validarAjustePendiente(reservaId, usuarioId);

    reserva.estado = ReservaEstado.CANCELADA;
    reserva.montoAjustado = undefined;
    reserva.ajusteResueltoAt = new Date();

    return reserva.save();
  }

  async obtenerPorId(id: string): Promise<ReservaDocument | null> {
    return this.reservaModel.findById(id).exec();
  }

  async obtenerPorCodigo(codigo: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findOne({ codigo }).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }

    return reserva;
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

  /**
   * Enriquece los parámetros de disponibilidad con datos ya conocidos de la
   * Ficha del Perro (perroSnapshot), sin que el cliente tenga que volver a
   * indicarlos manualmente. Se añaden como claves nuevas (`perroTamano`,
   * `perroTipoPelo`, `perroPeso`, `perroEspecie`, `perroEsPPP`, `perroRaza`)
   * para no pisar campos que algún vertical ya reciba explícitamente en
   * `detalle` (ej. `tamanoPerro` de alojamiento).
   */
  private construirParametrosExtra(
    detalle: Record<string, unknown> | undefined,
    perroSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!perroSnapshot) return detalle;
    return {
      ...detalle,
      perroTamano: perroSnapshot['tamano'],
      perroTipoPelo: perroSnapshot['tipoPelo'],
      perroPeso: perroSnapshot['peso'],
      perroEspecie: perroSnapshot['especie'],
      perroEsPPP: perroSnapshot['esPPP'],
      perroRaza: perroSnapshot['raza'],
    };
  }
}
