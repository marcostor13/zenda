import { Routes } from '@angular/router';

export const panelComercioRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-comercio-dashboard.component').then(m => m.PanelComercioDashboardComponent),
  },
];
