import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { EstadoPresupuesto, VerticalKey } from 'shared';
import { BookingsService } from '../bookings/bookings.service';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Presupuesto, PresupuestoDocument } from './presupuesto.schema';
import { PresupuestosRepository } from './presupuestos.repository';

const HORAS_VALIDEZ_DEFECTO = 48;
const MS_POR_HORA = 60 * 60 * 1000;

export interface SolicitarPresupuestoParams {
  usuarioId: string;
  servicioId: string;
  perroId?: string;
  fechaServicio: Date;
  solicitud: Record<string, unknown>;
}

export interface OfertarPresupuestoParams {
  importe: number;
  condiciones?: string;
  /** Horas que la oferta sigue en pie; por defecto, las que declaró la empresa. */
  validezHoras?: number;
}

/**
 * El ciclo del precio a medida: solicitud → oferta → aceptación → reserva.
 *
 * La razón de ser del módulo es que el cliente **no vuelva a rellenar nada**.
 * La solicitud guarda el viaje entero tal y como lo describió, así que cuando
 * la empresa responde con un importe, aceptar es un botón y lo siguiente es
 * pagar. Sin esto, un trayecto internacional o con cuatro mascotas acababa en
 * «no disponible», que es perder una venta con el cliente dentro.
 */
@Injectable()
export class PresupuestosService {
  constructor(
    private readonly repo: PresupuestosRepository,
    private readonly bookings: BookingsService,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async solicitar(params: SolicitarPresupuestoParams): Promise<PresupuestoDocument> {
    const servicio = await this.servicioModel
      .findById(params.servicioId)
      .select('comercioId vertical validezPresupuestoHoras')
      .lean()
      .exec() as { comercioId: unknown; vertical: VerticalKey } | null;

    if (!servicio) throw new DomainException('Servicio no encontrado', 404);

    // Pulsar dos veces el botón no puede duplicar la petición en la bandeja de
    // la empresa: se devuelve la que ya estaba abierta.
    const abierto = await this.repo.abiertoDe(params.usuarioId, params.servicioId);
    if (abierto) return abierto;

    return this.repo.crear({
      codigo: `PRE-${nanoid(8).toUpperCase()}`,
      usuarioId: params.usuarioId as never,
      comercioId: servicio.comercioId as never,
      servicioId: params.servicioId as never,
      vertical: servicio.vertical,
      perroId: params.perroId as never,
      fechaServicio: params.fechaServicio,
      solicitud: params.solicitud,
      estado: EstadoPresupuesto.SOLICITADO,
    });
  }

  misPresupuestos(usuarioId: string): Promise<PresupuestoDocument[]> {
    return this.repo.delUsuario(usuarioId);
  }

  delComercio(comercioId: string, estado?: EstadoPresupuesto): Promise<PresupuestoDocument[]> {
    return this.repo.delComercio(comercioId, estado);
  }

  /** La empresa pone precio. A partir de aquí el cliente solo tiene que aceptar. */
  async ofertar(
    id: string,
    comercioId: string,
    params: OfertarPresupuestoParams,
  ): Promise<PresupuestoDocument> {
    const presupuesto = await this.buscar(id);
    this.exigirComercio(presupuesto, comercioId);

    if (presupuesto.estado !== EstadoPresupuesto.SOLICITADO
        && presupuesto.estado !== EstadoPresupuesto.OFERTADO) {
      throw new DomainException('Este presupuesto ya no admite ofertas.', 409);
    }
    if (!Number.isFinite(params.importe) || params.importe <= 0) {
      throw new DomainException('El importe del presupuesto debe ser mayor que 0', 400);
    }

    const horas = params.validezHoras ?? HORAS_VALIDEZ_DEFECTO;
    presupuesto.importe = Math.round(params.importe * 100) / 100;
    presupuesto.condiciones = params.condiciones;
    presupuesto.validoHasta = new Date(Date.now() + horas * MS_POR_HORA);
    presupuesto.estado = EstadoPresupuesto.OFERTADO;
    presupuesto.ofertadoAt = new Date();
    return presupuesto.save();
  }

  /**
   * El cliente acepta y la solicitud se convierte en reserva pendiente de pago.
   *
   * La reserva se crea con el importe pactado, no con el que saldría de las
   * tarifas: aquí no hay tarifa que valga, hay una oferta que el cliente vio y
   * aceptó. Lo demás —comisión, IVA, hold de disponibilidad— sigue el mismo
   * camino que cualquier otra reserva.
   */
  async aceptar(id: string, usuarioId: string): Promise<PresupuestoDocument> {
    const presupuesto = await this.buscar(id);
    this.exigirCliente(presupuesto, usuarioId);

    if (presupuesto.estado !== EstadoPresupuesto.OFERTADO) {
      throw new DomainException('Este presupuesto todavía no tiene una oferta que aceptar.', 409);
    }
    if (presupuesto.validoHasta && presupuesto.validoHasta.getTime() < Date.now()) {
      presupuesto.estado = EstadoPresupuesto.CADUCADO;
      await presupuesto.save();
      throw new DomainException('La oferta ha caducado; pide un presupuesto nuevo.', 409);
    }

    const reserva = await this.bookings.crear({
      usuarioId,
      servicioId: String(presupuesto.servicioId),
      perroId: presupuesto.perroId ? String(presupuesto.perroId) : undefined,
      fechaInicio: presupuesto.fechaServicio,
      detalle: { ...presupuesto.solicitud, presupuestoCodigo: presupuesto.codigo },
      precioAcordado: presupuesto.importe,
    });

    presupuesto.estado = EstadoPresupuesto.ACEPTADO;
    presupuesto.reservaId = reserva._id as never;
    presupuesto.resueltoAt = new Date();
    return presupuesto.save();
  }

  async rechazar(id: string, usuarioId: string, motivo?: string): Promise<PresupuestoDocument> {
    const presupuesto = await this.buscar(id);
    this.exigirCliente(presupuesto, usuarioId);

    if (presupuesto.estado === EstadoPresupuesto.ACEPTADO) {
      throw new DomainException('Este presupuesto ya se convirtió en reserva.', 409);
    }

    presupuesto.estado = EstadoPresupuesto.RECHAZADO;
    presupuesto.motivoRechazo = motivo;
    presupuesto.resueltoAt = new Date();
    return presupuesto.save();
  }

  private async buscar(id: string): Promise<PresupuestoDocument> {
    const presupuesto = await this.repo.porId(id);
    if (!presupuesto) throw new DomainException('Presupuesto no encontrado', 404);
    return presupuesto;
  }

  /** Multi-tenant: una empresa no puede tocar la petición de otra. */
  private exigirComercio(presupuesto: Presupuesto, comercioId: string): void {
    if (String(presupuesto.comercioId) !== String(comercioId)) {
      throw new DomainException('Este presupuesto no es de tu negocio', 403);
    }
  }

  private exigirCliente(presupuesto: Presupuesto, usuarioId: string): void {
    if (String(presupuesto.usuarioId) !== String(usuarioId)) {
      throw new DomainException('Este presupuesto no es tuyo', 403);
    }
  }
}
