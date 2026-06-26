import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../icon/rs-icon.component';

@Component({
  selector: 'rs-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RsIconComponent],
  template: `
    <nav class="rs-navbar">
      <a routerLink="/" class="rs-navbar__brand">
        <img src="/githubspec-kit.png" alt="Zenda" style="height:36px;width:auto;display:block" />
      </a>

      <!-- Desktop nav -->
      <div class="rs-navbar__nav">
        <a routerLink="/buscador"   routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Buscar</a>
        <a routerLink="/hoteles"    routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Hoteles</a>
        <a routerLink="/taxis"      routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Taxis</a>
        <a routerLink="/vuelos"     routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Vuelos</a>
        <a routerLink="/transporte" routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Transporte</a>
        <a routerLink="/guarderia"  routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Guardería</a>
      </div>

      <!-- Desktop actions -->
      <div class="rs-navbar__actions">
        @if (estaAutenticado()) {
          @if (esAdmin()) {
            <a routerLink="/admin" class="rs-btn rs-btn--primary rs-btn--sm">
              <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
              Panel Admin
            </a>
          }
          @if (esComercio()) {
            <a routerLink="/comercio" class="rs-btn rs-btn--primary rs-btn--sm">
              <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
              Mi Comercio
            </a>
          }
          <a routerLink="/perfil"   class="rs-btn rs-btn--primary rs-btn--sm">Mi perfil</a>
          <a routerLink="/reservas" class="rs-btn rs-btn--primary rs-btn--sm">Mis reservas</a>
        } @else {
          <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--sm">Ingresar</a>
          <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--sm">Comenzar</a>
        }
      </div>

      <!-- Hamburger button (mobile only) -->
      <button class="rs-navbar__hamburger" (click)="menuAbierto.set(!menuAbierto())" [attr.aria-expanded]="menuAbierto()">
        @if (menuAbierto()) {
          <rs-icon name="x" [size]="22" [stroke]="2"></rs-icon>
        } @else {
          <rs-icon name="menu" [size]="22" [stroke]="2"></rs-icon>
        }
      </button>
    </nav>

    <!-- Mobile menu drawer -->
    @if (menuAbierto()) {
      <div class="rs-mobile-menu">
        <nav class="rs-mobile-menu__nav">
          <a routerLink="/buscador"   routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="search" [size]="17" [stroke]="2"></rs-icon> Buscar
          </a>
          <a routerLink="/hoteles"    routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="hotel" [size]="17" [stroke]="2"></rs-icon> Hoteles
          </a>
          <a routerLink="/taxis"      routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="car" [size]="17" [stroke]="2"></rs-icon> Taxis
          </a>
          <a routerLink="/vuelos"     routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="plane" [size]="17" [stroke]="2"></rs-icon> Vuelos
          </a>
          <a routerLink="/transporte" routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="truck" [size]="17" [stroke]="2"></rs-icon> Transporte
          </a>
          <a routerLink="/guarderia"  routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="users" [size]="17" [stroke]="2"></rs-icon> Guardería
          </a>
        </nav>

        <div class="rs-mobile-menu__divider"></div>

        <div class="rs-mobile-menu__actions">
          @if (estaAutenticado()) {
            @if (esAdmin()) {
              <a routerLink="/admin" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">
                <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
                Panel Admin
              </a>
            }
            @if (esComercio()) {
              <a routerLink="/comercio" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">
                <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
                Mi Comercio
              </a>
            }
            <a routerLink="/perfil"   class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Mi perfil</a>
            <a routerLink="/reservas" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Mis reservas</a>
          } @else {
            <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--block"   (click)="menuAbierto.set(false)">Ingresar</a>
            <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Comenzar gratis</a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Hamburger: hidden on desktop */
    .rs-navbar__hamburger {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      color: var(--t-200);
      cursor: pointer;
      transition: all var(--d-2);
      flex-shrink: 0;
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }

    @media (max-width: 768px) {
      .rs-navbar__hamburger { display: flex; }
    }

    /* Mobile drawer */
    .rs-mobile-menu {
      position: fixed;
      top: 64px;
      left: 0;
      right: 0;
      z-index: calc(var(--z-3) - 1);
      background: rgba(255,255,255,.97);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--b-1);
      padding: var(--sp-4) var(--sp-5) var(--sp-6);
      animation: slideDown 200ms cubic-bezier(.4,0,.2,1) both;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rs-mobile-menu__nav {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }

    .rs-mobile-menu__link {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-3);
      font-size: var(--f-base);
      font-weight: var(--w-5);
      color: var(--t-200);
      border-radius: var(--r-lg);
      text-decoration: none;
      transition: all var(--d-1);
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .rs-mobile-menu__link--active { background: var(--c-raised); color: var(--t-100); }

    .rs-mobile-menu__divider {
      height: 1px;
      background: var(--b-1);
      margin: var(--sp-4) 0;
    }

    .rs-mobile-menu__actions {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
  `],
})
export class RsNavbarComponent {
  private readonly authService = inject(AuthService);
  readonly estaAutenticado = this.authService.estaAutenticado;
  readonly esAdmin = this.authService.esAdmin;
  readonly esComercio = this.authService.esComercio;
  readonly menuAbierto = signal(false);
}
