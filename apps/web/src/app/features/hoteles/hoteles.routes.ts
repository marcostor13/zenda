import { Routes } from '@angular/router';

export const hotelesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/hoteles-lista.component').then(m => m.HotelesListaComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./components/hotel-detalle.component').then(m => m.HotelDetalleComponent),
  },
];
