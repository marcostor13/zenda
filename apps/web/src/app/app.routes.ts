import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'buscador', pathMatch: 'full' },
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
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/panel-comercio/panel-comercio.routes').then((m) => m.panelComercioRoutes),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/panel-admin/panel-admin.routes').then((m) => m.panelAdminRoutes),
  },
  { path: '**', redirectTo: 'buscador' },
];
