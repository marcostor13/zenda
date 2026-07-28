import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { hotelImage, IMG_FALLBACK } from '../../shared/media/images';
import { ReservasService, ReservaApi, RecordatorioApi, PuntosApi, ProximaReservaApi } from '../reservas/services/reservas.service';
import { PerrosService, PerroApi } from '../perros/perros.service';
import { FavoritosService } from '../favoritos/favoritos.service';
import { AlphaService, AlphaEstadoApi } from '../alpha/alpha.service';

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
        <h1>👋 Hola, {{ primerNombre() }}</h1>
        <p>Bienvenido de nuevo a Doogking</p>
        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-3)">
          <span class="rs-badge rs-badge--success">✔ Cliente verificado</span>
          <span class="rs-badge">Miembro desde 2026</span>
        </div>
      </div>

      <a routerLink="/perfil/editar" class="rs-btn rs-btn--secondary edit-btn">
        <rs-icon name="pencil" [size]="14" [stroke]="2"></rs-icon>
        Editar perfil
      </a>
    </div>

    <!-- PRÓXIMA RESERVA (HU-7.3) -->
    @if (proximaReserva(); as pr) {
      <a [routerLink]="['/reservas', pr.codigo]" class="rs-card proxima-reserva">
        <img [src]="pr.imagen || fallbackImg" [alt]="pr.titulo" rsImg />
        <div class="proxima-reserva__info">
          <span class="proxima-reserva__eyebrow">📅 Tu próxima reserva</span>
          <strong>{{ pr.titulo }}</strong>
          <span class="proxima-reserva__meta">
            @if (pr.ciudad) { 📍 {{ pr.ciudad }} · }
            Dentro de {{ diasFaltantes(pr.fechaInicio) }} {{ diasFaltantes(pr.fechaInicio) === 1 ? 'día' : 'días' }}
          </span>
        </div>
        <span class="rs-btn rs-btn--primary rs-btn--sm">Ver reserva</span>
      </a>
    }

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
                @if (m.fotos.length) {
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

    <!-- DOOGKING ALPHA (HU-13.2) -->
    @if (alpha(); as a) {
      <div class="rs-card alpha-card">
        <div class="alpha-card__head">
          <span class="alpha-card__crown">👑</span>
          <div class="alpha-card__texto">
            <span class="alpha-card__nivel">{{ a.nombreNivel }}</span>
            <span class="alpha-card__estado">
              @if (a.esMaximoNivel) {
                Has alcanzado el máximo nivel
              } @else {
                Solo te faltan {{ a.reservasParaSiguiente }} reserva{{ a.reservasParaSiguiente === 1 ? '' : 's' }} para desbloquear {{ a.siguienteNivel?.nombre }}
              }
            </span>
          </div>
          <a routerLink="/perfil/alpha" class="alpha-card__cta">Ver ventajas Alpha →</a>
        </div>
        <div class="alpha-bar"><div class="alpha-bar__fill" [style.width.%]="progresoAlpha()"></div></div>
        @if (a.beneficios.length > 0) {
          <div class="alpha-card__beneficios">
            @for (b of a.beneficios; track b) {
              <span class="rs-badge rs-badge--neutral">{{ b }}</span>
            }
          </div>
        }
        <p class="alpha-card__progreso">✔ {{ a.reservasCompletadas }} reserva{{ a.reservasCompletadas === 1 ? '' : 's' }} completada{{ a.reservasCompletadas === 1 ? '' : 's' }}</p>
      </div>
    }

    <!-- PRÓXIMOS RECORDATORIOS -->
    @if (recordatorios().length) {
      <div class="perfil-section" style="margin-bottom:var(--sp-8)">
        <h2>🔔 Próximos recordatorios</h2>
        <div class="recordatorios-list">
          @for (r of recordatorios(); track r.mensaje) {
            <a [routerLink]="r.ruta" class="recordatorio rs-card">
              <span class="recordatorio__icon">{{ r.icono }}</span>
              <span class="recordatorio__msg">{{ r.mensaje }}</span>
              <span class="recordatorio__cta">Reservar →</span>
            </a>
          }
        </div>
      </div>
    }

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
            <a routerLink="/" class="rs-btn rs-btn--primary rs-btn--sm" style="margin-top:var(--sp-4)">
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

    .proxima-reserva {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5); margin-bottom: var(--sp-8);
      text-decoration: none;
      background: var(--g-accent); color: #fff;
      border: none;
      img { width: 72px; height: 56px; object-fit: cover; border-radius: var(--r-md); flex-shrink: 0; }
    }
    .proxima-reserva__info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .proxima-reserva__eyebrow { font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; opacity: .85; }
    .proxima-reserva__info strong { font-size: var(--f-lg); font-weight: var(--w-7); }
    .proxima-reserva__meta { font-size: var(--f-sm); opacity: .9; }

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

    .alpha-card {
      padding: var(--sp-6); margin-bottom: var(--sp-8); border: none; color: #fff;
      background: linear-gradient(135deg, var(--dk-blue, #08258B), var(--dk-blue-deep, #00135D) 55%, var(--dk-gold, #FBAE17));
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.25));
    }
    .alpha-card__head { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-4); }
    .alpha-card__crown { font-size: 32px; line-height: 1; }
    .alpha-card__texto { display: flex; flex-direction: column; gap: 2px; }
    .alpha-card__nivel { font-size: var(--f-lg); font-weight: var(--w-8); }
    .alpha-card__estado { font-size: var(--f-sm); opacity: .92; }
    .alpha-card__cta { margin-left: auto; color: #fff; font-size: var(--f-sm); font-weight: var(--w-6); text-decoration: none; white-space: nowrap; &:hover { text-decoration: underline; } }
    .alpha-bar { height: 10px; background: rgba(255,255,255,.25); border-radius: var(--r-full); overflow: hidden; margin-bottom: var(--sp-4); }
    .alpha-bar__fill { height: 100%; background: #fff; border-radius: var(--r-full); transition: width .4s; }
    .alpha-card__beneficios { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-3); .rs-badge { background: rgba(255,255,255,.18); color: #fff; border: none; } }
    .alpha-card__progreso { font-size: var(--f-xs); opacity: .85; }

    .recordatorios-list { display: flex; flex-direction: column; gap: var(--sp-3); }
    .recordatorio {
      display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4);
      text-decoration: none; border-left: 3px solid var(--c-amber, #FBAE17);
      transition: border-color var(--d-2);
      &:hover { border-color: var(--c-accent); }
    }
    .recordatorio__icon { font-size: var(--f-xl); }
    .recordatorio__msg { flex: 1; font-size: var(--f-sm); color: var(--t-100); }
    .recordatorio__cta { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--c-accent); white-space: nowrap; }

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
  private readonly alphaService = inject(AlphaService);

  readonly usuario = this.authService.usuario;

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  readonly avatarUrl = computed(() =>
    (this.usuario() as unknown as { avatarUrl?: string })?.avatarUrl ?? null
  );

  readonly primerNombre = computed(() => (this.usuario()?.nombre ?? 'Mi perfil').split(' ')[0]);
  readonly fallbackImg = IMG_FALLBACK;
  readonly proximaReserva = signal<ProximaReservaApi | null>(null);

  /** Días naturales hasta la fecha de la reserva (HU-7.3), nunca negativo. */
  diasFaltantes(fechaInicio: string): number {
    const ms = new Date(fechaInicio).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  readonly stats = signal<StatItem[]>([
    { icon: 'calendar', iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)', value: '0', label: 'Reservas realizadas' },
    { icon: 'check-circle', iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: '0', label: 'Servicios utilizados' },
    { icon: 'paw', iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: '0', label: 'Mis mascotas' },
    { icon: 'heart', iconColor: '#E11D48', iconBg: 'rgba(225,29,72,.12)', value: '0', label: 'Servicios favoritos' },
  ]);

  readonly reservasRecientes = signal<MiniReserva[]>([]);
  readonly mascotas = signal<PerroApi[]>([]);
  readonly recordatorios = signal<RecordatorioApi[]>([]);
  readonly puntos = signal<PuntosApi | null>(null);
  readonly alpha = signal<AlphaEstadoApi | null>(null);

  readonly progresoPuntos = computed(() => {
    const p = this.puntos();
    if (!p || p.proximoUmbral === 0) return 0;
    return Math.round((p.puntos / p.proximoUmbral) * 100);
  });

  readonly progresoAlpha = computed(() => {
    const a = this.alpha();
    if (!a) return 0;
    if (a.esMaximoNivel) return 100;
    const total = a.reservasCompletadas + (a.reservasParaSiguiente ?? 0);
    return total === 0 ? 0 : Math.round((a.reservasCompletadas / total) * 100);
  });

  readonly configItems: ConfigItem[] = [
    { icon: 'paw',         label: 'Ficha inteligente de mis mascotas', sub: 'Datos, salud y comportamiento de tus mascotas', ruta: '/perros' },
    { icon: 'heart',       label: 'Mis favoritos',                     sub: 'Servicios que has guardado',        ruta: '/favoritos' },
    { icon: 'user',        label: 'Información personal',              sub: 'Nombre, email, teléfono',           ruta: '/perfil/editar' },
    { icon: 'lock',        label: 'Seguridad y acceso',                sub: 'Contraseña y acceso',                ruta: '/perfil/seguridad' },
    { icon: 'bell',        label: 'Notificaciones',                    sub: 'Email, WhatsApp, push',              ruta: '/perfil/notificaciones' },
    { icon: 'credit-card', label: 'Métodos de pago guardados',         sub: 'Tarjetas y pagos',                   ruta: '/perfil/pagos' },
    { icon: 'star',        label: 'Mis reseñas',                       sub: 'Reseñas que has escrito',            ruta: '/perfil/resenas' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const [apiReservas, misMascotas, misRecordatorios, misPuntos, miProximaReserva, miAlpha] = await Promise.all([
        this.reservasService.misReservas(),
        this.perrosService.misPerros().catch(() => [] as PerroApi[]),
        this.reservasService.recordatorios().catch(() => [] as RecordatorioApi[]),
        this.reservasService.puntos().catch(() => null),
        this.reservasService.proximaReserva().catch(() => null),
        this.alphaService.miEstado().catch(() => null),
        this.favoritosService.cargarIds(),
      ]);
      this.recordatorios.set(misRecordatorios);
      this.puntos.set(misPuntos);
      this.proximaReserva.set(miProximaReserva);
      this.alpha.set(miAlpha);
      const completadas = apiReservas.filter(r => r.estado === 'completada').length;
      this.mascotas.set(misMascotas);
      this.stats.set([
        { icon: 'calendar',    iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,.12)',  value: String(apiReservas.length),            label: 'Reservas realizadas' },
        { icon: 'check-circle',iconColor: '#10B981', iconBg: 'rgba(16,185,129,.12)', value: String(completadas),                    label: 'Servicios utilizados' },
        { icon: 'paw',         iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,.12)', value: String(misMascotas.length),             label: 'Mis mascotas' },
        { icon: 'heart',       iconColor: '#E11D48', iconBg: 'rgba(225,29,72,.12)',  value: String(this.favoritosService.count()), label: 'Servicios favoritos' },
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
