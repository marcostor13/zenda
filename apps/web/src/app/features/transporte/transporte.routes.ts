import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { soloClientesGuard } from '../../core/guards/role.guard';

/**
 * Transporte de mascotas (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md).
 *
 * `/transporte` es la pantalla 1 del flujo: el cliente describe el viaje y
 * compara precios cerrados. El listado por población de antes sigue en
 * `/transporte/empresas`, que es lo que indexan los buscadores.
 *
 * Las rutas fijas van antes que `:id`, o `viaje` y `empresas` se leerían
 * como el id de un servicio.
 */
export const transporteRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./viaje/pantallas/busqueda-viaje.component').then((m) => m.BusquedaViajeComponent),
  },
  {
    path: 'empresas',
    loadComponent: () => import('./components/transporte-lista.component').then((m) => m.TransporteListaComponent),
  },
  {
    path: 'viaje/mascota',
    loadComponent: () => import('./viaje/pantallas/mascota-viaje.component').then((m) => m.MascotaViajeComponent),
  },
  {
    path: 'viaje/resultados',
    loadComponent: () => import('./viaje/pantallas/resultados-viaje.component').then((m) => m.ResultadosViajeComponent),
  },
  {
    // Desde aquí hace falta cuenta: la reserva es del cliente. El borrador del
    // viaje sobrevive al paso por el login (va en sessionStorage).
    path: 'viaje/reserva',
    canActivate: [authGuard, soloClientesGuard],
    loadComponent: () => import('./viaje/pantallas/reserva-viaje.component').then((m) => m.ReservaViajeComponent),
  },
  {
    path: 'viaje/confirmada/:codigo',
    canActivate: [authGuard, soloClientesGuard],
    loadComponent: () => import('./viaje/pantallas/confirmada-viaje.component').then((m) => m.ConfirmadaViajeComponent),
  },
  {
    path: ':id',
    data: { vertical: 'transporte' },
    loadComponent: () =>
      import('../verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
  },
];
