import { Routes } from '@angular/router';

export const exploraRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./explora-lista.component').then((m) => m.ExploraListaComponent),
  },
  {
    // Antes que ':id': si no, el planificador se leería como un lugar.
    path: 'planificador',
    loadComponent: () =>
      import('./planificador.component').then((m) => m.PlanificadorComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./explora-detalle.component').then((m) => m.ExploraDetalleComponent),
  },
];
