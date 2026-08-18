import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Rol } from 'shared';
import { JwtStrategy } from './jwt.strategy';
import { UsersRepository } from '../../users/users.repository';
import { JwtPayload } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepository: jest.Mocked<Pick<UsersRepository, 'findById'>>;

  const config = { getOrThrow: jest.fn().mockReturnValue('secreto') } as unknown as ConfigService;

  /** Lo que viaja firmado en el token; puede estar desfasado respecto a la BD. */
  const payloadDelToken: JwtPayload = {
    sub: 'user-1',
    email: 'viejo@doogking.com',
    rol: Rol.COMERCIO_ADMIN,
    comercioId: 'comercio-viejo',
  };

  const usuarioEnBd = {
    id: 'user-1',
    email: 'nuevo@doogking.com',
    rol: Rol.CLIENTE,
    comercioId: { toString: () => 'comercio-nuevo' },
    activo: true,
  };

  beforeEach(() => {
    usersRepository = { findById: jest.fn().mockResolvedValue(usuarioEnBd) };
    strategy = new JwtStrategy(config, usersRepository as unknown as UsersRepository);
  });

  it('debería devolver el rol y el comercio de la base de datos, no los del token', async () => {
    // El token dice comercio_admin de "comercio-viejo"; la cuenta ya no lo es.
    const resultado = await strategy.validate(payloadDelToken);

    expect(resultado.rol).toBe(Rol.CLIENTE);
    expect(resultado.comercioId).toBe('comercio-nuevo');
    expect(resultado.email).toBe('nuevo@doogking.com');
  });

  it('debería rechazar si la cuenta ya no existe', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(strategy.validate(payloadDelToken)).rejects.toThrow(UnauthorizedException);
  });

  it('debería rechazar si la cuenta está desactivada', async () => {
    // Desactivar a alguien del equipo tenía efecto sólo al caducar su token.
    usersRepository.findById.mockResolvedValue({ ...usuarioEnBd, activo: false } as never);

    await expect(strategy.validate(payloadDelToken)).rejects.toThrow(UnauthorizedException);
  });

  it('debería admitir una cuenta sin comercio vinculado', async () => {
    usersRepository.findById.mockResolvedValue({ ...usuarioEnBd, comercioId: undefined } as never);

    await expect(strategy.validate(payloadDelToken)).resolves.toMatchObject({ comercioId: undefined });
  });

  it('debería cachear la comprobación para no consultar la BD en cada petición', async () => {
    await strategy.validate(payloadDelToken);
    await strategy.validate(payloadDelToken);
    await strategy.validate(payloadDelToken);

    expect(usersRepository.findById).toHaveBeenCalledTimes(1);
  });

  it('debería volver a consultar la BD cuando la caché caduca', async () => {
    jest.useFakeTimers();
    try {
      await strategy.validate(payloadDelToken);
      jest.advanceTimersByTime(31_000);
      await strategy.validate(payloadDelToken);

      expect(usersRepository.findById).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('no debería cachear a un usuario rechazado', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(strategy.validate(payloadDelToken)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate(payloadDelToken)).rejects.toThrow(UnauthorizedException);

    expect(usersRepository.findById).toHaveBeenCalledTimes(2);
  });
});
