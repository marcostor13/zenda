import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AsistenteService } from './asistente.service';

describe('AsistenteService', () => {
  let fetchMock: jest.Mock;

  const crear = async (variables: Record<string, string | undefined>): Promise<AsistenteService> => {
    const modulo = await Test.createTestingModule({
      providers: [
        AsistenteService,
        { provide: ConfigService, useValue: { get: (k: string) => variables[k] } },
      ],
    }).compile();
    return modulo.get(AsistenteService);
  };

  /** Lo que devolvería el proveedor con ese texto como respuesta del modelo. */
  const respondeConTexto = (texto: string) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: texto } }] }),
    });
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('proveedor de IA', () => {
    it('debería usar DeepSeek cuando está su clave', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('Hola');

      await service.responder({ pregunta: '¿Cómo reservo?' });

      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toContain('api.deepseek.com');
      expect(opciones.headers.Authorization).toBe('Bearer ds-1');
      expect(JSON.parse(opciones.body).model).toBe('deepseek-chat');
    });

    it('debería usar OpenAI cuando es la única configurada', async () => {
      const service = await crear({ OPENAI_API_KEY: 'oa-1' });
      respondeConTexto('Hola');

      await service.responder({ pregunta: '¿Cómo reservo?' });

      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toContain('api.openai.com');
      expect(opciones.headers.Authorization).toBe('Bearer oa-1');
    });

    /* DeepSeek es el que ya usan el buscador con IA y el planificador. */
    it('debería preferir DeepSeek si están las dos', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1', OPENAI_API_KEY: 'oa-1' });
      respondeConTexto('Hola');

      await service.responder({ pregunta: '¿Cómo reservo?' });

      expect(fetchMock.mock.calls[0][0]).toContain('api.deepseek.com');
    });

    /* Sin claves no se finge una avería: se dice y se ofrece la ayuda. */
    it('debería avisar de que no está disponible sin ninguna clave, sin llamar a nadie', async () => {
      const service = await crear({});

      const r = await service.responder({ pregunta: '¿Cómo reservo?' });

      expect(r.disponible).toBe(false);
      expect(r.enlaces).toEqual([{ titulo: 'Centro de ayuda', ruta: '/ayuda' }]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('lo que se le manda al modelo', () => {
    it('debería darle la base de conocimiento y la página donde está el usuario', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('Hola');

      await service.responder({ pregunta: '¿Cómo reservo esto?', ruta: '/peluqueria/s1' });

      const mensajes = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
      expect(mensajes[0].role).toBe('system');
      expect(mensajes[0].content).toContain('Qué es Doogking');
      expect(mensajes[0].content).toContain('/peluqueria/s1');
      expect(mensajes.at(-1)).toEqual({ role: 'user', content: '¿Cómo reservo esto?' });
    });

    /* El historial se acota: cada turno se paga por token. */
    it('debería mandar sólo los últimos turnos, traducidos a roles del modelo', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('Hola');
      const historial = Array.from({ length: 9 }, (_, i) => ({
        autor: (i % 2 ? 'asistente' : 'cliente') as 'cliente' | 'asistente',
        texto: `turno ${i}`,
      }));

      await service.responder({ pregunta: 'y ahora?', historial });

      const mensajes = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
      // system + 6 turnos + la pregunta.
      expect(mensajes).toHaveLength(8);
      expect(mensajes[1]).toEqual({ role: 'assistant', content: 'turno 3' });
      expect(mensajes[2]).toEqual({ role: 'user', content: 'turno 4' });
    });
  });

  describe('enlaces que propone la respuesta', () => {
    it('debería separar la última línea de enlaces del cuerpo', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('Entra en tus reservas y pulsa cancelar.\nENLACES: Mis reservas|/reservas/mis ; Ayuda|/ayuda');

      const r = await service.responder({ pregunta: '¿Cómo cancelo?' });

      expect(r.respuesta).toBe('Entra en tus reservas y pulsa cancelar.');
      expect(r.enlaces).toEqual([
        { titulo: 'Mis reservas', ruta: '/reservas/mis' },
        { titulo: 'Ayuda', ruta: '/ayuda' },
      ]);
    });

    /* Una respuesta generada no puede mandar a nadie fuera de la web. */
    it('debería descartar enlaces que salen del sitio', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('Mira esto.\nENLACES: Fuera|https://evil.example ; Protocolo|//evil.example ; Ayuda|/ayuda');

      const r = await service.responder({ pregunta: 'x' });

      expect(r.enlaces).toEqual([{ titulo: 'Ayuda', ruta: '/ayuda' }]);
    });

    it('debería dejar la respuesta tal cual si no propone enlaces', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      respondeConTexto('El IVA ya va incluido en el precio.');

      const r = await service.responder({ pregunta: '¿El precio lleva IVA?' });

      expect(r).toEqual({ disponible: true, respuesta: 'El IVA ya va incluido en el precio.' });
    });
  });

  describe('cuando el proveedor falla', () => {
    it('debería contestar algo útil en vez de reventar', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      const r = await service.responder({ pregunta: '¿Cómo reservo?' });

      expect(r.disponible).toBe(true);
      expect(r.respuesta).toContain('Vuelve a intentarlo');
      expect(r.enlaces).toEqual([{ titulo: 'Centro de ayuda', ruta: '/ayuda' }]);
    });

    it('debería hacer lo mismo si la red se cae', async () => {
      const service = await crear({ DEEPSEEK_API_KEY: 'ds-1' });
      fetchMock.mockRejectedValue(new Error('red caída'));

      await expect(service.responder({ pregunta: 'x' })).resolves.toMatchObject({ disponible: true });
    });
  });
});
