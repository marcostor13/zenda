import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';

type EstadoColor = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const HITO_LABEL: Record<string, string> = {
  recogida: 'Mascota recogida', en_ruta: 'En ruta', entregada: 'Mascota entregada',
  entrada: 'Entrada / check-in', salida: 'Salida / check-out', finalizada: 'Servicio finalizado',
};

const VERTICAL_META: Record<string, { label: string; icon: string; color: string }> = {
  [VerticalKey.ALOJAMIENTO]:    { label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],    icon: 'hotel',          color: '#08258B' },
  [VerticalKey.TRANSPORTE]:     { label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],     icon: 'truck',          color: '#FBAE17' },
  [VerticalKey.VETERINARIA]:    { label: VERTICAL_LABELS[VerticalKey.VETERINARIA],    icon: 'stethoscope',    color: '#16A34A' },
  [VerticalKey.PELUQUERIA]:     { label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],     icon: 'scissors',       color: '#EC4899' },
  [VerticalKey.ADIESTRAMIENTO]: { label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], icon: 'graduation-cap', color: '#9B5CF6' },
  [VerticalKey.HOTELES]:        { label: VERTICAL_LABELS[VerticalKey.HOTELES],        icon: 'building',       color: '#0EA5E9' },
};

const ESTADO_META: Record<string, { label: string; color: EstadoColor; icon: string; bg: string }> = {
  confirmada: { label: 'Confirmada',  color: 'success', icon: 'check-circle', bg: 'rgba(16,185,129,.12)' },
  pendiente:  { label: 'Pendiente',   color: 'warning', icon: 'clock',        bg: 'rgba(245,158,11,.12)' },
  cancelada:  { label: 'Cancelada',   color: 'danger',  icon: 'x-circle',     bg: 'rgba(239,68,68,.12)'  },
  completada: { label: 'Completada',  color: 'accent',  icon: 'star',         bg: 'rgba(79,114,248,.12)' },
  no_show:    { label: 'No presentado', color: 'neutral', icon: 'alert-circle', bg: 'rgba(107,114,128,.12)' },
};

