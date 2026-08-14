import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisoAdmin, Rol } from 'shared';
import { PermisosAdminGuard } from './permisos.guard';
import { UsersRepository } from '../../users/users.repository';

describe('PermisosAdminGuard', () => {
  let guard: PermisosAdminGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let usersRepo: { findById: jest.Mock };

  const contexto = (rol: Rol, sub = 'admin-1'): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { sub, rol } }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    usersRepo = { findById: jest.fn() };
    guard = new PermisosAdminGuard(reflector as unknown as Reflector, usersRepo as unknown as UsersRepository);
  });

  it('debería dejar pasar si el endpoint no exige permiso', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contexto(Rol.ADMIN))).resolves.toBe(true);
    expect(usersRepo.findById).not.toHaveBeenCalled();
  });

  it('debería tratar como superadministrador a quien no tiene permisos declarados', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoAdmin.FINANZAS]);
    usersRepo.findById.mockResolvedValue({ permisosAdmin: [] });

    await expect(guard.canActivate(contexto(Rol.ADMIN))).resolves.toBe(true);
  });

  it('debería dejar pasar si tiene el permiso exigido', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoAdmin.FINANZAS]);
    usersRepo.findById.mockResolvedValue({ permisosAdmin: [PermisoAdmin.FINANZAS, PermisoAdmin.SOPORTE] });

    await expect(guard.canActivate(contexto(Rol.ADMIN))).resolves.toBe(true);
  });

  it('debería bloquear a soporte cuando el endpoint es de finanzas', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoAdmin.FINANZAS]);
    usersRepo.findById.mockResolvedValue({ permisosAdmin: [PermisoAdmin.SOPORTE] });

    await expect(guard.canActivate(contexto(Rol.ADMIN))).rejects.toThrow(ForbiddenException);
  });

  it('no debería dejar pasar a quien no es administrador', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoAdmin.USUARIOS]);

    await expect(guard.canActivate(contexto(Rol.CLIENTE))).resolves.toBe(false);
  });
});
