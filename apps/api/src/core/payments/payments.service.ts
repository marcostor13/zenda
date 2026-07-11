import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pago, PagoDocument } from './pago.schema';
import { PaymentGateway, PAYMENT_GATEWAY } from './payment-gateway.interface';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PagoEstado, PaymentIntentResponseDto, IVA_RATE } from 'shared';
import { ReservaDocument } from '../bookings/reserva.schema';

export interface DesglosePago {
  montoSubtotal: number;
  ivaMonto: number;
  montoTotal: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
    private readonly comisionConfigRepo: ComisionConfigRepository,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async crearIntent(reservaId: string, usuarioId: string): Promise<PaymentIntentResponseDto> {
    const reserva = await this.bookingsService.obtenerPorId(reservaId);

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No autorizado para pagar esta reserva', 403);
    }

    const pagoExistente = await this.pagoModel
      .findOne({ reservaId, estado: PagoEstado.INICIADO })
      .exec();

    if (pagoExistente) {
      return {
        clientSecret: pagoExistente.stripeMetadata?.clientSecret as string,
        pagoId: pagoExistente.id,
        montoTotal: pagoExistente.montoTotal,
        moneda: pagoExistente.moneda,
      };
    }

    const desglose = await this.calcularDesglose(reserva);

    const montoEnCentavos = Math.round(desglose.montoTotal * 100);

    const intent = await this.paymentGateway.crearIntent({
      montoEnCentavos,
      moneda: reserva.moneda,
      reservaId,
      usuarioId,
    });

    const pago = await new this.pagoModel({
      reservaId,
      usuarioId,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
      montoSubtotal: desglose.montoSubtotal,
      ivaMonto: desglose.ivaMonto,
      comisionPlataforma: desglose.comisionPlataforma,
      stripeFee: desglose.stripeFee,
      montoLiquidacion: desglose.montoLiquidacion,
      estado: PagoEstado.INICIADO,
      stripePaymentIntentId: intent.intentId,
      stripeMetadata: { clientSecret: intent.clientSecret },
    }).save();

    return {
      clientSecret: intent.clientSecret,
      pagoId: pago.id,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
    };
  }

  async procesarWebhook(payload: Buffer, signature: string): Promise<void> {
    let evento: unknown;

    try {
      evento = this.paymentGateway.construirEvento(payload, signature);
    } catch {
      throw new DomainException('Firma de webhook inválida', 400);
    }

    const resultado = this.paymentGateway.extraerIntentDeEvento(evento);
    if (!resultado) return;

    const pago = await this.pagoModel
      .findOne({ stripePaymentIntentId: resultado.intentId })
      .exec();

    if (!pago) {
      this.logger.warn(`Pago no encontrado para intentId: ${resultado.intentId}`);
      return;
    }

    // Idempotencia: ignorar si ya fue procesado
    if (pago.estado !== PagoEstado.INICIADO) {
      this.logger.log(`Pago ${pago.id} ya procesado (estado: ${pago.estado}). Ignorando.`);
      return;
    }

    if (resultado.estado === 'succeeded') {
      pago.estado = PagoEstado.APROBADO;
      pago.stripeChargeId = resultado.chargeId;
      await pago.save();
      await this.bookingsService.confirmar(pago.reservaId.toString());
      this.logger.log(`Reserva ${pago.reservaId} confirmada tras pago exitoso.`);
      // No await: un fallo de email no debe demorar/afectar la respuesta al webhook de Stripe.
      void this.notificationsService.notificarReservaConfirmada(pago.reservaId.toString());
    }

    if (resultado.estado === 'failed') {
      pago.estado = PagoEstado.RECHAZADO;
      await pago.save();
      this.logger.log(`Pago ${pago.id} fallido. SlotHold se liberará por TTL.`);
    }
  }

  async calcularDesglose(reserva: ReservaDocument): Promise<DesglosePago> {
    const config = await this.comisionConfigRepo.obtenerComisionEfectiva(reserva.vertical);

    const montoSubtotal = reserva.montoSubtotal;
    const ivaMonto = Math.round(montoSubtotal * IVA_RATE * 100) / 100;
    const montoTotal = Math.round((montoSubtotal + ivaMonto) * 100) / 100;
    const comisionPlataforma = Math.round(montoSubtotal * config.comisionPct * 100) / 100;
    const stripeFee = Math.round((montoTotal * config.stripePct + config.stripeFijoEur) * 100) / 100;
    const montoLiquidacion = Math.round((montoTotal - comisionPlataforma - stripeFee) * 100) / 100;

    return { montoSubtotal, ivaMonto, montoTotal, comisionPlataforma, stripeFee, montoLiquidacion };
  }
}
