import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ReservaAdmin } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const VERTICAL_EMOJI: Record<string, string> = {
  hoteles: '🏨', vuelos: '✈️', taxis: '🚗', transporte: '🚛', guarderia: '👶',
};

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success',
  pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error',
  completada: 'rs-badge--accent',
  no_show: 'rs-badge--neutral',
};

const FILTROS_ESTADO = [
  { label: 'Todas', valor: '' },
  { label: 'Confirmadas', valor: 'confirmada' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Canceladas', valor: 'cancelada' },
  { label: 'Completadas', valor: 'completada' },
] as const;

const LIMITE = 20;

@Component({
  selector: 'app-admin-reservas',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RsIconComponent],
  template: `
    <!-- Cabecera -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Reservas</h1>
        <p class="page-sub">Historial global de reservas en todos los verticales.</p>
      </div>
      <div class="page-kpi rs-card">
        <span class="kpi-num">{{ total() }}</span>
        <span class="kpi-lbl">{{ filtroEstado() || 'total' }}</span>
      </div>
    </div>

    <!-- Filtros por estado -->
    <div class="filter-bar">
      @for (f of filtros; track f.valor) {
        <button
          class="rs-btn rs-btn--sm"
          [class.rs-btn--primary]="filtroEstado() === f.valor"
          [class.rs-btn--ghost]="filtroEstado() !== f.valor"
          (click)="setFiltro(f.valor)">
          {{ f.label }}
        </button>
      }
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <div class="rs-card" style="padding:0;overflow:hidden">
      <div class="tbl-head">
        <span>Código</span>
        <span>Vertical</span>
        <span>Inicio</span>
        <span style="text-align:right">Monto</span>
        <span>Estado</span>
        <span>Creada</span>
      </div>

      @if (cargando()) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="tbl-row tbl-skeleton">
            <div class="skel skel--md"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
          </div>
        }
      } @else {
        @for (r of reservas(); track r._id) {
          <div class="tbl-row">
            <span class="cell-mono">{{ r.codigo }}</span>
            <span class="vertical-cell">
              <rs-icon [name]="iconVertical(r.vertical)" [size]="15" [stroke]="2"></rs-icon>
              {{ r.vertical }}
            </span>
            <span class="cell-muted">
              {{ r.fechaInicio ? (r.fechaInicio | date:'d MMM yyyy') : '—' }}
            </span>
            <span class="cell-amount">€ {{ r.montoTotal | number:'1.2-2' }}</span>
            <span>
              <span class="rs-badge {{ badgeEstado(r.estado) }}">{{ r.estado }}</span>
            </span>
            <span class="cell-muted">{{ r.createdAt | date:'d MMM, HH:mm' }}</span>
          </div>
        }
        @if (reservas().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">📅</span>
            <p>No hay reservas{{ filtroEstado() ? ' con estado "' + filtroEstado() + '"' : '' }}</p>
          </div>
        }
      }
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button
          class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() <= 1"
          (click)="cambiarPagina(paginaActual() - 1)">
          ← Anterior
        </button>
        <span class="page-info">
          Página {{ paginaActual() }} de {{ totalPaginas() }}
          · {{ total() }} reservas
        </span>
        <button
          class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()"
          (click)="cambiarPagina(paginaActual() + 1)">
          Siguiente →
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-6); margin-bottom: var(--sp-6); flex-wrap: wrap; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .filter-bar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5); flex-wrap: wrap; }

    .tbl-head { display: grid; grid-template-columns: 160px 140px 130px 130px 130px 150px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 160px 140px 130px 130px 130px 150px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; &:last-child { border: none; } &:hover { background: var(--c-raised); } }
    .tbl-skeleton { pointer-events: none; }

    .cell-mono { font-family: monospace; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .cell-muted { font-size: var(--f-xs); color: var(--t-400); }
    .cell-amount { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); text-align: right; }

    .vertical-cell { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-300); text-transform: capitalize; }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 14px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 130px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class AdminReservasComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly reservas = signal<ReservaAdmin[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly filtroEstado = signal('');
  readonly errorMsg = signal('');

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));

  readonly filtros = FILTROS_ESTADO;

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(
        this.adminApi.getReservas(this.paginaActual(), this.filtroEstado() || undefined),
      );
      this.reservas.set(result.items);
      this.total.set(result.total);
    } catch {
      this.errorMsg.set('Error cargando las reservas.');
    } finally {
      this.cargando.set(false);
    }
  }

  async setFiltro(estado: string): Promise<void> {
    this.filtroEstado.set(estado);
    this.paginaActual.set(1);
    await this.cargar();
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.paginaActual.set(pagina);
    await this.cargar();
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

  badgeEstado(estado: string): string {
    return ESTADO_BADGE[estado] ?? 'rs-badge--neutral';
  }
}
