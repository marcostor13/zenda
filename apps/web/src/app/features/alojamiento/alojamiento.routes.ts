import { Routes } from '@angular/router';

export const alojamientoRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/alojamiento-lista.component').then(m => m.AlojamientoListaComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./components/alojamiento-detalle.component').then(m => m.AlojamientoDetalleComponent),
  },
];
