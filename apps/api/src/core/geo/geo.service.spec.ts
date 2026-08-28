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

  describe('configMapas', () => {
    const crearConVariables = async (vars: Record<string, string>): Promise<GeoService> => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeoService,
          { provide: ConfigService, useValue: { get: (clave: string) => vars[clave] } },
        ],
      }).compile();
      return module.get(GeoService);
    };

    it('debería exponer la clave de navegador para pintar el mapa', async () => {
      const conClave = await crearConVariables({ GOOGLE_MAPS_BROWSER_KEY: 'clave-navegador' });

      expect(conClave.configMapas()).toEqual({ mapsApiKey: 'clave-navegador' });
    });

    it('no debería exponer nunca la clave de servidor', async () => {
      // Publicar la de Places permitiría facturar contra ella desde cualquier
      // sitio: sin clave de navegador, el frontend cae a OpenStreetMap.
      const soloServidor = await crearConVariables({ GOOGLE_MAPS_API_KEY: 'clave-servidor' });

      expect(soloServidor.configMapas()).toEqual({ mapsApiKey: '' });
    });

    it('debería devolver cadena vacía si la variable está en blanco', async () => {
      const enBlanco = await crearConVariables({ GOOGLE_MAPS_BROWSER_KEY: '   ' });

      expect(enBlanco.configMapas()).toEqual({ mapsApiKey: '' });
    });
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

    it('debería pedir portales, no poblaciones, cuando el tipo es dirección', async () => {
      responder(respuestaAutocomplete);

      await service.autocompletar('calle mayor 2', undefined, 'direccion');

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(cuerpo.includedPrimaryTypes).toEqual(['street_address', 'premise', 'subpremise', 'route']);
    });

    it('no debería servir sugerencias de ciudad cacheadas cuando se piden direcciones', async () => {
      responder(respuestaAutocomplete);
      await service.autocompletar('valencia');

      await service.autocompletar('valencia', undefined, 'direccion');

      // Dos llamadas: la caché no puede mezclar poblaciones con portales.
      expect(fetchMock).toHaveBeenCalledTimes(2);
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

    it('debería devolver vacío si ningún proveedor responde, sin lanzar', async () => {
      responder({}, false);

      await expect(service.autocompletar('val')).resolves.toEqual([]);
    });

    /**
     * El campo de dirección no tenía respaldo: en cuanto Google dejaba de
     * responder —clave suspendida, cuota agotada— devolvía lista vacía y el
     * comercio se quedaba sin poder rellenar su ubicación. OpenStreetMap no
     * necesita clave y quita ese único punto de fallo.
     */
    describe('respaldo con OpenStreetMap', () => {
      const RESPUESTA_OSM = [{
        osm_type: 'node',
        osm_id: 42,
        lat: '39.4699',
        lon: '-0.3763',
        display_name: 'Calle Mayor 1, Valencia, España',
        address: { road: 'Calle Mayor', house_number: '1', city: 'Valencia', postcode: '46001' },
      }];

      /** Google falla y OSM contesta, que es el escenario de producción. */
      const conGoogleCaido = (): void => {
        fetchMock.mockImplementation((url: string) =>
          String(url).includes('nominatim')
            ? Promise.resolve({ ok: true, status: 200, json: async () => RESPUESTA_OSM })
            : Promise.resolve({ ok: false, status: 403, json: async () => ({}) }));
      };

      it('debería sugerir direcciones cuando Places no responde', async () => {
        conGoogleCaido();

        const sugerencias = await service.autocompletar('Calle Mayor 1', undefined, 'direccion');

        expect(sugerencias).toHaveLength(1);
        expect(sugerencias[0].principal).toBe('Calle Mayor 1');
      });

      it('debería sugerir también sin ninguna clave configurada', async () => {
        const sinClave = await crear(undefined);
        conGoogleCaido();

        const sugerencias = await sinClave.autocompletar('Calle Mayor 1', undefined, 'direccion');

        expect(sugerencias).toHaveLength(1);
      });

      it('no debería molestar a OSM cuando Places sí contesta', async () => {
        responder(respuestaAutocomplete);

        await service.autocompletar('Valencia');

        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('nominatim'))).toBe(true);
      });

      it('no debería recurrir a OSM porque Places no conozca el sitio', async () => {
        // Una lista vacía es una respuesta, no una avería: gastar el turno de
        // Nominatim —uno por segundo— por eso retrasaría las búsquedas reales.
        responder({ suggestions: [] });

        await service.autocompletar('sitio inventado');

        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('nominatim'))).toBe(true);
      });

      it('debería resolver la dirección elegida sin volver a la red', async () => {
        // Nominatim la manda ya desmenuzada en la búsqueda; se guarda de paso.
        conGoogleCaido();
        const [sugerencia] = await service.autocompletar('Calle Mayor 1', undefined, 'direccion');
        const llamadas = fetchMock.mock.calls.length;

        const direccion = await service.direccion(sugerencia.placeId);

        expect(direccion?.calle).toBe('Calle Mayor');
        expect(direccion?.codigoPostal).toBe('46001');
        expect(fetchMock.mock.calls).toHaveLength(llamadas);
      });

      it('debería devolver también las coordenadas del portal elegido', async () => {
        conGoogleCaido();
        const [sugerencia] = await service.autocompletar('Calle Mayor 1', undefined, 'direccion');

        await expect(service.coordenadas(sugerencia.placeId)).resolves.toEqual({
          ciudad: 'Valencia', lat: 39.4699, lng: -0.3763,
        });
      });

      it('no debería preguntar a Places por un identificador de OSM', async () => {
        // Places devolvería 404: los identificadores no son intercambiables.
        conGoogleCaido();

        await service.direccion('osm:N42');

        expect(fetchMock.mock.calls.every(([url]) => String(url).includes('nominatim'))).toBe(true);
      });
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

  describe('direccion', () => {
    const respuestaPortal = {
      location: { latitude: 40.4169, longitude: -3.7035 },
      formattedAddress: 'C. Mayor, 24, 28013 Madrid, España',
      addressComponents: [
        { longText: '24', types: ['street_number'] },
        { longText: 'Calle Mayor', types: ['route'] },
        { longText: 'Madrid', types: ['locality'] },
        { longText: 'Madrid', types: ['administrative_area_level_2'] },
        { longText: '28013', types: ['postal_code'] },
        { longText: 'España', types: ['country'] },
      ],
    };

    it('debería desmenuzar la dirección del portal elegido', async () => {
      responder(respuestaPortal);

      await expect(service.direccion('place-portal')).resolves.toEqual({
        calle: 'Calle Mayor',
        numero: '24',
        codigoPostal: '28013',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        pais: 'España',
        formateada: 'C. Mayor, 24, 28013 Madrid, España',
        lat: 40.4169,
        lng: -3.7035,
      });
    });

    it('debería usar la provincia de nivel 1 cuando no llega la de nivel 2', async () => {
      responder({
        location: { latitude: 35.89, longitude: -5.31 },
        addressComponents: [{ longText: 'Ceuta', types: ['administrative_area_level_1'] }],
      });

      await expect(service.direccion('place-ceuta')).resolves.toEqual(
        expect.objectContaining({ provincia: 'Ceuta' }),
      );
    });

    it('debería devolver null si la respuesta no trae posición', async () => {
      responder({ formattedAddress: 'Sin coordenadas' });

      await expect(service.direccion('place-portal')).resolves.toBeNull();
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

  /*
   * Ninguna de estas caídas puede tumbar una búsqueda: el proxy de mapas es un
   * adorno del formulario, no un paso obligatorio para reservar.
   */
  describe('caídas del proveedor', () => {
    it('debería decir que no está configurado sin clave de servidor', async () => {
      const sinClave = await crear(undefined);

      expect(sinClave.estaConfigurado).toBe(false);
    });

    it('debería estar configurado con la clave puesta', () => {
      expect(service.estaConfigurado).toBe(true);
    });

    it('debería devolver null si la red se cae pidiendo coordenadas', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.coordenadas('place-valencia')).resolves.toBeNull();
    });

    it('debería devolver null si Places responde con error a las coordenadas', async () => {
      responder({}, false);

      await expect(service.coordenadas('place-valencia')).resolves.toBeNull();
    });

    it('debería devolver null si la red se cae pidiendo la dirección', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.direccion('place-portal')).resolves.toBeNull();
    });

    it('debería devolver null si Places responde con error a la dirección', async () => {
      responder({}, false);

      await expect(service.direccion('place-portal')).resolves.toBeNull();
    });

    it('debería devolver null pidiendo la dirección sin clave configurada', async () => {
      const sinClave = await crear(undefined);

      await expect(sinClave.direccion('place-portal')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('debería ignorar un identificador de lugar vacío', async () => {
      await expect(service.direccion('')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  /*
   * La caché ahorra dinero: cada consulta a Places se factura. Pero una entrada
   * caducada tiene que volver a pedirse, y el mapa no puede crecer sin fin.
   */
  describe('caché', () => {
    /** Acceso a las cachés privadas: no hay API pública para inspeccionarlas. */
    const cacheDe = (nombre: string): Map<string, { expiraEn: number }> =>
      (service as unknown as Record<string, Map<string, { expiraEn: number }>>)[nombre];

    it('debería volver a preguntar cuando la entrada ha caducado', async () => {
      responder({ location: { latitude: 39.47, longitude: -0.376 }, displayName: { text: 'Valencia' } });
      await service.coordenadas('place-valencia');

      // Se caduca la entrada a mano en vez de esperar 30 días.
      cacheDe('cacheCoordenadas').get('place-valencia')!.expiraEn = Date.now() - 1;
      await service.coordenadas('place-valencia');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('debería descartar la entrada caducada en vez de dejarla ocupando sitio', async () => {
      responder({ location: { latitude: 39.47, longitude: -0.376 }, displayName: { text: 'Valencia' } });
      await service.coordenadas('place-valencia');
      cacheDe('cacheCoordenadas').get('place-valencia')!.expiraEn = Date.now() - 1;

      // El reintento falla, así que nada vuelve a escribirse: lo que quede en la
      // caché es lo que sobrevivió a la lectura caducada.
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));
      await service.coordenadas('place-valencia');

      expect(cacheDe('cacheCoordenadas').has('place-valencia')).toBe(false);
    });

    /* Sin tope, un bot pidiendo sugerencias distintas agotaría la memoria. */
    it('debería desalojar la entrada más antigua al llegar al tope', async () => {
      const cache = cacheDe('cacheCoordenadas');
      const dentroDeUnMes = Date.now() + 30 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 5_000; i++) cache.set(`relleno-${i}`, { expiraEn: dentroDeUnMes });
      responder({ location: { latitude: 39.47, longitude: -0.376 }, displayName: { text: 'Valencia' } });

      await service.coordenadas('place-valencia');

      expect(cache.size).toBe(5_000);
      expect(cache.has('relleno-0')).toBe(false);
      expect(cache.has('place-valencia')).toBe(true);
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

    it('debería servir los tipos cacheados durante el día', async () => {
      responder({ date: '2026-07-24', rates: { GBP: 0.84 } });

      await service.tiposDeCambio();
      await service.tiposDeCambio();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('debería fechar hoy los tipos si el proveedor no manda fecha', async () => {
      responder({ rates: { GBP: 0.84 } });

      const cambio = await service.tiposDeCambio();

      expect(cambio.fecha).toBe(new Date().toISOString().slice(0, 10));
    });

    it('debería aguantar una respuesta sin tasas', async () => {
      responder({ date: '2026-07-24' });

      await expect(service.tiposDeCambio()).resolves.toMatchObject({ tasas: { EUR: 1 } });
    });

    it('debería caer al euro solo si el proveedor falla', async () => {
      responder({}, false);

      const cambio = await service.tiposDeCambio();

      expect(cambio.tasas).toEqual({ EUR: 1 });
    });
  });
});
