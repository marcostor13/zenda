export interface CrearIntentParams {
  montoEnCentavos: number;
  moneda: string;
  reservaId: string;
  usuarioId: string;
  /** Lo que el cliente lee en el extracto y en el recibo de la pasarela. */
  descripcion?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  intentId: string;
  clientSecret: string;
}

/**
 * Estado de un cobro, ya traducido del vocabulario de la pasarela.
 *
 * - `succeeded`: cobrado.
 * - `processing`: el cliente ya ha pagado pero el dinero aún no está confirmado
 *   (métodos de confirmación diferida). No se confirma nada todavía.
 * - `failed`: el intento se ha cerrado sin cobrar.
 * - `other`: sigue abierto y sin pagar (falta método, falta autenticación…).
 */
export type EstadoIntent = 'succeeded' | 'processing' | 'failed' | 'other';

export interface ConsultaIntent {
  estado: EstadoIntent;
  chargeId?: string;
}

/** Lo que le pasa al dinero **después** de cobrado, contado por la pasarela. */
export type IncidenciaPasarela =
  /** Total devuelto hasta ahora sobre el cobro; incluye lo devuelto a mano desde el panel de la pasarela. */
  | { tipo: 'reembolso'; intentId: string; importeReembolsadoEur: number; esTotal: boolean }
  /** Una devolución que se dio por hecha y el banco ha rechazado: el cliente no ha recibido ese dinero. */
  | { tipo: 'reembolso_fallido'; intentId: string; importeEur: number; motivo?: string }
  /** El cliente ha reclamado el cargo a su banco. */
  | { tipo: 'disputa'; intentId: string; importeEur: number; motivo?: string; referencia: string };

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
  extraerIntentDeEvento(evento: unknown): { intentId: string; estado: EstadoIntent; chargeId?: string } | null;
  /** Devoluciones y disputas que avisa la pasarela; `null` si el evento no va de eso. */
  extraerIncidenciaDeEvento(evento: unknown): IncidenciaPasarela | null;
  /**
   * Sin importe, devuelve todo; con importe (en euros), sólo esa parte.
   *
   * `claveIdempotencia` identifica **esta** devolución: repetir la llamada con
   * la misma clave no devuelve el dinero dos veces.
   */
  reembolsar(paymentIntentId: string, importeEur?: number, claveIdempotencia?: string): Promise<void>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
