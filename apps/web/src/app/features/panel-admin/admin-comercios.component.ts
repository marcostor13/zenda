import { Component, OnInit, HostListener, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AdminApiService, ComercioAdmin, ResumenComercios, FichaComercio, CrearComercioDto, ActualizarComercioDto } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoVertical } from '../panel-comercio/vertical-icon';

const FILTROS = [
  { label: 'Todos', valor: '' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Activos', valor: 'activo' },
  { label: 'Suspendidos', valor: 'suspendido' },
] as const;

const VERTICALES_OPCIONES = Object.values(VerticalKey);
const LIMITE = 20;

@Component({
  selector: 'app-admin-comercios',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RsIconComponent],
  template: `
    <!-- Cabecera -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Comercios</h1>
        <p class="page-sub">Gestiona los comercios registrados en la plataforma.</p>
      </div>
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCrear()">+ Nuevo comercio</button>
    </div>

    <!-- Resumen superior (TCK-8034) -->
    <div class="resumen-comercios">
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.total ?? total() }}</span>
        <span class="resumen-tile__lbl">Comercios totales</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.activos ?? '—' }}</span>
        <span class="resumen-tile__lbl">Activos</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.pendientes ?? '—' }}</span>
        <span class="resumen-tile__lbl">Pendientes</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.suspendidos ?? '—' }}</span>
        <span class="resumen-tile__lbl">Suspendidos</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.verificados ?? '—' }}</span>
        <span class="resumen-tile__lbl">Verificados</span>
      </div>
    </div>

    <!-- Barra de filtros + búsqueda -->
    <div class="toolbar">
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
      <input
        class="rs-inp search-input"
        type="text"
        placeholder="Buscar por nombre, razón social o CIF/NIF…"
        [value]="buscar()"
        (input)="onBuscar($event)" />
      <!-- Filtros de la propia página: se aplican sobre lo ya cargado (TCK-8034) -->
      <select class="rs-inp filtro-select" [value]="filtroVerificacion()"
              (change)="filtroVerificacion.set($any($event.target).value)" aria-label="Verificación">
        <option value="">Cualquier verificación</option>
        <option value="verificado">Verificados</option>
        <option value="pendiente">Verificación pendiente</option>
        <option value="sin_verificar">Sin verificar</option>
        <option value="rechazado">Rechazados</option>
      </select>
      <select class="rs-inp filtro-select" [value]="filtroVertical()"
              (change)="filtroVertical.set($any($event.target).value)" aria-label="Vertical">
        <option value="">Todos los verticales</option>
        @for (v of verticalesDisponibles(); track v) {
          <option [value]="v">{{ labelVertical(v) }}</option>
        }
      </select>
      <select class="rs-inp filtro-select" [value]="filtroPlan()"
              (change)="filtroPlan.set($any($event.target).value)" aria-label="Plan">
        <option value="">Todos los planes</option>
        <option value="basico">Plan Básico</option>
        <option value="pro">Plan Pro</option>
        <option value="premium">Plan Premium</option>
      </select>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <div class="rs-card" style="padding:0;overflow:hidden">
      <div class="tbl-head">
        <span>Comercio</span>
        <span>CIF/NIF</span>
        <span>Plan</span>
        <span>Estado</span>
        <span>Verificación</span>
        <span>Registro</span>
        <span>Acciones</span>
      </div>

      @if (cargando()) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="tbl-row tbl-skeleton">
            <div class="skel skel--lg"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--md"></div>
          </div>
        }
      } @else {
        @for (c of comerciosFiltrados(); track c._id) {
          <div class="tbl-row">
            <div class="comercio-cell">
              <div class="comercio-avatar">{{ c.nombreComercial[0]?.toUpperCase() ?? 'C' }}</div>
              <div>
                <div class="cell-primary">{{ c.nombreComercial }}</div>
                <div class="cell-muted">{{ c.razonSocial }}</div>
                <div class="verticales-pills">
                  @for (v of c.verticales.slice(0, 2); track v) {
                    <span class="rs-badge rs-badge--neutral" style="display:inline-flex;align-items:center;gap:4px">
                    <rs-icon [name]="iconVertical(v)" [size]="11" [stroke]="2"></rs-icon>{{ labelVertical(v) }}
                  </span>
                  }
                  @if (c.verticales.length > 2) {
                    <span class="rs-badge rs-badge--neutral"
                          [title]="c.verticales.join(', ')">+{{ c.verticales.length - 2 }}</span>
                  }
                </div>
              </div>
            </div>
            <span class="cell-mono" data-col="CIF/NIF">{{ c.vatNumber }}</span>
            <span data-col="Plan">
              <span class="rs-badge rs-badge--accent">Plan {{ c.plan }}</span>
            </span>
            <span data-col="Estado">
              <span class="rs-badge {{ badgeEstado(c.estado) }}">{{ c.estado }}</span>
            </span>
            <!-- Verificación en su propia columna: es otra cosa que el estado (TCK-8034) -->
            <span data-col="Verificación">
              <span class="rs-badge {{ badgeVerif(c.verificacion?.estado ?? 'sin_verificar') }}">
                <rs-icon [name]="verifIcono(c.verificacion?.estado ?? 'sin_verificar')" [size]="12" [stroke]="2"></rs-icon>
                {{ verifLabel(c.verificacion?.estado ?? 'sin_verificar') }}
              </span>
            </span>
            <span class="cell-muted" data-col="Registro">{{ c.createdAt | date:'d MMM yyyy' }}</span>
            <div class="acciones" (click)="$event.stopPropagation()">
              <!-- En un comercio pendiente lo primero es revisar su solicitud,
                   no aprobarla a ciegas (TCK-8034). -->
              @if (c.estado === 'pendiente') {
                <button class="rs-btn rs-btn--outline rs-btn--sm"
                        [disabled]="accionando() === c._id" (click)="abrirFicha(c)">
                  Revisar solicitud
                </button>
              }
              <button class="rs-btn rs-btn--ghost rs-btn--sm" aria-label="Acciones"
                      (click)="menuAbiertoId.set(menuAbiertoId() === c._id ? null : c._id)">
                <rs-icon name="more-horizontal" [size]="15" [stroke]="2"></rs-icon>
              </button>
              @if (menuAbiertoId() === c._id) {
                <div class="acciones__menu">
                  <button class="acciones__item" (click)="abrirFicha(c)">
                    <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon> Ver ficha
                  </button>
                  <button class="acciones__item" (click)="abrirEditar(c)">
                    <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon> Editar datos
                  </button>
                  @if (c.verificacion?.estado === 'pendiente') {
                    <button class="acciones__item" [disabled]="accionando() === c._id" (click)="verificar(c._id)">
                      <rs-icon name="badge-check" [size]="13" [stroke]="2"></rs-icon> Verificar documentación
                    </button>
                    <button class="acciones__item" [disabled]="accionando() === c._id" (click)="rechazarVerif(c._id)">
                      <rs-icon name="x" [size]="13" [stroke]="2.5"></rs-icon> Rechazar documentación
                    </button>
                  }
                  @if (c.estado !== 'activo') {
                    <button class="acciones__item" [disabled]="accionando() === c._id" (click)="aprobar(c._id)">
                      <rs-icon name="check" [size]="13" [stroke]="2.5"></rs-icon> Aprobar comercio
                    </button>
                  }
                  @if (c.estado !== 'suspendido') {
                    <button class="acciones__item acciones__item--danger"
                            [disabled]="accionando() === c._id" (click)="abrirSuspender(c)">
                      <rs-icon name="alert-circle" [size]="13" [stroke]="2"></rs-icon>
                      {{ c.estado === 'pendiente' ? 'Rechazar solicitud' : 'Suspender comercio' }}
                    </button>
                  }
                  <button class="acciones__item acciones__item--danger"
                          [disabled]="accionando() === c._id" (click)="confirmarEliminar(c)">
                    <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon> Eliminar comercio
                  </button>
                </div>
              }
            </div>
          </div>
        }
        @if (comerciosFiltrados().length === 0) {
          <div class="empty-state">
            <span class="empty-icon"><rs-icon name="store" [size]="34" [stroke]="1.5"></rs-icon></span>
            <p>No hay comercios {{ filtroEstado() ? 'con estado "' + filtroEstado() + '"' : '' }}</p>
          </div>
        }
      }
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() <= 1" (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} comercios</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
      </div>
    }

<!-- MODAL CREAR / EDITAR -->
@if (modalVisible()) {
  <div class="overlay" (click)="cerrarModal()">
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">{{ editandoId() ? 'Editar comercio' : 'Nuevo comercio' }}</h2>

      <form [formGroup]="form" (ngSubmit)="guardar()">

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Nombre comercial *</label>
            <input formControlName="nombreComercial" class="rs-input" placeholder="Mi Hotel SA" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Razón social *</label>
            <input formControlName="razonSocial" class="rs-input" placeholder="Mi Hotel SAC" />
          </div>
        </div>

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">RUC *</label>
            <input formControlName="vatNumber" class="rs-input" placeholder="20123456789"
              [attr.readonly]="editandoId() ? true : null" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Logo URL</label>
            <input formControlName="logoUrl" class="rs-input" placeholder="https://..." />
          </div>
        </div>

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Plan</label>
            <select formControlName="plan" class="rs-input">
              <option value="basico">Básico</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Estado</label>
            <select formControlName="estado" class="rs-input">
              <option value="pendiente">Pendiente</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        <div class="rs-form-group">
          <label class="rs-label">Comisión override (%)</label>
          <input formControlName="comisionPctOverride" type="number" step="0.01" min="0" max="1" class="rs-input"
            placeholder="Dejar en blanco para usar el default del vertical" />
        </div>

        <div class="rs-form-group">
          <label class="rs-label">Verticales</label>
          <div class="verticales-check">
            @for (v of verticalesOpciones; track v) {
              <label class="check-item">
                <input type="checkbox"
                  [checked]="verticalesSeleccionadas().includes(v)"
                  (change)="toggleVertical(v)" />
                <rs-icon [name]="iconVertical(v)" [size]="14" [stroke]="2"></rs-icon> {{ labelVertical(v) }}
              </label>
            }
          </div>
        </div>

        @if (modalError()) {
          <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarModal()">Cancelar</button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear comercio') }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- MODAL CONFIRMAR ELIMINAR -->
<!-- Ficha administrativa del comercio (TCK-8034) -->
@if (fichaAbierta()) {
  <div class="modal-backdrop" (click)="cerrarFicha()">
    <div class="ficha" (click)="$event.stopPropagation()">
      @if (cargandoFicha()) {
        <p style="color:var(--t-400)">Cargando la ficha…</p>
      } @else if (ficha(); as f) {
        <div class="ficha__cabecera">
          <div>
            <h3 class="ficha__nombre">{{ f.comercio.nombreComercial }}</h3>
            <p class="ficha__meta">
              {{ f.comercio.razonSocial }} · {{ f.comercio.vatNumber }}
              · {{ f.comercio.estado }} · plan {{ f.comercio.plan }}
              @if (f.comercio.createdAt) { · alta {{ f.comercio.createdAt | date:'d MMM yyyy' }} }
            </p>
          </div>
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarFicha()">Cerrar</button>
        </div>

        <div class="ficha__kpis">
          <div class="ficha__kpi"><strong>{{ f.resumen.servicios }}</strong><span>Servicios</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.reservas }}</strong><span>Reservas recientes</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.facturacion | number:'1.0-0' }} €</strong><span>Facturación</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.comision | number:'1.0-0' }} €</strong><span>Comisión Doogking</span></div>
          <div class="ficha__kpi">
            <strong>{{ f.resumen.valoracion ? (f.resumen.valoracion | number:'1.1-1') : '—' }}</strong>
            <span>Valoración ({{ f.resumen.resenas }})</span>
          </div>
          <div class="ficha__kpi"><strong>{{ f.resumen.equipo }}</strong><span>Equipo</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.incidencias }}</strong><span>Incidencias</span></div>
        </div>

        <div class="ficha__bloque">
          <h4>Verticales</h4>
          <p>@for (v of f.comercio.verticales; track v) { {{ labelVertical(v) }}{{ $last ? '' : ' · ' }} }</p>
        </div>

        <div class="ficha__bloque">
          <h4>Verificación</h4>
          <p>
            {{ verifLabel(f.comercio.verificacion?.estado ?? 'sin_verificar') }}
            @if (f.comercio.verificacion?.motivoRechazo) {
              · motivo del rechazo: {{ f.comercio.verificacion!.motivoRechazo }}
            }
            @if (f.comercio.verificacion?.documentos?.length) {
              · {{ f.comercio.verificacion!.documentos!.length }} documento(s) aportado(s)
            }
          </p>
        </div>

        <div class="ficha__bloque">
          <h4>Últimas reservas</h4>
          @if (f.reservas.length) {
            <ul class="ficha__reservas">
              @for (r of f.reservas; track r._id) {
                <li>
                  <code>{{ r.codigo }}</code>
                  <span>{{ r.vertical }} · {{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy' }}</span>
                  <span>{{ r.montoTotal | number:'1.2-2' }} €</span>
                  <span class="rs-badge rs-badge--neutral">{{ r.estado }}</span>
                </li>
              }
            </ul>
          } @else {
            <p style="color:var(--t-400)">Todavía no ha recibido reservas.</p>
          }
        </div>
      } @else {
        <p class="rs-alert rs-alert--error">No se pudo cargar la ficha.</p>
      }
    </div>
  </div>
}

<!-- Suspender o rechazar exige motivo: queda en el historial (TCK-8034) -->
@if (suspendiendo(); as c) {
  <div class="modal-backdrop" (click)="cancelarSuspender()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3 class="modal__titulo">
        {{ c.estado === 'pendiente' ? 'Rechazar la solicitud de' : 'Suspender a' }} {{ c.nombreComercial }}
      </h3>
      <p class="modal__texto">
        Explica el motivo. Se guarda en el historial administrativo y permite justificar la decisión.
      </p>
      <input class="rs-inp" [value]="motivoSuspension()"
             (input)="motivoSuspension.set($any($event.target).value)"
             placeholder="Ej. documentación caducada y sin renovar tras dos avisos" />
      @if (modalError()) { <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ modalError() }}</div> }
      <div class="modal__acciones">
        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarSuspender()">Cancelar</button>
        <button class="rs-btn rs-btn--danger rs-btn--sm"
                [disabled]="!motivoSuspension().trim() || accionando() === c._id"
                (click)="confirmarSuspender()">
          {{ c.estado === 'pendiente' ? 'Rechazar solicitud' : 'Suspender comercio' }}
        </button>
      </div>
    </div>
  </div>
}

@if (eliminarComercio()) {
  <div class="overlay" (click)="cancelarEliminar()">
    <div class="modal modal--sm rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">Eliminar comercio</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        ¿Estás seguro de que quieres eliminar
        <strong style="color:var(--t-100)">{{ eliminarComercio()!.nombreComercial }}</strong>?
        Esta acción no se puede deshacer.
      </p>
      @if (modalError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">Cancelar</button>
        <button class="rs-btn rs-btn--danger" [disabled]="guardando()" (click)="ejecutarEliminar()">
          {{ guardando() ? 'Eliminando…' : 'Eliminar' }}
        </button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-6); margin-bottom: var(--sp-6); flex-wrap: wrap; }
    .back-link { font-size: var(--f-sm); color: var(--c-accent); text-decoration: none; display: inline-block; margin-bottom: var(--sp-2); }
    .back-link:hover { text-decoration: underline; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .toolbar { display: flex; gap: var(--sp-4); margin-bottom: var(--sp-5); flex-wrap: wrap; align-items: center; }
    .filter-bar { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 240px; max-width: 360px; }

    .resumen-comercios { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .resumen-tile { padding: var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: 2px; }
    .resumen-tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .resumen-tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .ficha {
      width: 100%; max-width: 720px; max-height: 86vh; overflow-y: auto;
      padding: var(--sp-6); background: var(--c-card); border-radius: var(--r-xl);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.18));
      display: flex; flex-direction: column; gap: var(--sp-5);
    }
    .ficha__cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); }
    .ficha__nombre { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .ficha__meta { font-size: var(--f-sm); color: var(--t-400); }
    .ficha__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sp-3); }
    .ficha__kpi { padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); display: flex; flex-direction: column; }
    .ficha__kpi strong { font-family: var(--font-accent); font-size: var(--f-lg); color: var(--t-100); }
    .ficha__kpi span { font-size: var(--f-xs); color: var(--t-400); }
    .ficha__bloque h4 { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .ficha__bloque p { font-size: var(--f-sm); color: var(--t-300); }
    .ficha__reservas { display: flex; flex-direction: column; gap: var(--sp-2); list-style: none; }
    .ficha__reservas li { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; font-size: var(--f-sm); color: var(--t-300); }
    .ficha__reservas code { font-family: monospace; font-size: var(--f-xs); color: var(--c-accent); }

    .modal-backdrop {
      position: fixed; inset: 0; z-index: var(--z-4, 100);
      background: rgba(0,19,93,.35); display: flex; align-items: center; justify-content: center;
      padding: var(--sp-5);
    }
    .modal {
      width: 100%; max-width: 460px; padding: var(--sp-6);
      background: var(--c-card); border-radius: var(--r-xl); box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.18));
    }
    .modal__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .modal__texto { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .modal__acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-4); }

    .filtro-select { height: 40px; max-width: 220px; }

    .acciones { position: relative; display: flex; align-items: center; gap: var(--sp-2); justify-content: flex-end; }
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
      &:hover { background: var(--c-raised); }
    }
    .acciones__item--danger { color: var(--c-red, #B91C1C); }

    .tbl-head { display: grid; grid-template-columns: 2fr 120px 110px 110px 130px 110px 130px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 2fr 120px 110px 110px 130px 110px 130px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; }
    .tbl-row:last-child { border: none; }
    .tbl-row:hover { background: var(--c-raised); }

    /*
     * Móvil: una tabla de 6 columnas no se puede leer en 390px ni estrechando
     * ni con scroll lateral, así que deja de ser tabla. Cada fila se convierte
     * en una tarjeta y cada celda muestra su etiqueta (data-col) junto al dato.
     */
    @media (max-width: 768px) {
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

    .comercio-cell { display: flex; align-items: flex-start; gap: var(--sp-3); }
    .comercio-avatar { width: 36px; height: 36px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-sm); font-weight: var(--w-7); color: #fff; flex-shrink: 0; }
    .cell-primary { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .cell-muted { font-size: var(--f-xs); color: var(--t-400); }
    .cell-mono { font-family: monospace; font-size: var(--f-xs); color: var(--t-300); }
    .verticales-pills { display: flex; gap: var(--sp-1); flex-wrap: wrap; margin-top: var(--sp-1); }
    .acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }

    /*
     * Móvil: las acciones son el pie de la tarjeta, no una celda más. Se alinean
     * a la izquierda tras un separador y los botones con texto reparten el ancho;
     * los de solo icono se quedan cuadrados al final en vez de estirarse.
     */
    @media (max-width: 768px) {
      .acciones {
        justify-content: flex-start;
        gap: var(--sp-2);
        margin-top: var(--sp-1);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--b-1);
      }

      .acciones .rs-btn {
        /* Dos botones con texto por fila: repartir "auto" dejaba filas huérfanas. */
        flex: 1 1 calc(50% - var(--sp-2));
        justify-content: center;
        white-space: nowrap;
      }

      .acciones [data-icono] {
        flex: 0 0 44px;
        padding-inline: 0;
      }
    }


    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 16px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 120px; } .skel--lg { width: 180px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 640px; padding: var(--sp-8); max-height: 90vh; overflow-y: auto; }
    .modal--sm { max-width: 420px; }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
    @media (max-width: 540px) { .form-row { grid-template-columns: 1fr; } }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; margin-top: var(--sp-6); }

    .verticales-check { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin-top: var(--sp-2); }
    .check-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; }
    .check-item input { accent-color: var(--c-accent); width: 18px; height: 18px; }
  `],
})
export class AdminComerciosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly buscarSubject = new Subject<string>();

  readonly cargando = signal(true);
  readonly comercios = signal<ComercioAdmin[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly filtroEstado = signal('');
  readonly buscar = signal('');
  readonly errorMsg = signal('');
  readonly accionando = signal<string | null>(null);

  /** Resumen, filtros de página y menú de acciones (TCK-8034). */
  readonly resumen = signal<ResumenComercios | null>(null);
  readonly filtroVerificacion = signal('');
  readonly filtroVertical = signal('');
  readonly filtroPlan = signal('');
  readonly menuAbiertoId = signal<string | null>(null);
  readonly suspendiendo = signal<ComercioAdmin | null>(null);
  readonly fichaAbierta = signal(false);
  readonly cargandoFicha = signal(false);
  readonly ficha = signal<FichaComercio | null>(null);
  readonly motivoSuspension = signal('');

  readonly verticalesDisponibles = computed(() =>
    [...new Set(this.comercios().flatMap((c) => c.verticales))].sort(),
  );

  readonly comerciosFiltrados = computed(() => {
    const verificacion = this.filtroVerificacion();
    const vertical = this.filtroVertical();
    const plan = this.filtroPlan();
    return this.comercios().filter((c) => {
      if (verificacion && (c.verificacion?.estado ?? 'sin_verificar') !== verificacion) return false;
      if (vertical && !c.verticales.includes(vertical)) return false;
      if (plan && c.plan !== plan) return false;
      return true;
    });
  });

  readonly modalVisible = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalError = signal('');
  readonly eliminarComercio = signal<ComercioAdmin | null>(null);
  readonly verticalesSeleccionadas = signal<string[]>([]);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));
  readonly filtros = FILTROS;
  readonly verticalesOpciones = VERTICALES_OPCIONES;

  readonly form = this.fb.group({
    nombreComercial: ['', Validators.required],
    razonSocial: ['', Validators.required],
    vatNumber: ['', Validators.required],
    logoUrl: [''],
    plan: ['basico'],
    estado: ['activo'],
    comisionPctOverride: [null as number | null],
  });

  constructor() {
    this.buscarSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(valor => {
      this.buscar.set(valor);
      this.paginaActual.set(1);
      void this.cargar();
    });
  }

  /** El menú ⋯ se cierra al pulsar fuera. */
  @HostListener('document:click')
  cerrarMenu(): void {
    this.menuAbiertoId.set(null);
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
    try {
      this.resumen.set(await firstValueFrom(this.adminApi.getResumenComercios()));
    } catch {
      // Sin resumen la tabla sigue siendo utilizable.
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(this.adminApi.getComercios({
        page: this.paginaActual(),
        limite: LIMITE,
        estado: this.filtroEstado() || undefined,
        buscar: this.buscar() || undefined,
      }));
      this.comercios.set(result.items);
      this.total.set(result.total);
    } catch {
      this.errorMsg.set('Error cargando los comercios. Verifica que la API esté activa.');
    } finally {
      this.cargando.set(false);
    }
  }

  async setFiltro(estado: string): Promise<void> {
    this.filtroEstado.set(estado);
    this.paginaActual.set(1);
    await this.cargar();
  }

  onBuscar(event: Event): void {
    this.buscarSubject.next((event.target as HTMLInputElement).value);
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.paginaActual.set(pagina);
    await this.cargar();
  }

  async aprobar(id: string): Promise<void> {
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.aprobarComercio(id));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al aprobar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  async verificar(id: string): Promise<void> {
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.cambiarVerificacionComercio(id, 'verificado'));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al verificar la documentación.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  async rechazarVerif(id: string): Promise<void> {
    const motivo = prompt('Motivo del rechazo de la documentación (opcional):') ?? undefined;
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.cambiarVerificacionComercio(id, 'rechazado', motivo));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al rechazar la documentación.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  badgeVerif(estado: string): string {
    const map: Record<string, string> = {
      verificado: 'rs-badge--success', pendiente: 'rs-badge--warning',
      rechazado: 'rs-badge--error', caducado: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }

  verifLabel(estado: string): string {
    const map: Record<string, string> = {
      verificado: 'Verificado', pendiente: 'Doc. pendiente',
      rechazado: 'Doc. rechazada', caducado: 'Doc. caducada',
    };
    return map[estado] ?? estado;
  }

  /** Icono Lucide del estado de verificación documental (TCK-8010). */
  verifIcono(estado: string): string {
    const map: Record<string, string> = {
      verificado: 'badge-check', pendiente: 'hourglass',
      rechazado: 'x', caducado: 'alert-triangle',
    };
    return map[estado] ?? 'circle';
  }

  async suspender(id: string): Promise<void> {
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.rechazarComercio(id, this.motivoSuspension().trim()));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al suspender el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  async abrirFicha(comercio: ComercioAdmin): Promise<void> {
    this.fichaAbierta.set(true);
    this.cargandoFicha.set(true);
    this.ficha.set(null);
    try {
      this.ficha.set(await firstValueFrom(this.adminApi.getFichaComercio(comercio._id)));
    } catch {
      this.ficha.set(null);
    } finally {
      this.cargandoFicha.set(false);
    }
  }

  cerrarFicha(): void {
    this.fichaAbierta.set(false);
    this.ficha.set(null);
  }

  abrirSuspender(comercio: ComercioAdmin): void {
    this.suspendiendo.set(comercio);
    this.motivoSuspension.set('');
    this.modalError.set('');
  }

  cancelarSuspender(): void {
    this.suspendiendo.set(null);
    this.motivoSuspension.set('');
  }

  async confirmarSuspender(): Promise<void> {
    const comercio = this.suspendiendo();
    if (!comercio || !this.motivoSuspension().trim()) return;
    await this.suspender(comercio._id);
    this.cancelarSuspender();
  }

  abrirCrear(): void {
    this.editandoId.set(null);
    this.verticalesSeleccionadas.set([]);
    this.form.reset({ plan: 'basico', estado: 'activo' });
    this.form.get('vatNumber')!.enable();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  abrirEditar(c: ComercioAdmin): void {
    this.editandoId.set(c._id);
    this.verticalesSeleccionadas.set([...c.verticales]);
    this.form.patchValue({
      nombreComercial: c.nombreComercial,
      razonSocial: c.razonSocial,
      vatNumber: c.vatNumber,
      logoUrl: c.logoUrl ?? '',
      plan: c.plan,
      estado: c.estado,
      comisionPctOverride: c.comisionPctOverride ?? null,
    });
    this.form.get('vatNumber')!.disable();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  cerrarModal(): void {
    this.modalVisible.set(false);
    this.editandoId.set(null);
  }

  toggleVertical(v: string): void {
    const actual = this.verticalesSeleccionadas();
    if (actual.includes(v)) {
      this.verticalesSeleccionadas.set(actual.filter(x => x !== v));
    } else {
      this.verticalesSeleccionadas.set([...actual, v]);
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.modalError.set('');
    const v = this.form.getRawValue();
    try {
      if (this.editandoId()) {
        const dto: ActualizarComercioDto = {
          nombreComercial: v.nombreComercial!,
          razonSocial: v.razonSocial!,
          logoUrl: v.logoUrl || undefined,
          verticales: this.verticalesSeleccionadas(),
          plan: v.plan!,
          estado: v.estado!,
          comisionPctOverride: v.comisionPctOverride ?? undefined,
        };
        await firstValueFrom(this.adminApi.actualizarComercio(this.editandoId()!, dto));
      } else {
        const dto: CrearComercioDto = {
          nombreComercial: v.nombreComercial!,
          razonSocial: v.razonSocial!,
          vatNumber: v.vatNumber!,
          logoUrl: v.logoUrl || undefined,
          verticales: this.verticalesSeleccionadas(),
          plan: v.plan!,
          estado: v.estado!,
        };
        await firstValueFrom(this.adminApi.crearComercio(dto));
      }
      this.cerrarModal();
      await this.cargar();
    } catch {
      this.modalError.set('Error guardando el comercio. Verifica los datos e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  confirmarEliminar(c: ComercioAdmin): void {
    this.eliminarComercio.set(c);
    this.modalError.set('');
  }

  cancelarEliminar(): void {
    this.eliminarComercio.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const c = this.eliminarComercio();
    if (!c) return;
    this.guardando.set(true);
    this.modalError.set('');
    try {
      await firstValueFrom(this.adminApi.eliminarComercio(c._id));
      this.eliminarComercio.set(null);
      await this.cargar();
    } catch {
      this.modalError.set('Error eliminando el comercio.');
    } finally {
      this.guardando.set(false);
    }
  }

  iconVertical(vertical: string): string {
    return iconoVertical(vertical);
  }

  labelVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  badgeEstado(estado: string): string {
    const map: Record<string, string> = {
      activo: 'rs-badge--success',
      pendiente: 'rs-badge--warning',
      suspendido: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }
}
