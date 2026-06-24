import { Routes } from '@angular/router';

export const buscadorRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./buscador.component').then((m) => m.BuscadorComponent),
  },
];
