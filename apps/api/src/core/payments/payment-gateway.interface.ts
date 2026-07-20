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

export interface PaymentGateway {
  crearIntent(params: CrearIntentParams): Promise<PaymentIntentResult>;
  construirEvento(payload: Buffer, signature: string): unknown;
  extraerIntentDeEvento(evento: unknown): { intentId: string; estado: 'succeeded' | 'failed' | 'other'; chargeId?: string } | null;
  reembolsar(paymentIntentId: string): Promise<void>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
