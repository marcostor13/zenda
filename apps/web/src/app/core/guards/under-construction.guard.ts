import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'dk_acceso_anticipado';

/**
 * Mientras `environment.underConstruction` esté activo, bloquea toda la app
 * salvo que llegue el query param `?acceso=<underConstructionKey>` (una vez
 * validado, se recuerda en localStorage para no repetirlo en cada navegación).
 */
export const underConstructionGuard: CanActivateFn = (_route, state) => {
  if (!environment.underConstruction) return true;

  const router = inject(Router);
  const urlTree = router.parseUrl(state.url);
  const clave = urlTree.queryParams['acceso'];

  if (clave && clave === environment.underConstructionKey) {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage no disponible (modo privado, etc.): igual deja pasar esta navegación.
    }
    return true;
  }

  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch {
    // Sin acceso a localStorage no hay forma de recordar el acceso previo.
  }

  return router.createUrlTree(['/proximamente']);
};
