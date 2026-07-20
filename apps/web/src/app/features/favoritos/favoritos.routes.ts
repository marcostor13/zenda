import { Routes } from '@angular/router';

export const favoritosRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./favoritos.component').then((m) => m.FavoritosComponent),
  },
];
