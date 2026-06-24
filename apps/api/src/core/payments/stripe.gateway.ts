import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway,
  CrearIntentParams,
  PaymentIntentResult,
} from './payment-gateway.interface';

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

  construirEvento(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
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
