import { Component, DestroyRef, signal, computed, OnInit, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { RsCardComponent, type CardAmenity } from '../../../shared/components/card/rs-card.component';
import { conIconos } from '../../../shared/catalogos/amenity-iconos';
import type { BarraHistograma } from '../../../shared/components/range-slider/rs-range-slider.component';
import type { PuntoMapa, ZonaMapa } from '../../../shared/components/mapa/rs-mapa.component';
import { RsMapaBuscadorComponent } from '../../../shared/components/mapa-buscador/rs-mapa-buscador.component';
import type { FiltrosSeleccionados } from '../../../shared/components/filtros-listado/rs-filtros-listado.component';
import {
  RsListadoComponent, ORDENES_POR_DEFECTO, type OpcionOrden,
} from '../../../shared/components/listado/rs-listado.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import {
  AlojamientoService, AlojamientoCard, FacetasCatalogo, FiltrosAlojamiento, OrdenServicios,
  PuntoServicio, ZonaBusqueda,
} from '../services/alojamiento.service';
import { calcularBadgesAutomaticos, type BadgeAutomatico } from '../../../shared/badges/badges-automaticos';
import { ExperienciasCercaComponent } from '../../explora/experiencias-cerca.component';

import { euros } from '../../../shared/pipes/euros.pipe';
/** Filtros comunes de búsqueda, tal y como llegan en la URL. */
interface BusquedaUrl {
  ciudad?: string;
  desde?: string;
  hasta?: string;
  perros?: number;
}

