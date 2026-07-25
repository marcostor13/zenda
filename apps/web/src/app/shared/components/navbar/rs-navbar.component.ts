import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsRegionSelectorComponent } from '../region/rs-region-selector.component';
import { VERTICALES_UI } from '../../verticales/verticales.config';
import { BRAND } from '../../media/images';

@Component({
  selector: 'rs-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RsIconComponent, RsRegionSelectorComponent],
  template: `
    <nav class="rs-navbar">
      <!-- Marca: la inicial "D" siempre visible (patrón Booking) y el logotipo
           completo solo cuando hay espacio, para que la barra nunca se rompa. -->
      <a routerLink="/" class="rs-navbar__brand" aria-label="Doogking — inicio">
        <img [src]="logoD" alt="" aria-hidden="true" class="rs-navbar__mark" />
        <img src="/images/logo-doogking.jpg" alt="Doogking" class="rs-navbar__wordmark" />
      </a>

      <!-- Desktop nav — una entrada por categoría (misma config que el buscador) -->
      <div class="rs-navbar__nav">
        @for (v of verticales; track v.key) {
          <a [routerLink]="v.route" routerLinkActive="rs-navbar__link--active" class="rs-navbar__link">
            {{ v.labelCorto }}
          </a>
        }
      </div>

      <!-- Desktop actions -->
      <div class="rs-navbar__actions">
        <rs-region-selector />

        <a routerLink="/ayuda" class="rs-navbar__ayuda"
           aria-label="Ayuda y atención al cliente" title="Ayuda y atención al cliente">
          <rs-icon name="message-square" [size]="16" [stroke]="2"></rs-icon>
        </a>

        @if (muestraAltaComercio()) {
          <a routerLink="/auth/registro-comercio" class="rs-navbar__link rs-navbar__link--pro">
            <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon>
            Registra tu empresa
          </a>
        }
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
                <a routerLink="/favoritos"       class="rs-navbar__dropdown-item" (click)="cuentaAbierto.set(false)">
                  <rs-icon name="heart" [size]="15" [stroke]="2"></rs-icon> Favoritos
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
          @for (v of verticales; track v.key) {
            <a [routerLink]="v.route" routerLinkActive="rs-mobile-menu__link--active"
               class="rs-mobile-menu__link" (click)="menuAbierto.set(false)">
              <rs-icon [name]="v.icon" [size]="17" [stroke]="2"></rs-icon> {{ v.label }}
            </a>
          }
        </nav>

        <div class="rs-mobile-menu__divider"></div>

        <div class="rs-mobile-menu__actions">
          <rs-region-selector [block]="true" />

          <a routerLink="/ayuda" class="rs-btn rs-btn--ghost rs-btn--block" (click)="menuAbierto.set(false)">
            <rs-icon name="message-square" [size]="15" [stroke]="2"></rs-icon>
            Ayuda y atención al cliente
          </a>

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
            <a routerLink="/favoritos" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Favoritos</a>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--block" (click)="cerrarSesion()">
              <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon>
              Cerrar sesión
            </button>
          } @else {
            <a routerLink="/auth/login"    class="rs-btn rs-btn--ghost rs-btn--block"   (click)="menuAbierto.set(false)">Ingresar</a>
            <a routerLink="/auth/registro" class="rs-btn rs-btn--primary rs-btn--block" (click)="menuAbierto.set(false)">Comenzar gratis</a>
          }

          <!-- El alta de comercio cierra el menú: es una acción secundaria para
               quien navega como cliente, no compite con sus propios accesos. -->
          @if (muestraAltaComercio()) {
            <a routerLink="/auth/registro-comercio" class="rs-btn rs-btn--outline rs-btn--block" (click)="menuAbierto.set(false)">
              <rs-icon name="building" [size]="15" [stroke]="2"></rs-icon>
              Registra tu empresa
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Marca: inicial "D" + logotipo */
    .rs-navbar__mark { height: 34px; width: 34px; display: block; flex-shrink: 0; }
    .rs-navbar__wordmark { height: 44px; width: auto; display: block; }
    @media (max-width: 1180px) { .rs-navbar__wordmark { display: none; } }

    /* Acceso a soporte: siempre visible, con o sin sesión */
    .rs-navbar__ayuda {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; flex-shrink: 0;
      border: 1px solid var(--b-2); border-radius: 50%;
      color: var(--dk-blue); text-decoration: none;
      transition: background var(--d-2), border-color var(--d-2);
      &:hover { background: var(--c-accent-lo); border-color: var(--c-accent); }
    }

    /* Enlace "REGISTRA TU EMPRESA" (desktop) */
    .rs-navbar__link--pro {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7); letter-spacing: .06em;
      text-transform: uppercase; color: var(--c-accent);
      text-decoration: none; padding: var(--sp-2) var(--sp-1); white-space: nowrap;
      transition: color var(--d-2);
      &:hover { color: var(--dk-blue-deep, var(--c-accent-h)); }
    }
    @media (max-width: 900px) { .rs-navbar__link--pro { display: none; } }

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

  /** Menú de categorías: misma fuente que el buscador y las vistas. */
  readonly verticales = VERTICALES_UI;

  readonly estaAutenticado = this.authService.estaAutenticado;
  readonly esAdmin = this.authService.esAdmin;
  readonly esComercio = this.authService.esComercio;
  readonly menuAbierto = signal(false);
  readonly cuentaAbierto = signal(false);

  readonly logoD = BRAND.logoD;

  /**
   * El alta de comercio es la vía principal de captación de oferta: se muestra
   * a quien no ha entrado y también al cliente logueado, no solo a los visitantes.
   */
  readonly muestraAltaComercio = computed(() => !this.esComercio() && !this.esAdmin());

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
