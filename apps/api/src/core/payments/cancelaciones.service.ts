import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PagoEstado, ReservaEstado } from 'shared';
import { Pago, PagoDocument } from './pago.schema';
import { PaymentGateway, PAYMENT_GATEWAY } from './payment-gateway.interface';
import { BookingsService } from '../bookings/bookings.service';
import { ReservaDocument } from '../bookings/reserva.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PoliticaReembolso } from '../availability/availability.strategy';

/** Lo que el cliente ve antes de confirmar la cancelación. */
export interface VistaPreviaCancelacion {
  porcentaje: number;
  importe: number;
  motivo: string;
}

const redondear = (importe: number): number => Math.round(importe * 100) / 100;

/**
 * Cancelaciones con dinero de por medio: la del cliente según la política del
 * vertical, el rechazo del comercio a un viaje que tenía que aceptar y el
 * vencimiento del plazo de aceptación.
 *
 * Vive en pagos y no en reservas porque es quien puede devolver el dinero, y
 * `payments` ya depende de `bookings` (al revés sería un ciclo).
 */
@Injectable()
export class CancelacionesService {
  private readonly logger = new Logger(CancelacionesService.name);

  constructor(
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly bookings: BookingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async vistaPrevia(reservaId: string, usuarioId: string): Promise<VistaPreviaCancelacion> {
    const reserva = await this.bookings.cancelablePorCliente(reservaId, usuarioId);
    const politica = await this.politicaSegunEstado(reserva);
    return { ...politica, importe: this.importeReembolso(reserva, politica) };
  }

  /** El cliente cancela: se devuelve lo que diga la política y se le avisa. */
  async cancelarPorCliente(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.bookings.cancelablePorCliente(reservaId, usuarioId);
    const politica = await this.politicaSegunEstado(reserva);
    const importe = await this.reembolsar(reserva, this.importeReembolso(reserva, politica));

    const cancelada = await this.bookings.marcarCancelada(reserva, {
      por: `cliente:${usuarioId}`,
      motivo: politica.motivo,
      reembolso: { porcentaje: politica.porcentaje, importe },
    });
    void this.notifications.notificarCancelacion(reservaId);
    return cancelada;
  }

  /** El comercio no puede hacer el viaje: se devuelve todo. */
  async rechazarViaje(reservaId: string, comercioId: string, motivo?: string): Promise<ReservaDocument> {
    const reserva = await this.bookings.pendienteDeAceptar(reservaId, comercioId);
    return this.cancelarConDevolucionTotal(reserva, {
      por: `comercio:${comercioId}`,
      motivo: motivo || 'El transportista no puede hacer este viaje.',
      aceptacion: 'rechazada',
    });
  }

  /**
   * Cada cinco minutos: los viajes pagados que nadie aceptó a tiempo se
   * cancelan y se devuelven. «Sin aceptación, sin cargo».
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async caducarAceptaciones(): Promise<number> {
    const vencidas = await this.bookings.aceptacionesVencidas();
    for (const reserva of vencidas) {
      try {
        await this.cancelarConDevolucionTotal(reserva, {
          por: 'sistema',
          motivo: 'El transportista no aceptó el viaje a tiempo.',
          aceptacion: 'caducada',
        });
      } catch (error) {
        this.logger.error(`No se pudo caducar la aceptación de ${reserva._id}`, error);
      }
    }
    return vencidas.length;
  }

  private async cancelarConDevolucionTotal(
    reserva: ReservaDocument,
    params: { por: string; motivo: string; aceptacion: 'rechazada' | 'caducada' },
  ): Promise<ReservaDocument> {
    const importe = await this.reembolsar(reserva, reserva.montoTotal);
    const cancelada = await this.bookings.marcarCancelada(reserva, {
      ...params,
      reembolso: { porcentaje: 100, importe },
    });
    void this.notifications.notificarAceptacion(reserva._id.toString(), false, importe);
    return cancelada;
  }

  /** Una reserva sin pagar se cancela sin más: no hay nada que devolver. */
  private async politicaSegunEstado(reserva: ReservaDocument): Promise<PoliticaReembolso> {
    if (reserva.estado === ReservaEstado.PENDIENTE) {
      return { porcentaje: 0, motivo: 'La reserva no llegó a pagarse.' };
    }
    return this.bookings.politicaCancelacion(reserva);
  }

  private importeReembolso(reserva: ReservaDocument, politica: PoliticaReembolso): number {
    if (reserva.estado === ReservaEstado.PENDIENTE) return 0;
    return redondear(reserva.montoTotal * Math.min(100, Math.max(0, politica.porcentaje)) / 100);
  }

  /**
   * Devuelve `importe` del cobro de la reserva. Un pago de prueba (bypass) no
   * tiene intent en Stripe: se anota igual para que la reserva cuente la verdad.
   * Devuelve lo que se ha podido devolver.
   */
  private async reembolsar(reserva: ReservaDocument, importe: number): Promise<number> {
    if (importe <= 0) return 0;
    const pago = await this.pagoModel
      .findOne({
        $or: [{ reservaId: reserva._id }, { reservaIds: reserva._id }],
        estado: PagoEstado.APROBADO,
        esSuplemento: false,
      })
      .sort({ createdAt: -1 })
      .exec();
    if (!pago) return 0;

    const devolver = redondear(Math.min(importe, pago.montoTotal - (pago.importeReembolsado ?? 0)));
    if (devolver <= 0) return 0;

    if (pago.stripePaymentIntentId && !pago.esPrueba) {
      await this.gateway.reembolsar(pago.stripePaymentIntentId, devolver);
    }
    pago.importeReembolsado = redondear((pago.importeReembolsado ?? 0) + devolver);
    if (pago.importeReembolsado >= pago.montoTotal) pago.estado = PagoEstado.REEMBOLSADO;
    await pago.save();
    return devolver;
  }
}
