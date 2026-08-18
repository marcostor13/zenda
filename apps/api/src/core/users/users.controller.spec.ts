import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<Pick<UsersService, 'obtenerPerfil' | 'actualizarPerfil' | 'cambiarPassword'>>;

  /** Lo que deja el JwtAuthGuard en la petición. */
  const req = { user: { sub: 'user-1' } } as never;

  beforeEach(async () => {
    service = {
      obtenerPerfil: jest.fn().mockResolvedValue({ id: 'user-1' }),
      actualizarPerfil: jest.fn().mockResolvedValue({ id: 'user-1' }),
      cambiarPassword: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  it('debería pedir el perfil del usuario del token, no de un id del cuerpo', async () => {
    await controller.obtenerMe(req);

    expect(service.obtenerPerfil).toHaveBeenCalledWith('user-1');
  });

  it('debería actualizar el perfil del usuario del token', async () => {
    await controller.actualizarMe(req, { nombre: 'Marcos', telefono: '600000000' });

    expect(service.actualizarPerfil).toHaveBeenCalledWith('user-1', {
      nombre: 'Marcos',
      telefono: '600000000',
    });
  });

  it('debería cambiar la contraseña exigiendo la actual', async () => {
    // El id sale siempre del token: aceptar uno del cuerpo permitiría cambiarle
    // la contraseña a otra persona.
    await controller.cambiarPassword(req, {
      passwordActual: 'la-vieja',
      nuevaPassword: 'la-nueva-8',
    });

    expect(service.cambiarPassword).toHaveBeenCalledWith('user-1', 'la-vieja', 'la-nueva-8');
  });

  it('debería propagar el error si la contraseña actual no es correcta', async () => {
    service.cambiarPassword.mockRejectedValue(new Error('incorrecta'));

    await expect(
      controller.cambiarPassword(req, { passwordActual: 'mala', nuevaPassword: 'la-nueva-8' }),
    ).rejects.toThrow();
  });
});
