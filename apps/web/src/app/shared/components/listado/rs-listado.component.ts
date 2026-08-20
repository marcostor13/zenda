import {
  ChangeDetectionStrategy, Component, DOCUMENT, HostListener, computed, effect,
  inject, input, output, signal, viewChild,
} from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import {
  RsFiltrosListadoComponent, type FiltrosSeleccionados,
} from '../filtros-listado/rs-filtros-listado.component';
import type { BarraHistograma } from '../range-slider/rs-range-slider.component';
import { filtrosDeVertical } from '../../verticales/filtros.config';

import { euros } from '../../pipes/euros.pipe';
/** Criterio de orden ofrecido en la barra de control. */
export interface OpcionOrden {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Filtro aplicado, tal como se pinta sobre la lista y se puede quitar. */
export interface ChipFiltro {
  readonly id: string;
  readonly tipo: 'precio' | 'rating' | 'opcion' | 'booleano';
  readonly campo?: string;
  readonly valor?: string;
  readonly etiqueta: string;
}

/**
 * Orden por defecto. `distancia` no entra aquí porque exige la ubicación del
 * usuario: el listado que la sepa pedir la añade con `ordenes`.
 */
export const ORDENES_POR_DEFECTO: readonly OpcionOrden[] = [
  { valor: 'relevancia',  etiqueta: 'Recomendados' },
  { valor: 'valoracion',  etiqueta: 'Mejor valorados' },
  { valor: 'precio_asc',  etiqueta: 'Precio: de menor a mayor' },
  { valor: 'precio_desc', etiqueta: 'Precio: de mayor a menor' },
];

/**
 * Carcasa común de todos los listados de resultados.
 *
 * Antes cada categoría traía la suya: alojamiento ordenaba con un `<select>`
 * en la cabecera y paginaba con "Anterior/Siguiente", transporte no ordenaba
 * ni paginaba, y solo el listado de citas tenía panel de filtros en móvil.
 * Bastaba cambiar de categoría para encontrarse otra pantalla. Aquí viven la
 * cabecera, la barra fija, los filtros, los estados y el mapa; cada vertical
 * solo aporta sus datos y sus tarjetas.
 *
 * Proyección esperada:
 * - `[listadoBuscador]`   barra de búsqueda de la categoría
 * - `[listadoAntes]`      controles propios sobre la lista (opcional)
 * - `[listadoResultados]` la rejilla de tarjetas (`class="rs-result-grid"`)
 * - `[listadoDespues]`    contenido bajo la lista (opcional)
 * - `[listadoMapa]`       el mapa, solo se monta si está abierto
 */
@Component({
  selector: 'rs-listado',
  standalone: true,
  imports: [RsIconComponent, RsFiltrosListadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ls">

  <!-- Buscador: no se queda fijo. Junto a la navbar sumaba 256 px de los 1000
       de pantalla en escritorio y 489 de los 915 en móvil. Lo que se queda
       fija es la barra de control, que es lo que se usa mientras se recorre
       la lista (mismo reparto que en Booking). -->
  <div class="ls__buscador" [class.is-plegado]="!buscadorAbierto()">
    <div class="rs-wrap">
      <!-- En móvil los cuatro campos apilados ocupaban 327 px del primer
           pantallazo antes de enseñar un solo resultado. Se resumen en una
           pastilla que se despliega al tocarla, como la barra de Airbnb sobre
           sus resultados. En escritorio caben en una fila y no se pliega. -->
      <button type="button" class="ls__buscador-pill" (click)="buscadorAbierto.set(true)"
              [attr.aria-expanded]="buscadorAbierto()">
        <rs-icon name="search" [size]="17" [stroke]="2.5" />
        <span class="ls__buscador-pill-txt">
          <strong>{{ ciudad() || 'Buscar' }}</strong>
          @if (contexto().length) { <span>{{ contexto().join(' · ') }}</span> }
          @else { <span>Cualquier fecha</span> }
        </span>
        <span class="ls__buscador-pill-editar" aria-hidden="true">
          <rs-icon name="pencil" [size]="14" [stroke]="2" />
        </span>
      </button>

      <div class="ls__buscador-campos"><ng-content select="[listadoBuscador]" /></div>
    </div>
  </div>

  <div class="rs-wrap">
    <header class="ls__head">
      <h1>{{ titulo() }}</h1>
      @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
    </header>
  </div>

  <!-- ── BARRA DE CONTROL ─────────────────────────────────────── -->
  <div class="ls__toolbar">
    <div class="rs-wrap ls__toolbar-fila">
      <p class="ls__count" aria-live="polite">
        @if (cargando()) {
          Buscando…
        } @else {
          <strong>{{ total() }}</strong>
          {{ total() === 1 ? 'resultado' : 'resultados' }}<span class="ls__count-ciudad">{{ sufijoCiudad() }}</span>
          @for (c of contexto(); track c) { <span class="ls__chip">{{ c }}</span> }
        }
      </p>

      <div class="ls__acciones">
        <label class="ls__orden">
          <span class="ls__orden-lbl">Ordenar por</span>
          <select class="ls__orden-sel" [value]="orden()"
                  (change)="alCambiarOrden($event)" aria-label="Ordenar resultados">
            @for (o of ordenes(); track o.valor) {
              <option [value]="o.valor">{{ o.etiqueta }}</option>
            }
          </select>
          <rs-icon name="chevron-down" [size]="14" [stroke]="2.5" />
        </label>

        <button type="button" class="ls__btn ls__btn--filtros"
                [attr.aria-expanded]="filtrosAbiertos()" (click)="abrirFiltros()">
          <rs-icon name="list" [size]="15" [stroke]="2" />
          Filtros
          @if (numFiltrosActivos()) { <span class="ls__btn-n">{{ numFiltrosActivos() }}</span> }
        </button>

        @if (conMapa()) {
          <button type="button" class="ls__btn" [class.is-on]="mapaAbierto()" (click)="mapaAlternado.emit()">
            <rs-icon name="map-pin" [size]="15" [stroke]="2" />
            {{ mapaAbierto() ? 'Ver lista' : 'Ver mapa' }}
          </button>
        }
      </div>
    </div>
  </div>

  <section class="ls__seccion">
    <div class="rs-wrap ls__body" [class.ls__body--mapa]="mapaAbierto()">

      <!-- ── FILTROS ────────────────────────────────────────── -->
      @if (filtrosAbiertos()) {
        <div class="ls__velo" (click)="cerrarFiltros()" aria-hidden="true"></div>
      }
      <aside class="ls__filtros" [class.is-abierto]="filtrosAbiertos()"
             [attr.role]="filtrosAbiertos() ? 'dialog' : null"
             [attr.aria-modal]="filtrosAbiertos() ? 'true' : null"
             [attr.aria-label]="filtrosAbiertos() ? 'Filtros de búsqueda' : null">
        <div class="ls__filtros-asa" aria-hidden="true"></div>
        <div class="ls__filtros-head">
          <h2>Filtros</h2>
          <button type="button" class="ls__filtros-cerrar" (click)="cerrarFiltros()"
                  aria-label="Cerrar filtros">
            <rs-icon name="x" [size]="18" [stroke]="2.5" />
          </button>
        </div>

        <div class="ls__filtros-cuerpo">
          <rs-filtros-listado #panelFiltros
            [vertical]="vertical()"
            [histograma]="histograma()"
            [conteos]="conteos()"
            [conteosValoracion]="conteosValoracion()"
            (cambio)="alCambiarFiltros($event)" />
        </div>

        <div class="ls__filtros-pie">
          <button type="button" class="rs-btn rs-btn--primary rs-btn--block" (click)="cerrarFiltros()">
            Ver {{ total() }} {{ total() === 1 ? 'resultado' : 'resultados' }}
          </button>
        </div>
      </aside>

      <!-- ── RESULTADOS ─────────────────────────────────────── -->
      <section class="ls__resultados">

        <!-- Lo filtrado, quitable de uno en uno. Va junto a la lista y no en la
             barra fija: ahí su alto variable descuadraría el desplazamiento con
             el que se pegan los filtros y el mapa. -->
        @if (chipsActivos().length) {
          <div class="ls__activos">
            @for (c of chipsActivos(); track c.id) {
              <button type="button" class="ls__activo" (click)="quitarChip(c)"
                      [attr.aria-label]="'Quitar filtro ' + c.etiqueta">
                {{ c.etiqueta }} <rs-icon name="x" [size]="11" [stroke]="3" />
              </button>
            }
            <button type="button" class="ls__activo ls__activo--limpiar" (click)="limpiarFiltros()">
              Limpiar todo
            </button>
          </div>
        }

        <ng-content select="[listadoAntes]" />

        @if (cargando()) {
          <div class="rs-result-grid">
            @for (_ of esqueleto; track $index) {
              <div class="rs-skeleton rs-result-skeleton"></div>
            }
          </div>
        } @else if (error()) {
          <div class="rs-result-empty">
            <rs-icon name="alert-triangle" [size]="48" [stroke]="1.5" />
            <h3>No se pudo cargar el catálogo</h3>
            <p>Inténtalo de nuevo en unos momentos.</p>
            <button type="button" class="rs-btn rs-btn--outline" (click)="reintentar.emit()">
              Reintentar
            </button>
          </div>
        } @else if (total() === 0) {
          <div class="rs-result-empty">
            <rs-icon name="search" [size]="48" [stroke]="1.5" />
            <h3>Sin resultados</h3>
            @if (numFiltrosActivos()) {
              <p>Ningún servicio cumple los {{ numFiltrosActivos() }} filtros activos.</p>
              <button type="button" class="rs-btn rs-btn--outline" (click)="limpiarFiltros()">
                Quitar los filtros
              </button>
            } @else {
              <p>Prueba con otra ciudad o cambia las fechas.</p>
            }
          </div>
        } @else {
          <ng-content select="[listadoResultados]" />

          @if (hayMas()) {
            <div class="ls__mas">
              <p>Viendo {{ mostrados() }} de {{ total() }}</p>
              <button type="button" class="rs-btn rs-btn--outline rs-btn--lg"
                      [disabled]="cargandoMas()" (click)="verMas.emit()">
                @if (cargandoMas()) { <span class="rs-spin"></span> }
                {{ cargandoMas() ? 'Cargando…' : 'Ver más resultados' }}
              </button>
            </div>
          }
        }

        <ng-content select="[listadoDespues]" />
      </section>

      <!-- ── MAPA ───────────────────────────────────────────── -->
      @if (mapaAbierto()) {
        <section class="ls__mapa" aria-label="Buscar en el mapa">
          <ng-content select="[listadoMapa]" />
        </section>
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* Cabecera fija de un listado: navbar + barra de control. Los filtros y el
       mapa se pegan justo debajo. */
    .ls { --dk-listado-top: 128px; min-height: 100vh; background: var(--c-base); }

    .ls__buscador {
      background: var(--c-card);
      padding-block: var(--sp-5);
      box-shadow: var(--sh-sm);
      border-bottom: 1px solid var(--b-1);
    }
    /* La pastilla solo existe en móvil. */
    .ls__buscador-pill { display: none; }

    @media (max-width: 700px) {
      .ls__buscador { padding-block: var(--sp-3); }

      .ls__buscador-pill {
        display: flex; align-items: center; gap: var(--sp-3);
        width: 100%; min-height: 52px;
        padding: var(--sp-2) var(--sp-3);
        border: 1px solid var(--b-2); border-radius: var(--r-full);
        background: var(--c-card); box-shadow: var(--sh-sm);
        text-align: left; cursor: pointer;
        transition: box-shadow var(--d-2), border-color var(--d-2);
      }
      .ls__buscador-pill:hover { box-shadow: var(--sh-md); border-color: var(--b-a); }
      .ls__buscador-pill > rs-icon { flex: none; color: var(--dk-blue); }
      .ls__buscador-pill-txt {
        flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25;

        strong {
          font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        span {
          font-size: var(--f-xs); color: var(--t-400);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
      }
      .ls__buscador-pill-editar {
        flex: none; display: grid; place-items: center;
        width: 32px; height: 32px; border-radius: var(--r-full);
        background: var(--c-raised); color: var(--t-300);
      }

      .ls__buscador.is-plegado .ls__buscador-campos { display: none; }
      .ls__buscador:not(.is-plegado) .ls__buscador-pill { display: none; }
    }

    .ls__head { padding-block: var(--sp-8) var(--sp-5); }
    .ls__head h1 {
      font-family: var(--font-display);
      font-size: var(--f-3xl); color: var(--dk-blue);
      letter-spacing: -.02em; line-height: 1.15;
    }
    .ls__head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    @media (max-width: 640px) {
      .ls__head { padding-block: var(--sp-5) var(--sp-4); }
      .ls__head h1 { font-size: var(--f-2xl); }
      .ls__head p { font-size: var(--f-sm); }
    }

    /* ── Barra de control ─────────────────────────────────────── */
    .ls__toolbar {
      position: sticky;
      top: var(--dk-navbar-h);
      z-index: 25;
      background: var(--c-card);
      border-block: 1px solid var(--b-1);
      box-shadow: var(--sh-sm);
      padding-block: var(--sp-3);
    }
    .ls__toolbar-fila {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-4); flex-wrap: wrap;
    }

    .ls__count { color: var(--t-400); font-size: var(--f-sm); min-width: 0; }
    .ls__count strong { color: var(--t-100); font-size: var(--f-md); font-weight: var(--w-8); }
    .ls__count-ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    .ls__chip {
      display: inline-block; margin-left: var(--sp-2);
      padding: 2px var(--sp-2); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }

    .ls__acciones { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }

    .ls__orden {
      position: relative;
      display: flex; align-items: center; gap: var(--sp-2);
      height: 44px; padding-inline: var(--sp-3);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
    }
    .ls__orden:hover { border-color: var(--b-a); background: var(--c-raised); }
    .ls__orden:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
    .ls__orden-lbl { font-size: var(--f-xs); color: var(--t-400); font-weight: var(--w-5); white-space: nowrap; }
    .ls__orden-sel {
      appearance: none; border: 0; background: transparent; outline: none; cursor: pointer;
      padding-right: var(--sp-4); margin-right: calc(var(--sp-4) * -1);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100);
    }
    .ls__orden rs-icon { color: var(--t-400); pointer-events: none; }
    @media (max-width: 520px) { .ls__orden-lbl { display: none; } }

    /* 44 px de alto: es el minimo comodo para el pulgar, y estos tres controles
       son los que mas se tocan de la pantalla. */
    .ls__btn {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
      height: 44px; padding-inline: var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-200);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6);
      cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
    }
    .ls__btn:hover { border-color: var(--b-a); background: var(--c-raised); color: var(--dk-blue); }
    .ls__btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    .ls__btn.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    .ls__btn-n {
      display: grid; place-items: center; min-width: 18px; height: 18px; padding-inline: 5px;
      border-radius: var(--r-full); background: var(--dk-blue); color: #fff;
      font-size: var(--f-xs); font-weight: var(--w-7);
    }
    /* En escritorio los filtros son una columna siempre visible. */
    @media (min-width: 1025px) { .ls__btn--filtros { display: none; } }

    /* En movil los tres controles se reparten el ancho, como la barra de
       Booking. Sueltos, el desplegable de orden reclamaba los 280 px de su
       opcion mas larga y empujaba a los otros dos a una segunda fila. */
    @media (max-width: 700px) {
      .ls__toolbar { padding-block: var(--sp-2); }
      .ls__toolbar-fila { flex-direction: column; align-items: stretch; gap: var(--sp-2); }
      .ls__count { font-size: var(--f-xs); }
      .ls__count strong { font-size: var(--f-sm); }
      .ls__acciones { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
      .ls__orden, .ls__btn { width: 100%; min-width: 0; padding-inline: var(--sp-2); }
      .ls__orden { overflow: hidden; justify-content: center; }
      .ls__orden-sel { width: 100%; min-width: 0; text-align: center; padding-right: 0; margin-right: 0; }
      .ls__orden rs-icon { display: none; }
    }

    /* ── Filtros aplicados ────────────────────────────────────── */
    .ls__activos { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-5); }
    .ls__activo {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      min-height: 32px; padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--c-accent); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-family: var(--font); font-size: var(--f-xs); font-weight: var(--w-6);
      cursor: pointer; transition: background var(--d-2);
    }
    .ls__activo:hover { background: rgba(8,37,139,.16); }
    .ls__activo--limpiar { border-style: dashed; border-color: var(--b-2); background: transparent; color: var(--t-400); }

    /* ── Cuerpo: filtros · lista · mapa ───────────────────────── */
    .ls__seccion { padding-block: var(--sp-6) var(--sp-12); }

    .ls__body {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: var(--sp-8);
      align-items: start;

      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    /* .rs-wrap acota el ancho para la lectura, pero con el mapa abierto no hay
       texto que leer: es un plano partido, y acotarlo deja el mapa mucho mas
       estrecho de lo que la pantalla permite. */
    .ls__body--mapa {
      max-width: none;
      grid-template-columns: 240px minmax(360px, 520px) 1fr;
      gap: var(--sp-6);

      /* La lista rueda al lado del mapa. En dvh y no en vh: en movil la barra
         del navegador se retrae y con vh el bloque queda cortado por abajo. */
      .ls__resultados {
        max-height: calc(100vh - var(--dk-listado-top) - var(--sp-5));
        max-height: calc(100dvh - var(--dk-listado-top) - var(--sp-5));
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding-right: var(--sp-2);
      }

      @media (max-width: 1280px) { grid-template-columns: minmax(320px, 460px) 1fr; }
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        .ls__resultados { display: none; }
      }
    }

    .ls__body--mapa .ls__filtros { @media (max-width: 1280px) { display: none; } }

    /* ── Panel de filtros ─────────────────────────────────────── */
    .ls__filtros {
      position: sticky;
      top: calc(var(--dk-listado-top) + var(--sp-4));
      max-height: calc(100dvh - var(--dk-listado-top) - var(--sp-8));
      display: flex; flex-direction: column; min-height: 0;
    }
    /* Asa, cabecera y pie solo existen en el panel de movil. */
    .ls__filtros-asa, .ls__filtros-head, .ls__filtros-pie { display: none; }
    /* Con ocho opciones y cuatro grupos el panel medía más que la columna de
       resultados entera: rueda por dentro en vez de alargar la pagina. */
    .ls__filtros-cuerpo {
      overflow-y: auto; overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch; min-height: 0;
    }

    .ls__velo { display: none; }

    @media (max-width: 1024px) {
      /* Panel inferior, no columna: como columna habia que pasar el panel
         entero antes de ver el primer resultado, y ademas iba position:sticky en una
         sola columna, asi que se montaba encima de las tarjetas. */
      .ls__filtros {
        position: fixed;
        inset: auto 0 0 0;
        z-index: var(--z-4);
        max-height: 88dvh;
        background: var(--c-card);
        border-radius: var(--r-2xl) var(--r-2xl) 0 0;
        box-shadow: 0 -12px 40px rgba(8,37,139,.24);
        transform: translateY(100%);
        transition: transform var(--d-3);
        will-change: transform;
      }
      .ls__filtros.is-abierto { transform: translateY(0); }

      .ls__filtros-asa {
        display: block; width: 40px; height: 4px; margin: var(--sp-3) auto 0;
        border-radius: var(--r-full); background: var(--b-2);
      }
      .ls__filtros-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--sp-3) var(--sp-5);
        border-bottom: 1px solid var(--b-1);

        h2 { font-family: var(--font-display); font-size: var(--f-lg); color: var(--dk-blue); }
      }
      .ls__filtros-cerrar {
        display: grid; place-items: center; width: 44px; height: 44px;
        margin-right: calc(var(--sp-2) * -1);
        border-radius: var(--r-full); color: var(--t-300);

        &:hover { background: var(--c-raised); }
      }
      .ls__filtros-cuerpo { padding: var(--sp-4) var(--sp-5); }
      .ls__filtros-pie {
        display: block;
        padding: var(--sp-4) var(--sp-5) calc(var(--sp-5) + env(safe-area-inset-bottom));
        border-top: 1px solid var(--b-1);
        background: var(--c-card);
      }

