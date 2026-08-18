import type Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

/** Instancia de Stripe simulada; se comparte con el mock del constructor. */
const stripeMock = {
  paymentIntents: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
  refunds: { create: jest.fn() },
};

// El SDK se instancia en el constructor, así que hay que sustituirlo antes de
// importar el gateway.
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => stripeMock),
}));

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

      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_123' });
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

    it('debería dejar el cargo sin definir si Stripe lo devuelve expandido', () => {
      // `latest_charge` puede venir como objeto en vez de como id.
      const resultado = gateway.extraerIntentDeEvento(
        evento('payment_intent.succeeded', { id: 'pi_1', latest_charge: { id: 'ch_1' } }),
      );

      expect(resultado?.chargeId).toBeUndefined();
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
});
