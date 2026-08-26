export interface CrearIntentParams {
  montoEnCentavos: number;
  moneda: string;
  reservaId: string;
  usuarioId: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  intentId: string;
  clientSecret: string;
}

/** Estado de un cobro, ya traducido del vocabulario de la pasarela. */
export type EstadoIntent = 'succeeded' | 'failed' | 'other';

export interface ConsultaIntent {
  estado: EstadoIntent;
  chargeId?: string;
}

export interface PaymentGateway {
  crearIntent(params: CrearIntentParams): Promise<PaymentIntentResult>;

  /**
   * Estado real del cobro, preguntado a la pasarela.
   *
   * El webhook sigue siendo la fuente de verdad, pero no siempre llega a
   * tiempo —y en local no llega nunca, porque Stripe no alcanza `localhost`—.
   * Esto permite preguntar directamente en vez de creerse lo que diga el
   * cliente, que es lo único que no se puede hacer.
   */
  consultarIntent(intentId: string): Promise<ConsultaIntent>;
  construirEvento(payload: Buffer, signature: string): unknown;
  extraerIntentDeEvento(evento: unknown): { intentId: string; estado: 'succeeded' | 'failed' | 'other'; chargeId?: string } | null;
  reembolsar(paymentIntentId: string): Promise<void>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
