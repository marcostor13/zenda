import { Routes } from '@angular/router';

export const perfilRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./perfil-dashboard.component').then(m => m.PerfilDashboardComponent),
  },
];
