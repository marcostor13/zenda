import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, comercioGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.routes').then(m => m.homeRoutes),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'buscador',
    loadChildren: () => import('./features/buscador/buscador.routes').then((m) => m.buscadorRoutes),
  },
  {
    path: 'alojamiento',
    loadChildren: () =>
      import('./features/alojamiento/alojamiento.routes').then((m) => m.alojamientoRoutes),
  },
  {
    path: 'transporte',
    loadChildren: () =>
      import('./features/transporte/transporte.routes').then((m) => m.transporteRoutes),
  },
  {
    path: 'veterinaria',
    data: { vertical: 'veterinaria' },
    loadComponent: () =>
      import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
  },
  {
    path: 'peluqueria',
    data: { vertical: 'peluqueria' },
    loadComponent: () =>
      import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
  },
  {
    path: 'adiestramiento',
    data: { vertical: 'adiestramiento' },
    loadComponent: () =>
      import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
  },
  {
    path: 'reservas',
    canActivate: [authGuard],
    loadChildren: () => import('./features/reservas/reservas.routes').then((m) => m.reservasRoutes),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/perfil-usuario/perfil.routes').then((m) => m.perfilRoutes),
  },
  {
    path: 'comercio',
    canActivate: [comercioGuard],
    loadChildren: () =>
      import('./features/panel-comercio/panel-comercio.routes').then((m) => m.panelComercioRoutes),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./features/panel-admin/panel-admin.routes').then((m) => m.panelAdminRoutes),
  },
  { path: '**', redirectTo: 'buscador' },
];
