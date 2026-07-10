import { Routes } from '@angular/router';

export const transporteRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/transporte-lista.component').then(m => m.TransporteListaComponent),
  },
];