      .ls__velo {
        display: block; position: fixed; inset: 0; z-index: var(--z-3);
        background: rgba(5,26,102,.45);
        backdrop-filter: blur(2px);
      }

      /* El panel ya tiene su propio marco: dentro, la tarjeta del panel sobra. */
      .ls__filtros ::ng-deep .rs-filtros {
        border: 0; padding: 0; background: transparent; border-radius: 0;
      }
      .ls__filtros ::ng-deep .rs-filtros__head { display: none; }
    }

    /* ── Mapa ─────────────────────────────────────────────────── */
    .ls__mapa {
      position: sticky;
      top: calc(var(--dk-listado-top) + var(--sp-4));
      height: calc(100vh - var(--dk-listado-top) - var(--sp-8));
      height: calc(100dvh - var(--dk-listado-top) - var(--sp-8));
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      overflow: hidden;
      box-shadow: var(--sh-md);

      /* En movil ocupa la pantalla entera, como en Booking: en el flujo solo
         se veia un tercio hasta hacer scroll, que es justo lo que no se puede
         hacer con el mapa abierto. */
      @media (max-width: 900px) {
        position: fixed; inset: 0;
        z-index: var(--z-4);
        height: 100vh; height: 100dvh;
        border: none; border-radius: 0;
      }
    }

    /* ── Resultados ───────────────────────────────────────────── */
    .ls__mas {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
      margin-top: var(--sp-8);

      p { font-size: var(--f-sm); color: var(--t-400); }
    }
    .rs-result-empty .rs-btn { margin-top: var(--sp-4); }
  `],
})
export class RsListadoComponent {
  private readonly document = inject(DOCUMENT);

  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  /** Categoría; decide los grupos del panel de filtros. */
  readonly vertical = input.required<string>();

  readonly total = input(0);
  /** Cuántos hay ya pintados; el resto se trae con "Ver más". */
  readonly mostrados = input(0);
  readonly cargando = input(false);
  readonly cargandoMas = input(false);
  readonly error = input(false);
  readonly hayMas = input(false);

  readonly histograma = input<BarraHistograma[]>([]);
  readonly conteos = input<Array<{ valor: string; n: number }>>([]);
  readonly conteosValoracion = input<Array<{ minimo: number; n: number }>>([]);

  readonly orden = input('relevancia');
  readonly ordenes = input<readonly OpcionOrden[]>(ORDENES_POR_DEFECTO);

  /** Resumen de lo pedido en el buscador (fecha, hora, mascota). */
  readonly contexto = input<readonly string[]>([]);
  readonly sufijoCiudad = input('');
  /** Ciudad buscada; encabeza el resumen plegado del buscador en móvil. */
  readonly ciudad = input('');

  readonly conMapa = input(true);
  readonly mapaAbierto = input(false);

  readonly filtrosCambio = output<FiltrosSeleccionados>();
  readonly ordenCambio = output<string>();
  readonly verMas = output<void>();
  readonly reintentar = output<void>();
  readonly mapaAlternado = output<void>();

  readonly esqueleto = [1, 2, 3, 4];

  readonly filtrosAbiertos = signal(false);
  /** Solo aplica en móvil: en escritorio el buscador está siempre desplegado. */
  readonly buscadorAbierto = signal(false);
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });
  private readonly panelFiltros = viewChild<RsFiltrosListadoComponent>('panelFiltros');

  constructor() {
    // Con el panel abierto el fondo no debe rodar: en móvil, al arrastrar
    // dentro del panel se arrastraba la lista de detrás y al cerrarlo aparecía
    // otra parte de la página.
    effect(() => {
      this.document.body.classList.toggle('rs-sin-scroll', this.filtrosAbiertos());
    });
  }

  abrirFiltros(): void {
    this.filtrosAbiertos.set(true);
  }

  cerrarFiltros(): void {
    this.filtrosAbiertos.set(false);
  }

  /** Escape cierra el panel deslizante, se tenga el foco donde se tenga. */
  @HostListener('document:keydown.escape')
  alEscape(): void {
    if (this.filtrosAbiertos()) this.cerrarFiltros();
  }

  alCambiarOrden(evento: Event): void {
    this.ordenCambio.emit((evento.target as HTMLSelectElement).value);
    this.volverArribaDeLaLista();
  }

  alCambiarFiltros(seleccion: FiltrosSeleccionados): void {
    this.filtros.set(seleccion);
    this.filtrosCambio.emit(seleccion);
  }

  /**
   * Filtros aplicados, uno por chip. La selección vive en el panel, pero fuera
   * de él no había ninguna señal de que algo estuviese filtrando; en móvil el
   * panel ni siquiera está a la vista.
   */
  readonly chipsActivos = computed<ChipFiltro[]>(() => {
    const f = this.filtros();
    const chips: ChipFiltro[] = [];

    if (f.precioMax != null) chips.push({ id: 'precio', tipo: 'precio', etiqueta: `Hasta ${euros(f.precioMax)}` });
    if (f.ratingMin) chips.push({ id: 'rating', tipo: 'rating', etiqueta: `${f.ratingMin}.0 o más` });
    for (const valor of f.amenities ?? []) {
      chips.push({ id: `amenities:${valor}`, tipo: 'opcion', campo: 'amenities', valor, etiqueta: valor });
    }
    for (const [campo, valor] of Object.entries(f.vertical)) {
      if (valor === true) {
        chips.push({ id: campo, tipo: 'booleano', campo, etiqueta: this.etiquetaDe(campo) });
      } else if (Array.isArray(valor)) {
        for (const v of valor) {
          chips.push({ id: `${campo}:${v}`, tipo: 'opcion', campo, valor: v, etiqueta: this.etiquetaDe(campo, v) });
        }
      }
    }
    return chips;
  });

  readonly numFiltrosActivos = computed(() => this.chipsActivos().length);

  /** Texto que el usuario vio al marcar el filtro; la clave cruda si no aparece. */
  private etiquetaDe(campo: string, valor?: string): string {
    for (const grupo of filtrosDeVertical(this.vertical())) {
      for (const o of grupo.opciones ?? []) {
        if (o.valor === (valor ?? campo)) return o.etiqueta;
      }
    }
    return valor ?? campo;
  }

  quitarChip(chip: ChipFiltro): void {
    this.panelFiltros()?.quitar(chip.tipo, chip.campo, chip.valor);
  }

  limpiarFiltros(): void {
    this.panelFiltros()?.limpiar();
  }

  /**
   * Tras reordenar o repaginar, la lista es otra: dejar el scroll donde estaba
   * dejaba al usuario en mitad de unos resultados que ya no eran los que había
   * visto. Sube hasta la barra de control, no hasta la cabecera, para no
   * obligar a recorrer otra vez el buscador.
   */
  volverArribaDeLaLista(): void {
    const barra = (this.document.querySelector('.ls__toolbar') as HTMLElement | null);
    if (!barra) return;
    const y = barra.getBoundingClientRect().top + this.document.defaultView!.scrollY - 64;
    this.document.defaultView?.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  }
}
