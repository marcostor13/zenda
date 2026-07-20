import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiComercio } from '../panel-comercio/comercio-api.service';

interface StatItem { icon: string; iconColor: string; iconBg: string; value: string; label: string; }
interface ConfigItem { icon: string; label: string; sub: string; ruta: string; }

const VERIFICACION_BADGE: Record<string, { clase: string; texto: string }> = {
  verificado:   { clase: 'rs-badge--success', texto: '✅ Comercio verificado' },
  pendiente:    { clase: 'rs-badge--warning', texto: '⏳ Verificación pendiente' },
  rechazado:    { clase: 'rs-badge--error',   texto: '✗ Verificación rechazada' },
  sin_verificar:{ clase: 'rs-badge--neutral', texto: 'Sin verificar' },
};

@Component({
  selector: 'app-perfil-comercio',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- HEADER PERFIL PROFESIONAL -->
    <div class="perfil-header">
      <div class="avatar-ring">
        @if (comercio()?.logoUrl) {
          <img [src]="comercio()!.logoUrl" alt="Logo" class="avatar-photo" />
        } @else {
          <div class="avatar-inner">{{ inicial() }}</div>
        }
      </div>

      <div class="perfil-header__info">
        <h1>{{ comercio()?.nombreComercial ?? 'Mi comercio' }}</h1>
        <p class="perfil-header__cats">{{ categorias() }}</p>
        @if (ciudad()) {
          <p class="perfil-header__loc">
            <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon> {{ ciudad() }}
          </p>
        }
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-3)">
          <span class="rs-badge {{ verificacionBadge().clase }}">{{ verificacionBadge().texto }}</span>
          <span class="rs-badge">Miembro desde 2026</span>
        </div>
      </div>

      <div class="perfil-header__actions">
        <a routerLink="/comercio/config" class="rs-btn rs-btn--secondary">
          <rs-icon name="pencil" [size]="14" [stroke]="2"></rs-icon> Editar perfil
        </a>
        <a routerLink="/comercio" class="rs-btn rs-btn--primary">
          <rs-icon name="building" [size]="14" [stroke]="2"></rs-icon> Gestionar negocio
        </a>
      </div>
    </div>

    <!-- STATS DE RENDIMIENTO -->
    <div class="perfil-stats">
      @for (s of stats(); track s.label) {
        <div class="rs-card rs-stat">
          <div class="rs-stat__icon" [style.background]="s.iconBg" [style.color]="s.iconColor">
            <rs-icon [name]="s.icon" [size]="18" [stroke]="1.75"></rs-icon>
          </div>
          <div class="rs-stat__value">{{ s.value }}</div>
          <div class="rs-stat__label">{{ s.label }}</div>
        </div>
      }
    </div>

    <!-- GESTIÓN DEL NEGOCIO -->
    <div class="perfil-section">
      <h2>Gestión del negocio</h2>
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
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); } }
    .perfil-header__cats { color: var(--c-accent); font-size: var(--f-sm); font-weight: var(--w-6); text-transform: capitalize; }
    .perfil-header__loc { color: var(--t-400); font-size: var(--f-sm); display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; }
    .perfil-header__actions { margin-left: auto; display: flex; gap: var(--sp-3); flex-wrap: wrap; }
    .avatar-ring { position: relative; flex-shrink: 0; }
    .avatar-inner { width: 80px; height: 80px; border-radius: 50%; background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-2xl); font-weight: var(--w-8); color: #fff; }
    .avatar-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block; }
    .perfil-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); margin-bottom: var(--sp-8); @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }
    .rs-stat { padding: var(--sp-5); display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-3); }
    .rs-stat__icon { width: 40px; height: 40px; border-radius: var(--r-xl); display: flex; align-items: center; justify-content: center; }
    .rs-stat__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .rs-stat__label { font-size: var(--f-xs); color: var(--t-400); }
    .perfil-section { h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); } }
    .config-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-2); @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .config-item { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); text-decoration: none; transition: border-color var(--d-2); cursor: pointer; &:hover { border-color: var(--c-accent); } }
    .config-item__icon { width: 36px; height: 36px; border-radius: var(--r-lg); background: var(--c-raised); display: flex; align-items: center; justify-content: center; color: var(--t-300); flex-shrink: 0; }
    .config-item__label { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .config-item__sub { font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class PerfilComercioComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly comercioApi = inject(ComercioApiService);

  readonly comercio = signal<MiComercio | null>(null);

  readonly stats = signal<StatItem[]>([
    { icon: 'calendar',     iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)',  value: '0', label: 'Reservas totales' },
    { icon: 'check-circle', iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: '0', label: 'Servicios completados' },
    { icon: 'star',         iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: '—', label: 'Valoración media' },
    { icon: 'tag',          iconColor: '#8B5CF6', iconBg: 'rgba(139,92,246,.12)', value: '0', label: 'Servicios activos' },
  ]);

  readonly configItems: ConfigItem[] = [
    { icon: 'building',    label: 'Datos del negocio',      sub: 'Razón social, CIF, dirección', ruta: '/comercio/config' },
    { icon: 'tag',         label: 'Servicios publicados',   sub: 'Crear y gestionar servicios',  ruta: '/comercio/listados' },
    { icon: 'calendar',    label: 'Reservas recibidas',     sub: 'Agenda y reservas de clientes',ruta: '/comercio/reservas' },
    { icon: 'credit-card', label: 'Cobros y cuenta bancaria', sub: 'IBAN, liquidaciones, historial', ruta: '/comercio/ingresos' },
    { icon: 'star',        label: 'Reseñas recibidas',      sub: 'Opiniones de tus clientes',    ruta: '/comercio/resenas' },
    { icon: 'bell',        label: 'Notificaciones',         sub: 'Email, WhatsApp, push',        ruta: '/perfil/notificaciones' },
    { icon: 'lock',        label: 'Seguridad',              sub: 'Contraseña y acceso',          ruta: '/perfil/seguridad' },
  ];

  inicial(): string { return (this.comercio()?.nombreComercial?.[0] ?? 'C').toUpperCase(); }
  categorias(): string { return (this.comercio()?.verticales ?? []).join(' · ') || 'Comercio'; }
  ciudad(): string { return this.comercio()?.direccion?.ciudad ?? ''; }
  verificacionBadge(): { clase: string; texto: string } {
    return VERIFICACION_BADGE[this.comercio()?.verificacion?.estado ?? 'sin_verificar'];
  }

  async ngOnInit(): Promise<void> {
    try {
      const [comercio, reservas, servicios, resenas] = await Promise.all([
        firstValueFrom(this.comercioApi.getMiComercio()),
        firstValueFrom(this.comercioApi.getMisReservas()).catch(() => []),
        firstValueFrom(this.comercioApi.getMisServicios()).catch(() => []),
        firstValueFrom(this.comercioApi.getMisResenas()).catch(() => []),
      ]);
      this.comercio.set(comercio);
      const completados = reservas.filter(r => r.estado === 'completada').length;
      const activos = servicios.filter(s => s.estado === 'publicado').length;
      const valoracion = resenas.length
        ? (resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length).toFixed(1)
        : '—';
      this.stats.set([
        { icon: 'calendar',     iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)',  value: String(reservas.length), label: 'Reservas totales' },
        { icon: 'check-circle', iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: String(completados),     label: 'Servicios completados' },
        { icon: 'star',         iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: valoracion,              label: 'Valoración media' },
        { icon: 'tag',          iconColor: '#8B5CF6', iconBg: 'rgba(139,92,246,.12)', value: String(activos),         label: 'Servicios activos' },
      ]);
    } catch {
      // API no disponible — mantener estado inicial
    }
  }

  cerrarSesion(): void { this.authService.logout(); }
}
