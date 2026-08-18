import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Autenticación opcional: si viene un token válido rellena `req.user`; si no
 * viene, o no vale, deja pasar igualmente con `req.user` a `undefined`.
 *
 * Existe por un fallo real. `EventosController.registrar` leía `req.user?.sub`
 * para atribuir el evento del embudo a su usuario, pero la ruta es pública y no
 * tenía ningún guard: `req.user` era **siempre** `undefined`, así que
 * `evento.usuarioId` nunca se rellenaba. Y como `GrowthService.recuperarAbandonos`
 * descarta todo abandono sin `usuarioId`, la campaña de recuperación no enviaba
 * nada a nadie.
 *
 * La ruta tiene que seguir siendo pública —media conversión ocurre antes de
 * iniciar sesión, y ahí están justo los abandonos más tempranos—, así que el
 * guard no puede exigir el token, sólo aprovecharlo cuando está.
 */
@Injectable()
export class JwtOpcionalGuard extends AuthGuard('jwt') {
  /**
   * Passport llama aquí con el resultado de validar. La versión de serie lanza
   * `UnauthorizedException` cuando no hay usuario; esta se limita a devolver
   * `undefined`, que es lo que convierte el guard en opcional.
   */
  handleRequest<TUser>(_error: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
