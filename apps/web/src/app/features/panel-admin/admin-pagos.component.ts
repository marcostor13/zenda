import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, PagoAdmin, ResumenPagos } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const LIMITE = 20;

const ESTADO_BADGE: Record<string, string> = {
  aprobado: 'rs-badge--success',
  iniciado: 'rs-badge--warning',
  rechazado: 'rs-badge--error',
  reembolsado: 'rs-badge--neutral',
};

const ESTADO_LABEL: Record<string, string> = {
  aprobado: 'Cobrado',
  iniciado: 'En curso',
  rechazado: 'Rechazado',
  reembolsado: 'Reembolsado',
};

const FILTROS = [
  { label: 'Todos', valor: '' },
  { label: 'Cobrados', valor: 'aprobado' },
  { label: 'En curso', valor: 'iniciado' },
  { label: 'Rechazados', valor: 'rechazado' },
  { label: 'Reembolsados', valor: 'reembolsado' },
] as const;

/**
 * Control del dinero (TCK-8040 §1): qué se ha cobrado, cuánto es del comercio,
 * cuánto de Doogking y cuánto se lleva la pasarela. Se calcula sobre los pagos
 * existentes; el historial de liquidaciones formales todavía no existe.
 */
@Component({
  selector: 'app-admin-pagos',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RsIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Pagos y liquidaciones</h1>
        <p class="page-sub">A dónde va cada euro que entra por Doogking.</p>
      </div>
    </div>

    <div class="resumen">
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.cobrado ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Cobrado a clientes</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.comisionDoogking ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Comisión Doogking</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.costePasarela ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Coste de pasarela</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.liquidadoComercios ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Para los comercios</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.pendienteLiquidar ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Pendiente de liquidar</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.reembolsado ?? 0 | number:'1.0-0' }} €</span>
        <span class="tile__lbl">Reembolsado</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="filtros">
        @for (f of filtros; track f.valor) {
          <button class="rs-btn rs-btn--sm"
                  [class.rs-btn--primary]="filtroEstado() === f.valor"
                  [class.rs-btn--ghost]="filtroEstado() !== f.valor"
                  (click)="cambiarFiltro(f.valor)">
            {{ f.label }}
          </button>
        }
      </div>
      <input class="rs-inp buscador" type="search" placeholder="Buscar por código de reserva…"
             [value]="buscar()" (keyup.enter)="aplicarBusqueda($any($event.target).value)" />
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">Cargando pagos…</p>
    } @else if (pagos().length === 0) {
      <div class="rs-card vacio">
        <rs-icon name="euro" [size]="34" [stroke]="1.5"></rs-icon>
        <p>{{ buscar() || filtroEstado() ? 'Ningún pago coincide con el filtro.' : 'Todavía no hay pagos registrados.' }}</p>
      </div>
    } @else {
      <div class="rs-card" style="padding:0;overflow-x:auto">
        <div class="tbl-head">
          <span>Reserva</span>
          <span>Comercio</span>
          <span>Fecha</span>
          <span style="text-align:right">Cobrado</span>
          <span style="text-align:right">Comisión</span>
          <span style="text-align:right">Pasarela</span>
          <span style="text-align:right">Neto comercio</span>
          <span>Estado</span>
        </div>
        @for (p of pagos(); track p._id) {
          <div class="tbl-row">
            <span class="cell-mono" data-col="Reserva">{{ p.codigoReserva }}</span>
            <span data-col="Comercio">{{ p.comercio }}</span>
            <span class="cell-muted" data-col="Fecha">{{ p.createdAt | date:'d MMM yyyy' }}</span>
            <span class="cell-amount" data-col="Cobrado">{{ p.montoTotal | number:'1.2-2' }} €</span>
            <span class="cell-amount cell-verde" data-col="Comisión">{{ p.comisionPlataforma | number:'1.2-2' }} €</span>
            <span class="cell-amount cell-rojo" data-col="Pasarela">{{ p.stripeFee | number:'1.2-2' }} €</span>
            <span class="cell-amount" data-col="Neto comercio">{{ p.montoLiquidacion | number:'1.2-2' }} €</span>
            <span data-col="Estado">
              <span class="rs-badge {{ badge(p.estado) }}">{{ etiqueta(p.estado) }}</span>
            </span>
          </div>
        }
      </div>

      @if (totalPaginas() > 1) {
        <div class="paginacion">
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() <= 1" (click)="cambiarPagina(pagina() - 1)">← Anterior</button>
          <span>Página {{ pagina() }} de {{ totalPaginas() }} · {{ total() }} pagos</span>
          <button class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="pagina() >= totalPaginas()" (click)="cambiarPagina(pagina() + 1)">Siguiente →</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); }
    .tile { padding: var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
    .tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .toolbar { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
    .filtros { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .buscador { height: 40px; flex: 1; min-width: 240px; }

    .vacio { padding: var(--sp-12); text-align: center; color: var(--t-400); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }

    .tbl-head, .tbl-row {
      display: grid; grid-template-columns: 150px 1.2fr 110px 110px 110px 110px 130px 120px;
      gap: var(--sp-3); padding: var(--sp-3) var(--sp-5); align-items: center;
      border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-200);
    }
    .tbl-head { background: var(--c-raised); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .tbl-row:last-child { border-bottom: none; }
    .tbl-row:hover { background: var(--c-raised); }
    .cell-mono { font-family: monospace; font-size: var(--f-xs); color: var(--c-accent); }
    .cell-muted { color: var(--t-400); }
    .cell-amount { text-align: right; font-variant-numeric: tabular-nums; }
    .cell-verde { color: #047857; }
    .cell-rojo { color: #B91C1C; }

    @media (max-width: 900px) {
      .tbl-head { display: none; }
      .tbl-row {
        grid-template-columns: 1fr; gap: var(--sp-1);
        border-bottom: 6px solid var(--c-base);
      }
      .tbl-row > [data-col] { display: flex; justify-content: space-between; gap: var(--sp-3); text-align: left; }
      .tbl-row > [data-col]::before {
        content: attr(data-col);
        font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em;
      }
    }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminPagosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly pagos = signal<PagoAdmin[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly resumen = signal<ResumenPagos | null>(null);

  readonly filtros = FILTROS;
  readonly filtroEstado = signal('');
  readonly buscar = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));

  async ngOnInit(): Promise<void> {
    await this.cargar();
    try {
      this.resumen.set(await firstValueFrom(this.adminApi.getResumenPagos()));
    } catch {
      // Sin totales la tabla sigue siendo utilizable.
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const res = await firstValueFrom(this.adminApi.getPagos({
        page: this.pagina(),
        limite: LIMITE,
        estado: this.filtroEstado() || undefined,
        buscar: this.buscar() || undefined,
      }));
      this.pagos.set(res.items);
      this.total.set(res.total);
    } catch {
      this.errorMsg.set('Error cargando los pagos. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarFiltro(estado: string): Promise<void> {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    await this.cargar();
  }

  async aplicarBusqueda(valor: string): Promise<void> {
    this.buscar.set(valor.trim());
    this.pagina.set(1);
    await this.cargar();
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargar();
  }

  badge(estado: string): string { return ESTADO_BADGE[estado] ?? 'rs-badge--neutral'; }
  etiqueta(estado: string): string { return ESTADO_LABEL[estado] ?? estado; }
}
