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
  {
    path: 'verificar',
    loadComponent: () =>
      import('./verificar/verificar-email.component').then((m) => m.VerificarEmailComponent),
  },
  {
    path: 'recuperar',
    loadComponent: () =>
      import('./recuperar/recuperar-password.component').then((m) => m.RecuperarPasswordComponent),
  },
  {
    path: 'restablecer',
    loadComponent: () =>
      import('./recuperar/restablecer-password.component').then((m) => m.RestablecerPasswordComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
