import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { ReservasService } from './reservas.service';

describe('ReservasService', () => {
  let service: ReservasService;
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
    service = TestBed.inject(ReservasService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería crear la reserva enviando el payload tal cual', async () => {
    const payload = {
      servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.ALOJAMIENTO,
      fechaInicio: '2026-09-01',
    };
    const promesa = service.crear(payload as never);

    const req = resolver('/reservas', { codigo: 'RES-AAAA1111' });
    expect(req.method).toBe('POST');
    expect(req.body).toEqual(payload);

    await expect(promesa).resolves.toMatchObject({ codigo: 'RES-AAAA1111' });
  });

  it('debería pedir las reservas propias a /mis', async () => {
    const promesa = service.misReservas();
    resolver('/reservas/mis', []);

    await expect(promesa).resolves.toEqual([]);
  });

  it('debería pedir el viaje por la reserva madre', async () => {
    const promesa = service.viaje('r1');

    expect(resolver('/reservas/viaje/r1', []).method).toBe('GET');
    await promesa;
  });

  it('debería buscar por código en su propia ruta, no por id', async () => {
    const promesa = service.obtenerPorCodigo('RES-AAAA1111');

    const req = resolver('/reservas/codigo/RES-AAAA1111');
    expect(req.url).toContain('/codigo/');
    await promesa;
  });

  it('debería cancelar con POST, no con DELETE', async () => {
    const promesa = service.cancelar('r1');

    // Cancelar cambia el estado; la reserva no se borra nunca.
    expect(resolver('/reservas/r1/cancelar').method).toBe('POST');
    await promesa;
  });

  it('debería exponer recordatorios y puntos en rutas separadas', async () => {
    const recordatorios = service.recordatorios();
    resolver('/reservas/recordatorios', []);
    await recordatorios;

    const puntos = service.puntos();
    expect(resolver('/reservas/puntos', { total: 0 }).method).toBe('GET');
    await puntos;
  });

  it('debería propagar el error del API en lugar de tragárselo', async () => {
    const promesa = service.obtener('inexistente');
    httpMock.expectOne((r) => r.url.includes('/reservas/inexistente'))
      .flush({ message: 'No encontrada' }, { status: 404, statusText: 'Not Found' });

    await expect(promesa).rejects.toBeDefined();
  });
});
