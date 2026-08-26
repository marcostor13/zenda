import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway,
  ConsultaIntent,
  CrearIntentParams,
  EstadoIntent,
  PaymentIntentResult,
} from './payment-gateway.interface';

/**
 * Traducción de los estados de Stripe.
 *
 * `requires_payment_method` no se da por fallido: es el estado en el que queda
 * un intento tras un rechazo recuperable, y el cliente aún puede reintentar con
 * otra tarjeta. Marcarlo como fallido cerraría un cobro que sigue vivo.
 */
const ESTADOS: Record<string, EstadoIntent> = {
  succeeded: 'succeeded',
  canceled: 'failed',
};

@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(StripeGateway.name);

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-02-24.acacia',
    });
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  async crearIntent(params: CrearIntentParams): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.montoEnCentavos,
      currency: params.moneda.toLowerCase(),
      metadata: {
        reservaId: params.reservaId,
        usuarioId: params.usuarioId,
        ...params.metadata,
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      intentId: intent.id,
      clientSecret: intent.client_secret!,
    };
  }

  async consultarIntent(intentId: string): Promise<ConsultaIntent> {
    const intent = await this.stripe.paymentIntents.retrieve(intentId);
    return {
      estado: ESTADOS[intent.status] ?? 'other',
      chargeId: typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
    };
  }

  construirEvento(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  async reembolsar(paymentIntentId: string): Promise<void> {
    await this.stripe.refunds.create({ payment_intent: paymentIntentId });
  }

  extraerIntentDeEvento(evento: unknown): { intentId: string; estado: 'succeeded' | 'failed' | 'other'; chargeId?: string } | null {
    const stripeEvento = evento as Stripe.Event;

    if (stripeEvento.type === 'payment_intent.succeeded') {
      const intent = stripeEvento.data.object as Stripe.PaymentIntent;
      const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined;
      return { intentId: intent.id, estado: 'succeeded', chargeId };
    }

    if (stripeEvento.type === 'payment_intent.payment_failed') {
      const intent = stripeEvento.data.object as Stripe.PaymentIntent;
      return { intentId: intent.id, estado: 'failed' };
    }

    return null;
  }
}
