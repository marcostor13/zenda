import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, comercioGuard } from './core/guards/role.guard';
import { buscadorRedirectGuard } from './core/guards/buscador-redirect.guard';
import { underConstructionGuard } from './core/guards/under-construction.guard';

export const routes: Routes = [
  {
    // Fuera del guard "muy pronto" a propósito: es la pantalla a la que redirige.
    path: 'proximamente',
    loadComponent: () =>
      import('./features/proximamente/proximamente.component').then((m) => m.ProximamenteComponent),
  },
  {
    path: '',
    canActivate: [underConstructionGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./features/home/home.routes').then(m => m.homeRoutes),
      },
      {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
      },
      {
        // Ruta heredada: redirige al listado del vertical con sus filtros.
        path: 'buscador',
        canActivate: [buscadorRedirectGuard],
        children: [],
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
        path: 'adiestramiento/:id',
        data: { vertical: 'adiestramiento' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
      },
      {
        path: 'hoteles',
        data: { vertical: 'hoteles' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'hoteles/:id',
        data: { vertical: 'hoteles' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
      },
      {
        path: 'seguros',
        data: { vertical: 'seguros' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'cuidadores',
        data: { vertical: 'cuidadores' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'explora',
        loadChildren: () => import('./features/explora/explora.routes').then((m) => m.exploraRoutes),
      },
      {
        // Enlace único del correo de valoración; público a propósito: el usuario
        // llega desde su bandeja de entrada, no desde la aplicación.
        path: 'valorar/:token',
        loadComponent: () =>
          import('./features/reservas/components/valorar-token.component')
            .then((m) => m.ValorarTokenComponent),
      },
      {
        path: 'ayuda',
        loadComponent: () => import('./features/ayuda/ayuda.component').then((m) => m.AyudaComponent),
      },
      {
        path: 'reservas',
        canActivate: [authGuard],
        loadChildren: () => import('./features/reservas/reservas.routes').then((m) => m.reservasRoutes),
      },
      {
        path: 'perros',
        canActivate: [authGuard],
        loadChildren: () => import('./features/perros/perros.routes').then((m) => m.perrosRoutes),
      },
      {
        path: 'favoritos',
        canActivate: [authGuard],
        loadChildren: () => import('./features/favoritos/favoritos.routes').then((m) => m.favoritosRoutes),
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
      { path: '**', redirectTo: '' },
    ],
  },
];
