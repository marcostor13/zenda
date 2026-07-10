import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ReporteFinanciero, ReporteVertical } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const VERTICAL_EMOJI: Record<string, string> = {
  hoteles: '🏨', vuelos: '✈️', taxis: '🚗', transporte: '🚛', guarderia: '👶',
};

const VERTICALES_OPCIONES = [
  { label: 'Todas las categorías', valor: '' },
  { label: '🏠 Alojamiento canino', valor: 'alojamiento' },
  { label: '🚐 Transporte de animales', valor: 'transporte' },
  { label: '🩺 Veterinarios', valor: 'veterinaria' },
  { label: '✂️ Peluquerías caninas', valor: 'peluqueria' },
  { label: '🎓 Adiestramiento canino', valor: 'adiestramiento' },
] as const;

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RsIconComponent],
  template: `
    <!-- Cabecera -->
    <div style="margin-bottom:var(--sp-8)">
      <h1 class="page-title">Reportes financieros</h1>
      <p class="page-sub">GMV, comisiones, costos Stripe y margen neto por período.</p>
    </div>

    <!-- Formulario de filtros -->
    <div class="rs-card" style="padding:var(--sp-6);margin-bottom:var(--sp-6)">
      <h3 class="section-title">Parámetros del reporte</h3>
      <div class="filtros-grid">
        <div class="rs-field">
          <label class="rs-lbl">Desde</label>
          <input
            type="date"
            class="rs-inp"
            [(ngModel)]="fechaDesde"
            [max]="fechaHasta || undefined" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl">Hasta</label>
          <input
            type="date"
            class="rs-inp"
            [(ngModel)]="fechaHasta"
            [min]="fechaDesde || undefined" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl">Vertical (opcional)</label>
          <select class="rs-inp" [(ngModel)]="filtroVertical">
            @for (v of verticalesOpciones; track v.valor) {
              <option [value]="v.valor">{{ v.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
      }

      <button
        class="rs-btn rs-btn--primary"
        [disabled]="!fechaDesde || !fechaHasta || cargando()"
        (click)="generarReporte()">
        @if (cargando()) {
          <span>Generando…</span>
        } @else {
          <span>📊 Generar reporte</span>
        }
      </button>
    </div>

    <!-- Resultados -->
    @if (reporte()) {
      <!-- KPIs resumen -->
      <div class="kpi-grid" style="margin-bottom:var(--sp-6)">
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(22,104,227,.15);color:#1668E3">
            <rs-icon name="trending-up" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">S/ {{ reporte()!.gmv | number:'1.2-2' }}</div>
          <div class="kpi-lbl">GMV total</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(0,161,224,.15);color:#00A1E0">
            <rs-icon name="euro" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">S/ {{ reporte()!.ingresosPlataforma | number:'1.2-2' }}</div>
          <div class="kpi-lbl">Ingresos plataforma</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(245,158,11,.15);color:#F59E0B">
            <rs-icon name="credit-card" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">S/ {{ reporte()!.costoStripe | number:'1.2-2' }}</div>
          <div class="kpi-lbl">Costos Stripe</div>
        </div>
        <div class="kpi-card rs-card kpi-highlight">
          <div class="kpi-icon" style="background:rgba(22,104,227,.15);color:#1668E3">
            <rs-icon name="sparkles" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">S/ {{ reporte()!.margenNetoPlataforma | number:'1.2-2' }}</div>
          <div class="kpi-lbl">Margen neto</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(109,92,246,.15);color:#6D5CF6">
            <rs-icon name="building" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">S/ {{ reporte()!.liquidacionesComercio | number:'1.2-2' }}</div>
          <div class="kpi-lbl">Liquidaciones comercios</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(71,85,105,.15);color:#64748B">
            <rs-icon name="calendar" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.totalReservas }}</div>
          <div class="kpi-lbl">Reservas confirmadas</div>
        </div>
      </div>

      <!-- Desglose por vertical -->
      @if (reporte()!.porVertical.length > 0) {
        <div class="rs-card" style="padding:0;overflow:hidden">
          <div class="tbl-header">
            <h3 class="section-title" style="margin:0">Desglose por vertical</h3>
          </div>
          <div class="vtbl-head">
            <span>Vertical</span>
            <span style="text-align:right">GMV</span>
            <span style="text-align:right">Comisión</span>
            <span style="text-align:right">Fee Stripe</span>
            <span style="text-align:right">Margen neto</span>
            <span style="text-align:right">Reservas</span>
          </div>
          @for (v of reporte()!.porVertical; track v.vertical) {
            <div class="vtbl-row">
              <span class="vertical-cell">
                <rs-icon [name]="iconVertical(v.vertical)" [size]="15" [stroke]="2"></rs-icon>
                <span style="text-transform:capitalize">{{ v.vertical }}</span>
              </span>
              <span class="cell-num">S/ {{ v.gmv | number:'1.2-2' }}</span>
              <span class="cell-num cell-green">S/ {{ v.comision | number:'1.2-2' }}</span>
              <span class="cell-num cell-amber">S/ {{ v.costoStripe | number:'1.2-2' }}</span>
              <span class="cell-num" [class.cell-green]="v.margenNeto >= 0" [class.cell-red]="v.margenNeto < 0">
                S/ {{ v.margenNeto | number:'1.2-2' }}
              </span>
              <span class="cell-num">{{ v.totalReservas }}</span>
            </div>
          }
          <!-- Totales -->
          <div class="vtbl-row vtbl-total">
            <span class="cell-bold">TOTAL</span>
            <span class="cell-num cell-bold">S/ {{ reporte()!.gmv | number:'1.2-2' }}</span>
            <span class="cell-num cell-bold cell-green">S/ {{ reporte()!.ingresosPlataforma | number:'1.2-2' }}</span>
            <span class="cell-num cell-bold cell-amber">S/ {{ reporte()!.costoStripe | number:'1.2-2' }}</span>
            <span class="cell-num cell-bold" [class.cell-green]="reporte()!.margenNetoPlataforma >= 0">
              S/ {{ reporte()!.margenNetoPlataforma | number:'1.2-2' }}
            </span>
            <span class="cell-num cell-bold">{{ reporte()!.totalReservas }}</span>
          </div>
        </div>
      }
    }

  `,
  styles: [`
    :host { display: contents; }

    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }

    .filtros-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--sp-4); margin-bottom: var(--sp-5); @media (max-width: 768px) { grid-template-columns: 1fr; } }
    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }

    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); @media (max-width: 900px) { grid-template-columns: repeat(2,1fr); } @media (max-width: 560px) { grid-template-columns: 1fr; } }
    .kpi-card { padding: var(--sp-5); }
    .kpi-highlight { border: 1px solid var(--b-a); background: var(--c-accent-lo); }
    .kpi-icon { width: 44px; height: 44px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; margin-bottom: var(--sp-3); }
    .kpi-val { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .tbl-header { padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .vtbl-head { display: grid; grid-template-columns: 1fr repeat(5, 140px); padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); @media (max-width: 900px) { display: none; } }
    .vtbl-row { display: grid; grid-template-columns: 1fr repeat(5, 140px); padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; &:last-child { border: none; } &:hover { background: var(--c-raised); } @media (max-width: 900px) { grid-template-columns: 1fr 1fr; gap: var(--sp-2); } }
    .vtbl-total { background: var(--c-raised); font-weight: var(--w-7); }

    .vertical-cell { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-100); }
    .cell-num { font-size: var(--f-sm); text-align: right; color: var(--t-300); }
    .cell-bold { font-weight: var(--w-7); color: var(--t-100); }
    .cell-green { color: #16a34a; }
    .cell-amber { color: #b45309; }
    .cell-red { color: #dc2626; }
  `],
})
export class AdminReportesComponent {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(false);
  readonly reporte = signal<ReporteFinanciero | null>(null);
  readonly errorMsg = signal('');

  readonly verticalesOpciones = VERTICALES_OPCIONES;

  fechaDesde = '';
  fechaHasta = '';
  filtroVertical = '';

  async generarReporte(): Promise<void> {
    if (!this.fechaDesde || !this.fechaHasta) return;
    this.cargando.set(true);
    this.errorMsg.set('');
    this.reporte.set(null);
    try {
      const data = await firstValueFrom(
        this.adminApi.getReporteFinanciero(
          this.fechaDesde,
          this.fechaHasta,
          this.filtroVertical || undefined,
        ),
      );
      this.reporte.set(data);
    } catch {
      this.errorMsg.set('Error generando el reporte. Verifica el rango de fechas e intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  emojiVertical(vertical: string): string {
    return VERTICAL_EMOJI[vertical] ?? '📋';
  }

  iconVertical(vertical: string): string {
    const MAP: Record<string, string> = {
      hoteles: 'hotel', vuelos: 'plane', taxis: 'car', transporte: 'truck', guarderia: 'users',
    };
    return MAP[vertical] ?? 'building';
  }
}
