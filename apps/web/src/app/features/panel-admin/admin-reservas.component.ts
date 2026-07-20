import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ReservaAdmin, FiltrosReservasAdmin, CambioEstadoReserva } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

interface EstadoMeta { badge: string; emoji: string; label: string; }

const ESTADO_META: Record<string, EstadoMeta> = {
  pendiente:        { badge: 'rs-badge--warning', emoji: '🟡', label: 'Pendiente' },
  confirmada:       { badge: 'rs-badge--success', emoji: '🟢', label: 'Confirmada' },
  ajuste_solicitado:{ badge: 'rs-badge--warning', emoji: '⚠️', label: 'Ajuste solicitado' },
  en_curso:         { badge: 'rs-badge--accent',  emoji: '🔵', label: 'En curso' },
  completada:       { badge: 'rs-badge--accent',  emoji: '✅', label: 'Completada' },
  pago_retenido:    { badge: 'rs-badge--warning', emoji: '🟣', label: 'Pago retenido' },
  pago_liberado:    { badge: 'rs-badge--success', emoji: '🟢', label: 'Pago liberado' },
  en_disputa:       { badge: 'rs-badge--error',   emoji: '🔴', label: 'En disputa' },
  reembolsada:      { badge: 'rs-badge--neutral', emoji: '↩️', label: 'Reembolsada' },
  cancelada:        { badge: 'rs-badge--error',   emoji: '⚫', label: 'Cancelada' },
  no_show:          { badge: 'rs-badge--neutral', emoji: '⚫', label: 'No show' },
};

