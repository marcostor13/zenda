import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  const USER_ID = 'u1';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            actualizarPorId: jest.fn(),
            actualizarPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repo = moduleRef.get(UsersRepository);
  });

  describe('obtenerPerfil', () => {
    it('debería devolver el usuario encontrado', async () => {
      repo.findById.mockResolvedValue({ nombre: 'Ana' } as never);

      await expect(service.obtenerPerfil(USER_ID)).resolves.toEqual({ nombre: 'Ana' });
    });

    it('debería lanzar 404 si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.obtenerPerfil(USER_ID)).rejects.toThrow(DomainException);
    });
  });

  describe('actualizarPerfil', () => {
    it('debería devolver el perfil ya actualizado', async () => {
      repo.actualizarPorId.mockResolvedValue({ nombre: 'Ana Ruiz' } as never);

      const res = await service.actualizarPerfil(USER_ID, { nombre: 'Ana Ruiz' });

      expect(repo.actualizarPorId).toHaveBeenCalledWith(USER_ID, { nombre: 'Ana Ruiz' });
      expect(res).toEqual({ nombre: 'Ana Ruiz' });
    });

    it('debería lanzar 404 si el usuario no existe', async () => {
      repo.actualizarPorId.mockResolvedValue(null);

      await expect(service.actualizarPerfil(USER_ID, { nombre: 'X' }))
        .rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('cambiarPassword', () => {
    it('debería lanzar 404 si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.cambiarPassword(USER_ID, 'actual', 'nueva'))
        .rejects.toThrow('Usuario no encontrado');
    });

    it('debería avisar de que una cuenta social no tiene contraseña que cambiar', async () => {
      repo.findById.mockResolvedValue({ passwordHash: undefined } as never);

      await expect(service.cambiarPassword(USER_ID, 'actual', 'nueva'))
        .rejects.toThrow('Google o Meta');

      expect(repo.actualizarPassword).not.toHaveBeenCalled();
    });

    it('debería rechazar si la contraseña actual no coincide', async () => {
      const hash = await bcrypt.hash('la-de-verdad', 10);
      repo.findById.mockResolvedValue({ passwordHash: hash } as never);

      await expect(service.cambiarPassword(USER_ID, 'la-equivocada', 'NuevaSegura1!'))
        .rejects.toThrow('La contraseña actual es incorrecta');

      expect(repo.actualizarPassword).not.toHaveBeenCalled();
    });

    it('debería guardar la nueva contraseña hasheada, nunca en claro', async () => {
      const hash = await bcrypt.hash('la-de-verdad', 10);
      repo.findById.mockResolvedValue({ passwordHash: hash } as never);

      await service.cambiarPassword(USER_ID, 'la-de-verdad', 'NuevaSegura1!');

      const [id, guardado] = repo.actualizarPassword.mock.calls[0];
      expect(id).toBe(USER_ID);
      expect(guardado).not.toBe('NuevaSegura1!');
      // El hash guardado tiene que validar contra la contraseña nueva.
      await expect(bcrypt.compare('NuevaSegura1!', guardado)).resolves.toBe(true);
    });
  });
});
