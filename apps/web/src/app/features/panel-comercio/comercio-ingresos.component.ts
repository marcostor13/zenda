import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiReserva, FinanzasComercio } from './comercio-api.service';

const COMISION_PCT = 0.15;
const STRIPE_PCT = 0.015;
const STRIPE_FIJO_EUR = 0.25;

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success', pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error', completada: 'rs-badge--accent', no_show: 'rs-badge--neutral',
};

@Component({
  selector: 'app-comercio-ingresos',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, RsIconComponent],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Ingresos</h1>
        <p class="page-sub">Resumen financiero de tu comercio basado en reservas</p>
      </div>
    </div>

    @if (cargando()) {
      <div class="kpi-grid">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="skeleton-kpi"></div>
        }
      </div>
    } @else {
      <!-- KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card rs-card">
          <div class="kpi-card__header">
            <span class="kpi-card__label">Facturación del mes</span>
            <div class="kpi-card__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
              <rs-icon name="trending-up" [size]="17" [stroke]="2"></rs-icon>
            </div>
          </div>
          <div class="kpi-card__value">{{ totalIngresos() | number:'1.0-0' }} €</div>
          <div class="kpi-card__sub">Suma de todas las reservas</div>
        </div>

        <div class="kpi-card rs-card">
          <div class="kpi-card__header">
            <span class="kpi-card__label">Reservas completadas</span>
            <div class="kpi-card__icon" style="background:rgba(16,185,129,.12);color:#047857">
              <rs-icon name="check-circle" [size]="17" [stroke]="2"></rs-icon>
            </div>
          </div>
          <div class="kpi-card__value">{{ reservasCompletadas() }}</div>
          <div class="kpi-card__sub">de {{ reservas().length }} totales</div>
        </div>

        <div class="kpi-card rs-card">
          <div class="kpi-card__header">
            <span class="kpi-card__label">Comisión plataforma (15%)</span>
            <div class="kpi-card__icon" style="background:rgba(239,68,68,.10);color:#B91C1C">
              <rs-icon name="tag" [size]="17" [stroke]="2"></rs-icon>
            </div>
          </div>
          <div class="kpi-card__value kpi-card__value--danger">
            − {{ comisionEstimada() | number:'1.0-0' }} €
          </div>
          <div class="kpi-card__sub">Fee del marketplace</div>
        </div>

        <div class="kpi-card rs-card kpi-card--highlight">
          <div class="kpi-card__header">
            <span class="kpi-card__label">Liquidación estimada</span>
            <div class="kpi-card__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
              <rs-icon name="building" [size]="17" [stroke]="2"></rs-icon>
            </div>
          </div>
          <div class="kpi-card__value kpi-card__value--teal">
            {{ liquidacionEstimada() | number:'1.0-0' }} €
          </div>
          <div class="kpi-card__sub">Ingresos − comisión − Stripe</div>
        </div>
      </div>

      <!-- DESGLOSE FINANCIERO -->
      <div class="rs-card fin-card">
        <h3 class="fin-card__title">Desglose financiero</h3>
        <div class="fin-row">
          <span>Facturación bruta (GMV)</span>
          <strong>{{ totalIngresos() | number:'1.2-2' }} €</strong>
        </div>
        <div class="fin-row fin-row--minus">
          <span>Comisión plataforma (15%)</span>
          <strong>− {{ comisionEstimada() | number:'1.2-2' }} €</strong>
        </div>
        <div class="fin-row fin-row--minus">
          <span>Fee Stripe</span>
          <strong>− {{ feeStripeTotal() | number:'1.2-2' }} €</strong>
        </div>
        @if (reembolsos() > 0) {
          <div class="fin-row fin-row--minus">
            <span>Reembolsos</span>
            <strong>− {{ reembolsos() | number:'1.2-2' }} €</strong>
          </div>
        }
        <hr class="fin-divider">
        <div class="fin-row fin-row--total">
          <strong>Liquidación neta</strong>
          <strong class="fin-total">{{ liquidacionEstimada() | number:'1.2-2' }} €</strong>
        </div>
        @if (proximaLiquidacion() > 0) {
          <div class="fin-row" style="margin-top:var(--sp-2)">
            <span>🏦 Próxima liquidación (servicios prestados pendientes de pago)</span>
            <strong>{{ proximaLiquidacion() | number:'1.2-2' }} €</strong>
          </div>
        }
      </div>

      <!-- TABLA RESERVAS RECIENTES -->
      @if (reservasRecientes().length > 0) {
        <div class="rs-card" style="overflow-x:auto">
          <div class="tabla-header">
            <h3>Reservas recientes</h3>
            <a routerLink="/comercio/reservas" class="rs-btn rs-btn--ghost rs-btn--sm">Ver todas</a>
          </div>
          <table class="rs-table">
            <thead>
              <tr>
                <th>Código</th><th>Vertical</th><th>Fecha</th>
                <th>Monto</th><th>Comisión est.</th><th>Liquidación est.</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reservasRecientes(); track r._id) {
                <tr>
                  <td><code>{{ r.codigo }}</code></td>
                  <td style="text-transform:capitalize">{{ r.vertical }}</td>
                  <td>{{ r.fechaInicio | date:'d MMM yy' }}</td>
                  <td>{{ r.montoTotal | number:'1.2-2' }} €</td>
                  <td class="text-danger">− {{ comisionReserva(r) | number:'1.2-2' }} €</td>
                  <td class="text-teal">{{ liquidacionReserva(r) | number:'1.2-2' }} €</td>
                  <td><span class="rs-badge {{ badgeEstado(r.estado) }}">{{ r.estado }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: var(--sp-4); @media (max-width:1024px) { grid-template-columns: repeat(2,1fr); } @media (max-width:540px) { grid-template-columns: 1fr; } }
    .kpi-card { padding: var(--sp-5); }
    .kpi-card--highlight { border-color: var(--c-teal); }
    .kpi-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .kpi-card__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .kpi-card__icon { width: 36px; height: 36px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; }
    .kpi-card__value { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
    .kpi-card__value--danger { color: #B91C1C; }
    .kpi-card__value--teal { color: var(--c-teal); }
    .kpi-card__sub { font-size: var(--f-xs); color: var(--t-400); }

    .skeleton-kpi { height: 110px; background: linear-gradient(90deg, var(--c-raised) 25%, var(--c-surface) 50%, var(--c-raised) 75%); background-size: 200% 100%; border-radius: var(--r-xl); animation: shimmer 1.5s infinite; }

    .fin-card { padding: var(--sp-6); }
    .fin-card__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }
    .fin-row { display: flex; justify-content: space-between; align-items: center; padding: var(--sp-3) 0; font-size: var(--f-sm); color: var(--t-300); border-bottom: 1px solid var(--b-1); &:last-child { border-bottom: none; } strong { color: var(--t-100); } }
    .fin-row--minus strong { color: #B91C1C; }
    .fin-row--total { font-size: var(--f-md); padding-top: var(--sp-4); }
    .fin-divider { border: none; border-top: 1px solid var(--b-2); margin: var(--sp-2) 0; }
    .fin-total { color: var(--c-teal) !important; font-size: var(--f-lg) !important; }

    .tabla-header { display: flex; justify-content: space-between; align-items: center; padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--b-1); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }

    .rs-table { width: 100%; border-collapse: collapse; font-size: var(--f-sm); th { color: var(--t-400); text-align: left; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--b-1); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; font-weight: var(--w-6); white-space: nowrap; } td { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--b-1); color: var(--t-200); white-space: nowrap; } tr:last-child td { border-bottom: none; } tr:hover td { background: var(--c-raised); } code { font-family: monospace; color: var(--c-accent); background: var(--c-accent-lo); padding: 2px var(--sp-2); border-radius: var(--r-sm); font-size: var(--f-xs); } }
    .text-danger { color: #B91C1C; }
    .text-teal { color: var(--c-teal); }
  `],
})
export class ComercioIngresosComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly reservas = signal<MiReserva[]>([]);
  readonly finanzas = signal<FinanzasComercio | null>(null);

  readonly reservasRecientes = computed(() => this.reservas().slice(0, 10));
  readonly reservasCompletadas = computed(() => this.reservas().filter(r => r.estado === 'completada').length);

  // Cifras reales del backend cuando están disponibles; si no, estimación front.
  readonly totalIngresos = computed(() =>
    this.finanzas()?.facturacionBruta ?? this.reservas().reduce((s, r) => s + r.montoTotal, 0));
  readonly comisionEstimada = computed(() =>
    this.finanzas()?.comisionPlataforma ?? this.totalIngresos() * COMISION_PCT);
  readonly feeStripeTotal = computed(() =>
    this.finanzas()?.stripeFee ?? (this.reservas().length > 0
      ? this.totalIngresos() * STRIPE_PCT + STRIPE_FIJO_EUR * this.reservas().length
      : 0));
  readonly reembolsos = computed(() => this.finanzas()?.reembolsos ?? 0);
  readonly proximaLiquidacion = computed(() => this.finanzas()?.proximaLiquidacion ?? 0);
  readonly liquidacionEstimada = computed(() =>
    this.finanzas()?.liquidacion ?? (this.totalIngresos() - this.comisionEstimada() - this.feeStripeTotal()));

  async ngOnInit(): Promise<void> {
    try {
      const [reservas, finanzas] = await Promise.all([
        firstValueFrom(this.comercioApi.getMisReservas()),
        firstValueFrom(this.comercioApi.getMisFinanzas()).catch(() => null),
      ]);
      this.reservas.set(reservas);
      this.finanzas.set(finanzas);
    } catch {
      this.errorMsg.set('Error al cargar los datos financieros. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  comisionReserva(r: MiReserva): number { return r.montoTotal * COMISION_PCT; }
  feeStripeReserva(r: MiReserva): number { return r.montoTotal * STRIPE_PCT + STRIPE_FIJO_EUR; }
  liquidacionReserva(r: MiReserva): number { return r.montoTotal - this.comisionReserva(r) - this.feeStripeReserva(r); }
  badgeEstado(e: string): string { return ESTADO_BADGE[e] ?? 'rs-badge--neutral'; }
}
