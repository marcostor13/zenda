import { ElementRef, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import {
  RsCardComponent, type CardAmenity, type CardBadge,
} from '../../../shared/components/card/rs-card.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import { TransporteService, TransporteCard, TipoVehiculoTransporte } from '../services/transporte.service';
import {
  CatalogBrowseService, FacetasCatalogo, OpcionesBusqueda, PuntoServicio, ZonaBusqueda,
} from '../../verticales/catalog-browse.service';
import {
  RsFiltrosListadoComponent, type FiltrosSeleccionados,
} from '../../../shared/components/filtros-listado/rs-filtros-listado.component';
import { RsMapaBuscadorComponent } from '../../../shared/components/mapa-buscador/rs-mapa-buscador.component';
import { RsMapaComponent, type PuntoMapa, type ZonaMapa } from '../../../shared/components/mapa/rs-mapa.component';
import type { BarraHistograma } from '../../../shared/components/range-slider/rs-range-slider.component';
import { calcularBadgesAutomaticos } from '../../../shared/badges/badges-automaticos';

import { AltoBuscadorDirective } from '../../../shared/directives/alto-buscador.directive';

@Component({
  selector: 'app-transporte-lista',
  standalone: true,
  imports: [
    RsNavbarComponent, RsIconComponent, RsSearchBarComponent,
    AnimateOnScrollDirective, RsCardComponent,
    RsFiltrosListadoComponent, RsMapaBuscadorComponent, RsMapaComponent, AltoBuscadorDirective,
  ],
  template: `
<div class="transporte-page" [class.transporte-page--mapa]="mapaAbierto()">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="transporte-searchbar" rsAltoBuscador>
    <div class="rs-wrap">
      <rs-search-bar variant="strip" [vertical]="ui.key" [buscarAlCambiar]="true" />
    </div>
  </div>

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap transporte-body" [class.transporte-body--mapa]="mapaAbierto()">

      <!-- ── FILTROS ─────────────────────────────────────────── -->
      <aside class="transporte-filtros">
        @if (!mapaAbierto()) {
          <!-- Miniatura con los pines de la búsqueda, igual que en alojamiento.
               El mapa va fuera del botón, no dentro: Leaflet inyecta enlaces y
               anidarlos en un <button> no es marcado válido. -->
          <div class="transporte-mapa-teaser">
            @if (puntosMapa().length > 0) {
              <rs-mapa class="transporte-mapa-teaser__mini" [puntos]="puntosMapa()" [estatico]="true"
                       ariaLabel="Vista previa del mapa de resultados" />
            } @else {
              <span class="transporte-mapa-teaser__vacio"></span>
            }
            <button type="button" class="transporte-mapa-teaser__cta" (click)="alternarMapa()"
                    [attr.aria-expanded]="false">
              <span class="transporte-mapa-teaser__pill">
                <rs-icon name="map-pin" [size]="15" [stroke]="2" /> Ver en el mapa
              </span>
            </button>
          </div>
        }
        <rs-filtros-listado
          [vertical]="ui.key"
          [histograma]="histogramaPrecios()"
          [conteos]="facetas()?.amenities ?? []"
          [conteosValoracion]="facetas()?.valoracion ?? []"
          (cambio)="aplicarFiltros($event)" />
      </aside>

      <!-- ── RESULTADOS ──────────────────────────────────────── -->
      <section class="transporte-resultados">
      <header class="transporte-head">
        <h1>{{ titular }}</h1>
        <p>{{ subtitular }}</p>
      </header>

      @if (cargando()) {
        <div class="rs-result-grid">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="rs-skeleton rs-result-skeleton"></div>
          }
        </div>
      } @else {
        <p class="transporte-count">{{ transportes().length }} servicios de transporte disponibles<span class="transporte-count__ciudad">{{ sufijoCiudad() }}</span></p>
        <div class="rs-result-grid">
          @for (t of transportes(); track t.id) {
            <rs-card rsAnim
              [horizontal]="true"
              [imageUrl]="t.imagen" [imageAlt]="t.nombre"
              [title]="t.nombre" [subtitle]="t.ciudad"
              [badges]="badgesDe(t)"
              [rating]="{ score: t.score, label: t.scoreLabel, count: t.numResenas }"
              [price]="{ amount: 'desde €' + t.tarifaBase, period: '+ €' + t.tarifaKm + '/km' }"
              notaPrecio="IVA incluido"
              [amenities]="serviciosDe(t)"
              [destacados]="incluyeDe(t)"
              [favoritoServicioId]="t.id"
              [routerLink]="['/transporte', t.id]"
              ctaLabel="Ver ficha">
            </rs-card>
          }

          @if (transportes().length === 0 && !error()) {
            <div class="rs-result-empty">
              <rs-icon name="paw" size="48" />
              <h3>No hay transportes para esa búsqueda</h3>
              <p>Prueba con otra ciudad.</p>
            </div>
          }
          @if (error()) {
            <div class="rs-result-empty">
              <rs-icon name="paw" size="48" />
              <h3>No se pudo cargar el catálogo</h3>
              <p>Inténtalo de nuevo en unos momentos.</p>
            </div>
          }
        </div>
      }
      </section>

      <!-- ── MAPA ────────────────────────────────────────────── -->
      @if (mapaAbierto()) {
        <section class="transporte-mapa" #mapaCol aria-label="Buscar en el mapa">
          <rs-mapa-buscador #mapaBuscador
            [puntos]="puntosMapa()"
            [cargando]="cargandoMapa()"
            [total]="transportes().length"
            ariaLabel="Mapa de servicios de transporte"
            (cerrar)="alternarMapa()"
            (zonaBuscada)="buscarEnZona($event)" />
        </section>
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .transporte-page { min-height: 100vh; background: var(--c-base); }
    .transporte-searchbar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--c-card);
      padding-block: var(--sp-5);
      box-shadow: var(--sh-md);
      border-radius: 0 0 var(--r-lg) var(--r-lg);
    }
    /* Misma disposición que el resto de listados: filtros · lista · mapa. */
    .transporte-body {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: var(--sp-8);
      align-items: start;

      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    .transporte-body--mapa {
      grid-template-columns: 240px minmax(360px, 520px) 1fr;
      gap: var(--sp-6);

      .transporte-resultados {
        max-height: calc(100vh - 160px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-right: var(--sp-2);
      }

      @media (max-width: 1280px) { grid-template-columns: minmax(320px, 460px) 1fr; }
      /* En móvil no caben las dos cosas: el mapa se queda con la pantalla. */
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        .transporte-filtros, .transporte-resultados { display: none; }
      }
    }

    .transporte-body--mapa .transporte-filtros { @media (max-width: 1280px) { display: none; } }

    .transporte-filtros {
      position: sticky;
      top: calc(max(var(--alto-navbar), var(--alto-buscador, 192px)) + var(--sp-3));

      /* En una sola columna los filtros van delante de los resultados: fijarlos
         dejaría un panel alto pegado arriba tapando las tarjetas. */
      @media (max-width: 1024px) { position: static; }
    }

    /* Miniatura de mapa sobre los filtros con su CTA superpuesto (PDF §3). */
    .transporte-mapa-teaser {
      position: relative;
      display: block;
      width: 100%;
      height: 130px;
      margin-bottom: var(--sp-4);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      overflow: hidden;
      background: var(--c-raised);
    }

    /* La miniatura es decorativa: el clic lo gestiona el botón superpuesto. */
    .transporte-mapa-teaser__mini { display: block; height: 100%; pointer-events: none; }

    .transporte-mapa-teaser__vacio {
      display: block; height: 100%;
      background: linear-gradient(135deg, var(--c-raised), var(--c-surface));
    }

    /* El botón cubre toda la miniatura para que el objetivo táctil sea la
       tarjeta entera y no solo la pastilla de texto. */
    .transporte-mapa-teaser__cta {
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

      &:hover .transporte-mapa-teaser__pill { background: var(--c-accent-h); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: -2px; }
    }

    .transporte-mapa-teaser__pill {
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

    /* Con el mapa abierto en móvil, el buscador pegajoso se retira: mide
       casi media pantalla y, al quedarse fijo arriba, tapaba la caja
       "Buscar en el mapa" y el botón de cerrar del propio mapa. */
    .transporte-page--mapa .transporte-searchbar {
      @media (max-width: 900px) { display: none; }
    }

    .transporte-mapa {
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

    .transporte-head { margin-bottom: var(--sp-6); }
    .transporte-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .transporte-head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    .transporte-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .transporte-count__ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    /* La tarjeta, la rejilla, el esqueleto y el estado vacío son comunes a
       todos los verticales: .rs-hotel-card, .rs-result-grid,
       .rs-result-skeleton y .rs-result-empty, en styles.scss. */
  `],
})
export class TransporteListaComponent implements OnInit {
  private readonly transporteService = inject(TransporteService);
  private readonly browse = inject(CatalogBrowseService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly ui = verticalUi(VerticalKey.TRANSPORTE);
  readonly titular = titularDeVertical(VerticalKey.TRANSPORTE);
  readonly subtitular = subtitularDeVertical(VerticalKey.TRANSPORTE);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly transportes = signal<TransporteCard[]>([]);

  // ── Filtros, facetas y mapa (mismo esqueleto que el resto de listados) ──
  readonly facetas = signal<FacetasCatalogo | null>(null);
  readonly histogramaPrecios = computed<BarraHistograma[]>(() => this.facetas()?.precios ?? []);
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });

  readonly mapaAbierto = signal(false);
  readonly cargandoMapa = signal(false);
  private readonly puntos = signal<PuntoServicio[]>([]);
  private readonly zona = signal<ZonaBusqueda | null>(null);
  private readonly mapaBuscador = viewChild<RsMapaBuscadorComponent>('mapaBuscador');
  private readonly mapaCol = viewChild<ElementRef<HTMLElement>>('mapaCol');

  readonly puntosMapa = computed<PuntoMapa[]>(() =>
    this.puntos().map((p) => ({
      id: p.id, lat: p.lat, lng: p.lng,
      etiqueta: `€${p.precio}`, titulo: p.titulo, imagen: p.imagen, rating: p.rating,
    })),
  );

  aplicarFiltros(seleccion: FiltrosSeleccionados): void {
    this.filtros.set(seleccion);
    void this.cargar();
  }

  alternarMapa(): void {
    const abierto = !this.mapaAbierto();
    this.mapaAbierto.set(abierto);

    if (!abierto) {
      if (this.zona()) {
        this.zona.set(null);
        void this.cargar();
      }
      return;
    }
    setTimeout(() => {
      this.mapaBuscador()?.refrescar();
      // El mapa se ancla por debajo del buscador, así que recién abierto le
      // asoma el borde inferior por fuera de la ventana y los mandos de "buscar
      // en esta zona" quedan sin verse. Traerlo a la vista evita que el usuario
      // tenga que adivinar que hay que desplazarse.
      this.mapaCol()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  buscarEnZona(zona: ZonaMapa): Promise<void> {
    this.zona.set({
      swLat: zona.swLat, swLng: zona.swLng, neLat: zona.neLat, neLng: zona.neLng,
    });
    return this.cargar();
  }

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  private readonly busqueda = signal<{ ciudad?: string; desde?: string; perros?: string }>({});

  readonly sufijoCiudad = computed(() => {
    const ciudad = this.busqueda().ciudad;
    return ciudad ? ` desde ${ciudad}` : '';
  });

  ngOnInit(): void {
    // La URL manda: cada búsqueda del buscador recarga el listado.
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.busqueda.set({
        ciudad: params['ciudad'] || undefined,
        desde: params['desde'] || undefined,
        perros: params['perros'] || undefined,
      });
      void this.cargar();
    });
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);

    const filtros = this.filtros();
    const zona = this.zona();
    const opciones: OpcionesBusqueda = {
      // Con el mapa acotando la zona la ciudad sobra: el usuario ya ha dicho
      // por dónde quiere buscar arrastrando el mapa hasta ahí.
      ciudad: zona ? undefined : this.busqueda().ciudad,
      zona: zona ?? undefined,
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      ratingMin: filtros.ratingMin,
      amenities: filtros.amenities,
      filtrosVertical: filtros.vertical,
    };

    try {
      // Datos reales del catálogo; nunca mocks (evita ofrecer traslados inexistentes).
      this.transportes.set(await this.transporteService.buscar(opciones));
      void this.cargarFacetas();
      void this.cargarPuntosMapa(opciones);
    } catch {
      this.transportes.set([]);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Contadores del panel; si fallan, los filtros siguen funcionando sin número. */
  private async cargarFacetas(): Promise<void> {
    try {
      this.facetas.set(await this.browse.facetas(VerticalKey.TRANSPORTE, this.busqueda().ciudad));
    } catch {
      this.facetas.set(null);
    }
  }

  /** Pines del mapa; si fallan, la lista sigue siendo perfectamente usable. */
  private async cargarPuntosMapa(opciones: OpcionesBusqueda): Promise<void> {
    this.cargandoMapa.set(true);
    try {
      this.puntos.set(await this.browse.puntosMapa(VerticalKey.TRANSPORTE, opciones));
    } catch {
      this.puntos.set([]);
    } finally {
      this.cargandoMapa.set(false);
    }
  }

  tipoLabel(tipo: TipoVehiculoTransporte): string {
    const map: Record<TipoVehiculoTransporte, string> = {
      van_acondicionada: 'Van acondicionada',
      coche: 'Coche',
      furgon_climatizado: 'Furgón climatizado',
    };
    return map[tipo] ?? tipo;
  }

  /** Icono Lucide del vehículo; sustituye a los emojis de la tarjeta (TCK-8010). */
  private iconoVehiculo(tipo: TipoVehiculoTransporte): string {
    const map: Record<TipoVehiculoTransporte, string> = {
      van_acondicionada: 'truck',
      coche: 'car',
      furgon_climatizado: 'truck',
    };
    return map[tipo] ?? 'car';
  }

  /** Badges de la tarjeta unificada (HU-3.1/HU-3.2): tipo de vehículo + destacado + automáticos. */
  badgesDe(t: TransporteCard): CardBadge[] {
    const badges: CardBadge[] = [
      { icon: this.iconoVehiculo(t.tipoVehiculo), label: this.tipoLabel(t.tipoVehiculo) },
    ];
    if (t.destacado) badges.push({ icon: 'star', label: 'Premium', variant: 'warning' });
    badges.push(...calcularBadgesAutomaticos({
      score: t.score, numResenas: t.numResenas, alphaAdherido: t.alphaAdherido,
    }));
    return badges;
  }

  /** Servicios como etiquetas con icono bajo el título (HU-3.1). */
  serviciosDe(t: TransporteCard): CardAmenity[] {
    const items: CardAmenity[] = [
      { icon: 'paw', label: `Hasta ${t.capacidadPerros} ${t.capacidadPerros === 1 ? 'perro' : 'perros'}` },
    ];
    if (t.zonaCobertura.length) {
      items.push({ icon: 'map-pin', label: `Cubre ${t.zonaCobertura.slice(0, 3).join(', ')}` });
    }
    return items;
  }

  /** Lo que incluye el trayecto, con marca de verificación bajo las etiquetas. */
  incluyeDe(t: TransporteCard): string[] {
    const items: string[] = [];
    if (t.jaulasIncluidas) items.push('Jaulas incluidas');
    if (t.acompananteHumano) items.push('Puedes acompañarlo');
    return items;
  }

}
