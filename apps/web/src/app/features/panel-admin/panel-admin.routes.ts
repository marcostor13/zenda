import { Routes } from '@angular/router';

export const panelAdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },
];
