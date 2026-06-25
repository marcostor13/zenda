import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../shared/media/images';

@Component({
  selector: 'app-perfil-dashboard',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- HEADER PERFIL -->
    <div class="perfil-header">
      <div class="avatar-ring">
        <div class="avatar-inner">{{ iniciales() }}</div>
        <div class="avatar-ring__pulse"></div>
      </div>
      <div class="perfil-header__info">
        <h1>{{ usuario()?.nombre ?? 'Mi perfil' }}</h1>
        <p>{{ usuario()?.email }}</p>
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-3)">
          <span class="rs-badge rs-badge--accent">Cliente verificado</span>
          <span class="rs-badge">Miembro desde 2026</span>
        </div>
      </div>
      <a routerLink="/perfil/editar" class="rs-btn rs-btn--secondary" style="margin-left:auto">
        ✏️ Editar perfil
      </a>
    </div>

    <!-- STATS RÁPIDAS -->
    <div class="perfil-stats">
      @for (s of stats; track s.label) {
        <div class="rs-stat rs-card">
          <div class="rs-stat__icon">{{ s.icon }}</div>
          <div class="rs-stat__value">{{ s.value }}</div>
          <div class="rs-stat__label">{{ s.label }}</div>
        </div>
      }
    </div>

    <!-- GRID: reservas + configuración -->
    <div class="perfil-grid">

      <!-- RESERVAS RECIENTES -->
      <div class="perfil-section">
        <div class="section-row-header">
          <h2>Reservas recientes</h2>
          <a routerLink="/reservas/mis-reservas" class="rs-link">Ver todas →</a>
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
          @for (r of reservasRecientes; track r.codigo) {
            <div class="mini-reserva rs-card">
              <img [src]="r.imagen" [alt]="r.titulo" rsImg />
              <div class="mini-reserva__info">
                <strong>{{ r.titulo }}</strong>
                <span>{{ r.fecha }}</span>
              </div>
              <span class="{{ 'rs-badge ' + r.badgeClass }}">{{ r.estado }}</span>
              <a [routerLink]="['/reservas', r.codigo]" class="rs-btn rs-btn--ghost rs-btn--sm">Ver</a>
            </div>
          }
        </div>
      </div>

      <!-- CONFIGURACIÓN -->
      <div class="perfil-section">
        <h2>Configuración</h2>

        <div class="config-list">
          @for (item of configItems; track item.label) {
            <a [routerLink]="item.ruta" class="config-item rs-card">
              <span class="config-item__icon">{{ item.icon }}</span>
              <div class="config-item__text">
                <div class="config-item__label">{{ item.label }}</div>
                <div class="config-item__sub">{{ item.sub }}</div>
              </div>
              <span class="config-item__arrow">→</span>
            </a>
          }
        </div>

        <div style="margin-top:var(--sp-6)">
          <button (click)="cerrarSesion()" class="rs-btn rs-btn--danger rs-btn--block">
            Cerrar sesión
          </button>
        </div>
      </div>

    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .perfil-header {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
      padding: var(--sp-8);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-2xl);
      margin-bottom: var(--sp-6);
      flex-wrap: wrap;

      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
      p  { color: var(--t-400); font-size: var(--f-sm); }
    }

    .avatar-ring {
      position: relative;
      flex-shrink: 0;
    }

    .avatar-inner {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--g-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--f-2xl);
      font-weight: var(--w-8);
      color: #fff;
    }

    .avatar-ring__pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid var(--c-accent);
      opacity: .4;
      animation: pulseRing 2s ease-out infinite;
    }

    .perfil-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-8);

      @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
    }

    .perfil-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--sp-6);

      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    .perfil-section { h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); } }

    .section-row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); }
    .rs-link { color: var(--c-accent); font-size: var(--f-sm); text-decoration: none; }

    .mini-reserva {
      display: grid;
      grid-template-columns: 56px 1fr auto auto;
      gap: var(--sp-3);
      align-items: center;
      padding: var(--sp-3) var(--sp-4);

      img { width: 56px; height: 44px; object-fit: cover; border-radius: var(--r-md); }
      strong { display: block; font-size: var(--f-sm); color: var(--t-100); }
      span   { font-size: var(--f-xs); color: var(--t-400); }
    }

    .config-list { display: flex; flex-direction: column; gap: var(--sp-2); }

    .config-item {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-4);
      text-decoration: none;
      transition: all var(--d-2);
      cursor: pointer;

      &:hover { border-color: var(--c-accent); }
    }

    .config-item__icon { font-size: 1.25rem; }
    .config-item__label { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .config-item__sub { font-size: var(--f-xs); color: var(--t-400); }
    .config-item__arrow { margin-left: auto; color: var(--t-400); }
  `],
})
export class PerfilDashboardComponent {
  private readonly authService = inject(AuthService);

  readonly usuario = this.authService.usuario;

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  readonly stats = [
    { icon: '🏨', value: '8',   label: 'Reservas totales' },
    { icon: '✓',  value: '6',   label: 'Completadas' },
    { icon: '⭐', value: '4.8', label: 'Rating promedio' },
    { icon: '🌍', value: '3',   label: 'Destinos visitados' },
  ];

  readonly reservasRecientes = [
    {
      codigo: 'RES-A1B2C3',
      titulo: 'Casa Andina Premium',
      fecha: '15 Jul 2026',
      imagen: hotelImage(0, 200),
      estado: '✓ Confirmada',
      badgeClass: 'rs-badge--success',
    },
    {
      codigo: 'RES-D4E5F6',
      titulo: 'Traslado Aeropuerto',
      fecha: '14 Jul 2026',
      imagen: hotelImage(7, 200),
      estado: '★ Completada',
      badgeClass: 'rs-badge--accent',
    },
  ];

  readonly configItems = [
    { icon: '👤', label: 'Datos personales',   sub: 'Nombre, email, teléfono',      ruta: '/perfil/editar' },
    { icon: '🔒', label: 'Seguridad',           sub: 'Contraseña, 2FA',             ruta: '/perfil/seguridad' },
    { icon: '🔔', label: 'Notificaciones',      sub: 'Email, WhatsApp, push',        ruta: '/perfil/notificaciones' },
    { icon: '💳', label: 'Métodos de pago',     sub: 'Tarjetas guardadas',           ruta: '/perfil/pagos' },
    { icon: '⭐', label: 'Mis reseñas',          sub: 'Reseñas que has escrito',     ruta: '/perfil/resenas' },
  ];

  cerrarSesion(): void {
    this.authService.logout();
  }
}
