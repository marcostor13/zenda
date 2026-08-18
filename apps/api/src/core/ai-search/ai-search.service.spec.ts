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
    it('no debería llamar al proveedor y debería devolver params vacíos', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;

      const resultado = await conClave(undefined).interpretSearch('hotel para mi perro');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(resultado.vertical).toBeNull();
      expect(resultado.explicacion).toContain('formulario');
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

    it('debería devolver explicación vacía, no undefined, si falta', async () => {
      respondeCon({ vertical: 'veterinaria' });

      expect((await conClave('sk-test').interpretSearch('x')).explicacion).toBe('');
    });
  });

  describe('degradación ante fallos', () => {
    it('debería caer al formulario manual si el proveedor responde con error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

      const resultado = await conClave('sk-test').interpretSearch('x');

      expect(resultado.vertical).toBeNull();
      expect(resultado.explicacion).toContain('formulario');
    });

    it('debería caer al formulario manual si el contenido no es JSON válido', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'no soy json' } }] }),
      }) as unknown as typeof fetch;

      const resultado = await conClave('sk-test').interpretSearch('x');

      expect(resultado.explicacion).toContain('formulario');
    });

    it('debería caer al formulario manual si la red falla', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

      const resultado = await conClave('sk-test').interpretSearch('x');

      expect(resultado.explicacion).toContain('formulario');
    });
  });
});
