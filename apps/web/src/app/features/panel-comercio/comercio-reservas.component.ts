import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiReserva } from './comercio-api.service';

const VERTICAL_ICON: Record<string, string> = {
  hoteles: 'hotel', vuelos: 'plane', taxis: 'car', transporte: 'truck', guarderia: 'users',
};

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success', pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error', completada: 'rs-badge--accent', no_show: 'rs-badge--neutral',
};

type FiltroEstado = 'todas' | 'confirmada' | 'pendiente' | 'cancelada' | 'completada';

const FILTROS: ReadonlyArray<{ valor: FiltroEstado; label: string }> = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'confirmada', label: 'Confirmadas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'cancelada', label: 'Canceladas' },
  { valor: 'completada', label: 'Completadas' },
];

@Component({
  selector: 'app-comercio-reservas',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RsIconComponent],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Reservas</h1>
        <p class="page-sub">Gestiona todas las reservas recibidas en tu comercio</p>
      </div>
    </div>

    <!-- FILTER PILLS -->
    <div class="filter-pills">
      @for (f of filtros; track f.valor) {
        <button
          class="filter-pill"
          [class.active]="filtroActivo() === f.valor"
          (click)="filtroActivo.set(f.valor)">
          {{ f.label }}
          <span class="filter-pill__count">{{ contarEstado(f.valor) }}</span>
        </button>
      }
    </div>

    @if (cargando()) {
      <div class="rs-card skeleton-wrap">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="skeleton-row"></div>
        }
      </div>
    } @else if (reservasFiltradas().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="calendar" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>No hay reservas{{ filtroActivo() !== 'todas' ? ' con este filtro' : ' aún' }}.</p>
        @if (filtroActivo() !== 'todas') {
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="filtroActivo.set('todas')">
            Ver todas las reservas
          </button>
        }
      </div>
    } @else {
      <div class="rs-card" style="overflow-x:auto">
        <table class="rs-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Vertical</th>
              <th>Fecha inicio</th>
              <th>Monto total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (r of reservasFiltradas(); track r._id) {
              <tr>
                <td><code>{{ r.codigo }}</code></td>
                <td class="vertical-cell">
                  <rs-icon [name]="iconVertical(r.vertical)" [size]="14" [stroke]="2"></rs-icon>
                  {{ r.vertical }}
                </td>
                <td>{{ r.fechaInicio | date:'d MMM yyyy' }}</td>
                <td>S/ {{ r.montoTotal | number:'1.2-2' }}</td>
                <td><span class="rs-badge {{ badgeEstado(r.estado) }}">{{ r.estado }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
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

    .filter-pills { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .filter-pill {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); }
      &.active { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    }
    .filter-pill__count {
      background: var(--c-surface); border-radius: var(--r-full);
      padding: 1px var(--sp-2); font-size: var(--f-xs); color: var(--t-400);
    }
    .filter-pill.active .filter-pill__count { background: rgba(22,104,227,.15); color: var(--c-accent); }

    .skeleton-wrap { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
    .skeleton-row {
      height: 44px;
      background: linear-gradient(90deg, var(--c-raised) 25%, var(--c-surface) 50%, var(--c-raised) 75%);
      background-size: 200% 100%;
      border-radius: var(--r-lg);
      animation: shimmer 1.5s infinite;
    }

    .empty-state {
      padding: var(--sp-16); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); }
    }

    .rs-table {
      width: 100%; border-collapse: collapse; font-size: var(--f-sm);
      th { color: var(--t-400); text-align: left; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--b-1); font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .06em; font-weight: var(--w-6); white-space: nowrap; }
      td { padding: var(--sp-4); border-bottom: 1px solid var(--b-1); color: var(--t-200); white-space: nowrap; }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--c-raised); }
      code { font-family: monospace; color: var(--c-accent); background: var(--c-accent-lo); padding: 2px var(--sp-2); border-radius: var(--r-sm); font-size: var(--f-xs); }
    }
    .vertical-cell { display: flex; align-items: center; gap: var(--sp-2); text-transform: capitalize; }
  `],
})
export class ComercioReservasComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly reservas = signal<MiReserva[]>([]);
  readonly filtroActivo = signal<FiltroEstado>('todas');

  readonly reservasFiltradas = computed(() => {
    const filtro = this.filtroActivo();
    if (filtro === 'todas') return this.reservas();
    return this.reservas().filter(r => r.estado === filtro);
  });

  readonly filtros = FILTROS;

  async ngOnInit(): Promise<void> {
    try {
      this.reservas.set(await firstValueFrom(this.comercioApi.getMisReservas()));
    } catch {
      this.errorMsg.set('Error al cargar las reservas. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  iconVertical(v: string): string { return VERTICAL_ICON[v] ?? 'building'; }
  badgeEstado(e: string): string { return ESTADO_BADGE[e] ?? 'rs-badge--neutral'; }
  contarEstado(filtro: FiltroEstado): number {
    if (filtro === 'todas') return this.reservas().length;
    return this.reservas().filter(r => r.estado === filtro).length;
  }
}
