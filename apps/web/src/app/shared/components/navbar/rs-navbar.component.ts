import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'rs-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="rs-navbar">
      <a routerLink="/buscador" class="rs-navbar__brand">
        <img src="/githubspec-kit.png" alt="Zenda" style="height:36px;width:auto;display:block" />
      </a>

      <div class="rs-navbar__nav">
        <a routerLink="/buscador" routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Buscar</a>
        <a routerLink="/hoteles"  routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Hoteles</a>
      </div>

      <div class="rs-navbar__actions">
        @if (estaAutenticado()) {
          <a routerLink="/perfil"  class="rs-btn rs-btn--ghost rs-btn--sm">Mi perfil</a>
          <a routerLink="/reservas" class="rs-btn rs-btn--secondary rs-btn--sm">Mis reservas</a>
        } @else {
          <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--sm">Ingresar</a>
          <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--sm">Comenzar</a>
        }
      </div>
    </nav>
  `,
})
export class RsNavbarComponent {
  private readonly authService = inject(AuthService);
  readonly estaAutenticado = this.authService.estaAutenticado;
}
