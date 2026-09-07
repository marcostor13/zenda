import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from 'shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const STORAGE_KEY = 'dk_acceso_anticipado';

/**
 * Roles que operan la plataforma mientras sigue cerrada al público. El comercio
 * que se da de alta desde `/para-comercios` tiene que poder verificar su correo,
 * completar el alta guiada y publicar su ficha antes de la apertura; la pantalla
 * de "muy pronto" es para el visitante y el cliente, no para quien monta la oferta.
 */
const ROLES_CON_ACCESO: readonly Rol[] = [Rol.ADMIN, Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF];

/**
 * Mientras `environment.underConstruction` esté activo, bloquea toda la app
 * salvo que llegue el query param `?acceso=<underConstructionKey>` (una vez
 * validado, se recuerda en localStorage para no repetirlo en cada navegación)
 * o que la sesión sea de comercio/administración.
 */
export const underConstructionGuard: CanActivateFn = (_route, state) => {
  if (!environment.underConstruction) return true;

  const router = inject(Router);
  const authService = inject(AuthService);
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

  const rol = authService.usuario()?.rol;
  if (rol && ROLES_CON_ACCESO.includes(rol)) return true;

  return router.createUrlTree(['/proximamente']);
};
