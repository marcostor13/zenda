import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BloqueoDto, CitaAgendaDto, VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { claveDia, celdasDelMes, desdeClaveDia, hoyLocal } from '../../shared/fechas';
import { ComercioApiService, MiServicio } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Verticales que se venden por **noches y unidades**: su agenda es un
 * inventario (cuántas suites quedan cada día), no una rejilla de horas.
 */
const POR_INVENTARIO: readonly string[] = [VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES];

/** Franja que pinta la rejilla semanal; fuera de aquí no se atiende a nadie. */
const HORA_INICIO = 7;
const HORA_FIN = 22;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Descripciones que caben en una celda del mes antes de resumir en «+N más».
 * Con más, la celda deja de leerse de un vistazo, que es para lo que sirve.
 */
const MAX_DESCRIPCIONES = 2;

/** Mismas etiquetas que el panel de reservas, para no llamar a lo mismo de dos formas. */
const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', en_curso: 'En curso',
  completada: 'Completada', cancelada: 'Cancelada', no_show: 'No se presentó',
  ajuste_solicitado: 'Ajuste solicitado', pago_retenido: 'Pago retenido',
  pago_liberado: 'Pago liberado', en_disputa: 'En disputa', reembolsada: 'Reembolsada',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'rs-badge--warning', confirmada: 'rs-badge--success', en_curso: 'rs-badge--accent',
  completada: 'rs-badge--accent', cancelada: 'rs-badge--error', no_show: 'rs-badge--neutral',
  ajuste_solicitado: 'rs-badge--warning', pago_retenido: 'rs-badge--warning',
  pago_liberado: 'rs-badge--success', en_disputa: 'rs-badge--error', reembolsada: 'rs-badge--neutral',
};

/**
 * Lo que ocupa un día, ya redactado: quién ha reservado o por qué está cerrado.
 *
 * El recuento a secas («2») no distinguía una reserva de Doogking de un cierre
 * propio, que es justo lo que el comercio necesita saber sin abrir nada.
 */
interface ItemAgenda {
  id: string;
  tipo: 'reserva' | 'bloqueo';
  /** Primera línea: el cliente y su perro, o el motivo del cierre. */
  titulo: string;
  /** Segunda línea: código y estado de la reserva, o plazas cerradas. */
  subtitulo: string;
}

/** Recuento y descripciones de un día concreto del inventario. */
interface MarcasDia {
  bloqueadas: number;
  reservadas: number;
  cerradoDelTodo: boolean;
  items: ItemAgenda[];
}

/** Un día de la rejilla mensual del inventario. */
interface DiaInventario {
  clave: string;
  dia: number;
  delMes: boolean;
  pasado: boolean;
  esHoy: boolean;
  /** Unidades cerradas a mano ese día. */
  bloqueadas: number;
  /** Reservas de Doogking que ocupan ese día. */
  reservadas: number;
  cerradoDelTodo: boolean;
  /** Todo lo que ocupa el día, descrito; lo que se lista al abrirlo. */
  items: ItemAgenda[];
  /** Las descripciones que caben en la celda, y cuántas quedan fuera. */
  visibles: ItemAgenda[];
  ocultos: number;
}

/** Una tarjeta de la rejilla semanal, ya situada en píxeles. */
interface TarjetaSemana {
  id: string;
  titulo: string;
  subtitulo: string;
  esBloqueo: boolean;
  /** Desplazamiento y alto en píxeles dentro de la columna del día. */
  top: number;
  alto: number;
}

/**
 * Agenda del comercio.
 *
 * Un negocio no vende sólo por Doogking: si alquila dos suites por teléfono o
 * se va de vacaciones y esas plazas se siguen ofreciendo, acaba con dos
 * reservas para el mismo sitio. Aquí ve en un único sitio lo reservado por la
 * plataforma y cierra lo que ocupa por fuera.
 *
 * La vista cambia con lo que se vende, porque la pregunta es distinta:
 * - **Alojamiento y hoteles** se venden por noches y unidades, así que la
 *   pregunta es «cuántas plazas me quedan cada día»: rejilla de mes con el
 *   recuento, y cierres por cantidad.
 * - **El resto** son citas a una hora concreta: la pregunta es «qué tengo el
 *   martes por la tarde», así que rejilla de semana por horas, al estilo de un
 *   calendario, y cierres por tramo horario.
 */
