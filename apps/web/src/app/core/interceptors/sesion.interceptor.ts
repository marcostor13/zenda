import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Rutas de `auth` donde un 401 es la respuesta normal y no una sesión caducada.
 *
 * Fallar el login devuelve 401: si eso cerrara la sesión y redirigiera, la
 * pantalla de acceso se recargaría antes de poder decir «contraseña incorrecta».
 */
const SIN_SESION = ['/auth/login', '/auth/registro', '/auth/google', '/auth/facebook',
  '/auth/recuperar-password', '/auth/restablecer-password', '/auth/verificar-email',
  '/auth/reenviar-verificacion', '/comercios/registro'];

/**
 * Cierra la sesión cuando el API deja de reconocer el token.
 *
 * El JWT caduca a los siete días, pero el token seguía en `localStorage` y la
 * aplicación se comportaba como si hubiera sesión: el navbar pintaba el avatar,
 * los guards dejaban pasar y cada pantalla mostraba su propio error al recibir
 * el 401 —de ahí que un alta de negocio pudiera acabar en «la sesión ha
 * caducado» sin que hubiera forma de recuperarla—. Ahora se borra la sesión y
 * se lleva al acceso una sola vez, guardando a dónde iba para volver después.
 */
export const sesionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return siguiente(peticion).pipe(
    catchError((error: unknown) => {
      const es401 = error instanceof HttpErrorResponse && error.status === 401;
      const esPublica = SIN_SESION.some((ruta) => peticion.url.includes(ruta));

      // Sin sesión previa un 401 es "no autenticado", no "caducado": la pantalla
      // que lo pidió sabrá qué hacer (pedir login, ocultar un bloque…).
      if (es401 && !esPublica && auth.estaAutenticado()) {
        const destino = router.url;
        auth.cerrarSesionLocal();
        void router.navigate(['/auth/login'], {
          queryParams: { motivo: 'sesion', volverA: destino === '/auth/login' ? null : destino },
        });
      }

      return throwError(() => error);
    }),
  );
};
