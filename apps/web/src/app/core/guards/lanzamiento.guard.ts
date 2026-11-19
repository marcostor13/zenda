import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Lanzamiento por fases: la web ya está abierta a clientes, pero reservar y el
 * alta de negocios esperan a la apertura de comercios. Mientras su bandera esté
 * apagada, estas rutas llevan a una pantalla de "muy pronto" específica —con
 * lista de espera— en vez de a un formulario que no podría completarse.
 *
 * Es sólo la cara amable: quien lo hace cumplir es el API (`AperturaGuard`).
 */
export const RUTA_RESERVAS_PROXIMAMENTE = '/proximamente/reservas';
export const RUTA_COMERCIOS_PROXIMAMENTE = '/proximamente/comercios';

export const reservasAbiertasGuard: CanActivateFn = () =>
  environment.reservasAbiertas || inject(Router).createUrlTree([RUTA_RESERVAS_PROXIMAMENTE]);

export const registroComerciosAbiertoGuard: CanActivateFn = () =>
  environment.registroComerciosAbierto || inject(Router).createUrlTree([RUTA_COMERCIOS_PROXIMAMENTE]);
