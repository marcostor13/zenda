import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentsService } from './payments.service';
import { CuponesService } from './cupones.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let cupones: CuponesService;
  let httpMock: HttpTestingController;

  const resolver = (fragmento: string, respuesta: unknown = {}) => {
    const req = httpMock.expectOne((r) => r.url.includes(fragmento));
    req.flush(respuesta as Record<string, unknown>);
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentsService);
    cupones = TestBed.inject(CuponesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería pedir el intent de pago con la reserva', async () => {
    const promesa = service.crearIntent('r1');

    const req = resolver('/payments/intent', { clientSecret: 'cs_1' });
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ reservaId: 'r1' });

    await expect(promesa).resolves.toMatchObject({ clientSecret: 'cs_1' });
  });

  it('debería aceptar el ajuste contra la ruta de la reserva', async () => {
    const promesa = service.aceptarAjuste('r1');

    expect(resolver('/reservas/r1/ajuste/aceptar').method).toBe('POST');
    await promesa;
  });

  it('debería usar rutas distintas para aceptar y rechazar el ajuste', async () => {
    const promesa = service.rechazarAjuste('r1');

    const req = resolver('/reservas/r1/ajuste/rechazar');
    expect(req.url).toContain('rechazar');
    expect(req.url).not.toContain('aceptar');
    await promesa;
  });

  it('debería validar el cupón con importe y vertical, no solo con el código', async () => {
    // El descuento depende del vertical y del importe: mandar solo el código
    // daría una previsualización que luego no coincide al cobrar.
    const promesa = cupones.validar('VERANO', 'alojamiento', 200);

    const req = resolver('/cupones/validar', { descuento: 20 });
    expect(req.body).toEqual({ codigo: 'VERANO', vertical: 'alojamiento', montoSubtotal: 200 });

    await expect(promesa).resolves.toMatchObject({ descuento: 20 });
  });

  it('debería propagar el rechazo de un cupón inválido', async () => {
    const promesa = cupones.validar('CADUCADO', 'alojamiento', 200);
    httpMock.expectOne((r) => r.url.includes('/cupones/validar'))
      .flush({ message: 'Cupón caducado' }, { status: 400, statusText: 'Bad Request' });

    await expect(promesa).rejects.toBeDefined();
  });
  describe('sincronizar', () => {
    it('deberia preguntar por el pago al servidor, no afirmar que esta pagado', async () => {
      const promesa = service.sincronizar('pago-1');

      const req = resolver('/payments/pago-1/sincronizar', { estado: 'aprobado' });
      expect(req.method).toBe('POST');
      // El cuerpo va vacio a proposito: el estado lo lee el servidor en Stripe.
      expect(req.body).toEqual({});

      await expect(promesa).resolves.toEqual({ estado: 'aprobado' });
    });

    it('deberia devolver pendiente cuando el cobro sigue en curso', async () => {
      const promesa = service.sincronizar('pago-1');
      resolver('/payments/pago-1/sincronizar', { estado: 'pendiente' });

      await expect(promesa).resolves.toEqual({ estado: 'pendiente' });
    });
  });
});
