import { ElementRef, Component, DestroyRef, signal, computed, OnInit, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { RsCardComponent, type CardAmenity } from '../../../shared/components/card/rs-card.component';
import { conIconos } from '../../../shared/catalogos/amenity-iconos';
import type { BarraHistograma } from '../../../shared/components/range-slider/rs-range-slider.component';
import { RsMapaComponent, type PuntoMapa, type ZonaMapa } from '../../../shared/components/mapa/rs-mapa.component';
import { RsMapaBuscadorComponent } from '../../../shared/components/mapa-buscador/rs-mapa-buscador.component';
import {
  RsFiltrosListadoComponent, type FiltrosSeleccionados,
} from '../../../shared/components/filtros-listado/rs-filtros-listado.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import {
  AlojamientoService, AlojamientoCard, FacetasCatalogo, FiltrosAlojamiento, OrdenServicios,
  PuntoServicio, ZonaBusqueda,
} from '../services/alojamiento.service';
import { calcularBadgesAutomaticos, type BadgeAutomatico } from '../../../shared/badges/badges-automaticos';
import { PerrosService, PerroApi } from '../../perros/perros.service';
import { ExperienciasCercaComponent } from '../../explora/experiencias-cerca.component';

/** Filtros comunes de búsqueda, tal y como llegan en la URL. */
interface BusquedaUrl {
  ciudad?: string;
  desde?: string;
  hasta?: string;
  perros?: number;
}

import { AltoBuscadorDirective } from '../../../shared/directives/alto-buscador.directive';

