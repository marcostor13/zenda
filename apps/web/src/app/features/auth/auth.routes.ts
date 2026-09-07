import { Routes } from '@angular/router';
import { underConstructionGuard } from '../../core/guards/under-construction.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    /*
     * El resto de `auth` queda fuera del modo "muy pronto" para que funcionen los
     * enlaces de los correos y la captación de comercios; el alta de cliente no,
     * porque abrir el registro al público es justo lo que la pantalla retiene.
     */
    path: 'registro',
    canActivate: [underConstructionGuard],
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
