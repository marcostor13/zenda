import { Routes } from '@angular/router';

export const reservasRoutes: Routes = [
  {
    path: 'mis-reservas',
    loadComponent: () =>
      import('./components/mis-reservas.component').then(m => m.MisReservasComponent),
  },
  {
    path: ':vertical/:servicioId',
    loadComponent: () =>
      import('./components/reserva-wizard.component').then(m => m.ReservaWizardComponent),
  },
  { path: '', redirectTo: 'mis-reservas', pathMatch: 'full' },
];
