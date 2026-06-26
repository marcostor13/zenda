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
    path: 'hoteles',
    loadChildren: () => import('./features/hoteles/hoteles.routes').then((m) => m.hotelesRoutes),
  },
  {
    path: 'taxis',
    loadChildren: () => import('./features/taxis/taxis.routes').then((m) => m.taxisRoutes),
  },
  {
    path: 'vuelos',
    data: { vertical: 'vuelos' },
    loadComponent: () =>
      import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
  },
  {
    path: 'transporte',
    data: { vertical: 'transporte' },
    loadComponent: () =>
      import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
  },
  {
    path: 'guarderia',
    data: { vertical: 'guarderia' },
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
