import { AdminApiService, ComercioAdmin, ResumenComercios, FichaComercio, CrearComercioDto, ActualizarComercioDto } from './admin-api.service';
import { Component, OnInit, HostListener, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ImpactoBajaComercioDto, MOTIVOS_BAJA_COMERCIO, MotivoBajaComercio, VerticalKey, VERTICAL_LABELS } from 'shared';

import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

import { iconoVertical } from '../panel-comercio/vertical-icon';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { mensajeDeError } from '../../shared/mensaje-error';
import { RsAdminFiltrosComponent, GrupoFiltro, ValoresFiltro } from '../../shared/components/admin-filtros/rs-admin-filtros.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
const FILTROS = [
  { label: 'Todos', valor: '' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Activos', valor: 'activo' },
  { label: 'En pausa', valor: 'inactivo' },
  { label: 'Suspendidos', valor: 'suspendido' },
  // Los dados de baja no salen en "Todos": hay que pedirlos a propósito.
  { label: 'Dados de baja', valor: 'eliminado' },
] as const;

const VERTICALES_OPCIONES = Object.values(VerticalKey);
const LIMITE = 20;

@Component({
  selector: 'app-admin-comercios',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, DecimalPipe, ReactiveFormsModule, RsIconComponent, EurosPipe, RsAdminFiltrosComponent
  ],
  template: `
    <!-- Cabecera -->
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">{{ 'Comercios' | t }}</h1>
        <p class="rs-page-sub">{{ 'Gestiona los comercios registrados en la plataforma.' | t }}</p>
      </div>
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCrear()">{{ '+ Nuevo comercio' | t }}</button>
    </div>

    <!-- Resumen superior (TCK-8034) -->
    <div class="resumen-comercios">
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.total ?? total() }}</span>
        <span class="resumen-tile__lbl">{{ 'Comercios totales' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.activos ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Activos' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.pendientes ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Pendientes' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.suspendidos ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Suspendidos' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.enPausa ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'En pausa' | t }}</span>
      </div>
      @if ((resumen()?.dadosDeBaja ?? 0) > 0) {
        <button class="rs-card resumen-tile resumen-tile--accion" (click)="setFiltro('eliminado')">
          <span class="resumen-tile__num">{{ resumen()!.dadosDeBaja }}</span>
          <span class="resumen-tile__lbl">{{ 'Dados de baja' | t }}</span>
        </button>
      }
    </div>

    <!-- Barra de filtros + búsqueda (clases comunes .rs-toolbar) -->
    <!--
      Filtros plegados tras un botón, con el mismo lenguaje que el listado
      público (rs-listado): seis pastillas de estado y tres desplegables
      ocupaban media pantalla antes de la primera fila de la tabla. Lo aplicado
      se ve como pastillas quitables y el recuento va al lado, que era lo que
      faltaba para notar que el filtro había hecho algo.
    -->
    <rs-admin-filtros
      [grupos]="gruposFiltro()"
      [valores]="valoresFiltro()"
      [total]="total()"
      etiquetaSingular="comercio"
      etiquetaPlural="comercios"
      [buscar]="buscar()"
      buscarPlaceholder="Nombre, razón social o CIF/NIF…"
      (buscarCambio)="onBuscarTexto($event)"
      (cambio)="aplicarFiltros($event)" />

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <!-- Sin overflow:hidden: recortaba el desplegable de acciones, que se
         desborda de la tarjeta a propósito. Las esquinas se redondean en la
         cabecera y en la última fila (ver .tbl-head / .tbl-row:last-child). -->
    <div class="rs-card tbl-card" style="padding:0">
      <div class="tbl-head">
        <span>{{ 'Comercio' | t }}</span>
        <span>{{ 'CIF/NIF' | t }}</span>
        <span>{{ 'Plan' | t }}</span>
        <span>{{ 'Estado' | t }}</span>
        <span>{{ 'Registro' | t }}</span>
        <span>{{ 'Acciones' | t }}</span>
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
            <span class="cell-muted" data-col="Registro">{{ c.createdAt | date:'d MMM yyyy' }}</span>
            <div class="acciones" (click)="$event.stopPropagation()">
              <button class="rs-btn rs-btn--ghost rs-btn--sm" [attr.aria-label]="'Acciones' | t"
                      (click)="menuAbiertoId.set(menuAbiertoId() === c._id ? null : c._id)">
                <rs-icon name="more-horizontal" [size]="15" [stroke]="2"></rs-icon>
              </button>
              @if (menuAbiertoId() === c._id) {
                <div class="acciones__menu">
                  <!-- En un comercio pendiente lo primero es revisar su solicitud,
                       no aprobarla a ciegas (TCK-8034). Es la misma ficha, así que
                       en vez de duplicar la entrada cambia el rótulo. -->
                  <button class="acciones__item" (click)="abrirFicha(c)">
                    <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon>
                    {{ c.estado === 'pendiente' ? 'Revisar solicitud' : 'Ver ficha' }}
                  </button>
                  <button class="acciones__item" (click)="abrirEditar(c)">
                    <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon> {{ 'Editar datos' | t }}
                  </button>
                  @if (c.estado === 'eliminado') {
                    <!-- Una baja lógica se deshace; la cuenta vuelve en pausa
                         para que alguien la revise antes de republicarla. -->
                    <button class="acciones__item" [disabled]="accionando() === c._id" (click)="restaurar(c)">
                      <rs-icon name="check" [size]="13" [stroke]="2.5"></rs-icon> {{ 'Restaurar comercio' | t }}
                    </button>
                    <button class="acciones__item acciones__item--danger"
                            [disabled]="accionando() === c._id" (click)="confirmarEliminar(c)">
                      <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon> {{ 'Eliminar definitivamente' | t }}
                    </button>
                  } @else {
                    @if (c.estado !== 'activo') {
                      <button class="acciones__item" [disabled]="accionando() === c._id" (click)="aprobar(c._id)">
                        <rs-icon name="check" [size]="13" [stroke]="2.5"></rs-icon>
                        {{ c.estado === 'inactivo' ? 'Reactivar comercio' : 'Aprobar comercio' }}
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
                      <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon> {{ 'Dar de baja' | t }}
                    </button>
                  }
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
          [disabled]="paginaActual() <= 1" (click)="cambiarPagina(paginaActual() - 1)">{{ '← Anterior' | t }}</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} comercios</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">{{ 'Siguiente →' | t }}</button>
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
            <label class="rs-label">{{ 'Nombre comercial *' | t }}</label>
            <input formControlName="nombreComercial" class="rs-input" [placeholder]="'Mi Hotel SA' | t" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Razón social *' | t }}</label>
            <input formControlName="razonSocial" class="rs-input" [placeholder]="'Mi Hotel SAC' | t" />
          </div>
        </div>

        <div class="rs-form-group">
          <label class="rs-label">{{ 'RUC *' | t }}</label>
          <input formControlName="vatNumber" class="rs-input" placeholder="20123456789"
            [attr.readonly]="editandoId() ? true : null" />
        </div>

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Plan' | t }}</label>
            <select formControlName="plan" class="rs-input">
              <option value="basico">{{ 'Básico' | t }}</option>
              <option value="pro">{{ 'Pro' | t }}</option>
              <option value="premium">{{ 'Premium' | t }}</option>
            </select>
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Estado' | t }}</label>
            <select formControlName="estado" class="rs-input">
              <option value="pendiente">{{ 'Pendiente' | t }}</option>
              <option value="activo">{{ 'Activo' | t }}</option>
              <option value="suspendido">{{ 'Suspendido' | t }}</option>
            </select>
          </div>
        </div>

        <div class="rs-form-group">
          <label class="rs-label">{{ 'Comisión override (%)' | t }}</label>
          <input formControlName="comisionPctOverride" type="number" step="0.01" min="0" max="1" class="rs-input"
            [placeholder]="'Dejar en blanco para usar el default del vertical' | t" />
        </div>

        <div class="rs-form-group">
          <label class="rs-label">{{ 'Verticales' | t }}</label>
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
          <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarModal()">{{ 'Cancelar' | t }}</button>
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
        <p style="color:var(--t-400)">{{ 'Cargando la ficha…' | t }}</p>
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
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarFicha()">{{ 'Cerrar' | t }}</button>
        </div>

        <div class="ficha__kpis">
          <div class="ficha__kpi"><strong>{{ f.resumen.servicios }}</strong><span>{{ 'Servicios' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.reservas }}</strong><span>{{ 'Reservas recientes' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.facturacion | euros:'1.0-0' }}</strong><span>{{ 'Facturación' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.comision | euros:'1.0-0' }}</strong><span>{{ 'Comisión Doogking' | t }}</span></div>
          <div class="ficha__kpi">
            <strong>{{ f.resumen.valoracion ? (f.resumen.valoracion | number:'1.1-1') : '—' }}</strong>
            <span>Valoración ({{ f.resumen.resenas }})</span>
          </div>
          <div class="ficha__kpi"><strong>{{ f.resumen.equipo }}</strong><span>{{ 'Equipo' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.incidencias }}</strong><span>{{ 'Incidencias' | t }}</span></div>
        </div>

        <div class="ficha__bloque">
          <h4>{{ 'Verticales' | t }}</h4>
          <p>@for (v of f.comercio.verticales; track v) { {{ labelVertical(v) }}{{ $last ? '' : ' · ' }} }</p>
        </div>

        <div class="ficha__bloque">
          <h4>{{ 'Últimas reservas' | t }}</h4>
          @if (f.reservas.length) {
            <ul class="ficha__reservas">
              @for (r of f.reservas; track r._id) {
                <li>
                  <code>{{ r.codigo }}</code>
                  <span>{{ r.vertical }} · {{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy' }}</span>
                  <span>{{ r.montoTotal | euros:'1.2-2' }}</span>
                  <span class="rs-badge rs-badge--neutral">{{ r.estado }}</span>
                </li>
              }
            </ul>
          } @else {
            <p style="color:var(--t-400)">{{ 'Todavía no ha recibido reservas.' | t }}</p>
          }
        </div>
      } @else {
        <p class="rs-alert rs-alert--error">{{ 'No se pudo cargar la ficha.' | t }}</p>
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
        {{ 'Explica el motivo. Se guarda en el historial administrativo y permite justificar la decisión.' | t }}
      </p>
      <input class="rs-inp" [value]="motivoSuspension()"
             (input)="motivoSuspension.set($any($event.target).value)"
             [placeholder]="'Ej. documentación caducada y sin renovar tras dos avisos' | t" />
      @if (modalError()) { <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ modalError() }}</div> }
      <div class="modal__acciones">
        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarSuspender()">{{ 'Cancelar' | t }}</button>
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
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">Dar de baja {{ eliminarComercio()!.nombreComercial }}</h2>

      <!-- Lo que se lleva por delante, antes de decidir. -->
      @if (impacto(); as i) {
        <ul class="impacto">
          <li><strong>{{ i.servicios }}</strong> listados ({{ i.serviciosPublicados }} publicados) dejan de verse</li>
          <li><strong>{{ i.usuarios }}</strong> {{ 'cuentas del equipo pierden el acceso' | t }}</li>
          <li><strong>{{ i.reservas }}</strong> {{ 'reservas y' | t }} <strong>{{ i.resenas }}</strong> {{ 'reseñas en el historial' | t }}</li>
        </ul>
        @if (!i.puedeDarseDeBaja) {
          <div class="rs-alert rs-alert--warning" style="margin-bottom:var(--sp-4)">
            Hay {{ i.reservasActivas }} reserva(s) en curso. Complétalas o cancélalas antes de cerrar la cuenta.
          </div>
        }
      } @else {
        <p style="color:var(--t-400);margin-bottom:var(--sp-4)">{{ 'Calculando el impacto…' | t }}</p>
      }

      <div class="rs-form-group">
        <label class="rs-label" for="baja-motivo">{{ 'Motivo' | t }}</label>
        <select id="baja-motivo" class="rs-input" [value]="motivoBaja()"
                (change)="motivoBaja.set($any($event.target).value)">
          @for (m of motivosBaja; track m.valor) {
            <option [value]="m.valor">{{ m.label | t }}</option>
          }
        </select>
      </div>

      <div class="rs-form-group">
        <label class="rs-label" for="baja-comentario">{{ 'Comentario (opcional)' | t }}</label>
        <textarea id="baja-comentario" class="rs-input" rows="2" [value]="comentarioBaja()"
                  (input)="comentarioBaja.set($any($event.target).value)"></textarea>
      </div>

      <!-- Dos operaciones distintas, no una casilla escondida: la baja es
           reversible y conserva la contabilidad; la purga no. -->
      <label class="purga">
        <input type="checkbox" [checked]="purgar()" (change)="purgar.set($any($event.target).checked)" />
        <span>
          <strong>{{ 'Eliminar definitivamente' | t }}</strong> {{ '(borra listados, cuentas, reservas y pagos). Irreversible: úsalo sólo con datos de prueba.' | t }}
        </span>
      </label>

      @if (purgar()) {
        <div class="rs-form-group">
          <label class="rs-label" for="baja-confirmacion">
            {{ 'Escribe' | t }} <strong>{{ eliminarComercio()!.nombreComercial }}</strong> {{ 'para confirmar' | t }}
          </label>
          <input id="baja-confirmacion" class="rs-input" [value]="confirmacionBaja()"
                 (input)="confirmacionBaja.set($any($event.target).value)" />
        </div>
      }

      @if (modalError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">{{ 'Cancelar' | t }}</button>
        <button class="rs-btn rs-btn--danger" [disabled]="guardando() || !puedeConfirmarBaja()"
                (click)="ejecutarEliminar()">
          {{ guardando() ? 'Procesando…' : (purgar() ? 'Eliminar definitivamente' : 'Dar de baja') }}
        </button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: contents; }

    .back-link { font-size: var(--f-sm); color: var(--c-accent); text-decoration: none; display: inline-block; margin-bottom: var(--sp-2); }
    .back-link:hover { text-decoration: underline; }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .resumen-comercios { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .resumen-tile { padding: var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: 2px; }
    .resumen-tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .resumen-tile__lbl { font-size: var(--f-xs); color: var(--t-400); }
    .resumen-tile--accion { cursor: pointer; text-align: left; border: none; font: inherit; }
    .resumen-tile--accion:hover { box-shadow: var(--shadow-md); }

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

    .docs { list-style: none; margin: var(--sp-3) 0 0; padding: 0; display: grid; gap: var(--sp-2); }
    .docs__item {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-raised); font-size: var(--f-sm); color: var(--t-200);
    }
    .docs__nombre { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .docs__nombre em { color: var(--t-400); font-style: normal; }
    .docs__caducidad { font-size: var(--f-xs); color: var(--t-400); white-space: nowrap; }
    .docs__caducidad--vencida { color: #B91C1C; font-weight: var(--w-6); }
    .docs__vacio { color: var(--t-400); font-size: var(--f-sm); margin-top: var(--sp-2); }

    @media (max-width: 768px) {
      .docs__item { flex-wrap: wrap; }
      .docs__nombre { flex-basis: 100%; }
    }

    .acciones { position: relative; display: flex; align-items: center; gap: var(--sp-2); justify-content: flex-end; }

    /*
     * Las insignias de la tabla no se parten. "DOC. PENDIENTE" en mayúsculas y
     * con su icono pide unos 140px: en la columna de 130 que había, caía a dos
     * líneas y descuadraba el alto de la fila.
     */
    .tbl-row .rs-badge { white-space: nowrap; }
    .acciones__menu {
      position: absolute; right: 0; top: calc(100% + 4px);
      /*
       * Por encima de las filas siguientes: sin esto, el menú de una fila queda
       * por debajo de la de abajo y sus opciones no se pueden pulsar.
       */
      z-index: var(--z-3, 30);
      min-width: 210px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
    }

    /* En las últimas filas se abre hacia arriba para no salirse de la pantalla. */
    .tbl-row:nth-last-child(-n + 2) .acciones__menu {
      top: auto;
      bottom: calc(100% + 4px);
    }
    .acciones__item {
      display: flex; align-items: center; gap: var(--sp-2); width: 100%;
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer; text-align: left;
      font-size: var(--f-sm); color: var(--t-200);
      &:hover { background: var(--c-raised); }
    }
    .acciones__item--danger { color: var(--c-red, #B91C1C); }

    /*
     * La tarjeta no recorta su contenido para que el menú de acciones pueda
     * salirse; a cambio, las esquinas redondeadas se aplican aquí, en la primera
     * y la última fila, que es donde tocan el borde.
     */
    .tbl-card { overflow: visible; }
    .tbl-head { display: grid; grid-template-columns: 2fr 120px 110px 110px 150px 110px 56px; column-gap: var(--sp-3); padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); border-radius: var(--r-2xl) var(--r-2xl) 0 0; }
    .tbl-row { display: grid; grid-template-columns: 2fr 120px 110px 110px 150px 110px 56px; column-gap: var(--sp-3); padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; }
    .tbl-row:last-child { border: none; border-radius: 0 0 var(--r-2xl) var(--r-2xl); }
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
    .impacto { list-style: none; padding: var(--sp-4); margin: 0 0 var(--sp-5); border-radius: var(--r-lg);
      background: var(--c-surface); display: flex; flex-direction: column; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-300); }
    .impacto strong { color: var(--t-100); }
    .purga { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-4);
      border: 1px solid var(--c-error, var(--dk-gold)); border-radius: var(--r-lg);
      font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-4); cursor: pointer; }
    .purga input { margin-top: 3px; }

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
  readonly filtroVertical = signal('');
  readonly filtroPlan = signal('');
  readonly menuAbiertoId = signal<string | null>(null);

  /** Estado del diálogo de baja: impacto calculado, motivo y modo de borrado. */
  readonly impacto = signal<ImpactoBajaComercioDto | null>(null);
  readonly motivoBaja = signal<string>(MotivoBajaComercio.OTRO);
  readonly comentarioBaja = signal('');
  readonly confirmacionBaja = signal('');
  readonly purgar = signal(false);
  readonly motivosBaja = MOTIVOS_BAJA_COMERCIO;

  /**
   * La purga exige teclear el nombre del negocio; la baja lógica no, porque se
   * puede restaurar dentro del periodo de gracia.
   */
  readonly puedeConfirmarBaja = computed(() => {
    const comercio = this.eliminarComercio();
    if (!comercio) return false;
    if (this.impacto()?.puedeDarseDeBaja === false) return false;
    if (!this.purgar()) return true;
    return this.confirmacionBaja().trim().toLowerCase() === comercio.nombreComercial.trim().toLowerCase();
  });

  readonly suspendiendo = signal<ComercioAdmin | null>(null);
  readonly fichaAbierta = signal(false);
  readonly cargandoFicha = signal(false);
  readonly ficha = signal<FichaComercio | null>(null);
  readonly motivoSuspension = signal('');

  readonly verticalesDisponibles = computed(() =>
    [...new Set(this.comercios().flatMap((c) => c.verticales))].sort(),
  );

  readonly comerciosFiltrados = computed(() => {
    const vertical = this.filtroVertical();
    const plan = this.filtroPlan();
    return this.comercios().filter((c) => {
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

  /**
   * Los cuatro filtros de la vista, en el formato que entiende
   * `rs-admin-filtros`. El estado viaja al servidor (recarga la página de
   * resultados); los otros tres se aplican sobre lo ya cargado (TCK-8034).
   */
  readonly gruposFiltro = computed<GrupoFiltro[]>(() => [
    {
      clave: 'estado',
      label: 'Estado',
      tipo: 'pastillas',
      // La opción vacía la pinta el propio componente, así que aquí no va.
      opciones: FILTROS.filter((f) => f.valor).map((f) => ({ valor: f.valor, label: f.label })),
    },
    {
      clave: 'verificacion',
      label: 'Verificación',
      tipo: 'select',
      vacio: 'Cualquiera',
      opciones: [
        { valor: 'verificado', label: 'Verificados' },
        { valor: 'pendiente', label: 'Pendientes' },
        { valor: 'sin_verificar', label: 'Sin verificar' },
        { valor: 'rechazado', label: 'Rechazados' },
      ],
    },
    {
      clave: 'vertical',
      label: 'Vertical',
      tipo: 'select',
      opciones: this.verticalesDisponibles().map((v) => ({ valor: v, label: this.labelVertical(v) })),
    },
    {
      clave: 'plan',
      label: 'Plan',
      tipo: 'select',
      opciones: [
        { valor: 'basico', label: 'Básico' },
        { valor: 'pro', label: 'Pro' },
        { valor: 'premium', label: 'Premium' },
      ],
    },
  ]);

  readonly valoresFiltro = computed<ValoresFiltro>(() => ({
    estado: this.filtroEstado(),
    vertical: this.filtroVertical(),
    plan: this.filtroPlan(),
  }));

  readonly form = this.fb.group({
    nombreComercial: ['', Validators.required],
    razonSocial: ['', Validators.required],
    vatNumber: ['', Validators.required],
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

  onBuscarTexto(texto: string): void {
    this.buscarSubject.next(texto);
  }

  /**
   * Aplica lo elegido en el panel. Sólo el estado obliga a volver al servidor;
   * cambiarlo devuelve además a la primera página, porque el resultado anterior
   * ya no tiene por qué tener tantas.
   */
  async aplicarFiltros(valores: ValoresFiltro): Promise<void> {
    this.filtroVertical.set(valores['vertical'] ?? '');
    this.filtroPlan.set(valores['plan'] ?? '');

    const estado = valores['estado'] ?? '';
    if (estado !== this.filtroEstado()) await this.setFiltro(estado);
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

  async confirmarEliminar(c: ComercioAdmin): Promise<void> {
    this.eliminarComercio.set(c);
    this.modalError.set('');
    this.impacto.set(null);
    this.motivoBaja.set(MotivoBajaComercio.OTRO);
    this.comentarioBaja.set('');
    this.confirmacionBaja.set('');
    this.purgar.set(false);
    this.menuAbiertoId.set(null);
    try {
      this.impacto.set(await firstValueFrom(this.adminApi.getImpactoBaja(c._id)));
    } catch {
      this.modalError.set('No se pudo calcular el impacto de la baja.');
    }
  }

  cancelarEliminar(): void {
    this.eliminarComercio.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const c = this.eliminarComercio();
    if (!c || !this.puedeConfirmarBaja()) return;
    this.guardando.set(true);
    this.modalError.set('');
    try {
      await firstValueFrom(
        this.adminApi.eliminarComercio(c._id, {
          motivo: this.motivoBaja(),
          comentario: this.comentarioBaja().trim() || undefined,
          purgar: this.purgar(),
        }),
      );
      this.eliminarComercio.set(null);
      await this.cargar();
    } catch (error) {
      // El backend bloquea la baja si quedan reservas vivas; su mensaje es más
      // útil que un "error genérico".
      this.modalError.set(mensajeDeError(error, 'Error dando de baja el comercio.'));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Deshace una baja lógica: la cuenta vuelve en pausa, no publicada. */
  async restaurar(c: ComercioAdmin): Promise<void> {
    this.accionando.set(c._id);
    this.errorMsg.set('');
    try {
      await firstValueFrom(this.adminApi.restaurarComercio(c._id));
      await this.cargar();
    } catch (error) {
      this.errorMsg.set(mensajeDeError(error, 'No se pudo restaurar el comercio.'));
    } finally {
      this.accionando.set(null);
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
      inactivo: 'rs-badge--neutral',
      suspendido: 'rs-badge--error',
      eliminado: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }
}