@Component({
  selector: 'app-comercio-agenda',
  standalone: true,
  imports: [
    TraducirPipe, FormsModule, RouterLink, RsIconComponent
  ],
  template: `
    <div class="ag">
      <header class="ag__head">
        <div>
          <h1>{{ 'Agenda' | t }}</h1>
          <p>
            {{ 'Lo que tienes reservado en Doogking y lo que cierras por tu cuenta, en un solo sitio. Lo que bloquees aquí deja de ofrecerse en el buscador.' | t }}
          </p>
        </div>
      </header>

      @if (cargando()) {
        <div class="rs-card ag__cargando"><span class="rs-spin"></span></div>
      } @else if (!servicios().length) {
        <div class="rs-card ag__vacio">
          <rs-icon name="calendar" [size]="28" [stroke]="1.75" />
          <h2>{{ 'Todavía no tienes servicios' | t }}</h2>
          <p>{{ 'Crea tu primer servicio y aquí verás su agenda.' | t }}</p>
        </div>
      } @else {

        <!-- Selector de servicio: cada uno lleva su propia agenda. -->
        <div class="ag__servicios" role="tablist" [attr.aria-label]="'Elige el servicio' | t">
          @for (s of servicios(); track s._id) {
            <button type="button" class="ag-serv" role="tab"
                    [class.ag-serv--on]="servicioId() === s._id"
                    [attr.aria-selected]="servicioId() === s._id"
                    (click)="elegirServicio(s._id)">
              <span class="ag-serv__nombre">{{ s.titulo }}</span>
              <span class="ag-serv__vert">{{ etiquetaVertical(s.vertical) }}</span>
            </button>
          }
        </div>

        <!-- Barra de navegación temporal, común a las dos vistas. -->
        <div class="ag__barra">
          <div class="ag__nav">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="mover(-1)" [attr.aria-label]="esInventario() ? 'Mes anterior' : 'Semana anterior'">
              <rs-icon name="chevron-left" [size]="16" [stroke]="2.5" />
            </button>
            <strong class="ag__periodo">{{ tituloPeriodo() }}</strong>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="mover(1)" [attr.aria-label]="esInventario() ? 'Mes siguiente' : 'Semana siguiente'">
              <rs-icon name="chevron-right" [size]="16" [stroke]="2.5" />
            </button>
            <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="irAHoy()">{{ 'Hoy' | t }}</button>
          </div>

          <button type="button" class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCierre()">
            <rs-icon name="plus" [size]="14" [stroke]="2.5" />
            {{ 'Bloquear un tramo' | t }}
          </button>
        </div>

        @if (errorMsg()) {
          <div class="rs-alert rs-alert--error" role="alert">{{ errorMsg() }}</div>
        }

        <!-- ══ INVENTARIO (alojamiento y hoteles) ═══════════════════════ -->
        @if (esInventario()) {
          <div class="rs-card ag__panel">
            <div class="inv__leyenda">
              <span><i class="punto punto--libre"></i> {{ 'Libres' | t }}</span>
              <span><i class="punto punto--reserva"></i> {{ 'Reservado en Doogking' | t }}</span>
              <span><i class="punto punto--bloqueo"></i> {{ 'Bloqueado por ti' | t }}</span>
            </div>

            <div class="inv__semana" aria-hidden="true">
              @for (d of diasCortos; track $index) { <span>{{ d }}</span> }
            </div>

            <div class="inv__rejilla">
              @for (c of diasDelMes(); track c.clave) {
                <button type="button" class="inv-dia"
                        [class.inv-dia--fuera]="!c.delMes"
                        [class.inv-dia--pasado]="c.pasado"
                        [class.inv-dia--hoy]="c.esHoy"
                        [class.inv-dia--lleno]="c.cerradoDelTodo"
                        [attr.aria-label]="resumenDia(c)"
                        (click)="abrirDia(c)">
                  <span class="inv-dia__num">{{ c.dia }}</span>
                  <!-- Con el recuento a secas, un «2» no decía si eran reservas de
                       Doogking o cierres propios: había que abrir el día para saberlo. -->
                  @if (c.items.length) {
                    <span class="inv-dia__items">
                      @for (it of c.visibles; track it.tipo + it.id) {
                        <span class="chip" [class.chip--bloqueo]="it.tipo === 'bloqueo'"
                              [attr.title]="it.titulo + ' · ' + it.subtitulo">{{ it.titulo }}</span>
                      }
                      @if (c.ocultos) {
                        <span class="chip chip--mas">+{{ c.ocultos }} más</span>
                      }
                    </span>
                  }
                </button>
              }
            </div>
          </div>
        }

        <!-- ══ SEMANA POR HORAS (el resto de verticales) ════════════════ -->
        @else {
          <div class="rs-card ag__panel">
            <div class="sem" [style.--alto-hora.px]="ALTO_HORA">
              <div class="sem__horas" aria-hidden="true">
                @for (h of horas; track h) {
                  <span class="sem__hora">{{ h }}:00</span>
                }
              </div>

              <div class="sem__dias">
                @for (dia of diasDeLaSemana(); track dia.clave) {
                  <div class="sem-dia">
                    <div class="sem-dia__cab" [class.sem-dia__cab--hoy]="dia.esHoy">
                      <span class="sem-dia__nombre">{{ dia.nombre }}</span>
                      <span class="sem-dia__num">{{ dia.numero }}</span>
                    </div>
                    <div class="sem-dia__lienzo">
                      @for (h of horas; track h) { <div class="sem-dia__linea"></div> }
                      @for (t of dia.tarjetas; track t.id) {
                        <button type="button" class="cita" [class.cita--bloqueo]="t.esBloqueo"
                                [style.top.px]="t.top" [style.height.px]="t.alto"
                                [attr.title]="t.titulo + ' · ' + t.subtitulo"
                                (click)="abrirItem(t.esBloqueo ? 'bloqueo' : 'reserva', t.id)">
                          <span class="cita__titulo">{{ t.titulo }}</span>
                          <span class="cita__sub">{{ t.subtitulo }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- ══ LO QUE HAY CERRADO ═══════════════════════════════════════ -->
        <div class="rs-card ag__panel">
          <h2 class="ag__tit">{{ 'Tramos que has bloqueado' | t }}</h2>
          @if (bloqueos().length) {
            <ul class="bloqueos">
              @for (b of bloqueos(); track b._id) {
                <li class="bloqueo">
                  <span class="bloqueo__fechas">{{ rangoLegible(b) }}</span>
                  <span class="bloqueo__motivo">{{ b.motivo }}</span>
                  <span class="rs-badge rs-badge--neutral">
                    {{ b.cantidad ? b.cantidad + ' plazas' : 'Cerrado del todo' }}
                  </span>
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                          (click)="abrirCierre(b)" [attr.aria-label]="'Editar este tramo' | t">
                    <rs-icon name="pencil" [size]="13" [stroke]="2.5" />
                  </button>
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                          [disabled]="borrando() === b._id" (click)="reabrir(b)"
                          [attr.aria-label]="'Reabrir este tramo' | t">
                    <rs-icon name="x" [size]="13" [stroke]="2.5" />
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="ag__nota">
              {{ 'Todavía no has bloqueado nada en este periodo. Usa «Bloquear un tramo» cuando alquiles por fuera de Doogking o cierres por vacaciones.' | t }}
            </p>
          }
        </div>
      }

      <!-- ══ DIÁLOGO DE BLOQUEO (alta y edición) ════════════════════════ -->
      @if (cierreAbierto()) {
        <div class="capa" (click)="cierreAbierto.set(false)">
          <div class="modal rs-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <h2 class="modal__tit">
              {{ bloqueoEditando() ? 'Editar este bloqueo' : 'Bloquear un tramo' }}
            </h2>
            <p class="ag__nota">
              {{ 'Lo que bloquees deja de ofrecerse en el buscador. Es lo que evita que te entre una reserva de Doogking sobre algo que ya has vendido por tu cuenta.' | t }}
            </p>

            <div class="form-row">
              <div class="rs-field">
                <label class="rs-lbl" for="bl-desde">{{ esInventario() ? 'Desde el día' : 'Desde' }}</label>
                <input id="bl-desde" class="rs-inp" [type]="esInventario() ? 'date' : 'datetime-local'"
                       [(ngModel)]="formDesde" />
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="bl-hasta">{{ esInventario() ? 'Hasta el día' : 'Hasta' }}</label>
                <input id="bl-hasta" class="rs-inp" [type]="esInventario() ? 'date' : 'datetime-local'"
                       [(ngModel)]="formHasta" />
                @if (esInventario()) {
                  <span class="rs-field-hint">{{ 'La última noche bloqueada es la anterior a este día.' | t }}</span>
                }
              </div>
            </div>

            @if (esInventario()) {
              <div class="rs-field">
                <label class="rs-lbl" for="bl-cantidad">{{ '¿Cuántas plazas cierras?' | t }}</label>
                <input id="bl-cantidad" class="rs-inp" type="number" min="0"
                       [(ngModel)]="formCantidad" [placeholder]="'Déjalo vacío para cerrar del todo' | t" inputmode="numeric" />
                <span class="rs-field-hint">
                  {{ 'Pon un número para cerrar sólo esa parte (dos de tus cinco suites). Vacío cierra el servicio entero esos días.' | t }}
                </span>
              </div>
            }

            <div class="rs-field">
              <label class="rs-lbl" for="bl-motivo">{{ '¿Por qué lo cierras? *' | t }}</label>
              <input id="bl-motivo" class="rs-inp" [(ngModel)]="formMotivo"
                     [placeholder]="'Ej. reservado por teléfono, vacaciones, obras' | t" />
              <span class="rs-field-hint">
                {{ 'Dentro de tres semanas nadie recuerda por qué estaba bloqueado ese hueco.' | t }}
              </span>
            </div>

            @if (errorModal()) {
              <div class="rs-alert rs-alert--error" role="alert">{{ errorModal() }}</div>
            }

            <div class="modal__pie">
              @if (bloqueoEditando(); as b) {
                <button type="button" class="rs-btn rs-btn--ghost modal__aparte"
                        [disabled]="borrando() === b._id" (click)="reabrir(b)">
                  <rs-icon name="trash" [size]="14" [stroke]="2" />
                  {{ 'Reabrir el tramo' | t }}
                </button>
              }
              <button type="button" class="rs-btn rs-btn--ghost" (click)="cierreAbierto.set(false)">
                {{ 'Cancelar' | t }}
              </button>
              <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardando()"
                      (click)="guardarCierre()">
                {{ textoGuardar() }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ══ DETALLE DE UN DÍA (inventario) ═════════════════════════════ -->
      @if (diaAbierto(); as dia) {
        <div class="capa" (click)="diaAbiertoClave.set(null)">
          <div class="modal rs-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <h2 class="modal__tit modal__tit--fecha">{{ fechaLarga(dia.clave) }}</h2>

            @if (dia.items.length) {
              <ul class="items">
                @for (it of dia.items; track it.tipo + it.id) {
                  <li>
                    <button type="button" class="item" (click)="abrirItem(it.tipo, it.id)">
                      <span class="item__punto" [class.item__punto--bloqueo]="it.tipo === 'bloqueo'"></span>
                      <span class="item__texto">
                        <span class="item__tit">{{ it.titulo }}</span>
                        <span class="item__sub">{{ it.subtitulo }}</span>
                      </span>
                      <rs-icon name="chevron-right" [size]="14" [stroke]="2.5" />
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="ag__nota">{{ 'Ese día lo tienes libre entero.' | t }}</p>
            }

            <div class="modal__pie">
              <button type="button" class="rs-btn rs-btn--ghost" (click)="diaAbiertoClave.set(null)">
                {{ 'Cerrar' | t }}
              </button>
              <button type="button" class="rs-btn rs-btn--primary" (click)="bloquearEsteDia(dia)">
                {{ 'Bloquear este día' | t }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ══ DETALLE DE UNA RESERVA ═════════════════════════════════════ -->
      @if (citaAbierta(); as c) {
        <div class="capa" (click)="citaAbierta.set(null)">
          <div class="modal rs-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <h2 class="modal__tit">Reserva {{ c.codigo }}</h2>
            <span class="rs-badge modal__estado" [class]="badgeEstado(c.estado)">
              {{ etiquetaEstado(c.estado) }}
            </span>

            <dl class="ficha">
              <div><dt>{{ 'Cliente' | t }}</dt><dd>{{ c.cliente }}</dd></div>
              @if (c.perro) { <div><dt>{{ 'Perro' | t }}</dt><dd>{{ c.perro }}</dd></div> }
              <div><dt>{{ esInventario() ? 'Entrada' : 'Empieza' }}</dt><dd>{{ momentoLegible(c.desde) }}</dd></div>
              <div><dt>{{ esInventario() ? 'Salida' : 'Termina' }}</dt><dd>{{ momentoLegible(c.hasta) }}</dd></div>
            </dl>

            <p class="ag__nota">
              {{ 'Una reserva de Doogking no se cambia desde la agenda: tocarla afecta al cliente y al cobro, así que se gestiona desde su ficha en Reservas.' | t }}
            </p>

            <div class="modal__pie">
              <button type="button" class="rs-btn rs-btn--ghost" (click)="citaAbierta.set(null)">
                {{ 'Cerrar' | t }}
              </button>
              <a class="rs-btn rs-btn--primary" [routerLink]="['/comercio/reservas']"
                 [queryParams]="{ buscar: c.codigo }" (click)="citaAbierta.set(null)">
                {{ 'Ver la reserva' | t }}
              </a>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ag { display: flex; flex-direction: column; gap: var(--sp-5); }

    .ag__head h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .ag__head p { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-2); max-width: 70ch; line-height: 1.6; }

    .ag__cargando { display: flex; justify-content: center; padding: var(--sp-16); }
    .ag__vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
      padding: var(--sp-16) var(--sp-6); text-align: center; color: var(--t-400);
    }
    .ag__vacio h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }

    .ag__panel { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); }
    .ag__tit { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .ag__nota { font-size: var(--f-sm); color: var(--t-400); line-height: 1.6; }

    /* ── Selector de servicio ─────────────────────────────────────────── */
    .ag__servicios { display: flex; gap: var(--sp-2); overflow-x: auto; padding-bottom: var(--sp-1); }
    .ag-serv {
      display: flex; flex-direction: column; gap: 2px; text-align: left; flex-shrink: 0;
      padding: var(--sp-3) var(--sp-4);
      border: 1.5px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      &:hover { border-color: var(--dk-blue); }
    }
    .ag-serv--on { border-color: var(--dk-blue); background: var(--c-accent-lo); }
    .ag-serv__nombre { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .ag-serv__vert { font-size: var(--f-xs); color: var(--t-400); }

    /* ── Barra de periodo ─────────────────────────────────────────────── */
    .ag__barra {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-3); flex-wrap: wrap;
    }
    .ag__nav { display: flex; align-items: center; gap: var(--sp-2); }
    .ag__periodo {
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      text-transform: capitalize; min-width: 11ch; text-align: center;
    }

    /* ── Inventario: rejilla de mes ───────────────────────────────────── */
    .inv__leyenda { display: flex; gap: var(--sp-4); flex-wrap: wrap; font-size: var(--f-xs); color: var(--t-400); }
    .inv__leyenda span { display: inline-flex; align-items: center; gap: var(--sp-2); }
    .punto { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .punto--libre { background: var(--c-raised); border: 1px solid var(--b-1); }
    .punto--reserva { background: var(--dk-blue); }
    .punto--bloqueo { background: var(--dk-gold); }

    .inv__semana, .inv__rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--sp-1); }
    .inv__semana span {
      text-align: center; font-size: var(--f-xs); font-weight: var(--w-7);
      color: var(--t-400); padding-bottom: var(--sp-1);
    }

    .inv-dia {
      display: flex; flex-direction: column; gap: var(--sp-1);
      min-height: 92px; padding: var(--sp-2);
      border: 1px solid var(--b-1); border-radius: var(--r-md);
      background: var(--c-card); font: inherit; text-align: left; cursor: pointer;
      transition: border-color var(--d-2), box-shadow var(--d-2);
      &:hover { border-color: var(--dk-blue); }
    }
    .inv-dia--fuera { opacity: .4; }
    .inv-dia--pasado { background: var(--c-raised); }
    .inv-dia--hoy { border-color: var(--dk-blue); box-shadow: inset 0 0 0 1px var(--dk-blue); }
    .inv-dia--lleno { background: rgba(251, 174, 23, .10); }
    .inv-dia__num { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }
    .inv-dia__items { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    /* La descripción se recorta, no parte la celda: el texto entero sale en el
       tooltip y en el detalle del día. */
    .chip {
      font-size: 10px; font-weight: var(--w-6); line-height: 1.5;
      padding: 1px var(--sp-2); border-radius: var(--r-full);
      background: var(--dk-blue); color: #fff;
      max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .chip--bloqueo { background: var(--dk-gold); color: var(--dk-blue-deep); }
    .chip--mas { background: transparent; color: var(--t-400); padding-left: 2px; }

    /* ── Semana por horas ─────────────────────────────────────────────── */
    .sem { display: flex; gap: var(--sp-2); overflow-x: auto; }
    .sem__horas { display: flex; flex-direction: column; padding-top: 46px; flex-shrink: 0; }
    .sem__hora {
      height: var(--alto-hora); font-size: var(--f-xs); color: var(--t-400);
      text-align: right; padding-right: var(--sp-2); transform: translateY(-6px);
    }

    .sem__dias { display: grid; grid-template-columns: repeat(7, minmax(96px, 1fr)); gap: 2px; flex: 1; }
    .sem-dia { display: flex; flex-direction: column; min-width: 0; }
    .sem-dia__cab {
      display: flex; flex-direction: column; align-items: center; gap: 1px;
      height: 46px; justify-content: center;
      border-bottom: 1px solid var(--b-1);
    }
    .sem-dia__cab--hoy .sem-dia__num { background: var(--dk-blue); color: #fff; }
    .sem-dia__nombre { font-size: var(--f-xs); color: var(--t-400); }
    .sem-dia__num {
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
      width: 26px; height: 26px; border-radius: 50%;
      display: grid; place-items: center;
    }

    .sem-dia__lienzo { position: relative; background: var(--c-card); }
    .sem-dia__linea { height: var(--alto-hora); border-bottom: 1px solid var(--b-1); }

    .cita {
      position: absolute; left: 2px; right: 2px;
      display: flex; flex-direction: column; gap: 1px; overflow: hidden;
      padding: 2px var(--sp-2); border: none; border-radius: var(--r-sm);
      background: var(--dk-blue); color: #fff; text-align: left; cursor: pointer;
      font-family: inherit; font-size: var(--f-xs); line-height: 1.25;
    }
    /* Los bloqueos se distinguen del trabajo real de un vistazo. */
    .cita--bloqueo {
      background: repeating-linear-gradient(
        45deg, rgba(251,174,23,.9), rgba(251,174,23,.9) 6px,
        rgba(251,174,23,.65) 6px, rgba(251,174,23,.65) 12px);
      color: var(--dk-blue-deep);
    }
    .cita__titulo { font-weight: var(--w-7); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .cita__sub { opacity: .85; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

    /* ── Lista de bloqueos ────────────────────────────────────────────── */
    .bloqueos { display: flex; flex-direction: column; gap: var(--sp-2); }
    .bloqueo {
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
      padding: var(--sp-2) var(--sp-3);
      background: var(--c-raised); border-radius: var(--r-md); font-size: var(--f-sm);
    }
    .bloqueo__fechas { font-weight: var(--w-6); color: var(--t-100); }
    .bloqueo__motivo { flex: 1; color: var(--t-400); min-width: 120px; }

    /* ── Diálogo ──────────────────────────────────────────────────────── */
    .capa {
      position: fixed; inset: 0; z-index: 60;
      display: grid; place-items: center; padding: var(--sp-4);
      background: rgba(0, 19, 93, .35);
    }
    .modal {
      width: min(520px, 100%); max-height: 90vh; overflow: auto;
      padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4);
    }
    .modal__tit { font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100); }
    /* Sólo la inicial: capitalizar la fecha entera daría "Lunes 1 De Septiembre". */
    .modal__tit--fecha::first-letter { text-transform: uppercase; }
    .modal__estado { align-self: flex-start; }
    .modal__pie { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-3); flex-wrap: wrap; }
    /* Reabrir es destructivo: se separa del par cancelar/guardar para no pulsarlo por inercia. */
    .modal__aparte { margin-right: auto; }

    /* ── Detalle de un día ────────────────────────────────────────────── */
    .items { display: flex; flex-direction: column; gap: var(--sp-2); }
    .item {
      display: flex; align-items: center; gap: var(--sp-3); width: 100%;
      padding: var(--sp-3); border: 1px solid transparent; border-radius: var(--r-md);
      background: var(--c-raised); color: var(--t-100);
      font: inherit; text-align: left; cursor: pointer;
      transition: border-color var(--d-2);
      &:hover { border-color: var(--dk-blue); }
    }
    .item__punto { width: 8px; height: 8px; border-radius: 50%; background: var(--dk-blue); flex-shrink: 0; }
    .item__punto--bloqueo { background: var(--dk-gold); }
    .item__texto { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .item__tit { font-size: var(--f-sm); font-weight: var(--w-6); }
    .item__sub { font-size: var(--f-xs); color: var(--t-400); }

    .ficha { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ficha > div { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: var(--f-sm); }
    .ficha dt { color: var(--t-400); }
    .ficha dd { color: var(--t-100); font-weight: var(--w-6); text-align: right; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }

    @media (max-width: 719px) {
      .form-row { grid-template-columns: 1fr; }
      /* La rejilla de mes se aprieta, pero sigue cabiendo entera sin scroll
         lateral: partirla en dos pantallas rompería la lectura del mes. */
      .inv-dia { min-height: 76px; padding: var(--sp-1); }
      .inv-dia__num { font-size: var(--f-xs); }
      .chip { font-size: 9px; padding: 0 var(--sp-1); }
      /* La semana sí rueda en horizontal: siete columnas de horas no caben. */
      .sem__dias { grid-template-columns: repeat(7, 92px); }
      .ag__periodo { min-width: 0; }
    }
  `],
})
export class ComercioAgendaComponent implements OnInit {
  private readonly api = inject(ComercioApiService);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly borrando = signal<string | null>(null);
  readonly errorMsg = signal('');
  readonly errorModal = signal('');

