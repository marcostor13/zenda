import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { sesionOInvitadoGuard } from '../../core/guards/sesion-o-invitado.guard';

/*
 * El asistente de reserva es público: se puede reservar como invitado (el
 * propio asistente pide los datos de contacto y abre la sesión de invitado al
 * pasar al pago). La ficha de una reserva acepta esa sesión; todo lo demás es
 * de la cuenta y pide iniciar sesión.
 */

export const reservasRoutes: Routes = [
  {
    path: 'mis-reservas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mis-reservas.component').then(m => m.MisReservasComponent),
  },
  // Rutas fijas antes que las paramétricas: si no, ':codigo' las capturaría.
  {
    path: 'viaje-pago',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/viaje-pago.component').then(m => m.ViajePagoComponent),
  },
  /*
   * Retomar el pago de una reserva que se quedó sin pagar. Es la misma pantalla
   * que la del viaje —cobra algo ya reservado— con otro texto, así que comparte
   * componente en vez de duplicarlo.
   */
  {
    path: 'pagar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/viaje-pago.component').then(m => m.ViajePagoComponent),
  },
  {
    path: 'viaje/:reservaMadreId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mi-viaje.component').then(m => m.MiViajeComponent),
  },
  {
    path: ':codigo',
    canActivate: [sesionOInvitadoGuard],
    loadComponent: () =>
      import('./components/reserva-detalle.component').then(m => m.ReservaDetalleComponent),
    // Only matches single-segment paths like RES-XXXXXXXX; two-segment :vertical/:servicioId takes precedence for 2-part paths.
  },
  {
    path: ':codigo/ajuste',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/ajuste-pago.component').then(m => m.AjustePagoComponent),
  },
  {
    path: ':vertical/:servicioId',
    loadComponent: () =>
      import('./components/reserva-wizard.component').then(m => m.ReservaWizardComponent),
  },
  { path: '', redirectTo: 'mis-reservas', pathMatch: 'full' },
];
