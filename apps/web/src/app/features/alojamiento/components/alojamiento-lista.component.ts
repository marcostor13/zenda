import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { RsCardComponent } from '../../../shared/components/card/rs-card.component';
import { RsChipComponent } from '../../../shared/components/chip/rs-chip.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import {
  AlojamientoService, AlojamientoCard, FiltrosAlojamiento, OrdenServicios,
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

@Component({
  selector: 'app-alojamiento-lista',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, RsNavbarComponent, RsIconComponent,
    RsSearchBarComponent, AnimateOnScrollDirective, RsCardComponent, RsChipComponent,
    ExperienciasCercaComponent,
  ],
  template: `
<div class="alojamiento-page">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="search-bar-strip">
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

  <div class="rs-wrap alojamiento-body">

    <!-- ── SIDEBAR ─────────────────────────────────────────── -->
    <aside class="filters-sidebar">
      <div class="filters-sidebar__header">
        <h3>Filtros</h3>
        <button class="rs-btn rs-btn--ghost rs-btn--xs" (click)="limpiarFiltros()">Limpiar</button>
      </div>

      <!-- Precio -->
      <div class="filter-group">
        <h4>Precio por noche</h4>
        <div class="price-range">
          <div class="rs-field">
            <label class="rs-lbl">Mínimo</label>
            <input type="number" [(ngModel)]="precioMin" class="rs-inp" placeholder="Min €" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Máximo</label>
            <input type="number" [(ngModel)]="precioMax" class="rs-inp" placeholder="Max €" />
          </div>
        </div>
      </div>

      <!-- Rating -->
      <div class="filter-group">
        <h4>Valoración</h4>
        <div class="filter-chips">
          @for (sc of ratingOpciones; track sc.valor) {
            <rs-chip [active]="ratingMinimo === sc.valor" (chipClick)="ratingMinimo = sc.valor">
              {{ sc.estrellas }} {{ sc.label }}
            </rs-chip>
          }
        </div>
      </div>

      <!-- Servicios caninos -->
      <div class="filter-group">
        <h4>Servicios</h4>
        <div class="filter-chips">
          @for (a of amenitiesOpciones; track a) {
            <rs-chip [active]="amenitiesSelec().includes(a)" (chipClick)="toggleAmenity(a)">{{ a }}</rs-chip>
          }
        </div>
      </div>

      <!-- Extras -->
      <div class="filter-group">
        <h4>Extras</h4>
        <div class="filter-chips">
          <rs-chip [active]="soloCancelacionGratis" (chipClick)="soloCancelacionGratis = !soloCancelacionGratis">
            ✓ Cancelación gratis
          </rs-chip>
          <rs-chip [active]="soloPaseos" (chipClick)="soloPaseos = !soloPaseos">
            🐾 Paseos incluidos
          </rs-chip>
        </div>
      </div>

      <button class="rs-btn rs-btn--primary rs-btn--block" (click)="aplicarFiltros()">
        Aplicar filtros
      </button>
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
        <div class="results-list">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:340px;border-radius:var(--r-xl)"></div>
          }
        </div>
      }

      <!-- Lista de alojamientos -->
      @if (!cargando()) {
        <div class="results-list">
          @for (a of alojamientos(); track a.id) {
            <rs-card rsAnim
              [imageUrl]="a.imagenes[0]" [imageAlt]="a.nombre"
              [title]="a.nombre" [subtitle]="a.barrio + ', ' + a.ciudad"
              [badges]="badgesDe(a)"
              [rating]="{ score: a.score, label: a.scoreLabel, count: a.numResenas }"
              [price]="{ amount: '€' + a.precioPorNoche, period: '/ noche', oldAmount: a.precioAnterior ? '€' + a.precioAnterior : undefined }"
              [amenities]="serviciosDe(a)"
              [favoritoServicioId]="a.id"
              [routerLink]="['/alojamiento', a.id]"
              [queryParams]="queryParamsDetalle()"
              ctaLabel="Ver disponibilidad">
            </rs-card>
          }

          @if (!cargando() && alojamientos().length === 0 && !error()) {
            <div class="empty-state">
              <rs-icon name="paw" size="56" />
              <h3>No encontramos alojamientos caninos</h3>
              <p>Prueba cambiando los filtros o la ciudad.</p>
              <button class="rs-btn rs-btn--secondary" style="margin-top:var(--sp-6)"
                      (click)="limpiarFiltros()">Limpiar filtros</button>
            </div>
          }
          @if (!cargando() && error()) {
            <div class="empty-state">
              <rs-icon name="paw" size="56" />
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

      <app-experiencias-cerca [ciudad]="busquedaCiudad()" />
    </section>
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

    /* SIDEBAR */
    .filters-sidebar {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-6);
      position: sticky;
      top: 140px;
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

    /* La tarjeta (imagen 70-75%, badges, rating, precio) la aporta <rs-card>
       en modo "resultado" (HU-3.1) — ver rs-card.component.ts. */
    .results-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      align-items: stretch;
      gap: var(--sp-5);

      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    /* EMPTY STATE */
    .empty-state {
      text-align: center;
      padding: var(--sp-20) var(--sp-8);
      color: var(--t-400);

      rs-icon { color: var(--dk-gold); }
      h3 { font-size: var(--f-xl); color: var(--t-200); margin-block: var(--sp-4); }
    }

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
  private readonly fb = inject(FormBuilder);
  private readonly alojamientoService = inject(AlojamientoService);
  private readonly perrosService = inject(PerrosService);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly alojamientos = signal<AlojamientoCard[]>([]);
  readonly paginaActual = signal(1);
  readonly totalPaginas = signal(1);

  /** Badges de la tarjeta unificada (HU-3.1/HU-0.9): destacado, descuento, y automáticos por datos reales. */
  badgesDe(a: AlojamientoCard): BadgeAutomatico[] {
    const badges: BadgeAutomatico[] = [];
    if (a.destacado) badges.push({ icon: '★', label: 'Premium', variant: 'warning' });
    if (a.descuentoPct) badges.push({ icon: '', label: `-${a.descuentoPct}%`, variant: 'success' });
    badges.push(...calcularBadgesAutomaticos({
      score: a.score, numResenas: a.numResenas, plazasRestantes: a.espaciosDisponibles,
    }));
    return badges;
  }

  /** Servicios como iconos en una línea bajo la foto (HU-3.1). */
  serviciosDe(a: AlojamientoCard): string[] {
    const items = a.amenities.slice(0, 3);
    if (a.cancelacionGratis) items.push('✓ Cancelación gratis');
    if (a.paseosIncluidos) items.push('✓ Paseos incluidos');
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

  /* Filtros locales */
  precioMin = 0;
  precioMax = 500;
  ratingMinimo = 0;
  amenitiesSelec = signal<string[]>([]);
  soloCancelacionGratis = false;
  soloPaseos = false;
  ordenamiento: OrdenServicios = 'relevancia';

  /** Punto de referencia para el orden por distancia. */
  private readonly coordenadas = signal<{ lat: number; lng: number } | null>(null);
  /** De dónde salió ese punto: la ciudad buscada o el GPS del dispositivo. */
  private readonly origenUbicacion = signal<'ciudad' | 'dispositivo' | null>(null);
  readonly avisoUbicacion = signal('');

  readonly ratingOpciones = [
    { valor: 5,   estrellas: '★★★★★', label: '5.0' },
    { valor: 4,   estrellas: '★★★★☆', label: '4.0+' },
    { valor: 3,   estrellas: '★★★☆☆', label: '3.0+' },
  ];

  readonly amenitiesOpciones = ['Piscina', 'Jardín', 'Cuidado 24/7', 'Veterinario de guardia', 'Cámaras 24h', 'Paseos diarios'];

  ngOnInit(): void {
    // La URL manda: cada búsqueda del buscador recarga el listado.
    this.route.queryParams.subscribe(params => {
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
      const filtros: FiltrosAlojamiento = {
        ciudad:   busqueda.ciudad,
        desde:    busqueda.desde,
        hasta:    busqueda.hasta,
        perros:   busqueda.perros,
        perroId:  this.searchForm.value.perroId || undefined,
        precioMin: this.precioMin || undefined,
        precioMax: this.precioMax < 500 ? this.precioMax : undefined,
        ratingMin: this.ratingMinimo || undefined,
        cancelacionGratis: this.soloCancelacionGratis || undefined,
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

  aplicarFiltros(): void { this.paginaActual.set(1); this.cargarAlojamientos(); }

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

  limpiarFiltros(): void {
    this.precioMin = 0; this.precioMax = 500;
    this.amenitiesSelec.set([]);
    this.soloCancelacionGratis = false; this.soloPaseos = false;
    this.ratingMinimo = 0;
    this.aplicarFiltros();
  }

  toggleAmenity(a: string): void {
    this.amenitiesSelec.update(list =>
      list.includes(a) ? list.filter(x => x !== a) : [...list, a]
    );
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