  readonly servicios = signal<MiServicio[]>([]);
  readonly servicioId = signal<string | null>(null);
  readonly bloqueos = signal<BloqueoDto[]>([]);
  readonly citas = signal<CitaAgendaDto[]>([]);

  readonly diasCortos = DIAS_CORTOS;
  readonly horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  /** Alto de una hora en la rejilla; lo lee el CSS por variable. */
  readonly ALTO_HORA = 44;

  /** Primer día del periodo a la vista: mes en inventario, lunes en semana. */
  private readonly ancla = signal(hoyLocal());

  readonly servicioActual = computed(() =>
    this.servicios().find((s) => s._id === this.servicioId()) ?? null);

  /** Lo que se vende decide la pregunta, y la pregunta decide la vista. */
  readonly esInventario = computed(() =>
    POR_INVENTARIO.includes(this.servicioActual()?.vertical ?? ''));

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  // ── Periodo a la vista ───────────────────────────────────────────────

  /** Comienzo del periodo: día 1 del mes, o el lunes de la semana. */
  readonly desde = computed(() => {
    const base = this.ancla();
    if (this.esInventario()) return new Date(base.getFullYear(), base.getMonth(), 1);

    // getDay(): 0 = domingo. La semana europea empieza en lunes.
    const lunes = new Date(base);
    lunes.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  });

