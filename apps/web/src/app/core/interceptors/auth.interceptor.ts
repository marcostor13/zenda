import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SesionInvitadoService } from '../auth/sesion-invitado.service';

/**
 * Manda el token de la sesión y, si no la hay, el de invitado: con él se
 * reserva y se paga sin cuenta. La sesión normal siempre gana.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token() ?? inject(SesionInvitadoService).token();

  if (!token) {
    return next(req);
  }

  const reqAutenticado = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(reqAutenticado);
};
