import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecomendadorService } from './recomendador.service';

describe('RecomendadorService', () => {
  let service: RecomendadorService;
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
    service = TestBed.inject(RecomendadorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería recomendar adiestramiento con motivo e intensidad', async () => {
    const promesa = service.adiestramiento('agresividad_perros', 'alta', 18);

    const req = resolver('/recomendador/adiestramiento', { modalidad: 'individual' });
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ motivo: 'agresividad_perros', intensidad: 'alta', edadMeses: 18 });

    await expect(promesa).resolves.toMatchObject({ modalidad: 'individual' });
  });

  it('debería admitir una recomendación sin edad declarada', async () => {
    const promesa = service.adiestramiento('obediencia', 'media');

    expect(resolver('/recomendador/adiestramiento').body.edadMeses).toBeUndefined();
    await promesa;
  });

  it('debería recomendar veterinaria por motivo y gravedad', async () => {
    const promesa = service.veterinaria('cojera', 'moderada', ['inflamacion']);

    const req = resolver('/recomendador/veterinaria', { servicio: 'consulta_general' });
    expect(req.body).toEqual({
      motivo: 'cojera', gravedad: 'moderada', sintomasAsociados: ['inflamacion'],
    });

    await promesa;
  });

  it('debería usar rutas distintas por vertical', async () => {
    const adiestramiento = service.adiestramiento('obediencia', 'baja');
    const urlAdiestramiento = resolver('/recomendador/adiestramiento').url;
    await adiestramiento;

    const veterinaria = service.veterinaria('revision', 'leve');
    const urlVeterinaria = resolver('/recomendador/veterinaria').url;
    await veterinaria;

    expect(urlAdiestramiento).not.toBe(urlVeterinaria);
  });
});
