import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ReporteFinanciero, ReporteVertical } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoDeVertical } from '../../shared/verticales/verticales.config';
import { descargarCsv } from '../../shared/exportacion/csv';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
type AtajoClave = 'hoy' | '7d' | '30d' | 'mes' | 'ano' | 'personalizado';

const ATAJOS: ReadonlyArray<{ clave: AtajoClave; label: string }> = [
  { clave: 'hoy', label: 'Hoy' },
  { clave: '7d', label: '7 días' },
  { clave: '30d', label: '30 días' },
  { clave: 'mes', label: 'Este mes' },
  { clave: 'ano', label: 'Este año' },
  { clave: 'personalizado', label: 'Personalizado' },
];

const VERTICALES_OPCIONES = [
  { label: 'Todas las categorías', valor: '' },
  { label: 'Alojamiento canino', valor: 'alojamiento' },
  { label: 'Transporte de animales', valor: 'transporte' },
  { label: 'Veterinarios', valor: 'veterinaria' },
  { label: 'Peluquerías caninas', valor: 'peluqueria' },
  { label: 'Adiestramiento canino', valor: 'adiestramiento' },
  { label: 'Hoteles pet-friendly', valor: 'hoteles' },
] as const;

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [FormsModule, RsIconComponent, EurosPipe],
  template: `
    <!-- Cabecera -->
    <div style="margin-bottom:var(--sp-8)">
      <h1 class="page-title">Reportes financieros</h1>
      <p class="page-sub">GMV, comisiones, costos Stripe y margen neto por período.</p>
    </div>

    <!-- Formulario de filtros -->
    <div class="rs-card" style="padding:var(--sp-6);margin-bottom:var(--sp-6)">
      <h3 class="section-title">Parámetros del reporte</h3>

      <!-- Atajos: la pantalla ya no arranca vacía esperando a que rellenes fechas (TCK-8032/8033) -->
      <div class="atajos">
        @for (a of atajos; track a.clave) {
          <button class="atajo" [class.activa]="atajoActivo() === a.clave" (click)="aplicarAtajo(a.clave)">
            {{ a.label }}
          </button>
        }
      </div>

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
          <select class="rs-inp" [(ngModel)]="filtroVertical" (ngModelChange)="generarReporte()">
            @for (v of verticalesOpciones; track v.valor) {
              <option [value]="v.valor">{{ v.label }}</option>
            }
          </select>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">Comercio (opcional)</label>
          <select class="rs-inp" [(ngModel)]="filtroComercio" (ngModelChange)="generarReporte()">
            <option value="">Todos los comercios</option>
            @for (c of comercios(); track c._id) {
              <option [value]="c._id">{{ c.nombreComercial }}</option>
            }
          </select>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
      }

      @if (reporte()) {
        <button class="rs-btn rs-btn--secondary" style="margin-right:var(--sp-3)" (click)="exportarCsv()">
          <rs-icon name="download" [size]="14" [stroke]="2"></rs-icon> Exportar CSV
        </button>
      }
      <button
        class="rs-btn rs-btn--primary"
        [disabled]="!fechaDesde || !fechaHasta || cargando()"
        (click)="generarReporte()">
        @if (cargando()) {
          <span>Generando…</span>
        } @else {
          <span><rs-icon name="bar-chart" [size]="14" [stroke]="2"></rs-icon> Generar reporte</span>
        }
      </button>
    </div>

    <!-- Resultados -->
    @if (cargando() && !reporte()) {
      <div class="rs-card" style="padding:var(--sp-10);text-align:center;color:var(--t-400)">
        Calculando el reporte…
      </div>
    }
    @if (reporte()) {
      @if (comparativa(); as comp) {
        <!-- Cómo va frente al periodo anterior de la misma duración (TCK-8032/8033) -->
        <div class="rs-card comparativa">
          <strong class="comparativa__titulo">Frente al periodo anterior</strong>
          <div class="comparativa__datos">
            <span class="comparativa__dato">
              GMV
              <b [class.baja]="comp.gmv !== null && comp.gmv < 0">
                {{ comp.gmv === null ? 'sin datos' : (comp.gmv > 0 ? '+' : '') + comp.gmv + ' %' }}
              </b>
            </span>
            <span class="comparativa__dato">
              Comisión Doogking
              <b [class.baja]="comp.ingresos !== null && comp.ingresos < 0">
                {{ comp.ingresos === null ? 'sin datos' : (comp.ingresos > 0 ? '+' : '') + comp.ingresos + ' %' }}
              </b>
            </span>
            <span class="comparativa__dato">
              Reservas
              <b [class.baja]="comp.reservas !== null && comp.reservas < 0">
                {{ comp.reservas === null ? 'sin datos' : (comp.reservas > 0 ? '+' : '') + comp.reservas + ' %' }}
              </b>
            </span>
          </div>
        </div>
      }

      <!-- KPIs resumen -->
      <div class="kpi-grid" style="margin-bottom:var(--sp-6)">
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(22,104,227,.15);color:#1668E3">
            <rs-icon name="trending-up" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.gmv | euros:'1.2-2' }}</div>
          <div class="kpi-lbl">GMV total</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(0,161,224,.15);color:#00A1E0">
            <rs-icon name="euro" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.ingresosPlataforma | euros:'1.2-2' }}</div>
          <div class="kpi-lbl">Ingresos plataforma</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(245,158,11,.15);color:#F59E0B">
            <rs-icon name="credit-card" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.costoStripe | euros:'1.2-2' }}</div>
          <div class="kpi-lbl">Costos Stripe</div>
        </div>
        <div class="kpi-card rs-card kpi-highlight">
          <div class="kpi-icon" style="background:rgba(22,104,227,.15);color:#1668E3">
            <rs-icon name="sparkles" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.margenNetoPlataforma | euros:'1.2-2' }}</div>
          <div class="kpi-lbl">Margen neto</div>
        </div>
        <div class="kpi-card rs-card">
          <div class="kpi-icon" style="background:rgba(109,92,246,.15);color:#6D5CF6">
            <rs-icon name="building" [size]="22" [stroke]="1.75"></rs-icon>
          </div>
          <div class="kpi-val">{{ reporte()!.liquidacionesComercio | euros:'1.2-2' }}</div>
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
              <span class="cell-num">{{ v.gmv | euros:'1.2-2' }}</span>
              <span class="cell-num cell-green">{{ v.comision | euros:'1.2-2' }}</span>
              <span class="cell-num cell-amber">{{ v.costoStripe | euros:'1.2-2' }}</span>
              <span class="cell-num" [class.cell-green]="v.margenNeto >= 0" [class.cell-red]="v.margenNeto < 0">
                {{ v.margenNeto | euros:'1.2-2' }}
              </span>
              <span class="cell-num">{{ v.totalReservas }}</span>
            </div>
          }
          <!-- Totales -->
          <div class="vtbl-row vtbl-total">
            <span class="cell-bold">TOTAL</span>
            <span class="cell-num cell-bold">{{ reporte()!.gmv | euros:'1.2-2' }}</span>
            <span class="cell-num cell-bold cell-green">{{ reporte()!.ingresosPlataforma | euros:'1.2-2' }}</span>
            <span class="cell-num cell-bold cell-amber">{{ reporte()!.costoStripe | euros:'1.2-2' }}</span>
            <span class="cell-num cell-bold" [class.cell-green]="reporte()!.margenNetoPlataforma >= 0">
              {{ reporte()!.margenNetoPlataforma | euros:'1.2-2' }}
            </span>
            <span class="cell-num cell-bold">{{ reporte()!.totalReservas }}</span>
          </div>
        </div>
      }

      <!-- Ajustes de precio por comercio (Ref. S11) -->
      @if (reporte()!.ajustesPorComercio.length > 0) {
        <div class="rs-card" style="padding:0;overflow:hidden;margin-top:var(--sp-5)">
          <div class="tbl-header">
            <h3 class="section-title" style="margin:0">Ajustes de precio por comercio</h3>
            <span style="font-size:var(--f-sm);color:var(--t-400)">
              {{ reporte()!.totalReservasConAjuste }} reserva(s) con ajuste · +{{ reporte()!.importeTotalAjustes | euros:'1.2-2' }}
            </span>
          </div>
          <div class="ajustes-head">
            <span>Comercio</span>
            <span style="text-align:right">Reservas</span>
            <span style="text-align:right">Con ajuste</span>
            <span style="text-align:right">% ajustadas</span>
            <span style="text-align:right">Importe ajustes</span>
          </div>
          @for (c of reporte()!.ajustesPorComercio; track c.comercioId) {
            <div class="ajustes-row">
              <span>{{ c.comercioNombre }}</span>
              <span class="cell-num">{{ c.totalReservas }}</span>
              <span class="cell-num">{{ c.reservasConAjuste }}</span>
              <span class="cell-num" [class.cell-amber]="c.porcentajeConAjuste >= 30">{{ c.porcentajeConAjuste }}%</span>
              <span class="cell-num">{{ c.importeAjustes | euros:'1.2-2' }}</span>
            </div>
          }
        </div>
      }
    }

  `,
  styles: [`
    :host { display: contents; }

    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .section-title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }

    .comparativa { padding: var(--sp-4) var(--sp-5); margin-bottom: var(--sp-4); }
    .comparativa__titulo { font-size: var(--f-sm); color: var(--t-400); }
    .comparativa__datos { display: flex; flex-wrap: wrap; gap: var(--sp-5); margin-top: var(--sp-2); }
    .comparativa__dato { font-size: var(--f-sm); color: var(--t-300); display: flex; align-items: center; gap: var(--sp-2); }
    .comparativa__dato b { color: #047857; font-family: var(--font-accent); }
    .comparativa__dato b.baja { color: #B91C1C; }

    .atajos { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .atajo {
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-xs); font-weight: var(--w-6); cursor: pointer;
      transition: all var(--d-2);
    }
    .atajo:hover { border-color: var(--c-accent); color: var(--c-accent); }
    .atajo.activa { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); }

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

    .ajustes-head { display: grid; grid-template-columns: 1fr repeat(4, 130px); padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); @media (max-width: 900px) { display: none; } }
    .ajustes-row { display: grid; grid-template-columns: 1fr repeat(4, 130px); padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-200); &:last-child { border: none; } &:hover { background: var(--c-raised); } @media (max-width: 900px) { grid-template-columns: 1fr 1fr; gap: var(--sp-2); } }

    .vertical-cell { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-100); }
    .cell-num { font-size: var(--f-sm); text-align: right; color: var(--t-300); }
    .cell-bold { font-weight: var(--w-7); color: var(--t-100); }
    .cell-green { color: #16a34a; }
    .cell-amber { color: #b45309; }
    .cell-red { color: #dc2626; }
  `],
})
export class AdminReportesComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(false);
  readonly reporte = signal<ReporteFinanciero | null>(null);
  readonly errorMsg = signal('');

  readonly verticalesOpciones = VERTICALES_OPCIONES;
  readonly atajos = ATAJOS;
  readonly atajoActivo = signal<AtajoClave>('30d');
  readonly comercios = signal<Array<{ _id: string; nombreComercial: string }>>([]);

  /** Variación frente al periodo anterior de la misma duración. */
  readonly comparativa = signal<{ gmv: number | null; ingresos: number | null; reservas: number | null } | null>(null);

  fechaDesde = '';
  fechaHasta = '';
  filtroVertical = '';
  filtroComercio = '';

  async ngOnInit(): Promise<void> {
    // Arranca con los últimos 30 días ya calculados: la pantalla nunca se ve
    // como un formulario a medias (TCK-8032/8033).
    this.aplicarRango(30);
    await this.generarReporte();
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 200 }));
      this.comercios.set(res.items.map((c) => ({ _id: c._id, nombreComercial: c.nombreComercial })));
    } catch {
      // Sin la lista, el filtro por comercio se queda en "Todos".
    }
  }

  /** Fija el rango a los últimos `dias` días, hoy incluido. */
  private aplicarRango(dias: number): void {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (dias - 1));
    this.fechaHasta = hoy.toISOString().slice(0, 10);
    this.fechaDesde = desde.toISOString().slice(0, 10);
  }

  async aplicarAtajo(clave: AtajoClave): Promise<void> {
    this.atajoActivo.set(clave);
    const hoy = new Date();
    if (clave === 'hoy') this.aplicarRango(1);
    else if (clave === '7d') this.aplicarRango(7);
    else if (clave === '30d') this.aplicarRango(30);
    else if (clave === 'mes') {
      this.fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
      this.fechaHasta = hoy.toISOString().slice(0, 10);
    } else if (clave === 'ano') {
      this.fechaDesde = new Date(hoy.getFullYear(), 0, 1).toISOString().slice(0, 10);
      this.fechaHasta = hoy.toISOString().slice(0, 10);
    } else {
      return; // 'personalizado': el usuario elige las fechas a mano
    }
    await this.generarReporte();
  }

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
          this.filtroComercio || undefined,
        ),
      );
      this.reporte.set(data);
      await this.calcularComparativa(data);
    } catch {
      this.errorMsg.set('Error generando el reporte. Verifica el rango de fechas e intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Exporta el reporte que hay en pantalla, con el desglose por vertical.
   * Separador ";" y BOM: es lo que Excel en español abre sin preguntar.
   */
  exportarCsv(): void {
    const r = this.reporte();
    if (!r) return;

    const filas: string[][] = [
      ['Reporte financiero Doogking'],
      ['Desde', r.fechaDesde, 'Hasta', r.fechaHasta],
      [],
      ['Concepto', 'Importe (€)'],
      ['GMV', String(r.gmv)],
      ['Ingresos plataforma', String(r.ingresosPlataforma)],
      ['Coste de pasarela', String(r.costoStripe)],
      ['Margen neto', String(r.margenNetoPlataforma)],
      ['Liquidaciones a comercios', String(r.liquidacionesComercio)],
      ['Reservas', String(r.totalReservas)],
      [],
      ['Vertical', 'GMV', 'Comisión', 'Coste pasarela', 'Margen neto', 'Reservas'],
      ...r.porVertical.map((v) => [
        v.vertical, String(v.gmv), String(v.comision), String(v.costoStripe),
        String(v.margenNeto), String(v.totalReservas),
      ]),
    ];

    descargarCsv(filas, `reporte-doogking-${r.fechaDesde}-a-${r.fechaHasta}.csv`);
  }

  /**
   * Pide el mismo rango justo anterior y compara. Si allí no hubo actividad no
   * se enseña porcentaje: un "+100 %" desde cero engaña más de lo que informa.
   */
  private async calcularComparativa(actual: ReporteFinanciero): Promise<void> {
    this.comparativa.set(null);
    const desde = new Date(this.fechaDesde);
    const hasta = new Date(this.fechaHasta);
    const duracion = hasta.getTime() - desde.getTime();
    const previoHasta = new Date(desde.getTime() - 86400000);
    const previoDesde = new Date(previoHasta.getTime() - duracion);

    try {
      const previo = await firstValueFrom(
        this.adminApi.getReporteFinanciero(
          previoDesde.toISOString().slice(0, 10),
          previoHasta.toISOString().slice(0, 10),
          this.filtroVertical || undefined,
          this.filtroComercio || undefined,
        ),
      );
      const variacion = (ahora: number, antes: number): number | null =>
        antes > 0 ? Math.round(((ahora - antes) / antes) * 1000) / 10 : null;

      this.comparativa.set({
        gmv: variacion(actual.gmv, previo.gmv),
        ingresos: variacion(actual.ingresosPlataforma, previo.ingresosPlataforma),
        reservas: variacion(actual.totalReservas, previo.totalReservas),
      });
    } catch {
      // Sin periodo anterior comparable, el reporte se enseña igual.
    }
  }

  iconoVertical(vertical: string): string {
    return iconoDeVertical(vertical);
  }

  iconVertical(vertical: string): string {
    const MAP: Record<string, string> = {
      hoteles: 'hotel', vuelos: 'plane', taxis: 'car', transporte: 'truck', guarderia: 'users',
    };
    return MAP[vertical] ?? 'building';
  }
}
