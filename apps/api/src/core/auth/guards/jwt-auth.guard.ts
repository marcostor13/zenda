import { ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const PERMITE_INVITADO_KEY = 'permiteInvitado';

/**
 * Marca una ruta como accesible con sesión de invitado (reserva sin cuenta).
 *
 * Por defecto ninguna lo es: la sesión de invitado se emite a quien escribe un
 * email, sin contraseña, así que sólo puede tocar lo justo para reservar y
 * pagar. Sobre todo no puede listar nada de la cuenta («mis reservas», perros,
 * favoritos): cualquiera que escriba el email de otro invitado obtiene la misma
 * sesión.
 */
export const PermiteInvitado = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMITE_INVITADO_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const autenticado = (await super.canActivate(context)) as boolean;
    if (!autenticado) return false;

    const usuario = context.switchToHttp().getRequest<{ user?: { invitado?: boolean } }>().user;
    if (!usuario?.invitado) return true;

    const permitido = this.reflector.getAllAndOverride<boolean>(PERMITE_INVITADO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permitido) {
      throw new ForbiddenException('Para esto necesitas una cuenta. Regístrate o inicia sesión.');
    }
    return true;
  }
}
