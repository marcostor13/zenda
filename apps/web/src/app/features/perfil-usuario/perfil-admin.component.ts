import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AdminApiService } from '../panel-admin/admin-api.service';

interface ConfigItem { icon: string; label: string; sub: string; ruta: string; }

@Component({
  selector: 'app-perfil-admin',
  standalone: true,
  imports: [RouterLink, DecimalPipe, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- HEADER -->
    <div class="perfil-header">
      <div class="avatar-inner">{{ iniciales() }}</div>
      <div class="perfil-header__info">
        <h1>{{ usuario()?.nombre ?? 'Administrador' }}</h1>
        <p>{{ usuario()?.email }}</p>
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-3)">
          <span class="rs-badge rs-badge--accent">Administrador de plataforma</span>
        </div>
      </div>
      <a routerLink="/admin" class="rs-btn rs-btn--primary perfil-header__cta">
        <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon> Ir al panel
      </a>
    </div>

    <!-- MÉTRICAS DE NEGOCIO -->
    <div class="metric-grid">
      <div class="rs-card metric">
        <div class="metric__value">{{ kpis().gmvMes | number:'1.0-0' }} €</div>
        <div class="metric__label">Facturación gestionada (mes)</div>
      </div>
      <div class="rs-card metric">
        <div class="metric__value">{{ kpis().ingresosMes | number:'1.0-0' }} €</div>
        <div class="metric__label">Comisión Doogking (mes)</div>
      </div>
      <div class="rs-card metric">
        <div class="metric__value">{{ kpis().totalUsuarios | number:'1.0-0' }}</div>
        <div class="metric__label">Usuarios registrados</div>
      </div>
      <div class="rs-card metric">
        <div class="metric__value">{{ kpis().totalReservas | number:'1.0-0' }}</div>
        <div class="metric__label">Reservas totales</div>
      </div>
      <div class="rs-card metric">
        <div class="metric__value">{{ kpis().comerciosPendientesCount }}</div>
        <div class="metric__label">Comercios pendientes</div>
      </div>
    </div>

    <!-- CONFIGURACIÓN GLOBAL -->
    <div class="perfil-section">
      <h2>Administración de la plataforma</h2>
      <div class="config-list">
        @for (item of configItems; track item.label) {
          <a [routerLink]="item.ruta" class="config-item rs-card">
            <div class="config-item__icon">
              <rs-icon [name]="item.icon" [size]="16" [stroke]="1.75"></rs-icon>
            </div>
            <div class="config-item__text">
              <div class="config-item__label">{{ item.label }}</div>
              <div class="config-item__sub">{{ item.sub }}</div>
            </div>
            <rs-icon name="chevron-down" [size]="14" [stroke]="2" style="color:var(--t-400);transform:rotate(-90deg)"></rs-icon>
          </a>
        }
      </div>

      <div style="margin-top:var(--sp-6);max-width:360px">
        <button (click)="cerrarSesion()" class="rs-btn rs-btn--danger rs-btn--block">
          <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon> Cerrar sesión
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .perfil-header { display: flex; align-items: center; gap: var(--sp-6); padding: var(--sp-8); background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-2xl); margin-bottom: var(--sp-6); flex-wrap: wrap;
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
      p { color: var(--t-400); font-size: var(--f-sm); } }
    .perfil-header__cta { margin-left: auto; }
    .avatar-inner { width: 80px; height: 80px; border-radius: 50%; background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-2xl); font-weight: var(--w-8); color: #fff; flex-shrink: 0; }
    .metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); margin-bottom: var(--sp-8); @media (max-width: 1024px) { grid-template-columns: repeat(3, 1fr); } @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); } }
    .metric { padding: var(--sp-5); }
    .metric__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .metric__label { font-size: var(--f-xs); color: var(--t-400); }
    .perfil-section { h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); } }
    .config-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-2); @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .config-item { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); text-decoration: none; transition: border-color var(--d-2); cursor: pointer; &:hover { border-color: var(--c-accent); } }
    .config-item__icon { width: 36px; height: 36px; border-radius: var(--r-lg); background: var(--c-raised); display: flex; align-items: center; justify-content: center; color: var(--t-300); flex-shrink: 0; }
    .config-item__label { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .config-item__sub { font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class PerfilAdminComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);

  readonly usuario = this.authService.usuario;

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'AD';
  });

  readonly kpis = signal({
    totalReservas: 0, gmvMes: 0, ingresosMes: 0,
    comerciosPendientesCount: 0, totalUsuarios: 0,
  });

  readonly configItems: ConfigItem[] = [
    { icon: 'building',    label: 'Gestión de comercios', sub: 'Aprobar, suspender, verificar', ruta: '/admin/comercios' },
    { icon: 'users',       label: 'Gestión de usuarios',  sub: 'Clientes, staff y roles',       ruta: '/admin/usuarios' },
    { icon: 'tag',         label: 'Comisiones',           sub: 'Comisión por vertical y Stripe', ruta: '/admin' },
    { icon: 'trending-up', label: 'Reportes financieros', sub: 'GMV, comisiones, margen neto',  ruta: '/admin/reportes' },
    { icon: 'calendar',    label: 'Reservas de la plataforma', sub: 'Todas las reservas',        ruta: '/admin/reservas' },
    { icon: 'star',        label: 'Cupones',              sub: 'Descuentos y promociones',      ruta: '/admin/cupones' },
    { icon: 'lock',        label: 'Seguridad',            sub: 'Contraseña y acceso',           ruta: '/perfil/seguridad' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.adminApi.getDashboard());
      this.kpis.set(data.kpis);
    } catch {
      // API no disponible — mantener ceros
    }
  }

  cerrarSesion(): void { this.authService.logout(); }
}
