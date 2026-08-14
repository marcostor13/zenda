import { Component, OnInit, HostListener, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ReservaAdmin, ResumenReservas, FiltrosReservasAdmin, CambioEstadoReserva } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

/** Estado de la reserva: color del badge + icono Lucide (TCK-8010, sin emojis). */
interface EstadoMeta { badge: string; icono: string; label: string; }

const ESTADO_META: Record<string, EstadoMeta> = {
  pendiente:        { badge: 'rs-badge--warning', icono: 'hourglass',      label: 'Pendiente' },
  confirmada:       { badge: 'rs-badge--success', icono: 'check-circle',   label: 'Confirmada' },
  ajuste_solicitado:{ badge: 'rs-badge--warning', icono: 'alert-triangle', label: 'Ajuste solicitado' },
  en_curso:         { badge: 'rs-badge--accent',  icono: 'play',           label: 'En curso' },
  completada:       { badge: 'rs-badge--accent',  icono: 'badge-check',    label: 'Completada' },
  pago_retenido:    { badge: 'rs-badge--warning', icono: 'lock',           label: 'Pago retenido' },
  pago_liberado:    { badge: 'rs-badge--success', icono: 'banknote',       label: 'Pago liberado' },
  en_disputa:       { badge: 'rs-badge--error',   icono: 'siren',          label: 'En disputa' },
  reembolsada:      { badge: 'rs-badge--neutral', icono: 'rotate-ccw',     label: 'Reembolsada' },
  cancelada:        { badge: 'rs-badge--error',   icono: 'x',              label: 'Cancelada' },
  no_show:          { badge: 'rs-badge--neutral', icono: 'circle',         label: 'No show' },
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

/** Contadores de la cabecera: los estados que el admin mira a diario. */
const RESUMEN_ESTADOS: ReadonlyArray<{ estado: string; label: string }> = [
  { estado: '', label: 'Reservas totales' },
  { estado: 'pendiente', label: 'Pendientes' },
  { estado: 'confirmada', label: 'Confirmadas' },
  { estado: 'en_curso', label: 'En curso' },
  { estado: 'completada', label: 'Completadas' },
  { estado: 'cancelada', label: 'Canceladas' },
  { estado: 'en_disputa', label: 'En disputa' },
];

/** Estado del pago, que no es el de la reserva (TCK-8036). */
const PAGO_BADGE: Record<string, string> = {
  aprobado: 'rs-badge--success',
  iniciado: 'rs-badge--warning',
  rechazado: 'rs-badge--error',
  reembolsado: 'rs-badge--neutral',
  sin_pago: 'rs-badge--neutral',
};

const PAGO_LABEL: Record<string, string> = {
  aprobado: 'Pagado',
  iniciado: 'Pago iniciado',
  rechazado: 'Pago rechazado',
  reembolsado: 'Reembolsado',
  sin_pago: 'Sin pago',
};

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
    </div>

    <!-- Resumen: estados a la izquierda, dinero a la derecha (TCK-8036) -->
    <div class="resumen-reservas">
      @for (e of resumenEstados; track e.estado) {
        <button class="resumen-tile" [class.activa]="filtroEstado() === e.estado"
                (click)="setFiltro(filtroEstado() === e.estado ? '' : e.estado)">
          <span class="resumen-tile__num">{{ contarEstado(e.estado) }}</span>
          <span class="resumen-tile__lbl">{{ e.label }}</span>
        </button>
      }
    </div>
    <div class="resumen-dinero">
      <div class="rs-card dinero-tile">
        <span class="dinero-tile__num">{{ resumen()?.importeReservado ?? 0 | number:'1.0-0' }} €</span>
        <span class="dinero-tile__lbl">Importe reservado</span>
      </div>
      <div class="rs-card dinero-tile">
        <span class="dinero-tile__num">{{ resumen()?.comisiones ?? 0 | number:'1.0-0' }} €</span>
        <span class="dinero-tile__lbl">Comisiones Doogking</span>
      </div>
      <div class="rs-card dinero-tile">
        <span class="dinero-tile__num">{{ resumen()?.pagosRetenidos ?? 0 | number:'1.0-0' }} €</span>
        <span class="dinero-tile__lbl">Pagos retenidos</span>
      </div>
      <div class="rs-card dinero-tile">
        <span class="dinero-tile__num">{{ resumen()?.reembolsos ?? 0 | number:'1.0-0' }} €</span>
        <span class="dinero-tile__lbl">Reembolsos</span>
      </div>
    </div>

    <!-- Buscador global -->
    <div class="search-bar">
      <input type="text" class="rs-inp" placeholder="Buscar por código, cliente, comercio o email…"
             [(ngModel)]="buscarInput" (keyup.enter)="aplicarBusqueda()" />
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="aplicarBusqueda()">Buscar</button>
      @if (buscarActivo()) {
        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarBusqueda()">
            <rs-icon name="x" [size]="13" [stroke]="3"></rs-icon> Limpiar
          </button>
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
          <span>Fecha</span>
          <span>Cliente</span>
          <span>Comercio</span>
          <span>Servicio</span>
          <span style="text-align:right">Importe</span>
          <span style="text-align:right">Comisión</span>
          <span>Estado reserva</span>
          <span>Estado pago</span>
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
              <button class="cell-mono cell-codigo" data-col="Código" (click)="toggleTimeline(r._id)">
                {{ r.codigo }}
              </button>
              <span class="cell-txt" data-col="Fecha">{{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy' }}</span>
              <span class="cell-txt" data-col="Cliente">
                {{ r.cliente }}
                @if (r.clienteEmail) { <span class="cell-sub">{{ r.clienteEmail }}</span> }
              </span>
              <span class="cell-txt" data-col="Comercio">{{ r.comercio }}</span>
              <span class="cell-txt" data-col="Servicio">{{ r.servicio || r.vertical }}</span>
              <span class="cell-amount" data-col="Importe">{{ r.montoTotal | number:'1.2-2' }} €</span>
              <span class="cell-amount cell-green" data-col="Comisión">{{ r.comisionMonto | number:'1.2-2' }} €</span>
              <span data-col="Estado reserva">
                <span class="rs-badge {{ meta(r.estado).badge }}">
                  <rs-icon [name]="meta(r.estado).icono" [size]="12" [stroke]="2"></rs-icon>
                  {{ meta(r.estado).label }}
                </span>
              </span>
              <!-- Estado del pago aparte: cancelada y reembolsada no son lo mismo (TCK-8036) -->
              <span data-col="Estado pago">
                <span class="rs-badge {{ badgePago(r.estadoPago) }}">{{ labelPago(r.estadoPago) }}</span>
              </span>
              <span class="cell-actions" (click)="$event.stopPropagation()">
                <button class="rs-btn rs-btn--ghost rs-btn--sm" aria-label="Acciones"
                        (click)="menuAbiertoId.set(menuAbiertoId() === r._id ? null : r._id)">
                  <rs-icon name="more-horizontal" [size]="15" [stroke]="2"></rs-icon>
                </button>
                @if (menuAbiertoId() === r._id) {
                  <div class="acciones__menu">
                    <button class="acciones__item" (click)="toggleTimeline(r._id)">
                      <rs-icon name="clock" [size]="13" [stroke]="2"></rs-icon> Ver reserva e historial
                    </button>
                    @if (r.estado !== 'pago_liberado' && r.estado !== 'reembolsada' && r.estado !== 'cancelada') {
                      <button class="acciones__item" [disabled]="accionandoId() === r._id"
                              (click)="cambiar(r, 'pago_liberado')">
                        <rs-icon name="banknote" [size]="13" [stroke]="2"></rs-icon> Liberar pago
                      </button>
                    }
                    @if (r.estado !== 'reembolsada' && r.estado !== 'cancelada') {
                      <button class="acciones__item" [disabled]="accionandoId() === r._id"
                              (click)="pedirMotivo(r, 'reembolsada')">
                        <rs-icon name="rotate-ccw" [size]="13" [stroke]="2"></rs-icon> Reembolsar
                      </button>
                    }
                    @if (r.estado !== 'en_disputa') {
                      <button class="acciones__item acciones__item--danger" [disabled]="accionandoId() === r._id"
                              (click)="pedirMotivo(r, 'en_disputa')">
                        <rs-icon name="siren" [size]="13" [stroke]="2"></rs-icon> Abrir incidencia
                      </button>
                    }
                  </div>
                }
              </span>
            </div>
            @if (expandidoId() === r._id) {
              <div class="timeline-row">
                <!-- Ficha administrativa completa (TCK-8036 §6) -->
                <h4><rs-icon name="eye" [size]="15" [stroke]="2"></rs-icon> Reserva {{ r.codigo }}</h4>
                <dl class="ficha">
                  <div><dt>Cliente</dt><dd>{{ r.cliente }}@if (r.clienteEmail) { · {{ r.clienteEmail }} }</dd></div>
                  <div><dt>Mascota</dt><dd>{{ r.perroNombre || '—' }}</dd></div>
                  <div><dt>Comercio</dt><dd>{{ r.comercio }}</dd></div>
                  <div><dt>Servicio</dt><dd>{{ r.servicio || r.vertical }}</dd></div>
                  <div>
                    <dt>Fechas</dt>
                    <dd>
                      {{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy, HH:mm' }}
                      @if (r.fechaFin) { → {{ r.fechaFin | date:'d MMM yyyy, HH:mm' }} }
                    </dd>
                  </div>
                  <div><dt>Importe</dt><dd>{{ (r.montoAjustado ?? r.montoTotal) | number:'1.2-2' }} €</dd></div>
                  <div><dt>Comisión Doogking</dt><dd>{{ r.comisionMonto | number:'1.2-2' }} €</dd></div>
                  <div><dt>Coste de pasarela</dt><dd>{{ (r.stripeFee ?? 0) | number:'1.2-2' }} €</dd></div>
                  <div><dt>Neto del comercio</dt><dd>{{ (r.montoLiquidacion ?? 0) | number:'1.2-2' }} €</dd></div>
                  <div><dt>Estado del pago</dt><dd>{{ labelPago(r.estadoPago) }}</dd></div>
                </dl>

                @if (r.suplementos?.length) {
                  <p class="ficha__extras">
                    <strong>Extras y suplementos:</strong>
                    @for (sup of r.suplementos; track $index) {
                      {{ sup.concepto }} (+{{ sup.monto | number:'1.2-2' }} €){{ $last ? '' : ' · ' }}
                    }
                  </p>
                }

                <h4><rs-icon name="clock" [size]="15" [stroke]="2"></rs-icon> Historial de la reserva</h4>
                @if (r.historialEstados?.length) {
                  <ol class="timeline">
                    @for (h of r.historialEstados; track $index) {
                      <li>
                        <span class="timeline__dot">
                          <rs-icon [name]="meta(h.estado).icono" [size]="13" [stroke]="2"></rs-icon>
                        </span>
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
              <span class="empty-icon"><rs-icon name="calendar" [size]="34" [stroke]="1.5"></rs-icon></span>
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
          <h3>
            <rs-icon [name]="meta(modalEstado()).icono" [size]="16" [stroke]="2"></rs-icon>
            {{ meta(modalEstado()).label }} · {{ modalReserva()!.codigo }}
          </h3>
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

    .resumen-reservas { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sp-2); margin-bottom: var(--sp-3); }
    .resumen-tile {
      display: flex; flex-direction: column; gap: 2px; text-align: left;
      padding: var(--sp-3) var(--sp-4); cursor: pointer;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      transition: all var(--d-2);
    }
    .resumen-tile:hover { border-color: var(--c-accent); }
    .resumen-tile.activa { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .resumen-tile__num { font-family: var(--font-accent); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100); }
    .resumen-tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .resumen-dinero { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .dinero-tile { padding: var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
    .dinero-tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .dinero-tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .cell-codigo {
      background: none; border: none; padding: 0; text-align: left; cursor: pointer;
      color: var(--c-accent); font-family: monospace; text-decoration: underline dotted;
    }
    .cell-sub { display: block; font-size: var(--f-xs); color: var(--t-400); }

    .ficha {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: var(--sp-3); margin: var(--sp-3) 0 var(--sp-4);
    }
    .ficha dt { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .ficha dd { font-size: var(--f-sm); color: var(--t-100); }
    .ficha__extras { font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-4); }

    .cell-actions { position: relative; }
    .acciones__menu {
      position: absolute; right: 0; top: calc(100% + 4px); z-index: var(--z-2);
      min-width: 210px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
    }
    .acciones__item {
      display: flex; align-items: center; gap: var(--sp-2); width: 100%;
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer; text-align: left;
      font-size: var(--f-sm); color: var(--t-200);
    }
    .acciones__item:hover { background: var(--c-raised); }
    .acciones__item--danger { color: var(--c-red, #B91C1C); }

    .tbl-head { display: grid; grid-template-columns: 140px 110px 1.2fr 1fr 1fr 110px 110px 150px 130px 70px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 140px 110px 1.2fr 1fr 1fr 110px 110px 150px 130px 70px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; &:last-child { border: none; } &:hover { background: var(--c-raised); } }

    /*
     * Móvil: la tabla deja de serlo. Sin esto la única salida era el scroll
     * lateral, que obliga a arrastrar para leer una sola reserva.
     */
    @media (max-width: 768px) {
      .tbl-wrap { min-width: 0; }
      .tbl-head { display: none; }

      .tbl-row {
        grid-template-columns: 1fr;
        gap: var(--sp-2);
        padding: var(--sp-4) var(--sp-5);
        border-bottom: 6px solid var(--c-base);
      }

      .tbl-row > [data-col] {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-4);
        /* Un email o una razón social larga parte de línea en vez de desbordar. */
        overflow-wrap: anywhere;
        text-align: right;
        text-align: left;
      }

      .tbl-row > [data-col]::before {
        content: attr(data-col);
        flex: 0 0 auto;
        font-family: var(--font-accent);
        font-size: var(--f-xs);
        font-weight: var(--w-7);
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--t-400);
      }

    }

    .tbl-skeleton { pointer-events: none; }

    .cell-mono { font-family: monospace; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .cell-txt { font-size: var(--f-sm); color: var(--t-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell-amount { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); text-align: right; }
    .cell-green { color: #047857; }
    .cell-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

    /*
     * Móvil: las acciones son el pie de la tarjeta, no una celda más. Se alinean
     * a la izquierda tras un separador y los botones con texto reparten el ancho;
     * los de solo icono se quedan cuadrados al final en vez de estirarse.
     */
    @media (max-width: 768px) {
      .cell-actions {
        justify-content: flex-start;
        gap: var(--sp-2);
        margin-top: var(--sp-1);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--b-1);
      }

      .cell-actions .rs-btn {
        /* Dos botones con texto por fila: repartir "auto" dejaba filas huérfanas. */
        flex: 1 1 calc(50% - var(--sp-2));
        justify-content: center;
        white-space: nowrap;
      }

      .cell-actions [data-icono] {
        flex: 0 0 44px;
        padding-inline: 0;
      }
    }


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
  readonly resumenEstados = RESUMEN_ESTADOS;
  readonly resumen = signal<ResumenReservas | null>(null);
  readonly menuAbiertoId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
    try {
      this.resumen.set(await firstValueFrom(this.adminApi.getResumenReservas()));
    } catch {
      // Sin resumen los contadores salen a cero; la tabla sigue funcionando.
    }
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

  /** El menu de acciones se cierra al pulsar fuera. */
  @HostListener('document:click')
  cerrarMenu(): void {
    this.menuAbiertoId.set(null);
  }

  contarEstado(estado: string): number {
    const resumen = this.resumen();
    if (!resumen) return 0;
    return estado === '' ? resumen.total : (resumen.porEstado[estado] ?? 0);
  }

  badgePago(estado?: string): string {
    return PAGO_BADGE[estado ?? 'sin_pago'] ?? 'rs-badge--neutral';
  }

  labelPago(estado?: string): string {
    return PAGO_LABEL[estado ?? 'sin_pago'] ?? (estado ?? '—');
  }

  meta(estado: string): EstadoMeta {
    return ESTADO_META[estado] ?? { badge: 'rs-badge--neutral', emoji: '•', label: estado };
  }
}
