import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { ConexionApiService } from '../diagnostico/conexion-api.service';

/**
 * Detecta que el API no está al otro lado.
 *
 * Se mira `status === 0` a propósito: es lo que devuelve el navegador cuando la
 * petición no llegó a completarse —servidor caído, sin red, o un CORS que la
 * bloqueó—. Un 401 o un 500 sí llegaron al servidor y los gestiona cada
 * pantalla; esos no son un problema de conexión y no deben disparar el aviso.
 */
export const conexionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const conexion = inject(ConexionApiService);

  return siguiente(peticion).pipe(
    tap(() => conexion.registrarExito()),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        conexion.registrarFallo(peticion.url);
      }
      return throwError(() => error);
    }),
  );
};
