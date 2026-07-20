import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../shared/media/images';
import { ReservasService, ReservaApi } from '../reservas/services/reservas.service';
import { PerrosService, PerroApi } from '../perros/perros.service';
import { FavoritosService } from '../favoritos/favoritos.service';

interface MiniReserva {
  codigo: string;
  titulo: string;
  fecha: string;
  imagen: string;
  estado: string;
  badgeClass: string;
}

interface StatItem {
  icon: string;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
}

interface ConfigItem {
  icon: string;
  label: string;
  sub: string;
  ruta: string;
}

@Component({
  selector: 'app-perfil-dashboard',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- HEADER PERFIL -->
    <div class="perfil-header">
      <div class="avatar-ring">
        @if (avatarUrl()) {
          <img [src]="avatarUrl()" alt="Avatar" class="avatar-photo" rsImg />
        } @else {
          <div class="avatar-inner">{{ iniciales() }}</div>
        }
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

      <a routerLink="/perfil/editar" class="rs-btn rs-btn--secondary edit-btn">
        <rs-icon name="pencil" [size]="14" [stroke]="2"></rs-icon>
        Editar perfil
      </a>
    </div>

    <!-- STATS RÁPIDAS -->
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

    <!-- MIS MASCOTAS -->
    <div class="perfil-section" style="margin-bottom:var(--sp-8)">
      <div class="section-row-header">
        <h2>🐾 Mis mascotas</h2>
        <a routerLink="/perros" class="rs-link">Gestionar →</a>
      </div>

      @if (mascotas().length === 0) {
        <div class="rs-card" style="padding:var(--sp-8);text-align:center">
          <p style="color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-4)">
            Todavía no has registrado ninguna mascota. Toda la información de tu perro, en un solo lugar.
          </p>
          <a routerLink="/perros/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">
            <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon>
            Añadir mascota
          </a>
        </div>
      } @else {
        <div class="mascotas-grid">
          @for (m of mascotas(); track m._id) {
            <a [routerLink]="['/perros', m._id, 'editar']" class="mascota-card rs-card">
              <div class="mascota-card__avatar">
                @if (m.fotos?.length) {
                  <img [src]="m.fotos[0]" [alt]="m.nombre" rsImg />
                } @else {
                  <span>🐶</span>
                }
              </div>
              <div class="mascota-card__info">
                <strong>{{ m.nombre }}</strong>
                <span>{{ m.raza || (m.esMestizo ? 'Mestizo' : 'Perro') }}@if (m.peso) { · {{ m.peso }} kg }</span>
              </div>
            </a>
          }
          <a routerLink="/perros/nuevo" class="mascota-card mascota-card--add rs-card">
            <rs-icon name="plus" [size]="20" [stroke]="2"></rs-icon>
            <span>Añadir mascota</span>
          </a>
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

        @if (reservasRecientes().length === 0) {
          <div class="rs-card" style="padding:var(--sp-8);text-align:center">
            <rs-icon name="calendar" [size]="32" [stroke]="1.25" style="color:var(--t-400);display:block;margin:0 auto var(--sp-4)"></rs-icon>
            <p style="color:var(--t-400);font-size:var(--f-sm)">No tienes reservas aún.</p>
            <a routerLink="/buscador" class="rs-btn rs-btn--primary rs-btn--sm" style="margin-top:var(--sp-4)">
              Buscar servicios
            </a>
          </div>
        } @else {
          <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
            @for (r of reservasRecientes(); track r.codigo) {
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
        }
      </div>

      <!-- CONFIGURACIÓN -->
      <div class="perfil-section">
        <h2>Configuración</h2>

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

        <div style="margin-top:var(--sp-6)">
          <button (click)="cerrarSesion()" class="rs-btn rs-btn--danger rs-btn--block">
            <rs-icon name="log-out" [size]="15" [stroke]="2"></rs-icon>
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
      display: flex; align-items: center; gap: var(--sp-6);
      padding: var(--sp-8); background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-2xl);
      margin-bottom: var(--sp-6); flex-wrap: wrap;
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
      p  { color: var(--t-400); font-size: var(--f-sm); }
    }

    .edit-btn { margin-left: auto; display: inline-flex; align-items: center; gap: var(--sp-2); }

    .avatar-ring { position: relative; flex-shrink: 0; }
    .avatar-inner {
      width: 80px; height: 80px; border-radius: 50%;
      background: var(--g-accent); display: flex; align-items: center; justify-content: center;
      font-size: var(--f-2xl); font-weight: var(--w-8); color: #fff;
    }
    .avatar-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block; }
    .avatar-ring__pulse {
      position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid var(--c-accent); opacity: .4;
      animation: pulseRing 2s ease-out infinite;
    }

    .perfil-stats {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); margin-bottom: var(--sp-8);
      @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
    }

    .rs-stat {
      padding: var(--sp-5); display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-3);
    }
    .rs-stat__icon {
      width: 40px; height: 40px; border-radius: var(--r-xl);
      display: flex; align-items: center; justify-content: center;
    }
    .rs-stat__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .rs-stat__label { font-size: var(--f-xs); color: var(--t-400); }

    .perfil-grid {
      display: grid; grid-template-columns: 1fr 360px; gap: var(--sp-6);
      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    .perfil-section { h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); } }
    .section-row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); }
    .rs-link { color: var(--c-accent); font-size: var(--f-sm); text-decoration: none; }

    .mini-reserva {
      display: grid; grid-template-columns: 56px 1fr auto auto;
      gap: var(--sp-3); align-items: center; padding: var(--sp-3) var(--sp-4);
      img { width: 56px; height: 44px; object-fit: cover; border-radius: var(--r-md); }
      strong { display: block; font-size: var(--f-sm); color: var(--t-100); }
      span { font-size: var(--f-xs); color: var(--t-400); }
    }

    .mascotas-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--sp-4);
    }
    .mascota-card {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4);
      text-decoration: none; transition: border-color var(--d-2);
      &:hover { border-color: var(--c-accent); }
    }
    .mascota-card__avatar {
      width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
      background: var(--c-raised); display: flex; align-items: center; justify-content: center;
      font-size: var(--f-xl); overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .mascota-card__info { min-width: 0; strong { display: block; font-size: var(--f-sm); color: var(--t-100); } span { font-size: var(--f-xs); color: var(--t-400); } }
    .mascota-card--add { justify-content: center; color: var(--c-accent); font-size: var(--f-sm); font-weight: var(--w-6); border-style: dashed; }

    .config-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .config-item {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4); text-decoration: none;
      transition: border-color var(--d-2); cursor: pointer;
      &:hover { border-color: var(--c-accent); }
    }
    .config-item__icon {
      width: 36px; height: 36px; border-radius: var(--r-lg);
      background: var(--c-raised); display: flex; align-items: center; justify-content: center;
      color: var(--t-300); flex-shrink: 0;
    }
    .config-item__label { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .config-item__sub { font-size: var(--f-xs); color: var(--t-400); }

    @keyframes pulseRing {
      0%   { transform: scale(1);  opacity: .4; }
      50%  { transform: scale(1.08); opacity: .15; }
      100% { transform: scale(1);  opacity: .4; }
    }
  `],
})
export class PerfilDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly reservasService = inject(ReservasService);
  private readonly perrosService = inject(PerrosService);
  private readonly favoritosService = inject(FavoritosService);

  readonly usuario = this.authService.usuario;

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  readonly avatarUrl = computed(() =>
    (this.usuario() as unknown as { avatarUrl?: string })?.avatarUrl ?? null
  );

  readonly stats = signal<StatItem[]>([
    { icon: 'calendar', iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)', value: '0', label: 'Reservas totales' },
    { icon: 'check-circle', iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: '0', label: 'Servicios disfrutados' },
    { icon: 'paw', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: '0', label: 'Mis mascotas' },
    { icon: 'heart', iconColor: '#E11D48', iconBg: 'rgba(225,29,72,.12)', value: '0', label: 'Favoritos' },
  ]);

  readonly reservasRecientes = signal<MiniReserva[]>([]);
  readonly mascotas = signal<PerroApi[]>([]);

  readonly configItems: ConfigItem[] = [
    { icon: 'paw',         label: 'Mis mascotas',        sub: 'Ficha inteligente de tus mascotas', ruta: '/perros' },
    { icon: 'heart',       label: 'Favoritos',           sub: 'Servicios que has guardado',        ruta: '/favoritos' },
    { icon: 'user',        label: 'Datos personales',   sub: 'Nombre, email, teléfono',   ruta: '/perfil/editar' },
    { icon: 'lock',        label: 'Seguridad',           sub: 'Contraseña y acceso',       ruta: '/perfil/seguridad' },
    { icon: 'bell',        label: 'Notificaciones',      sub: 'Email, WhatsApp, push',     ruta: '/perfil/notificaciones' },
    { icon: 'credit-card', label: 'Métodos de pago',     sub: 'Tarjetas y pagos',          ruta: '/perfil/pagos' },
    { icon: 'star',        label: 'Mis reseñas',          sub: 'Reseñas que has escrito',  ruta: '/perfil/resenas' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const [apiReservas, misMascotas] = await Promise.all([
        this.reservasService.misReservas(),
        this.perrosService.misPerros().catch(() => [] as PerroApi[]),
        this.favoritosService.cargarIds(),
      ]);
      const completadas = apiReservas.filter(r => r.estado === 'completada').length;
      this.mascotas.set(misMascotas);
      this.stats.set([
        { icon: 'calendar',    iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)',  value: String(apiReservas.length),            label: 'Reservas totales' },
        { icon: 'check-circle',iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: String(completadas),                    label: 'Servicios disfrutados' },
        { icon: 'paw',         iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: String(misMascotas.length),             label: 'Mis mascotas' },
        { icon: 'heart',       iconColor: '#E11D48', iconBg: 'rgba(225,29,72,.12)',  value: String(this.favoritosService.count()), label: 'Favoritos' },
      ]);
      this.reservasRecientes.set(apiReservas.slice(0, 3).map(r => this.toMini(r)));
    } catch {
      // API unavailable — keep zero-state
    }
  }

  private toMini(r: ReservaApi): MiniReserva {
    const badgeMap: Record<string, string> = {
      confirmada: 'rs-badge--success',
      pendiente:  'rs-badge--warning',
      cancelada:  'rs-badge--danger',
      completada: 'rs-badge--accent',
    };
    const estadoLabel: Record<string, string> = {
      confirmada: 'Confirmada', pendiente: 'Pendiente',
      cancelada: 'Cancelada', completada: 'Completada',
    };
    const verticalLabel: Record<string, string> = {
      hoteles: 'Hotel', vuelos: 'Vuelo', taxis: 'Taxi', transporte: 'Transporte', guarderia: 'Guardería',
    };
    return {
      codigo: r.codigo,
      titulo: (r.detalle?.['titulo'] as string) ?? `${verticalLabel[r.vertical] ?? r.vertical} · ${r.codigo}`,
      fecha: new Date(r.fechaInicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      imagen: hotelImage(0, 200),
      estado: estadoLabel[r.estado] ?? r.estado,
      badgeClass: badgeMap[r.estado] ?? '',
    };
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
