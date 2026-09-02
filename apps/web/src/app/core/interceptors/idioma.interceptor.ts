import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

/**
 * Viaja el idioma elegido en la cabecera estándar `Accept-Language`.
 *
 * Hoy el API todavía responde siempre en español y la ignora; se manda desde ya
 * para que el día que se traduzcan correos, avisos y mensajes de error el dato
 * esté en la petición y no haya que tocar ninguna pantalla del frontend.
 *
 * Sólo se pone si no venía ya: una petición que fije su propio
 * `Accept-Language` (una integración externa, un endpoint de idioma concreto)
 * manda sobre la preferencia general.
 */
export const idiomaInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (peticion.headers.has('Accept-Language')) return siguiente(peticion);

  const i18n = inject(I18nService);
  return siguiente(peticion.clone({ setHeaders: { 'Accept-Language': i18n.idioma() } }));
};