@Component({
  selector: 'app-alojamiento-lista',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, RsNavbarComponent, RsIconComponent,
    RsSearchBarComponent, AnimateOnScrollDirective, RsCardComponent,
    ExperienciasCercaComponent, RsMapaComponent,
    RsMapaBuscadorComponent, RsFiltrosListadoComponent, AltoBuscadorDirective,
  ],
  template: `
<div class="alojamiento-page" [class.alojamiento-page--mapa]="mapaAbierto()">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="search-bar-strip" rsAltoBuscador>
    <div class="rs-wrap">
      <rs-search-bar variant="strip" [vertical]="ui.key" [buscarAlCambiar]="true" />

      @if (misPerros().length > 0) {
        <form [formGroup]="searchForm" class="search-bar-strip__perro">
          <label class="rs-lbl" for="alojamiento-perro">Compatible con</label>
          <select id="alojamiento-perro" formControlName="perroId" class="rs-inp"
                  (change)="aplicarFiltros()">
            <option value="">Cualquier perro</option>
            @for (p of misPerros(); track p._id) {
              <option [value]="p._id">Solo apto para {{ p.nombre }}</option>
            }
          </select>
        </form>
      }
    </div>
  </div>

  <div class="rs-wrap alojamiento-body" [class.alojamiento-body--mapa]="mapaAbierto()">

    <!-- ── SIDEBAR ─────────────────────────────────────────── -->
    <aside class="filters-sidebar">
      <!-- Miniatura del mapa sobre los filtros, como en Booking (PDF §3, WA0009) -->
      @if (!mapaAbierto()) {
        <!-- El mapa va fuera del botón, no dentro: Leaflet inyecta enlaces
             (atribución, zoom) y anidarlos en un <button> no es marcado válido
             ni navegable con teclado. -->
        <div class="mapa-teaser">
          @if (puntosMapa().length > 0) {
            <rs-mapa class="mapa-teaser__mini" [puntos]="puntosMapa()" [estatico]="true"
                     ariaLabel="Vista previa del mapa de resultados" />
          } @else {
            <span class="mapa-teaser__vacio"></span>
          }
          <button type="button" class="mapa-teaser__cta" (click)="alternarMapa()"
                  [attr.aria-expanded]="false">
            <span class="mapa-teaser__pill">
              <rs-icon name="map-pin" [size]="15" [stroke]="2" />
              Ver en el mapa
            </span>
          </button>
        </div>
      }

      <!-- Panel común a los ocho verticales; sus grupos salen de
           filtros.config.ts según la categoría. -->
      <rs-filtros-listado
        [vertical]="ui.key"
        [histograma]="histogramaPrecios()"
        [conteos]="facetas()?.amenities ?? []"
        [conteosValoracion]="facetas()?.valoracion ?? []"
        (cambio)="aplicarFiltros($event)" />
    </aside>

    <!-- ── RESULTADOS ──────────────────────────────────────── -->
    <section class="results-col">
      <div class="results-header">
        <div>
          <p class="results-header__eyebrow">{{ claimVertical }}</p>
          <h1 class="results-header__title">
            {{ cargando() ? 'Buscando…' : ui.label + sufijoCiudad() }}
          </h1>
          <p class="results-header__sub">
            @if (!cargando()) { <span class="results-header__count">{{ totalLabel() }}</span> · }
            Precios en euros (€) · IVA incluido
          </p>
        </div>
        <div class="results-header__sort">
          <select [(ngModel)]="ordenamiento" class="rs-inp" style="width:auto"
                  aria-label="Ordenar resultados"
                  (change)="cambiarOrden()">
            <option value="relevancia">Relevancia</option>
            <option value="distancia">Distancia</option>
            <option value="precio_asc">Precio: menor a mayor</option>
            <option value="precio_desc">Precio: mayor a menor</option>
            <option value="valoracion">Mejor valorados</option>
          </select>
          @if (avisoUbicacion()) {
            <p class="results-header__geo">{{ avisoUbicacion() }}</p>
          }
        </div>
      </div>

      <!-- Skeleton loading -->
      @if (cargando()) {
        <div class="rs-result-grid">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="rs-skeleton rs-result-skeleton"></div>
          }
        </div>
      }

      <!-- Lista de alojamientos -->
      @if (!cargando()) {
        <div class="rs-result-grid">
          @for (a of alojamientos(); track a.id) {
            <rs-card rsAnim
              [id]="'card-' + a.id"
              [class.card--destacada]="destacadoId() === a.id"
              [horizontal]="true"
              [imageUrl]="a.imagenes[0]" [imageAlt]="a.nombre"
              [title]="a.nombre" [subtitle]="a.barrio + ', ' + a.ciudad"
              [badges]="badgesDe(a)"
              [rating]="{ score: a.score, label: a.scoreLabel, count: a.numResenas }"
              [price]="{ amount: '€' + a.precioPorNoche, period: '/ noche', oldAmount: a.precioAnterior ? '€' + a.precioAnterior : undefined }"
              notaPrecio="IVA incluido"
              [amenities]="serviciosDe(a)"
              [destacados]="incluyeDe(a)"
              [favoritoServicioId]="a.id"
              [routerLink]="['/alojamiento', a.id]"
              [queryParams]="queryParamsDetalle()"
              ctaLabel="Ver disponibilidad">
            </rs-card>
          }

          @if (!cargando() && alojamientos().length === 0 && !error()) {
            <div class="rs-result-empty">
              <rs-icon name="paw" [size]="48" [stroke]="1.5" />
              <h3>No encontramos alojamientos caninos</h3>
              <p>Prueba cambiando los filtros o la ciudad.</p>
            </div>
          }
          @if (!cargando() && error()) {
            <div class="rs-result-empty">
              <rs-icon name="paw" [size]="48" [stroke]="1.5" />
              <h3>No se pudo cargar el catálogo</h3>
              <p>Inténtalo de nuevo en unos momentos.</p>
              <button class="rs-btn rs-btn--secondary" style="margin-top:var(--sp-6)"
                      (click)="cargarAlojamientos()">Reintentar</button>
            </div>
          }
        </div>

        <!-- Paginación -->
        @if (totalPaginas() > 1) {
          <div class="pagination">
            <button class="rs-btn rs-btn--secondary rs-btn--sm"
                    [disabled]="paginaActual() <= 1"
                    (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
            <span class="pagination__info">Página {{ paginaActual() }} de {{ totalPaginas() }}</span>
            <button class="rs-btn rs-btn--secondary rs-btn--sm"
                    [disabled]="paginaActual() >= totalPaginas()"
                    (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
          </div>
        }
      }

      @if (!mapaAbierto()) {
        <app-experiencias-cerca [ciudad]="busquedaCiudad()" />
      }
    </section>

    <!-- ── MAPA (vista dividida estilo Booking) ─────────────── -->
    @if (mapaAbierto()) {
      <section class="mapa-col" #mapaCol aria-label="Buscar en el mapa">
        <rs-mapa-buscador #mapaBuscador
          [puntos]="puntosMapa()"
          [activo]="destacadoId()"
          [cargando]="cargandoMapa()"
          [total]="totalItems()"
          ariaLabel="Mapa de alojamientos caninos encontrados"
          (cerrar)="alternarMapa()"
          (puntoElegido)="destacarDesdeMapa($event)"
          (zonaBuscada)="buscarEnZona($event)" />
      </section>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .alojamiento-page { min-height: 100vh; background: var(--c-base); }

    .search-bar-strip {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--c-card);
      padding: var(--sp-5) 0;
      box-shadow: var(--sh-md);
      border-radius: 0 0 var(--r-lg) var(--r-lg);
    }

    .search-bar-strip__perro {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-top: var(--sp-3);

      .rs-inp { width: auto; min-width: 220px; }
    }

    .alojamiento-body {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: var(--sp-8);
      padding-block: var(--sp-8);
      align-items: start;

      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    /* Vista dividida al abrir el mapa: filtros · lista · mapa, como Booking.
       La lista se estrecha a una columna de tarjetas porque comparte el ancho
       con el mapa; a dos seguirían saliendo tarjetas de un palmo. */
    .alojamiento-body--mapa {
      grid-template-columns: 240px minmax(320px, 460px) 1fr;
      gap: var(--sp-6);

      .rs-result-grid { grid-template-columns: 1fr; }

      /* El mapa ocupa el alto de la ventana y la lista rueda a su lado: sin
         esto habría que bajar hasta el final del listado para volver a verlo. */
      .results-col {
        max-height: calc(100vh - 160px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-right: var(--sp-2);
      }

      @media (max-width: 1280px) { grid-template-columns: minmax(300px, 420px) 1fr; }
      /* En móvil no caben las dos cosas: el mapa se queda con la pantalla. */
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        padding-block: var(--sp-3);
        .filters-sidebar, .results-col { display: none; }
      }
    }

    .alojamiento-body--mapa .filters-sidebar {
      @media (max-width: 1280px) { display: none; }
    }

    /* Con el mapa abierto en móvil, el buscador pegajoso se retira: mide
       casi media pantalla y, al quedarse fijo arriba, tapaba la caja
       "Buscar en el mapa" y el botón de cerrar del propio mapa. */
    .alojamiento-page--mapa .search-bar-strip {
      @media (max-width: 900px) { display: none; }
    }

    .mapa-col {
      position: sticky;
      /* Justo debajo de la cabecera fija: la barra de búsqueda y la navegación
         se anclan las dos arriba, así que manda la más alta de las dos. Su alto
         real lo publica la directiva rsAltoBuscador, porque cambia con la ventana y con
         los campos de cada vertical. */
      top: calc(max(var(--alto-navbar), var(--alto-buscador, 192px)) + var(--sp-3));
      /* La unidad dvh descuenta las barras del navegador móvil, que aparecen y
         desaparecen al desplazarse; con vh el mapa se corta por abajo. La
         regla en vh queda de reserva para quien no entienda dvh. */
      height: calc(100vh - max(var(--alto-navbar), var(--alto-buscador, 192px)) - var(--sp-6));
      height: calc(100dvh - max(var(--alto-navbar), var(--alto-buscador, 192px)) - var(--sp-6));
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      overflow: hidden;
      box-shadow: var(--sh-md);

      /* A pantalla completa el mapa se pega al borde: los 24px del contenedor
         a cada lado son ancho de mapa que en un móvil se echa de menos. */
      @media (max-width: 900px) {
        top: calc(var(--alto-navbar) + var(--sp-3));
        height: calc(100vh - var(--alto-navbar) - var(--sp-6));
        height: calc(100dvh - var(--alto-navbar) - var(--sp-6));
        margin-inline: calc(var(--sp-6) * -1);
        border-inline: none;
        border-radius: var(--r-lg);
      }
    }

    /* SIDEBAR */
    .filters-sidebar {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-6);
      position: sticky;
      top: calc(max(var(--alto-navbar), var(--alto-buscador, 192px)) + var(--sp-3));

      /* En una sola columna los filtros van delante de los resultados: fijarlos
         dejaría un panel alto pegado arriba tapando las tarjetas. */
      @media (max-width: 1024px) { position: static; }
    }

    /* Miniatura de mapa sobre los filtros con su CTA superpuesto (PDF §3, WA0009). */
    .mapa-teaser {
      position: relative;
      display: block;
      width: 100%;
      height: 130px;
      margin-bottom: var(--sp-5);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      overflow: hidden;
      background: var(--c-raised);
    }

    /* La miniatura es decorativa: el clic lo gestiona el botón superpuesto. */
    .mapa-teaser__mini { display: block; height: 100%; pointer-events: none; }

    /* El botón cubre toda la miniatura para que el objetivo táctil sea la
       tarjeta entera y no solo la pastilla de texto. */
    .mapa-teaser__cta {
      position: absolute;
      inset: 0;
      /* Sobre los tiles y los controles de Leaflet (z-index 1000). */
      z-index: 1100;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: var(--sp-3);
      border: none;
      background: transparent;
      cursor: pointer;

      &:hover .mapa-teaser__pill { background: var(--c-accent-h); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: -2px; }
    }

    .mapa-teaser__pill {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      max-width: calc(100% - var(--sp-6));
      padding: var(--sp-2) var(--sp-4);
      border-radius: var(--r-full);
      background: var(--c-accent);
      color: #fff;
      font-family: var(--font);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      box-shadow: var(--sh-md);
    }

    /* Sin resultados geolocalizados la miniatura queda vacía; se rellena para
       que el botón "Ver en el mapa" siga siendo una superficie pulsable. */
    .mapa-teaser__vacio {
      display: block; height: 100%;
      background: linear-gradient(135deg, var(--c-raised), var(--c-surface));
    }

    /* Contador por opción de filtro ("Parking 514"). */
    .filter-count {
      margin-left: var(--sp-2);
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      color: var(--t-400);
    }

    /* Tarjeta resaltada al pulsar su pin en el mapa. */
    .card--destacada {
      outline: 2px solid var(--dk-gold);
      outline-offset: 3px;
      border-radius: var(--r-xl);
    }

    .filters-sidebar__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--sp-6);

      h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); }
    }

    .filter-group {
      border-top: 1px solid var(--b-1);
      padding-block: var(--sp-5);

      h4 { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); margin-bottom: var(--sp-4); }
    }

    /* Filtros como chips (HU-3.3): estado activo se ilumina en dorado — ver .rs-chip en styles.scss. */
    .filter-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .price-range { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }

    /* RESULTS */
    .results-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--sp-6);
      flex-wrap: wrap;
      gap: var(--sp-4);
    }

    .results-header__eyebrow {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--dk-gold);
      margin-bottom: var(--sp-1);
    }
    .results-header__title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue); }
    .results-header__sub { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .results-header__count { color: var(--t-200); font-weight: var(--w-6); }
    .results-header__geo { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); max-width: 32ch; }

    /* La tarjeta, la rejilla, el esqueleto y el estado vacío son comunes a
       todos los verticales: .rs-hotel-card, .rs-result-grid,
       .rs-result-skeleton y .rs-result-empty, en styles.scss. */

    /* PAGINATION */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      margin-top: var(--sp-10);
    }

    .pagination__info { font-size: var(--f-sm); color: var(--t-300); }
  `],
})
export class AlojamientoListaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly alojamientoService = inject(AlojamientoService);
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly alojamientos = signal<AlojamientoCard[]>([]);
  readonly paginaActual = signal(1);
  readonly totalPaginas = signal(1);

  // ── Mapa y facetas (PDF 27/07 §3, captura WA0009) ──────────────────
  readonly mapaAbierto = signal(false);
  /** Tarjeta resaltada al pulsar su pin en el mapa. */
  readonly destacadoId = signal<string | null>(null);
  readonly facetas = signal<FacetasCatalogo | null>(null);
  readonly cargandoMapa = signal(false);

  /**
   * Pines de la búsqueda actual. Se piden a un endpoint propio y no se derivan
   * de `alojamientos()`: la lista está paginada de diez en diez y el mapa debe
   * enseñar todo lo que hay en la zona, o la mitad de los pines faltarían.
   */
  private readonly puntos = signal<PuntoServicio[]>([]);

  readonly puntosMapa = computed<PuntoMapa[]>(() =>
    this.puntos().map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      etiqueta: `€${p.precio}`,
      titulo: p.titulo,
      imagen: p.imagen,
      rating: p.rating,
    })),
  );

  /** Zona del mapa por la que se está filtrando; null = búsqueda por ciudad. */
  private readonly zona = signal<ZonaBusqueda | null>(null);

  private readonly mapaBuscador = viewChild<RsMapaBuscadorComponent>('mapaBuscador');
  private readonly mapaCol = viewChild<ElementRef<HTMLElement>>('mapaCol');

  readonly histogramaPrecios = computed<BarraHistograma[]>(() => this.facetas()?.precios ?? []);

  conteoAmenity(valor: string): number | null {
    return this.facetas()?.amenities.find((a) => a.valor === valor)?.n ?? null;
  }

  conteoValoracion(minimo: number): number | null {
    return this.facetas()?.valoracion.find((v) => v.minimo === minimo)?.n ?? null;
  }

  alternarMapa(): void {
    const abierto = !this.mapaAbierto();
    this.mapaAbierto.set(abierto);

    if (!abierto) {
      this.destacadoId.set(null);
      // Cerrar el mapa devuelve la búsqueda a la ciudad escrita: dejar activo
      // un rectángulo invisible haría que los filtros no cuadrasen con nada.
      if (this.zona()) {
        this.zona.set(null);
        this.aplicarFiltros();
      }
      return;
    }

    // Leaflet mide el contenedor al crearse; el panel acaba de aparecer, así
    // que hay que decirle que vuelva a medir una vez pintado.
    setTimeout(() => {
      this.mapaBuscador()?.refrescar();
      // El mapa se ancla por debajo del buscador, así que recién abierto le
      // asoma el borde inferior por fuera de la ventana y los mandos de "buscar
      // en esta zona" quedan sin verse. Traerlo a la vista evita que el usuario
      // tenga que adivinar que hay que desplazarse.
      this.mapaCol()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  /**
   * Nueva zona visible del mapa: se vuelve a buscar acotando a ese rectángulo,
   * como el "Buscar mientras me desplazo" de Booking. Vuelve a la página uno
   * porque los resultados de la zona anterior ya no aplican.
   */
  buscarEnZona(zona: ZonaMapa): Promise<void> {
    this.zona.set({
      swLat: zona.swLat, swLng: zona.swLng, neLat: zona.neLat, neLng: zona.neLng,
    });
    this.paginaActual.set(1);
    return this.cargarAlojamientos();
  }

  /** Al pulsar un pin se resalta su tarjeta y se lleva al usuario hasta ella. */
  destacarDesdeMapa(id: string): void {
    this.destacadoId.set(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Badges de la tarjeta unificada (HU-3.1/HU-0.9): destacado, descuento, y automáticos por datos reales. */
  badgesDe(a: AlojamientoCard): BadgeAutomatico[] {
    const badges: BadgeAutomatico[] = [];
    if (a.destacado) badges.push({ icon: 'crown', label: 'Premium', variant: 'warning' });
    if (a.descuentoPct) badges.push({ icon: '', label: `-${a.descuentoPct}%`, variant: 'success' });
    badges.push(...calcularBadgesAutomaticos({
      score: a.score, numResenas: a.numResenas, plazasRestantes: a.espaciosDisponibles,
      alphaAdherido: a.alphaAdherido,
    }));
    return badges;
  }

  /**
   * Servicios como etiquetas con icono bajo la foto (HU-3.1). Los distintivos
   * del alojamiento van primero porque el recorte a tres lo aplica `<rs-card>`
   * y son los que más ayudan a decidir; el icono lo resuelve el mapeo común,
   * para que la misma etiqueta se vea igual en todos los listados.
   */
  serviciosDe(a: AlojamientoCard): CardAmenity[] {
    return conIconos(a.amenities);
  }

  /**
   * Lo que incluye la reserva, con marca de verificación bajo las etiquetas.
   * Va aparte de los servicios porque no describe el alojamiento sino las
   * condiciones de la reserva, que es lo que decide la compra.
   */
  incluyeDe(a: AlojamientoCard): string[] {
    const items: string[] = [];
    if (a.cancelacionGratis) items.push('Cancelación gratis');
    if (a.paseosIncluidos) items.push('Paseos diarios incluidos');
    return items;
  }
  readonly totalItems = signal(0);

  readonly totalLabel = computed(() =>
    `${this.totalItems()} espacios encontrados`
  );

  readonly sufijoCiudad = computed(() => {
    const ciudad = this.busqueda().ciudad;
    return ciudad ? ` en ${ciudad}` : '';
  });

  readonly ui = verticalUi(VerticalKey.ALOJAMIENTO);

  /** Claim de marca del vertical, sobre el título contextual de resultados. */
  readonly claimVertical =
    `${titularDeVertical(VerticalKey.ALOJAMIENTO)}. ${subtitularDeVertical(VerticalKey.ALOJAMIENTO)}`;

  /** Solo el filtro propio del listado: los campos comunes van en `<rs-search-bar>`. */
  readonly searchForm = this.fb.group({ perroId: [''] });

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  private readonly busqueda = signal<BusquedaUrl>({});

  /** Ciudad buscada; la consume el carrusel de experiencias de la comunidad. */
  readonly busquedaCiudad = computed(() => this.busqueda().ciudad);

  readonly misPerros = signal<PerroApi[]>([]);

  /** Lo marcado en el panel común de filtros (`rs-filtros-listado`). */
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });
  ordenamiento: OrdenServicios = 'relevancia';

  /** Punto de referencia para el orden por distancia. */
  private readonly coordenadas = signal<{ lat: number; lng: number } | null>(null);
  /** De dónde salió ese punto: la ciudad buscada o el GPS del dispositivo. */
  private readonly origenUbicacion = signal<'ciudad' | 'dispositivo' | null>(null);
  readonly avisoUbicacion = signal('');

  ngOnInit(): void {
    // La URL manda: cada búsqueda del buscador recarga el listado.
    // `takeUntilDestroyed` como en el resto de listados: sin él, el componente
    // sigue reaccionando a la URL después de destruirse.
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.busqueda.set({
        ciudad: params['ciudad'] || undefined,
        desde:  params['desde']  || undefined,
        hasta:  params['hasta']  || undefined,
        perros: Number(params['perros']) || undefined,
      });

      // La mascota elegida en el buscador filtra por compatibilidad sin que el
      // usuario tenga que volver a seleccionarla en el panel lateral.
      const [primerPerro] = (params['perroIds'] ?? '').split(',').filter(Boolean);
      if (primerPerro && primerPerro !== this.searchForm.value.perroId) {
        this.searchForm.patchValue({ perroId: primerPerro }, { emitEvent: false });
      }

      // Si el usuario eligió la población en el autocompletado, ya tenemos su
      // posición: ordenar por distancia no necesita pedirle permiso al navegador.
      const lat = Number(params['lat']);
      const lng = Number(params['lng']);
      if (params['lat'] && Number.isFinite(lat) && Number.isFinite(lng)) {
        this.coordenadas.set({ lat, lng });
        this.origenUbicacion.set('ciudad');
      }

      this.paginaActual.set(1);
      this.cargarAlojamientos();
    });

    void this.perrosService.misPerros().then((perros) => this.misPerros.set(perros)).catch(() => {
      // Sin sesión o sin perros registrados: el selector de compatibilidad no se muestra.
    });
  }

  async cargarAlojamientos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const busqueda = this.busqueda();
      const zona = this.zona();
      const seleccion = this.filtros();
      const filtros: FiltrosAlojamiento = {
        // Con el mapa acotando la zona, la ciudad sobra: el usuario ya ha dicho
        // por dónde quiere buscar arrastrando el mapa hasta ahí.
        ciudad:   zona ? undefined : busqueda.ciudad,
        zona:     zona ?? undefined,
        desde:    busqueda.desde,
        hasta:    busqueda.hasta,
        perros:   busqueda.perros,
        perroId:  this.searchForm.value.perroId || undefined,
        precioMin: seleccion.precioMin,
        precioMax: seleccion.precioMax,
        ratingMin: seleccion.ratingMin,
        amenities: seleccion.amenities,
        filtrosVertical: seleccion.vertical,
        orden: this.ordenamiento,
        lat: this.coordenadas()?.lat,
        lng: this.coordenadas()?.lng,
        page: this.paginaActual(),
        limit: 10,
      };
      const result = await this.alojamientoService.buscar(filtros);
      this.alojamientos.set(result.items);
      this.totalItems.set(result.total);
      this.totalPaginas.set(result.totalPages);
      // El pin resaltado deja de tener sentido con otra tanda de resultados.
      this.destacadoId.set(null);
      void this.cargarFacetas(filtros.ciudad, zona);
      void this.cargarPuntosMapa(filtros);
    } catch {
      // Sin datos inventados: se muestra estado de error, no listados falsos.
      this.alojamientos.set([]);
      this.totalItems.set(0);
      this.totalPaginas.set(1);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Contadores e histograma del panel de filtros (PDF §3). Van aparte de la
   * búsqueda: si fallan, los filtros siguen funcionando — simplemente se quedan
   * sin número al lado, que es preferible a romper el listado.
   */
  async cargarFacetas(ciudad?: string, zona?: ZonaBusqueda | null): Promise<void> {
    try {
      this.facetas.set(await this.alojamientoService.facetas(ciudad, zona ?? undefined));
    } catch {
      this.facetas.set(null);
    }
  }

  /**
   * Pines del mapa. También van aparte de la búsqueda principal: si el mapa
   * falla, la lista de resultados sigue siendo perfectamente usable, y quedarse
   * sin pines es mejor que quedarse sin resultados.
   */
  async cargarPuntosMapa(filtros: FiltrosAlojamiento): Promise<void> {
    this.cargandoMapa.set(true);
    try {
      this.puntos.set(await this.alojamientoService.puntosMapa(filtros));
    } catch {
      this.puntos.set([]);
    } finally {
      this.cargandoMapa.set(false);
    }
  }

  /**
   * Nueva selección del panel de filtros, o recarga sin argumento cuando lo
   * que cambia es el orden o el selector de mascota.
   */
  aplicarFiltros(seleccion?: FiltrosSeleccionados): void {
    if (seleccion) this.filtros.set(seleccion);
    this.paginaActual.set(1);
    void this.cargarAlojamientos();
  }

  /**
   * El permiso de ubicación solo se pide cuando el usuario elige ordenar por
   * distancia, nunca al abrir la pantalla: pedirlo sin motivo hace que la gente
   * lo deniegue y ya no se pueda volver a preguntar.
   */
  async cambiarOrden(): Promise<void> {
    if (this.ordenamiento !== 'distancia') {
      this.avisoUbicacion.set('');
      this.aplicarFiltros();
      return;
    }

    // Ya sabemos desde dónde medir porque el usuario eligió la población en el
    // autocompletado: no hace falta molestarle con el permiso del navegador.
    if (this.coordenadas()) {
      if (this.origenUbicacion() === 'ciudad') {
        this.avisoUbicacion.set('Ordenado desde la población que buscaste.');
      }
      this.aplicarFiltros();
      return;
    }

    if (!navigator.geolocation) {
      this.avisoUbicacion.set('Tu navegador no comparte la ubicación; ordenamos por la ciudad buscada.');
      this.aplicarFiltros();
      return;
    }

    this.avisoUbicacion.set('Buscando tu ubicación…');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      this.coordenadas.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      this.origenUbicacion.set('dispositivo');
      this.avisoUbicacion.set('Ordenado desde tu ubicación actual.');
    } catch {
      // Denegado o expirado: la búsqueda sigue siendo útil ordenada por la ciudad.
      this.avisoUbicacion.set('Sin acceso a tu ubicación; ordenamos por la ciudad buscada.');
    }
    this.aplicarFiltros();
  }

  cambiarPagina(n: number): void { this.paginaActual.set(n); this.cargarAlojamientos(); }

  /** Propaga fechas/perros buscados al detalle, para no pedirlos de nuevo antes de reservar. */
  queryParamsDetalle(): Record<string, string> {
    const { desde, hasta, perros } = this.busqueda();
    const perroId = this.searchForm.value.perroId;
    const params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;
    if (perros) params['perros'] = String(perros);
    if (perroId) params['perroId'] = perroId;
    return params;
  }

}
