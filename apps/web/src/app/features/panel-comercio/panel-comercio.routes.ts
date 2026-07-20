import { Routes } from '@angular/router';

export const panelComercioRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./comercio-layout.component').then(m => m.ComercioLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./panel-comercio-dashboard.component').then(m => m.PanelComercioDashboardComponent),
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./comercio-reservas.component').then(m => m.ComercioReservasComponent),
      },
      // listados/nuevo y listados/:id/editar deben declararse antes de listados
      {
        path: 'listados/nuevo',
        loadComponent: () =>
          import('./comercio-listado-form.component').then(m => m.ComercioListadoFormComponent),
      },
      {
        path: 'listados/:id/editar',
        loadComponent: () =>
          import('./comercio-listado-form.component').then(m => m.ComercioListadoFormComponent),
      },
      {
        path: 'listados',
        loadComponent: () =>
          import('./comercio-listados.component').then(m => m.ComercioListadosComponent),
      },
      {
        path: 'suplementos',
        loadComponent: () =>
          import('./comercio-suplementos.component').then(m => m.ComercioSuplementosComponent),
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./comercio-ingresos.component').then(m => m.ComercioIngresosComponent),
      },
      {
        path: 'resenas',
        loadComponent: () =>
          import('./comercio-resenas.component').then(m => m.ComercioResenasComponent),
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./comercio-config.component').then(m => m.ComercioConfigComponent),
      },
    ],
  },
];
