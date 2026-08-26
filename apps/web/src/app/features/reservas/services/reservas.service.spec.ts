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

  it('debería consultar la disponibilidad en /reservas/disponibilidad', async () => {
    const payload = {
      servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.ALOJAMIENTO,
      fechaInicio: '2026-09-01', fechaFin: '2026-09-04',
    };
    const promesa = service.comprobarDisponibilidad(payload as never);

    const req = resolver('/reservas/disponibilidad', { disponible: false, motivo: 'Sin plazas.' });
    expect(req.method).toBe('POST');
    expect(req.body).toEqual(payload);

    await expect(promesa).resolves.toEqual({ disponible: false, motivo: 'Sin plazas.' });
  });

  it('debería pedir el calendario por query, con el espacio cuando se indica', async () => {
    const promesa = service.calendario({
      servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30', espacioId: 'suite-1',
    });

    const req = resolver('/reservas/disponibilidad/calendario', { soportado: true, dias: [] });
    expect(req.method).toBe('GET');
    expect(req.params.get('servicioId')).toBe('s1');
    expect(req.params.get('desde')).toBe('2026-09-01');
    expect(req.params.get('espacioId')).toBe('suite-1');

    await expect(promesa).resolves.toEqual({ soportado: true, dias: [] });
  });

  it('no debería mandar espacioId cuando no hay espacio elegido', async () => {
    const promesa = service.calendario({ servicioId: 's1', desde: '2026-09-01', hasta: '2026-09-30' });

    const req = resolver('/reservas/disponibilidad/calendario', { soportado: true, dias: [] });
    expect(req.params.has('espacioId')).toBe(false);

    await promesa;
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

  it('debería pedir la próxima reserva en su propia ruta (HU-7.3)', async () => {
    const promesa = service.proximaReserva();
    expect(resolver('/reservas/proxima', null).method).toBe('GET');
    await promesa;
  });

  it('debería propagar el error del API en lugar de tragárselo', async () => {
    const promesa = service.obtener('inexistente');
    httpMock.expectOne((r) => r.url.includes('/reservas/inexistente'))
      .flush({ message: 'No encontrada' }, { status: 404, statusText: 'Not Found' });

    await expect(promesa).rejects.toBeDefined();
  });
});
