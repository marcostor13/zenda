import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { GeoService } from './geo.service';

describe('GeoService', () => {
  let service: GeoService;
  let httpMock: HttpTestingController;

  const resolver = (fragmento: string, respuesta: unknown = {}) => {
    const req = httpMock.expectOne((r) => r.url.includes(fragmento));
    req.flush(respuesta as Record<string, unknown>);
    return req.request;
  };

  const fallar = (fragmento: string) => {
    httpMock
      .expectOne((r) => r.url.includes(fragmento))
      .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('claveMapas', () => {
    it('debería pedir la clave de Google Maps al API', async () => {
      const promesa = service.claveMapas();
      resolver('/geo/config', { mapsApiKey: 'clave-navegador' });

      await expect(promesa).resolves.toBe('clave-navegador');
    });

    it('debería pedirla una sola vez aunque haya varios mapas en la pantalla', async () => {
      const primera = service.claveMapas();
      resolver('/geo/config', { mapsApiKey: 'clave-navegador' });
      await primera;

      // Sin la segunda petición pendiente, `httpMock.verify()` confirma que no
      // se ha vuelto a llamar al API.
      await expect(service.claveMapas()).resolves.toBe('clave-navegador');
    });

    it('debería caer a cadena vacía si el API no responde, para usar OpenStreetMap', async () => {
      const promesa = service.claveMapas();
      fallar('/geo/config');

      await expect(promesa).resolves.toBe('');
    });
  });

  describe('autocompletado', () => {
    it('debería enviar el término y el token de sesión', async () => {
      const promesa = firstValueFrom(service.autocompletar('Madr'));

      const req = resolver('/geo/autocomplete', []);
      expect(req.params.get('q')).toBe('Madr');
      expect(req.params.get('session')).toBeTruthy();

      await promesa;
    });

    it('debería reutilizar el mismo token mientras el usuario escribe', async () => {
      const primera = firstValueFrom(service.autocompletar('Ma'));
      const token1 = resolver('/geo/autocomplete', []).params.get('session');
      await primera;

      const segunda = firstValueFrom(service.autocompletar('Madr'));
      const token2 = resolver('/geo/autocomplete', []).params.get('session');
      await segunda;

      // Places factura por sesión: un token por pulsación multiplicaría el coste.
      expect(token2).toBe(token1);
    });

    it('debería abrir sesión nueva tras elegir una sugerencia', async () => {
      const primera = firstValueFrom(service.autocompletar('Ma'));
      const token1 = resolver('/geo/autocomplete', []).params.get('session');
      await primera;

      service.cerrarSesion();

      const segunda = firstValueFrom(service.autocompletar('Bar'));
      const token2 = resolver('/geo/autocomplete', []).params.get('session');
      await segunda;

      expect(token2).not.toBe(token1);
    });

    it('debería devolver lista vacía si el proxy falla, sin romper el buscador', async () => {
      const promesa = firstValueFrom(service.autocompletar('Madrid'));
      fallar('/geo/autocomplete');

      await expect(promesa).resolves.toEqual([]);
    });
  });

  describe('geocodificación y trayecto', () => {
    it('debería resolver coordenadas por placeId', async () => {
      const promesa = service.coordenadas('place-1');

      const req = resolver('/geo/geocode', { ciudad: 'Madrid', lat: 40.4, lng: -3.7 });
      expect(req.params.get('placeId')).toBe('place-1');

      await expect(promesa).resolves.toMatchObject({ ciudad: 'Madrid' });
    });

    it('debería devolver null si no se puede geocodificar', async () => {
      const promesa = service.coordenadas('inexistente');
      fallar('/geo/geocode');

      await expect(promesa).resolves.toBeNull();
    });

    it('debería pedir el trayecto con origen y destino', async () => {
      const promesa = service.trayecto('a', 'b');

      const req = resolver('/geo/trayecto', { km: 70, duracionMin: 55, esEstimacion: false });
      expect(req.params.get('origen')).toBe('a');
      expect(req.params.get('destino')).toBe('b');

      await expect(promesa).resolves.toMatchObject({ km: 70, esEstimacion: false });
    });

    it('debería devolver null si el trayecto no se puede calcular', async () => {
      const promesa = service.trayecto('a', 'b');
      fallar('/geo/trayecto');

      await expect(promesa).resolves.toBeNull();
    });
  });

  describe('tipos de cambio', () => {
    it('debería pedir las tasas una sola vez por sesión', async () => {
      const primera = firstValueFrom(service.tiposDeCambio());
      resolver('/geo/fx', { base: 'EUR', fecha: '2026-07-01', tasas: { GBP: 0.85 } });
      await primera;

      // La segunda llamada se sirve de la caché: sin petición pendiente que verificar.
      await expect(firstValueFrom(service.tiposDeCambio())).resolves.toMatchObject({
        tasas: { GBP: 0.85 },
      });
    });

    it('debería caer a EUR=1 si el BCE no responde', async () => {
      const promesa = firstValueFrom(service.tiposDeCambio());
      fallar('/geo/fx');

      // Sin tasas se muestran precios en euros, nunca importes a cero.
      await expect(promesa).resolves.toEqual({ base: 'EUR', fecha: '', tasas: { EUR: 1 } });
    });
  });
});