  readonly hasta = computed(() => {
    const inicio = this.desde();
    if (this.esInventario()) return new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    return new Date(inicio.getTime() + 7 * MS_POR_DIA);
  });

  readonly tituloPeriodo = computed(() => {
    const inicio = this.desde();
    if (this.esInventario()) {
      return inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    const fin = new Date(this.hasta().getTime() - MS_POR_DIA);
    const corto = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return `${corto(inicio)} – ${corto(fin)}`;
  });

  mover(pasos: number): void {
    const base = this.ancla();
    const siguiente = this.esInventario()
      ? new Date(base.getFullYear(), base.getMonth() + pasos, 1)
      : new Date(base.getTime() + pasos * 7 * MS_POR_DIA);

    this.ancla.set(siguiente);
    void this.cargarPeriodo();
  }

  irAHoy(): void {
    this.ancla.set(hoyLocal());
    void this.cargarPeriodo();
  }

  // ── Vista de inventario ──────────────────────────────────────────────

  readonly diasDelMes = computed<DiaInventario[]>(() => {
    const inicio = this.desde();
    const hoy = hoyLocal().getTime();
    const porDia = this.ocupacionPorDia();

    return celdasDelMes(inicio).map((fecha) => {
      const clave = claveDia(fecha);
      const marcas = porDia.get(clave)
        ?? { bloqueadas: 0, reservadas: 0, cerradoDelTodo: false, items: [] };
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === inicio.getMonth(),
        pasado: fecha.getTime() < hoy,
        esHoy: fecha.getTime() === hoy,
        ...marcas,
        visibles: marcas.items.slice(0, MAX_DESCRIPCIONES),
        ocultos: Math.max(0, marcas.items.length - MAX_DESCRIPCIONES),
      };
    });
  });