const FILTROS_ESTADO = [
  { label: 'Todas', valor: '' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Confirmadas', valor: 'confirmada' },
  { label: 'En curso', valor: 'en_curso' },
  { label: 'Completadas', valor: 'completada' },
  { label: 'Pago retenido', valor: 'pago_retenido' },
  { label: 'Pago liberado', valor: 'pago_liberado' },
  { label: 'En disputa', valor: 'en_disputa' },
  { label: 'Reembolsadas', valor: 'reembolsada' },
  { label: 'Canceladas', valor: 'cancelada' },
] as const;

const LIMITE = 20;

@Component({
  selector: 'app-admin-reservas',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RsIconComponent],
  template: `
    <!-- Cabecera -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestión de reservas</h1>
        <p class="page-sub">Centro de operaciones del marketplace: supervisa y gestiona todas las reservas.</p>
      </div>
      <div class="page-kpi rs-card">
        <span class="kpi-num">{{ total() }}</span>
        <span class="kpi-lbl">{{ filtroEstado() || 'total' }}</span>
      </div>
    </div>

    <!-- Buscador global -->
    <div class="search-bar">
      <input type="text" class="rs-inp" placeholder="Buscar por código (ej. RES-584921)…"
             [(ngModel)]="buscarInput" (keyup.enter)="aplicarBusqueda()" />
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="aplicarBusqueda()">Buscar</button>
      @if (buscarActivo()) {
        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarBusqueda()">✕ Limpiar</button>
      }
    </div>

    <!-- Filtros por estado (semáforo) -->
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
    @if (okMsg()) {
      <div class="rs-alert rs-alert--success" style="margin-bottom:var(--sp-4)">{{ okMsg() }}</div>
    }

    <!-- Tabla (scroll horizontal propio para móvil) -->
    <div class="rs-card" style="padding:0;overflow-x:auto">
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span>Código</span>
          <span>Cliente</span>
          <span>Comercio</span>
          <span style="text-align:right">Importe</span>
          <span style="text-align:right">Comisión</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        @if (cargando()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="tbl-row tbl-skeleton">
              <div class="skel skel--md"></div><div class="skel skel--sm"></div>
              <div class="skel skel--sm"></div><div class="skel skel--sm"></div>
              <div class="skel skel--sm"></div><div class="skel skel--sm"></div>
              <div class="skel skel--sm"></div>
            </div>
          }
        } @else {
          @for (r of reservas(); track r._id) {
            <div class="tbl-row">
              <span class="cell-mono">{{ r.codigo }}</span>
              <span class="cell-txt">{{ r.cliente }}</span>
              <span class="cell-txt">{{ r.comercio }}</span>
              <span class="cell-amount">{{ r.montoTotal | number:'1.2-2' }} €</span>
              <span class="cell-amount cell-green">{{ r.comisionMonto | number:'1.2-2' }} €</span>
              <span><span class="rs-badge {{ meta(r.estado).badge }}">{{ meta(r.estado).emoji }} {{ meta(r.estado).label }}</span></span>
              <span class="cell-actions">
                <button class="rs-btn rs-btn--ghost rs-btn--xs" title="Ver timeline"
                        (click)="toggleTimeline(r._id)">🕑</button>
                @if (r.estado !== 'pago_liberado' && r.estado !== 'reembolsada' && r.estado !== 'cancelada') {
                  <button class="rs-btn rs-btn--ghost rs-btn--xs" title="Liberar pago"
                          [disabled]="accionandoId() === r._id" (click)="cambiar(r, 'pago_liberado')">💸 Liberar</button>
                }
                @if (r.estado !== 'reembolsada' && r.estado !== 'cancelada') {
                  <button class="rs-btn rs-btn--ghost rs-btn--xs" title="Reembolsar"
                          [disabled]="accionandoId() === r._id" (click)="pedirMotivo(r, 'reembolsada')">↩️ Reembolsar</button>
                }
                @if (r.estado !== 'en_disputa') {
                  <button class="rs-btn rs-btn--ghost rs-btn--xs" title="Abrir incidencia"
                          [disabled]="accionandoId() === r._id" (click)="pedirMotivo(r, 'en_disputa')">🔴 Disputa</button>
                }
              </span>
            </div>
            @if (expandidoId() === r._id) {
              <div class="timeline-row">
                <h4>🕑 Timeline de la reserva {{ r.codigo }}</h4>
                @if (r.historialEstados?.length) {
                  <ol class="timeline">
                    @for (h of r.historialEstados; track $index) {
                      <li>
                        <span class="timeline__dot">{{ meta(h.estado).emoji }}</span>
                        <span class="timeline__estado">{{ meta(h.estado).label }}</span>
                        <span class="timeline__meta">{{ h.at | date:'d MMM yyyy, HH:mm' }} · {{ h.por }}</span>
                        @if (h.motivo) { <span class="timeline__motivo">"{{ h.motivo }}"</span> }
                      </li>
                    }
                  </ol>
                } @else {
                  <p style="color:var(--t-400);font-size:var(--f-sm)">Sin eventos registrados todavía.</p>
                }
              </div>
            }
          }
          @if (reservas().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">📅</span>
              <p>No hay reservas{{ filtroEstado() ? ' con estado "' + meta(filtroEstado()).label + '"' : '' }}</p>
            </div>
          }
        }
      </div>
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button class="rs-btn rs-btn--secondary rs-btn--sm" [disabled]="paginaActual() <= 1"
                (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} reservas</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm" [disabled]="paginaActual() >= totalPaginas()"
                (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
      </div>
    }

    <!-- Modal de motivo (disputa / reembolso) -->
    @if (modalReserva()) {
      <div class="modal-backdrop" (click)="cerrarModal()">
        <div class="modal rs-card" (click)="$event.stopPropagation()">
          <h3>{{ meta(modalEstado()).emoji }} {{ meta(modalEstado()).label }} · {{ modalReserva()!.codigo }}</h3>
          <p style="color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-3)">
            Indica el motivo (quedará registrado en el timeline de la reserva).
          </p>
          <textarea class="rs-inp" rows="3" [(ngModel)]="modalMotivo"
                    placeholder="Ej. Servicio no prestado / cliente no se presentó…"></textarea>
          <div style="display:flex;gap:var(--sp-2);justify-content:flex-end;margin-top:var(--sp-4)">
            <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarModal()">Cancelar</button>
            <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="confirmarMotivo()">Confirmar</button>
          </div>
        </div>
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

    .search-bar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); flex-wrap: wrap; .rs-inp { flex: 1; min-width: 220px; } }
    .filter-bar { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5); flex-wrap: wrap; }

    .tbl-wrap { min-width: 920px; }
    .tbl-head { display: grid; grid-template-columns: 150px 1fr 1fr 120px 120px 160px 220px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 150px 1fr 1fr 120px 120px 160px 220px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; &:last-child { border: none; } &:hover { background: var(--c-raised); } }
    .tbl-skeleton { pointer-events: none; }

    .cell-mono { font-family: monospace; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .cell-txt { font-size: var(--f-sm); color: var(--t-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell-amount { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); text-align: right; }
    .cell-green { color: #047857; }
    .cell-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 14px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 130px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }

    .timeline-row { padding: var(--sp-4) var(--sp-6); background: var(--c-raised); border-bottom: 1px solid var(--b-1); h4 { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-3); } }
    .timeline { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); border-left: 2px solid var(--b-1); padding-left: var(--sp-4); margin-left: var(--sp-2); }
    .timeline li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); position: relative; }
    .timeline__dot { position: absolute; left: calc(-1 * var(--sp-4) - 11px); }
    .timeline__estado { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .timeline__meta { font-size: var(--f-xs); color: var(--t-400); }
    .timeline__motivo { font-size: var(--f-xs); color: var(--t-300); font-style: italic; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 440px; padding: var(--sp-6); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); } textarea { width: 100%; resize: vertical; } }
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
  readonly okMsg = signal('');
  readonly accionandoId = signal('');
  readonly buscarActivo = signal(false);
  readonly expandidoId = signal('');
  readonly modalReserva = signal<ReservaAdmin | null>(null);
  readonly modalEstado = signal('');

  buscarInput = '';
  modalMotivo = '';

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));
  readonly filtros = FILTROS_ESTADO;

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private filtrosActuales(): FiltrosReservasAdmin {
    return {
      estado: this.filtroEstado() || undefined,
      buscar: this.buscarActivo() ? this.buscarInput.trim() : undefined,
    };
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(this.adminApi.getReservas(this.paginaActual(), this.filtrosActuales()));
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

  async aplicarBusqueda(): Promise<void> {
    this.buscarActivo.set(this.buscarInput.trim().length > 0);
    this.paginaActual.set(1);
    await this.cargar();
  }

  async limpiarBusqueda(): Promise<void> {
    this.buscarInput = '';
    this.buscarActivo.set(false);
    this.paginaActual.set(1);
    await this.cargar();
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.paginaActual.set(pagina);
    await this.cargar();
  }

  toggleTimeline(id: string): void {
    this.expandidoId.update((actual) => (actual === id ? '' : id));
  }

  /** Estados con impacto (disputa/reembolso) piden un motivo antes de ejecutar. */
  pedirMotivo(reserva: ReservaAdmin, estado: string): void {
    this.modalReserva.set(reserva);
    this.modalEstado.set(estado);
    this.modalMotivo = '';
  }

  cerrarModal(): void {
    this.modalReserva.set(null);
    this.modalEstado.set('');
  }

  async confirmarMotivo(): Promise<void> {
    const reserva = this.modalReserva();
    const estado = this.modalEstado();
    const motivo = this.modalMotivo.trim() || undefined;
    this.cerrarModal();
    if (reserva) await this.cambiar(reserva, estado, motivo);
  }

  async cambiar(reserva: ReservaAdmin, estado: string, motivo?: string): Promise<void> {
    this.accionandoId.set(reserva._id);
    this.okMsg.set('');
    this.errorMsg.set('');
    try {
      const actualizada = await firstValueFrom(this.adminApi.cambiarEstadoReserva(reserva._id, estado, motivo));
      const evento: CambioEstadoReserva = { estado, motivo, por: 'admin', at: new Date().toISOString() };
      this.reservas.update((list) => list.map((r) =>
        r._id === reserva._id
          ? { ...r, estado: actualizada.estado, historialEstados: [...(r.historialEstados ?? []), evento] }
          : r,
      ));
      this.okMsg.set(`Reserva ${reserva.codigo} → ${this.meta(estado).label}.`);
      setTimeout(() => this.okMsg.set(''), 3000);
    } catch {
      this.errorMsg.set('No se pudo cambiar el estado de la reserva.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionandoId.set('');
    }
  }

  meta(estado: string): EstadoMeta {
    return ESTADO_META[estado] ?? { badge: 'rs-badge--neutral', emoji: '•', label: estado };
  }
}
