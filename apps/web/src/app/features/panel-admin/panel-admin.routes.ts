import { Routes } from '@angular/router';

export const panelAdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'cupones',
        loadComponent: () =>
          import('./cupones-admin.component').then(m => m.CuponesAdminComponent),
      },
      {
        path: 'comercios',
        loadComponent: () =>
          import('./admin-comercios.component').then(m => m.AdminComerciosComponent),
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./admin-reservas.component').then(m => m.AdminReservasComponent),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./admin-usuarios.component').then(m => m.AdminUsuariosComponent),
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./admin-reportes.component').then(m => m.AdminReportesComponent),
      },
      {
        path: 'analitica',
        loadComponent: () =>
          import('./admin-analitica.component').then(m => m.AdminAnaliticaComponent),
      },
    ],
  },
];
