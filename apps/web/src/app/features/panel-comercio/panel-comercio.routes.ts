import { Routes } from '@angular/router';
import { CONVERSION_DE_MONEDA } from '../../core/moneda/conversion-de-moneda.token';

/*
 * Los importes del panel no se traducen a la divisa de la cabecera: son
 * contabilidad en euros (GMV, comisiones, comisiones de Stripe, liquidaciones,
 * facturas). Bastaba con que el usuario hubiera tocado el selector navegando
 * por la parte pública para que su panel dejara de cuadrar con sus extractos.
 */
const SIN_CONVERSION_DE_MONEDA = [{ provide: CONVERSION_DE_MONEDA, useValue: false }];

export const panelComercioRoutes: Routes = [
  /*
   * El alta guiada va fuera del layout del panel a propósito: es una pantalla
   * de recorrido, y el menú lateral del panel invita a saltárselo justo cuando
   * lo que hace falta es terminar.
   */
  {
    path: 'alta',
    providers: SIN_CONVERSION_DE_MONEDA,
    loadComponent: () =>
      import('./comercio-alta.component').then(m => m.ComercioAltaComponent),
  },
  {
    path: '',
    providers: SIN_CONVERSION_DE_MONEDA,
    loadComponent: () =>
      import('./comercio-layout.component').then(m => m.ComercioLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./panel-comercio-dashboard.component').then(m => m.PanelComercioDashboardComponent),
      },
      {
        path: 'agenda',
        loadComponent: () =>
          import('./comercio-agenda.component').then(m => m.ComercioAgendaComponent),
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./comercio-reservas.component').then(m => m.ComercioReservasComponent),
      },
      // listados/nuevo y listados/:id/editar deben declararse antes de listados
      {
        path: 'listados/nuevo',
        loadComponent: () =>
          import('./comercio-listado-form.component').then(m => m.ComercioListadoFormComponent),
      },
      {
        // Las aseguradoras no rellenan la ficha de listado: entregan una
        // solicitud que revisa el equipo (ver `comercio-solicitud-seguros`).
        path: 'listados/solicitud-seguros',
        loadComponent: () =>
          import('./comercio-solicitud-seguros.component').then(m => m.ComercioSolicitudSegurosComponent),
      },
      {
        path: 'listados/:id/editar',
        loadComponent: () =>
          import('./comercio-listado-form.component').then(m => m.ComercioListadoFormComponent),
      },
      {
        path: 'listados',
        loadComponent: () =>
          import('./comercio-listados.component').then(m => m.ComercioListadosComponent),
      },
      {
        path: 'suplementos',
        loadComponent: () =>
          import('./comercio-suplementos.component').then(m => m.ComercioSuplementosComponent),
      },
      {
        path: 'ingresos',
        loadComponent: () =>
          import('./comercio-ingresos.component').then(m => m.ComercioIngresosComponent),
      },
      {
        path: 'resenas',
        loadComponent: () =>
          import('./comercio-resenas.component').then(m => m.ComercioResenasComponent),
      },
      {
        path: 'equipo',
        loadComponent: () =>
          import('./comercio-equipo.component').then(m => m.ComercioEquipoComponent),
      },
      {
        path: 'suscripcion',
        loadComponent: () =>
          import('./comercio-suscripcion.component').then(m => m.ComercioSuscripcionComponent),
      },
      {
        path: 'cuenta',
        loadComponent: () =>
          import('./comercio-cuenta.component').then(m => m.ComercioCuentaComponent),
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./comercio-config.component').then(m => m.ComercioConfigComponent),
      },
    ],
  },
];
