import { Test } from '@nestjs/testing';
import { PushController } from './push.controller';
import { PushService } from './push.service';

describe('PushController', () => {
  let controller: PushController;
  let service: jest.Mocked<Pick<PushService, 'registrar' | 'darDeBaja'>>;

  const req = { user: { sub: 'user-1' } } as never;

  beforeEach(async () => {
    service = {
      registrar: jest.fn().mockResolvedValue({ _id: 'disp-1' }),
      darDeBaja: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PushController],
      providers: [{ provide: PushService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PushController);
  });

  it('debería registrar el dispositivo a nombre del usuario del token', async () => {
    // El usuario sale del token, nunca del cuerpo: con un usuarioId del body
    // cualquiera podría redirigirse las push de otro a su móvil.
    await controller.registrar({ token: 'fcm-token-largo', plataforma: 'android' }, req);

    expect(service.registrar).toHaveBeenCalledWith('user-1', 'fcm-token-largo', 'android');
  });

  it('debería dar de baja el dispositivo por su token', async () => {
    await controller.darDeBaja('fcm-token-largo');

    expect(service.darDeBaja).toHaveBeenCalledWith('fcm-token-largo');
  });
});
