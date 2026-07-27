import { environment } from '../../../environments/environment';

describe('StripeService', () => {
  let loadStripeMock: jest.Mock;
  let service: { getStripe: () => Promise<unknown> };

  /** El SDK se sustituye por módulo porque el servicio no expone otra costura. */
  const crearServicio = () => {
    jest.resetModules();
    loadStripeMock = jest.fn().mockResolvedValue({ elements: jest.fn() });
    jest.doMock('@stripe/stripe-js', () => ({ loadStripe: loadStripeMock }));

    const { StripeService } = require('./stripe.service');
    return new StripeService();
  };

  beforeEach(() => {
    service = crearServicio();
  });

  afterEach(() => {
    jest.dontMock('@stripe/stripe-js');
  });

  it('debería cargar el SDK con la clave publicable del entorno', async () => {
    await service.getStripe();

    expect(loadStripeMock).toHaveBeenCalledWith(environment.stripePublicKey);
  });

  it('debería cargar el script una sola vez aunque se pida varias veces', async () => {
    const primera = service.getStripe();
    const segunda = service.getStripe();

    await Promise.all([primera, segunda]);

    // Cada llamada a loadStripe inyecta un <script> nuevo en el documento.
    expect(loadStripeMock).toHaveBeenCalledTimes(1);
    expect(await primera).toBe(await segunda);
  });

  it('debería devolver null si Stripe no está disponible', async () => {
    loadStripeMock.mockResolvedValue(null);

    await expect(service.getStripe()).resolves.toBeNull();
  });
});
