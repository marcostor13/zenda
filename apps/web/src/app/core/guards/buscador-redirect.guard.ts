import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { rutaDeVertical } from '../../shared/verticales/verticales.config';

/**
 * `/buscador` ya no es una vista: el buscador vive en el home y sobre cada
 * listado. La ruta se mantiene para no romper enlaces antiguos (marcadores,
 * resultados indexados) y redirige al listado del vertical pedido conservando
 * los filtros de la URL.
 */
export const buscadorRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const { vertical, ...filtros } = route.queryParams;
  return router.createUrlTree([rutaDeVertical(vertical as string | undefined)], {
    queryParams: filtros,
  });
};
