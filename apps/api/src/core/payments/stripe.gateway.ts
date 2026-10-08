import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// El SDK se publica en CommonJS como `module.exports = Stripe`, sin `.default`:
// un `import Stripe from` compila (allowSyntheticDefaultImports) y revienta al arrancar.
import Stripe = require('stripe');
import {
  PaymentGateway,
  ConsultaIntent,
  CrearIntentParams,
  EstadoIntent,
  IncidenciaPasarela,
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
  processing: 'processing',
  canceled: 'failed',
};

/**
 * Métodos que **no** se ofrecen aunque estén activos en el panel de Stripe.
 *
 * Son los de confirmación diferida: el cliente termina el pago hoy y Stripe
 * tarda días en decir si el dinero ha entrado (un adeudo SEPA, hasta dos
 * semanas; Multibanco u OXXO, cuando el cliente pase por el cajero). Una reserva
 * retiene la plaza con un `SlotHold` que caduca en minutos, así que con estos
 * métodos el cobro llegaría con la plaza ya liberada —o con la estancia ya
 * pasada—. El resto (tarjeta, carteras, redirecciones bancarias, pago aplazado)
 * confirma en el momento y los decide el panel de Stripe, sin tocar código.
 */
const METODOS_DE_CONFIRMACION_DIFERIDA = [
  'sepa_debit',
  'bacs_debit',
  'acss_debit',
  'au_becs_debit',
  'nz_bank_account',
  'us_bank_account',
  'payto',
  'sofort',
  'multibanco',
  'boleto',
  'oxxo',
  'konbini',
  'customer_balance',
] as const;

/**
 * Los eventos a los que tiene que estar suscrito el webhook en Stripe: justo
 * los que entienden `extraerIntentDeEvento` y `extraerIncidenciaDeEvento`.
 * `diagnostico:stripe` compara esta lista con la del panel y la corrige.
 */
export const EVENTOS_DE_WEBHOOK = [
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'refund.failed',
  'charge.dispute.created',
] as const;

const aEuros = (centimos: number): number => centimos / 100;

/** Un campo expandible de Stripe llega como id o como objeto entero, según la llamada. */
const idDe = (campo: string | { id: string } | null | undefined): string | undefined =>
  typeof campo === 'string' ? campo : campo?.id;

@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    // Sin `apiVersion`: el SDK fija la suya, que es contra la que están
    // generados sus tipos. Declarar otra a mano los deja mintiendo.
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  async crearIntent(params: CrearIntentParams): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.montoEnCentavos,
      currency: params.moneda.toLowerCase(),
      description: params.descripcion,
      metadata: {
        reservaId: params.reservaId,
        usuarioId: params.usuarioId,
        ...params.metadata,
      },
      automatic_payment_methods: { enabled: true },
      excluded_payment_method_types: [...METODOS_DE_CONFIRMACION_DIFERIDA],
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
      chargeId: idDe(intent.latest_charge),
    };
  }

  construirEvento(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  async reembolsar(
    paymentIntentId: string,
    importeEur?: number,
    claveIdempotencia?: string,
  ): Promise<void> {
    await this.stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        // Stripe cuenta en céntimos; sin `amount` devuelve el cobro entero.
        ...(importeEur !== undefined ? { amount: Math.round(importeEur * 100) } : {}),
      },
      claveIdempotencia ? { idempotencyKey: claveIdempotencia } : undefined,
    );
  }

  extraerIntentDeEvento(evento: unknown): { intentId: string; estado: EstadoIntent; chargeId?: string } | null {
    const stripeEvento = evento as Stripe.Event;

    switch (stripeEvento.type) {
      case 'payment_intent.succeeded': {
        const intent = stripeEvento.data.object;
        return { intentId: intent.id, estado: 'succeeded', chargeId: idDe(intent.latest_charge) };
      }
      case 'payment_intent.processing':
        return { intentId: stripeEvento.data.object.id, estado: 'processing' };
      // Un intento declinado y un intent cancelado acaban igual para nosotros:
      // no hay cobro. La diferencia —si se puede reintentar— la sabe Stripe.
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        return { intentId: stripeEvento.data.object.id, estado: 'failed' };
      default:
        return null;
    }
  }

  extraerIncidenciaDeEvento(evento: unknown): IncidenciaPasarela | null {
    const stripeEvento = evento as Stripe.Event;

    switch (stripeEvento.type) {
      case 'charge.refunded': {
        const cargo = stripeEvento.data.object;
        const intentId = idDe(cargo.payment_intent);
        if (!intentId) return null;
        return {
          tipo: 'reembolso',
          intentId,
          importeReembolsadoEur: aEuros(cargo.amount_refunded),
          esTotal: cargo.refunded,
        };
      }
      case 'refund.failed': {
        const reembolso = stripeEvento.data.object;
        const intentId = idDe(reembolso.payment_intent);
        if (!intentId) return null;
        return {
          tipo: 'reembolso_fallido',
          intentId,
          importeEur: aEuros(reembolso.amount),
          motivo: reembolso.failure_reason ?? undefined,
        };
      }
      case 'charge.dispute.created': {
        const disputa = stripeEvento.data.object;
        const intentId = idDe(disputa.payment_intent);
        if (!intentId) return null;
        return {
          tipo: 'disputa',
          intentId,
          importeEur: aEuros(disputa.amount),
          motivo: disputa.reason,
          referencia: disputa.id,
        };
      }
      default:
        return null;
    }
  }
}
