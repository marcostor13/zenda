import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisoAdmin, Rol, tienePermisoAdmin } from 'shared';
import { UsersRepository } from '../../users/users.repository';

export const PERMISOS_KEY = 'permisos_admin';

/** Marca el área del panel que toca este endpoint (TCK-8040 §7). */
export const PermisosAdmin = (...permisos: PermisoAdmin[]) => SetMetadata(PERMISOS_KEY, permisos);

/**
 * Restringe endpoints de administración por área. Se apoya en `RolesGuard` para
 * el rol; aquí sólo se decide si ese administrador concreto puede tocar esta
 * parte. Un administrador **sin permisos declarados es superadministrador**, que
 * es como se comportaba el panel antes de que existieran los permisos.
 */
@Injectable()
export class PermisosAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersRepo: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<PermisoAdmin[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: { sub: string; rol: Rol } }>();
    if (user?.rol !== Rol.ADMIN) return false;

    const admin = await this.usersRepo.findById(user.sub);
    const permisos = admin?.permisosAdmin as PermisoAdmin[] | undefined;
    const autorizado = requeridos.some((permiso) => tienePermisoAdmin(permisos, permiso));

    if (!autorizado) {
      throw new ForbiddenException('Tu cuenta de administración no tiene acceso a esta sección');
    }
    return true;
  }
}
