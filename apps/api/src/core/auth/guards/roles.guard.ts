import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from 'shared';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    // `user` es undefined si alguien pone @Roles sin JwtAuthGuard delante.
    // Leer `user.rol` sin más daba un TypeError -> 500; lo correcto es negar.
    const { user } = context.switchToHttp().getRequest<{ user?: { rol: Rol } }>();
    if (!user) return false;

    return rolesRequeridos.includes(user.rol);
  }
}
