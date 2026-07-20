import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PerfilDashboardComponent } from './perfil-dashboard.component';
import { PerfilComercioComponent } from './perfil-comercio.component';
import { PerfilAdminComponent } from './perfil-admin.component';

/**
 * Selecciona la vista de perfil según el rol: administrador, comercio o cliente.
 * Cada rol necesita una experiencia distinta aunque compartan la ruta `/perfil`.
 */
@Component({
  selector: 'app-perfil-router',
  standalone: true,
  imports: [PerfilDashboardComponent, PerfilComercioComponent, PerfilAdminComponent],
  template: `
    @if (esAdmin()) {
      <app-perfil-admin />
    } @else if (esComercio()) {
      <app-perfil-comercio />
    } @else {
      <app-perfil-dashboard />
    }
  `,
})
export class PerfilRouterComponent {
  private readonly authService = inject(AuthService);
  readonly esAdmin = this.authService.esAdmin;
  readonly esComercio = this.authService.esComercio;
}
