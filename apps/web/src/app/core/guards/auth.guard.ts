import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (_ruta, estado) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true;
  }

  // Se guarda a dónde iba: tras entrar vuelve ahí y no a la portada, que es lo
  // que ocurría al caducar la sesión en mitad de una reserva.
  return router.createUrlTree(['/auth/login'], {
    queryParams: { volverA: estado.url },
  });
};
