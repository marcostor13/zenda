import { Routes } from '@angular/router';

export const perrosRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./perros-lista.component').then((m) => m.PerrosListaComponent),
  },
  // 'nuevo' y ':id/editar' deben declararse antes de cualquier ruta genérica ':id'.
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./perro-form.component').then((m) => m.PerroFormComponent),
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./perro-form.component').then((m) => m.PerroFormComponent),
  },
];
