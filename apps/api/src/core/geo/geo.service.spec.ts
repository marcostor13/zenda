import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';

const respuestaAutocomplete = {
  suggestions: [
    {
      placePrediction: {
        placeId: 'place-valencia',
        text: { text: 'Valencia, España' },
        structuredFormat: {
          mainText: { text: 'Valencia' },
          secondaryText: { text: 'Comunidad Valenciana, España' },
        },
      },
    },
  ],
};

describe('GeoService', () => {
  let service: GeoService;
  let fetchMock: jest.Mock;

  const crear = async (apiKey?: string): Promise<GeoService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(apiKey) } },
      ],
    }).compile();
    return module.get(GeoService);
  };

  const responder = (body: unknown, ok = true): void => {
    fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
  };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = await crear('clave-de-prueba');
  });

  describe('autocompletar', () => {
    it('debería sugerir poblaciones desde la primera letra', async () => {
      responder(respuestaAutocomplete);

      const sugerencias = await service.autocompletar('v');

      expect(sugerencias).toEqual([
        {
          placeId: 'place-valencia',
          descripcion: 'Valencia, España',
          principal: 'Valencia',
          secundario: 'Comunidad Valenciana, España',
        },
      ]);
    });

    it('debería restringir la búsqueda al mercado europeo', async () => {
      responder(respuestaAutocomplete);

      await service.autocompletar('val');

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(cuerpo.includedRegionCodes).toEqual(['es', 'pt', 'fr', 'it', 'de']);
    });

    it('no debería exponer la clave en la URL, solo en la cabecera', async () => {
      responder(respuestaAutocomplete);

      await service.autocompletar('val');

      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).not.toContain('clave-de-prueba');
      expect(opciones.headers['X-Goog-Api-Key']).toBe('clave-de-prueba');
    });

    it('debería cachear el mismo término para no pagar dos veces', async () => {
      responder(respuestaAutocomplete);

      await service.autocompletar('Valencia');
      await service.autocompletar('valencia');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('debería devolver vacío sin clave configurada, sin llamar al proveedor', async () => {
      const sinClave = await crear(undefined);

      expect(await sinClave.autocompletar('val')).toEqual([]);
      expect(sinClave.estaConfigurado).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('debería devolver vacío si el proveedor falla, sin lanzar', async () => {
      responder({}, false);

      await expect(service.autocompletar('val')).resolves.toEqual([]);
    });

    it('debería ignorar un término vacío', async () => {
      expect(await service.autocompletar('   ')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('coordenadas', () => {
    it('debería devolver la posición de la población elegida', async () => {
      responder({
        location: { latitude: 39.47, longitude: -0.376 },
        displayName: { text: 'Valencia' },
      });

      await expect(service.coordenadas('place-valencia')).resolves.toEqual({
        ciudad: 'Valencia',
        lat: 39.47,
        lng: -0.376,
      });
    });

    it('debería devolver null si la respuesta no trae posición', async () => {
      responder({ displayName: { text: 'Valencia' } });

      await expect(service.coordenadas('place-valencia')).resolves.toBeNull();
    });

    it('debería cachear las coordenadas: una ciudad no se mueve', async () => {
      responder({ location: { latitude: 39.47, longitude: -0.376 }, displayName: { text: 'Valencia' } });

      await service.coordenadas('place-valencia');
      await service.coordenadas('place-valencia');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('trayecto', () => {
    const coords = (lat: number, lng: number, ciudad: string) => ({
      location: { latitude: lat, longitude: lng },
      displayName: { text: ciudad },
    });

    /** Dos llamadas de coordenadas y luego la de ruta. */
    const respuestas = (...cuerpos: unknown[]): void => {
      for (const cuerpo of cuerpos) {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => cuerpo });
      }
    };

    it('debería medir la distancia por carretera cuando el proveedor responde', async () => {
      respuestas(
        coords(40.4168, -3.7038, 'Madrid'),
        coords(39.8628, -4.0273, 'Toledo'),
        { routes: [{ distanceMeters: 73200, duration: '3600s' }] },
      );

      await expect(service.trayecto('madrid', 'toledo')).resolves.toEqual({
        km: 73.5, duracionMin: 60, esEstimacion: false,
      });
    });

    it('debería redondear los kilómetros al alza: nunca se factura de menos', async () => {
      respuestas(
        coords(40.4168, -3.7038, 'Madrid'),
        coords(39.8628, -4.0273, 'Toledo'),
        { routes: [{ distanceMeters: 10100, duration: '600s' }] },
      );

      const trayecto = await service.trayecto('a', 'b');

      expect(trayecto?.km).toBe(10.5);
    });

    it('debería estimar en línea recta si no hay ruta, marcándolo como estimación', async () => {
      respuestas(coords(40.4168, -3.7038, 'Madrid'), coords(39.8628, -4.0273, 'Toledo'));
      // La llamada de rutas falla:
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

      const trayecto = await service.trayecto('madrid', 'toledo');

      expect(trayecto?.esEstimacion).toBe(true);
      // Madrid–Toledo son ~67 km en línea recta; con el factor de sinuosidad, ~87.
      expect(trayecto?.km).toBeGreaterThan(70);
      expect(trayecto?.km).toBeLessThan(110);
    });

    it('debería devolver null si falta alguna de las dos poblaciones', async () => {
      await expect(service.trayecto('', 'toledo')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('debería cachear la ruta: no cambia de un día para otro', async () => {
      respuestas(
        coords(40.4168, -3.7038, 'Madrid'),
        coords(39.8628, -4.0273, 'Toledo'),
        { routes: [{ distanceMeters: 73200, duration: '3600s' }] },
      );

      await service.trayecto('madrid', 'toledo');
      const llamadas = fetchMock.mock.calls.length;
      await service.trayecto('madrid', 'toledo');

      expect(fetchMock.mock.calls.length).toBe(llamadas);
    });
  });

  describe('tiposDeCambio', () => {
    it('debería incluir siempre el euro como base a 1', async () => {
      responder({ date: '2026-07-24', rates: { GBP: 0.84, USD: 1.09 } });

      const cambio = await service.tiposDeCambio();

      expect(cambio.base).toBe('EUR');
      expect(cambio.tasas['EUR']).toBe(1);
      expect(cambio.tasas['GBP']).toBe(0.84);
    });

    it('debería caer al euro solo si el proveedor falla', async () => {
      responder({}, false);

      const cambio = await service.tiposDeCambio();

      expect(cambio.tasas).toEqual({ EUR: 1 });
    });
  });
});