@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, TitleCasePipe, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  @if (cargando()) {
    <div style="display:flex;align-items:center;justify-content:center;padding:var(--sp-24)">
      <div class="rs-spinner"></div>
    </div>
  }

  @if (error()) {
    <div class="rs-wrap" style="padding-block:var(--sp-10)">
      <div class="rs-alert rs-alert--error" style="max-width:480px">
        <rs-icon name="alert-circle" [size]="18" [stroke]="2"></rs-icon>
        {{ error() }}
      </div>
      <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--secondary" style="margin-top:var(--sp-5)">
        ← Volver a mis reservas
      </a>
    </div>
  }

  @if (reserva()) {
    <!-- ── Status header bar ────────────────────────────────────── -->
    <div class="status-bar" [style.background]="estadoMeta().bg">
      <div class="rs-wrap status-bar__inner">
        <div class="status-bar__left">
          <div class="status-dot" [class]="'status-dot--' + estadoMeta().color">
            <rs-icon [name]="estadoMeta().icon" [size]="16" [stroke]="2"></rs-icon>
          </div>
          <div>
            <div class="status-bar__estado">{{ estadoMeta().label }}</div>
            <div class="status-bar__code">{{ reserva()!.codigo }}</div>
          </div>
        </div>
        <div class="status-bar__date">
          Reservada el {{ reserva()!.createdAt | date:'d MMM y, HH:mm':'':'es' }}
        </div>
      </div>
    </div>

    <div class="rs-wrap" style="padding-block:var(--sp-8)">

      <nav class="breadcrumb">
        <a routerLink="/perfil">Mi perfil</a>
        <rs-icon name="chevron-right" [size]="12" [stroke]="2"></rs-icon>
        <a routerLink="/reservas/mis-reservas">Mis reservas</a>
        <rs-icon name="chevron-right" [size]="12" [stroke]="2"></rs-icon>
        <span>{{ reserva()!.codigo }}</span>
      </nav>

      <div class="detail-grid">

        <!-- ── COLUMNA IZQUIERDA ─────────────────────────────── -->
        <div class="detail-main">

          <!-- Service card -->
          <div class="rs-card service-card">
            <div class="service-card__header">
              <div class="service-icon" [style.background]="verticalMeta().color + '22'">
                <rs-icon [name]="verticalMeta().icon" [size]="22" [stroke]="1.75" [style.color]="verticalMeta().color"></rs-icon>
              </div>
              <div>
                <div class="service-vertical">{{ verticalMeta().label }}</div>
                <h2 class="service-name">{{ servicioTitulo() }}</h2>
              </div>
            </div>
          </div>

          <!-- Seguimiento en vivo -->
          @if (seguimiento().length) {
            <div class="rs-card seguimiento-card">
              <h3 class="seguimiento-card__title">
                🛰️ Seguimiento en vivo
                @if (esActiva()) { <span class="live-dot" title="Actualizando en tiempo real"></span> }
              </h3>
              <ol class="seg-timeline">
                @for (h of seguimiento(); track $index) {
                  <li>
                    <span class="seg-timeline__dot">🟢</span>
                    <span class="seg-timeline__label">{{ hitoLabel(h.hito) }}</span>
                    <span class="seg-timeline__time">{{ h.at | date:'d MMM, HH:mm':'':'es' }}</span>
                    @if (h.nota) { <span class="seg-timeline__nota">{{ h.nota }}</span> }
                  </li>
                }
              </ol>
            </div>
          }

          <!-- Dates -->
          <div class="rs-card info-card">
            <h3 class="info-card__title">
              <rs-icon name="calendar" [size]="15" [stroke]="2"></rs-icon>
              Fechas y detalles
            </h3>

            <div class="info-rows">
              <div class="info-row">
                <span class="info-row__label">Fecha de inicio</span>
                <span class="info-row__val">{{ reserva()!.fechaInicio | date:'EEEE, d MMMM y':'':'es' | titlecase }}</span>
              </div>
              @if (reserva()!.fechaFin) {
                <div class="info-row">
                  <span class="info-row__label">Fecha de fin</span>
                  <span class="info-row__val">{{ reserva()!.fechaFin | date:'EEEE, d MMMM y':'':'es' | titlecase }}</span>
                </div>
                <div class="info-row">
                  <span class="info-row__label">Duración</span>
                  <span class="info-row__val">{{ duracion() }}</span>
                </div>
              }
              <div class="info-row">
                <span class="info-row__label">Cantidad</span>
                <span class="info-row__val">{{ reserva()!.cantidad }} {{ reserva()!.cantidad === 1 ? 'unidad' : 'unidades' }}</span>
              </div>
            </div>

            <!-- Extra detalle fields -->
            @for (campo of detalleExtra(); track campo.key) {
              <div class="info-row" style="margin-top:var(--sp-1)">
                <span class="info-row__label">{{ campo.label }}</span>
                <span class="info-row__val">{{ campo.valor }}</span>
              </div>
            }
          </div>

          <!-- Coupon -->
          @if (reserva()!.cuponCodigo) {
            <div class="rs-card info-card" style="padding:var(--sp-4) var(--sp-5)">
              <div style="display:flex;align-items:center;gap:var(--sp-3)">
                <rs-icon name="tag" [size]="16" [stroke]="2" style="color:var(--c-accent)"></rs-icon>
                <div>
                  <div style="font-size:var(--f-xs);color:var(--t-400)">Cupón aplicado</div>
                  <div style="font-size:var(--f-sm);font-weight:var(--w-7);color:var(--t-100);font-family:monospace">
                    {{ reserva()!.cuponCodigo }}
                  </div>
                </div>
                <span class="rs-badge rs-badge--success" style="margin-left:auto">
                  −€{{ reserva()!.descuentoMonto | number:'1.2-2' }}
                </span>
              </div>
            </div>
          }

        </div>

        <!-- ── COLUMNA DERECHA ───────────────────────────────── -->
        <div class="detail-aside">

          <!-- Price breakdown -->
          <div class="rs-card price-card">
            <h3 class="price-card__title">Resumen de pago</h3>

            <div class="price-rows">
              <div class="price-row">
                <span>Subtotal</span>
                <span>€{{ reserva()!.montoSubtotal | number:'1.2-2' }}</span>
              </div>
              @if (reserva()!.descuentoMonto > 0) {
                <div class="price-row price-row--discount">
                  <span>
                    Descuento
                    @if (reserva()!.cuponCodigo) {
                      <span style="font-size:var(--f-xs);font-family:monospace"> ({{ reserva()!.cuponCodigo }})</span>
                    }
                  </span>
                  <span>−€{{ reserva()!.descuentoMonto | number:'1.2-2' }}</span>
                </div>
              }
              <div class="price-row">
                <span>IVA (21%)</span>
                <span>€{{ iva() | number:'1.2-2' }}</span>
              </div>
              <div class="price-row price-row--total">
                <span>Total</span>
                <span>€{{ reserva()!.montoTotal | number:'1.2-2' }}</span>
              </div>
            </div>

            <div class="price-currency">
              <rs-icon name="euro" [size]="12" [stroke]="2"></rs-icon>
              EUR · Precios con IVA incluido
            </div>
          </div>

          <!-- Payment status -->
          <div class="rs-card payment-card">
            <h3 class="payment-card__title">
              <rs-icon name="credit-card" [size]="15" [stroke]="2"></rs-icon>
              Estado del pago
            </h3>

            <div class="payment-status" [class]="'payment-status--' + estadoMeta().color">
              <rs-icon [name]="pagoIcon()" [size]="18" [stroke]="2"></rs-icon>
              <span>{{ pagoLabel() }}</span>
            </div>

            <!-- Stripe badge -->
            <div class="stripe-trust">
              <span class="stripe-trust__label">Procesado de forma segura por</span>
              <div class="stripe-logo">
                <svg width="48" height="20" viewBox="0 0 468 222" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe" role="img">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M0 22.1C0 9.9 9.9 0 22.1 0h423.8c12.2 0 22.1 9.9 22.1 22.1v177.8c0 12.2-9.9 22.1-22.1 22.1H22.1C9.9 222 0 212.1 0 199.9V22.1z" fill="#635BFF"/>
                  <path d="M224.4 88.6c0-4.1 3.4-5.7 9-5.7 8 0 18.2 2.4 26.2 6.7V63.7c-8.8-3.5-17.5-4.9-26.2-4.9-21.4 0-35.7 11.2-35.7 29.9 0 29.2 40.2 24.5 40.2 37.1 0 4.8-4.2 6.4-10.1 6.4-8.7 0-19.8-3.6-28.6-8.4v26.3c9.7 4.2 19.5 5.9 28.6 5.9 21.8 0 36.8-10.8 36.8-29.7-.1-31.5-40.2-25.9-40.2-37.7zM290 42.6l-26.8 5.7v21.5h-14.7v22.8h14.7v42.8c0 18.9 13.7 26.1 32.6 26.1 8 0 15.7-1.4 21-4.2v-22.5c-3.8 1.9-11.8 3.6-17.2 3.6-6.5 0-9.6-2.4-9.6-9.3V92.6h26.8V69.8H290V42.6zM339.4 78.5l-1.5-8.7h-24.1v89.7h27.8v-56.2c7.3-9.6 19.6-7.8 23.4-6.5V69.4c-4-1.4-18.3-4-25.6 9.1zM393.5 59.3c-8.9 0-14.7 5.8-14.7 14.5 0 8.6 5.8 14.5 14.7 14.5 8.9 0 14.7-5.9 14.7-14.5 0-8.7-5.8-14.5-14.7-14.5zm-13.9 100.2h27.8V69.8h-27.8v89.7zM131.7 113c0 15.2 10.4 25.6 23.9 25.6 13.6 0 22.1-7.9 24.4-19.7H153c-1.3 5-3.8 8-7.8 8-5.3 0-8.3-3.6-8.8-10.1h44.3c.2-2.1.3-4.2.3-6.2 0-22.8-12.5-35.6-31.2-35.6-18.6 0-29.4 12.3-29.4 29.3l-.1.1-.1.1.2 8.5zm12.3-11.8c1.3-6.2 4.7-10 9.3-10 5.2 0 8.3 3.7 8.6 10h-17.9zM108.3 78.1c-4.4-1.9-13.5-3.5-21.2 0-8.7 4-13.6 12.3-13.6 22.4v59h27.8v-55.4c0-6.4 4.2-10.1 9.4-10.1 2.9 0 5.3.8 7.1 2.2l.5-18.1z" fill="white"/>
                </svg>
              </div>
              <div class="stripe-trust__chips">
                <span class="stripe-chip">
                  <rs-icon name="shield-check" [size]="11" [stroke]="2.5"></rs-icon>
                  SSL 256-bit
                </span>
                <span class="stripe-chip">
                  <rs-icon name="lock" [size]="11" [stroke]="2.5"></rs-icon>
                  PCI DSS Nivel 1
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="actions-card">

            @if (reserva()!.estado === 'pendiente') {
              <button
                class="rs-btn rs-btn--primary rs-btn--block"
                [disabled]="procesando()"
                (click)="irAPagar()">
                @if (procesando()) {
                  <span class="rs-spin"></span> Procesando…
                } @else {
                  <rs-icon name="credit-card" [size]="16" [stroke]="2"></rs-icon>
                  Completar pago — €{{ reserva()!.montoTotal | number:'1.2-2' }}
                }
              </button>
            }

            @if (puedeCancelar()) {
              <button
                class="rs-btn rs-btn--danger rs-btn--block"
                [disabled]="cancelando()"
                (click)="cancelar()">
                @if (cancelando()) {
                  <span class="rs-spin"></span> Cancelando…
                } @else {
                  <rs-icon name="x-circle" [size]="16" [stroke]="2"></rs-icon>
                  Cancelar reserva
                }
              </button>
            }

            <a routerLink="/reservas/mis-reservas"
               class="rs-btn rs-btn--ghost rs-btn--block">
              <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
              Volver a mis reservas
            </a>

            @if (errorAccion()) {
              <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ errorAccion() }}</div>
            }
          </div>

        </div>
      </div>

    </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Status bar ───────────────────────────────────────────── */
    .status-bar {
      border-bottom: 1px solid var(--b-1);
      padding-block: var(--sp-4);
    }
    .status-bar__inner {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: var(--sp-3);
    }
    .status-bar__left { display: flex; align-items: center; gap: var(--sp-3); }
    .status-dot {
      width: 36px; height: 36px; border-radius: var(--r-lg);
      display: flex; align-items: center; justify-content: center;
    }
    .status-dot--success { background: rgba(16,185,129,.15); color: #10B981; }
    .status-dot--warning { background: rgba(245,158,11,.15); color: #F59E0B; }
    .status-dot--danger  { background: rgba(239,68,68,.15);  color: #EF4444; }
    .status-dot--accent  { background: rgba(79,114,248,.15); color: #4F72F8; }
    .status-dot--neutral { background: rgba(107,114,128,.15);color: #6B7280; }

    .status-bar__estado {
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
    }
    .status-bar__code {
      font-size: var(--f-xs); color: var(--t-400); font-family: monospace; letter-spacing: .04em;
    }
    .status-bar__date { font-size: var(--f-xs); color: var(--t-400); }

    /* ── Seguimiento en vivo ──────────────────────────────────── */
    .seguimiento-card { padding: var(--sp-5); margin-bottom: var(--sp-5); }
    .seguimiento-card__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-4); display: flex; align-items: center; gap: var(--sp-2); }
    .live-dot { width: 9px; height: 9px; border-radius: 50%; background: #10B981; box-shadow: 0 0 0 0 rgba(16,185,129,.6); animation: livePulse 1.6s infinite; }
    @keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.6); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
    .seg-timeline { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); border-left: 2px solid var(--b-1); padding-left: var(--sp-4); margin-left: var(--sp-2); }
    .seg-timeline li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); position: relative; }
    .seg-timeline__dot { position: absolute; left: calc(-1 * var(--sp-4) - 12px); font-size: 10px; }
    .seg-timeline__label { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .seg-timeline__time { font-size: var(--f-xs); color: var(--t-400); }
    .seg-timeline__nota { font-size: var(--f-xs); color: var(--t-300); font-style: italic; width: 100%; }

    /* ── Breadcrumb ───────────────────────────────────────────── */
    .breadcrumb {
      display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-7);
      font-size: var(--f-xs); color: var(--t-400);
      a { color: var(--t-400); text-decoration: none; &:hover { color: var(--c-accent); } }
      span { color: var(--t-200); }
    }

    /* ── Grid layout ──────────────────────────────────────────── */
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: var(--sp-6);
      align-items: start;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }
    .detail-main { display: flex; flex-direction: column; gap: var(--sp-4); }
    .detail-aside { display: flex; flex-direction: column; gap: var(--sp-4); }

    /* ── Service card ─────────────────────────────────────────── */
    .service-card { padding: var(--sp-5) var(--sp-6); }
    .service-card__header { display: flex; align-items: center; gap: var(--sp-4); }
    .service-icon {
      width: 48px; height: 48px; border-radius: var(--r-xl);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .service-vertical { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }
    .service-name { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-top: var(--sp-1); }

    /* ── Info card ────────────────────────────────────────────── */
    .info-card { padding: var(--sp-5) var(--sp-6); }
    .info-card__title {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200);
      margin-bottom: var(--sp-5); text-transform: uppercase; letter-spacing: .06em;
    }
    .info-rows { display: flex; flex-direction: column; gap: var(--sp-3); }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: var(--sp-3); border-bottom: 1px solid var(--b-1);
      &:last-child { border-bottom: none; padding-bottom: 0; }
    }
    .info-row__label { font-size: var(--f-sm); color: var(--t-400); }
    .info-row__val { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); text-align: right; max-width: 60%; }

    /* ── Price card ───────────────────────────────────────────── */
    .price-card { padding: var(--sp-5) var(--sp-6); }
    .price-card__title {
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200);
      text-transform: uppercase; letter-spacing: .06em; margin-bottom: var(--sp-5);
    }
    .price-rows { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-5); }
    .price-row {
      display: flex; justify-content: space-between;
      font-size: var(--f-sm); color: var(--t-300);
      padding-bottom: var(--sp-3); border-bottom: 1px solid var(--b-1);
      &:last-child { border-bottom: none; padding-bottom: 0; }
    }
    .price-row--discount { color: #10B981; font-weight: var(--w-5); }
    .price-row--total {
      font-size: var(--f-base); font-weight: var(--w-8); color: var(--t-100);
      padding-top: var(--sp-3); border-top: 1px solid var(--b-2); border-bottom: none;
    }
    .price-currency {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-xs); color: var(--t-500);
    }

    /* ── Payment card ─────────────────────────────────────────── */
    .payment-card { padding: var(--sp-5) var(--sp-6); }
    .payment-card__title {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200);
      text-transform: uppercase; letter-spacing: .06em; margin-bottom: var(--sp-4);
    }
    .payment-status {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg);
      font-size: var(--f-sm); font-weight: var(--w-5); margin-bottom: var(--sp-5);
    }
    .payment-status--success { background: rgba(16,185,129,.12); color: #10B981; }
    .payment-status--warning { background: rgba(245,158,11,.12); color: #F59E0B; }
    .payment-status--danger  { background: rgba(239,68,68,.12);  color: #EF4444; }
    .payment-status--accent  { background: rgba(79,114,248,.12); color: #7AA3FF; }
    .payment-status--neutral { background: rgba(107,114,128,.12);color: #9CA3AF; }

    /* ── Stripe trust ─────────────────────────────────────────── */
    .stripe-trust {
      display: flex; flex-direction: column; gap: var(--sp-2);
      padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg);
      border: 1px solid var(--b-1);
    }
    .stripe-trust__label { font-size: var(--f-xs); color: var(--t-400); }
    .stripe-logo {
      display: flex; align-items: center;
      svg { display: block; }
    }
    .stripe-trust__chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-1); }
    .stripe-chip {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      font-size: 10px; color: var(--t-400); background: var(--c-card);
      padding: 3px var(--sp-2); border-radius: var(--r-full); border: 1px solid var(--b-1);
    }

    /* ── Actions ──────────────────────────────────────────────── */
    .actions-card { display: flex; flex-direction: column; gap: var(--sp-3); }

    /* spinner */
    .rs-spin {
      display: inline-block; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .7s linear infinite; vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class ReservaDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reservasService = inject(ReservasService);
  private readonly paymentsService = inject(PaymentsService);

  private pollId?: ReturnType<typeof setInterval>;

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly reserva = signal<ReservaApi | null>(null);
  readonly procesando = signal(false);
  readonly cancelando = signal(false);
  readonly errorAccion = signal('');

  readonly estadoMeta = computed(() => {
    const estado = this.reserva()?.estado ?? 'pendiente';
    return ESTADO_META[estado] ?? ESTADO_META['pendiente'];
  });

  readonly verticalMeta = computed(() => {
    const v = this.reserva()?.vertical ?? '';
    return VERTICAL_META[v] ?? { label: v, icon: 'paw', color: '#6B7280' };
  });

  readonly servicioTitulo = computed(() => {
    const r = this.reserva();
    if (!r) return '';
    return (r.detalle?.['titulo'] as string)
      ?? (r.detalle?.['nombre'] as string)
      ?? `${this.verticalMeta().label} · ${r.servicioId.slice(-6)}`;
  });

  readonly iva = computed(() => {
    const r = this.reserva();
    if (!r) return 0;
    return r.montoTotal - r.montoSubtotal + r.descuentoMonto;
  });

  readonly puedeCancelar = computed(() => {
    const estado = this.reserva()?.estado;
    return estado === 'confirmada' || estado === 'pendiente';
  });

  readonly seguimiento = computed(() => this.reserva()?.seguimiento ?? []);
  readonly esActiva = computed(() => {
    const e = this.reserva()?.estado;
    return e === 'confirmada' || e === 'en_curso';
  });

  hitoLabel(hito: string): string { return HITO_LABEL[hito] ?? hito; }

  readonly duracion = computed(() => {
    const r = this.reserva();
    if (!r?.fechaFin) return '';
    const inicio = new Date(r.fechaInicio);
    const fin = new Date(r.fechaFin);
    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000);
    if (dias === 1) return '1 noche';
    if (dias > 1) return `${dias} noches`;
    const horas = Math.round((fin.getTime() - inicio.getTime()) / 3600000);
    return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  });

  readonly detalleExtra = computed(() => {
    const detalle = this.reserva()?.detalle ?? {};
    const ignorar = new Set(['titulo', 'nombre', 'imagen', 'imagenes']);
    const LABELS: Record<string, string> = {
      espacioId: 'Espacio', tamanoPerro: 'Tamaño del perro', perros: 'Perros',
      origen: 'Origen', destino: 'Destino', distanciaKm: 'Distancia (km)',
      tipoVehiculo: 'Tipo de vehículo', hora: 'Hora', servicio: 'Servicio',
      modalidad: 'Modalidad', edadMeses: 'Edad (meses)',
    };
    return Object.entries(detalle)
      .filter(([k, v]) => !ignorar.has(k) && v != null && v !== '')
      .map(([k, v]) => ({ key: k, label: LABELS[k] ?? k, valor: String(v) }));
  });

  pagoIcon(): string {
    const estado = this.reserva()?.estado;
    if (estado === 'confirmada' || estado === 'completada') return 'check-circle';
    if (estado === 'cancelada') return 'x-circle';
    return 'clock';
  }

  pagoLabel(): string {
    const estado = this.reserva()?.estado;
    if (estado === 'confirmada') return 'Pago recibido';
    if (estado === 'completada') return 'Pago completado';
    if (estado === 'cancelada') return 'Pago cancelado';
    return 'Pendiente de pago';
  }

  async ngOnInit(): Promise<void> {
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    try {
      const data = await this.reservasService.obtenerPorCodigo(codigo);
      this.reserva.set(data);
      this.iniciarPolling(codigo);
    } catch {
      this.error.set('No se encontró la reserva o no tienes permiso para verla.');
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.pollId) clearInterval(this.pollId);
  }

  /** Refresca la reserva cada 15 s mientras el servicio está activo, para ver el seguimiento en vivo. */
  private iniciarPolling(codigo: string): void {
    if (!this.esActiva()) return;
    this.pollId = setInterval(async () => {
      try {
        const data = await this.reservasService.obtenerPorCodigo(codigo);
        this.reserva.set(data);
        if (!this.esActiva() && this.pollId) clearInterval(this.pollId);
      } catch {
        // Ignorar fallos puntuales de red; se reintenta en el siguiente ciclo.
      }
    }, 15000);
  }

  async cancelar(): Promise<void> {
    const r = this.reserva();
    if (!r) return;
    this.cancelando.set(true);
    this.errorAccion.set('');
    try {
      const actualizada = await this.reservasService.cancelar(r._id ?? r.id ?? r.codigo);
      this.reserva.set(actualizada);
    } catch {
      this.errorAccion.set('No se pudo cancelar la reserva. Inténtalo de nuevo.');
    } finally {
      this.cancelando.set(false);
    }
  }

  async irAPagar(): Promise<void> {
    const r = this.reserva();
    if (!r) return;
    this.procesando.set(true);
    this.errorAccion.set('');
    try {
      await this.paymentsService.crearIntent(r._id ?? r.id ?? '');
      // Redirect to the wizard checkout flow with existing reservation context
      void this.router.navigate(['/reservas', r.vertical, r.servicioId], {
        queryParams: { reservaId: r._id ?? r.id, paso: 3 },
      });
    } catch {
      this.errorAccion.set('No se pudo iniciar el pago. Inténtalo de nuevo.');
    } finally {
      this.procesando.set(false);
    }
  }
}
