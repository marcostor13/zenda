import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PushService } from './push.service';
import { FcmClient, ResultadoEnvio } from './fcm.client';
import { Dispositivo } from './dispositivo.schema';

describe('PushService', () => {
  let dispositivoModel: any;
  let fcm: jest.Mocked<Pick<FcmClient, 'enviar'>> & { estaConfigurado: boolean };

  const USUARIO_ID = new Types.ObjectId().toString();
  const envio = { titulo: 'Reserva confirmada', cuerpo: 'Tu cita es mañana', ruta: '/reservas' };

  const crear = async (configurado = true): Promise<PushService> => {
    fcm = {
      estaConfigurado: configurado,
      enviar: jest.fn().mockResolvedValue('entregado' as ResultadoEnvio),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: getModelToken(Dispositivo.name), useValue: dispositivoModel },
        { provide: FcmClient, useValue: fcm },
      ],
    }).compile();

    return moduleRef.get(PushService);
  };

  /** Los dispositivos del usuario, tal como los devuelve `find().select().lean()`. */
  const conDispositivos = (tokens: string[]) => {
    dispositivoModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(tokens.map((token) => ({ token }))),
    });
  };

  beforeEach(() => {
    dispositivoModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'd1' }) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      find: jest.fn(),
      db: { collection: jest.fn() },
    };
    conDispositivos([]);
  });

  describe('registrar', () => {
    it('debería dar de alta el dispositivo de forma idempotente', async () => {
      // Reinstalar la app manda el mismo token: no puede crear otro registro.
      const service = await crear();

      await service.registrar(USUARIO_ID, 'tok-1', 'android');

      expect(dispositivoModel.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'tok-1' },
        expect.objectContaining({ $set: expect.objectContaining({ plataforma: 'android' }) }),
        { upsert: true, new: true },
      );
    });

    it('debería reactivar un dispositivo que se había desactivado', async () => {
      const service = await crear();

      await service.registrar(USUARIO_ID, 'tok-1', 'ios');

      const cambios = dispositivoModel.findOneAndUpdate.mock.calls[0][1];
      expect(cambios.$set.activo).toBe(true);
    });

    it('debería funcionar aunque no haya proveedor configurado', async () => {
      // El alta de tokens no depende de las credenciales: la app puede
      // registrarse desde el primer día y el envío activarse después.
      const service = await crear(false);

      await expect(service.registrar(USUARIO_ID, 'tok-1', 'android')).resolves.toBeTruthy();
    });
  });

  describe('darDeBaja', () => {
    it('debería borrar el dispositivo por su token', async () => {
      const service = await crear();

      await service.darDeBaja('tok-1');

      expect(dispositivoModel.deleteOne).toHaveBeenCalledWith({ token: 'tok-1' });
    });
  });

  describe('enviarA', () => {
    it('debería entregar a cada dispositivo del usuario', async () => {
      const service = await crear();
      conDispositivos(['tok-1', 'tok-2']);

      const resultado = await service.enviarA(USUARIO_ID, envio);

      expect(resultado).toEqual({ enviados: 2, desactivados: 0, omitido: false });
      expect(fcm.enviar).toHaveBeenCalledWith('tok-1', envio);
    });

    it('no debería marcarse como omitido si el usuario no tiene dispositivos', async () => {
      // Sin dispositivos no hay nada que enviar, pero tampoco falta configuración.
      const service = await crear();

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: false });
    });

    it('debería omitir el envío si no hay proveedor configurado', async () => {
      const service = await crear(false);
      conDispositivos(['tok-1']);

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: true });
      expect(fcm.enviar).not.toHaveBeenCalled();
    });

    it('debería dar de baja el token que la pasarela ya no reconoce', async () => {
      const service = await crear();
      conDispositivos(['tok-vivo', 'tok-muerto']);
      fcm.enviar.mockImplementation(async (token: string) =>
        (token === 'tok-muerto' ? 'token_invalido' : 'entregado'));

      const resultado = await service.enviarA(USUARIO_ID, envio);

      expect(resultado).toEqual({ enviados: 1, desactivados: 1, omitido: false });
      expect(dispositivoModel.updateMany).toHaveBeenCalledWith(
        { token: { $in: ['tok-muerto'] } },
        { $set: { activo: false } },
      );
    });

    it('no debería dar de baja por un fallo pasajero', async () => {
      // Un 5xx o un corte de red no significa que el dispositivo ya no exista.
      const service = await crear();
      conDispositivos(['tok-1']);
      fcm.enviar.mockResolvedValue('error');

      const resultado = await service.enviarA(USUARIO_ID, envio);

      expect(resultado).toEqual({ enviados: 0, desactivados: 0, omitido: false });
      expect(dispositivoModel.updateMany).not.toHaveBeenCalledWith(
        expect.anything(),
        { $set: { activo: false } },
      );
    });

    it('no debería lanzar si la consulta falla: una push no puede tumbar el flujo', async () => {
      const service = await crear();
      dispositivoModel.find.mockImplementation(() => { throw new Error('mongo caído'); });

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: true });
    });

    it('debería seguir con el resto de dispositivos aunque uno falle', async () => {
      const service = await crear();
      conDispositivos(['tok-1', 'tok-2', 'tok-3']);
      fcm.enviar.mockImplementation(async (token: string) =>
        (token === 'tok-2' ? 'error' : 'entregado'));

      await expect(service.enviarA(USUARIO_ID, envio))
        .resolves.toMatchObject({ enviados: 2 });
    });
  });

  describe('enviarAVarios', () => {
    it('debería omitir el envío masivo si no hay proveedor configurado', async () => {
      const service = await crear(false);

      await expect(service.enviarAVarios({}, envio))
        .resolves.toEqual({ enviados: 0, desactivados: 0, omitido: true });
    });

    it('debería recorrer los dispositivos por lotes hasta agotarlos', async () => {
      // Cargar miles de tokens de golpe tumbaría el proceso y FCM cortaría por
      // exceso de peticiones simultáneas.
      const service = await crear();
      const lleno = Array.from({ length: 25 }, (_, i) => ({ token: `t${i}` }));
      const exec = jest.fn()
        .mockResolvedValueOnce(lleno)
        .mockResolvedValueOnce([{ token: 'ultimo' }]);
      dispositivoModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec,
      });

      const resultado = await service.enviarAVarios({}, envio);

      expect(resultado.enviados).toBe(26);
      expect(exec).toHaveBeenCalledTimes(2);
    });

    it('debería enviar sólo a los usuarios pedidos cuando se indican', async () => {
      const service = await crear();
      conDispositivos(['tok-1']);
      const usuario = new Types.ObjectId().toString();

      await service.enviarAVarios({ usuarioIds: [usuario] }, envio);

      const filtro = dispositivoModel.find.mock.calls[0][0];
      expect(filtro.activo).toBe(true);
      expect(filtro.usuarioId.$in).toHaveLength(1);
    });

    it('debería resolver los roles contra usuarios, no contra dispositivos', async () => {
      // El rol vive en `usuarios`: duplicarlo en cada dispositivo lo dejaría
      // desactualizado en cuanto alguien cambiara de rol.
      const service = await crear();
      conDispositivos([]);
      const toArray = jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]);
      dispositivoModel.db.collection.mockReturnValue({ find: jest.fn().mockReturnValue({ toArray }) });

      await service.enviarAVarios({ roles: ['cliente'] }, envio);

      expect(dispositivoModel.db.collection).toHaveBeenCalledWith('usuarios');
      expect(dispositivoModel.find.mock.calls[0][0].usuarioId.$in).toHaveLength(1);
    });
  });
});
