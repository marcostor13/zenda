import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { HitoFunerario, VerticalKey } from 'shared';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { ComercioApiService, MiReserva, SuplementoConfig } from './comercio-api.service';
import { PerrosService, HistoriaCompartidaApi, FilaHistorialApi } from '../perros/perros.service';
import { iconoVertical } from './vertical-icon';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
/** Hito de seguimiento en tiempo real que el comercio va marcando. */
interface Hito {
  readonly hito: string;
  readonly icono: string;
  readonly label: string;
}

const ESTADO_BADGE: Record<string, string> = {
  confirmada: 'rs-badge--success', pendiente: 'rs-badge--warning',
  cancelada: 'rs-badge--error', completada: 'rs-badge--accent', no_show: 'rs-badge--neutral',
  ajuste_solicitado: 'rs-badge--warning',
  en_curso: 'rs-badge--accent', pago_retenido: 'rs-badge--warning',
  pago_liberado: 'rs-badge--success', en_disputa: 'rs-badge--error', reembolsada: 'rs-badge--neutral',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', en_curso: 'En curso',
  completada: 'Completada', cancelada: 'Cancelada', no_show: 'No se presentó',
  ajuste_solicitado: 'Ajuste solicitado', pago_retenido: 'Pago retenido',
  pago_liberado: 'Pago liberado', en_disputa: 'En disputa', reembolsada: 'Reembolsada',
};

const ESTADO_ICONO: Record<string, string> = {
  pendiente: 'clock', confirmada: 'check-circle', en_curso: 'truck',
  completada: 'check', cancelada: 'x', no_show: 'alert-circle',
  ajuste_solicitado: 'euro', pago_retenido: 'clock', pago_liberado: 'check-circle',
  en_disputa: 'alert-circle', reembolsada: 'arrow-right',
};

type FiltroEstado = 'todas' | 'pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada';

const FILTROS: ReadonlyArray<{ valor: FiltroEstado; label: string }> = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'confirmada', label: 'Confirmadas' },
  { valor: 'en_curso', label: 'En curso' },
  { valor: 'completada', label: 'Completadas' },
  { valor: 'cancelada', label: 'Canceladas' },
];

type Periodo = 'todas' | 'hoy' | 'semana' | 'mes' | 'rango';

const PERIODOS: ReadonlyArray<{ valor: Periodo; label: string }> = [
  { valor: 'todas', label: 'Todas las fechas' },
  { valor: 'hoy', label: 'Hoy' },
  { valor: 'semana', label: 'Esta semana' },
  { valor: 'mes', label: 'Este mes' },
  { valor: 'rango', label: 'Elegir fechas' },
];

/** Verticales que se reservan por estancia (entrada/salida) y no por cita. */
const VERTICALES_ESTANCIA = new Set(['alojamiento', 'hoteles']);

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Medianoche del día, para comparar fechas sin que la hora estorbe. */
function aDia(fecha: string | Date): Date {
  const d = new Date(fecha);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Clave `YYYY-MM-DD` de un día del calendario, construida con las partes
 * **locales** de la fecha.
 *
 * Con `toISOString()` la clave se calculaba en UTC mientras que `aDia()` trabaja
 * en hora local, así que sólo coincidían en UTC+0: en España (UTC+1/+2) y en
 * América la celda que ponía "3" filtraba las reservas del día 2, o de ninguno.
 */
function claveDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Vuelta de `claveDia`: medianoche **local**, no UTC. */
function desdeClaveDia(clave: string): number {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, dia).getTime();
}

