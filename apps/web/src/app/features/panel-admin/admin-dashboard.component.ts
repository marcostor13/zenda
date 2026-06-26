import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="admin-layout">

    <!-- SIDEBAR -->
    <aside class="admin-sidebar">
      <div class="admin-sidebar__title">
        <span class="rs-badge rs-badge--danger">ADMIN</span>
        Panel de control
      </div>

      <nav>
        @for (section of navSections; track section.title) {
          <div class="nav-section">
            <div class="nav-section__title">{{ section.title }}</div>
            @for (item of section.items; track item.ruta) {
              <a [routerLink]="item.ruta" class="admin-nav-item" [class.active]="item.active">
                <span>{{ item.icon }}</span>
                <span>{{ item.label }}</span>
                @if (item.badge) {
                  <span class="rs-badge rs-badge--danger" style="margin-left:auto">{{ item.badge }}</span>
                }
              </a>
            }
          </div>
        }
      </nav>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main">

      <div class="admin-header">
        <div>
          <h1>Panel Administrativo</h1>
          <p>Zenda · Junio 2026</p>
        </div>
        <div style="display:flex;gap:var(--sp-3)">
          <button class="rs-btn rs-btn--secondary rs-btn--sm">📤 Exportar CSV</button>
          <button class="rs-btn rs-btn--primary rs-btn--sm">📊 Reportes</button>
        </div>
      </div>

      <!-- KPIs GLOBALES -->
      <div class="admin-kpi-grid">
        @for (kpi of globalKpis; track kpi.label) {
          <div class="admin-kpi rs-card">
            <div class="admin-kpi__top">
              <span class="admin-kpi__icon" [style]="'background:' + kpi.color">{{ kpi.icon }}</span>
              <div class="admin-kpi__trend" [class.up]="kpi.trendUp">
                {{ kpi.trendUp ? '↑' : '↓' }} {{ kpi.trend }}
              </div>
            </div>
            <div class="admin-kpi__value">{{ kpi.value }}</div>
            <div class="admin-kpi__label">{{ kpi.label }}</div>
          </div>
        }
      </div>

      <!-- REPORTE FINANCIERO -->
      <div class="rs-card">
        <div class="panel-header">
          <h3>Reporte financiero — Junio 2026</h3>
          <div style="display:flex;gap:var(--sp-2)">
            @for (v of ['Total', 'Hoteles', 'Taxis', 'Vuelos', 'Transporte', 'Guardería']; track v) {
              <button class="rs-btn rs-btn--ghost rs-btn--xs"
                      [class.active]="verticalFin() === v"
                      (click)="verticalFin.set(v)">{{ v }}</button>
            }
          </div>
        </div>

        <div class="fin-report-grid">
          @for (col of financieroReport; track col.label) {
            <div class="fin-col">
              <div class="fin-col__label">{{ col.label }}</div>
              <div class="fin-col__value" [style]="col.color ? 'color:'+col.color : ''">{{ col.value }}</div>
              <div class="fin-col__sub">{{ col.sub }}</div>
            </div>
          }
        </div>
      </div>

      <!-- FILA: Comercios pendientes + Actividad reciente -->
      <div class="admin-row">

        <!-- COMERCIOS PENDIENTES -->
        <div class="rs-card">
          <div class="panel-header">
            <h3>Comercios pendientes de aprobación</h3>
            <span class="rs-badge rs-badge--danger">{{ comerciosPendientes().length }}</span>
          </div>

          <div class="comercios-list">
            @for (c of comerciosPendientes(); track c.id) {
              <div class="comercio-item">
                <div class="comercio-item__avatar">{{ c.inicial }}</div>
                <div class="comercio-item__info">
                  <strong>{{ c.nombre }}</strong>
                  <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-1);flex-wrap:wrap">
                    <span class="rs-badge rs-badge--purple">{{ c.vertical }}</span>
                    <span style="font-size:var(--f-xs);color:var(--t-400)">NIF {{ c.nif }}</span>
                  </div>
                </div>
                <div style="display:flex;gap:var(--sp-2)">
                  <button class="rs-btn rs-btn--sm" style="background:var(--c-teal);color:#000;font-weight:600"
                          (click)="aprobarComercio(c.id)">✓ Aprobar</button>
                  <button class="rs-btn rs-btn--danger rs-btn--sm"
                          (click)="rechazarComercio(c.id)">✗</button>
                </div>
              </div>
            }

            @if (comerciosPendientes().length === 0) {
              <div style="text-align:center;padding:var(--sp-10);color:var(--t-400)">
                ✓ Sin comercios pendientes
              </div>
            }
          </div>
        </div>

        <!-- RESERVAS RECIENTES (GLOBAL) -->
        <div class="rs-card">
          <div class="panel-header">
            <h3>Últimas reservas</h3>
            <a routerLink="/admin/reservas" class="rs-link">Ver todas →</a>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            @for (r of ultimasReservas; track $index) {
              <div class="ultima-reserva">
                <span class="ultima-reserva__emoji">{{ r.emoji }}</span>
                <div class="ultima-reserva__info">
                  <div>{{ r.huesped }} · <strong>{{ r.servicio }}</strong></div>
                  <div>€{{ r.total }} · {{ r.hora }}</div>
                </div>
                <span class="{{ 'rs-badge ' + r.badgeClass }}">{{ r.estado }}</span>
              </div>
            }
          </div>
        </div>

      </div>

      <!-- CONFIGURACIÓN DE COMISIONES -->
      <div class="rs-card">
        <div class="panel-header">
          <h3>Configuración de comisiones por vertical</h3>
          <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="guardarComisiones()">
            💾 Guardar cambios
          </button>
        </div>

        <div class="comisiones-table">
          <div class="comisiones-head">
            <span>Vertical</span>
            <span>Comisión (%)</span>
            <span>Fee Stripe</span>
            <span>Estado</span>
          </div>
          @for (c of comisiones; track c.vertical) {
            <div class="comisiones-row">
              <span class="comision-vertical">{{ c.emoji }} {{ c.vertical }}</span>
              <div style="display:flex;align-items:center;gap:var(--sp-2)">
                <input type="number" class="rs-inp" style="width:80px;text-align:center"
                       [value]="c.pct" (input)="c.pct = +$any($event).target.value" />
                <span style="color:var(--t-400)">%</span>
              </div>
              <span style="color:var(--t-400);font-size:var(--f-sm)">1.5% + €0.25</span>
              <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer">
                <input type="checkbox" [checked]="c.activo" (change)="c.activo = !c.activo"
                       style="accent-color:var(--c-accent)" />
                <span class="rs-badge" [class]="c.activo ? 'rs-badge--success' : 'rs-badge--warning'">
                  {{ c.activo ? 'Activo' : 'Pausado' }}
                </span>
              </label>
            </div>
          }
        </div>

        @if (guardadoMsg()) {
          <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">
            ✓ Comisiones actualizadas exitosamente
          </div>
        }
      </div>

    </main>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .admin-layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 64px); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .admin-sidebar {
      background: var(--c-card);
      border-right: 1px solid var(--b-1);
      padding: var(--sp-6);
      position: sticky;
      top: 64px;
      height: calc(100vh - 64px);
      overflow-y: auto;

      @media (max-width: 1024px) { display: none; }
    }

    .admin-sidebar__title { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; margin-bottom: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-2); }

    .nav-section { margin-bottom: var(--sp-6); }
    .nav-section__title { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .08em; margin-bottom: var(--sp-2); padding: 0 var(--sp-4); }

    .admin-nav-item {
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

    .admin-main { padding: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-6); }

    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); } p { color: var(--t-400); } }

    .admin-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); @media (max-width: 1280px) { grid-template-columns: repeat(3, 1fr); } @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }

    .admin-kpi { padding: var(--sp-5); }
    .admin-kpi__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .admin-kpi__icon { width: 36px; height: 36px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; font-size: 1rem; }
    .admin-kpi__trend { font-size: var(--f-xs); color: var(--t-400); &.up { color: var(--c-teal); } }
    .admin-kpi__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .admin-kpi__label { font-size: var(--f-xs); color: var(--t-400); }

    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } .active { background: var(--c-accent); color: #fff; } }
    .rs-link { color: var(--c-accent); font-size: var(--f-sm); text-decoration: none; }

    .fin-report-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); @media (max-width: 1024px) { grid-template-columns: repeat(3, 1fr); } }
    .fin-col { background: var(--c-raised); border-radius: var(--r-lg); padding: var(--sp-5); }
    .fin-col__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; margin-bottom: var(--sp-2); }
    .fin-col__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .fin-col__sub { font-size: var(--f-xs); color: var(--t-400); }

    .admin-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .comercios-list { display: flex; flex-direction: column; gap: var(--sp-3); }
    .comercio-item { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); flex-wrap: wrap; }
    .comercio-item__avatar { width: 40px; height: 40px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-lg); font-weight: var(--w-7); color: #fff; flex-shrink: 0; }
    .comercio-item__info { flex: 1; strong { font-size: var(--f-sm); color: var(--t-100); } }

    .ultima-reserva { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .ultima-reserva__emoji { font-size: 1.25rem; }
    .ultima-reserva__info { flex: 1; font-size: var(--f-sm); color: var(--t-300); div:first-child { color: var(--t-100); margin-bottom: 2px; } strong { color: var(--t-100); } }

    .comisiones-table { background: var(--c-raised); border-radius: var(--r-xl); overflow: hidden; }
    .comisiones-head { display: grid; grid-template-columns: 1fr 160px 180px 120px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); }
    .comisiones-row { display: grid; grid-template-columns: 1fr 160px 180px 120px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } &:hover { background: var(--c-card); } }
    .comision-vertical { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
  `],
})
export class AdminDashboardComponent {
  readonly verticalFin = signal('Total');
  readonly guardadoMsg = signal(false);

  readonly globalKpis = [
    { icon: '💰', label: 'GMV total',       value: '€84,320', trend: '+22%', trendUp: true,  color: 'rgba(84,114,248,.2)' },
    { icon: '🏆', label: 'Ingresos netos',  value: '€11,240', trend: '+18%', trendUp: true,  color: 'rgba(0,201,177,.2)' },
    { icon: '📅', label: 'Reservas totales',value: '412',        trend: '+34',  trendUp: true,  color: 'rgba(155,92,246,.2)' },
    { icon: '🏪', label: 'Comercios activos',value: '38',        trend: '+5',   trendUp: true,  color: 'rgba(250,204,21,.2)' },
    { icon: '👥', label: 'Usuarios nuevos', value: '1,204',      trend: '+14%', trendUp: true,  color: 'rgba(248,113,113,.2)' },
  ];

  readonly financieroReport = [
    { label: 'GMV',                  value: '€84,320', sub: 'Valor bruto reservas',    color: '' },
    { label: 'Ingresos plataforma',  value: '€12,648', sub: 'Comisiones cobradas',     color: 'var(--c-accent)' },
    { label: 'Costos Stripe',        value: '€1,408',  sub: '1.5% + €0.25 c/trx',    color: '#F87171' },
    { label: 'Margen neto',          value: '€11,240', sub: 'Ingresos − Stripe',       color: 'var(--c-teal)' },
    { label: 'Liquidaciones',        value: '€71,672', sub: 'Pagado a comercios',      color: '' },
  ];

  readonly comerciosPendientes = signal([
    { id: 'c1', nombre: 'Hotel Barceló Valencia',   nif: 'B-12345678', vertical: 'Hoteles', inicial: 'H' },
    { id: 'c2', nombre: 'TaxiRapid Madrid',          nif: 'B-23456789', vertical: 'Taxis',   inicial: 'T' },
    { id: 'c3', nombre: 'Guardería Estrellitas',    nif: 'B-34567890', vertical: 'Guardería', inicial: 'G' },
  ]);

  readonly ultimasReservas = [
    { emoji: '🏨', huesped: 'Carlos R.',  servicio: 'Gran Hotel Madrid', total: '756',   hora: 'hace 5 min',  estado: 'Confirmada', badgeClass: 'rs-badge--success' },
    { emoji: '🚗', huesped: 'Ana M.',     servicio: 'TaxiRapid',       total: '95',    hora: 'hace 12 min', estado: 'Confirmada', badgeClass: 'rs-badge--success' },
    { emoji: '🏨', huesped: 'Luis T.',    servicio: 'Belmond Madrid',  total: '2,124', hora: 'hace 28 min', estado: 'Pendiente',  badgeClass: 'rs-badge--warning' },
    { emoji: '✈️', huesped: 'Rosa C.',   servicio: 'Madrid → Barcelona', total: '320',   hora: 'hace 45 min', estado: 'Confirmada', badgeClass: 'rs-badge--success' },
  ];

  comisiones = [
    { vertical: 'Hoteles',     emoji: '🏨', pct: 15, activo: true },
    { vertical: 'Vuelos',      emoji: '✈️', pct: 8,  activo: true },
    { vertical: 'Taxis',       emoji: '🚗', pct: 20, activo: true },
    { vertical: 'Transporte',  emoji: '🚛', pct: 12, activo: true },
    { vertical: 'Guardería',   emoji: '👶', pct: 10, activo: true },
  ];

  readonly navSections = [
    {
      title: 'Visión general',
      items: [
        { icon: '📊', label: 'Dashboard',     ruta: '/admin',             active: true  },
        { icon: '📈', label: 'Reportes',      ruta: '/admin/reportes',    active: false },
      ],
    },
    {
      title: 'Gestión',
      items: [
        { icon: '🏪', label: 'Comercios',     ruta: '/admin/comercios',   active: false, badge: '3' },
        { icon: '👥', label: 'Usuarios',      ruta: '/admin/usuarios',    active: false },
        { icon: '📅', label: 'Reservas',      ruta: '/admin/reservas',    active: false },
        { icon: '💰', label: 'Pagos',         ruta: '/admin/pagos',       active: false },
      ],
    },
    {
      title: 'Plataforma',
      items: [
        { icon: '🏷️', label: 'Comisiones',   ruta: '/admin/comisiones',  active: false },
        { icon: '🎟️', label: 'Cupones',      ruta: '/admin/cupones',     active: false },
        { icon: '🌐', label: 'Verticales',    ruta: '/admin/verticales',  active: false },
        { icon: '⭐', label: 'Reseñas',       ruta: '/admin/resenas',     active: false },
        { icon: '⚙️', label: 'Configuración', ruta: '/admin/config',      active: false },
      ],
    },
  ];

  aprobarComercio(id: string): void {
    this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
  }

  rechazarComercio(id: string): void {
    this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
  }

  guardarComisiones(): void {
    this.guardadoMsg.set(true);
    setTimeout(() => this.guardadoMsg.set(false), 3000);
  }
}
