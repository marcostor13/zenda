import { ConfigService } from '@nestjs/config';
import { AiSearchService } from './ai-search.service';

describe('AiSearchService', () => {
  const conClave = (clave?: string): AiSearchService =>
    new AiSearchService({ get: jest.fn().mockReturnValue(clave) } as unknown as ConfigService);

  /** Respuesta de DeepSeek con el JSON que devolvería el modelo. */
  const respondeCon = (contenido: unknown): void => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(contenido) } }],
      }),
    }) as unknown as typeof fetch;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sin clave configurada', () => {
    /**
     * Antes devolvía todo a `null` y el buscador acababa en alojamiento sin
     * ciudad. La interpretación local es ahora el suelo del servicio: el modelo
     * externo afina, pero la frase se entiende con o sin él.
     */
    it('no debería llamar al proveedor y debería interpretar la frase por su cuenta', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;

      const resultado = await conClave(undefined).interpretSearch('Peluquería canina en Valencia');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(resultado.vertical).toBe('peluqueria');
      expect(resultado.ciudad).toBe('Valencia');
      expect(resultado.explicacion).toContain('Valencia');
    });

    it('debería admitir que no ha entendido una frase sin categoría ni ciudad', async () => {
      const resultado = await conClave(undefined).interpretSearch('algo bonito');

      expect(resultado.vertical).toBeNull();
      expect(resultado.explicacion).toContain('filtros');
    });
  });

  /**
   * Regresión de la observación del cliente: «playa» no es ninguna de las ocho
   * categorías reservables, pero sí es el mapa de playas caninas de la
   * comunidad. Acababa en «no sé a qué categoría te refieres».
   */
  describe('sitios de la comunidad', () => {
    it('debería resolver «playa» al mapa de playas y sin vertical', async () => {
      const resultado = await conClave(undefined).interpretSearch('playas caninas en Alicante');

      expect(resultado.vertical).toBeNull();
      expect(resultado.tipoLugar).toBe('playa');
      expect(resultado.ciudad).toBe('Alicante');
      expect(resultado.explicacion).toContain('Playa');
    });

    /**
     * El sitio no puede robarle la búsqueda a un servicio que se reserva: quien
     * busca una peluquería cerca de la playa quiere la peluquería.
     */
    it('no debería devolver sitio cuando la frase pide un servicio', async () => {
      const resultado = await conClave(undefined).interpretSearch('peluquería cerca de la playa');

      expect(resultado.vertical).toBe('peluqueria');
      expect(resultado.tipoLugar).toBeNull();
    });

    it('debería ignorar el sitio que invente el modelo si hay vertical', async () => {
      respondeCon({ vertical: 'veterinaria', tipoLugar: 'playa', explicacion: 'x' });

      const resultado = await conClave('sk-test').interpretSearch('veterinario en Gandía');

      expect(resultado.vertical).toBe('veterinaria');
      expect(resultado.tipoLugar).toBeNull();
    });

    it('debería descartar un tipo de sitio que no existe', async () => {
      respondeCon({ tipoLugar: 'montaña rusa', explicacion: 'x' });

      expect((await conClave('sk-test').interpretSearch('x')).tipoLugar).toBeNull();
    });
  });

  describe('interpretación correcta', () => {
    it('debería devolver los parámetros que extrae el modelo', async () => {
      respondeCon({
        vertical: 'alojamiento',
        ciudad: 'Valencia',
        desde: '2026-09-01',
        hasta: '2026-09-05',
        presupuestoMax: 200,
        pasajeros: 2,
        extras: { tamanoPerro: 'grande' },
        explicacion: 'Alojamiento en Valencia',
      });

      const resultado = await conClave('sk-test').interpretSearch('hotel en Valencia');

      expect(resultado).toEqual({
        vertical: 'alojamiento',
        tipoLugar: null,
        ciudad: 'Valencia',
        desde: '2026-09-01',
        hasta: '2026-09-05',
        presupuestoMax: 200,
        pasajeros: 2,
        extras: { tamanoPerro: 'grande' },
        explicacion: 'Alojamiento en Valencia',
      });
    });
  });

  /**
   * Antes se hacía `JSON.parse(content) as SearchParams`. Un aserto de tipo no
   * comprueba nada en ejecución: lo que devolviera el modelo llegaba tal cual al
   * frontend y de ahí al filtro del catálogo.
   */
  describe('saneado de la salida del modelo', () => {
    it('debería descartar un vertical que no existe', async () => {
      respondeCon({ vertical: 'submarinismo', explicacion: 'x' });

      expect((await conClave('sk-test').interpretSearch('x')).vertical).toBeNull();
    });

    it('debería descartar una ciudad que no es texto', async () => {
      respondeCon({ ciudad: { nombre: 'Valencia' }, explicacion: 'x' });

      expect((await conClave('sk-test').interpretSearch('x')).ciudad).toBeNull();
    });

    it('debería descartar fechas que no vengan como YYYY-MM-DD', async () => {
      respondeCon({ desde: 'el próximo viernes', hasta: '01/09/2026' });

      const resultado = await conClave('sk-test').interpretSearch('x');
      expect(resultado.desde).toBeNull();
      expect(resultado.hasta).toBeNull();
    });

    it('debería descartar importes que llegan como texto', async () => {
      respondeCon({ presupuestoMax: '200 euros', pasajeros: 'dos' });

      const resultado = await conClave('sk-test').interpretSearch('x');
      expect(resultado.presupuestoMax).toBeNull();
      expect(resultado.pasajeros).toBeNull();
    });

    it('debería descartar importes negativos', async () => {
      respondeCon({ presupuestoMax: -50 });

      expect((await conClave('sk-test').interpretSearch('x')).presupuestoMax).toBeNull();
    });

    it('debería quedarse sólo con los extras de texto', async () => {
      respondeCon({ extras: { origen: 'Madrid', destino: 42, valido: ' Sevilla ' } });

      expect((await conClave('sk-test').interpretSearch('x')).extras).toEqual({
        origen: 'Madrid',
        valido: 'Sevilla',
      });
    });

    it('debería devolver extras vacíos si el modelo manda una lista', async () => {
      respondeCon({ extras: ['Madrid'] });

      expect((await conClave('sk-test').interpretSearch('x')).extras).toEqual({});
    });

    it('debería redactar la explicación si el modelo no la manda', async () => {
      respondeCon({ vertical: 'veterinaria' });

      expect((await conClave('sk-test').interpretSearch('x')).explicacion)
        .toBe('Veterinarios.');
    });
  });

  describe('degradación ante fallos', () => {
    const FRASE = 'Peluquería canina en Valencia';

    it('debería seguir interpretando la frase si el proveedor responde con error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

      const resultado = await conClave('sk-test').interpretSearch(FRASE);

      expect(resultado.vertical).toBe('peluqueria');
      expect(resultado.ciudad).toBe('Valencia');
    });

    it('debería seguir interpretando la frase si el contenido no es JSON válido', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'no soy json' } }] }),
      }) as unknown as typeof fetch;

      expect((await conClave('sk-test').interpretSearch(FRASE)).vertical).toBe('peluqueria');
    });

    it('debería seguir interpretando la frase si la red falla', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

      expect((await conClave('sk-test').interpretSearch(FRASE)).ciudad).toBe('Valencia');
    });
  });

  /**
   * El modelo manda donde dice algo; lo que se deja en blanco lo rellena la
   * interpretación local. Nunca al revés: un dato del modelo no se pisa.
   */
  describe('combinación de modelo e interpretación local', () => {
    it('debería conservar la ciudad de la frase si el modelo la deja vacía', async () => {
      respondeCon({ vertical: 'peluqueria', ciudad: null, explicacion: 'Peluquerías' });

      const resultado = await conClave('sk-test').interpretSearch('Peluquería canina en Valencia');

      expect(resultado.ciudad).toBe('Valencia');
      expect(resultado.explicacion).toBe('Peluquerías');
    });

    it('debería respetar lo que sí concreta el modelo', async () => {
      respondeCon({ vertical: 'veterinaria', ciudad: 'Sevilla', desde: '2027-01-04' });

      const resultado = await conClave('sk-test').interpretSearch('peluquería en Valencia mañana');

      expect(resultado.vertical).toBe('veterinaria');
      expect(resultado.ciudad).toBe('Sevilla');
      expect(resultado.desde).toBe('2027-01-04');
    });
  });
});
