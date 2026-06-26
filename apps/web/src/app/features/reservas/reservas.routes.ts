import { Routes } from '@angular/router';

export const reservasRoutes: Routes = [
  {
    path: 'mis-reservas',
    loadComponent: () =>
      import('./components/mis-reservas.component').then(m => m.MisReservasComponent),
  },
  {
    path: ':codigo',
    loadComponent: () =>
      import('./components/reserva-detalle.component').then(m => m.ReservaDetalleComponent),
    // Only matches single-segment paths like RES-XXXXXXXX; two-segment :vertical/:servicioId takes precedence for 2-part paths.
  },
  {
    path: ':vertical/:servicioId',
    loadComponent: () =>
      import('./components/reserva-wizard.component').then(m => m.ReservaWizardComponent),
  },
  { path: '', redirectTo: 'mis-reservas', pathMatch: 'full' },
];
