import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Rol } from 'shared';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.usuario()?.rol === Rol.ADMIN) return true;
  if (!auth.estaAutenticado()) return router.createUrlTree(['/auth/login']);
  return router.createUrlTree(['/']);
};

export const comercioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const rol = auth.usuario()?.rol;
  if (rol === Rol.COMERCIO_ADMIN || rol === Rol.COMERCIO_STAFF) return true;
  if (!auth.estaAutenticado()) return router.createUrlTree(['/auth/login']);
  return router.createUrlTree(['/']);
};
