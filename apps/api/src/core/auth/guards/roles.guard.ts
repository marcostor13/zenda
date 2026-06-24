import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from 'shared';

export const ROLES_KEY = 'roles';

export function Roles(...roles: Rol[]): MethodDecorator & ClassDecorator {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    const reflector = Reflect.metadata(ROLES_KEY, roles);
    if (descriptor) {
      reflector(target, key!, descriptor.value);
      return descriptor;
    }
    reflector(target);
    return target as ClassDecorator extends (target: object) => void ? object : never;
  };
}

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

    const { user } = context.switchToHttp().getRequest<{ user: { rol: Rol } }>();
    return rolesRequeridos.includes(user.rol);
  }
}
