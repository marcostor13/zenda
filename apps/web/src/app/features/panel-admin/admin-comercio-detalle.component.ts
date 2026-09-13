import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ComisionAplicadaDto, DetalleComercioDto, MesDeComercioDto, ServicioDeComercioDto,
  VERTICAL_LABELS, VerticalKey,
} from 'shared';

import { AdminApiService, ReservaAdmin } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsStarsComponent } from '../../shared/components/stars/rs-stars.component';
import { EurosPipe, euros } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { mensajeDeError } from '../../shared/mensaje-error';
import { iconoVertical } from '../panel-comercio/vertical-icon';
import { FILTROS_ESTADO_RESERVA, metaEstadoReserva } from '../../shared/catalogos/estados-reserva.catalogo';
import { describirPolitica } from '../../shared/catalogos/politicas-cancelacion.catalogo';
import { FechaPipe } from '../../shared/pipes/fecha.pipe';

/** Pestañas de la ficha. El contador va al lado del rótulo. */
type Pestana = 'resumen' | 'servicios' | 'reservas' | 'equipo' | 'resenas' | 'incidencias' | 'datos';

/** Métrica que pinta el gráfico de los doce meses. */
type MetricaMes = 'reservas' | 'gmv';

const RESERVAS_POR_PAGINA = 10;

