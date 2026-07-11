import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    loadComponent: () => import('./registro/registro.component').then((m) => m.RegistroComponent),
  },
  {
    path: 'registro-comercio',
    loadComponent: () =>
      import('./registro-comercio/registro-comercio.component').then((m) => m.RegistroComercioComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
