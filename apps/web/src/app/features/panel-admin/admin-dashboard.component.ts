import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ComercioPendiente, ComparativaDashboard, UltimaReserva } from './admin-api.service';

const SIN_COMPARATIVA: ComparativaDashboard = {
  gmvPct: null, ingresosPct: null, reservasPct: null, comerciosPct: null,
};

type PeriodoClave = 'hoy' | '7d' | '30d' | 'mes' | 'ano' | 'personalizado';

const PERIODOS: ReadonlyArray<{ clave: PeriodoClave; label: string }> = [
  { clave: 'hoy', label: 'Hoy' },
  { clave: '7d', label: '7 días' },
  { clave: '30d', label: '30 días' },
  { clave: 'mes', label: 'Este mes' },
  { clave: 'ano', label: 'Este año' },
  { clave: 'personalizado', label: 'Personalizado' },
];
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoDeVertical } from '../../shared/verticales/verticales.config';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success',
  pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error',
  completada: 'rs-badge--accent',
  en_curso: 'rs-badge--accent',
  pago_retenido: 'rs-badge--warning',
  pago_liberado: 'rs-badge--success',
  en_disputa: 'rs-badge--error',
  reembolsada: 'rs-badge--neutral',
  no_show: 'rs-badge--neutral',
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, DecimalPipe, DatePipe, RsIconComponent, EurosPipe
  ],
  template: `
      @if (cargando()) {
        <div style="text-align:center;padding:var(--sp-20);color:var(--t-400)">
          {{ 'Cargando panel…' | t }}
        </div>
      } @else {

      <div class="admin-header">
        <div>
          <h1>{{ 'Panel Administrativo' | t }}</h1>
          <p>{{ 'Doogking · Panel de Control' | t }}</p>
        </div>
        <div style="display:flex;gap:var(--sp-3)">
          <a routerLink="/admin/cupones" class="rs-btn rs-btn--secondary rs-btn--sm">
            <rs-icon name="ticket" [size]="14" [stroke]="2"></rs-icon> {{ 'Cupones' | t }}
          </a>
          <a routerLink="/admin/reportes" class="rs-btn rs-btn--primary rs-btn--sm">
            <rs-icon name="bar-chart" [size]="14" [stroke]="2"></rs-icon> {{ 'Reportes' | t }}
          </a>
        </div>
      </div>

      <!-- PERIODO: todo el panel se lee sobre el rango elegido (TCK-8030) -->
      <div class="periodo-barra">
        <span class="periodo-barra__label">{{ 'Periodo' | t }}</span>
        <div class="periodo-toggle" role="group" [attr.aria-label]="'Periodo' | t">
          @for (p of periodos; track p.clave) {
            <button class="periodo-toggle__btn" [class.activa]="periodo() === p.clave"
                    (click)="cambiarPeriodo(p.clave)">{{ p.label | t }}</button>
          }
        </div>
        @if (periodo() === 'personalizado') {
          <input class="rs-inp periodo-fecha" type="date" [value]="desde()"
                 (change)="desde.set($any($event.target).value); recargarPeriodo()" [attr.aria-label]="'Desde' | t" />
          <input class="rs-inp periodo-fecha" type="date" [value]="hasta()"
                 (change)="hasta.set($any($event.target).value); recargarPeriodo()" [attr.aria-label]="'Hasta' | t" />
        }
      </div>

      <!-- BARRA DE ALERTAS -->
      @if (totalAlertas() > 0) {
        <div class="admin-alertas">
          <span class="admin-alertas__title">
            <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
            Atención requerida ({{ totalAlertas() }})
          </span>
          @if (kpis().comerciosPendientesCount > 0) {
            <a routerLink="/admin/comercios" class="admin-alertas__chip"><rs-icon name="bell" [size]="13" [stroke]="2"></rs-icon> {{ kpis().comerciosPendientesCount }} comercios por aprobar</a>
          }
          @if (kpis().pagosRetenidosCount > 0) {
            <a routerLink="/admin/reservas" class="admin-alertas__chip"><rs-icon name="bell" [size]="13" [stroke]="2"></rs-icon> {{ kpis().pagosRetenidosCount }} pagos retenidos por liberar</a>
          }
          @if (kpis().incidenciasAbiertas > 0) {
            <a routerLink="/admin/reservas" class="admin-alertas__chip"><rs-icon name="bell" [size]="13" [stroke]="2"></rs-icon> {{ kpis().incidenciasAbiertas }} incidencias abiertas</a>
          }
        </div>
      }

      <!-- KPIs EJECUTIVOS: sólo lo que de verdad manda (TCK-8030) -->
      <div class="admin-kpi-grid admin-kpi-grid--destacados">
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(84,114,248,.18);color:#5472F8">
              <rs-icon name="trending-up" [size]="18" [stroke]="2"></rs-icon>
            </span>
            @if (comparativa().gmvPct !== null) {
              <span class="admin-kpi__delta" [class.baja]="comparativa().gmvPct! < 0">
                {{ comparativa().gmvPct! > 0 ? '+' : '' }}{{ comparativa().gmvPct }} %
              </span>
            }
          </div>
          <div class="admin-kpi__value">{{ kpis().gmvMes | euros:'1.0-0' }}</div>
          <div class="admin-kpi__label">{{ 'Facturación' | t }}</div>
          <div class="admin-kpi__hint">{{ 'Importe total gestionado en el periodo' | t }}</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="euro" [size]="18" [stroke]="2"></rs-icon>
            </span>
            @if (comparativa().ingresosPct !== null) {
              <span class="admin-kpi__delta" [class.baja]="comparativa().ingresosPct! < 0">
                {{ comparativa().ingresosPct! > 0 ? '+' : '' }}{{ comparativa().ingresosPct }} %
              </span>
            }
          </div>
          <div class="admin-kpi__value">{{ kpis().ingresosMes | euros:'1.0-0' }}</div>
          <div class="admin-kpi__label">{{ 'Comisión Doogking' | t }}</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(155,92,246,.18);color:#9B5CF6">
              <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
            </span>
            @if (comparativa().reservasPct !== null) {
              <span class="admin-kpi__delta" [class.baja]="comparativa().reservasPct! < 0">
                {{ comparativa().reservasPct! > 0 ? '+' : '' }}{{ comparativa().reservasPct }} %
              </span>
            }
          </div>
          <div class="admin-kpi__value">{{ kpis().totalReservas }}</div>
          <div class="admin-kpi__label">{{ 'Reservas totales' | t }}</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ comerciosActivos() ?? '—' }}</div>
          <div class="admin-kpi__label">{{ 'Comercios activos' | t }}</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(248,113,113,.18);color:#F87171">
              <rs-icon name="users" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().totalUsuarios }}</div>
          <div class="admin-kpi__label">{{ 'Usuarios registrados' | t }}</div>
        </div>
      </div>

      <!-- KPIs SECUNDARIOS: operación del día a día -->
      <div class="kpi-secundarios">
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().comerciosPendientesCount }}</span>
          <span class="kpi-mini__lbl">{{ 'Comercios pendientes' | t }}</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().nuevosComerciosMes }}</span>
          <span class="kpi-mini__lbl">{{ 'Nuevos comercios' | t }}</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().tasaCancelacionMes }} %</span>
          <span class="kpi-mini__lbl">{{ 'Cancelaciones' | t }}</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().pagosRetenidosMonto | euros:'1.0-0' }}</span>
          <span class="kpi-mini__lbl">Pagos retenidos ({{ kpis().pagosRetenidosCount }})</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().incidenciasAbiertas }}</span>
          <span class="kpi-mini__lbl">{{ 'Incidencias abiertas' | t }}</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().mascotasRegistradas | number:'1.0-0' }}</span>
          <span class="kpi-mini__lbl">{{ 'Mascotas registradas' | t }}</span>
        </div>
      </div>

      <!-- FILA: Comercios pendientes + Actividad reciente -->
      <div class="admin-row">

        <!-- COMERCIOS PENDIENTES -->
        <div class="rs-card admin-panel">
          <div class="panel-header">
            <h3>{{ 'Comercios pendientes de aprobación' | t }}</h3>
            <span class="rs-badge rs-badge--danger">{{ comerciosPendientes().length }}</span>
          </div>

          <div class="comercios-list">
            @for (c of comerciosPendientes(); track c.id) {
              <div class="comercio-item">
                <div class="comercio-item__avatar">{{ c.inicial }}</div>
                <div class="comercio-item__info">
                  <strong>{{ c.nombre }}</strong>
                  <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-1);flex-wrap:wrap">
                    <span class="rs-badge rs-badge--accent" style="display:inline-flex;align-items:center;gap:4px">
                    <rs-icon [name]="iconoVertical(c.vertical)" [size]="11" [stroke]="2"></rs-icon>
                    {{ c.vertical }}
                  </span>
                    <span style="font-size:var(--f-xs);color:var(--t-400)">RUC {{ c.nif }}</span>
                  </div>
                </div>
                <!-- Sin aprobar a ciegas: primero se revisa la ficha (TCK-8030) -->
                <a routerLink="/admin/comercios" class="rs-btn rs-btn--outline rs-btn--sm">
                  {{ 'Revisar comercio' | t }}
                </a>
              </div>
            }

            @if (comerciosPendientes().length === 0) {
              <div style="text-align:center;padding:var(--sp-10);color:var(--t-400)">
                <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> {{ 'Sin comercios pendientes' | t }}
              </div>
            }
          </div>
        </div>

        <!-- RESERVAS RECIENTES (GLOBAL) -->
        <div class="rs-card admin-panel">
          <div class="panel-header">
            <h3>{{ 'Últimas reservas' | t }}</h3>
            <a routerLink="/admin/reservas" class="rs-btn rs-btn--ghost rs-btn--sm">{{ 'Ver todas' | t }}</a>
          </div>

          <div class="ultimas-tabla">
            <div class="ultimas-tabla__head">
              <span>{{ 'Nº' | t }}</span><span>{{ 'Cliente' | t }}</span><span>{{ 'Comercio' | t }}</span><span>{{ 'Servicio' | t }}</span>
              <span>{{ 'Fecha' | t }}</span><span>{{ 'Importe' | t }}</span><span>{{ 'Comisión' | t }}</span><span>{{ 'Estado' | t }}</span>
            </div>
            @for (r of ultimasReservas(); track r.id) {
              <div class="ultimas-tabla__row">
                <span class="ultimas-tabla__codigo" data-col="Nº">{{ r.codigo }}</span>
                <span data-col="Cliente">{{ r.cliente }}</span>
                <span data-col="Comercio">{{ r.comercio }}</span>
                <span data-col="Servicio">{{ r.servicio }}</span>
                <span data-col="Fecha">{{ (r.fechaServicio || r.createdAt) | date:'d MMM, HH:mm' }}</span>
                <span data-col="Importe">{{ r.montoTotal | euros:'1.0-2' }}</span>
                <span data-col="Comisión">{{ r.comisionMonto | euros:'1.0-2' }}</span>
                <span data-col="Estado"><span class="{{ 'rs-badge ' + badgeEstado(r.estado) }}">{{ r.estado }}</span></span>
              </div>
            }
            @if (ultimasReservas().length === 0) {
              <div style="text-align:center;padding:var(--sp-6);color:var(--t-400)">
                {{ 'Todavía no hay reservas en Doogking.' | t }}
              </div>
            }
          </div>
        </div>

      </div>

      <!-- Comisiones y Alpha viven ahora en su propio apartado (TCK-8040 §4 y §5) -->
      <div class="accesos-config">
        <a routerLink="/admin/comisiones" class="acceso">
          <span class="acceso__icono"><rs-icon name="percent" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="acceso__texto">
            <strong>{{ 'Comisiones por vertical' | t }}</strong>
            <span>{{ 'Qué cobra Doogking y qué deja de ingresar el comercio.' | t }}</span>
          </span>
          <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon>
        </a>
        <a routerLink="/admin/alpha" class="acceso">
          <span class="acceso__icono"><rs-icon name="crown" [size]="18" [stroke]="2"></rs-icon></span>
          <span class="acceso__texto">
            <strong>{{ 'Programa Doogking Alpha' | t }}</strong>
            <span>{{ 'Niveles, beneficios y empresas adheridas del club de clientes.' | t }}</span>
          </span>
          <rs-icon name="arrow-right" [size]="16" [stroke]="2"></rs-icon>
        </a>
      </div>

      } <!-- end @if cargando -->
  `,
  styles: [`
    :host { display: contents; }

    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .admin-header h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .admin-header p { color: var(--t-400); }

    .admin-alertas { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); padding: var(--sp-4) var(--sp-5); background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.3); border-radius: var(--r-xl); }
    .admin-alertas__title { font-weight: var(--w-7); color: var(--t-100); font-size: var(--f-sm); }
    .admin-alertas__chip { font-size: var(--f-xs); color: var(--t-200); background: var(--c-card); border: 1px solid var(--b-1); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full); text-decoration: none; &:hover { border-color: var(--c-accent); } }

    .admin-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); @media (max-width: 1280px) { grid-template-columns: repeat(3, 1fr); } @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }

    .admin-kpi { padding: var(--sp-5); }
    .admin-kpi__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .admin-kpi__icon { width: 36px; height: 36px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; }
    .admin-kpi__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .admin-kpi__label { font-size: var(--f-xs); color: var(--t-400); }
    .admin-kpi__hint { font-size: 10px; color: var(--t-500, var(--t-400)); margin-top: 2px; line-height: 1.3; }

    .admin-panel { padding: var(--sp-6); }
    /* El botón de guardar cae debajo del título cuando no cabe a su lado. */
    .panel-header { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-5); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }

    .admin-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: 1fr; } }

    .comercios-list { display: flex; flex-direction: column; gap: var(--sp-3); }
    .comercio-item { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); flex-wrap: wrap; }
    .comercio-item__avatar { width: 40px; height: 40px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-lg); font-weight: var(--w-7); color: #fff; flex-shrink: 0; }
    .comercio-item__info { flex: 1; strong { font-size: var(--f-sm); color: var(--t-100); } }

    .ultima-reserva { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .ultima-reserva__icon { width: 34px; height: 34px; border-radius: var(--r-lg); background: var(--c-raised); border: 1px solid var(--b-1); display: flex; align-items: center; justify-content: center; color: var(--t-300); flex-shrink: 0; }
    .ultima-reserva__info { flex: 1; font-size: var(--f-sm); color: var(--t-300); div:first-child { color: var(--t-100); margin-bottom: 2px; } strong { color: var(--t-100); } }

    .comisiones-table { background: var(--c-raised); border-radius: var(--r-xl); overflow: hidden; }
    .comisiones-head { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); }
    .comisiones-row { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } &:hover { background: var(--c-card); } }
    .comision-vertical { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }

    /* Periodo */
    .periodo-barra { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .periodo-barra__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .periodo-toggle { display: inline-flex; padding: 3px; gap: 2px; background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg); flex-wrap: wrap; }
    .periodo-toggle__btn {
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer;
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
      transition: all var(--d-2);
      &.activa { background: var(--c-card); color: var(--c-accent); box-shadow: var(--shadow-sm, 0 1px 3px rgba(8,37,139,.10)); }
    }
    .periodo-fecha { height: 36px; max-width: 160px; }

    .admin-kpi__delta {
      margin-left: auto; padding: 2px var(--sp-2); border-radius: var(--r-full);
      background: rgba(16,185,129,.14); color: #047857;
      font-size: var(--f-xs); font-weight: var(--w-7);
      &.baja { background: rgba(248,113,113,.16); color: #B91C1C; }
    }

    .kpi-secundarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--sp-3); }
    .kpi-mini { padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
    .kpi-mini__num { font-family: var(--font-accent); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-mini__lbl { font-size: var(--f-xs); color: var(--t-400); }

    /* Últimas reservas en tabla */
    .ultimas-tabla { display: flex; flex-direction: column; }
    .ultimas-tabla__head, .ultimas-tabla__row {
      display: grid; grid-template-columns: 120px 1fr 1fr 1fr 130px 90px 90px 110px;
      gap: var(--sp-3); align-items: center;
      padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1);
      font-size: var(--f-sm); color: var(--t-200);
    }
    .ultimas-tabla__head { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .ultimas-tabla__row:last-child { border-bottom: none; }
    .ultimas-tabla__codigo { font-family: monospace; font-size: var(--f-xs); color: var(--c-accent); }
    @media (max-width: 900px) {
      .ultimas-tabla__head { display: none; }
      .ultimas-tabla__row {
        grid-template-columns: 1fr; gap: var(--sp-1);
        padding: var(--sp-4) 0;
        > [data-col]::before {
          content: attr(data-col) ': ';
          font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em;
        }
      }
    }

    .alpha-beneficios { display: flex; flex-direction: column; gap: var(--sp-2); align-items: flex-start; }
    .alpha-beneficio { display: flex; align-items: center; gap: var(--sp-2); width: 100%; }

    .accesos-config { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--sp-4); }
    .acceso {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-5); text-decoration: none;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      color: var(--t-300); transition: border-color var(--d-2);
    }
    .acceso:hover { border-color: var(--c-accent); }
    .acceso__icono {
      width: 40px; height: 40px; border-radius: var(--r-lg); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-lo); color: var(--c-accent);
    }
    .acceso__texto { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .acceso__texto strong { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .acceso__texto span { font-size: var(--f-xs); color: var(--t-400); }

    .panel-nota { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); max-width: 70ch; }

    .alpha-adheridos { margin-top: var(--sp-6); padding-top: var(--sp-5); border-top: 1px solid var(--b-1); }
    .alpha-adheridos__titulo { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .alpha-adheridos__buscador { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-4); .rs-inp { flex: 1; min-width: 240px; } }
    .alpha-adheridos__lista { display: flex; flex-direction: column; gap: var(--sp-2); }
    .alpha-adheridos__fila { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-3) var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); flex-wrap: wrap; }
    .alpha-adheridos__nombre { flex: 1; min-width: 160px; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .alpha-adheridos__vat { font-size: var(--f-xs); color: var(--t-400); }
    .alpha-adheridos__vacio { font-size: var(--f-sm); color: var(--t-400); }

    .alpha-head, .alpha-row { grid-template-columns: 100px 160px 160px 140px 1fr; gap: var(--sp-3); }
    .alpha-campo > span { display: none; }
    .alpha-campo .rs-inp { width: 100%; }

    /*
     * Móvil: las dos tablas de configuración pasan a lista. Cada campo queda
     * bajo su etiqueta, que aquí es imprescindible porque son inputs sueltos
     * (un porcentaje sin su cabecera no se sabe de qué es).
     */
    @media (max-width: 768px) {
      .comisiones-head, .alpha-head { display: none; }

      .comisiones-row,
      .alpha-head, .alpha-row {
        grid-template-columns: 1fr;
        gap: var(--sp-3);
        padding: var(--sp-4) var(--sp-5);
        border-bottom: 6px solid var(--c-base);
      }

      .comisiones-row > [data-col] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }

      .comisiones-row > [data-col]::before {
        content: attr(data-col);
        flex: 0 0 auto;
        font-family: var(--font-accent);
        font-size: var(--f-xs);
        font-weight: var(--w-7);
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--t-400);
      }

      /* El primer dato de cada fila es el título de la tarjeta. */
      .comision-vertical { font-weight: var(--w-7); color: var(--t-100); }

      .alpha-campo > span {
        display: block;
        margin-bottom: var(--sp-1);
        font-family: var(--font-accent);
        font-size: var(--f-xs);
        font-weight: var(--w-7);
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--t-400);
      }
      .alpha-campo .rs-inp { width: 100%; text-align: left; }
    }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly guardadoMsg = signal(false);
  readonly errorMsg = signal('');

  readonly kpis = signal({
    totalReservas: 0, gmvMes: 0, ingresosMes: 0,
    comerciosPendientesCount: 0, totalUsuarios: 0,
nuevosComerciosMes: 0,
    mascotasRegistradas: 0, tasaCancelacionMes: 0,
    pagosRetenidosMonto: 0, pagosRetenidosCount: 0,
    incidenciasAbiertas: 0,
  });
  readonly comerciosPendientes = signal<ComercioPendiente[]>([]);
  readonly ultimasReservas = signal<UltimaReserva[]>([]);

  /** Periodo del panel y variación frente al anterior (TCK-8030). */
  readonly periodos = PERIODOS;
  readonly periodo = signal<PeriodoClave>('mes');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly comparativa = signal<ComparativaDashboard>(SIN_COMPARATIVA);
  readonly comerciosActivos = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargarDashboard();
    try {
      const resumen = await firstValueFrom(this.adminApi.getResumenComercios());
      this.comerciosActivos.set(resumen.activos);
    } catch {
      // Sin este dato la tarjeta muestra un guion; el resto del panel funciona.
    }
  }

  /** Carga (o recarga) el panel para el periodo elegido. */
  private async cargarDashboard(): Promise<void> {
    this.cargando.set(true);
    try {
      const rango = this.rangoDelPeriodo();
      const data = await firstValueFrom(this.adminApi.getDashboard(rango));
      this.kpis.set(data.kpis);
      this.comerciosPendientes.set(data.comerciosPendientes);
      this.ultimasReservas.set(data.ultimasReservas);
      // Un API anterior a TCK-8030 no manda comparativa: sin ella no se pinta
      // ningún porcentaje, en vez de reventar el panel entero.
      this.comparativa.set(data.comparativa ?? SIN_COMPARATIVA);
    } catch {
      this.errorMsg.set('Error cargando el dashboard. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** `undefined` = el backend usa su rango por defecto (el mes en curso). */
  private rangoDelPeriodo(): { desde: string; hasta: string } | undefined {
    const hoy = new Date();
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
    const desdeDia = (dias: number) =>
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias);

    switch (this.periodo()) {
      case 'hoy': return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString(), hasta: fin.toISOString() };
      case '7d': return { desde: desdeDia(6).toISOString(), hasta: fin.toISOString() };
      case '30d': return { desde: desdeDia(29).toISOString(), hasta: fin.toISOString() };
      case 'mes': return undefined;
      case 'ano': return { desde: new Date(hoy.getFullYear(), 0, 1).toISOString(), hasta: fin.toISOString() };
      case 'personalizado':
        if (!this.desde() || !this.hasta()) return undefined;
        return { desde: new Date(this.desde()).toISOString(), hasta: new Date(this.hasta() + 'T23:59:59').toISOString() };
    }
  }

  async cambiarPeriodo(clave: PeriodoClave): Promise<void> {
    this.periodo.set(clave);
    if (clave === 'personalizado' && (!this.desde() || !this.hasta())) return;
    await this.cargarDashboard();
  }

  async recargarPeriodo(): Promise<void> {
    if (this.desde() && this.hasta()) await this.cargarDashboard();
  }

  totalAlertas(): number {
    return this.kpis().comerciosPendientesCount
      + this.kpis().pagosRetenidosCount + this.kpis().incidenciasAbiertas;
  }

  iconoVertical(vertical: string): string {
    return iconoDeVertical(vertical);
  }

  /** Comisión plataforma + fee variable de Stripe, redondeado a 1 decimal (ej. 12% + 1,5% = 13,5%). */

  badgeEstado(estado: string): string {
    return ESTADO_BADGE[estado] ?? 'rs-badge--neutral';
  }

  async aprobarComercio(id: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.aprobarComercio(id));
      this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
      this.kpis.update(k => ({ ...k, comerciosPendientesCount: k.comerciosPendientesCount - 1 }));
    } catch {
      this.errorMsg.set('Error al aprobar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  /** El rechazo exige motivo; desde el Dashboard se pasa el que llega del diálogo. */
  async rechazarComercio(id: string, motivo: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.rechazarComercio(id, motivo));
      this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
      this.kpis.update(k => ({ ...k, comerciosPendientesCount: k.comerciosPendientesCount - 1 }));
    } catch {
      this.errorMsg.set('Error al rechazar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

}
