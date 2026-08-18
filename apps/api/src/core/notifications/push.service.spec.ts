import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PushService } from './push.service';
import { Dispositivo } from './dispositivo.schema';

describe('PushService', () => {
  let dispositivoModel: any;
  const USUARIO_ID = new Types.ObjectId().toString();
  const envio = { titulo: 'Reserva confirmada', cuerpo: 'Tu cita es mañana', ruta: '/reservas' };

  /** Instancia el servicio con (o sin) la clave del proveedor configurada. */
  async function crear(serverKey?: string): Promise<PushService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: getModelToken(Dispositivo.name), useValue: dispositivoModel },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(serverKey) } },
      ],
    }).compile();
    return moduleRef.get(PushService);
  }

  function mockDispositivos(tokens: string[]) {
    dispositivoModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(tokens.map((token) => ({ token }))),
    });
  }

  /** Respuesta de FCM: `success > 0` significa entregada. */
  function mockFetch(respuestas: Array<{ ok: boolean; success?: number } | Error>) {
    const fn = jest.fn();
    for (const r of respuestas) {
      if (r instanceof Error) fn.mockRejectedValueOnce(r);
      else fn.mockResolvedValueOnce({ ok: r.ok, json: async () => ({ success: r.success ?? 0 }) });
    }
    global.fetch = fn as never;
    return fn;
  }

  beforeEach(() => {
    dispositivoModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'd1' }) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      find: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('configuración', () => {
    it('debería considerarse configurado solo con la clave del proveedor', async () => {
      expect((await crear('clave-fcm')).estaConfigurado).toBe(true);
      expect((await crear(undefined)).estaConfigurado).toBe(false);
    });
  });

  describe('registrar', () => {
    it('debería dar de alta el dispositivo de forma idempotente', async () => {
      // Reinstalar la app no puede duplicar el dispositivo.
      const service = await crear('clave-fcm');

      await service.registrar(USUARIO_ID, 'tok-1', 'android');

      const [filtro, cambios, opciones] = dispositivoModel.findOneAndUpdate.mock.calls[0];
      expect(filtro).toEqual({ token: 'tok-1' });
      expect(opciones).toEqual({ upsert: true, new: true });
      expect(String(cambios.$set.usuarioId)).toBe(USUARIO_ID);
    });

    it('debería reactivar un dispositivo que se había desactivado', async () => {
      const service = await crear('clave-fcm');

      await service.registrar(USUARIO_ID, 'tok-1', 'ios');

      expect(dispositivoModel.findOneAndUpdate.mock.calls[0][1].$set.activo).toBe(true);
    });

    it('debería funcionar aunque no haya proveedor configurado', async () => {
      // El registro va siempre: así la app puede registrar tokens desde el
      // primer día y el envío se activa después, sin tocar el cliente.
      const service = await crear(undefined);

      await service.registrar(USUARIO_ID, 'tok-1', 'android');

      expect(dispositivoModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('darDeBaja', () => {
    it('debería borrar el dispositivo por su token', async () => {
      const service = await crear('clave-fcm');

      await service.darDeBaja('tok-1');

      expect(dispositivoModel.deleteOne).toHaveBeenCalledWith({ token: 'tok-1' });
    });
  });

  describe('enviarA', () => {
    it('no debería marcar como omitido si el usuario no tiene dispositivos', async () => {
      mockDispositivos([]);
      const service = await crear('clave-fcm');

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: false });
    });

    it('debería omitir el envío si no hay proveedor configurado', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear(undefined);
      const fetchSpy = mockFetch([]);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: true });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('debería contar como enviada una push aceptada por el proveedor', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear('clave-fcm');
      mockFetch([{ ok: true, success: 1 }]);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 1, desactivados: 0, omitido: false });
    });

    it('debería enviar título, cuerpo y ruta al proveedor', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear('clave-fcm');
      const fetchSpy = mockFetch([{ ok: true, success: 1 }]);

      await service.enviarA(USUARIO_ID, envio);

      const cuerpo = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(cuerpo.to).toBe('tok-1');
      expect(cuerpo.notification).toEqual({ title: envio.titulo, body: envio.cuerpo });
      expect(cuerpo.data.ruta).toBe('/reservas');
    });

    it('debería mandar la raíz como ruta si el envío no indica ninguna', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear('clave-fcm');
      const fetchSpy = mockFetch([{ ok: true, success: 1 }]);

      await service.enviarA(USUARIO_ID, { titulo: 'T', cuerpo: 'C' });

      expect(JSON.parse(fetchSpy.mock.calls[0][1].body).data.ruta).toBe('/');
    });

    it('debería desactivar el dispositivo cuyo token rechaza el proveedor', async () => {
      // Se desactiva en vez de borrarlo, para conservar el rastro de que existió.
      mockDispositivos(['tok-malo']);
      const service = await crear('clave-fcm');
      mockFetch([{ ok: true, success: 0 }]);

      const res = await service.enviarA(USUARIO_ID, envio);

      expect(res).toEqual({ enviados: 0, desactivados: 1, omitido: false });
      expect(dispositivoModel.updateOne).toHaveBeenCalledWith(
        { token: 'tok-malo' }, { $set: { activo: false } },
      );
    });

    it('debería desactivar también si el proveedor responde con error HTTP', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear('clave-fcm');
      mockFetch([{ ok: false }]);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 1, omitido: false });
    });

    it('no debería lanzar si la red falla: una push no puede tumbar el flujo', async () => {
      mockDispositivos(['tok-1']);
      const service = await crear('clave-fcm');
      mockFetch([new Error('ECONNRESET')]);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 1, omitido: false });
    });

    it('debería seguir con el resto de dispositivos aunque uno falle', async () => {
      mockDispositivos(['tok-ok', 'tok-malo', 'tok-ok-2']);
      const service = await crear('clave-fcm');
      mockFetch([{ ok: true, success: 1 }, { ok: true, success: 0 }, { ok: true, success: 1 }]);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 2, desactivados: 1, omitido: false });
    });
  });
});
