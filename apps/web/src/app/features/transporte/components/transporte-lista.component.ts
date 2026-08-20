import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import {
  RsCardComponent, type CardAmenity, type CardBadge,
} from '../../../shared/components/card/rs-card.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import { TransporteService, TransporteCard, TipoVehiculoTransporte } from '../services/transporte.service';
import {
  CatalogBrowseService, FacetasCatalogo, OpcionesBusqueda, OrdenServicios, PuntoServicio, ZonaBusqueda,
} from '../../verticales/catalog-browse.service';
import type { FiltrosSeleccionados } from '../../../shared/components/filtros-listado/rs-filtros-listado.component';
import { RsListadoComponent } from '../../../shared/components/listado/rs-listado.component';
import { RsMapaBuscadorComponent } from '../../../shared/components/mapa-buscador/rs-mapa-buscador.component';
import type { PuntoMapa, ZonaMapa } from '../../../shared/components/mapa/rs-mapa.component';
import type { BarraHistograma } from '../../../shared/components/range-slider/rs-range-slider.component';
import { calcularBadgesAutomaticos } from '../../../shared/badges/badges-automaticos';

import { euros } from '../../../shared/pipes/euros.pipe';
@Component({
  selector: 'app-transporte-lista',
  standalone: true,
  imports: [
    RsNavbarComponent, RsSearchBarComponent, RsListadoComponent,
    AnimateOnScrollDirective, RsCardComponent, RsMapaBuscadorComponent,
  ],
  template: `
<div class="transporte-page">
  <rs-navbar />

  <rs-listado
    [titulo]="titular" [subtitulo]="subtitular"
    [vertical]="ui.key"
    [total]="total()" [mostrados]="transportes().length"
    [cargando]="cargando()" [cargandoMas]="cargandoMas()"
    [error]="error()" [hayMas]="hayMas()"
    [histograma]="histogramaPrecios()"
    [conteos]="facetas()?.amenities ?? []"
    [conteosValoracion]="facetas()?.valoracion ?? []"
    [orden]="orden()"
    [sufijoCiudad]="sufijoCiudad()" [ciudad]="ciudadBuscada()"
    [mapaAbierto]="mapaAbierto()"
    (filtrosCambio)="aplicarFiltros($event)"
    (ordenCambio)="cambiarOrden($event)"
    (verMas)="verMas()"
    (reintentar)="recargar()"
    (mapaAlternado)="alternarMapa()">

    <rs-search-bar listadoBuscador variant="strip" [vertical]="ui.key"
                   [categorias]="false" [buscarAlCambiar]="true" />

    <div listadoResultados class="rs-result-grid">
      @for (t of transportes(); track t.id) {
        <rs-card rsAnim
          [horizontal]="true"
          [imageUrl]="t.imagen" [imageAlt]="t.nombre"
          [title]="t.nombre" [subtitle]="t.ciudad"
          [badges]="badgesDe(t)"
          [rating]="{ score: t.score, label: t.scoreLabel, count: t.numResenas }"
          [price]="{ amount: euros(t.tarifaBase), period: 'trayecto desde' }"
          notaPrecio="IVA incluido"
          [amenities]="serviciosDe(t)"
          [destacados]="incluyeDe(t)"
          [favoritoServicioId]="t.id"
          [routerLink]="['/transporte', t.id]"
          ctaLabel="Ver ficha">
        </rs-card>
      }
    </div>

    @if (mapaAbierto()) {
      <rs-mapa-buscador listadoMapa #mapaBuscador
        [puntos]="puntosMapa()"
        [cargando]="cargandoMapa()"
        [total]="total()"
        ariaLabel="Mapa de servicios de transporte"
        (cerrar)="alternarMapa()"
        (zonaBuscada)="buscarEnZona($event)" />
    }
  </rs-listado>
</div>
  `,
  styles: [`
    :host { display: block; }
    /* Toda la carcasa del listado vive en <rs-listado>; esta categoria no
       necesita nada propio. */
  `],
})
export class TransporteListaComponent implements OnInit {
  /** Formato de los importes; la plantilla lo necesita como miembro. */
  protected readonly euros = euros;

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
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly cargandoMas = signal(false);
  readonly hayMas = computed(() => this.transportes().length < this.total());
  readonly orden = signal<OrdenServicios>('relevancia');