  /**
   * Cuánto hay tomado cada día, contando bloqueos y reservas por separado.
   *
   * Se cuentan aparte a propósito: al comercio le importa distinguir lo que le
   * ha entrado por Doogking de lo que ha cerrado él, que es justo el motivo por
   * el que existe esta pantalla.
   */
  private ocupacionPorDia(): Map<string, MarcasDia> {
    const porDia = new Map<string, MarcasDia>();
    const anota = (clave: string): MarcasDia => {
      const actual = porDia.get(clave)
        ?? { bloqueadas: 0, reservadas: 0, cerradoDelTodo: false, items: [] };
      porDia.set(clave, actual);
      return actual;
    };

    // Las reservas van primero: si el día se resume, lo que no puede faltar es
    // lo que ha entrado por la plataforma.
    for (const c of this.citas()) {
      for (const clave of this.diasEntre(new Date(c.desde), new Date(c.hasta))) {
        const dia = anota(clave);
        dia.reservadas += 1;
        dia.items.push(this.itemDeCita(c));
      }
    }

    for (const b of this.bloqueos()) {
      for (const clave of this.diasEntre(new Date(b.desde), new Date(b.hasta))) {
        const dia = anota(clave);
        dia.bloqueadas += b.cantidad ?? 1;
        if (b.cantidad === undefined) dia.cerradoDelTodo = true;
        dia.items.push(this.itemDeBloqueo(b));
      }
    }

    return porDia;
  }

