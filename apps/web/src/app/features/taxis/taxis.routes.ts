import { Routes } from '@angular/router';

export const taxisRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/taxis-lista.component').then(m => m.TaxisListaComponent),
  },
];
