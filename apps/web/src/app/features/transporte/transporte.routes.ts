import { Routes } from '@angular/router';

export const transporteRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/transporte-lista.component').then(m => m.TransporteListaComponent),
  },
  {
    path: ':id',
    data: { vertical: 'transporte' },
    loadComponent: () =>
      import('../verticales/vertical-detalle.component').then(m => m.VerticalDetalleComponent),
  },
];
