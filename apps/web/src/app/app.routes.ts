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
  /*
   * Documentos legales, fuera del guard de "muy pronto" a propósito: los revisa
   * gente de fuera —Meta y Google no aprueban el inicio de sesión social sin
   * poder leer la política de privacidad— y con la app cerrada al público
   * acabarían en la pantalla de "muy pronto" en vez de en el documento.
   */
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./features/legal/privacidad.component').then((m) => m.PrivacidadComponent),
  },
  {
    path: 'eliminar-datos',
    loadComponent: () =>
      import('./features/legal/eliminar-datos.component').then((m) => m.EliminarDatosComponent),
  },
  {
    // Fuera del guard de "muy pronto" como el resto de legales: es el texto que
    // el comercio acepta al darse de alta y tiene que poder leerlo antes.
    path: 'condiciones',
    loadComponent: () =>
      import('./features/legal/condiciones-comercio.component').then((m) => m.CondicionesComercioComponent),
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
        path: 'veterinaria/:id',
        data: { vertical: 'veterinaria' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
      },
      {
        path: 'peluqueria',
        data: { vertical: 'peluqueria' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'peluqueria/:id',
        data: { vertical: 'peluqueria' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
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
        path: 'seguros/:id',
        data: { vertical: 'seguros' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
      },
      {
        path: 'cuidadores',
        data: { vertical: 'cuidadores' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'cuidadores/:id',
        data: { vertical: 'cuidadores' },
        loadComponent: () =>
          import('./features/verticales/vertical-detalle.component').then((m) => m.VerticalDetalleComponent),
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
