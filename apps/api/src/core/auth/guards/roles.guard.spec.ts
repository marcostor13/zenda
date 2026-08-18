import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard, ROLES_KEY } from './roles.guard';
import { Rol } from 'shared';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const crearContexto = (rol: Rol): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { rol } }),
      }),
    }) as unknown as ExecutionContext;

  /** Petición sin autenticar: es lo que llega si falta el JwtAuthGuard delante. */
  const crearContextoSinUsuario = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  it('debería permitir acceso si no hay roles requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    expect(guard.canActivate(crearContexto(Rol.CLIENTE))).toBe(true);
  });

  it('debería permitir acceso si el usuario tiene el rol requerido', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN]);
    expect(guard.canActivate(crearContexto(Rol.ADMIN))).toBe(true);
  });

  it('debería denegar acceso si el usuario no tiene el rol requerido', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN]);
    expect(guard.canActivate(crearContexto(Rol.CLIENTE))).toBe(false);
  });

  it('debería permitir acceso a comercio_admin cuando se requiere comercio_admin o admin', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN, Rol.COMERCIO_ADMIN]);
    expect(guard.canActivate(crearContexto(Rol.COMERCIO_ADMIN))).toBe(true);
  });

  it('debería denegar, sin reventar, si la petición no trae usuario', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN]);
    // Antes lanzaba TypeError al leer `user.rol`, y eso se traduce en un 500
    // donde debería haber un 401/403.
    expect(() => guard.canActivate(crearContextoSinUsuario())).not.toThrow();
    expect(guard.canActivate(crearContextoSinUsuario())).toBe(false);
  });

  it('debería seguir permitiendo el paso sin usuario si el endpoint no exige rol', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(crearContextoSinUsuario())).toBe(true);
  });
});
