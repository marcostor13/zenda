import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, PagoAdmin, ResumenPagos, Liquidacion } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
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
  imports: [DatePipe, RsIconComponent, EurosPipe],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">Pagos y liquidaciones</h1>
        <p class="rs-page-sub">A dónde va cada euro que entra por Doogking.</p>
      </div>
    </div>

    <div class="resumen">
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.cobrado ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Cobrado a clientes</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.comisionDoogking ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Comisión Doogking</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.costePasarela ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Coste de pasarela</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.liquidadoComercios ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Para los comercios</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.pendienteLiquidar ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Pendiente de liquidar</span>
      </div>
      <div class="rs-card tile">
        <span class="tile__num">{{ resumen()?.reembolsado ?? 0 | euros:'1.0-0' }}</span>
        <span class="tile__lbl">Reembolsado</span>
      </div>
    </div>

    <div class="vista-tabs" role="tablist">
      <button class="vista-tab" role="tab" [class.activa]="vista() === 'pagos'"
              (click)="vista.set('pagos')">Pagos recibidos</button>
      <button class="vista-tab" role="tab" [class.activa]="vista() === 'liquidaciones'"
              (click)="cambiarALiquidaciones()">Liquidaciones a comercios</button>
    </div>

    <div class="rs-toolbar">
      <div class="rs-toolbar__grupo">
        @for (f of filtros; track f.valor) {
          <button class="rs-btn rs-btn--sm"
                  [class.rs-btn--primary]="filtroEstado() === f.valor"
                  [class.rs-btn--ghost]="filtroEstado() !== f.valor"
                  (click)="cambiarFiltro(f.valor)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="rs-toolbar__campo rs-toolbar__campo--buscador">
        <label class="rs-toolbar__lbl" for="fp-buscar">Buscar</label>
        <input id="fp-buscar" class="rs-inp rs-toolbar__control" type="search"
               placeholder="Código de reserva…"
               [value]="buscar()" (keyup.enter)="aplicarBusqueda($any($event.target).value)" />
      </div>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (vista() === 'liquidaciones') {
      <!-- Historial de liquidaciones: qué se pagó, cuándo y con qué referencia -->
      <div class="rs-card panel-generar">
        <h3 class="panel-generar__titulo">Generar una liquidación</h3>
        <p class="panel-generar__nota">
          Calcula lo cobrado de ese comercio en el periodo y lo deja registrado.
          No mueve dinero: la transferencia se marca después.
        </p>
        <div class="panel-generar__form">
          <select class="rs-inp" [value]="comercioSel()"
                  (change)="comercioSel.set($any($event.target).value)" aria-label="Comercio">
            <option value="">Elige un comercio</option>
            @for (c of comercios(); track c._id) {
              <option [value]="c._id">{{ c.nombreComercial }}</option>
            }
          </select>
          <input class="rs-inp" type="date" [value]="desdeSel()"
                 (input)="desdeSel.set($any($event.target).value)" aria-label="Desde" />
          <input class="rs-inp" type="date" [value]="hastaSel()"
                 (input)="hastaSel.set($any($event.target).value)" aria-label="Hasta" />
          <button class="rs-btn rs-btn--primary rs-btn--sm"
                  [disabled]="!puedeGenerar() || generando()" (click)="generarLiquidacion()">
            {{ generando() ? 'Calculando…' : 'Generar liquidación' }}
          </button>
        </div>
      </div>

      @if (liquidaciones().length === 0) {
        <div class="rs-card vacio">
          <rs-icon name="banknote" [size]="34" [stroke]="1.5"></rs-icon>
          <p>Todavía no has registrado ninguna liquidación.</p>
        </div>
      } @else {
        <div class="lista-liquidaciones">
          @for (l of liquidaciones(); track l._id) {
            <div class="liquidacion">
              <div class="liquidacion__info">
                <strong>{{ l.comercioNombre }}</strong>
                <span>
                  {{ l.desde | date:'d MMM yyyy' }} — {{ l.hasta | date:'d MMM yyyy' }}
                  · {{ l.reservas }} pago(s)
                </span>
                <span class="liquidacion__desglose">
                  Bruto {{ l.facturacionBruta | euros:'1.2-2' }} ·
                  comisión {{ l.comisionPlataforma | euros:'1.2-2' }} ·
                  pasarela {{ l.stripeFee | euros:'1.2-2' }}
                </span>
              </div>
              <span class="liquidacion__neto">{{ l.importeNeto | euros:'1.2-2' }}</span>
              <span class="rs-badge {{ l.estado === 'pagada' ? 'rs-badge--success' : 'rs-badge--warning' }}">
                {{ l.estado === 'pagada' ? 'Pagada' : 'Pendiente' }}
              </span>
              @if (l.estado === 'pagada') {
                <span class="liquidacion__ref">
                  {{ l.fechaPago | date:'d MMM yyyy' }} · ref. {{ l.referencia }}
                </span>
              } @else {
                <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="abrirPago(l._id)">
                  Marcar como pagada
                </button>
              }
            </div>

            @if (pagandoId() === l._id) {
              <div class="liquidacion__pago">
                <input class="rs-inp" [value]="referencia()"
                       (input)="referencia.set($any($event.target).value)"
                       placeholder="Referencia de la transferencia" />
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarPago()">Cancelar</button>
                <button class="rs-btn rs-btn--primary rs-btn--sm"
                        [disabled]="!referencia().trim()" (click)="confirmarPago(l)">
                  Confirmar pago
                </button>
              </div>
            }
          }
        </div>
      }
    } @else if (cargando()) {
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
            <span class="cell-amount" data-col="Cobrado">{{ p.montoTotal | euros:'1.2-2' }}</span>
            <span class="cell-amount cell-verde" data-col="Comisión">{{ p.comisionPlataforma | euros:'1.2-2' }}</span>
            <span class="cell-amount cell-rojo" data-col="Pasarela">{{ p.stripeFee | euros:'1.2-2' }}</span>
            <span class="cell-amount" data-col="Neto comercio">{{ p.montoLiquidacion | euros:'1.2-2' }}</span>
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

    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); }
    .tile { padding: var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
    .tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .vista-tabs { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .vista-tab {
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
    }
    .vista-tab.activa { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }

    .panel-generar { padding: var(--sp-5); }
    .panel-generar__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .panel-generar__nota { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); max-width: 70ch; }
    .panel-generar__form { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
    .panel-generar__form .rs-inp { height: 40px; min-width: 180px; }

    .lista-liquidaciones { display: flex; flex-direction: column; gap: var(--sp-2); }
    .liquidacion {
      display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap;
      padding: var(--sp-4) var(--sp-5);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
    }
    .liquidacion__info { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
    .liquidacion__info strong { font-size: var(--f-sm); color: var(--t-100); }
    .liquidacion__info span { font-size: var(--f-xs); color: var(--t-400); }
    .liquidacion__neto { font-family: var(--font-accent); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100); }
    .liquidacion__ref { font-size: var(--f-xs); color: var(--t-400); }
    .liquidacion__pago { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; padding: 0 var(--sp-5) var(--sp-3); }
    .liquidacion__pago .rs-inp { flex: 1; min-width: 220px; height: 38px; }

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

  /** Historial de liquidaciones (TCK-8040 §1). */
  readonly vista = signal<'pagos' | 'liquidaciones'>('pagos');
  readonly liquidaciones = signal<Liquidacion[]>([]);
  readonly comercios = signal<Array<{ _id: string; nombreComercial: string }>>([]);
  readonly comercioSel = signal('');
  readonly desdeSel = signal('');
  readonly hastaSel = signal('');
  readonly generando = signal(false);
  readonly pagandoId = signal('');
  readonly referencia = signal('');

  puedeGenerar(): boolean {
    return !!this.comercioSel() && !!this.desdeSel() && !!this.hastaSel();
  }

  async cambiarALiquidaciones(): Promise<void> {
    this.vista.set('liquidaciones');
    await this.cargarLiquidaciones();
    if (this.comercios().length === 0) {
      try {
        const res = await firstValueFrom(this.adminApi.getComercios({ limite: 200 }));
        this.comercios.set(res.items.map((c) => ({ _id: c._id, nombreComercial: c.nombreComercial })));
      } catch {
        // Sin la lista no se puede generar, pero el historial sigue viéndose.
      }
    }
  }

  private async cargarLiquidaciones(): Promise<void> {
    try {
      const res = await firstValueFrom(this.adminApi.getLiquidaciones({ limite: 50 }));
      this.liquidaciones.set(res.items);
    } catch {
      this.errorMsg.set('Error cargando las liquidaciones.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  async generarLiquidacion(): Promise<void> {
    if (!this.puedeGenerar()) return;
    this.generando.set(true);
    this.errorMsg.set('');
    try {
      await firstValueFrom(this.adminApi.generarLiquidacion({
        comercioId: this.comercioSel(),
        desde: new Date(this.desdeSel()).toISOString(),
        hasta: new Date(this.hastaSel() + 'T23:59:59').toISOString(),
      }));
      await this.cargarLiquidaciones();
    } catch {
      this.errorMsg.set('No se pudo generar: revisa que haya pagos cobrados en ese periodo.');
      setTimeout(() => this.errorMsg.set(''), 4000);
    } finally {
      this.generando.set(false);
    }
  }

  abrirPago(id: string): void {
    this.pagandoId.set(id);
    this.referencia.set('');
  }

  cancelarPago(): void {
    this.pagandoId.set('');
    this.referencia.set('');
  }

  /** La referencia es obligatoria: sin ella no se puede casar con el banco. */
  async confirmarPago(liquidacion: Liquidacion): Promise<void> {
    if (!this.referencia().trim()) return;
    try {
      const actualizada = await firstValueFrom(
        this.adminApi.marcarLiquidacionPagada(liquidacion._id, this.referencia().trim()),
      );
      this.liquidaciones.update((lista) =>
        lista.map((l) => (l._id === liquidacion._id ? { ...l, ...actualizada } : l)),
      );
      this.cancelarPago();
    } catch {
      this.errorMsg.set('No se pudo marcar la liquidación como pagada.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }
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
