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

/**
 * Páginas de cliente (mascotas, reservas propias, favoritos, reseñas, Alpha).
 *
 * Una cuenta de comercio no reserva como cliente, igual que en el panel de
 * socios de Booking: si llega a una de estas páginas —un enlace guardado, la
 * dirección escrita a mano— se la lleva a su panel. Sin sesión se deja pasar:
 * de pedir el login se encarga `authGuard`.
 */
export const soloClientesGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const rol = auth.usuario()?.rol;
  if (rol === Rol.COMERCIO_ADMIN || rol === Rol.COMERCIO_STAFF) {
    return inject(Router).createUrlTree(['/comercio']);
  }
  return true;
};