@Component({
  selector: 'app-alojamiento-lista',
  standalone: true,
  imports: [
    RsNavbarComponent, RsIconComponent, RsSearchBarComponent, RsListadoComponent,
    AnimateOnScrollDirective, RsCardComponent,
    ExperienciasCercaComponent, RsMapaBuscadorComponent,
  ],
  template: `
<div class="alojamiento-page">
  <rs-navbar />

  <rs-listado
    [titulo]="titular" [subtitulo]="subtitular"
    [vertical]="ui.key"
    [total]="totalItems()" [mostrados]="alojamientos().length"
    [cargando]="cargando()" [cargandoMas]="cargandoMas()"
    [error]="error()" [hayMas]="hayMas()"
    [histograma]="histogramaPrecios()"
    [conteos]="facetas()?.amenities ?? []"
    [conteosValoracion]="facetas()?.valoracion ?? []"
    [orden]="ordenamiento()" [ordenes]="ORDENES"
    [sufijoCiudad]="sufijoCiudad()" [ciudad]="busquedaCiudad() ?? ''"
    [mapaAbierto]="mapaAbierto()"
    (filtrosCambio)="aplicarFiltros($event)"
    (ordenCambio)="cambiarOrden($event)"
    (verMas)="verMas()"
    (reintentar)="cargarAlojamientos()"
    (mapaAlternado)="alternarMapa()">

    <rs-search-bar listadoBuscador variant="strip" [vertical]="ui.key"
                   [categorias]="false" [buscarAlCambiar]="true" />

    @if (avisoUbicacion()) {
      <p listadoAntes class="al-geo">
        <rs-icon name="navigation" [size]="13" [stroke]="2" /> {{ avisoUbicacion() }}
      </p>
    }

    <div listadoResultados class="rs-result-grid">
      @for (a of alojamientos(); track a.id) {
        <rs-card rsAnim
          [id]="'card-' + a.id"
          [class.card--destacada]="destacadoId() === a.id"
          [horizontal]="true"
          [imageUrl]="a.imagenes[0]" [imageAlt]="a.nombre"
          [title]="a.nombre" [subtitle]="a.barrio ? a.barrio + ', ' + a.ciudad : a.ciudad"
          [badges]="badgesDe(a)"
          [rating]="{ score: a.score, label: a.scoreLabel, count: a.numResenas }"
          [price]="{ amount: euros(a.precioPorNoche), period: 'noche desde', oldAmount: a.precioAnterior ? euros(a.precioAnterior) : undefined }"
          notaPrecio="IVA incluido"
          [amenities]="serviciosDe(a)"
          [destacados]="incluyeDe(a)"
          [favoritoServicioId]="a.id"
          [routerLink]="['/alojamiento', a.id]"
          [queryParams]="queryParamsDetalle()"
          ctaLabel="Ver disponibilidad">
        </rs-card>
      }
    </div>

    @if (!mapaAbierto()) {
      <app-experiencias-cerca listadoDespues [ciudad]="busquedaCiudad()" />
    }

    @if (mapaAbierto()) {
      <rs-mapa-buscador listadoMapa #mapaBuscador
        [puntos]="puntosMapa()"
        [activo]="destacadoId()"
        [cargando]="cargandoMapa()"
        [total]="totalItems()"
        ariaLabel="Mapa de alojamientos caninos encontrados"
        (cerrar)="alternarMapa()"
        (puntoElegido)="destacarDesdeMapa($event)"
        (zonaBuscada)="buscarEnZona($event)" />
    }
  </rs-listado>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* Aviso de desde dónde se mide la distancia al ordenar por cercanía. */
    .al-geo {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-bottom: var(--sp-4);
      font-size: var(--f-xs); color: var(--t-400);
    }

    /* Tarjeta señalada al pulsar su pin en el mapa. */
    .card--destacada { outline: 2px solid var(--dk-gold); outline-offset: 2px; border-radius: var(--r-xl); }

    /* La carcasa del listado vive en <rs-listado>. */
  `],
})
export class AlojamientoListaComponent implements OnInit {
  /** Formato de los importes; la plantilla lo necesita como miembro. */
  protected readonly euros = euros;

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alojamientoService = inject(AlojamientoService);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly alojamientos = signal<AlojamientoCard[]>([]);
  readonly paginaActual = signal(1);
  readonly totalPaginas = signal(1);
  readonly cargandoMas = signal(false);
  readonly hayMas = computed(() => this.alojamientos().length < this.totalItems());

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
      etiqueta: euros(p.precio),
      vertical: VerticalKey.ALOJAMIENTO,
      titulo: p.titulo,
      imagen: p.imagen,
      rating: p.rating,
    })),
  );

  /** Zona del mapa por la que se está filtrando; null = búsqueda por ciudad. */
  private readonly zona = signal<ZonaBusqueda | null>(null);

  private readonly mapaBuscador = viewChild<RsMapaBuscadorComponent>('mapaBuscador');

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
    setTimeout(() => this.mapaBuscador()?.refrescar(), 0);
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
    // `amenities` lo rellena el comercio y en la practica llega vacio casi
    // siempre, asi que estas tarjetas se quedaban sin la fila de servicios que
    // si tenian las de las demas categorias. Cuando falta, se describe el
    // alojamiento con lo que si es dato seguro.
    if (a.amenities.length) return conIconos(a.amenities);

    const respaldo: CardAmenity[] = [];
    if (a.espaciosDisponibles > 0) {
      respaldo.push({
        icon: 'paw',
        label: `${a.espaciosDisponibles} ${a.espaciosDisponibles === 1 ? 'plaza libre' : 'plazas libres'}`,
      });
    }
    respaldo.push({ icon: 'home', label: 'Estancia con pernocta' });
    return respaldo;
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

  readonly sufijoCiudad = computed(() => {
    const ciudad = this.busqueda().ciudad;
    return ciudad ? ` en ${ciudad}` : '';
  });

  readonly ui = verticalUi(VerticalKey.ALOJAMIENTO);

  /** Copy de marca de la categoría, igual que en el resto de listados. */
  readonly titular = titularDeVertical(VerticalKey.ALOJAMIENTO);
  readonly subtitular = subtitularDeVertical(VerticalKey.ALOJAMIENTO);

  /**
   * Mascota elegida en el buscador (`perroIds` de la URL). Antes el listado
   * repetia el selector en un `<select>` propio junto a la barra de busqueda:
   * dos controles para lo mismo, y solo en esta categoria.
   */
  readonly perroId = signal('');

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  private readonly busqueda = signal<BusquedaUrl>({});

  /** Ciudad buscada; la consume el carrusel de experiencias de la comunidad. */
  readonly busquedaCiudad = computed(() => this.busqueda().ciudad);

  /** Lo marcado en el panel común de filtros (`rs-filtros-listado`). */
  private readonly filtros = signal<FiltrosSeleccionados>({ vertical: {} });
  readonly ordenamiento = signal<OrdenServicios>('relevancia');

  /**
   * Alojamiento es el unico listado que sabe situar al usuario (coordenadas de
   * la poblacion elegida o GPS), asi que es el unico que puede ofrecer el orden
   * por cercania sin pedir permisos a destiempo.
   */
  readonly ORDENES: readonly OpcionOrden[] = [
    ...ORDENES_POR_DEFECTO,
    { valor: 'distancia', etiqueta: 'Más cercanos' },
  ];

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
      this.perroId.set(primerPerro ?? '');

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

  }

  async cargarAlojamientos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const filtros = this.filtrosDeBusqueda(this.paginaActual());
      const zona = this.zona();
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

  /** Parametros de la busqueda actual; la lista, el mapa y "Ver mas" piden lo mismo. */
  private filtrosDeBusqueda(page: number): FiltrosAlojamiento {
    const busqueda = this.busqueda();
    const zona = this.zona();
    const seleccion = this.filtros();
    return {
      // Con el mapa acotando la zona, la ciudad sobra: el usuario ya ha dicho
      // por dónde quiere buscar arrastrando el mapa hasta ahí.
      ciudad:   zona ? undefined : busqueda.ciudad,
      zona:     zona ?? undefined,
      desde:    busqueda.desde,
      hasta:    busqueda.hasta,
      perros:   busqueda.perros,
      perroId:  this.perroId() || undefined,
      precioMin: seleccion.precioMin,
      precioMax: seleccion.precioMax,
      ratingMin: seleccion.ratingMin,
      amenities: seleccion.amenities,
      filtrosVertical: seleccion.vertical,
      orden: this.ordenamiento(),
      lat: this.coordenadas()?.lat,
      lng: this.coordenadas()?.lng,
      page,
      limit: 10,
    };
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
  async cambiarOrden(valor: string): Promise<void> {
    this.ordenamiento.set(valor as OrdenServicios);

    if (valor !== 'distancia') {
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

  /**
   * Pagina siguiente, anadida al final de la lista. Antes eran botones de
   * "Anterior/Siguiente" que ademas dejaban el scroll a media pagina: el resto
   * de listados ampliaba la lista sin moverse del sitio.
   */
  async verMas(): Promise<void> {
    if (this.cargandoMas() || !this.hayMas()) return;

    this.cargandoMas.set(true);
    const siguiente = this.paginaActual() + 1;
    try {
      const res = await this.alojamientoService.buscar(this.filtrosDeBusqueda(siguiente));
      const vistos = new Set(this.alojamientos().map((a) => a.id));
      this.alojamientos.update((l) => [...l, ...res.items.filter((a) => !vistos.has(a.id))]);
      this.totalItems.set(res.total);
      this.totalPaginas.set(res.totalPages);
      this.paginaActual.set(siguiente);
    } catch {
      // Un fallo al ampliar no invalida lo que ya se esta viendo.
    } finally {
      this.cargandoMas.set(false);
    }
  }

  /** Propaga fechas/perros buscados al detalle, para no pedirlos de nuevo antes de reservar. */
  queryParamsDetalle(): Record<string, string> {
    const { desde, hasta, perros } = this.busqueda();
    const perroId = this.perroId();
    const params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;
    if (perros) params['perros'] = String(perros);
    if (perroId) params['perroId'] = perroId;
    return params;
  }

}
