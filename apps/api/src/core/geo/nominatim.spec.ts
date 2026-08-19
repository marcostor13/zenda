import { ProveedorOsm, esIdOsm } from './nominatim';

describe('nominatim', () => {
  /** Portal tal y como lo devuelve Nominatim, recortado a lo que se usa. */
  const PORTAL = {
    osm_type: 'node',
    osm_id: 2615210653,
    lat: '40.4180',
    lon: '-3.6987',
    display_name: '45, Calle de Alcalá, Cortes, Centro, Madrid, Comunidad de Madrid, 28014, España',
    address: {
      house_number: '45',
      road: 'Calle de Alcalá',
      postcode: '28014',
      city: 'Madrid',
      state: 'Comunidad de Madrid',
      country: 'España',
    },
  };

  const POBLACION = {
    osm_type: 'relation',
    osm_id: 344953,
    lat: '39.4699',
    lon: '-0.3763',
    display_name: 'Valencia, Comarca de Valencia, Comunidad Valenciana, España',
    address: { city: 'Valencia', state: 'Comunidad Valenciana', country: 'España' },
  };

  let osm: ProveedorOsm;
  let fetchSimulado: jest.Mock;

  /** Responde con lo indicado y deja ver con qué URL se llamó. */
  const responder = (cuerpo: unknown, ok = true): void => {
    fetchSimulado.mockResolvedValue({ ok, json: async () => cuerpo });
  };

  const urlLlamada = (indice = 0): string => String(fetchSimulado.mock.calls[indice][0]);

  beforeEach(() => {
    jest.useFakeTimers();
    osm = new ProveedorOsm();
    fetchSimulado = jest.fn();
    global.fetch = fetchSimulado as never;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Deja correr el espaciado entre llamadas sin esperar de verdad. */
  const conTiempo = async <T>(promesa: Promise<T>): Promise<T> => {
    await jest.runAllTimersAsync();
    return promesa;
  };

  describe('esIdOsm', () => {
    it('debería distinguir un id de OSM de uno de Google', () => {
      expect(esIdOsm('osm:N2615210653')).toBe(true);
      expect(esIdOsm('ChIJgTwKgJcpQg0RaSKMYcHeNsQ')).toBe(false);
    });
  });

  describe('sugerencias', () => {
    it('debería componer la calle con su número', async () => {
      responder([PORTAL]);

      const [sugerencia] = await conTiempo(osm.sugerencias('Alcalá 45', 'direccion'));

      expect(sugerencia.principal).toBe('Calle de Alcalá 45');
      expect(sugerencia.secundario).toBe('28014, Madrid, Comunidad de Madrid');
    });

    it('debería identificar el resultado con el prefijo y la letra de OSM', () => {
      // El prefijo es lo que permite luego saber a quién preguntar por el detalle.
      responder([PORTAL]);

      return conTiempo(osm.sugerencias('Alcalá 45', 'direccion')).then(([sugerencia]) => {
        expect(sugerencia.placeId).toBe('osm:N2615210653');
      });
    });

    it('debería usar la letra que corresponde a cada tipo de elemento', async () => {
      responder([POBLACION]);

      const [sugerencia] = await conTiempo(osm.sugerencias('Valencia', 'ciudad'));

      expect(sugerencia.placeId).toBe('osm:R344953');
    });

    it('debería mostrar la población y su contexto al buscar ciudades', async () => {
      responder([POBLACION]);

      const [sugerencia] = await conTiempo(osm.sugerencias('Valencia', 'ciudad'));

      expect(sugerencia.principal).toBe('Valencia');
      expect(sugerencia.secundario).toBe('Comunidad Valenciana, España');
    });

    it('debería acotar la búsqueda de poblaciones a núcleos habitados', async () => {
      // Sin el filtro, "Valencia" devuelve antes una calle llamada Valencia que
      // la propia ciudad.
      responder([POBLACION]);

      await conTiempo(osm.sugerencias('Valencia', 'ciudad'));

      expect(urlLlamada()).toContain('featureType=settlement');
    });

    it('no debería acotar la búsqueda de direcciones', async () => {
      responder([PORTAL]);

      await conTiempo(osm.sugerencias('Alcalá 45', 'direccion'));

      expect(urlLlamada()).not.toContain('featureType');
    });

    it('debería limitarse al mercado europeo', async () => {
      responder([PORTAL]);

      await conTiempo(osm.sugerencias('Alcalá 45', 'direccion'));

      expect(urlLlamada()).toContain('countrycodes=es%2Cpt%2Cfr%2Cit%2Cde');
    });

    it('debería identificarse, que es la condición de uso de Nominatim', async () => {
      // Sin User-Agent, Nominatim responde 403 y acaba bloqueando la IP.
      responder([PORTAL]);

      await conTiempo(osm.sugerencias('Alcalá 45', 'direccion'));

      const cabeceras = (fetchSimulado.mock.calls[0][1] as { headers: Record<string, string> }).headers;
      expect(cabeceras['User-Agent']).toContain('Doogking');
    });

    it('debería devolver vacío si Nominatim falla', async () => {
      responder({}, false);

      await expect(conTiempo(osm.sugerencias('Alcalá 45', 'direccion'))).resolves.toEqual([]);
    });

    it('debería devolver vacío si la red se cae', async () => {
      fetchSimulado.mockRejectedValue(new Error('ECONNRESET'));

      await expect(conTiempo(osm.sugerencias('Alcalá 45', 'direccion'))).resolves.toEqual([]);
    });

    it('debería aguantar un resultado sin dirección desmenuzada', async () => {
      responder([{ osm_type: 'node', osm_id: 1, lat: '40', lon: '-3', display_name: 'Sitio raro' }]);

      const [sugerencia] = await conTiempo(osm.sugerencias('raro', 'direccion'));

      expect(sugerencia.principal).toBe('Sitio raro');
      expect(sugerencia.secundario).toBe('');
    });
  });

  describe('espaciado entre llamadas', () => {
    it('debería separar las llamadas al menos un segundo', async () => {
      // Nominatim admite una consulta por segundo; saltárselo acaba en bloqueo.
      responder([PORTAL]);

      const primera = osm.sugerencias('una', 'direccion');
      const segunda = osm.sugerencias('otra', 'direccion');

      await jest.advanceTimersByTimeAsync(0);
      expect(fetchSimulado).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1_100);
      expect(fetchSimulado).toHaveBeenCalledTimes(2);

      await Promise.all([primera, segunda]);
    });

    it('debería rendirse en vez de encolar esperas eternas', async () => {
      // Con una cola larga el usuario ya ha dejado de mirar: esperar diez
      // segundos para contestar es peor que no contestar.
      responder([PORTAL]);

      const peticiones = Array.from({ length: 12 }, (_, i) =>
        osm.sugerencias(`consulta ${i}`, 'direccion'));

      await jest.runAllTimersAsync();
      const respuestas = await Promise.all(peticiones);

      expect(respuestas.filter((r) => r.length === 0).length).toBeGreaterThan(0);
      expect(fetchSimulado.mock.calls.length).toBeLessThan(12);
    });
  });

  describe('sugerenciasConDireccion', () => {
    it('debería devolver la dirección ya resuelta junto a la sugerencia', async () => {
      // Nominatim la manda en la propia búsqueda: guardarla ahorra una segunda
      // llamada, que además consumiría el turno de la siguiente búsqueda.
      responder([PORTAL]);

      const [fila] = await conTiempo(osm.sugerenciasConDireccion('Alcalá 45', 'direccion'));

      expect(fila.direccion).toEqual({
        calle: 'Calle de Alcalá',
        numero: '45',
        codigoPostal: '28014',
        ciudad: 'Madrid',
        provincia: 'Comunidad de Madrid',
        pais: 'España',
        formateada: PORTAL.display_name,
        lat: 40.418,
        lng: -3.6987,
      });
    });

    it('debería descartar la dirección de un resultado sin coordenadas', async () => {
      responder([{ ...PORTAL, lat: undefined, lon: undefined }]);

      const [fila] = await conTiempo(osm.sugerenciasConDireccion('Alcalá 45', 'direccion'));

      expect(fila.direccion).toBeNull();
      expect(fila.sugerencia.placeId).toBe('osm:N2615210653');
    });
  });

  describe('direccion y coordenadas', () => {
    it('debería resolver un id de OSM por lookup', async () => {
      responder([PORTAL]);

      const direccion = await conTiempo(osm.direccion('osm:N2615210653'));

      expect(urlLlamada()).toContain('lookup');
      expect(urlLlamada()).toContain('osm_ids=N2615210653');
      expect(direccion?.calle).toBe('Calle de Alcalá');
    });

    it('debería devolver las coordenadas con su población', async () => {
      responder([POBLACION]);

      const punto = await conTiempo(osm.coordenadas('osm:R344953'));

      expect(punto).toEqual({ ciudad: 'Valencia', lat: 39.4699, lng: -0.3763 });
    });

    it('debería devolver null si el lookup no encuentra nada', async () => {
      responder([]);

      await expect(conTiempo(osm.direccion('osm:N1'))).resolves.toBeNull();
    });
  });
});
