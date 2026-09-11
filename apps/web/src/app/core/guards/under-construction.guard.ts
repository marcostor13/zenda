import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from 'shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { almacenLocal } from '../plataforma/almacen';
import { CookiesService } from '../plataforma/cookies.service';

const STORAGE_KEY = 'dk_acceso_anticipado';

/**
 * El mismo permiso, en cookie. `localStorage` no viaja en la petición, así que
 * en el render de servidor todo el mundo parecía no tener acceso y acababa en
 * la pantalla de espera aunque ya hubiera entrado con la clave; la página sólo
 * se corregía al hidratar, con un salto visible. Se escriben las dos: la cookie
 * para que el servidor decida bien, y `localStorage` para no romper el acceso
 * de quien ya lo tenía guardado antes de este cambio.
 */
const DIAS_DE_ACCESO = 180;

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
  const cookies = inject(CookiesService);
  const urlTree = router.parseUrl(state.url);
  const clave = urlTree.queryParams['acceso'];

  if (clave && clave === environment.underConstructionKey) {
    cookies.escribir(STORAGE_KEY, '1', DIAS_DE_ACCESO);
    almacenLocal().setItem(STORAGE_KEY, '1');
    return true;
  }

  if (cookies.leer(STORAGE_KEY) === '1') return true;

  // Respaldo para quien entró con la clave antes de que esto fuera una cookie:
  // se le reconoce el acceso y se le pone la cookie para que el servidor lo vea.
  if (almacenLocal().getItem(STORAGE_KEY) === '1') {
    cookies.escribir(STORAGE_KEY, '1', DIAS_DE_ACCESO);
    return true;
  }

  const rol = authService.usuario()?.rol;
  if (rol && ROLES_CON_ACCESO.includes(rol)) return true;

  return router.createUrlTree(['/proximamente']);
};