  private itemDeCita(cita: CitaAgendaDto): ItemAgenda {
    return {
      id: cita._id,
      tipo: 'reserva',
      titulo: cita.perro ? `${cita.cliente} · ${cita.perro}` : cita.cliente,
      subtitulo: `Reserva ${cita.codigo} · ${this.etiquetaEstado(cita.estado)}`,
    };
  }

  private itemDeBloqueo(bloqueo: BloqueoDto): ItemAgenda {
    return {
      id: bloqueo._id,
      tipo: 'bloqueo',
      titulo: bloqueo.motivo,
      subtitulo: bloqueo.cantidad ? `${bloqueo.cantidad} plazas cerradas` : 'Cerrado del todo',
    };
  }

  etiquetaEstado(estado: string): string {
    return ESTADO_LABEL[estado] ?? estado;
  }

  badgeEstado(estado: string): string {
    return ESTADO_BADGE[estado] ?? 'rs-badge--neutral';
  }

  /** Lo que un lector de pantalla oye de una celda, sin depender del color. */
  resumenDia(dia: DiaInventario): string {
    if (!dia.items.length) return `Día ${dia.dia}, libre`;
    return `Día ${dia.dia}: ${dia.items.map((i) => i.titulo).join(', ')}`;
  }

  fechaLarga(clave: string): string {
    return desdeClaveDia(clave)
      .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  momentoLegible(iso: string): string {
    return new Date(iso)
      .toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /** Días `[desde, hasta)`; al menos el de inicio, para tramos de unas horas. */
  private diasEntre(desde: Date, hasta: Date): string[] {
    const dias: string[] = [];
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());

    while (cursor.getTime() < fin.getTime()) {
      dias.push(claveDia(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dias.length ? dias : [claveDia(desde)];
  }

  // ── Vista de semana ──────────────────────────────────────────────────

  readonly diasDeLaSemana = computed(() => {
    const lunes = this.desde();
    const hoy = claveDia(hoyLocal());

    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(lunes.getTime() + i * MS_POR_DIA);
      return {
        clave: claveDia(fecha),
        nombre: DIAS_CORTOS[i],
        numero: fecha.getDate(),
        esHoy: claveDia(fecha) === hoy,
        tarjetas: this.tarjetasDe(fecha),
      };
    });
  });

  /**
   * Sitúa citas y bloqueos dentro de la columna de un día.
   *
   * Se recorta a la franja visible: una estancia de tres noches en una agenda de
   * citas no puede pintar una barra de 72 horas, pero sí decir que ese día está
   * ocupado.
   */
  private tarjetasDe(dia: Date): TarjetaSemana[] {
    const abre = new Date(dia); abre.setHours(HORA_INICIO, 0, 0, 0);
    const cierra = new Date(dia); cierra.setHours(HORA_FIN, 0, 0, 0);

    const situar = (
      id: string, desde: Date, hasta: Date, titulo: string, subtitulo: string, esBloqueo: boolean,
    ): TarjetaSemana | null => {
      const inicio = Math.max(desde.getTime(), abre.getTime());
      const fin = Math.min(hasta.getTime(), cierra.getTime());
      if (fin <= inicio) return null;

      const minutoInicial = (inicio - abre.getTime()) / 60000;
      const minutos = (fin - inicio) / 60000;
      return {
        id, titulo, subtitulo, esBloqueo,
        top: (minutoInicial / 60) * this.ALTO_HORA,
        // 18px: por debajo, el texto de la tarjeta no se lee.
        alto: Math.max(18, (minutos / 60) * this.ALTO_HORA),
      };
    };

    const tarjetas: TarjetaSemana[] = [];

    for (const c of this.citas()) {
      const t = situar(c._id, new Date(c.desde), new Date(c.hasta),
        c.perro ? `${c.cliente} · ${c.perro}` : c.cliente, c.codigo, false);
      if (t) tarjetas.push(t);
    }

    for (const b of this.bloqueos()) {
      const t = situar(b._id, new Date(b.desde), new Date(b.hasta), 'Bloqueado', b.motivo, true);
      if (t) tarjetas.push(t);
    }

    return tarjetas;
  }

  // ── Carga ────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    try {
      const servicios = await firstValueFrom(this.api.getMisServicios());
      this.servicios.set(servicios);
      this.servicioId.set(servicios[0]?._id ?? null);
      if (servicios.length) await this.cargarPeriodo();
    } catch {
      this.errorMsg.set('No pudimos cargar tu agenda. Vuelve a intentarlo.');
    } finally {
      this.cargando.set(false);
    }
  }

