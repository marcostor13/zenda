import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: JwtAuthGuard;

  const contexto = (user: unknown): ExecutionContext => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('debería dejar pasar a una cuenta normal sin mirar la marca de invitado', async () => {
    await expect(guard.canActivate(contexto({ sub: 'u1' }))).resolves.toBe(true);
    expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
  });

  it('debería dejar pasar a un invitado en una ruta marcada con @PermiteInvitado', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contexto({ sub: 'u1', invitado: true }))).resolves.toBe(true);
  });

  it('debería cerrar al invitado cualquier ruta no marcada', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(contexto({ sub: 'u1', invitado: true })))
      .rejects.toThrow(ForbiddenException);
  });

  it('debería respetar el rechazo de la autenticación base', async () => {
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(false);
    await expect(guard.canActivate(contexto(undefined))).resolves.toBe(false);
  });
});
