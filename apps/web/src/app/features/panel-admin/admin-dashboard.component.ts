import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ComisionConfig, ComercioPendiente, UltimaReserva } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const VERTICAL_EMOJI: Record<string, string> = {
  alojamiento: '🏠', transporte: '🚐', veterinaria: '🩺',
  peluqueria: '✂️', adiestramiento: '🎓', hoteles: '🏨', global: '🌐',
};

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success',
  pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error',
  completada: 'rs-badge--accent',
  en_curso: 'rs-badge--accent',
  pago_retenido: 'rs-badge--warning',
  pago_liberado: 'rs-badge--success',
  en_disputa: 'rs-badge--error',
  reembolsada: 'rs-badge--neutral',
  no_show: 'rs-badge--neutral',
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, RsIconComponent],
  template: `
      @if (cargando()) {
        <div style="text-align:center;padding:var(--sp-20);color:var(--t-400)">
          Cargando panel…
        </div>
      } @else {

      <div class="admin-header">
        <div>
          <h1>Panel Administrativo</h1>
          <p>Doogking · Panel de Control</p>
        </div>
        <div style="display:flex;gap:var(--sp-3)">
          <a routerLink="/admin/cupones" class="rs-btn rs-btn--secondary rs-btn--sm">🎟️ Cupones</a>
          <a routerLink="/admin/reportes" class="rs-btn rs-btn--primary rs-btn--sm">📊 Reportes</a>
        </div>
      </div>

      <!-- BARRA DE ALERTAS -->
      @if (totalAlertas() > 0) {
        <div class="admin-alertas">
          <span class="admin-alertas__title">🔴 Atención requerida ({{ totalAlertas() }})</span>
          @if (kpis().verificacionesPendientes > 0) {
            <a routerLink="/admin/comercios" class="admin-alertas__chip">🔔 {{ kpis().verificacionesPendientes }} verificaciones pendientes</a>
          }
          @if (kpis().comerciosPendientesCount > 0) {
            <a routerLink="/admin/comercios" class="admin-alertas__chip">🔔 {{ kpis().comerciosPendientesCount }} comercios por aprobar</a>
          }
          @if (kpis().pagosRetenidosCount > 0) {
            <a routerLink="/admin/reservas" class="admin-alertas__chip">🔔 {{ kpis().pagosRetenidosCount }} pagos retenidos por liberar</a>
          }
          @if (kpis().incidenciasAbiertas > 0) {
            <a routerLink="/admin/reservas" class="admin-alertas__chip">🔔 {{ kpis().incidenciasAbiertas }} incidencias abiertas</a>
          }
        </div>
      }

      <!-- KPIs GLOBALES -->
      <div class="admin-kpi-grid">
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(84,114,248,.18);color:#5472F8">
              <rs-icon name="trending-up" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().gmvMes | number:'1.0-0' }} €</div>
          <div class="admin-kpi__label">Facturación bruta del mes</div>
          <div class="admin-kpi__hint">Importe total gestionado por la plataforma</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="euro" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().ingresosMes | number:'1.0-0' }} €</div>
          <div class="admin-kpi__label">Comisión Doogking del mes</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(155,92,246,.18);color:#9B5CF6">
              <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().totalReservas }}</div>
          <div class="admin-kpi__label">Reservas totales</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(250,204,21,.18);color:#D97706">
              <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().comerciosPendientesCount }}</div>
          <div class="admin-kpi__label">Comercios pendientes</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(248,113,113,.18);color:#F87171">
              <rs-icon name="users" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().totalUsuarios }}</div>
          <div class="admin-kpi__label">Usuarios registrados</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(250,204,21,.18);color:#D97706">
              <rs-icon name="badge-check" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().verificacionesPendientes }}</div>
          <div class="admin-kpi__label">Verificaciones pendientes</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().nuevosComerciosMes }}</div>
          <div class="admin-kpi__label">Nuevos comercios (mes)</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(155,92,246,.18);color:#9B5CF6">
              <rs-icon name="paw" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().mascotasRegistradas | number:'1.0-0' }}</div>
          <div class="admin-kpi__label">Mascotas registradas</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(248,113,113,.18);color:#F87171">
              <rs-icon name="percent" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().tasaCancelacionMes }} %</div>
          <div class="admin-kpi__label">Cancelaciones del mes</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="euro" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().pagosRetenidosMonto | number:'1.0-0' }} €</div>
          <div class="admin-kpi__label">Pagos retenidos ({{ kpis().pagosRetenidosCount }})</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(248,113,113,.18);color:#F87171">
              <rs-icon name="alert-circle" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().incidenciasAbiertas }}</div>
          <div class="admin-kpi__label">Incidencias abiertas</div>
        </div>
      </div>

      <!-- FILA: Comercios pendientes + Actividad reciente -->
      <div class="admin-row">

        <!-- COMERCIOS PENDIENTES -->
        <div class="rs-card admin-panel">
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
                    <span class="rs-badge rs-badge--accent" style="display:inline-flex;align-items:center;gap:4px">
                    <rs-icon [name]="iconVertical(c.vertical)" [size]="11" [stroke]="2"></rs-icon>
                    {{ c.vertical }}
                  </span>
                    <span style="font-size:var(--f-xs);color:var(--t-400)">RUC {{ c.nif }}</span>
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
        <div class="rs-card admin-panel">
          <div class="panel-header">
            <h3>Últimas reservas</h3>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            @for (r of ultimasReservas(); track r.id) {
              <div class="ultima-reserva">
                <span class="ultima-reserva__icon">
                  <rs-icon [name]="iconVertical(r.vertical)" [size]="18" [stroke]="1.5"></rs-icon>
                </span>
                <div class="ultima-reserva__info">
                  <div><strong>{{ r.codigo }}</strong> · {{ r.comercio }}</div>
                  <div>{{ r.cliente }} · {{ r.montoTotal }} € · {{ (r.fechaServicio || r.createdAt) | date:'d MMM, HH:mm' }}</div>
                </div>
                <span class="{{ 'rs-badge ' + badgeEstado(r.estado) }}">{{ r.estado }}</span>
              </div>
            }
            @if (ultimasReservas().length === 0) {
              <div style="text-align:center;padding:var(--sp-6);color:var(--t-400)">Sin reservas aún</div>
            }
          </div>
        </div>

      </div>

      <!-- CONFIGURACIÓN DE COMISIONES -->
      <div class="rs-card admin-panel">
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
            <span>Comisión total</span>
            <span>Estado</span>
          </div>
          @for (c of comisiones(); track c.vertical) {
            <div class="comisiones-row">
              <span class="comision-vertical">{{ emojiVertical(c.vertical) }} {{ c.vertical }}</span>
              <div style="display:flex;align-items:center;gap:var(--sp-2)">
                <input type="number" class="rs-inp" style="width:80px;text-align:center"
                       [value]="(c.comisionPct * 100).toFixed(0)"
                       (input)="actualizarPct(c, +$any($event).target.value)" />
                <span style="color:var(--t-400)">%</span>
              </div>
              <span style="color:var(--t-400);font-size:var(--f-sm)">
                {{ (c.stripePct * 100).toFixed(1) }}% + {{ c.stripeFijoEur.toFixed(2) }} €
              </span>
              <span style="font-weight:var(--w-7);color:var(--t-100);font-size:var(--f-sm)">
                {{ comisionTotal(c) }}%
              </span>
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
        @if (errorMsg()) {
          <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">
            {{ errorMsg() }}
          </div>
        }
      </div>

      } <!-- end @if cargando -->
  `,
  styles: [`
    :host { display: contents; }

    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .admin-header h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .admin-header p { color: var(--t-400); }

    .admin-alertas { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); padding: var(--sp-4) var(--sp-5); background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.3); border-radius: var(--r-xl); }
    .admin-alertas__title { font-weight: var(--w-7); color: var(--t-100); font-size: var(--f-sm); }
    .admin-alertas__chip { font-size: var(--f-xs); color: var(--t-200); background: var(--c-card); border: 1px solid var(--b-1); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full); text-decoration: none; &:hover { border-color: var(--c-accent); } }

    .admin-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); @media (max-width: 1280px) { grid-template-columns: repeat(3, 1fr); } @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }

    .admin-kpi { padding: var(--sp-5); }
    .admin-kpi__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .admin-kpi__icon { width: 36px; height: 36px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; }
    .admin-kpi__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .admin-kpi__label { font-size: var(--f-xs); color: var(--t-400); }
    .admin-kpi__hint { font-size: 10px; color: var(--t-500, var(--t-400)); margin-top: 2px; line-height: 1.3; }

    .admin-panel { padding: var(--sp-6); }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }

    .admin-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .comercios-list { display: flex; flex-direction: column; gap: var(--sp-3); }
    .comercio-item { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); flex-wrap: wrap; }
    .comercio-item__avatar { width: 40px; height: 40px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-lg); font-weight: var(--w-7); color: #fff; flex-shrink: 0; }
    .comercio-item__info { flex: 1; strong { font-size: var(--f-sm); color: var(--t-100); } }

    .ultima-reserva { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .ultima-reserva__icon { width: 34px; height: 34px; border-radius: var(--r-lg); background: var(--c-raised); border: 1px solid var(--b-1); display: flex; align-items: center; justify-content: center; color: var(--t-300); flex-shrink: 0; }
    .ultima-reserva__info { flex: 1; font-size: var(--f-sm); color: var(--t-300); div:first-child { color: var(--t-100); margin-bottom: 2px; } strong { color: var(--t-100); } }

    .comisiones-table { background: var(--c-raised); border-radius: var(--r-xl); overflow: hidden; }
    .comisiones-head { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); }
    .comisiones-row { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } &:hover { background: var(--c-card); } }
    .comision-vertical { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly guardadoMsg = signal(false);
  readonly errorMsg = signal('');

  readonly kpis = signal({
    totalReservas: 0, gmvMes: 0, ingresosMes: 0,
    comerciosPendientesCount: 0, totalUsuarios: 0,
    verificacionesPendientes: 0, nuevosComerciosMes: 0,
    mascotasRegistradas: 0, tasaCancelacionMes: 0,
    pagosRetenidosMonto: 0, pagosRetenidosCount: 0,
    incidenciasAbiertas: 0,
  });
  readonly comerciosPendientes = signal<ComercioPendiente[]>([]);
  readonly ultimasReservas = signal<UltimaReserva[]>([]);
  readonly comisiones = signal<ComisionConfig[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.adminApi.getDashboard());
      this.kpis.set(data.kpis);
      this.comerciosPendientes.set(data.comerciosPendientes);
      this.ultimasReservas.set(data.ultimasReservas);
      this.comisiones.set(data.comisiones);
    } catch {
      this.errorMsg.set('Error cargando el dashboard. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  totalAlertas(): number {
    return this.kpis().verificacionesPendientes + this.kpis().comerciosPendientesCount
      + this.kpis().pagosRetenidosCount + this.kpis().incidenciasAbiertas;
  }

  emojiVertical(vertical: string): string {
    return VERTICAL_EMOJI[vertical] ?? '📋';
  }

  /** Comisión plataforma + fee variable de Stripe, redondeado a 1 decimal (ej. 12% + 1,5% = 13,5%). */
  comisionTotal(comision: ComisionConfig): string {
    return ((comision.comisionPct + comision.stripePct) * 100).toFixed(1).replace('.', ',');
  }

  iconVertical(vertical: string): string {
    const MAP: Record<string, string> = {
      hoteles: 'hotel', vuelos: 'plane', taxis: 'car', transporte: 'truck', guarderia: 'users',
    };
    return MAP[vertical] ?? 'building';
  }

  badgeEstado(estado: string): string {
    return ESTADO_BADGE[estado] ?? 'rs-badge--neutral';
  }

  actualizarPct(comision: ComisionConfig, pct: number): void {
    comision.comisionPct = pct / 100;
  }

  async aprobarComercio(id: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.aprobarComercio(id));
      this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
      this.kpis.update(k => ({ ...k, comerciosPendientesCount: k.comerciosPendientesCount - 1 }));
    } catch {
      this.errorMsg.set('Error al aprobar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  async rechazarComercio(id: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.rechazarComercio(id));
      this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
      this.kpis.update(k => ({ ...k, comerciosPendientesCount: k.comerciosPendientesCount - 1 }));
    } catch {
      this.errorMsg.set('Error al rechazar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  async guardarComisiones(): Promise<void> {
    try {
      const lista = this.comisiones();
      await Promise.all(
        lista.map(c =>
          firstValueFrom(this.adminApi.updateComision({
            vertical: c.vertical,
            comisionPct: c.comisionPct,
            stripePct: c.stripePct,
            stripeFijoEur: c.stripeFijoEur,
            activo: c.activo,
          }))
        )
      );
      this.guardadoMsg.set(true);
      setTimeout(() => this.guardadoMsg.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar las comisiones.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }
}