  elegirServicio(id: string): void {
    this.servicioId.set(id);
    void this.cargarPeriodo();
  }

  private async cargarPeriodo(): Promise<void> {
    const id = this.servicioId();
    if (!id) return;

    this.errorMsg.set('');
    try {
      const [bloqueos, citas] = await Promise.all([
        firstValueFrom(this.api.getBloqueos(this.desde(), this.hasta(), id)),
        firstValueFrom(this.api.getCitasAgenda(this.desde(), this.hasta(), id)),
      ]);
      this.bloqueos.set(bloqueos);
      this.citas.set(citas);
    } catch {
      this.errorMsg.set('No pudimos cargar este periodo. Vuelve a intentarlo.');
    }
  }

  // ── Cerrar y reabrir tramos ──────────────────────────────────────────

  readonly cierreAbierto = signal(false);
  /** El bloqueo que se está editando; vacío significa que se está creando uno. */
  readonly bloqueoEditando = signal<BloqueoDto | null>(null);
  formDesde = '';
  formHasta = '';
  formCantidad: number | null = null;
  formMotivo = '';

  readonly textoGuardar = computed(() => {
    if (this.guardando()) return this.bloqueoEditando() ? 'Guardando…' : 'Bloqueando…';
    return this.bloqueoEditando() ? 'Guardar cambios' : 'Bloquear';
  });

  /** Sin argumento abre un alta; con uno, la edición de ese tramo. */
  abrirCierre(bloqueo?: BloqueoDto): void {
    this.diaAbiertoClave.set(null);
    this.citaAbierta.set(null);
    this.bloqueoEditando.set(bloqueo ?? null);
    this.errorModal.set('');

    if (bloqueo) this.precargarDe(bloqueo);
    else this.precargarTramoHabitual();

    this.cierreAbierto.set(true);
  }

