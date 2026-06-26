import { Routes } from '@angular/router';

export const perfilRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./perfil-dashboard.component').then(m => m.PerfilDashboardComponent),
  },
  {
    path: 'editar',
    loadComponent: () =>
      import('./perfil-editar.component').then(m => m.PerfilEditarComponent),
  },
  {
    path: 'seguridad',
    loadComponent: () =>
      import('./perfil-seguridad.component').then(m => m.PerfilSeguridadComponent),
  },
  {
    path: 'notificaciones',
    loadComponent: () =>
      import('./perfil-notificaciones.component').then(m => m.PerfilNotificacionesComponent),
  },
  {
    path: 'pagos',
    loadComponent: () =>
      import('./perfil-pagos.component').then(m => m.PerfilPagosComponent),
  },
  {
    path: 'resenas',
    loadComponent: () =>
      import('./perfil-resenas.component').then(m => m.PerfilResenasComponent),
  },
];
