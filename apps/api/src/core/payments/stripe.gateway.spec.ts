import type Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

/** Instancia de Stripe simulada; se comparte con el mock del constructor. */
const stripeMock = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
  refunds: { create: jest.fn() },
};

// El SDK se instancia en el constructor, así que hay que sustituirlo antes de
// importar el gateway. El módulo **es** el constructor (`module.exports =
// Stripe`, sin `.default`), y el doble tiene que tener esa misma forma.
jest.mock('stripe', () => jest.fn().mockImplementation(() => stripeMock));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { StripeGateway } from './stripe.gateway';

describe('StripeGateway', () => {
  let gateway: StripeGateway;

  const config = {
    getOrThrow: jest.fn((clave: string) =>
      clave === 'STRIPE_SECRET_KEY' ? 'sk_test_x' : 'whsec_x',
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new StripeGateway(config);
  });

  describe('crearIntent', () => {
    beforeEach(() => {
      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret',
      });
    });

    it('debería crear el intent con el importe en céntimos y la moneda en minúsculas', async () => {
      await gateway.crearIntent({
        montoEnCentavos: 60_500,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
      });

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 60_500, currency: 'eur' }),
      );
    });

    it('debería etiquetar el intent con la reserva y el usuario', async () => {
      // Sin estos metadatos, un pago huérfano en el panel de Stripe no se puede
      // reconciliar con ninguna reserva.
      await gateway.crearIntent({
        montoEnCentavos: 100,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
      });

      const { metadata } = stripeMock.paymentIntents.create.mock.calls[0][0];
      expect(metadata).toMatchObject({ reservaId: 'reserva-1', usuarioId: 'user-1' });
    });

    it('debería conservar los metadatos extra del viaje o del suplemento', async () => {
      await gateway.crearIntent({
        montoEnCentavos: 100,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
        metadata: { esViaje: 'true', reservaIds: 'r1,r2' },
      });

      const { metadata } = stripeMock.paymentIntents.create.mock.calls[0][0];
      expect(metadata).toMatchObject({ esViaje: 'true', reservaIds: 'r1,r2' });
    });

    it('debería dejar que Stripe elija los métodos de pago, salvo los de confirmación diferida', async () => {
      // Un adeudo SEPA tarda días en confirmarse y la plaza se retiene minutos:
      // el cobro llegaría con la reserva ya caducada.
      await gateway.crearIntent({
        montoEnCentavos: 100,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
      });

      const params = stripeMock.paymentIntents.create.mock.calls[0][0];
      expect(params.automatic_payment_methods).toEqual({ enabled: true });
      expect(params.excluded_payment_method_types).toEqual(
        expect.arrayContaining(['sepa_debit', 'multibanco', 'customer_balance']),
      );
      expect(params.excluded_payment_method_types).not.toContain('card');
    });

    it('debería mandar la descripción que verá el cliente en su recibo', async () => {
      await gateway.crearIntent({
        montoEnCentavos: 100,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
        descripcion: 'Reserva RES-1 · Doogking',
      });

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Reserva RES-1 · Doogking' }),
      );
    });

    it('debería devolver el id y el clientSecret del intent', async () => {
      const resultado = await gateway.crearIntent({
        montoEnCentavos: 100,
        moneda: 'EUR',
        reservaId: 'reserva-1',
        usuarioId: 'user-1',
      });

      expect(resultado).toEqual({ intentId: 'pi_123', clientSecret: 'pi_123_secret' });
    });
  });

  describe('construirEvento', () => {
    it('debería verificar la firma con el secreto del webhook', () => {
      const payload = Buffer.from('{}');
      stripeMock.webhooks.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded' });

      gateway.construirEvento(payload, 'firma');

      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(payload, 'firma', 'whsec_x');
    });

    it('debería propagar el error si la firma no es válida', () => {
      // PaymentsService lo traduce a 400; aquí sólo tiene que no tragárselo.
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => gateway.construirEvento(Buffer.from('{}'), 'mala')).toThrow('Invalid signature');
    });
  });

  describe('reembolsar', () => {
    it('debería pedir el reembolso del intent indicado', async () => {
      stripeMock.refunds.create.mockResolvedValue({});

      await gateway.reembolsar('pi_123');

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_123' }, undefined);
    });

    it('debería devolver sólo una parte, en céntimos, si se indica el importe', async () => {
      stripeMock.refunds.create.mockResolvedValue({});

      await gateway.reembolsar('pi_123', 12.34);

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_123', amount: 1234 }, undefined);
    });

    it('debería mandar la clave de idempotencia para que dos clics no devuelvan dos veces', async () => {
      stripeMock.refunds.create.mockResolvedValue({});

      await gateway.reembolsar('pi_123', 10, 'reembolso-pago1-0-1000');

      expect(stripeMock.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_123', amount: 1000 },
        { idempotencyKey: 'reembolso-pago1-0-1000' },
      );
    });
  });

  describe('extraerIntentDeEvento', () => {
    const evento = (type: string, object: unknown): Stripe.Event =>
      ({ type, data: { object } }) as Stripe.Event;

    it('debería reconocer un pago aprobado y su cargo', () => {
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.succeeded', { id: 'pi_1', latest_charge: 'ch_1' }),
      );

      expect(resultado).toEqual({ intentId: 'pi_1', estado: 'succeeded', chargeId: 'ch_1' });
    });

    it('debería sacar el id del cargo aunque Stripe lo devuelva expandido', () => {
      // `latest_charge` puede venir como objeto en vez de como id.
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.succeeded', { id: 'pi_1', latest_charge: { id: 'ch_1' } }),
      );

      expect(resultado?.chargeId).toBe('ch_1');
    });

    it('debería dejar el cargo sin definir si el intent no lo trae', () => {
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.succeeded', { id: 'pi_1', latest_charge: null }),
      );

      expect(resultado?.chargeId).toBeUndefined();
    });

    it('debería tratar un intent cancelado como un cobro que no se hizo', () => {
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.canceled', { id: 'pi_3' }),
      );

      expect(resultado).toEqual({ intentId: 'pi_3', estado: 'failed' });
    });

    it('debería distinguir un pago que el banco aún está procesando', () => {
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.processing', { id: 'pi_4' }),
      );

      expect(resultado).toEqual({ intentId: 'pi_4', estado: 'processing' });
    });

    it('debería reconocer un pago fallido', () => {
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.payment_failed', { id: 'pi_2' }),
      );

      expect(resultado).toEqual({ intentId: 'pi_2', estado: 'failed' });
    });

    it('debería ignorar los eventos que no son de pago', () => {
      // Stripe manda decenas de tipos; procesar los demás sería ruido.
      expect(gateway.extraerIntentDeEvento(evento('customer.created', { id: 'cus_1' }))).toBeNull();
    });
  });

  describe('extraerIncidenciaDeEvento', () => {
    const evento = (type: string, object: unknown): Stripe.Event =>
      ({ type, data: { object } }) as Stripe.Event;

    it('debería traducir una devolución con el acumulado en euros', () => {
      const resultado = gateway.extraerIncidenciaDeEvento(
        evento('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 1250, refunded: false }),
      );

      expect(resultado).toEqual({
        tipo: 'reembolso', intentId: 'pi_1', importeReembolsadoEur: 12.5, esTotal: false,
      });
    });

    it('debería marcar como total la devolución que agota el cargo', () => {
      const resultado = gateway.extraerIncidenciaDeEvento(
        evento('charge.refunded', { payment_intent: { id: 'pi_1' }, amount_refunded: 5000, refunded: true }),
      );

      expect(resultado).toMatchObject({ intentId: 'pi_1', esTotal: true });
    });

    it('debería avisar de una devolución que el banco ha rechazado', () => {
      const resultado = gateway.extraerIncidenciaDeEvento(
        evento('refund.failed', { payment_intent: 'pi_1', amount: 3000, failure_reason: 'expired_or_canceled_card' }),
      );

      expect(resultado).toEqual({
        tipo: 'reembolso_fallido', intentId: 'pi_1', importeEur: 30, motivo: 'expired_or_canceled_card',
      });
    });

    it('debería avisar de una disputa con su referencia', () => {
      const resultado = gateway.extraerIncidenciaDeEvento(
        evento('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_1', amount: 5000, reason: 'fraudulent' }),
      );

      expect(resultado).toEqual({
        tipo: 'disputa', intentId: 'pi_1', importeEur: 50, motivo: 'fraudulent', referencia: 'dp_1',
      });
    });

    it.each(['charge.refunded', 'refund.failed', 'charge.dispute.created'])(
      'debería ignorar un %s que no cuelga de ningún intent',
      (tipo) => {
        // Cargos antiguos o creados fuera de la plataforma: no hay pago que tocar.
        expect(gateway.extraerIncidenciaDeEvento(evento(tipo, { payment_intent: null }))).toBeNull();
      },
    );

    it('debería ignorar los eventos de cobro, que van por otro camino', () => {
      expect(gateway.extraerIncidenciaDeEvento(evento('payment_intent.succeeded', { id: 'pi_1' }))).toBeNull();
    });
  });

  describe('consultarIntent', () => {
    const conEstado = (status: string, latest_charge?: string) => {
      stripeMock.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_123', status, latest_charge });
    };

    it('deberia traducir succeeded y traer el cargo', async () => {
      conEstado('succeeded', 'ch_1');

      await expect(gateway.consultarIntent('pi_123'))
        .resolves.toEqual({ estado: 'succeeded', chargeId: 'ch_1' });
    });

    it('deberia traducir canceled como fallido', async () => {
      conEstado('canceled');

      await expect(gateway.consultarIntent('pi_123'))
        .resolves.toMatchObject({ estado: 'failed' });
    });

    it('no deberia dar por fallido un intento que aun se puede reintentar', async () => {
      // `requires_payment_method` es el estado tras un rechazo recuperable: el
      // cliente puede probar con otra tarjeta y el cobro sigue vivo.
      conEstado('requires_payment_method');

      await expect(gateway.consultarIntent('pi_123'))
        .resolves.toMatchObject({ estado: 'other' });
    });

    it('deberia distinguir un pago que Stripe esta procesando de uno sin pagar', async () => {
      conEstado('processing');

      await expect(gateway.consultarIntent('pi_123'))
        .resolves.toMatchObject({ estado: 'processing' });
    });
  });
});