  private precargarDe(bloqueo: BloqueoDto): void {
    this.formDesde = this.paraInput(new Date(bloqueo.desde));
    this.formHasta = this.paraInput(new Date(bloqueo.hasta));
    this.formCantidad = bloqueo.cantidad ?? null;
    this.formMotivo = bloqueo.motivo;
  }

  /** Se propone el tramo más habitual —hoy— para no arrancar en blanco. */
  private precargarTramoHabitual(): void {
    const hoy = hoyLocal();
    const manana = new Date(hoy.getTime() + MS_POR_DIA);

    this.formDesde = this.esInventario() ? claveDia(hoy) : `${claveDia(hoy)}T09:00`;
    this.formHasta = this.esInventario() ? claveDia(manana) : `${claveDia(hoy)}T14:00`;
    this.formCantidad = null;
    this.formMotivo = '';
  }

  /** Valor para el `date` o el `datetime-local` del formulario, en hora local. */
  private paraInput(fecha: Date): string {
    const dia = claveDia(fecha);
    if (this.esInventario()) return dia;

    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    return `${dia}T${hora}:${minuto}`;
  }

  async guardarCierre(): Promise<void> {
    const servicioId = this.servicioId();
    if (!servicioId || !this.cierreValido()) return;

    this.guardando.set(true);
    this.errorModal.set('');
    try {
      // Vacío significa "cierro el servicio entero", no "cero plazas". Al editar
      // hay que decirlo con `null`: omitir el campo dejaría la cantidad anterior.
      const cantidad = this.formCantidad && this.formCantidad > 0 ? this.formCantidad : undefined;
      const tramo = {
        desde: new Date(this.formDesde).toISOString(),
        hasta: new Date(this.formHasta).toISOString(),
        motivo: this.formMotivo.trim(),
      };
      const editado = this.bloqueoEditando();

      await firstValueFrom(editado
        ? this.api.actualizarBloqueo(editado._id, { ...tramo, cantidad: cantidad ?? null })
        : this.api.crearBloqueo({ servicioId, ...tramo, cantidad }));

      this.cierreAbierto.set(false);
      await this.cargarPeriodo();
    } catch {
      this.errorModal.set('No pudimos guardar el bloqueo. Inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  /** Valida el formulario y deja puesto el mensaje si algo no cuadra. */
  private cierreValido(): boolean {
    if (this.formMotivo.trim().length < 3) {
      this.errorModal.set('Explica brevemente por qué cierras este tramo.');
      return false;
    }
    if (!(new Date(this.formHasta).getTime() > new Date(this.formDesde).getTime())) {
      this.errorModal.set('El fin tiene que ser posterior al inicio.');
      return false;
    }
    return true;
  }

  async reabrir(bloqueo: BloqueoDto): Promise<void> {
    this.borrando.set(bloqueo._id);
    try {
      await firstValueFrom(this.api.eliminarBloqueo(bloqueo._id));
      this.cierreAbierto.set(false);
      await this.cargarPeriodo();
    } catch {
      this.errorMsg.set('No pudimos reabrir ese tramo. Inténtalo de nuevo.');
    } finally {
      this.borrando.set(null);
    }
  }

  // ── Abrir lo que hay en el calendario ────────────────────────────────

  /** Día del inventario abierto, por clave: así sigue vivo tras recargar. */
  readonly diaAbiertoClave = signal<string | null>(null);
  readonly citaAbierta = signal<CitaAgendaDto | null>(null);

  readonly diaAbierto = computed(() => {
    const clave = this.diaAbiertoClave();
    return clave ? this.diasDelMes().find((d) => d.clave === clave) ?? null : null;
  });

  abrirDia(dia: DiaInventario): void {
    this.diaAbiertoClave.set(dia.clave);
  }

  /**
   * Un bloqueo se edita aquí mismo; una reserva sólo se consulta, porque
   * cambiarla afecta al cliente y al cobro y eso vive en su ficha.
   */
  abrirItem(tipo: 'reserva' | 'bloqueo', id: string): void {
    if (tipo === 'bloqueo') {
      const bloqueo = this.bloqueos().find((b) => b._id === id);
      if (bloqueo) this.abrirCierre(bloqueo);
      return;
    }

    const cita = this.citas().find((c) => c._id === id);
    if (!cita) return;
    this.diaAbiertoClave.set(null);
    this.citaAbierta.set(cita);
  }

  /** Atajo del detalle del día: cierra esa noche sin volver a teclear la fecha. */
  bloquearEsteDia(dia: DiaInventario): void {
    const inicio = desdeClaveDia(dia.clave);
    this.abrirCierre();
    this.formDesde = claveDia(inicio);
    this.formHasta = claveDia(new Date(inicio.getTime() + MS_POR_DIA));
  }

  /** Rango legible de un bloqueo, sin repetir el mes cuando es el mismo. */
  rangoLegible(b: BloqueoDto): string {
    const desde = new Date(b.desde);
    const hasta = new Date(b.hasta);
    const conHora = !this.esInventario();

    const formato: Intl.DateTimeFormatOptions = conHora
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' };

    // En inventario la última noche es la anterior al día de salida.
    const fin = conHora ? hasta : new Date(hasta.getTime() - MS_POR_DIA);
    const inicioTexto = desde.toLocaleDateString('es-ES', formato);
    const finTexto = fin.toLocaleDateString('es-ES', formato);

    return inicioTexto === finTexto ? inicioTexto : `${inicioTexto} – ${finTexto}`;
  }
}
