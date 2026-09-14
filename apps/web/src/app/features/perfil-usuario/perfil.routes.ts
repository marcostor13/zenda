import { Routes } from '@angular/router';
import { soloClientesGuard } from '../../core/guards/role.guard';

export const perfilRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./perfil-router.component').then(m => m.PerfilRouterComponent),
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
    canActivate: [soloClientesGuard],
    loadComponent: () =>
      import('./perfil-pagos.component').then(m => m.PerfilPagosComponent),
  },
  {
    path: 'resenas',
    canActivate: [soloClientesGuard],
    loadComponent: () =>
      import('./perfil-resenas.component').then(m => m.PerfilResenasComponent),
  },
  {
    path: 'alpha',
    canActivate: [soloClientesGuard],
    loadComponent: () =>
      import('./perfil-alpha.component').then(m => m.PerfilAlphaComponent),
  },
];