  // ── Filtros, facetas y mapa (mismo esqueleto que el resto de listados) ──
  readonly facetas = signal<FacetasCatalogo | null>(null);
  readonly histogramaPrecios = computed<BarraHistograma[]>(() => this.facetas()?.precios ?? []);
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });

  readonly mapaAbierto = signal(false);
  readonly cargandoMapa = signal(false);
  private readonly puntos = signal<PuntoServicio[]>([]);
  private readonly zona = signal<ZonaBusqueda | null>(null);
  private readonly mapaBuscador = viewChild<RsMapaBuscadorComponent>('mapaBuscador');

  readonly puntosMapa = computed<PuntoMapa[]>(() =>
    this.puntos().map((p) => ({
      id: p.id, lat: p.lat, lng: p.lng,
      etiqueta: euros(p.precio), vertical: VerticalKey.TRANSPORTE,
      titulo: p.titulo, imagen: p.imagen, rating: p.rating,
    })),
  );

  cambiarOrden(valor: string): void {
    this.orden.set(valor as OrdenServicios);
    void this.cargar();
  }

  recargar(): void {
    void this.cargar();
  }

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
    setTimeout(() => this.mapaBuscador()?.refrescar(), 0);
  }

  buscarEnZona(zona: ZonaMapa): Promise<void> {
    this.zona.set({
      swLat: zona.swLat, swLng: zona.swLng, neLat: zona.neLat, neLng: zona.neLng,
    });
    return this.cargar();
  }

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  private readonly busqueda = signal<{ ciudad?: string; desde?: string; perros?: string }>({});

  /** Ciudad buscada; encabeza el resumen plegado del buscador en móvil. */
  readonly ciudadBuscada = computed(() => this.busqueda().ciudad ?? '');

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

    this.pagina.set(1);
    const opciones = this.opcionesActuales();

    try {
      // Datos reales del catálogo; nunca mocks (evita ofrecer traslados inexistentes).
      const res = await this.transporteService.buscarPaginado(opciones);
      this.transportes.set(res.items);
      this.total.set(res.total);
      void this.cargarFacetas();
      void this.cargarPuntosMapa(opciones);
    } catch {
      this.transportes.set([]);
      this.total.set(0);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Parámetros de la búsqueda actual, comunes a la lista y al mapa. */
  private opcionesActuales(): OpcionesBusqueda {
    const filtros = this.filtros();
    const zona = this.zona();
    return {
      // Con el mapa acotando la zona la ciudad sobra: el usuario ya ha dicho
      // por dónde quiere buscar arrastrando el mapa hasta ahí.
      ciudad: zona ? undefined : this.busqueda().ciudad,
      zona: zona ?? undefined,
      orden: this.orden(),
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      ratingMin: filtros.ratingMin,
      amenities: filtros.amenities,
      filtrosVertical: filtros.vertical,
    };
  }

  /** Página siguiente, añadida al final de la lista. */
  async verMas(): Promise<void> {
    if (this.cargandoMas() || !this.hayMas()) return;

    this.cargandoMas.set(true);
    const siguiente = this.pagina() + 1;
    try {
      const res = await this.transporteService.buscarPaginado({
        ...this.opcionesActuales(), page: siguiente,
      });
      const vistos = new Set(this.transportes().map((t) => t.id));
      this.transportes.update((l) => [...l, ...res.items.filter((t) => !vistos.has(t.id))]);
      this.total.set(res.total);
      this.pagina.set(siguiente);
    } catch {
      // Un fallo al ampliar no invalida lo que ya se está viendo.
    } finally {
      this.cargandoMas.set(false);
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
