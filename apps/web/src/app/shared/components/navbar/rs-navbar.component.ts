import { Component, inject, signal, computed, HostListener } from '@angular/core';
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
        <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:44px;width:auto;display:block" />
      </a>

      <!-- Desktop nav -->
      <div class="rs-navbar__nav">
        <a routerLink="/buscador"       routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Buscar</a>
        <a routerLink="/alojamiento"    routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Alojamiento</a>
        <a routerLink="/transporte"     routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Transporte</a>
        <a routerLink="/veterinaria"    routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Veterinarios</a>
        <a routerLink="/peluqueria"     routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Peluquerías</a>
        <a routerLink="/adiestramiento" routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">Adiestramiento</a>
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
          <div class="rs-navbar__account" (click)="$event.stopPropagation()">
            <button type="button" class="rs-btn rs-btn--primary rs-btn--sm rs-navbar__account-btn"
                    (click)="cuentaAbierto.set(!cuentaAbierto())" [attr.aria-expanded]="cuentaAbierto()">
              <span class="rs-navbar__avatar">{{ iniciales() }}</span>
              Mi cuenta
              <rs-icon name="chevron-down" [size]="14" [stroke]="2"></rs-icon>
            </button>
            @if (cuentaAbierto()) {
              <div class="rs-navbar__dropdown">
                <a routerLink="/perfil"          class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="user" [size]="15" [stroke]="2"></rs-icon> Mi perfil
                </a>
                <a routerLink="/perros"          class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="paw" [size]="15" [stroke]="2"></rs-icon> Mis mascotas
                </a>
                <a routerLink="/reservas"        class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="calendar" [size]="15" [stroke]="2"></rs-icon> Mis reservas
                </a>
                <a routerLink="/perfil/resenas"  class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="star" [size]="15" [stroke]="2"></rs-icon> Mis reseñas
                </a>
                <div class="rs-navbar__dropdown-divider"></div>
                <button type="button" class="rs-navbar__dropdown-item rs-navbar__dropdown-item--danger" (click)="cerrarSesion()">
                  <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon> Cerrar sesión
                </button>
              </div>
            }
          </div>
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
          <a routerLink="/buscador"       routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="search" [size]="17" [stroke]="2"></rs-icon> Buscar
          </a>
          <a routerLink="/alojamiento"    routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="hotel" [size]="17" [stroke]="2"></rs-icon> Alojamiento canino
          </a>
          <a routerLink="/transporte"     routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="truck" [size]="17" [stroke]="2"></rs-icon> Transporte de animales
          </a>
          <a routerLink="/veterinaria"    routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="stethoscope" [size]="17" [stroke]="2"></rs-icon> Veterinarios
          </a>
          <a routerLink="/peluqueria"     routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="scissors" [size]="17" [stroke]="2"></rs-icon> Peluquerías caninas
          </a>
          <a routerLink="/adiestramiento" routerLinkActive="rs-mobile-menu__link--active" class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
            <rs-icon name="graduation-cap" [size]="17" [stroke]="2"></rs-icon> Adiestramiento
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
            <a routerLink="/perros"   class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Mis mascotas</a>
            <a routerLink="/reservas" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Mis reservas</a>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--block" (click)="cerrarSesion()">
              <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon>
              Cerrar sesión
            </button>
          } @else {
            <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--block"   (click)="menuAbierto.set(false)">Ingresar</a>
            <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Comenzar gratis</a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Account dropdown (desktop) */
    .rs-navbar__account { position: relative; }
    .rs-navbar__account-btn { display: inline-flex; align-items: center; gap: var(--sp-2); }
    .rs-navbar__avatar {
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(255,255,255,.25); display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: var(--w-7);
    }
    .rs-navbar__dropdown {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: var(--z-3);
      min-width: 220px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
      display: flex; flex-direction: column; gap: 2px;
      animation: slideDown 160ms cubic-bezier(.4,0,.2,1) both;
    }
    .rs-navbar__dropdown-item {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-3); width: 100%;
      font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-200);
      background: transparent; border: none; border-radius: var(--r-lg);
      text-decoration: none; cursor: pointer; text-align: left;
      transition: all var(--d-1);
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .rs-navbar__dropdown-item--danger { color: var(--c-red, #B91C1C); &:hover { color: var(--c-red, #B91C1C); } }
    .rs-navbar__dropdown-divider { height: 1px; background: var(--b-1); margin: var(--sp-1) 0; }

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
  readonly cuentaAbierto = signal(false);

  readonly iniciales = computed(() => {
    const nombre = this.authService.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || '🐾';
  });

  /** Cierra el desplegable de cuenta al hacer clic fuera de él. */
  @HostListener('document:click')
  cerrarDropdownCuenta(): void {
    this.cuentaAbierto.set(false);
  }

  cerrarSesion(): void {
    this.menuAbierto.set(false);
    this.cuentaAbierto.set(false);
    this.authService.logout();
  }
}