@Component({
  selector: 'app-comercio-reservas',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, DatePipe, FormsModule, RsIconComponent, RsImageUploadComponent, EurosPipe
  ],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Reservas' | t }}</h1>
        <p class="page-sub">{{ 'Gestiona el día a día de tu negocio: quién viene, cuándo y con qué mascota.' | t }}</p>
      </div>
    </div>

    <!-- RESUMEN DEL DÍA (TCK-8018) -->
    <div class="resumen">
      <button class="resumen__tile" [class.activa]="periodo() === 'hoy'" (click)="verHoy()">
        <span class="resumen__icon"><rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon></span>
        <span class="resumen__dato">
          <strong>{{ reservasDeHoy().length }}</strong>
          <span>{{ 'Reservas de hoy' | t }}</span>
        </span>
      </button>
      <button class="resumen__tile" [class.activa]="filtroActivo() === 'pendiente'" (click)="verPendientes()">
        <span class="resumen__icon resumen__icon--warning"><rs-icon name="clock" [size]="18" [stroke]="2"></rs-icon></span>
        <span class="resumen__dato">
          <strong>{{ contarEstado('pendiente') }}</strong>
          <span>{{ 'Pendientes de confirmar' | t }}</span>
        </span>
      </button>
      <div class="resumen__tile resumen__tile--estatica">
        <span class="resumen__icon resumen__icon--accent"><rs-icon name="arrow-right" [size]="18" [stroke]="2"></rs-icon></span>
        <span class="resumen__dato">
          <strong>{{ proximas().length }}</strong>
          <span>{{ 'Próximas (7 días)' | t }}</span>
        </span>
      </div>
    </div>

    <!-- BUSCADOR Y FILTROS -->
    <div class="controles">
      <label class="buscador">
        <rs-icon name="search" [size]="15" [stroke]="2"></rs-icon>
        <input class="buscador__input" type="search"
               [placeholder]="'Buscar por cliente, mascota o nº de reserva' | t"
               [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
               [ngModelOptions]="{standalone: true}" />
      </label>

      <select class="rs-inp control-select" [ngModel]="periodo()"
              (ngModelChange)="periodo.set($event)" [ngModelOptions]="{standalone: true}"
              [attr.aria-label]="'Periodo' | t">
        @for (p of periodos; track p.valor) {
          <option [value]="p.valor">{{ p.label | t }}</option>
        }
      </select>

      @if (periodo() === 'rango') {
        <input class="rs-inp control-fecha" type="date" [ngModel]="desde()"
               (ngModelChange)="desde.set($event)" [ngModelOptions]="{standalone: true}"
               [attr.aria-label]="'Desde' | t" />
        <input class="rs-inp control-fecha" type="date" [ngModel]="hasta()"
               (ngModelChange)="hasta.set($event)" [ngModelOptions]="{standalone: true}"
               [attr.aria-label]="'Hasta' | t" />
      }

      @if (servicios().length > 1) {
        <select class="rs-inp control-select" [ngModel]="servicioFiltro()"
                (ngModelChange)="servicioFiltro.set($event)" [ngModelOptions]="{standalone: true}"
                [attr.aria-label]="'Servicio' | t">
          <option value="">{{ 'Todos los servicios' | t }}</option>
          @for (s of servicios(); track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      }

      <div class="vista-toggle" role="group" [attr.aria-label]="'Visualización' | t">
        <button class="vista-toggle__btn" [class.activa]="vista() === 'lista'" (click)="vista.set('lista')">
          <rs-icon name="list" [size]="14" [stroke]="2"></rs-icon> {{ 'Lista' | t }}
        </button>
        <button class="vista-toggle__btn" [class.activa]="vista() === 'calendario'" (click)="vista.set('calendario')">
          <rs-icon name="calendar" [size]="14" [stroke]="2"></rs-icon> {{ 'Calendario' | t }}
        </button>
      </div>
    </div>

    <!-- FILTER PILLS -->
    <div class="filter-pills">
      @for (f of filtros; track f.valor) {
        <button
          class="filter-pill"
          [class.active]="filtroActivo() === f.valor"
          (click)="filtroActivo.set(f.valor)">
          {{ f.label | t }}
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
    } @else if (reservas().length === 0) {
      <!-- Vacío real: el comercio todavía no ha recibido ninguna reserva -->
      <div class="rs-card empty-state">
        <rs-icon name="calendar" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>
          {{ 'Todavía no tienes reservas. Cuando recibas una reserva aparecerá aquí con toda la información necesaria para gestionarla.' | t }}
        </p>
        <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary">
          <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon> {{ 'Crear o publicar un servicio' | t }}
        </a>
      </div>
    } @else {
      @if (vista() === 'calendario') {
        <div class="rs-card calendario">
          <div class="calendario__head">
            <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cambiarMes(-1)" [attr.aria-label]="'Mes anterior' | t">
              <rs-icon name="chevron-left" [size]="15" [stroke]="2"></rs-icon>
            </button>
            <strong class="calendario__mes">{{ mes() | date:'LLLL yyyy' }}</strong>
            <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cambiarMes(1)" [attr.aria-label]="'Mes siguiente' | t">
              <rs-icon name="chevron-right" [size]="15" [stroke]="2"></rs-icon>
            </button>
          </div>
          <div class="calendario__grid">
            @for (d of diasSemana; track d) {
              <span class="calendario__dow">{{ d }}</span>
            }
            @for (celda of celdasCalendario(); track celda.clave) {
              <button class="calendario__dia"
                      [class.fuera]="!celda.delMes"
                      [class.hoy]="celda.esHoy"
                      [class.seleccionado]="diaSeleccionado() === celda.clave"
                      (click)="seleccionarDia(celda.clave)">
                <span class="calendario__num">{{ celda.dia }}</span>
                @if (celda.reservas.length) {
                  <span class="calendario__marca">{{ celda.reservas.length }}</span>
                }
              </button>
            }
          </div>
          <p class="calendario__pie">
            {{ diaSeleccionado()
               ? 'Reservas del día seleccionado.'
               : 'Elige un día para ver sus reservas; sin selección se listan todas las del filtro.' }}
            @if (diaSeleccionado()) {
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="diaSeleccionado.set(null)">{{ 'Quitar el día' | t }}</button>
            }
          </p>
        </div>
      }

      @if (reservasFiltradas().length === 0) {
        <div class="rs-card empty-state">
          <rs-icon name="search" [size]="36" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
          <p>{{ 'Ninguna reserva coincide con lo que has buscado.' | t }}</p>
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarFiltros()">{{ 'Quitar los filtros' | t }}</button>
        </div>
      } @else {
        <div class="reservas-lista">
          @for (r of reservasFiltradas(); track r._id) {
            <div class="reserva-card">
              <div class="reserva-card__main">
                <span class="reserva-card__icono">
                  <rs-icon [name]="iconVertical(r.vertical)" [size]="18" [stroke]="1.75"></rs-icon>
                </span>

                <div class="reserva-card__info">
                  <div class="reserva-card__titulo">
                    <strong>{{ r.perroNombre || 'Mascota sin ficha' }}</strong>
                    <span class="reserva-card__cliente">· {{ r.clienteNombre || 'Cliente' }}</span>
                  </div>
                  <div class="reserva-card__servicio">
                    {{ r.servicioTitulo || r.vertical }}
                  </div>
                  @if (resumenPerro(r).length) {
                    <div class="resumen-perro">
                      @for (dato of resumenPerro(r); track dato) {
                        <span class="resumen-perro__chip">
                          <rs-icon name="alert-circle" [size]="11" [stroke]="2.5"></rs-icon>
                          {{ dato }}
                        </span>
                      }
                    </div>
                  }
                  <div class="reserva-card__fecha">
                    <rs-icon [name]="esEstancia(r.vertical) ? 'hotel' : 'clock'" [size]="13" [stroke]="2"></rs-icon>
                    @if (esEstancia(r.vertical)) {
                      Ingreso {{ r.fechaInicio | date:'d MMM' }}
                      @if (r.fechaFin) { · Salida {{ r.fechaFin | date:'d MMM' }} }
                    } @else {
                      {{ r.fechaInicio | date:'d MMM yyyy' }} · {{ r.fechaInicio | date:'HH:mm' }}
                    }
                  </div>
                </div>

                <div class="reserva-card__meta">
                  <span class="rs-badge {{ badgeEstado(r.estado) }}">
                    <rs-icon [name]="iconoEstado(r.estado)" [size]="12" [stroke]="2"></rs-icon>
                    {{ etiquetaEstado(r.estado) }}
                  </span>
                  <span class="reserva-card__importe">{{ (r.montoAjustado ?? r.montoTotal) | euros:'1.2-2' }}</span>
                  <code class="reserva-card__codigo">{{ r.codigo }}</code>
                </div>
              </div>

              <!-- Acciones rápidas -->
              <div class="reserva-card__acciones">
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleDetalle(r._id)">
                  <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon>
                  {{ detalleAbiertoId() === r._id ? 'Ocultar' : 'Ver reserva' }}
                </button>
                @if (r.clienteTelefono) {
                  <a class="rs-btn rs-btn--ghost rs-btn--sm" [href]="'tel:' + r.clienteTelefono">
                    <rs-icon name="phone" [size]="13" [stroke]="2"></rs-icon> {{ 'Contactar' | t }}
                  </a>
                } @else if (r.clienteEmail) {
                  <a class="rs-btn rs-btn--ghost rs-btn--sm" [href]="'mailto:' + r.clienteEmail">
                    <rs-icon name="mail" [size]="13" [stroke]="2"></rs-icon> {{ 'Contactar' | t }}
                  </a>
                }
                @if (tieneGestion(r)) {
                  <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="toggleGestion(r._id)">
                    <rs-icon name="settings" [size]="13" [stroke]="2"></rs-icon>
                    {{ gestionAbiertaId() === r._id ? 'Cerrar' : 'Gestionar' }}
                  </button>
                }
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleIncidencia(r._id)">
                  <rs-icon name="alert-circle" [size]="13" [stroke]="2"></rs-icon>
                  {{ incidenciaAbiertaId() === r._id ? 'Cerrar' : 'Incidencia' }}
                </button>
              </div>

              @if (detalleAbiertoId() === r._id) {
                <div class="reserva-card__panel">
                  <dl class="detalle">
                    <div><dt>{{ 'Nº de reserva' | t }}</dt><dd>{{ r.codigo }}</dd></div>
                    <div><dt>{{ 'Servicio' | t }}</dt><dd>{{ r.servicioTitulo || r.vertical }}</dd></div>
                    <div><dt>{{ 'Cliente' | t }}</dt><dd>{{ r.clienteNombre || '—' }}</dd></div>
                    @if (r.clienteEmail) { <div><dt>{{ 'Email' | t }}</dt><dd>{{ r.clienteEmail }}</dd></div> }
                    @if (r.clienteTelefono) { <div><dt>{{ 'Teléfono' | t }}</dt><dd>{{ r.clienteTelefono }}</dd></div> }
                    <div><dt>{{ 'Mascota' | t }}</dt><dd>{{ r.perroNombre || '—' }}</dd></div>
                    <div>
                      <dt>{{ esEstancia(r.vertical) ? 'Ingreso' : 'Fecha y hora' }}</dt>
                      <dd>{{ r.fechaInicio | date:'d MMM yyyy, HH:mm' }}</dd>
                    </div>
                    @if (r.fechaFin) {
                      <div><dt>{{ esEstancia(r.vertical) ? 'Salida' : 'Fin' }}</dt><dd>{{ r.fechaFin | date:'d MMM yyyy, HH:mm' }}</dd></div>
                    }
                    <div><dt>{{ 'Importe' | t }}</dt><dd>{{ (r.montoAjustado ?? r.montoTotal) | euros:'1.2-2' }}</dd></div>
                    <div><dt>{{ 'Reservada el' | t }}</dt><dd>{{ r.createdAt | date:'d MMM yyyy' }}</dd></div>
                  </dl>
                  @if (r.suplementos?.length) {
                    <p class="detalle__suplementos">
                      <strong>{{ 'Suplementos:' | t }}</strong>
                      @for (s of r.suplementos; track $index) {
                        {{ s.concepto }} (+{{ s.monto | euros:'1.2-2' }}){{ $last ? '' : ' · ' }}
                      }
                    </p>
                  }

                  <!-- Cuestionario ampliado y vídeos (Ref. ADI2/ADI3) -->
                  @if (r.vertical === 'adiestramiento' && (r.detalle?.['historialPrevio'] || r.detalle?.['vinculoPropietario'] || videosDe(r).length)) {
                    <div class="detalle__adiestramiento">
                      @if (r.detalle?.['historialPrevio']) {
                        <p><strong>{{ 'Historial previo:' | t }}</strong> {{ r.detalle!['historialPrevio'] }}</p>
                      }
                      @if (r.detalle?.['vinculoPropietario']) {
                        <p><strong>{{ 'Vínculo con el propietario:' | t }}</strong> {{ r.detalle!['vinculoPropietario'] }}</p>
                      }
                      @if (videosDe(r).length) {
                        <p><strong>{{ 'Vídeos del comportamiento:' | t }}</strong></p>
                        <ul class="videos-lista">
                          @for (url of videosDe(r); track url; let i = $index) {
                            <li><a [href]="url" target="_blank" rel="noopener">Vídeo {{ i + 1 }}</a></li>
                          }
                        </ul>
                      }
                    </div>
                  }

                  <!-- Seguimiento estructurado del progreso (Ref. ADI5) -->
                  @if (r.vertical === 'adiestramiento' && (r.estado === 'confirmada' || r.estado === 'completada' || r.estado === 'en_curso')) {
                    <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" style="margin-top:var(--sp-3)"
                            (click)="toggleSeguimientoAdiestramiento(r._id)">
                      <rs-icon name="clipboard-list" [size]="13" [stroke]="2"></rs-icon>
                      {{ seguimientoAbiertoId() === r._id ? 'Cerrar' : 'Registrar seguimiento de la sesión' }}
                    </button>
                    @if (seguimientoAbiertoId() === r._id) {
                      <div class="ajuste-panel" style="margin-top:var(--sp-3)">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Objetivos trabajados' | t }}</label>
                          <textarea class="rs-inp" rows="2" [value]="seguimientoObjetivos()"
                                    (input)="seguimientoObjetivos.set($any($event.target).value)"></textarea>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Evolución observada' | t }}</label>
                          <textarea class="rs-inp" rows="2" [value]="seguimientoEvolucion()"
                                    (input)="seguimientoEvolucion.set($any($event.target).value)"></textarea>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tareas para casa' | t }}</label>
                          <textarea class="rs-inp" rows="2" [value]="seguimientoTareas()"
                                    (input)="seguimientoTareas.set($any($event.target).value)"></textarea>
                        </div>
                        <div class="ajuste-panel__actions">
                          <button type="button" class="rs-btn rs-btn--primary rs-btn--sm"
                                  [disabled]="guardandoSeguimiento() || !puedeGuardarSeguimiento()"
                                  (click)="guardarSeguimientoAdiestramiento(r)">
                            {{ guardandoSeguimiento() ? 'Guardando…' : 'Guardar seguimiento' }}
                          </button>
                        </div>
                        @if (mensajeSeguimiento()) {
                          <p class="ajuste-panel__hint">{{ mensajeSeguimiento() }}</p>
                        }
                      </div>
                    }
                  }
                </div>
              }

              @if (incidenciaAbiertaId() === r._id) {
                <!-- Reclamar sobre una reserva: llega al panel de incidencias del
                     admin con su historial (TCK-8040 §2). -->
                <div class="reserva-card__panel">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Tipo' | t }}</label>
                    <select class="rs-inp" [value]="incidenciaTipo()"
                            (change)="incidenciaTipo.set($any($event.target).value)">
                      <option value="incidencia">{{ 'Incidencia con el servicio' | t }}</option>
                      <option value="reclamacion">{{ 'Reclamación' | t }}</option>
                      <option value="devolucion">{{ 'Solicitud de devolución' | t }}</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Asunto' | t }}</label>
                    <input class="rs-inp" [value]="incidenciaAsunto()"
                           (input)="incidenciaAsunto.set($any($event.target).value)"
                           [placeholder]="'Ej. el cliente no se presentó' | t" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Qué ha pasado' | t }}</label>
                    <input class="rs-inp" [value]="incidenciaDescripcion()"
                           (input)="incidenciaDescripcion.set($any($event.target).value)"
                           [placeholder]="'Cuenta lo ocurrido con el detalle que puedas' | t" />
                  </div>
                  <div class="ajuste-panel__actions">
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarIncidencia()">{{ 'Cancelar' | t }}</button>
                    <button class="rs-btn rs-btn--primary rs-btn--sm"
                            [disabled]="!puedeEnviarIncidencia() || enviandoIncidencia()"
                            (click)="enviarIncidencia(r)">
                      {{ enviandoIncidencia() ? 'Enviando…' : 'Abrir incidencia' }}
                    </button>
                  </div>
                </div>
              }

              @if (gestionAbiertaId() === r._id) {
                <div class="reserva-card__panel reserva-card__panel--acciones">
                  @if (r.estado === 'confirmada') {
                    <button class="rs-btn rs-btn--outline rs-btn--sm"
                            [disabled]="completandoId() === r._id"
                            (click)="completar(r)">
                      {{ completandoId() === r._id ? 'Guardando…' : 'Marcar completada' }}
                    </button>
                    @if (r.vertical !== 'veterinaria') {
                      <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleAjuste(r._id)">
                        {{ 'Solicitar ajuste' | t }}
                      </button>
                    }
                  }
                  @if (r.estado === 'completada' && r.perroId && !valoradoId().has(r._id)) {
                    <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="toggleValorar(r._id)">
                      <rs-icon name="star" [size]="13" [stroke]="2.5"></rs-icon> {{ 'Valorar perro' | t }}
                    </button>
                  }
                  @if (valoradoId().has(r._id)) {
                    <span class="rs-badge rs-badge--success">
                      <rs-icon name="star" [size]="12" [stroke]="2.5" [filled]="true"></rs-icon> {{ 'Valorado' | t }}
                    </span>
                  }
                  @if (r.vertical === 'veterinaria' && r.perroId) {
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleHistoriaVeterinaria(r)">
                      <rs-icon name="stethoscope" [size]="13" [stroke]="2"></rs-icon> {{ 'Historia veterinaria' | t }}
                    </button>
                  }
                  @if (hitosDe(r.vertical).length && (r.estado === 'confirmada' || r.estado === 'en_curso')) {
                    @for (h of hitosDe(r.vertical); track h.hito) {
                      <button class="rs-btn rs-btn--ghost rs-btn--sm"
                              [disabled]="seguimientoId() === r._id"
                              (click)="marcarHito(r, h.hito)">
                        <rs-icon [name]="h.icono" [size]="13" [stroke]="2"></rs-icon> {{ h.label | t }}
                      </button>
                    }
                  }
                </div>
              }

              @if (historiaAbiertaId() === r._id) {
                <div class="reserva-card__panel">
                  <div class="ajuste-panel">
                    @if (cargandoHistoria()) {
                      <p class="ajuste-panel__hint">{{ 'Cargando historia veterinaria compartida…' | t }}</p>
                    } @else if (errorHistoria()) {
                      <p class="ajuste-panel__hint">{{ errorHistoria() }}</p>
                    } @else if (historiaVeterinaria(); as h) {
                      <p class="ajuste-panel__hint">
                        {{ h.nombre }} · {{ h.especie }} @if (h.raza) { · {{ h.raza }} } @if (h.peso) { · {{ h.peso }} kg }
                        @if (h.esterilizado) { · Esterilizado/a }
                      </p>
                      @if (h.alergias.length) { <p><strong>{{ 'Alergias:' | t }}</strong> {{ h.alergias.join(', ') }}</p> }
                      @if (h.enfermedades.length) { <p><strong>{{ 'Enfermedades:' | t }}</strong> {{ h.enfermedades.join(', ') }}</p> }
                      @if (h.medicacion.length) { <p><strong>{{ 'Medicación:' | t }}</strong> {{ h.medicacion.join(', ') }}</p> }
                      @if (h.vacunas.length) { <p><strong>{{ 'Vacunas:' | t }}</strong> {{ h.vacunas.join(', ') }}</p> }
                      @if (h.dieta) { <p><strong>{{ 'Dieta:' | t }}</strong> {{ h.dieta }}</p> }
                      @if (h.historial.length) {
                        <p><strong>{{ 'Historial de otros profesionales:' | t }}</strong></p>
                        @for (nota of h.historial; track $index) {
                          <p class="ajuste-panel__hint">· [{{ nota.vertical }}] {{ nota.nota }}</p>
                        }
                      }

                      <!-- Cargar historial clínico desde Excel/documento (Ref. VET5) -->
                      <div class="importar-historial">
                        <p><strong>{{ 'Añadir historial pegando una tabla o Excel' | t }}</strong></p>
                        <p class="ajuste-panel__hint">
                          {{ 'Copia y pega aquí las filas (fecha, concepto, detalle separados por tabulador o coma).' | t }}
                        </p>
                        <textarea class="rs-inp" rows="3"
                                  [value]="textoImportar()"
                                  (input)="textoImportar.set($any($event.target).value)"
                                  [placeholder]="'12/03/2026&#9;Vacuna rabia&#9;Refuerzo anual' | t"></textarea>
                        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                                [disabled]="!textoImportar().trim() || previsualizando()"
                                (click)="previsualizarImportacion()">
                          {{ previsualizando() ? 'Analizando…' : 'Previsualizar' }}
                        </button>

                        @if (filasImportar().length) {
                          <table class="importar-tabla rs-tabla">
                            <thead>
                              <tr><th>{{ 'Fecha' | t }}</th><th>{{ 'Concepto' | t }}</th><th>{{ 'Detalle' | t }}</th><th></th></tr>
                            </thead>
                            <tbody>
                              @for (fila of filasImportar(); track $index) {
                                <tr>
                                  <td [attr.data-label]="'Fecha' | t">{{ fila.fecha || '—' }}</td>
                                  <td [attr.data-label]="'Concepto' | t">{{ fila.concepto }}</td>
                                  <td [attr.data-label]="'Detalle' | t">{{ fila.detalle || '—' }}</td>
                                  <td>
                                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarFilaImportar($index)">
                                      <rs-icon name="x" [size]="12" [stroke]="2"></rs-icon>
                                    </button>
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                          <button type="button" class="rs-btn rs-btn--primary rs-btn--sm"
                                  [disabled]="importandoHistorial()"
                                  (click)="importarHistorial(r)">
                            {{ importandoHistorial() ? 'Guardando…' : 'Guardar ' + filasImportar().length + ' filas' }}
                          </button>
                        }
                        @if (mensajeImportacion()) {
                          <p class="ajuste-panel__hint">{{ mensajeImportacion() }}</p>
                        }
                      </div>
                    }
                    <div class="ajuste-panel__actions">
                      <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="historiaAbiertaId.set(null)">{{ 'Cerrar' | t }}</button>
                    </div>
                  </div>
                </div>
              }

              @if (valorarAbiertoId() === r._id) {
                <div class="reserva-card__panel">
                  <div class="ajuste-panel">
                    <p class="ajuste-panel__hint">
                      {{ 'Tu valoración se suma al pasaporte digital del perro y ayuda a otros profesionales de Doogking a adaptar el servicio.' | t }}
                    </p>
                    <div class="resena-form__estrellas">
                      @for (n of [1,2,3,4,5]; track n) {
                        <button type="button" class="estrella-btn" [class.activa]="n <= puntuacionValoracion()"
                                [attr.aria-label]="n + ' de 5'"
                                (click)="puntuacionValoracion.set(n)">
                          <rs-icon name="star" [size]="24" [stroke]="1.75"
                                   [filled]="n <= puntuacionValoracion()"></rs-icon>
                        </button>
                      }
                    </div>
                    <div class="rs-field">
                      <label class="rs-lbl">{{ 'Comentario (opcional)' | t }}</label>
                      <input class="rs-inp" [(ngModel)]="comentarioValoracion"
                             [ngModelOptions]="{standalone: true}"
                             [placeholder]="'Ej. muy tranquilo, excelente comportamiento' | t" />
                    </div>
                    @if (r.vertical === 'adiestramiento') {
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Nivel Doogking (opcional)' | t }}</label>
                        <select class="rs-inp" [(ngModel)]="nivelDoogking" [ngModelOptions]="{standalone: true}">
                          <option [ngValue]="null">{{ '— No actualizar —' | t }}</option>
                          <option [ngValue]="1">{{ '1 · Cachorro' | t }}</option>
                          <option [ngValue]="2">{{ '2 · Básico' | t }}</option>
                          <option [ngValue]="3">{{ '3 · Intermedio' | t }}</option>
                          <option [ngValue]="4">{{ '4 · Avanzado' | t }}</option>
                          <option [ngValue]="5">{{ '5 · Excelente sociabilidad' | t }}</option>
                        </select>
                        <span class="rs-field-hint">{{ 'Se guarda en la ficha del perro y lo verá cualquier profesional de Doogking.' | t }}</span>
                      </div>
                    }
                    <div class="ajuste-panel__actions">
                      <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarValorar()">{{ 'Cancelar' | t }}</button>
                      <button class="rs-btn rs-btn--primary rs-btn--sm"
                              [disabled]="enviandoValoracion()"
                              (click)="enviarValoracion(r)">
                        {{ enviandoValoracion() ? 'Enviando…' : 'Publicar valoración' }}
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (ajusteAbiertoId() === r._id) {
                <div class="reserva-card__panel">
                  <div class="ajuste-panel">
                    <p class="ajuste-panel__hint">
                      {{ 'Selecciona los suplementos detectados en recepción. El cliente recibirá una notificación y deberá aprobarlos antes de que se cobre nada.' | t }}
                    </p>

                    @if (suplementosCatalogo().length === 0) {
                      <p class="ajuste-panel__empty">
                        {{ 'No tienes suplementos preconfigurados.' | t }}
                        <a routerLink="/comercio/suplementos">{{ 'Créalos aquí' | t }}</a> {{ 'para poder seleccionarlos con un click.' | t }}
                      </p>
                    } @else {
                      <div class="ajuste-panel__checks">
                        @for (s of suplementosCatalogo(); track s._id) {
                          <label class="filter-check">
                            <input type="checkbox" [checked]="seleccionados().has(s._id)"
                                   (change)="toggleSuplemento(s._id)" />
                            {{ s.concepto }} (+{{ s.monto | euros:'1.2-2' }})
                          </label>
                        }
                      </div>
                    }

                    <div class="ajuste-panel__evidencia">
                      <label class="rs-lbl">{{ 'Foto del estado del animal al llegar (opcional pero recomendado)' | t }}</label>
                      <rs-image-upload origen="reserva/evidencia" [(ngModel)]="evidenciaUrl"></rs-image-upload>
                    </div>

                    <!-- Plan personalizado / bono de sesiones tras la valoración (Ref. ADI4) -->
                    @if (r.vertical === 'adiestramiento' && r.estado === 'confirmada') {
                      <div class="ajuste-panel__evidencia">
                        <h3 class="section-title" style="font-size:var(--f-sm)">{{ 'Proponer plan personalizado o bono de sesiones' | t }}</h3>
                        <p class="ajuste-panel__hint">
                          {{ 'Se envía como el resto de ajustes: el cliente lo aprueba y paga desde la plataforma, o lo rechaza sin cargo.' | t }}
                        </p>
                        <div class="row-card__grid row-card__grid--3">
                          <div class="rs-field">
                            <label class="rs-lbl">{{ 'Nombre del plan' | t }}</label>
                            <input class="rs-inp" [(ngModel)]="planNombre" [ngModelOptions]="{standalone: true}"
                                   [placeholder]="'Ej. Bono modificación de conducta' | t">
                          </div>
                          <div class="rs-field">
                            <label class="rs-lbl">{{ 'Nº de sesiones' | t }}</label>
                            <input class="rs-inp" type="number" min="1" [(ngModel)]="planSesiones" [ngModelOptions]="{standalone: true}" inputmode="numeric">
                          </div>
                          <div class="rs-field">
                            <label class="rs-lbl">{{ 'Precio total (€)' | t }}</label>
                            <input class="rs-inp" type="number" min="0" step="0.01" [(ngModel)]="planPrecio" [ngModelOptions]="{standalone: true}" inputmode="decimal">
                          </div>
                        </div>
                      </div>
                    }

                    @if (totalSuplementoSeleccionado() > 0) {
                      <p class="ajuste-panel__total">Suplemento total: +{{ totalSuplementoSeleccionado() | euros:'1.2-2' }}</p>
                    }

                    <div class="ajuste-panel__actions">
                      <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarAjuste()">{{ 'Cancelar' | t }}</button>
                      <button class="rs-btn rs-btn--primary rs-btn--sm"
                              [disabled]="enviandoAjuste() || !puedeEnviarAjuste()"
                              (click)="enviarAjuste(r)">
                        {{ enviandoAjuste() ? 'Enviando…' : 'Enviar solicitud al cliente' }}
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
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

    /* Resumen del día: lo primero que mira el profesional al entrar */
    .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: var(--sp-4); }
    .resumen__tile {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5); text-align: left;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.activa { border-color: var(--c-accent); background: var(--c-accent-lo); }
    }
    .resumen__tile--estatica { cursor: default; &:hover { border-color: var(--b-1); } }
    .resumen__icon {
      width: 38px; height: 38px; border-radius: var(--r-lg); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-lo); color: var(--c-accent);
    }
    .resumen__icon--warning { background: rgba(251,174,23,.14); color: #B45309; }
    .resumen__icon--accent { background: var(--c-raised); color: var(--t-300); }
    .resumen__dato { display: flex; flex-direction: column; min-width: 0;
      strong { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
      span { font-size: var(--f-xs); color: var(--t-400); }
    }

    .controles { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
    .buscador {
      display: flex; align-items: center; gap: var(--sp-2);
      flex: 1; min-width: 260px;
      padding: 0 var(--sp-3); height: 40px;
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-400);
      &:focus-within { border-color: var(--c-accent); }
    }
    .buscador__input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: var(--f-sm); color: var(--t-100); min-width: 0;
    }
    .control-select, .control-fecha { height: 40px; }
    .control-fecha { max-width: 160px; }

    .vista-toggle {
      display: inline-flex; padding: 3px; gap: 2px;
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .vista-toggle__btn {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer;
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
      transition: all var(--d-2);
      &.activa { background: var(--c-card); color: var(--c-accent); box-shadow: var(--shadow-sm, 0 1px 3px rgba(8,37,139,.10)); }
    }

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
      padding: var(--sp-16) var(--sp-8); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); max-width: 46ch; line-height: 1.6; }
    }

    /* Tarjetas de reserva */
    .reservas-lista { display: flex; flex-direction: column; gap: var(--sp-3); }
    .reserva-card {
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      padding: var(--sp-4) var(--sp-5);
      transition: border-color var(--d-2);
      &:hover { border-color: var(--b-2); }
    }
    .reserva-card__main { display: flex; align-items: flex-start; gap: var(--sp-4); flex-wrap: wrap; }
    .reserva-card__icono {
      width: 38px; height: 38px; border-radius: var(--r-lg); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-lo); color: var(--c-accent);
    }
    .reserva-card__info { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
    .reserva-card__titulo { font-size: var(--f-base); color: var(--t-100);
      strong { font-weight: var(--w-7); }
    }
    .reserva-card__cliente { color: var(--t-300); font-weight: var(--w-5); }
    .reserva-card__servicio { font-size: var(--f-sm); color: var(--t-300); }
    .reserva-card__fecha {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400);
    }
    .reserva-card__meta {
      display: flex; flex-direction: column; align-items: flex-end; gap: var(--sp-1);
      margin-left: auto;
    }
    .reserva-card__importe { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); }
    .reserva-card__codigo {
      font-family: monospace; font-size: var(--f-xs);
      color: var(--c-accent); background: var(--c-accent-lo);
      padding: 2px var(--sp-2); border-radius: var(--r-sm);
    }
    .reserva-card__acciones { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .reserva-card__panel { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--b-1); }
    .reserva-card__panel--acciones { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }

    .detalle {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-3);
      dt { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
      dd { font-size: var(--f-sm); color: var(--t-100); }
    }
    .detalle__suplementos { margin-top: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .detalle__adiestramiento { margin-top: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); display: flex; flex-direction: column; gap: var(--sp-1); }
    .detalle__adiestramiento .videos-lista { list-style: none; padding: 0; display: flex; gap: var(--sp-3); a { color: var(--c-accent); } }

    /* Calendario mensual */
    .calendario { padding: var(--sp-5); }
    .calendario__head { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-bottom: var(--sp-4); }
    .calendario__mes { font-size: var(--f-base); color: var(--t-100); text-transform: capitalize; min-width: 150px; text-align: center; }
    .calendario__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .calendario__dow {
      text-align: center; font-size: var(--f-xs); color: var(--t-400);
      text-transform: uppercase; letter-spacing: .05em; padding-bottom: var(--sp-2);
    }
    .calendario__dia {
      position: relative; aspect-ratio: 1 / 1;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      background: var(--c-raised); border: 1px solid transparent; border-radius: var(--r-md);
      cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.fuera { opacity: .35; }
      &.hoy { border-color: var(--b-2); font-weight: var(--w-7); }
      &.seleccionado { background: var(--c-accent-lo); border-color: var(--c-accent); }
    }
    .calendario__num { font-size: var(--f-sm); color: var(--t-200); }
    .calendario__marca {
      min-width: 18px; padding: 0 4px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff;
      font-size: 10px; font-weight: var(--w-7); line-height: 16px;
    }
    .calendario__pie {
      margin-top: var(--sp-4); font-size: var(--f-sm); color: var(--t-400);
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
    }

    .ajuste-panel { display: flex; flex-direction: column; gap: var(--sp-3); }
    .ajuste-panel__hint { font-size: var(--f-sm); color: var(--t-400); }
    .ajuste-panel__empty { font-size: var(--f-sm); color: var(--t-400); a { color: var(--c-accent); } }
    .ajuste-panel__checks { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ajuste-panel__evidencia { max-width: 320px; }
    .ajuste-panel__total { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .ajuste-panel__actions { display: flex; gap: var(--sp-2); }
    .filter-check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); }

    .importar-historial { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-3); border-top: 1px solid var(--b-1); }
    .importar-tabla { width: 100%; border-collapse: collapse; font-size: var(--f-xs); }
    .importar-tabla th, .importar-tabla td { text-align: left; padding: var(--sp-1) var(--sp-2); border-bottom: 1px solid var(--b-1); }

    .resumen-perro { display: flex; flex-wrap: wrap; gap: var(--sp-1); margin-top: var(--sp-2); }
    .resumen-perro__chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--f-xs); padding: 2px var(--sp-2); border-radius: var(--r-full);
      background: rgba(245,158,11,.12); color: #B45309;
    }

    .resena-form__estrellas { display: flex; gap: var(--sp-1); margin-bottom: var(--sp-3); }
    .estrella-btn {
      background: none; border: none; cursor: pointer; font-size: 1.5rem; color: var(--b-2); line-height: 1;
      &.activa { color: var(--c-amber); }
    }

    @media (max-width: 768px) {
      .reserva-card__meta { align-items: flex-start; margin-left: 0; flex-direction: row; flex-wrap: wrap; align-items: center; }
    }
  `],
})
export class ComercioReservasComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly perrosService = inject(PerrosService);
  private readonly ruta = inject(ActivatedRoute);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly reservas = signal<MiReserva[]>([]);
  readonly filtroActivo = signal<FiltroEstado>('todas');
  readonly completandoId = signal<string | null>(null);
  readonly seguimientoId = signal<string | null>(null);

  /** Buscador, filtros y visualización (TCK-8018). */
  readonly busqueda = signal('');
  readonly periodo = signal<Periodo>('todas');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly servicioFiltro = signal('');
  readonly vista = signal<'lista' | 'calendario'>('lista');
  readonly mes = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly diaSeleccionado = signal<string | null>(null);
  readonly detalleAbiertoId = signal<string | null>(null);
  readonly gestionAbiertaId = signal<string | null>(null);

  /** Alta de incidencias desde el propio comercio (TCK-8040 §2). */
  readonly incidenciaAbiertaId = signal<string | null>(null);
  readonly incidenciaTipo = signal('incidencia');
  readonly incidenciaAsunto = signal('');
  readonly incidenciaDescripcion = signal('');
  readonly enviandoIncidencia = signal(false);

  // Solicitar ajuste de precio (docs/mejora_servicios.md §7)
  readonly suplementosCatalogo = signal<SuplementoConfig[]>([]);
  readonly ajusteAbiertoId = signal<string | null>(null);
  readonly seleccionados = signal<Set<string>>(new Set());
  readonly enviandoAjuste = signal(false);
  evidenciaUrl = '';

  // Plan personalizado / bono de sesiones tras la valoración (Ref. ADI4) — reutiliza el
  // ciclo de ajuste ya probado (notificación, aprobación, cobro, comisión), con un
  // concepto/monto compuesto libremente en vez de elegido del catálogo de suplementos.
  planNombre = '';
  planSesiones: number | null = null;
  planPrecio: number | null = null;

  readonly totalSuplementoSeleccionado = computed(() =>
    this.suplementosCatalogo()
      .filter((s) => this.seleccionados().has(s._id))
      .reduce((acc, s) => acc + s.monto, 0),
  );

  // Reputación bidireccional: el comercio valora al perro tras completar el servicio.
  readonly valorarAbiertoId = signal<string | null>(null);
  readonly valoradoId = signal<Set<string>>(new Set());
  readonly puntuacionValoracion = signal(5);
  readonly enviandoValoracion = signal(false);
  comentarioValoracion = '';
  nivelDoogking: number | null = null;

  readonly historiaAbiertaId = signal<string | null>(null);
  readonly historiaVeterinaria = signal<HistoriaCompartidaApi | null>(null);
  readonly cargandoHistoria = signal(false);
  readonly errorHistoria = signal<string | null>(null);

  // Cargar historial clínico desde Excel/documento (Ref. VET5).
  readonly textoImportar = signal('');
  readonly filasImportar = signal<FilaHistorialApi[]>([]);
  readonly previsualizando = signal(false);
  readonly importandoHistorial = signal(false);
  readonly mensajeImportacion = signal<string | null>(null);

  // Seguimiento estructurado del progreso en adiestramiento (Ref. ADI5).
  readonly seguimientoAbiertoId = signal<string | null>(null);
  readonly seguimientoObjetivos = signal('');
  readonly seguimientoEvolucion = signal('');
  readonly seguimientoTareas = signal('');
  readonly guardandoSeguimiento = signal(false);
  readonly mensajeSeguimiento = signal<string | null>(null);

  readonly filtros = FILTROS;
  readonly periodos = PERIODOS;
  readonly diasSemana = DIAS_SEMANA;

  /** Servicios distintos que aparecen en las reservas, para el desplegable. */
  readonly servicios = computed(() =>
    [...new Set(this.reservas().map((r) => r.servicioTitulo).filter((t): t is string => !!t))].sort(),
  );

  readonly reservasDeHoy = computed(() => {
    const hoy = aDia(new Date()).getTime();
    return this.reservas().filter((r) => this.cubreElDia(r, hoy));
  });

  readonly proximas = computed(() => {
    const hoy = aDia(new Date()).getTime();
    const limite = hoy + 7 * 86400000;
    return this.reservas().filter((r) => {
      const inicio = aDia(r.fechaInicio).getTime();
      return inicio > hoy && inicio <= limite && r.estado !== 'cancelada';
    });
  });

  readonly reservasFiltradas = computed(() => {
    const estado = this.filtroActivo();
    const texto = this.busqueda().trim().toLowerCase();
    const servicio = this.servicioFiltro();
    const rango = this.rangoPeriodo();
    const dia = this.diaSeleccionado();

    return this.reservas().filter((r) => {
      if (estado !== 'todas' && r.estado !== estado) return false;
      if (servicio && r.servicioTitulo !== servicio) return false;
      if (texto) {
        const campos = [r.clienteNombre, r.perroNombre, r.codigo, r.servicioTitulo]
          .filter(Boolean).join(' ').toLowerCase();
        if (!campos.includes(texto)) return false;
      }
      if (rango && !this.solapaRango(r, rango)) return false;
      if (dia && !this.cubreElDia(r, desdeClaveDia(dia))) return false;
      return true;
    });
  });

  /** Celdas del mes visible con las reservas que caen en cada día. */
  readonly celdasCalendario = computed(() => {
    const primero = this.mes();
    const inicioSemana = new Date(primero);
    // La rejilla arranca en lunes: getDay() da 0 para domingo.
    const desplazamiento = (primero.getDay() + 6) % 7;
    inicioSemana.setDate(primero.getDate() - desplazamiento);

    const hoy = aDia(new Date()).getTime();
    const filtradas = this.reservasFiltradas();

    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate() + i);
      const tiempo = fecha.getTime();
      return {
        clave: claveDia(fecha),
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === primero.getMonth(),
        esHoy: tiempo === hoy,
        reservas: filtradas.filter((r) => this.cubreElDia(r, tiempo)),
      };
    });
  });

  async ngOnInit(): Promise<void> {
    // La agenda enlaza aquí con el código de la reserva que el comercio acaba de
    // pinchar en el calendario; sin esto aterrizaría en la lista entera.
    const buscado = this.ruta.snapshot.queryParamMap.get('buscar');
    if (buscado) this.busqueda.set(buscado);

    try {
      const [reservas, suplementos] = await Promise.all([
        firstValueFrom(this.comercioApi.getMisReservas()),
        firstValueFrom(this.comercioApi.getMisSuplementos()).catch(() => []),
      ]);
      this.reservas.set(reservas);
      this.suplementosCatalogo.set(suplementos.filter((s) => s.activo));
    } catch {
      this.errorMsg.set('Error al cargar las reservas. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Filtros y vista ─────────────────────────────────────────────────────────

  /** Una estancia ocupa todos sus días, no sólo el de entrada. */
  private cubreElDia(r: MiReserva, dia: number): boolean {
    const inicio = aDia(r.fechaInicio).getTime();
    const fin = r.fechaFin ? aDia(r.fechaFin).getTime() : inicio;
    return dia >= inicio && dia <= fin;
  }

  private solapaRango(r: MiReserva, rango: { desde: number; hasta: number }): boolean {
    const inicio = aDia(r.fechaInicio).getTime();
    const fin = r.fechaFin ? aDia(r.fechaFin).getTime() : inicio;
    return fin >= rango.desde && inicio <= rango.hasta;
  }

  private rangoPeriodo(): { desde: number; hasta: number } | null {
    const hoy = aDia(new Date());
    switch (this.periodo()) {
      case 'hoy':
        return { desde: hoy.getTime(), hasta: hoy.getTime() };
      case 'semana': {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        return { desde: lunes.getTime(), hasta: domingo.getTime() };
      }
      case 'mes': {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        return { desde: primero.getTime(), hasta: ultimo.getTime() };
      }
      case 'rango': {
        if (!this.desde() && !this.hasta()) return null;
        const desde = this.desde() ? aDia(this.desde()).getTime() : -Infinity;
        const hasta = this.hasta() ? aDia(this.hasta()).getTime() : Infinity;
        return { desde, hasta };
      }
      default:
        return null;
    }
  }

  verHoy(): void {
    this.periodo.set(this.periodo() === 'hoy' ? 'todas' : 'hoy');
    this.diaSeleccionado.set(null);
  }

  verPendientes(): void {
    this.filtroActivo.set(this.filtroActivo() === 'pendiente' ? 'todas' : 'pendiente');
  }

  limpiarFiltros(): void {
    this.filtroActivo.set('todas');
    this.busqueda.set('');
    this.periodo.set('todas');
    this.desde.set('');
    this.hasta.set('');
    this.servicioFiltro.set('');
    this.diaSeleccionado.set(null);
  }

  cambiarMes(delta: number): void {
    const actual = this.mes();
    this.mes.set(new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  seleccionarDia(clave: string): void {
    this.diaSeleccionado.set(this.diaSeleccionado() === clave ? null : clave);
  }

  toggleDetalle(id: string): void {
    this.detalleAbiertoId.set(this.detalleAbiertoId() === id ? null : id);
  }

  toggleIncidencia(id: string): void {
    this.incidenciaAbiertaId.set(this.incidenciaAbiertaId() === id ? null : id);
    this.incidenciaTipo.set('incidencia');
    this.incidenciaAsunto.set('');
    this.incidenciaDescripcion.set('');
  }

  cerrarIncidencia(): void {
    this.incidenciaAbiertaId.set(null);
  }

  /** El backend exige una descripción con algo de fondo: se avisa antes. */
  puedeEnviarIncidencia(): boolean {
    return this.incidenciaAsunto().trim().length >= 3 && this.incidenciaDescripcion().trim().length >= 10;
  }

  async enviarIncidencia(r: MiReserva): Promise<void> {
    if (!this.puedeEnviarIncidencia()) return;
    this.enviandoIncidencia.set(true);
    try {
      await firstValueFrom(this.comercioApi.abrirIncidencia({
        reservaId: r._id,
        tipo: this.incidenciaTipo(),
        asunto: this.incidenciaAsunto().trim(),
        descripcion: this.incidenciaDescripcion().trim(),
      }));
      this.cerrarIncidencia();
      this.errorMsg.set('');
    } catch {
      this.errorMsg.set('No se pudo abrir la incidencia. Inténtalo de nuevo.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.enviandoIncidencia.set(false);
    }
  }

  toggleGestion(id: string): void {
    this.gestionAbiertaId.set(this.gestionAbiertaId() === id ? null : id);
  }

  /** Si no hay ninguna acción posible, el botón "Gestionar" no se pinta. */
  tieneGestion(r: MiReserva): boolean {
    if (r.estado === 'confirmada' || r.estado === 'en_curso') return true;
    if (r.estado === 'completada' && r.perroId) return true;
    return r.vertical === 'veterinaria' && !!r.perroId;
  }

  esEstancia(vertical: string): boolean {
    return VERTICALES_ESTANCIA.has(vertical);
  }

  /**
   * Resumen automático del perfil del perro para el negocio (Ref. N5): lo más relevante de la
   * Ficha del Perro (alergias, miedos, requisitos), sin que el negocio tenga que buscarlo.
   */
  resumenPerro(r: MiReserva): string[] {
    const s = r.perroSnapshot;
    if (!s) return [];
    const chips: string[] = [];
    const alergias = s['alergias'] as string[] | undefined;
    const miedos = s['miedos'] as string[] | undefined;
    const medicacion = s['medicacion'] as string[] | undefined;
    if (alergias?.length) chips.push(`Alergias: ${alergias.join(', ')}`);
    if (miedos?.length) chips.push(`Miedos: ${miedos.join(', ')}`);
    if (medicacion?.length) chips.push(`Medicación: ${medicacion.join(', ')}`);
    if (s['ansiedadSeparacion']) chips.push('Ansiedad por separación');
    if (s['protectorRecursos']) chips.push('Protector de recursos');
    if (s['reactividadCorrea']) chips.push('Reactivo con correa');
    if (s['destructivoEnSoledad']) chips.push('Destructivo en soledad');
    if (s['orinaEnInterior']) chips.push('Puede orinar en interior');
    if (s['seMarea']) chips.push('Se marea en viajes');
    if (s['requiereTransportin']) chips.push('Requiere transportín');
    return chips;
  }

  /** URLs de vídeo del comportamiento subidos al reservar (Ref. ADI3). */
  videosDe(r: MiReserva): string[] {
    const v = r.detalle?.['videosUrl'];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  toggleSeguimientoAdiestramiento(reservaId: string): void {
    if (this.seguimientoAbiertoId() === reservaId) {
      this.seguimientoAbiertoId.set(null);
      return;
    }
    this.seguimientoAbiertoId.set(reservaId);
    this.seguimientoObjetivos.set('');
    this.seguimientoEvolucion.set('');
    this.seguimientoTareas.set('');
    this.mensajeSeguimiento.set(null);
  }

  puedeGuardarSeguimiento(): boolean {
    return !!(this.seguimientoObjetivos().trim() || this.seguimientoEvolucion().trim() || this.seguimientoTareas().trim());
  }

  /**
   * Guarda el seguimiento estructurado de la sesión (Ref. ADI5) en el historial del perro,
   * con `datosEstructurados` en vez del texto libre genérico.
   */
  async guardarSeguimientoAdiestramiento(r: MiReserva): Promise<void> {
    if (!r.perroId || !this.puedeGuardarSeguimiento()) return;
    const objetivos = this.seguimientoObjetivos().trim();
    const evolucion = this.seguimientoEvolucion().trim();
    const tareas = this.seguimientoTareas().trim();

    this.guardandoSeguimiento.set(true);
    this.mensajeSeguimiento.set(null);
    try {
      await this.perrosService.agregarHistorial(r.perroId, {
        vertical: 'adiestramiento',
        reservaId: r._id,
        nota: [objetivos, evolucion, tareas].filter(Boolean).join(' · ') || 'Seguimiento de sesión',
        datosEstructurados: {
          objetivos: objetivos || undefined,
          evolucion: evolucion || undefined,
          tareasCasa: tareas || undefined,
        },
      });
      this.mensajeSeguimiento.set('Seguimiento guardado en el historial del perro.');
    } catch {
      this.mensajeSeguimiento.set('No se pudo guardar el seguimiento.');
    } finally {
      this.guardandoSeguimiento.set(false);
    }
  }

  // ── Acciones sobre la reserva ───────────────────────────────────────────────

  toggleAjuste(reservaId: string): void {
    const yaAbierto = this.ajusteAbiertoId() === reservaId;
    this.ajusteAbiertoId.set(yaAbierto ? null : reservaId);
    this.seleccionados.set(new Set());
    this.evidenciaUrl = '';
  }

  cerrarAjuste(): void {
    this.ajusteAbiertoId.set(null);
    this.seleccionados.set(new Set());
    this.evidenciaUrl = '';
    this.planNombre = '';
    this.planSesiones = null;
    this.planPrecio = null;
  }

  /** El plan personalizado (Ref. ADI4) es válido si tiene nombre y un precio positivo. */
  planValido(): boolean {
    return !!this.planNombre.trim() && !!this.planPrecio && this.planPrecio > 0;
  }

  puedeEnviarAjuste(): boolean {
    return this.seleccionados().size > 0 || this.planValido();
  }

  toggleSuplemento(id: string): void {
    this.seleccionados.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  async enviarAjuste(r: MiReserva): Promise<void> {
    const suplementos = this.suplementosCatalogo()
      .filter((s) => this.seleccionados().has(s._id))
      .map((s) => ({ concepto: s.concepto, monto: s.monto }));

    if (this.planValido()) {
      const sesiones = this.planSesiones ? `${this.planSesiones} sesiones` : 'programa';
      suplementos.push({
        concepto: `Plan personalizado: ${this.planNombre.trim()} (${sesiones})`,
        monto: this.planPrecio!,
      });
    }

    if (!suplementos.length) return;

    this.enviandoAjuste.set(true);
    try {
      const actualizado = await firstValueFrom(
        this.comercioApi.solicitarAjuste(r._id, { suplementos, evidenciaUrl: this.evidenciaUrl || undefined }),
      );
      this.reservas.update((lista) => lista.map((x) => (x._id === r._id ? { ...x, ...actualizado } : x)));
      this.cerrarAjuste();
    } catch {
      this.errorMsg.set('No se pudo enviar la solicitud de ajuste. Inténtalo de nuevo.');
    } finally {
      this.enviandoAjuste.set(false);
    }
  }

  toggleValorar(reservaId: string): void {
    const yaAbierto = this.valorarAbiertoId() === reservaId;
    this.valorarAbiertoId.set(yaAbierto ? null : reservaId);
    this.puntuacionValoracion.set(5);
    this.comentarioValoracion = '';
    this.nivelDoogking = null;
  }

  cerrarValorar(): void {
    this.valorarAbiertoId.set(null);
  }

  async toggleHistoriaVeterinaria(r: MiReserva): Promise<void> {
    if (this.historiaAbiertaId() === r._id) {
      this.historiaAbiertaId.set(null);
      return;
    }
    if (!r.perroId) return;

    this.historiaAbiertaId.set(r._id);
    this.historiaVeterinaria.set(null);
    this.errorHistoria.set(null);
    this.cargandoHistoria.set(true);
    this.textoImportar.set('');
    this.filasImportar.set([]);
    this.mensajeImportacion.set(null);
    try {
      const historia = await this.perrosService.historiaVeterinaria(r.perroId);
      this.historiaVeterinaria.set(historia);
    } catch {
      this.errorHistoria.set('No se pudo cargar el historial (el propietario podría no haber autorizado compartirlo).');
    } finally {
      this.cargandoHistoria.set(false);
    }
  }

  async previsualizarImportacion(): Promise<void> {
    const id = this.historiaAbiertaId();
    const texto = this.textoImportar().trim();
    if (!id || !texto) return;
    this.previsualizando.set(true);
    this.mensajeImportacion.set(null);
    try {
      const filas = await this.perrosService.previsualizarImportacion(id, texto);
      this.filasImportar.set(filas);
      if (!filas.length) {
        this.mensajeImportacion.set('No se reconoció ninguna fila. Revisa el formato (una fila por línea).');
      }
    } catch {
      this.mensajeImportacion.set('No se pudo analizar el texto pegado.');
    } finally {
      this.previsualizando.set(false);
    }
  }

  quitarFilaImportar(indice: number): void {
    this.filasImportar.update((filas) => filas.filter((_, i) => i !== indice));
  }

  async importarHistorial(r: MiReserva): Promise<void> {
    const id = this.historiaAbiertaId();
    const filas = this.filasImportar();
    if (!id || !filas.length) return;
    this.importandoHistorial.set(true);
    this.mensajeImportacion.set(null);
    try {
      const resultado = await this.perrosService.importarHistorial(id, r.vertical, filas);
      this.mensajeImportacion.set(`${resultado.importadas} fila(s) guardadas en el historial.`);
      this.textoImportar.set('');
      this.filasImportar.set([]);
    } catch {
      this.mensajeImportacion.set('No se pudo guardar el historial importado.');
    } finally {
      this.importandoHistorial.set(false);
    }
  }

  async enviarValoracion(r: MiReserva): Promise<void> {
    if (!r.perroId) return;

    this.enviandoValoracion.set(true);
    this.errorMsg.set('');
    try {
      await this.perrosService.crearValoracion(r.perroId, {
        reservaId: r._id,
        puntuacion: this.puntuacionValoracion(),
        comentario: this.comentarioValoracion || undefined,
        atributos: this.nivelDoogking !== null ? { nivelDoogking: this.nivelDoogking } : undefined,
      });
      this.valoradoId.update((set) => new Set(set).add(r._id));
      this.cerrarValorar();
    } catch {
      this.errorMsg.set('No se pudo publicar la valoración. Inténtalo de nuevo.');
    } finally {
      this.enviandoValoracion.set(false);
    }
  }

  iconVertical(v: string): string { return iconoVertical(v); }
  badgeEstado(e: string): string { return ESTADO_BADGE[e] ?? 'rs-badge--neutral'; }
  etiquetaEstado(e: string): string { return ESTADO_LABEL[e] ?? e; }
  iconoEstado(e: string): string { return ESTADO_ICONO[e] ?? 'circle'; }

  contarEstado(filtro: FiltroEstado): number {
    if (filtro === 'todas') return this.reservas().length;
    return this.reservas().filter(r => r.estado === filtro).length;
  }

  async completar(r: MiReserva): Promise<void> {
    this.completandoId.set(r._id);
    try {
      await firstValueFrom(this.comercioApi.completarReserva(r._id));
      this.reservas.update((lista) =>
        lista.map((x) => (x._id === r._id ? { ...x, estado: 'completada' } : x)),
      );
    } catch {
      this.errorMsg.set('No se pudo marcar la reserva como completada. Inténtalo de nuevo.');
    } finally {
      this.completandoId.set(null);
    }
  }

  /** Hitos de seguimiento en tiempo real según el tipo de servicio. */
  hitosDe(vertical: string): Hito[] {
    if (vertical === 'transporte') {
      return [
        { hito: 'recogida', icono: 'paw', label: 'Recogida' },
        { hito: 'en_ruta', icono: 'truck', label: 'En ruta' },
        { hito: 'entregada', icono: 'map-pin', label: 'Entregada' },
        { hito: 'finalizada', icono: 'check-circle', label: 'Finalizar' },
      ];
    }
    if (vertical === 'alojamiento' || vertical === 'hoteles') {
      return [
        { hito: 'entrada', icono: 'hotel', label: 'Ingreso' },
        { hito: 'salida', icono: 'paw', label: 'Salida' },
        { hito: 'finalizada', icono: 'check-circle', label: 'Finalizar' },
      ];
    }
    /*
     * Servicios funerarios: la secuencia completa del brief. No es obligatorio
     * marcarlos todos —un servicio sin recogida, o sin devolución de cenizas,
     * se salta los suyos—; se marcan los que aplican y el cliente los ve en
     * "Mis reservas" según van ocurriendo.
     */
    if (vertical === VerticalKey.FUNERARIOS) {
      return [
        { hito: HitoFunerario.RECOGIDA_PROGRAMADA, icono: 'calendar', label: 'Recogida programada' },
        { hito: HitoFunerario.RECOGIDO, icono: 'truck', label: 'Recogido' },
        { hito: HitoFunerario.EN_PROCESO, icono: 'clock', label: 'En proceso' },
        { hito: HitoFunerario.CENIZAS_PREPARADAS, icono: 'gift', label: 'Cenizas preparadas' },
        { hito: HitoFunerario.ENTREGA_PROGRAMADA, icono: 'calendar', label: 'Entrega programada' },
        { hito: HitoFunerario.ENTREGADO, icono: 'map-pin', label: 'Entregado' },
        { hito: HitoFunerario.FINALIZADA, icono: 'check-circle', label: 'Finalizar' },
      ];
    }
    return [];
  }

  async marcarHito(r: MiReserva, hito: string): Promise<void> {
    this.seguimientoId.set(r._id);
    try {
      const actualizada = await firstValueFrom(this.comercioApi.marcarSeguimiento(r._id, hito));
      this.reservas.update((lista) =>
        lista.map((x) => (x._id === r._id ? { ...x, estado: actualizada.estado } : x)),
      );
    } catch {
      this.errorMsg.set('No se pudo registrar el hito de seguimiento.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.seguimientoId.set(null);
    }
  }
}
