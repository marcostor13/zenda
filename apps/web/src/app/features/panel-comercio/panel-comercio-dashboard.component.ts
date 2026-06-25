import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';

@Component({
  selector: 'app-panel-comercio-dashboard',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="comercio-layout">

    <!-- SIDEBAR -->
    <aside class="comercio-sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand__logo">🏨</div>
        <div>
          <div class="sidebar-brand__name">Casa Andina</div>
          <div class="sidebar-brand__plan rs-badge rs-badge--accent">Pro</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        @for (item of navItems; track item.ruta) {
          <a [routerLink]="item.ruta"
             class="sidebar-nav__item"
             [class.active]="item.active">
            <span>{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            @if (item.badge) {
              <span class="rs-badge rs-badge--danger" style="margin-left:auto;min-width:20px;text-align:center">
                {{ item.badge }}
              </span>
            }
          </a>
        }
      </nav>
    </aside>

    <!-- MAIN -->
    <main class="comercio-main">

      <!-- HEADER -->
      <div class="comercio-header">
        <div>
          <h1>Dashboard</h1>
          <p>Bienvenido de vuelta · Junio 2026</p>
        </div>
        <div style="display:flex;gap:var(--sp-3)">
          <button class="rs-btn rs-btn--secondary rs-btn--sm">📊 Exportar</button>
          <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">+ Nuevo listado</a>
        </div>
      </div>

      <!-- KPI STATS -->
      <div class="kpi-grid">
        @for (kpi of kpis; track kpi.label) {
          <div class="kpi-card rs-card">
            <div class="kpi-card__header">
              <span class="kpi-card__label">{{ kpi.label }}</span>
              <span class="kpi-card__icon">{{ kpi.icon }}</span>
            </div>
            <div class="kpi-card__value">{{ kpi.value }}</div>
            <div class="kpi-card__trend" [class.up]="kpi.trendUp" [class.down]="!kpi.trendUp">
              {{ kpi.trendUp ? '↑' : '↓' }} {{ kpi.trend }} vs mes anterior
            </div>
          </div>
        }
      </div>

      <!-- FILA: reservas + ingresos -->
      <div class="dashboard-row">

        <!-- RESERVAS RECIENTES -->
        <div class="rs-card dashboard-panel">
          <div class="panel-header">
            <h3>Reservas recientes</h3>
            <a routerLink="/comercio/reservas" class="rs-link">Ver todas →</a>
          </div>

          <table class="rs-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Huésped</th>
                <th>Fechas</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of reservasRecientes; track r.codigo) {
                <tr>
                  <td><code>{{ r.codigo }}</code></td>
                  <td>{{ r.huesped }}</td>
                  <td>{{ r.fechas }}</td>
                  <td>S/ {{ r.total }}</td>
                  <td><span class="rs-badge" [class]="r.badgeClass">{{ r.estado }}</span></td>
                  <td><a [routerLink]="['/comercio/reservas', r.codigo]" class="rs-btn rs-btn--ghost rs-btn--xs">Ver</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- INGRESOS / COMISIONES -->
        <div class="rs-card dashboard-panel">
          <div class="panel-header">
            <h3>Resumen financiero</h3>
            <span class="rs-badge">Junio 2026</span>
          </div>

          @for (fin of financiero; track fin.label) {
            <div class="fin-row">
              <span>{{ fin.label }}</span>
              <strong [style]="fin.color ? 'color:' + fin.color : ''">{{ fin.value }}</strong>
            </div>
          }

          <hr class="rs-hr" style="margin-block:var(--sp-4)">

          <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
            <div style="font-size:var(--f-sm);color:var(--t-400)">Comisión plataforma: 15%</div>
            <div class="fin-row" style="font-size:var(--f-md)">
              <strong style="color:var(--t-100)">Liquidación estimada</strong>
              <strong style="color:var(--c-teal)">S/ 3,422</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- LISTADOS -->
      <div class="rs-card">
        <div class="panel-header" style="margin-bottom:var(--sp-5)">
          <h3>Mis listados</h3>
          <a routerLink="/comercio/listados" class="rs-link">Gestionar →</a>
        </div>

        <div class="listados-grid">
          @for (l of listados(); track l.id) {
            <div class="listado-item">
              <img [src]="l.imagen" [alt]="l.titulo" />
              <div class="listado-item__info">
                <strong>{{ l.titulo }}</strong>
                <p>{{ l.tipo }}</p>
                <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);flex-wrap:wrap">
                  <span class="{{ 'rs-badge ' + l.estadoClass }}">{{ l.estado }}</span>
                  <span class="rs-badge rs-badge--purple">★ {{ l.rating }}</span>
                </div>
              </div>
              <div class="listado-item__actions">
                <a [routerLink]="['/comercio/listados', l.id, 'editar']" class="rs-btn rs-btn--outline rs-btn--xs">Editar</a>
                <button class="rs-btn rs-btn--ghost rs-btn--xs"
                        (click)="togglePausar(l.id)">
                  {{ l.estado === 'Publicado' ? '⏸ Pausar' : '▶ Publicar' }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>

    </main>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .comercio-layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 64px); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .comercio-sidebar {
      background: var(--c-card);
      border-right: 1px solid var(--b-1);
      padding: var(--sp-6);
      position: sticky;
      top: 64px;
      height: calc(100vh - 64px);
      overflow-y: auto;

      @media (max-width: 1024px) { display: none; }
    }

    .sidebar-brand { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-8); padding-bottom: var(--sp-6); border-bottom: 1px solid var(--b-1); }
    .sidebar-brand__logo { width: 40px; height: 40px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    .sidebar-brand__name { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }

    .sidebar-nav { display: flex; flex-direction: column; gap: var(--sp-1); }

    .sidebar-nav__item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg);
      color: var(--t-300);
      font-size: var(--f-sm);
      text-decoration: none;
      transition: all var(--d-2);

      &:hover { background: var(--c-raised); color: var(--t-100); }
      &.active { background: var(--c-accent-lo); color: var(--c-accent); }
    }

    .comercio-main { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-6); }

    .comercio-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); } p { color: var(--t-400); } }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card { padding: var(--sp-5); }
    .kpi-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .kpi-card__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .kpi-card__icon { font-size: 1.2rem; }
    .kpi-card__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
    .kpi-card__trend { font-size: var(--f-xs); color: var(--t-400); &.up { color: var(--c-teal); } &.down { color: #F87171; } }

    .dashboard-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .dashboard-panel { padding: var(--sp-5); }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }
    .rs-link { color: var(--c-accent); font-size: var(--f-sm); text-decoration: none; }

    .rs-table { width: 100%; border-collapse: collapse; font-size: var(--f-sm); th { color: var(--t-400); text-align: left; padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--b-1); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; } td { padding: var(--sp-3); border-bottom: 1px solid var(--b-1); color: var(--t-200); } code { font-family: monospace; color: var(--c-accent); } }

    .fin-row { display: flex; justify-content: space-between; font-size: var(--f-sm); padding: var(--sp-2) 0; color: var(--t-300); border-bottom: 1px solid var(--b-1); strong { color: var(--t-100); } &:last-child { border: none; } }

    .listados-grid { display: flex; flex-direction: column; gap: var(--sp-3); }

    .listado-item {
      display: grid;
      grid-template-columns: 80px 1fr auto;
      gap: var(--sp-4);
      align-items: center;
      padding: var(--sp-3);
      background: var(--c-raised);
      border-radius: var(--r-lg);

      img { width: 80px; height: 60px; object-fit: cover; border-radius: var(--r-md); }
      strong { font-size: var(--f-sm); color: var(--t-100); }
      p { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    }

    .listado-item__actions { display: flex; flex-direction: column; gap: var(--sp-2); }
  `],
})
export class PanelComercioDashboardComponent {
  readonly kpis = [
    { icon: '💰', label: 'GMV del mes',   value: 'S/ 4,032', trend: '+18%', trendUp: true },
    { icon: '📅', label: 'Reservas',       value: '23',       trend: '+5',   trendUp: true },
    { icon: '🏨', label: 'Ocupación',      value: '78%',      trend: '+3%',  trendUp: true },
    { icon: '⭐', label: 'Rating promedio',value: '4.8',      trend: '+0.1', trendUp: true },
  ];

  readonly reservasRecientes = [
    { codigo: 'A1B2',    huesped: 'Carlos R.',   fechas: '15–17 Jul', total: '756',  estado: 'Confirmada', badgeClass: 'rs-badge--success' },
    { codigo: 'C3D4',    huesped: 'María L.',     fechas: '18–20 Jul', total: '1,180', estado: 'Pendiente',  badgeClass: 'rs-badge--warning' },
    { codigo: 'E5F6',    huesped: 'Luis T.',      fechas: '22 Jul',    total: '320',  estado: 'Confirmada', badgeClass: 'rs-badge--success' },
    { codigo: 'G7H8',    huesped: 'Ana G.',       fechas: '25–28 Jul', total: '2,124', estado: 'Confirmada', badgeClass: 'rs-badge--success' },
  ];

  readonly financiero = [
    { label: 'Ingresos brutos',      value: 'S/ 4,032' },
    { label: 'Comisión plataforma',  value: '− S/ 605',  color: '#F87171' },
    { label: 'Fee Stripe',            value: '− S/ 5',    color: '#F87171' },
  ];

  readonly listados = signal([
    { id: 'l1', titulo: 'Suite Premium Vista al Mar', tipo: '2 hab disponibles', imagen: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200', estado: 'Publicado', estadoClass: 'rs-badge--success', rating: '4.9', activo: true },
    { id: 'l2', titulo: 'Habitación Superior',       tipo: '3 hab disponibles', imagen: 'https://images.unsplash.com/photo-1585503418537-88331351ad99?w=200', estado: 'Publicado', estadoClass: 'rs-badge--success', rating: '4.7', activo: true },
    { id: 'l3', titulo: 'Habitación Económica',      tipo: '0 hab disponibles', imagen: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200', estado: 'Pausado',   estadoClass: 'rs-badge--warning',  rating: '4.5', activo: false },
  ]);

  readonly navItems = [
    { icon: '📊', label: 'Dashboard',   ruta: '/comercio', active: true },
    { icon: '📅', label: 'Reservas',    ruta: '/comercio/reservas', active: false, badge: '3' },
    { icon: '🏨', label: 'Listados',    ruta: '/comercio/listados', active: false },
    { icon: '💰', label: 'Ingresos',    ruta: '/comercio/ingresos', active: false },
    { icon: '⭐', label: 'Reseñas',     ruta: '/comercio/resenas', active: false },
    { icon: '⚙️', label: 'Configuración', ruta: '/comercio/config', active: false },
  ];

  togglePausar(id: string): void {
    this.listados.update(list =>
      list.map(l => l.id === id
        ? { ...l, activo: !l.activo, estado: l.activo ? 'Pausado' : 'Publicado', estadoClass: l.activo ? 'rs-badge--warning' : 'rs-badge--success' }
        : l
      )
    );
  }
}