@Component({
  selector: 'app-admin-comercio-detalle',
  standalone: true,
  imports: [TraducirPipe, FechaPipe, DecimalPipe, RouterLink, RsIconComponent, RsStarsComponent, EurosPipe],
  template: `
    <a class="volver" routerLink="/admin/comercios">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon> {{ 'Comercios' | t }}
    </a>

    @if (cargando()) {
      <div class="rs-card ficha-cab">
        <div class="skel skel--avatar"></div>
        <div style="flex:1">
          <div class="skel skel--lg"></div>
          <div class="skel skel--md" style="margin-top:var(--sp-3)"></div>
        </div>
      </div>
      <div class="kpis">
        @for (i of [1,2,3,4,5,6]; track i) {
          <div class="rs-card kpi"><div class="skel skel--sm"></div></div>
        }
      </div>
    } @else if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
      <div class="acciones-error">
        <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="cargar()">{{ 'Reintentar' | t }}</button>
        <a class="rs-btn rs-btn--ghost rs-btn--sm" routerLink="/admin/comercios">{{ 'Volver al listado' | t }}</a>
      </div>
    } @else if (detalle(); as d) {

      <!-- ══ Cabecera ══ -->
      <header class="rs-card ficha-cab">
        <div class="ficha-cab__identidad">
          <div class="ficha-cab__avatar">{{ inicial(d.comercio.nombreComercial) }}</div>
          <div class="ficha-cab__texto">
            <h1 class="ficha-cab__nombre">{{ d.comercio.nombreComercial }}</h1>
            <p class="ficha-cab__meta">
              {{ d.comercio.razonSocial || ('Sin razón social' | t) }}
              @if (d.comercio.vatNumber) { · <span class="mono">{{ d.comercio.vatNumber }}</span> }
              @if (d.comercio.createdAt) { · {{ 'alta {fecha}' | t: { fecha: (d.comercio.createdAt | date:'d MMM yyyy') ?? '' } }} }
            </p>
            <div class="ficha-cab__badges">
              <span class="rs-badge {{ badgeEstado(d.comercio.estado) }}">{{ etiquetaEstado(d.comercio.estado) | t }}</span>
              <span class="rs-badge rs-badge--accent">{{ 'Plan' | t }} {{ etiquetaPlan(d.comercio.plan) | t }}</span>
              <span class="rs-badge rs-badge--neutral">{{ etiquetaModo(d.comercio.modoLiquidacion) | t }}</span>
              @if (d.comercio.socioFundador) {
                <span class="rs-badge rs-badge--warning">
                  <rs-icon name="crown" [size]="11" [stroke]="2"></rs-icon> {{ 'Socio fundador' | t }}
                </span>
              }
              @if (d.comercio.alphaAdherido) {
                <span class="rs-badge rs-badge--warning">
                  <rs-icon name="sparkles" [size]="11" [stroke]="2"></rs-icon> {{ 'Alpha' | t }}
                </span>
              }
              @if (!d.comercio.altaCompletada) {
                <span class="rs-badge rs-badge--warning">{{ 'Alta sin terminar' | t }}</span>
              }
              @for (v of d.comercio.verticales; track v) {
                <span class="rs-badge rs-badge--neutral">
                  <rs-icon [name]="iconoDe(v)" [size]="11" [stroke]="2"></rs-icon> {{ etiquetaVertical(v) }}
                </span>
              }
            </div>
          </div>
        </div>

        <div class="ficha-cab__acciones">
          @if (d.comercio.estado === 'eliminado') {
            <button class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="accionando()" (click)="restaurar()">
              <rs-icon name="rotate-ccw" [size]="14" [stroke]="2"></rs-icon> {{ 'Restaurar' | t }}
            </button>
          } @else {
            @if (d.comercio.estado !== 'activo') {
              <button class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="accionando()" (click)="aprobar()">
                <rs-icon name="check" [size]="14" [stroke]="2.5"></rs-icon>
                {{ (d.comercio.estado === 'pendiente' ? 'Aprobar' : 'Reactivar') | t }}
              </button>
            }
            @if (d.comercio.estado !== 'suspendido') {
              <button class="rs-btn rs-btn--outline rs-btn--sm" [disabled]="accionando()" (click)="abrirSuspender()">
                <rs-icon name="alert-circle" [size]="14" [stroke]="2"></rs-icon>
                {{ (d.comercio.estado === 'pendiente' ? 'Rechazar' : 'Suspender') | t }}
              </button>
            }
            <button class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="accionando()" (click)="alternarAlpha()">
              <rs-icon name="sparkles" [size]="14" [stroke]="2"></rs-icon>
              {{ (d.comercio.alphaAdherido ? 'Salir de Alpha' : 'Adherir a Alpha') | t }}
            </button>
          }
        </div>
      </header>

      @if (avisoAccion()) {
        <div class="rs-alert rs-alert--success">{{ avisoAccion() }}</div>
      }
      @if (errorAccion()) {
        <div class="rs-alert rs-alert--error">{{ errorAccion() }}</div>
      }

      @if (d.comercio.baja; as baja) {
        <div class="rs-alert rs-alert--warning baja">
          <strong>{{ d.comercio.estado === 'eliminado' ? ('Dado de baja' | t) : ('Última baja registrada' | t) }}</strong>
          <span>{{ baja.motivo }}@if (baja.comentario) { — {{ baja.comentario }} }</span>
          <span class="baja__pie">
            {{ baja.fecha | date:'d MMM yyyy' }} · {{ 'origen' | t }}: {{ baja.origen }}
            @if (baja.reactivarEl) { · {{ 'vuelve el {fecha}' | t: { fecha: (baja.reactivarEl | date:'d MMM yyyy') ?? '' } }} }
          </span>
        </div>
      }

      <!-- ══ KPIs ══ -->
      <div class="kpis">
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.economia.gmv | euros:'1.0-0' }}</span>
          <span class="kpi__lbl">{{ 'GMV cobrado' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.economia.comision | euros:'1.0-0' }}</span>
          <span class="kpi__lbl">{{ 'Comisión Doogking' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.economia.liquidacion | euros:'1.0-0' }}</span>
          <span class="kpi__lbl">{{ 'Liquidado al comercio' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.economia.ticketMedio | euros:'1.0-0' }}</span>
          <span class="kpi__lbl">{{ 'Ticket medio' | t }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.reservas.total }}</span>
          <span class="kpi__lbl">{{ 'Reservas · {n} activas' | t: { n: d.metricas.reservas.activas } }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">{{ d.metricas.servicios.total }}</span>
          <span class="kpi__lbl">{{ 'Servicios · {n} publicados' | t: { n: d.metricas.servicios.publicados } }}</span>
        </div>
        <div class="rs-card kpi">
          <span class="kpi__num">
            {{ d.metricas.resenas.media ? (d.metricas.resenas.media | number:'1.1-1') : '—' }}
            <rs-icon name="star" [size]="14" [stroke]="2"></rs-icon>
          </span>
          <span class="kpi__lbl">{{ '{n} reseñas' | t: { n: d.metricas.resenas.total } }}</span>
        </div>
        <div class="rs-card kpi" [class.kpi--alerta]="d.metricas.incidencias.abiertas > 0">
          <span class="kpi__num">{{ d.metricas.incidencias.abiertas }}</span>
          <span class="kpi__lbl">{{ 'Incidencias abiertas · {n} en total' | t: { n: d.metricas.incidencias.total } }}</span>
        </div>
      </div>

      <!-- ══ Pestañas ══ -->
      <nav class="tabs" role="tablist">
        @for (p of pestanas; track p.clave) {
          <button class="tabs__btn" role="tab" [class.activa]="pestana() === p.clave"
                  [attr.aria-selected]="pestana() === p.clave" (click)="irA(p.clave)">
            <rs-icon [name]="p.icono" [size]="14" [stroke]="2"></rs-icon>
            <span>{{ p.label | t }}</span>
            @if (contador(p.clave) !== null) { <span class="tabs__num">{{ contador(p.clave) }}</span> }
          </button>
        }
      </nav>

      <!-- ══ Resumen ══ -->
      @if (pestana() === 'resumen') {
        <section class="rs-card bloque">
          <div class="bloque__head">
            <h2 class="bloque__titulo">{{ 'Últimos 12 meses' | t }}</h2>
            <div class="conmutador" role="group" [attr.aria-label]="'Métrica del gráfico' | t">
              <button class="conmutador__btn" [class.activa]="metricaMes() === 'reservas'"
                      (click)="metricaMes.set('reservas')">{{ 'Reservas' | t }}</button>
              <button class="conmutador__btn" [class.activa]="metricaMes() === 'gmv'"
                      (click)="metricaMes.set('gmv')">{{ 'Facturación' | t }}</button>
            </div>
          </div>
          @if (hayActividadMensual()) {
            <svg class="grafico" viewBox="0 0 600 160" preserveAspectRatio="none" role="img"
                 [attr.aria-label]="'Evolución mensual de ' + metricaMes()">
              @for (b of barrasMes(); track b.mes) {
                <rect class="grafico__barra" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.ancho" [attr.height]="b.alto">
                  <title>{{ b.mes }}: {{ b.etiqueta }}</title>
                </rect>
              }
            </svg>
            <div class="grafico__pie">
              @for (b of barrasMes(); track b.mes) { <span>{{ b.fecha | date:'MMM' }}</span> }
            </div>
          } @else {
            <p class="vacio">{{ 'Sin actividad en los últimos doce meses.' | t }}</p>
          }
        </section>

        <div class="dos-columnas">
          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Reservas por estado' | t }}</h2>
            @if (estadosOrdenados().length) {
              @for (e of estadosOrdenados(); track e.estado) {
                <div class="barra-fila">
                  <span class="barra-fila__lbl">
                    <span class="rs-badge {{ meta(e.estado).badge }}">{{ meta(e.estado).label | t }}</span>
                  </span>
                  <span class="barra-fila__pista"><span class="barra-fila__valor" [style.width.%]="e.porcentaje"></span></span>
                  <span class="barra-fila__num">{{ e.total }}</span>
                </div>
              }
            } @else {
              <p class="vacio">{{ 'Todavía no ha recibido reservas.' | t }}</p>
            }
          </section>

          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Desglose económico' | t }}</h2>
            <dl class="datos">
              <div><dt>{{ 'GMV cobrado' | t }}</dt><dd>{{ d.metricas.economia.gmv | euros:'1.2-2' }}</dd></div>
              <div><dt>{{ 'Comisión plataforma' | t }}</dt><dd>{{ d.metricas.economia.comision | euros:'1.2-2' }}</dd></div>
              <div><dt>{{ 'Coste de Stripe' | t }}</dt><dd>{{ d.metricas.economia.stripeFee | euros:'1.2-2' }}</dd></div>
              <div>
                <dt>{{ 'Margen neto Doogking' | t }}</dt>
                <dd class="destacado">{{ (d.metricas.economia.comision - d.metricas.economia.stripeFee) | euros:'1.2-2' }}</dd>
              </div>
              <div><dt>{{ 'Liquidado al comercio' | t }}</dt><dd>{{ d.metricas.economia.liquidacion | euros:'1.2-2' }}</dd></div>
              <div><dt>{{ 'Reembolsado' | t }}</dt><dd>{{ d.metricas.economia.reembolsado | euros:'1.2-2' }}</dd></div>
              <div><dt>{{ 'Pagos aprobados' | t }}</dt><dd>{{ d.metricas.economia.pagosAprobados }}</dd></div>
              <div><dt>{{ 'Reservas últimos 30 días' | t }}</dt><dd>{{ d.metricas.reservas.ultimos30Dias }}</dd></div>
              <div><dt>{{ 'Reservas por venir' | t }}</dt><dd>{{ d.metricas.reservas.proximas }}</dd></div>
            </dl>
          </section>
        </div>

        <section class="rs-card bloque">
          <h2 class="bloque__titulo">{{ 'Actividad por categoría' | t }}</h2>
          @if (d.metricas.porVertical.length) {
            <div class="tabla tabla--verticales">
              <div class="tabla__head">
                <span>{{ 'Categoría' | t }}</span><span>{{ 'Servicios' | t }}</span>
                <span>{{ 'Reservas' | t }}</span><span>{{ 'GMV' | t }}</span><span>{{ 'Comisión' | t }}</span>
              </div>
              @for (v of d.metricas.porVertical; track v.vertical) {
                <div class="tabla__fila">
                  <span class="tabla__principal">
                    <rs-icon [name]="iconoDe(v.vertical)" [size]="14" [stroke]="2"></rs-icon> {{ etiquetaVertical(v.vertical) }}
                  </span>
                  <span [attr.data-col]="'Servicios' | t">{{ v.servicios }}</span>
                  <span [attr.data-col]="'Reservas' | t">{{ v.reservas }}</span>
                  <span [attr.data-col]="'GMV' | t">{{ v.gmv | euros:'1.0-0' }}</span>
                  <span [attr.data-col]="'Comisión' | t">{{ v.comision | euros:'1.0-0' }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="vacio">{{ 'Sin catálogo ni reservas todavía.' | t }}</p>
          }
        </section>

        <section class="rs-card bloque">
          <h2 class="bloque__titulo">{{ 'Comisión vigente' | t }}</h2>
          @if (d.comisiones.length) {
            <ul class="comisiones">
              @for (c of d.comisiones; track c.vertical) {
                <li class="comisiones__item">
                  <span class="comisiones__vertical">
                    <rs-icon [name]="iconoDe(c.vertical)" [size]="14" [stroke]="2"></rs-icon> {{ etiquetaVertical(c.vertical) }}
                  </span>
                  <strong class="comisiones__pct">{{ c.comisionPct * 100 | number:'1.0-2' }}%</strong>
                  <span class="comisiones__origen">{{ origenComision(c) | t }}</span>
                  <span class="comisiones__stripe">
                    Stripe {{ c.stripePct * 100 | number:'1.0-2' }}% + {{ c.stripeFijoEur | euros:'1.2-2' }}
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="vacio">{{ 'El comercio no opera en ninguna categoría todavía.' | t }}</p>
          }
        </section>

        <section class="rs-card bloque">
          <div class="bloque__head">
            <h2 class="bloque__titulo">{{ 'Últimas reservas' | t }}</h2>
            <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="irA('reservas')">{{ 'Ver todas' | t }}</button>
          </div>
          @if (d.reservas.length) {
            <ul class="reservas-mini">
              @for (r of d.reservas; track r._id) {
                <li class="reservas-mini__item">
                  <code>{{ r.codigo }}</code>
                  <span class="reservas-mini__cliente">{{ r.cliente }}</span>
                  <span class="reservas-mini__fecha">{{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy' }}</span>
                  <span class="rs-badge {{ meta(r.estado).badge }}">{{ meta(r.estado).label | t }}</span>
                  <strong>{{ r.montoTotal | euros:'1.2-2' }}</strong>
                </li>
              }
            </ul>
          } @else {
            <p class="vacio">{{ 'Todavía no ha recibido reservas.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Servicios ══ -->
      @if (pestana() === 'servicios') {
        <section class="rs-card bloque">
          <div class="bloque__head">
            <h2 class="bloque__titulo">{{ 'Catálogo' | t }}</h2>
            <span class="bloque__pie">
              {{ '{publicados} publicados · {borradores} en borrador · {pausados} pausados · {destacados} destacados'
                 | t: { publicados: d.metricas.servicios.publicados, borradores: d.metricas.servicios.borradores,
                        pausados: d.metricas.servicios.pausados, destacados: d.metricas.servicios.destacados } }}
            </span>
          </div>

          @if (d.servicios.length) {
            <div class="servicios">
              @for (s of d.servicios; track s._id) {
                <article class="servicio">
                  <div class="servicio__foto">
                    @if (s.imagen) {
                      <img [src]="s.imagen" [alt]="s.titulo" loading="lazy" />
                    } @else {
                      <rs-icon [name]="iconoDe(s.vertical)" [size]="22" [stroke]="1.5"></rs-icon>
                    }
                  </div>
                  <div class="servicio__cuerpo">
                    <h3 class="servicio__titulo">{{ s.titulo }}</h3>
                    <p class="servicio__meta">
                      <rs-icon [name]="iconoDe(s.vertical)" [size]="12" [stroke]="2"></rs-icon>
                      {{ etiquetaVertical(s.vertical) }}
                      @if (s.ciudad) { · {{ s.ciudad }} }
                      · {{ s.precioBase | euros:'1.0-2' }}
                    </p>
                    <div class="servicio__badges">
                      <span class="rs-badge {{ badgeServicio(s.estado) }}">{{ etiquetaServicio(s.estado) | t }}</span>
                      @if (s.destacado) { <span class="rs-badge rs-badge--warning">{{ 'Destacado' | t }}</span> }
                      @if (s.totalResenas) {
                        <span class="rs-badge rs-badge--neutral">
                          <rs-icon name="star" [size]="11" [stroke]="2"></rs-icon>
                          {{ s.ratingPromedio | number:'1.1-1' }} ({{ s.totalResenas }})
                        </span>
                      }
                    </div>
                    <dl class="servicio__cifras">
                      <div><dt>{{ 'Reservas' | t }}</dt><dd>{{ s.reservas }}</dd></div>
                      <div><dt>{{ 'GMV' | t }}</dt><dd>{{ s.gmv | euros:'1.0-0' }}</dd></div>
                      <div>
                        <dt>{{ 'Última' | t }}</dt>
                        <dd>{{ s.ultimaReserva ? (s.ultimaReserva | date:'d MMM yy') : '—' }}</dd>
                      </div>
                    </dl>
                  </div>
                  <div class="servicio__acciones">
                    <button class="rs-btn rs-btn--outline rs-btn--sm" (click)="verReservasDe(s)">
                      <rs-icon name="calendar" [size]="13" [stroke]="2"></rs-icon> {{ 'Sus reservas' | t }}
                    </button>
                    <a class="rs-btn rs-btn--ghost rs-btn--sm" [routerLink]="rutaPublica(s)" target="_blank" rel="noopener">
                      <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon> {{ 'Ficha pública' | t }}
                    </a>
                  </div>
                </article>
              }
            </div>
          } @else {
            <p class="vacio">{{ 'El comercio no ha publicado ningún servicio.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Reservas ══ -->
      @if (pestana() === 'reservas') {
        <section class="rs-card bloque">
          <div class="bloque__head">
            <h2 class="bloque__titulo">{{ 'Reservas' | t }}</h2>
            @if (servicioFiltrado(); as s) {
              <button class="chip-filtro" (click)="quitarFiltroServicio()">
                {{ s.titulo }} <rs-icon name="x" [size]="12" [stroke]="2.5"></rs-icon>
              </button>
            }
          </div>

          <div class="pastillas" role="group" [attr.aria-label]="'Filtrar por estado' | t">
            @for (f of filtrosEstado; track f.valor) {
              <button class="pastillas__btn" [class.activa]="estadoReservas() === f.valor"
                      (click)="filtrarPorEstado(f.valor)">{{ f.label | t }}</button>
            }
          </div>

          @if (cargandoReservas()) {
            @for (i of [1,2,3]; track i) { <div class="skel skel--fila"></div> }
          } @else if (reservas().length) {
            <div class="tabla tabla--reservas">
              <div class="tabla__head">
                <span>{{ 'Código' | t }}</span><span>{{ 'Cliente' | t }}</span><span>{{ 'Servicio' | t }}</span>
                <span>{{ 'Fechas' | t }}</span><span>{{ 'Estado' | t }}</span><span>{{ 'Pago' | t }}</span>
                <span>{{ 'Total' | t }}</span><span>{{ 'Comisión' | t }}</span>
              </div>
              @for (r of reservas(); track r._id) {
                <div class="tabla__fila">
                  <span class="tabla__principal mono">{{ r.codigo }}</span>
                  <span [attr.data-col]="'Cliente' | t">
                    {{ r.cliente }}
                    @if (r.perroNombre) { <em class="perro">· {{ r.perroNombre }}</em> }
                  </span>
                  <span [attr.data-col]="'Servicio' | t">{{ r.servicio || etiquetaVertical(r.vertical) }}</span>
                  <span [attr.data-col]="'Fechas' | t">
                    {{ (r.fechaInicio || r.createdAt) | date:'d MMM yy' }}
                    @if (r.fechaFin) { → {{ r.fechaFin | date:'d MMM yy' }} }
                  </span>
                  <span [attr.data-col]="'Estado' | t">
                    <span class="rs-badge {{ meta(r.estado).badge }}">{{ meta(r.estado).label | t }}</span>
                  </span>
                  <span [attr.data-col]="'Pago' | t">
                    <span class="rs-badge {{ badgePago(r.estadoPago) }}">{{ etiquetaPago(r.estadoPago) | t }}</span>
                  </span>
                  <span [attr.data-col]="'Total' | t">{{ r.montoTotal | euros:'1.2-2' }}</span>
                  <span [attr.data-col]="'Comisión' | t">{{ r.comisionMonto | euros:'1.2-2' }}</span>
                </div>
              }
            </div>

            <div class="paginacion">
              <button class="rs-btn rs-btn--secondary rs-btn--sm" [disabled]="pagina() <= 1"
                      (click)="cambiarPagina(pagina() - 1)">{{ '← Anterior' | t }}</button>
              <span class="paginacion__info">
                {{ 'Página {pagina} de {paginas} · {total} reservas'
                   | t: { pagina: pagina(), paginas: totalPaginas(), total: totalReservas() } }}
              </span>
              <button class="rs-btn rs-btn--secondary rs-btn--sm" [disabled]="pagina() >= totalPaginas()"
                      (click)="cambiarPagina(pagina() + 1)">{{ 'Siguiente →' | t }}</button>
            </div>
          } @else {
            <p class="vacio">{{ 'No hay reservas con este filtro.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Equipo ══ -->
      @if (pestana() === 'equipo') {
        <section class="rs-card bloque">
          <h2 class="bloque__titulo">{{ 'Equipo' | t }}</h2>
          @if (d.equipo.length) {
            <div class="tabla tabla--equipo">
              <div class="tabla__head">
                <span>{{ 'Persona' | t }}</span><span>{{ 'Teléfono' | t }}</span>
                <span>{{ 'Rol' | t }}</span><span>{{ 'Verificado' | t }}</span><span>{{ 'Alta' | t }}</span>
              </div>
              @for (m of d.equipo; track m._id) {
                <div class="tabla__fila">
                  <span class="tabla__principal">
                    <strong>{{ m.nombre }}</strong>
                    <em class="tabla__sub">{{ m.email }}</em>
                  </span>
                  <span [attr.data-col]="'Teléfono' | t">{{ m.telefono || '—' }}</span>
                  <span [attr.data-col]="'Rol' | t">
                    <span class="rs-badge rs-badge--neutral">{{ etiquetaRol(m.rol) | t }}</span>
                  </span>
                  <span [attr.data-col]="'Verificado' | t">
                    <span class="rs-badge {{ m.verificado ? 'rs-badge--success' : 'rs-badge--warning' }}">
                      {{ m.verificado ? ('Sí' | t) : ('No' | t) }}
                    </span>
                  </span>
                  <span [attr.data-col]="'Alta' | t">{{ m.createdAt ? (m.createdAt | date:'d MMM yy') : '—' }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="vacio">{{ 'No hay ninguna cuenta asociada a este comercio.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Reseñas ══ -->
      @if (pestana() === 'resenas') {
        <section class="rs-card bloque">
          <div class="bloque__head">
            <h2 class="bloque__titulo">{{ 'Reseñas' | t }}</h2>
            <span class="bloque__pie">
              {{ '{media} / 5 · {pendientes} sin responder'
                 | t: { media: (d.metricas.resenas.media | number:'1.1-1') ?? '0', pendientes: d.metricas.resenas.sinResponder } }}
            </span>
          </div>

          @if (d.metricas.resenas.total) {
            <div class="reparto">
              @for (p of repartoResenas(); track p.estrellas) {
                <div class="reparto__fila">
                  <span class="reparto__lbl">{{ p.estrellas }} <rs-icon name="star" [size]="11" [stroke]="2"></rs-icon></span>
                  <span class="barra-fila__pista"><span class="barra-fila__valor" [style.width.%]="p.porcentaje"></span></span>
                  <span class="reparto__num">{{ p.total }}</span>
                </div>
              }
            </div>
          }

          @if (d.resenas.length) {
            <ul class="resenas">
              @for (r of d.resenas; track r._id) {
                <li class="resena">
                  <div class="resena__cab">
                    <strong>{{ r.usuarioNombre }}</strong>
                    <rs-stars [score]="r.puntuacion" [size]="13" />
                    <span class="resena__fecha">{{ r.createdAt ? (r.createdAt | date:'d MMM yyyy') : '' }}</span>
                  </div>
                  <p class="resena__servicio">{{ r.servicioTitulo }}</p>
                  <p class="resena__texto">{{ r.comentario }}</p>
                  @if (r.respuesta) {
                    <p class="resena__respuesta"><strong>{{ 'Respuesta del comercio' | t }}:</strong> {{ r.respuesta }}</p>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="vacio">{{ 'Todavía no tiene reseñas.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Incidencias ══ -->
      @if (pestana() === 'incidencias') {
        <section class="rs-card bloque">
          <h2 class="bloque__titulo">{{ 'Incidencias' | t }}</h2>
          @if (d.incidencias.length) {
            <div class="tabla tabla--incidencias">
              <div class="tabla__head">
                <span>{{ 'Asunto' | t }}</span><span>{{ 'Tipo' | t }}</span><span>{{ 'Abierta por' | t }}</span>
                <span>{{ 'Reserva' | t }}</span><span>{{ 'Estado' | t }}</span><span>{{ 'Fecha' | t }}</span>
              </div>
              @for (i of d.incidencias; track i._id) {
                <div class="tabla__fila">
                  <span class="tabla__principal">{{ i.asunto }}</span>
                  <span [attr.data-col]="'Tipo' | t">{{ i.tipo }}</span>
                  <span [attr.data-col]="'Abierta por' | t">{{ i.abiertaPorNombre }} ({{ i.origen }})</span>
                  <span class="mono" [attr.data-col]="'Reserva' | t">{{ i.codigoReserva || '—' }}</span>
                  <span [attr.data-col]="'Estado' | t">
                    <span class="rs-badge {{ badgeIncidencia(i.estado) }}">{{ i.estado }}</span>
                  </span>
                  <span [attr.data-col]="'Fecha' | t">{{ i.createdAt ? (i.createdAt | date:'d MMM yy') : '—' }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="vacio">{{ 'Sin incidencias registradas.' | t }}</p>
          }
        </section>
      }

      <!-- ══ Datos ══ -->
      @if (pestana() === 'datos') {
        <div class="dos-columnas">
          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Datos fiscales' | t }}</h2>
            <dl class="datos">
              <div><dt>{{ 'Razón social' | t }}</dt><dd>{{ d.comercio.razonSocial || '—' }}</dd></div>
              <div><dt>{{ 'CIF/NIF' | t }}</dt><dd class="mono">{{ d.comercio.vatNumber || '—' }}</dd></div>
              <div><dt>{{ 'Modo de liquidación' | t }}</dt><dd>{{ etiquetaModo(d.comercio.modoLiquidacion) | t }}</dd></div>
              <div><dt>{{ 'Plan' | t }}</dt><dd>{{ etiquetaPlan(d.comercio.plan) | t }}</dd></div>
              <div>
                <dt>{{ 'Comisión propia' | t }}</dt>
                <dd>{{ d.comercio.comisionPctOverride != null ? (d.comercio.comisionPctOverride * 100 | number:'1.0-2') + '%' : ('La del vertical' | t) }}</dd>
              </div>
              @if (d.comercio.socioFundador) {
                <div>
                  <dt>{{ 'Comisión congelada' | t }}</dt>
                  <dd>
                    {{ d.comercio.comisionPctCongelada != null ? (d.comercio.comisionPctCongelada * 100 | number:'1.0-2') + '%' : '—' }}
                    @if (d.comercio.congelacionHasta) { · {{ 'hasta {fecha}' | t: { fecha: (d.comercio.congelacionHasta | date:'d MMM yyyy') ?? '' } }} }
                  </dd>
                </div>
              }
              <div><dt>{{ 'Cohorte' | t }}</dt><dd>{{ d.comercio.cohorte || '—' }}</dd></div>
              <div><dt>{{ 'Política de cancelación' | t }}</dt><dd>{{ politica(d.comercio.politicaCancelacion) }}</dd></div>
              <div><dt>{{ 'Última modificación' | t }}</dt><dd>{{ d.comercio.updatedAt ? (d.comercio.updatedAt | date:'d MMM yyyy, HH:mm') : '—' }}</dd></div>
            </dl>
          </section>

          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Contacto' | t }}</h2>
            <dl class="datos">
              <div><dt>{{ 'Persona' | t }}</dt><dd>{{ d.comercio.contacto?.nombreContacto || '—' }}</dd></div>
              <div>
                <dt>{{ 'Email' | t }}</dt>
                <dd>
                  @if (d.comercio.contacto?.email) {
                    <a [href]="'mailto:' + d.comercio.contacto!.email">{{ d.comercio.contacto!.email }}</a>
                  } @else { — }
                </dd>
              </div>
              <div>
                <dt>{{ 'Teléfono' | t }}</dt>
                <dd>
                  @if (d.comercio.contacto?.telefono) {
                    <a [href]="'tel:' + d.comercio.contacto!.telefono">{{ d.comercio.contacto!.telefono }}</a>
                  } @else { — }
                </dd>
              </div>
              <div><dt>{{ 'WhatsApp' | t }}</dt><dd>{{ d.comercio.contacto?.whatsapp || '—' }}</dd></div>
              <div><dt>{{ 'Dirección' | t }}</dt><dd>{{ direccion(d) }}</dd></div>
            </dl>
          </section>

          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Datos bancarios' | t }}</h2>
            <dl class="datos">
              <div><dt>{{ 'Titular' | t }}</dt><dd>{{ d.comercio.datosBancarios?.titular || '—' }}</dd></div>
              <div><dt>IBAN</dt><dd class="mono">{{ d.comercio.datosBancarios?.iban || '—' }}</dd></div>
              <div><dt>{{ 'Banco' | t }}</dt><dd>{{ d.comercio.datosBancarios?.banco || '—' }}</dd></div>
              <div><dt>SWIFT</dt><dd class="mono">{{ d.comercio.datosBancarios?.swift || '—' }}</dd></div>
            </dl>
            <p class="nota">{{ 'El IBAN se enseña enmascarado: el número completo no sale del servidor.' | t }}</p>
          </section>

          <section class="rs-card bloque">
            <h2 class="bloque__titulo">{{ 'Consentimientos y avisos' | t }}</h2>
            <dl class="datos">
              @for (c of consentimientos(); track c.clave) {
                <div>
                  <dt>{{ c.label | t }}</dt>
                  <dd class="consentimiento">
                    <span class="rs-badge {{ c.aceptado ? 'rs-badge--success' : 'rs-badge--warning' }}">
                      {{ c.aceptado ? ('Aceptado' | t) : ('Pendiente' | t) }}
                    </span>
                    @if (c.fecha || c.version) {
                      <span class="nota">
                        {{ c.fecha ? (c.fecha | date:'d MMM yyyy') : '' }}
                        @if (c.version) { · v{{ c.version }} }
                      </span>
                    }
                  </dd>
                </div>
              }
              @for (n of notificaciones(); track n.clave) {
                <div>
                  <dt>{{ n.label | t }}</dt>
                  <dd>{{ n.activa ? ('Activado' | t) : ('Desactivado' | t) }}</dd>
                </div>
              }
            </dl>
          </section>

          @if (d.comercio.descripcion) {
            <section class="rs-card bloque bloque--ancho">
              <h2 class="bloque__titulo">{{ 'Descripción pública' | t }}</h2>
              <p class="parrafo">{{ d.comercio.descripcion }}</p>
            </section>
          }
        </div>
      }
    }

    <!-- Suspender o rechazar exige motivo: queda en el historial (TCK-8034) -->
    @if (suspendiendo()) {
      <div class="modal-fondo" (click)="cancelarSuspender()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal__titulo">
            {{ detalle()?.comercio?.estado === 'pendiente' ? ('Rechazar la solicitud' | t) : ('Suspender el comercio' | t) }}
          </h3>
          <p class="modal__texto">{{ 'Sus servicios dejan de verse en el buscador. El motivo queda registrado.' | t }}</p>
          <div class="rs-form-group">
            <label class="rs-label" for="motivo-suspension">{{ 'Motivo' | t }}</label>
            <textarea id="motivo-suspension" class="rs-input" rows="3" [value]="motivoSuspension()"
                      (input)="motivoSuspension.set($any($event.target).value)"></textarea>
          </div>
          <div class="modal__acciones">
            <button class="rs-btn rs-btn--ghost" (click)="cancelarSuspender()">{{ 'Cancelar' | t }}</button>
            <button class="rs-btn rs-btn--danger" [disabled]="!motivoSuspension().trim() || accionando()"
                    (click)="confirmarSuspender()">{{ 'Confirmar' | t }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .volver { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--c-accent); text-decoration: none; }
    .volver:hover { text-decoration: underline; }
    .acciones-error { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
    .mono { font-family: monospace; }

    /* ── Cabecera ── */
    .ficha-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-5); padding: var(--sp-6); flex-wrap: wrap; }
    .ficha-cab__identidad { display: flex; gap: var(--sp-4); align-items: flex-start; min-width: 0; flex: 1 1 320px; }
    .ficha-cab__avatar {
      width: 56px; height: 56px; flex-shrink: 0; border-radius: var(--r-lg); background: var(--g-accent);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: #fff;
    }
    .ficha-cab__texto { min-width: 0; }
    .ficha-cab__nombre { font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.15; overflow-wrap: anywhere; }
    .ficha-cab__meta { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); overflow-wrap: anywhere; }
    .ficha-cab__badges { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .ficha-cab__badges .rs-badge { display: inline-flex; align-items: center; gap: 4px; }
    .ficha-cab__acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .ficha-cab__acciones .rs-btn { display: inline-flex; align-items: center; gap: var(--sp-2); }

    .baja { display: flex; flex-direction: column; gap: 2px; }
    .baja__pie { font-size: var(--f-xs); opacity: .85; }

    /* ── KPIs ── */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); }
    .kpi { padding: var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: 2px; }
    .kpi__num { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .kpi__lbl { font-size: var(--f-xs); color: var(--t-400); }
    .kpi--alerta .kpi__num { color: var(--c-red, #B91C1C); }

    /*
     * Pestañas. En móvil se desplazan en horizontal en vez de envolverse: siete
     * rótulos apilados empujaban el contenido media pantalla hacia abajo.
     */
    .tabs {
      display: flex; gap: var(--sp-1); padding: var(--sp-1);
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tabs__btn {
      display: inline-flex; align-items: center; gap: var(--sp-2); white-space: nowrap;
      padding: var(--sp-3) var(--sp-4); border: none; background: transparent; border-radius: var(--r-md);
      cursor: pointer; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-400);
      transition: background var(--d-1), color var(--d-1);
    }
    .tabs__btn:hover { color: var(--t-200); }
    .tabs__btn.activa { background: var(--c-card); color: var(--c-accent); box-shadow: var(--sh-sm); }
    .tabs__num { padding: 1px var(--sp-2); border-radius: var(--r-full); background: var(--c-surface); font-size: var(--f-xs); }
    .tabs__btn.activa .tabs__num { background: var(--c-accent-lo); }

    /* ── Bloques ── */
    .bloque { padding: var(--sp-6); }
    .bloque__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-4); }
    .bloque__titulo { font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-4); }
    .bloque__head .bloque__titulo { margin-bottom: 0; }
    .bloque__pie { font-size: var(--f-xs); color: var(--t-400); }
    .vacio { font-size: var(--f-sm); color: var(--t-400); }
    .nota { font-size: var(--f-xs); color: var(--t-400); }
    .parrafo { font-size: var(--f-sm); color: var(--t-300); line-height: 1.6; white-space: pre-line; }
    .dos-columnas { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--sp-4); align-items: start; }
    .bloque--ancho { grid-column: 1 / -1; }

    /* ── Gráfico mensual ── */
    .conmutador { display: inline-flex; padding: 3px; gap: 2px; background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg); }
    .conmutador__btn { padding: var(--sp-2) var(--sp-3); border: none; background: transparent; border-radius: var(--r-md); cursor: pointer; font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400); }
    .conmutador__btn.activa { background: var(--c-card); color: var(--c-accent); }
    .grafico { width: 100%; height: 170px; }
    .grafico__barra { fill: var(--c-accent-lo); }
    .grafico__barra:hover { fill: var(--c-accent); }
    .grafico__pie { display: flex; justify-content: space-between; font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-2); }

    /* ── Barras horizontales ── */
    .barra-fila { display: grid; grid-template-columns: 132px 1fr 40px; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .barra-fila__pista { height: 8px; border-radius: var(--r-full); background: var(--c-surface); overflow: hidden; }
    .barra-fila__valor { display: block; height: 100%; border-radius: var(--r-full); background: var(--g-accent); }
    .barra-fila__num { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); text-align: right; }
    @media (max-width: 540px) {
      .barra-fila { grid-template-columns: 1fr 44px; }
      .barra-fila__lbl { grid-column: 1 / -1; }
    }

    .reparto__fila { display: grid; grid-template-columns: 52px 1fr 40px; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .reparto__lbl { display: inline-flex; align-items: center; gap: 3px; font-size: var(--f-sm); color: var(--t-300); }
    .reparto__num { font-size: var(--f-sm); color: var(--t-300); text-align: right; }
    .reparto { margin-bottom: var(--sp-5); }

    /* ── Listas de datos ── */
    .datos { display: grid; gap: var(--sp-3); }
    .datos > div { display: flex; justify-content: space-between; gap: var(--sp-4); align-items: baseline; }
    .datos dt { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
    .datos dd { font-size: var(--f-sm); color: var(--t-200); text-align: right; overflow-wrap: anywhere; }
    .datos dd.destacado { font-weight: var(--w-7); color: var(--c-accent); }
    .datos dd a { color: var(--c-accent); text-decoration: none; }
    /* La insignia y su fecha en dos líneas: en una sola, la fecha se partía. */
    .datos dd.consentimiento { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }

    .comisiones { list-style: none; display: grid; gap: var(--sp-2); }
    .comisiones__item { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); }
    .comisiones__vertical { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); flex: 1 1 160px; }
    .comisiones__pct { font-family: var(--font-accent); font-size: var(--f-lg); color: var(--c-accent); }
    .comisiones__origen { font-size: var(--f-xs); color: var(--t-400); }
    .comisiones__stripe { font-size: var(--f-xs); color: var(--t-400); margin-left: auto; }

    .reservas-mini { list-style: none; display: grid; gap: var(--sp-2); }
    .reservas-mini__item { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; padding: var(--sp-3); border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-300); }
    .reservas-mini__item:last-child { border-bottom: none; }
    .reservas-mini__item code { font-family: monospace; font-size: var(--f-xs); color: var(--c-accent); }
    .reservas-mini__cliente { font-weight: var(--w-6); color: var(--t-200); }
    .reservas-mini__fecha { color: var(--t-400); }
    .reservas-mini__item strong { margin-left: auto; color: var(--t-100); }

    /* ── Catálogo ── */
    .servicios { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--sp-4); }
    .servicio { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); border: 1px solid var(--b-1); border-radius: var(--r-lg); background: var(--c-card); }
    .servicio__foto {
      height: 120px; border-radius: var(--r-md); background: var(--c-raised);
      display: flex; align-items: center; justify-content: center; color: var(--t-400); overflow: hidden;
    }
    .servicio__foto img { width: 100%; height: 100%; object-fit: cover; }
    .servicio__cuerpo { display: flex; flex-direction: column; gap: var(--sp-2); flex: 1; }
    .servicio__titulo { font-size: var(--f-base); font-weight: var(--w-7); color: var(--t-100); overflow-wrap: anywhere; }
    .servicio__meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: var(--f-xs); color: var(--t-400); }
    .servicio__badges { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .servicio__badges .rs-badge { display: inline-flex; align-items: center; gap: 3px; }
    .servicio__cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); margin-top: auto; padding-top: var(--sp-3); border-top: 1px solid var(--b-1); }
    .servicio__cifras dt { font-size: var(--f-xs); color: var(--t-400); }
    .servicio__cifras dd { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .servicio__acciones { display: flex; gap: var(--sp-2); }
    .servicio__acciones > * { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2); text-decoration: none; }

    /* ── Pastillas de filtro ── */
    .pastillas { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .pastillas__btn {
      padding: var(--sp-2) var(--sp-3); border: 1px solid var(--b-1); background: var(--c-card);
      border-radius: var(--r-full); cursor: pointer; font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
    }
    .pastillas__btn.activa { background: var(--c-accent); border-color: var(--c-accent); color: #fff; }
    .chip-filtro {
      display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--c-accent); background: var(--c-accent-lo); color: var(--c-accent);
      border-radius: var(--r-full); cursor: pointer; font-size: var(--f-xs); font-weight: var(--w-6);
    }

    /*
     * Tablas. Cada rejilla declara sus columnas y todas comparten el mismo
     * comportamiento en móvil: la fila se convierte en tarjeta y cada celda
     * enseña su rótulo (data-col) junto al dato.
     */
    .tabla { display: flex; flex-direction: column; }
    .tabla__head, .tabla__fila { display: grid; column-gap: var(--sp-3); align-items: center; padding: var(--sp-3) var(--sp-2); }
    .tabla__head { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); }
    .tabla__fila { border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-300); }
    .tabla__fila:last-child { border-bottom: none; }
    .tabla__principal { display: flex; flex-direction: column; gap: 2px; font-weight: var(--w-6); color: var(--t-100); overflow-wrap: anywhere; }
    .tabla__sub { font-style: normal; font-size: var(--f-xs); font-weight: var(--w-4); color: var(--t-400); }
    .tabla--verticales .tabla__head, .tabla--verticales .tabla__fila { grid-template-columns: 2fr repeat(4, 1fr); }
    /* Aquí la celda principal es icono + nombre en una línea, no dos pisos. */
    .tabla--verticales .tabla__principal { flex-direction: row; align-items: center; gap: var(--sp-2); }
    .tabla--reservas .tabla__head, .tabla--reservas .tabla__fila { grid-template-columns: 110px 1.4fr 1.4fr 1.2fr 120px 110px 90px 90px; min-width: 960px; }
    .tabla--equipo .tabla__head, .tabla--equipo .tabla__fila { grid-template-columns: 2fr 1fr 1fr 110px 110px; }
    .tabla--incidencias .tabla__head, .tabla--incidencias .tabla__fila { grid-template-columns: 2fr 1fr 1.2fr 110px 110px 100px; }
    .perro { font-style: normal; color: var(--t-400); }

    /* La tabla de reservas es la única que no cabe: se desplaza en horizontal. */
    .tabla--reservas { overflow-x: auto; }

    @media (max-width: 768px) {
      .tabla__head { display: none; }
      .tabla--reservas { overflow-x: visible; }
      .tabla--verticales .tabla__fila,
      .tabla--reservas .tabla__fila,
      .tabla--equipo .tabla__fila,
      .tabla--incidencias .tabla__fila {
        grid-template-columns: 1fr; min-width: 0; gap: var(--sp-2);
        padding: var(--sp-4) 0; border-bottom: 1px solid var(--b-1);
      }
      .tabla__fila > [data-col] {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--sp-4); text-align: right; overflow-wrap: anywhere;
      }
      .tabla__fila > [data-col]::before {
        content: attr(data-col);
        flex: 0 0 auto;
        font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
        letter-spacing: .06em; text-transform: uppercase; color: var(--t-400);
      }
    }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-5); flex-wrap: wrap; }
    .paginacion__info { font-size: var(--f-sm); color: var(--t-400); }

    /* ── Reseñas ── */
    .resenas { list-style: none; display: grid; gap: var(--sp-4); }
    .resena { padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); }
    .resena__cab { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; font-size: var(--f-sm); color: var(--t-100); }
    .resena__fecha { margin-left: auto; font-size: var(--f-xs); color: var(--t-400); }
    .resena__servicio { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .resena__texto { font-size: var(--f-sm); color: var(--t-300); margin-top: var(--sp-2); line-height: 1.5; }
    .resena__respuesta { font-size: var(--f-sm); color: var(--t-300); margin-top: var(--sp-3); padding-left: var(--sp-3); border-left: 2px solid var(--c-accent); }

    /* ── Modal ── */
    .modal-fondo { position: fixed; inset: 0; z-index: var(--z-4, 300); background: rgba(0,19,93,.35); display: flex; align-items: center; justify-content: center; padding: var(--sp-5); }
    .modal { width: 100%; max-width: 460px; max-height: calc(100dvh - var(--sp-10)); overflow-y: auto; padding: var(--sp-6); background: var(--c-card); border-radius: var(--r-xl); box-shadow: var(--sh-lg); }
    .modal__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .modal__texto { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); }
    .modal__acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-4); }

    /* ── Esqueletos ── */
    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 16px; animation: latido 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 160px; } .skel--lg { width: 240px; height: 24px; }
    .skel--avatar { width: 56px; height: 56px; border-radius: var(--r-lg); }
    .skel--fila { width: 100%; height: 44px; margin-bottom: var(--sp-2); }
    @keyframes latido { 0%,100% { opacity: 1; } 50% { opacity: .45; } }

    @media (max-width: 768px) {
      .ficha-cab { padding: var(--sp-5); }
      .ficha-cab__nombre { font-size: var(--f-xl); }
      .ficha-cab__acciones { width: 100%; }
      .ficha-cab__acciones .rs-btn { flex: 1 1 calc(50% - var(--sp-2)); justify-content: center; }
      .bloque { padding: var(--sp-5) var(--sp-4); }
      .servicios { grid-template-columns: 1fr; }
      .grafico__pie { font-size: 9px; }
    }
  `],
})
export class AdminComercioDetalleComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly detalle = signal<DetalleComercioDto | null>(null);

  readonly pestana = signal<Pestana>('resumen');
  readonly metricaMes = signal<MetricaMes>('reservas');

  readonly accionando = signal(false);
  readonly avisoAccion = signal('');
  readonly errorAccion = signal('');
  readonly suspendiendo = signal(false);
  readonly motivoSuspension = signal('');

  /** Pestaña de reservas: se pide paginada al centro de reservas. */
  readonly reservas = signal<ReservaAdmin[]>([]);
  readonly totalReservas = signal(0);
  readonly pagina = signal(1);
  readonly estadoReservas = signal('');
  readonly servicioFiltrado = signal<ServicioDeComercioDto | null>(null);
  readonly cargandoReservas = signal(false);

  readonly filtrosEstado = FILTROS_ESTADO_RESERVA;

  readonly pestanas: ReadonlyArray<{ clave: Pestana; label: string; icono: string }> = [
    { clave: 'resumen', label: 'Resumen', icono: 'bar-chart' },
    { clave: 'servicios', label: 'Servicios', icono: 'list' },
    { clave: 'reservas', label: 'Reservas', icono: 'calendar' },
    { clave: 'equipo', label: 'Equipo', icono: 'users' },
    { clave: 'resenas', label: 'Reseñas', icono: 'star' },
    { clave: 'incidencias', label: 'Incidencias', icono: 'alert-circle' },
    { clave: 'datos', label: 'Datos', icono: 'file-text' },
  ];

  private comercioId = '';

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalReservas() / RESERVAS_POR_PAGINA)),
  );

  /** Estados con reservas, del más frecuente al menos. */
  readonly estadosOrdenados = computed(() => {
    const porEstado = this.detalle()?.metricas.reservas.porEstado ?? {};
    const maximo = Math.max(1, ...Object.values(porEstado));
    return Object.entries(porEstado)
      .map(([estado, total]) => ({ estado, total, porcentaje: Math.round((total / maximo) * 100) }))
      .sort((a, b) => b.total - a.total);
  });

  readonly repartoResenas = computed(() => {
    const distribucion = this.detalle()?.metricas.resenas.distribucion ?? {};
    const maximo = Math.max(1, ...Object.values(distribucion));
    return [5, 4, 3, 2, 1].map((estrellas) => {
      const total = distribucion[String(estrellas)] ?? 0;
      return { estrellas, total, porcentaje: Math.round((total / maximo) * 100) };
    });
  });

  readonly hayActividadMensual = computed(() =>
    (this.detalle()?.metricas.mensual ?? []).some((m) => m.reservas > 0 || m.gmv > 0),
  );

  /** Barras del gráfico, ya en coordenadas del viewBox 600×160. */
  readonly barrasMes = computed(() => {
    const serie = this.detalle()?.metricas.mensual ?? [];
    if (!serie.length) return [];
    const metrica = this.metricaMes();
    const maximo = Math.max(1, ...serie.map((m) => m[metrica]));
    const ancho = 600 / serie.length;
    return serie.map((mes, indice) => {
      const alto = Math.round((mes[metrica] / maximo) * 140);
      return {
        mes: mes.mes,
        // El rótulo lo escribe `FechaPipe`, que sabe el idioma activo.
        fecha: new Date(`${mes.mes}-01T00:00:00Z`),
        etiqueta: this.etiquetaMes(mes, metrica),
        x: Math.round(indice * ancho) + 2,
        y: 150 - alto,
        ancho: Math.max(3, Math.round(ancho) - 4),
        alto,
      };
    });
  });

  readonly consentimientos = computed(() => {
    const declarados = this.detalle()?.comercio.consentimientos ?? {};
    const rotulos: Record<string, string> = {
      operaLegalmente: 'Declara operar legalmente',
      condicionesGenerales: 'Acepta las condiciones generales',
    };
    return Object.entries(declarados).map(([clave, valor]) => ({
      clave,
      label: rotulos[clave] ?? clave,
      aceptado: valor.aceptado,
      fecha: valor.fecha,
      version: valor.version,
    }));
  });

  readonly notificaciones = computed(() => {
    const preferencias = this.detalle()?.comercio.preferenciasNotificacion ?? {};
    const rotulos: Record<string, string> = {
      nuevaReserva: 'Aviso de nueva reserva',
      cancelacion: 'Aviso de cancelación',
      resena: 'Aviso de reseña',
      pagos: 'Aviso de pagos',
    };
    return Object.entries(preferencias).map(([clave, activa]) => ({
      clave,
      label: rotulos[clave] ?? clave,
      activa,
    }));
  });

  async ngOnInit(): Promise<void> {
    this.comercioId = this.ruta.snapshot.paramMap.get('id') ?? '';
    const pestana = this.ruta.snapshot.queryParamMap.get('tab') as Pestana | null;
    if (pestana && this.pestanas.some((p) => p.clave === pestana)) this.pestana.set(pestana);
    await this.cargar();
  }

  /**
   * El error se enseña tal cual llega del API: un "no se pudo cargar" a secas no
   * dejaba distinguir un permiso que falta de un comercio borrado.
   */
  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      this.detalle.set(await firstValueFrom(this.api.getDetalleComercio(this.comercioId)));
      if (this.pestana() === 'reservas') await this.cargarReservas();
    } catch (error) {
      this.detalle.set(null);
      this.errorMsg.set(mensajeDeError(error, this.mensajePorDefecto(error)));
    } finally {
      this.cargando.set(false);
    }
  }

  private mensajePorDefecto(error: unknown): string {
    const estado = (error as { status?: number } | null)?.status;
    if (estado === 0) return 'No se pudo contactar con el API (red o CORS).';
    if (estado === 404) return 'Este comercio ya no existe.';
    return `No se pudo cargar la ficha del comercio${estado ? ` (HTTP ${estado})` : ''}.`;
  }

  async irA(pestana: Pestana): Promise<void> {
    this.pestana.set(pestana);
    // La pestaña viaja en la URL: así se puede compartir el enlace y la vuelta
    // desde una reserva no devuelve siempre al resumen.
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tab: pestana === 'resumen' ? null : pestana },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (pestana === 'reservas' && !this.reservas().length) await this.cargarReservas();
  }

  private async cargarReservas(): Promise<void> {
    this.cargandoReservas.set(true);
    try {
      const resultado = await firstValueFrom(this.api.getReservas(this.pagina(), {
        comercioId: this.comercioId,
        estado: this.estadoReservas() || undefined,
        servicioId: this.servicioFiltrado()?._id,
      }, RESERVAS_POR_PAGINA));
      this.reservas.set(resultado.items);
      this.totalReservas.set(resultado.total);
    } catch (error) {
      this.reservas.set([]);
      this.errorAccion.set(mensajeDeError(error, 'No se pudieron cargar las reservas.'));
    } finally {
      this.cargandoReservas.set(false);
    }
  }

  async filtrarPorEstado(estado: string): Promise<void> {
    this.estadoReservas.set(estado);
    this.pagina.set(1);
    await this.cargarReservas();
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargarReservas();
  }

  /** Desde el catálogo: enseña sólo las reservas de ese listado. */
  async verReservasDe(servicio: ServicioDeComercioDto): Promise<void> {
    this.servicioFiltrado.set(servicio);
    this.estadoReservas.set('');
    this.pagina.set(1);
    await this.irA('reservas');
    await this.cargarReservas();
  }

  async quitarFiltroServicio(): Promise<void> {
    this.servicioFiltrado.set(null);
    this.pagina.set(1);
    await this.cargarReservas();
  }

  async aprobar(): Promise<void> {
    await this.ejecutar(
      () => firstValueFrom(this.api.aprobarComercio(this.comercioId)),
      'Comercio activado.',
      'No se pudo activar el comercio.',
    );
  }

  abrirSuspender(): void {
    this.motivoSuspension.set('');
    this.suspendiendo.set(true);
  }

  cancelarSuspender(): void {
    this.suspendiendo.set(false);
    this.motivoSuspension.set('');
  }

  async confirmarSuspender(): Promise<void> {
    const motivo = this.motivoSuspension().trim();
    if (!motivo) return;
    this.suspendiendo.set(false);
    await this.ejecutar(
      () => firstValueFrom(this.api.rechazarComercio(this.comercioId, motivo)),
      'Comercio suspendido.',
      'No se pudo suspender el comercio.',
    );
  }

  async restaurar(): Promise<void> {
    await this.ejecutar(
      () => firstValueFrom(this.api.restaurarComercio(this.comercioId)),
      'Comercio restaurado: queda en pausa hasta que se revise.',
      'No se pudo restaurar el comercio.',
    );
  }

  async alternarAlpha(): Promise<void> {
    const adherido = !this.detalle()?.comercio.alphaAdherido;
    await this.ejecutar(
      () => firstValueFrom(this.api.fijarAlphaAdherido(this.comercioId, adherido)),
      adherido ? 'Adherido al programa Alpha.' : 'Fuera del programa Alpha.',
      'No se pudo cambiar la adhesión a Alpha.',
    );
  }

  /** Toda acción recarga la ficha: los contadores y el estado cambian con ella. */
  private async ejecutar(accion: () => Promise<unknown>, exito: string, fallo: string): Promise<void> {
    this.accionando.set(true);
    this.avisoAccion.set('');
    this.errorAccion.set('');
    try {
      await accion();
      this.avisoAccion.set(exito);
      await this.cargar();
    } catch (error) {
      this.errorAccion.set(mensajeDeError(error, fallo));
    } finally {
      this.accionando.set(false);
    }
  }

  contador(pestana: Pestana): number | null {
    const d = this.detalle();
    if (!d) return null;
    const contadores: Partial<Record<Pestana, number>> = {
      servicios: d.metricas.servicios.total,
      reservas: d.metricas.reservas.total,
      equipo: d.metricas.equipo.total,
      resenas: d.metricas.resenas.total,
      incidencias: d.metricas.incidencias.total,
    };
    return contadores[pestana] ?? null;
  }

  rutaPublica(servicio: ServicioDeComercioDto): string[] {
    return ['/', servicio.vertical, servicio._id];
  }

  direccion(detalle: DetalleComercioDto): string {
    const d = detalle.comercio.direccion;
    if (!d) return '—';
    const partes = [
      [d.calle, d.numero].filter(Boolean).join(' '),
      d.codigoPostal, d.ciudad, d.provincia, d.pais,
    ].filter((parte) => !!parte);
    return partes.length ? partes.join(', ') : '—';
  }

  origenComision(comision: ComisionAplicadaDto): string {
    const origenes: Record<ComisionAplicadaDto['origen'], string> = {
      override_comercio: 'Comisión propia del comercio',
      socio_fundador: 'Congelada por socio fundador',
      vertical: 'Tarifa de la categoría',
      defecto: 'Tarifa por defecto',
    };
    return origenes[comision.origen];
  }

  meta(estado: string): { badge: string; label: string } {
    return metaEstadoReserva(estado);
  }

  iconoDe(vertical: string): string {
    return iconoVertical(vertical);
  }

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  inicial(nombre: string): string {
    return nombre.trim()[0]?.toUpperCase() ?? 'C';
  }

  badgeEstado(estado: string): string {
    const badges: Record<string, string> = {
      activo: 'rs-badge--success',
      pendiente: 'rs-badge--warning',
      inactivo: 'rs-badge--neutral',
      suspendido: 'rs-badge--error',
      eliminado: 'rs-badge--error',
    };
    return badges[estado] ?? 'rs-badge--neutral';
  }

  etiquetaEstado(estado: string): string {
    const etiquetas: Record<string, string> = {
      activo: 'Activo',
      pendiente: 'Pendiente de aprobación',
      inactivo: 'En pausa',
      suspendido: 'Suspendido',
      eliminado: 'Dado de baja',
    };
    return etiquetas[estado] ?? estado;
  }

  badgeServicio(estado: string): string {
    const badges: Record<string, string> = {
      publicado: 'rs-badge--success',
      borrador: 'rs-badge--neutral',
      pausado: 'rs-badge--warning',
    };
    return badges[estado] ?? 'rs-badge--neutral';
  }

  etiquetaServicio(estado: string): string {
    const etiquetas: Record<string, string> = {
      publicado: 'Publicado',
      borrador: 'Borrador',
      pausado: 'Pausado',
    };
    return etiquetas[estado] ?? estado;
  }

  badgePago(estado?: string): string {
    const badges: Record<string, string> = {
      aprobado: 'rs-badge--success',
      iniciado: 'rs-badge--warning',
      rechazado: 'rs-badge--error',
      reembolsado: 'rs-badge--neutral',
    };
    return badges[estado ?? ''] ?? 'rs-badge--neutral';
  }

  etiquetaPago(estado?: string): string {
    const etiquetas: Record<string, string> = {
      aprobado: 'Cobrado',
      iniciado: 'Iniciado',
      rechazado: 'Rechazado',
      reembolsado: 'Reembolsado',
      sin_pago: 'Sin pago',
    };
    return etiquetas[estado ?? 'sin_pago'] ?? (estado ?? '—');
  }

  etiquetaPlan(plan: string): string {
    const etiquetas: Record<string, string> = { basico: 'Básico', pro: 'Pro', premium: 'Premium' };
    return etiquetas[plan] ?? plan;
  }

  /** `merchant`/`agencia` en el lenguaje del panel, no en el del esquema. */
  etiquetaModo(modo: string): string {
    return modo === 'merchant' ? 'Cobro online' : 'Pago en destino';
  }

  politica(valor?: string): string {
    return describirPolitica(valor);
  }

  badgeIncidencia(estado: string): string {
    const badges: Record<string, string> = {
      abierta: 'rs-badge--error',
      en_curso: 'rs-badge--warning',
      resuelta: 'rs-badge--success',
      cerrada: 'rs-badge--neutral',
    };
    return badges[estado] ?? 'rs-badge--warning';
  }

  etiquetaRol(rol: string): string {
    const etiquetas: Record<string, string> = {
      comercio_admin: 'Administrador',
      comercio_staff: 'Staff',
      cliente: 'Cliente',
      admin: 'Admin plataforma',
    };
    return etiquetas[rol] ?? rol;
  }

  private etiquetaMes(mes: MesDeComercioDto, metrica: MetricaMes): string {
    return metrica === 'reservas' ? `${mes.reservas} reservas` : euros(mes.gmv, '1.0-0');
  }
}
