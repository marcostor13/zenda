import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SesionInvitadoService } from '../auth/sesion-invitado.service';

/**
 * Como `authGuard`, pero deja pasar también a quien acaba de reservar como
 * invitado. Lo usa la ficha de una reserva: es adonde vuelve tras pagar (y tras
 * la autenticación 3-D Secure de su banco), y su API sólo le enseña reservas de
 * esa misma sesión.
 */
export const sesionOInvitadoGuard: CanActivateFn = (_ruta, estado) => {
  if (inject(AuthService).estaAutenticado() || inject(SesionInvitadoService).token()) {
    return true;
  }
  return inject(Router).createUrlTree(['/auth/login'], { queryParams: { volverA: estado.url } });
};
