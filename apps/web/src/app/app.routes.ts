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
    /*
     * Términos, cookies y contacto: el pie de la portada llevaba a estas tres
     * rutas desde el primer día, pero no existían y el comodín `**` devolvía a
     * la portada, así que los enlaces parecían rotos. Van con el resto de
     * legales —fuera del guard de «muy pronto»— porque se consultan desde
     * fuera: antes de registrarse, y desde las tiendas de aplicaciones.
     */
    path: 'terminos',
    loadComponent: () =>
      import('./features/legal/terminos.component').then((m) => m.TerminosComponent),
  },
  {
    path: 'cookies',
    loadComponent: () =>
      import('./features/legal/cookies.component').then((m) => m.CookiesComponent),
  },
  {
    path: 'contacto',
    loadComponent: () =>
      import('./features/legal/contacto.component').then((m) => m.ContactoComponent),
  },
  {
    // Fuera del guard de "muy pronto" como el resto de legales: es el texto que
    // el comercio acepta al darse de alta y tiene que poder leerlo antes.
    path: 'condiciones',
    loadComponent: () =>
      import('./features/legal/condiciones-comercio.component').then((m) => m.CondicionesComercioComponent),
  },
  {
    /*
     * Landing de captación de comercios. Fuera del guard de "muy pronto" por
     * el mismo motivo que los legales: es la página a la que llevan las
     * campañas y los enlaces de redes, y su público —el profesional que se
     * plantea darse de alta— no es el que espera a que la app abra. Detrás de
     * la pantalla de "muy pronto" no captaría a nadie.
     */
    path: 'para-comercios',
    loadComponent: () =>
      import('./features/comercios/para-comercios.component').then((m) => m.ParaComerciosComponent),
  },
  {
    /*
     * Autenticación fuera del guard de "muy pronto". Los enlaces de los correos
     * (verificar cuenta, restablecer contraseña) y los CTA de /para-comercios
     * apuntan aquí: detrás de la pantalla de "muy pronto" el comercio recibía el
     * correo pero no podía terminar de verificarse. El alta de cliente sí queda
     * cerrada: la gatea `underConstructionGuard` dentro de `auth.routes.ts`.
     */
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
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
        path: 'funerarios',
        data: { vertical: 'funerarios' },
        loadComponent: () =>
          import('./features/verticales/vertical-browse.component').then((m) => m.VerticalBrowseComponent),
      },
      {
        path: 'funerarios/:id',
        data: { vertical: 'funerarios' },
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
      /*
       * Página 404 de verdad, no un desvío a la portada.
       *
       * Con `redirectTo: ''` quien escribía mal una dirección acababa en el
       * inicio sin entender por qué, y el servidor respondía 200 con la portada
       * dentro: para Google, esa dirección inexistente parecía una página
       * legítima que merecía estar en el índice. El componente fija el 404 real
       * de la respuesta (`SeoService.noEncontrado`).
       */
      {
        path: '**',
        loadComponent: () =>
          import('./features/errores/no-encontrado.component').then((m) => m.NoEncontradoComponent),
      },
    ],
  },
];
