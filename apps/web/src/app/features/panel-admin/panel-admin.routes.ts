import { Routes } from '@angular/router';
import { CONVERSION_DE_MONEDA } from '../../core/moneda/conversion-de-moneda.token';

/*
 * Los importes del panel no se traducen a la divisa de la cabecera: son
 * contabilidad en euros (GMV, comisiones, comisiones de Stripe, liquidaciones,
 * facturas). Bastaba con que el usuario hubiera tocado el selector navegando
 * por la parte pública para que su panel dejara de cuadrar con sus extractos.
 */
const SIN_CONVERSION_DE_MONEDA = [{ provide: CONVERSION_DE_MONEDA, useValue: false }];

export const panelAdminRoutes: Routes = [
  {
    path: '',
    providers: SIN_CONVERSION_DE_MONEDA,
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
        path: 'campanas',
        loadComponent: () =>
          import('./admin-campanas.component').then(m => m.AdminCampanasComponent),
      },
      {
        path: 'comunidad',
        loadComponent: () =>
          import('./admin-comunidad.component').then(m => m.AdminComunidadComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./admin-configuracion.component').then(m => m.AdminConfiguracionComponent),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./admin-auditoria.component').then(m => m.AdminAuditoriaComponent),
      },
      {
        path: 'incidencias',
        loadComponent: () =>
          import('./admin-incidencias.component').then(m => m.AdminIncidenciasComponent),
      },
      {
        path: 'pagos',
        loadComponent: () =>
          import('./admin-pagos.component').then(m => m.AdminPagosComponent),
      },
      {
        path: 'resenas',
        loadComponent: () =>
          import('./admin-resenas.component').then(m => m.AdminResenasComponent),
      },
      {
        // Las aseguradoras entran por solicitud revisada, no por el alta normal.
        path: 'seguros',
        loadComponent: () =>
          import('./admin-seguros.component').then((m) => m.AdminSegurosComponent),
      },
      {
        path: 'comisiones',
        loadComponent: () =>
          import('./admin-comisiones.component').then(m => m.AdminComisionesComponent),
      },
      {
        path: 'alpha',
        loadComponent: () =>
          import('./admin-alpha.component').then(m => m.AdminAlphaComponent),
      },
      {
        path: 'analitica',
        loadComponent: () =>
          import('./admin-analitica.component').then(m => m.AdminAnaliticaComponent),
      },
      {
        path: 'avisos',
        loadComponent: () =>
          import('./admin-avisos.component').then(m => m.AdminAvisosComponent),
      },
    ],
  },
];
