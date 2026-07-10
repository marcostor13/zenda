import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { ComercioApiService, MiReserva, MiServicio } from './comercio-api.service';
import { iconoVertical } from './vertical-icon';

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success', pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error', completada: 'rs-badge--accent', no_show: 'rs-badge--neutral',
};

@Component({
  selector: 'app-panel-comercio-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, RsIconComponent],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Bienvenido, {{ nombreComercio() }}</p>
      </div>
      <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">
        <rs-icon name="plus" [size]="15" [stroke]="2"></rs-icon>
        Nuevo listado
      </a>
    </div>

    <!-- KPI GRID -->
    <div class="kpi-grid">
      <div class="kpi-card rs-card">
        <div class="kpi-card__header">
          <span class="kpi-card__label">Ingresos brutos</span>
          <div class="kpi-card__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
            <rs-icon name="trending-up" [size]="17" [stroke]="2"></rs-icon>
          </div>
        </div>
        <div class="kpi-card__value">S/ {{ totalIngresos() | number:'1.0-0' }}</div>
        <div class="kpi-card__trend up">del total de reservas</div>
      </div>
      <div class="kpi-card rs-card">
        <div class="kpi-card__header">
          <span class="kpi-card__label">Reservas</span>
          <div class="kpi-card__icon" style="background:rgba(22,104,227,.12);color:var(--c-accent)">
            <rs-icon name="calendar" [size]="17" [stroke]="2"></rs-icon>
          </div>
        </div>
        <div class="kpi-card__value">{{ reservas().length }}</div>
        <div class="kpi-card__trend up">{{ reservasConfirmadas() }} confirmadas</div>
      </div>
      <div class="kpi-card rs-card">
        <div class="kpi-card__header">
          <span class="kpi-card__label">Listados activos</span>
          <div class="kpi-card__icon" style="background:rgba(109,92,246,.12);color:var(--c-purple)">
            <rs-icon name="tag" [size]="17" [stroke]="2"></rs-icon>
          </div>
        </div>
        <div class="kpi-card__value">{{ serviciosActivos() }}</div>
        <div class="kpi-card__trend">de {{ servicios().length }} totales</div>
      </div>
      <div class="kpi-card rs-card">
        <div class="kpi-card__header">
          <span class="kpi-card__label">Rating promedio</span>
          <div class="kpi-card__icon" style="background:rgba(245,158,11,.12);color:var(--c-amber)">
            <rs-icon name="star" [size]="17" [stroke]="2"></rs-icon>
          </div>
        </div>
        <div class="kpi-card__value">{{ ratingPromedio() || '—' }}</div>
        <div class="kpi-card__trend">entre tus servicios</div>
      </div>
    </div>

    <!-- ROW: reservas + finanzas -->
    <div class="dashboard-row">

      <div class="rs-card dashboard-panel">
        <div class="panel-header">
          <h3>Reservas recientes</h3>
          <a routerLink="/comercio/reservas" class="rs-btn rs-btn--ghost rs-btn--xs">Ver todas</a>
        </div>
        @if (reservas().length === 0) {
          <p style="text-align:center;padding:var(--sp-10);color:var(--t-400)">Sin reservas aún</p>
        } @else {
          <table class="rs-table">
            <thead>
              <tr>
                <th>Código</th><th>Vertical</th><th>Fecha</th><th>Total</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reservasRecientes(); track r._id) {
                <tr>
                  <td><code>{{ r.codigo }}</code></td>
                  <td class="vertical-cell">
                    <rs-icon [name]="iconVertical(r.vertical)" [size]="14" [stroke]="2"></rs-icon>
                    {{ r.vertical }}
                  </td>
                  <td>{{ r.fechaInicio | date:'d MMM yy' }}</td>
                  <td>S/ {{ r.montoTotal | number:'1.0-0' }}</td>
                  <td><span class="rs-badge {{ badgeEstado(r.estado) }}">{{ r.estado }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <div class="rs-card dashboard-panel">
        <div class="panel-header"><h3>Resumen financiero</h3></div>
        <div class="fin-row">
          <span>Ingresos brutos</span><strong>S/ {{ totalIngresos() | number:'1.0-0' }}</strong>
        </div>
        <div class="fin-row">
          <span>Comisión plataforma</span>
          <strong style="color:#B91C1C">− S/ {{ comisionEstimada() | number:'1.0-0' }}</strong>
        </div>
        <div class="fin-row">
          <span>Fee Stripe (est.)</span>
          <strong style="color:#B91C1C">− S/ {{ feeStripe() | number:'1.0-2' }}</strong>
        </div>
        <hr style="border:none;border-top:1px solid var(--b-1);margin-block:var(--sp-4)">
        <div class="fin-row">
          <strong style="color:var(--t-100)">Liquidación estimada</strong>
          <strong style="color:var(--c-teal)">S/ {{ liquidacion() | number:'1.0-0' }}</strong>
        </div>
      </div>

    </div>

    <!-- LISTADOS -->
    <div class="rs-card">
      <div class="panel-header" style="margin-bottom:var(--sp-5)">
        <h3>Mis listados</h3>
        <a routerLink="/comercio/listados" class="rs-btn rs-btn--ghost rs-btn--xs">Ver todos</a>
      </div>
      @if (servicios().length === 0) {
        <div style="text-align:center;padding:var(--sp-10);color:var(--t-400)">
          No tienes listados publicados.<br>
          <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary rs-btn--sm" style="margin-top:var(--sp-4)">
            <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon>
            Crear primer listado
          </a>
        </div>
      } @else {
        <div class="listados-grid">
          @for (l of servicios(); track l._id) {
            <div class="listado-item">
              <div class="listado-img">
                <rs-icon [name]="iconVertical(l.vertical)" [size]="22" [stroke]="1.75"></rs-icon>
              </div>
              <div class="listado-item__info">
                <strong>{{ l.titulo }}</strong>
                <p>S/ {{ l.precioBase | number:'1.0-0' }} · {{ l.vertical }}</p>
                <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2)">
                  <span class="rs-badge {{ estadoServicioBadge(l.estado) }}">{{ l.estado }}</span>
                  @if (l.ratingPromedio) {
                    <span class="rs-badge rs-badge--accent">
                      <rs-icon name="star" [size]="10" [stroke]="2"></rs-icon>
                      {{ l.ratingPromedio | number:'1.1-1' }}
                    </span>
                  }
                </div>
              </div>
              <div class="listado-item__actions">
                <button class="rs-btn rs-btn--ghost rs-btn--xs" (click)="toggleServicio(l)">
                  @if (l.estado === 'publicado') {
                    <rs-icon name="pause" [size]="13" [stroke]="2"></rs-icon> Pausar
                  } @else {
                    <rs-icon name="play" [size]="13" [stroke]="2"></rs-icon> Publicar
                  }
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: var(--sp-4); @media (max-width:1024px) { grid-template-columns: repeat(2,1fr); } }
    .kpi-card { padding: var(--sp-5); }
    .kpi-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .kpi-card__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .kpi-card__icon { width: 36px; height: 36px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; }
    .kpi-card__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
    .kpi-card__trend { font-size: var(--f-xs); color: var(--t-400); &.up { color: var(--c-teal); } }

    .dashboard-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--sp-5); @media (max-width:1024px) { grid-template-columns: 1fr; } }
    .dashboard-panel { padding: var(--sp-5); }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }

    .rs-table { width:100%; border-collapse:collapse; font-size:var(--f-sm); th { color:var(--t-400); text-align:left; padding:var(--sp-2) var(--sp-3); border-bottom:1px solid var(--b-1); font-size:var(--f-xs); text-transform:uppercase; letter-spacing:.06em; } td { padding:var(--sp-3); border-bottom:1px solid var(--b-1); color:var(--t-200); } &:last-child td { border:none; } code { font-family:monospace; color:var(--c-accent); } }
    .vertical-cell { display:flex; align-items:center; gap:var(--sp-2); text-transform:capitalize; }

    .fin-row { display:flex; justify-content:space-between; font-size:var(--f-sm); padding:var(--sp-2) 0; color:var(--t-300); border-bottom:1px solid var(--b-1); strong { color:var(--t-100); } &:last-child { border:none; } }

    .listados-grid { display:flex; flex-direction:column; gap:var(--sp-3); }
    .listado-item { display:grid; grid-template-columns:56px 1fr auto; gap:var(--sp-4); align-items:center; padding:var(--sp-3); background:var(--c-raised); border-radius:var(--r-lg); strong { font-size:var(--f-sm); color:var(--t-100); } p { font-size:var(--f-xs); color:var(--t-400); margin-top:var(--sp-1); } }
    .listado-img { width:56px; height:48px; border-radius:var(--r-md); background:var(--c-accent-lo); color:var(--c-accent); display:flex; align-items:center; justify-content:center; }
    .listado-item__actions { display:flex; gap:var(--sp-2); }
  `],
})
export class PanelComercioDashboardComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly authService = inject(AuthService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly reservas = signal<MiReserva[]>([]);
  readonly servicios = signal<MiServicio[]>([]);

  readonly nombreComercio = computed(() => this.authService.usuario()?.nombre ?? 'tu comercio');
  readonly reservasRecientes = computed(() => this.reservas().slice(0, 5));
  readonly reservasConfirmadas = computed(() => this.reservas().filter(r => r.estado === 'confirmada').length);
  readonly totalIngresos = computed(() => this.reservas().reduce((s, r) => s + r.montoTotal, 0));
  readonly serviciosActivos = computed(() => this.servicios().filter(s => s.estado === 'publicado').length);
  readonly ratingPromedio = computed(() => {
    const con = this.servicios().filter(s => s.ratingPromedio);
    if (!con.length) return null;
    return (con.reduce((s, srv) => s + (srv.ratingPromedio ?? 0), 0) / con.length).toFixed(1);
  });
  readonly comisionEstimada = computed(() => this.totalIngresos() * 0.15);
  readonly feeStripe = computed(() => this.totalIngresos() * 0.029 + 1.1);
  readonly liquidacion = computed(() => this.totalIngresos() - this.comisionEstimada() - this.feeStripe());

  async ngOnInit(): Promise<void> {
    try {
      const [reservas, servicios] = await Promise.all([
        firstValueFrom(this.comercioApi.getMisReservas()),
        firstValueFrom(this.comercioApi.getMisServicios()),
      ]);
      this.reservas.set(reservas);
      this.servicios.set(servicios);
    } catch {
      this.errorMsg.set('Error al cargar los datos. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  iconVertical(v: string): string { return iconoVertical(v); }
  badgeEstado(e: string): string { return ESTADO_BADGE[e] ?? 'rs-badge--neutral'; }
  estadoServicioBadge(e: string): string {
    if (e === 'publicado') return 'rs-badge--success';
    if (e === 'pausado') return 'rs-badge--warning';
    return 'rs-badge--neutral';
  }

  async toggleServicio(servicio: MiServicio): Promise<void> {
    const nuevoEstado = servicio.estado === 'publicado' ? 'pausado' : 'publicado';
    try {
      const actualizado = await firstValueFrom(this.comercioApi.cambiarEstadoServicio(servicio._id, nuevoEstado));
      this.servicios.update(list => list.map(s => s._id === servicio._id ? { ...s, estado: actualizado.estado } : s));
    } catch {
      this.errorMsg.set('Error al cambiar el estado del servicio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }
}
