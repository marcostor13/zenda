import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { etiquetaAlphaNivel } from 'shared';
import { AdminApiService, ComisionConfig, ComercioAdmin, ComercioPendiente, ComparativaDashboard, UltimaReserva, AlphaNivel } from './admin-api.service';

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
  imports: [RouterLink, DecimalPipe, DatePipe, RsIconComponent],
  template: `
      @if (cargando()) {
        <div style="text-align:center;padding:var(--sp-20);color:var(--t-400)">
          Cargando panel…
        </div>
      } @else {

      <div class="admin-header">
        <div>
          <h1>Panel Administrativo</h1>
          <p>Doogking · Panel de Control</p>
        </div>
        <div style="display:flex;gap:var(--sp-3)">
          <a routerLink="/admin/cupones" class="rs-btn rs-btn--secondary rs-btn--sm">
            <rs-icon name="ticket" [size]="14" [stroke]="2"></rs-icon> Cupones
          </a>
          <a routerLink="/admin/reportes" class="rs-btn rs-btn--primary rs-btn--sm">
            <rs-icon name="bar-chart" [size]="14" [stroke]="2"></rs-icon> Reportes
          </a>
        </div>
      </div>

      <!-- PERIODO: todo el panel se lee sobre el rango elegido (TCK-8030) -->
      <div class="periodo-barra">
        <span class="periodo-barra__label">Periodo</span>
        <div class="periodo-toggle" role="group" aria-label="Periodo">
          @for (p of periodos; track p.clave) {
            <button class="periodo-toggle__btn" [class.activa]="periodo() === p.clave"
                    (click)="cambiarPeriodo(p.clave)">{{ p.label }}</button>
          }
        </div>
        @if (periodo() === 'personalizado') {
          <input class="rs-inp periodo-fecha" type="date" [value]="desde()"
                 (change)="desde.set($any($event.target).value); recargarPeriodo()" aria-label="Desde" />
          <input class="rs-inp periodo-fecha" type="date" [value]="hasta()"
                 (change)="hasta.set($any($event.target).value); recargarPeriodo()" aria-label="Hasta" />
        }
      </div>

      <!-- BARRA DE ALERTAS -->
      @if (totalAlertas() > 0) {
        <div class="admin-alertas">
          <span class="admin-alertas__title">
            <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
            Atención requerida ({{ totalAlertas() }})
          </span>
          @if (kpis().verificacionesPendientes > 0) {
            <a routerLink="/admin/comercios" class="admin-alertas__chip"><rs-icon name="bell" [size]="13" [stroke]="2"></rs-icon> {{ kpis().verificacionesPendientes }} verificaciones pendientes</a>
          }
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
          <div class="admin-kpi__value">{{ kpis().gmvMes | number:'1.0-0' }} €</div>
          <div class="admin-kpi__label">Facturación</div>
          <div class="admin-kpi__hint">Importe total gestionado en el periodo</div>
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
          <div class="admin-kpi__value">{{ kpis().ingresosMes | number:'1.0-0' }} €</div>
          <div class="admin-kpi__label">Comisión Doogking</div>
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
          <div class="admin-kpi__label">Reservas totales</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(0,201,177,.18);color:#00C9B1">
              <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ comerciosActivos() ?? '—' }}</div>
          <div class="admin-kpi__label">Comercios activos</div>
        </div>
        <div class="admin-kpi rs-card">
          <div class="admin-kpi__top">
            <span class="admin-kpi__icon" style="background:rgba(248,113,113,.18);color:#F87171">
              <rs-icon name="users" [size]="18" [stroke]="2"></rs-icon>
            </span>
          </div>
          <div class="admin-kpi__value">{{ kpis().totalUsuarios }}</div>
          <div class="admin-kpi__label">Usuarios registrados</div>
        </div>
      </div>

      <!-- KPIs SECUNDARIOS: operación del día a día -->
      <div class="kpi-secundarios">
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().comerciosPendientesCount }}</span>
          <span class="kpi-mini__lbl">Comercios pendientes</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().verificacionesPendientes }}</span>
          <span class="kpi-mini__lbl">Verificaciones pendientes</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().nuevosComerciosMes }}</span>
          <span class="kpi-mini__lbl">Nuevos comercios</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().tasaCancelacionMes }} %</span>
          <span class="kpi-mini__lbl">Cancelaciones</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().pagosRetenidosMonto | number:'1.0-0' }} €</span>
          <span class="kpi-mini__lbl">Pagos retenidos ({{ kpis().pagosRetenidosCount }})</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().incidenciasAbiertas }}</span>
          <span class="kpi-mini__lbl">Incidencias abiertas</span>
        </div>
        <div class="kpi-mini rs-card">
          <span class="kpi-mini__num">{{ kpis().mascotasRegistradas | number:'1.0-0' }}</span>
          <span class="kpi-mini__lbl">Mascotas registradas</span>
        </div>
      </div>

      <!-- FILA: Comercios pendientes + Actividad reciente -->
      <div class="admin-row">

        <!-- COMERCIOS PENDIENTES -->
        <div class="rs-card admin-panel">
          <div class="panel-header">
            <h3>Comercios pendientes de aprobación</h3>
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
                  Revisar comercio
                </a>
              </div>
            }

            @if (comerciosPendientes().length === 0) {
              <div style="text-align:center;padding:var(--sp-10);color:var(--t-400)">
                <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> Sin comercios pendientes
              </div>
            }
          </div>
        </div>

        <!-- RESERVAS RECIENTES (GLOBAL) -->
        <div class="rs-card admin-panel">
          <div class="panel-header">
            <h3>Últimas reservas</h3>
            <a routerLink="/admin/reservas" class="rs-btn rs-btn--ghost rs-btn--sm">Ver todas</a>
          </div>

          <div class="ultimas-tabla">
            <div class="ultimas-tabla__head">
              <span>Nº</span><span>Cliente</span><span>Comercio</span><span>Servicio</span>
              <span>Fecha</span><span>Importe</span><span>Comisión</span><span>Estado</span>
            </div>
            @for (r of ultimasReservas(); track r.id) {
              <div class="ultimas-tabla__row">
                <span class="ultimas-tabla__codigo" data-col="Nº">{{ r.codigo }}</span>
                <span data-col="Cliente">{{ r.cliente }}</span>
                <span data-col="Comercio">{{ r.comercio }}</span>
                <span data-col="Servicio">{{ r.servicio }}</span>
                <span data-col="Fecha">{{ (r.fechaServicio || r.createdAt) | date:'d MMM, HH:mm' }}</span>
                <span data-col="Importe">{{ r.montoTotal | number:'1.0-2' }} €</span>
                <span data-col="Comisión">{{ r.comisionMonto | number:'1.0-2' }} €</span>
                <span data-col="Estado"><span class="{{ 'rs-badge ' + badgeEstado(r.estado) }}">{{ r.estado }}</span></span>
              </div>
            }
            @if (ultimasReservas().length === 0) {
              <div style="text-align:center;padding:var(--sp-6);color:var(--t-400)">
                Todavía no hay reservas en Doogking.
              </div>
            }
          </div>
        </div>

      </div>

      <!-- CONFIGURACIÓN DE COMISIONES -->
      <div class="rs-card admin-panel">
        <div class="panel-header">
          <h3>Comisiones por vertical</h3>
          <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="guardarComisiones()">
            <rs-icon name="save" [size]="14" [stroke]="2"></rs-icon> Guardar cambios
          </button>
        </div>

        <p class="panel-nota">
          La columna <strong>Comisión total</strong> es lo que el comercio deja de cobrar por cada
          reserva: comisión de Doogking más el coste de la pasarela de pago.
        </p>
        <div class="comisiones-table">
          <div class="comisiones-head">
            <span>Vertical</span>
            <span>Comisión (%)</span>
            <span>Fee Stripe</span>
            <span>Comisión total</span>
            <span>Estado</span>
          </div>
          @for (c of comisiones(); track c.vertical) {
            <div class="comisiones-row">
              <span class="comision-vertical">
                <rs-icon [name]="iconoVertical(c.vertical)" [size]="14" [stroke]="2"></rs-icon>
                {{ c.vertical }}
              </span>
              <div data-col="Comisión" style="display:flex;align-items:center;gap:var(--sp-2)">
                <input type="number" class="rs-inp" style="width:80px;text-align:center"
                       [value]="(c.comisionPct * 100).toFixed(0)"
                       (input)="actualizarPct(c, +$any($event).target.value)" />
                <span style="color:var(--t-400)">%</span>
              </div>
              <span data-col="Fee Stripe" style="color:var(--t-400);font-size:var(--f-sm)">
                {{ (c.stripePct * 100).toFixed(1) }}% + {{ c.stripeFijoEur.toFixed(2) }} €
              </span>
              <span data-col="Total" style="font-weight:var(--w-7);color:var(--t-100);font-size:var(--f-sm)">
                {{ comisionTotal(c) }}%
              </span>
              <label data-col="Estado" style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer">
                <input type="checkbox" [checked]="c.activo" (change)="c.activo = !c.activo"
                       style="accent-color:var(--c-accent)" />
                <span class="rs-badge" [class]="c.activo ? 'rs-badge--success' : 'rs-badge--warning'">
                  {{ c.activo ? 'Activo' : 'Pausado' }}
                </span>
              </label>
            </div>
          }
        </div>

        @if (guardadoMsg()) {
          <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">
            <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> Comisiones actualizadas exitosamente
          </div>
        }
        @if (errorMsg()) {
          <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">
            {{ errorMsg() }}
          </div>
        }
      </div>

      <!-- PROGRAMA DOOGKING ALPHA (HU-13.4) -->
      <div class="rs-card admin-panel">
        <div class="panel-header">
          <h3><rs-icon name="crown" [size]="17" [stroke]="2"></rs-icon> Programa de fidelización de clientes · Doogking Alpha</h3>
          <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="guardarAlphaNiveles()">
            <rs-icon name="save" [size]="14" [stroke]="2"></rs-icon> Guardar cambios
          </button>
        </div>
        <p class="panel-nota">
          Fidelización de los clientes que reservan. Las empresas no tienen nivel Alpha:
          su escalera es el plan Básico / Pro / Premium.
        </p>

        <div class="comisiones-table alpha-table">
          <div class="comisiones-head alpha-head">
            <span>Nivel</span>
            <span>Nombre</span>
            <span>Reservas requeridas</span>
            <span>Descuento (%)</span>
            <span>Beneficios (separados por coma)</span>
          </div>
          @for (n of alphaNiveles(); track n.nivel) {
            <div class="comisiones-row alpha-row">
              <span class="comision-vertical">{{ etiquetaNivel(n.nivel) }}</span>
              <label class="alpha-campo"><span>Nombre</span>
                <input type="text" class="rs-inp" [value]="n.nombre" (input)="n.nombre = $any($event).target.value" />
              </label>
              <label class="alpha-campo"><span>Reservas requeridas</span>
                <input type="number" class="rs-inp" style="width:100px;text-align:center"
                       [value]="n.reservasRequeridas"
                       (input)="n.reservasRequeridas = +$any($event).target.value" />
              </label>
              <label class="alpha-campo"><span>Descuento (%)</span>
                <input type="number" class="rs-inp" style="width:80px;text-align:center"
                       [value]="(n.descuentoPct * 100).toFixed(0)"
                       (input)="n.descuentoPct = +$any($event).target.value / 100" />
              </label>
              <!-- Beneficios uno a uno: en un solo campo con comas era imposible
                   escribir un beneficio que llevara coma (TCK-8030 §10). -->
              <div class="alpha-campo alpha-beneficios">
                <span>Beneficios</span>
                @for (b of n.beneficios; track $index) {
                  <div class="alpha-beneficio">
                    <input type="text" class="rs-inp" [value]="b"
                           (input)="editarBeneficio(n, $index, $any($event).target.value)" />
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                            (click)="quitarBeneficio(n, $index)" aria-label="Quitar beneficio">
                      <rs-icon name="x" [size]="13" [stroke]="2.5"></rs-icon>
                    </button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirBeneficio(n)">
                  <rs-icon name="plus" [size]="13" [stroke]="2.5"></rs-icon> Añadir beneficio
                </button>
              </div>
            </div>
          }
        </div>

        @if (alphaGuardadoMsg()) {
          <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">
            <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> Programa Alpha actualizado exitosamente
          </div>
        }

        <!-- Empresas que aplican los descuentos Alpha a sus clientes. Se gestiona
             aquí, dentro del programa, y no en la ficha del comercio (TCK-8034). -->
        <div class="alpha-adheridos">
          <h4 class="alpha-adheridos__titulo">Empresas que aplican descuentos Alpha</h4>
          <p class="panel-nota">
            No es un nivel del comercio: sólo indica que acepta aplicar el descuento
            Alpha a los clientes del programa.
          </p>

          <div class="alpha-adheridos__buscador">
            <input type="text" class="rs-inp" placeholder="Buscar una empresa por nombre o CIF…"
                   [value]="alphaBusqueda()"
                   (input)="alphaBusqueda.set($any($event).target.value)"
                   (keyup.enter)="buscarComerciosAlpha()" />
            <button class="rs-btn rs-btn--secondary rs-btn--sm" (click)="buscarComerciosAlpha()">
              <rs-icon name="search" [size]="14" [stroke]="2"></rs-icon> Buscar
            </button>
          </div>

          @if (alphaResultados().length > 0) {
            <div class="alpha-adheridos__lista">
              @for (c of alphaResultados(); track c._id) {
                <div class="alpha-adheridos__fila">
                  <span class="alpha-adheridos__nombre">{{ c.nombreComercial }}</span>
                  <span class="alpha-adheridos__vat">{{ c.vatNumber }}</span>
                  <button class="rs-btn rs-btn--sm"
                    [class.rs-btn--ghost]="!c.alphaAdherido"
                    [class.rs-btn--primary]="c.alphaAdherido"
                    [disabled]="alphaAccionando() === c._id"
                    (click)="alternarAdhesionAlpha(c)">
                    {{ c.alphaAdherido ? 'Dar de baja' : 'Adherir' }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <p class="alpha-adheridos__vacio">
              {{ alphaBuscado()
                 ? 'Ninguna empresa coincide con la búsqueda.'
                 : 'Todavía no hay empresas adheridas al programa. Búscalas por nombre para darlas de alta.' }}
            </p>
          }

          @if (alphaAdhesionError()) {
            <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ alphaAdhesionError() }}</div>
          }
        </div>
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
    verificacionesPendientes: 0, nuevosComerciosMes: 0,
    mascotasRegistradas: 0, tasaCancelacionMes: 0,
    pagosRetenidosMonto: 0, pagosRetenidosCount: 0,
    incidenciasAbiertas: 0,
  });
  readonly comerciosPendientes = signal<ComercioPendiente[]>([]);
  readonly ultimasReservas = signal<UltimaReserva[]>([]);
  readonly comisiones = signal<ComisionConfig[]>([]);

  /** Periodo del panel y variación frente al anterior (TCK-8030). */
  readonly periodos = PERIODOS;
  readonly periodo = signal<PeriodoClave>('mes');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly comparativa = signal<ComparativaDashboard>(SIN_COMPARATIVA);
  readonly comerciosActivos = signal<number | null>(null);
  readonly alphaNiveles = signal<AlphaNivel[]>([]);
  readonly alphaGuardadoMsg = signal(false);

  /** Gestión de empresas adheridas al programa Alpha (TCK-8034, antes en Comercios). */
  readonly alphaResultados = signal<ComercioAdmin[]>([]);
  readonly alphaBusqueda = signal('');
  readonly alphaBuscado = signal(false);
  readonly alphaAccionando = signal<string | null>(null);
  readonly alphaAdhesionError = signal('');

  async ngOnInit(): Promise<void> {
    await this.cargarDashboard();
    try {
      const resumen = await firstValueFrom(this.adminApi.getResumenComercios());
      this.comerciosActivos.set(resumen.activos);
    } catch {
      // Sin este dato la tarjeta muestra un guion; el resto del panel funciona.
    }

    try {
      const niveles = await firstValueFrom(this.adminApi.getAlphaNiveles());
      this.alphaNiveles.set(niveles);
    } catch {
      // El programa Alpha no bloquea el resto del dashboard si falla.
    }

    await this.cargarAdheridosAlpha();
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
      this.comisiones.set(data.comisiones);
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

  anadirBeneficio(nivel: AlphaNivel): void {
    nivel.beneficios = [...nivel.beneficios, ''];
    this.alphaNiveles.update((lista) => [...lista]);
  }

  editarBeneficio(nivel: AlphaNivel, indice: number, valor: string): void {
    nivel.beneficios = nivel.beneficios.map((b, i) => (i === indice ? valor : b));
  }

  quitarBeneficio(nivel: AlphaNivel, indice: number): void {
    nivel.beneficios = nivel.beneficios.filter((_, i) => i !== indice);
    this.alphaNiveles.update((lista) => [...lista]);
  }

  /** Etiqueta canónica del escalón, al margen del nombre editable (TCK-8011). */
  etiquetaNivel(nivel: number): string {
    return etiquetaAlphaNivel(nivel);
  }

  /** Sin búsqueda se listan las empresas ya adheridas: es el estado que interesa. */
  private async cargarAdheridosAlpha(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.adminApi.getComercios({ limite: 50, alphaAdherido: true }),
      );
      this.alphaResultados.set(res.items);
      this.alphaBuscado.set(false);
    } catch {
      this.alphaResultados.set([]);
    }
  }

  async buscarComerciosAlpha(): Promise<void> {
    const termino = this.alphaBusqueda().trim();
    if (!termino) {
      await this.cargarAdheridosAlpha();
      return;
    }
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 20, buscar: termino }));
      this.alphaResultados.set(res.items);
      this.alphaBuscado.set(true);
    } catch {
      this.alphaAdhesionError.set('No se pudo buscar empresas.');
      setTimeout(() => this.alphaAdhesionError.set(''), 3000);
    }
  }

  async alternarAdhesionAlpha(comercio: ComercioAdmin): Promise<void> {
    this.alphaAccionando.set(comercio._id);
    try {
      await firstValueFrom(this.adminApi.fijarAlphaAdherido(comercio._id, !comercio.alphaAdherido));
      if (this.alphaBuscado()) {
        this.alphaResultados.update(items =>
          items.map(c => (c._id === comercio._id ? { ...c, alphaAdherido: !comercio.alphaAdherido } : c)),
        );
      } else {
        await this.cargarAdheridosAlpha();
      }
    } catch {
      this.alphaAdhesionError.set('No se pudo cambiar la adhesión al programa Alpha.');
      setTimeout(() => this.alphaAdhesionError.set(''), 3000);
    } finally {
      this.alphaAccionando.set(null);
    }
  }

  totalAlertas(): number {
    return this.kpis().verificacionesPendientes + this.kpis().comerciosPendientesCount
      + this.kpis().pagosRetenidosCount + this.kpis().incidenciasAbiertas;
  }

  iconoVertical(vertical: string): string {
    return iconoDeVertical(vertical);
  }

  /** Comisión plataforma + fee variable de Stripe, redondeado a 1 decimal (ej. 12% + 1,5% = 13,5%). */
  comisionTotal(comision: ComisionConfig): string {
    return ((comision.comisionPct + comision.stripePct) * 100).toFixed(1).replace('.', ',');
  }

  badgeEstado(estado: string): string {
    return ESTADO_BADGE[estado] ?? 'rs-badge--neutral';
  }

  actualizarPct(comision: ComisionConfig, pct: number): void {
    comision.comisionPct = pct / 100;
  }

  beneficiosDesdeTexto(texto: string): string[] {
    return texto.split(',').map(b => b.trim()).filter(Boolean);
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

  async rechazarComercio(id: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.rechazarComercio(id));
      this.comerciosPendientes.update(list => list.filter(c => c.id !== id));
      this.kpis.update(k => ({ ...k, comerciosPendientesCount: k.comerciosPendientesCount - 1 }));
    } catch {
      this.errorMsg.set('Error al rechazar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  async guardarComisiones(): Promise<void> {
    try {
      const lista = this.comisiones();
      await Promise.all(
        lista.map(c =>
          firstValueFrom(this.adminApi.updateComision({
            vertical: c.vertical,
            comisionPct: c.comisionPct,
            stripePct: c.stripePct,
            stripeFijoEur: c.stripeFijoEur,
            activo: c.activo,
          }))
        )
      );
      this.guardadoMsg.set(true);
      setTimeout(() => this.guardadoMsg.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar las comisiones.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }

  async guardarAlphaNiveles(): Promise<void> {
    try {
      const lista = this.alphaNiveles();
      await Promise.all(lista.map(n => firstValueFrom(this.adminApi.updateAlphaNivel(n))));
      this.alphaGuardadoMsg.set(true);
      setTimeout(() => this.alphaGuardadoMsg.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar el programa Alpha.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    }
  }
}
