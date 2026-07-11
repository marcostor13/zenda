import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AlojamientoService, AlojamientoCard, FiltrosAlojamiento } from '../services/alojamiento.service';

@Component({
  selector: 'app-alojamiento-lista',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, RsNavbarComponent, RsIconComponent, AnimateOnScrollDirective, ImgFallbackDirective],
  template: `
<div class="alojamiento-page">
  <rs-navbar />

  <!-- Barra de búsqueda refinada -->
  <div class="search-bar-strip">
    <div class="rs-wrap">
      <form [formGroup]="searchForm" (ngSubmit)="aplicarBusqueda()" class="search-bar-strip__form">
        <div class="rs-field">
          <input formControlName="ciudad" class="rs-inp" placeholder="Ciudad o zona" />
        </div>
        <div class="rs-field">
          <input formControlName="desde" type="date" class="rs-inp" />
        </div>
        <div class="rs-field">
          <input formControlName="hasta" type="date" class="rs-inp" />
        </div>
        <div class="rs-field">
          <select formControlName="perros" class="rs-inp">
            <option value="1">1 perro</option>
            <option value="2">2 perros</option>
            <option value="3">3 perros</option>
            <option value="4">4+ perros</option>
          </select>
        </div>
        <button type="submit" class="rs-btn rs-btn--gold">Buscar</button>
      </form>
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
        <div class="filter-checks">
          @for (sc of ratingOpciones; track sc.valor) {
            <label class="filter-check">
              <input type="radio" name="rating" [value]="sc.valor" [(ngModel)]="ratingMinimo" />
              <span class="filter-stars">{{ sc.estrellas }}</span>
              <span><strong>{{ sc.label }}</strong></span>
            </label>
          }
        </div>
      </div>

      <!-- Servicios caninos -->
      <div class="filter-group">
        <h4>Servicios</h4>
        <div class="filter-checks">
          @for (a of amenitiesOpciones; track a) {
            <label class="filter-check">
              <input type="checkbox" [checked]="amenitiesSelec().includes(a)"
                     (change)="toggleAmenity(a)" />
              <span>{{ a }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Extras -->
      <div class="filter-group">
        <label class="filter-check filter-check--toggle">
          <input type="checkbox" [(ngModel)]="soloCancelacionGratis" />
          <span>Solo cancelación gratis</span>
        </label>
        <label class="filter-check filter-check--toggle">
          <input type="checkbox" [(ngModel)]="soloPaseos" />
          <span>Paseos incluidos</span>
        </label>
      </div>

      <button class="rs-btn rs-btn--primary rs-btn--block" (click)="aplicarFiltros()">
        Aplicar filtros
      </button>
    </aside>

    <!-- ── RESULTADOS ──────────────────────────────────────── -->
    <section class="results-col">
      <div class="results-header">
        <div>
          <h1 class="results-header__title">
            {{ cargando() ? 'Buscando…' : 'Alojamiento canino' }}
          </h1>
          <p class="results-header__sub">
            @if (!cargando()) { <span class="results-header__count">{{ totalLabel() }}</span> · }
            Precios en euros (€) · IVA incluido
          </p>
        </div>
        <div class="results-header__sort">
          <select [(ngModel)]="ordenamiento" class="rs-inp" style="width:auto"
                  (change)="aplicarFiltros()">
            <option value="relevancia">Relevancia</option>
            <option value="precio_asc">Precio: menor a mayor</option>
            <option value="precio_desc">Precio: mayor a menor</option>
            <option value="score">Mejor valorados</option>
            <option value="resenas">Más reseñas</option>
          </select>
        </div>
      </div>

      <!-- Skeleton loading -->
      @if (cargando()) {
        <div class="results-list">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="aloja-card">
              <div class="rs-skeleton rs-skeleton--img" style="width:280px;flex-shrink:0;border-radius:var(--r-xl)"></div>
              <div class="aloja-card__body" style="flex:1;display:flex;flex-direction:column;gap:var(--sp-3)">
                <div class="rs-skeleton rs-skeleton--title"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:40%"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:60%"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:30%;margin-top:auto"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Lista de alojamientos -->
      @if (!cargando()) {
        <div class="results-list">
          @for (a of alojamientos(); track a.id) {
            <a [routerLink]="['/alojamiento', a.id]" class="aloja-card"
               [class.aloja-card--premium]="a.destacado" rsAnim>
              <!-- Imagen -->
              <div class="aloja-card__imgs">
                <img [src]="a.imagenes[0]" [alt]="a.nombre" loading="lazy" rsImg />
                @if (a.destacado) {
                  <span class="premium-badge">★ Premium</span>
                }
                @if (a.descuentoPct) {
                  <span class="rs-badge rs-badge--success" style="position:absolute;top:var(--sp-3);right:var(--sp-3)">
                    -{{ a.descuentoPct }}%
                  </span>
                }
              </div>

              <!-- Info -->
              <div class="aloja-card__body">
                <h3 class="aloja-card__name">{{ a.nombre }}</h3>
                <div class="aloja-card__rating">
                  <span class="aloja-card__stars">{{ estrellas(a.score) }}</span>
                  <strong>{{ a.score }}</strong>
                  <span class="aloja-card__reviews">({{ a.numResenas }} reseñas)</span>
                  <span class="aloja-card__loc">· {{ a.barrio }}, {{ a.ciudad }}</span>
                </div>
                @if (a.descripcion) {
                  <p class="aloja-card__desc">{{ a.descripcion }}</p>
                }

                <div class="aloja-card__amenities">
                  @for (am of a.amenities.slice(0,4); track am) {
                    <span class="rs-amenity">{{ am }}</span>
                  }
                </div>

                <div class="aloja-card__tags">
                  @if (a.cancelacionGratis) {
                    <span class="tag-green">✓ Cancelación gratis</span>
                  }
                  @if (a.paseosIncluidos) {
                    <span class="tag-green">✓ Paseos diarios incluidos</span>
                  }
                  @if (a.espaciosDisponibles <= 3 && a.espaciosDisponibles > 0) {
                    <span class="tag-amber">⚡ Solo {{ a.espaciosDisponibles }} espacios disponibles</span>
                  }
                </div>
              </div>

              <!-- Precio + CTA -->
              <div class="aloja-card__price">
                <div class="aloja-card__price-box">
                  @if (a.precioAnterior) {
                    <div class="rs-price__old">€{{ a.precioAnterior }}</div>
                  }
                  <div class="aloja-card__amount">€{{ a.precioPorNoche }}</div>
                  <div class="aloja-card__period">/ noche</div>
                  <div class="aloja-card__taxes">IVA incluido</div>
                </div>
                <button class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)"
                        (click)="$event.preventDefault(); verDetalle(a.id)">
                  Ver disponibilidad
                </button>
              </div>
            </a>
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
    </section>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .alojamiento-page { min-height: 100vh; background: var(--c-base); }

    .search-bar-strip {
      background: var(--c-raised);
      border-bottom: 1px solid var(--b-1);
      padding: var(--sp-4) 0;
      position: sticky;
      top: 64px;
      z-index: 50;
    }

    .search-bar-strip__form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr auto;
      gap: var(--sp-3);
      align-items: end;

      @media (max-width: 768px) { grid-template-columns: 1fr; }
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

    .filter-checks { display: flex; flex-direction: column; gap: var(--sp-3); }

    .filter-check {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--f-sm);
      color: var(--t-300);
      cursor: pointer;

      input[type="checkbox"], input[type="radio"] { accent-color: var(--c-accent); }
    }
    .filter-check--toggle { justify-content: space-between; }
    .filter-stars { color: var(--dk-gold); letter-spacing: 1px; }

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

    .results-header__title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue); }
    .results-header__sub { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .results-header__count { color: var(--t-200); font-weight: var(--w-6); }

    .results-list { display: flex; flex-direction: column; gap: var(--sp-4); }

    /* ALOJAMIENTO ROW CARD — blanca horizontal, imagen izquierda */
    .aloja-card {
      display: grid;
      grid-template-columns: 280px 1fr 200px;
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      overflow: hidden;
      text-decoration: none;
      transition: all var(--d-3);
      cursor: pointer;

      &:hover {
        border-color: var(--b-2);
        box-shadow: var(--sh-lg);
        transform: translateY(-2px);

        .aloja-card__imgs img { transform: scale(1.05); }
      }

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    /* Card destacada: barra superior dorada de 4px */
    .aloja-card--premium { border-top: 4px solid var(--dk-gold); }

    .premium-badge {
      position: absolute;
      top: var(--sp-3);
      left: var(--sp-3);
      background: var(--dk-gold);
      color: var(--dk-blue-deep);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      padding: var(--sp-1) var(--sp-3);
      border-radius: var(--r-md);
    }

    .aloja-card__imgs {
      position: relative;
      overflow: hidden;
      min-height: 200px;

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
    }

    .aloja-card__body { padding: var(--sp-5); }
    .aloja-card__name { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-2); line-height: 1.3; }

    .aloja-card__rating {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: var(--f-sm);
      color: var(--t-200);
      margin-bottom: var(--sp-3);
      flex-wrap: wrap;
    }
    .aloja-card__stars   { color: var(--dk-gold); letter-spacing: 1px; }
    .aloja-card__reviews { color: var(--t-400); font-size: var(--f-xs); }
    .aloja-card__loc     { color: var(--t-400); font-size: var(--f-xs); }

    .aloja-card__desc {
      font-size: var(--f-sm);
      color: var(--t-300);
      margin-bottom: var(--sp-4);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .aloja-card__amenities { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }

    .aloja-card__tags { display: flex; flex-direction: column; gap: var(--sp-2); }

    .tag-green { font-size: var(--f-xs); color: var(--c-success); }
    .tag-amber { font-size: var(--f-xs); color: var(--dk-gold); }

    .aloja-card__price {
      padding: var(--sp-5);
      border-left: 1px solid var(--b-1);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--sp-4);

      @media (max-width: 768px) { border-left: none; border-top: 1px solid var(--b-1); }
    }

    .aloja-card__price-box { text-align: right; }
    .aloja-card__amount { font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--dk-blue); letter-spacing: -.03em; }
    .aloja-card__period { font-size: var(--f-sm); color: var(--t-400); }
    .aloja-card__taxes { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

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
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly alojamientoService = inject(AlojamientoService);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly alojamientos = signal<AlojamientoCard[]>([]);
  readonly paginaActual = signal(1);
  readonly totalPaginas = signal(1);
  readonly totalItems = signal(0);

  readonly totalLabel = computed(() =>
    `${this.totalItems()} espacios encontrados`
  );

  readonly searchForm = this.fb.group({
    ciudad: [''], desde: [''], hasta: [''], perros: [1],
  });

  /* Filtros locales */
  precioMin = 0;
  precioMax = 500;
  ratingMinimo = 0;
  amenitiesSelec = signal<string[]>([]);
  soloCancelacionGratis = false;
  soloPaseos = false;
  ordenamiento = 'relevancia';

  readonly ratingOpciones = [
    { valor: 5,   estrellas: '★★★★★', label: '5.0' },
    { valor: 4,   estrellas: '★★★★☆', label: '4.0+' },
    { valor: 3,   estrellas: '★★★☆☆', label: '3.0+' },
  ];

  readonly amenitiesOpciones = ['Piscina', 'Jardín', 'Cuidado 24/7', 'Veterinario de guardia', 'Cámaras 24h', 'Paseos diarios'];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['ciudad'])  this.searchForm.patchValue({ ciudad: params['ciudad'] });
      if (params['desde'])   this.searchForm.patchValue({ desde: params['desde'] });
      if (params['hasta'])   this.searchForm.patchValue({ hasta: params['hasta'] });
      this.cargarAlojamientos();
    });
  }

  async cargarAlojamientos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const form = this.searchForm.value;
      const filtros: FiltrosAlojamiento = {
        ciudad:   form.ciudad   ?? undefined,
        desde:    form.desde    ?? undefined,
        hasta:    form.hasta    ?? undefined,
        perros:   form.perros   ?? undefined,
        precioMin: this.precioMin || undefined,
        precioMax: this.precioMax < 500 ? this.precioMax : undefined,
        ratingMin: this.ratingMinimo || undefined,
        cancelacionGratis: this.soloCancelacionGratis || undefined,
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

  aplicarBusqueda(): void { this.paginaActual.set(1); this.cargarAlojamientos(); }
  aplicarFiltros(): void  { this.paginaActual.set(1); this.cargarAlojamientos(); }

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
  verDetalle(id: string): void { void this.router.navigate(['/alojamiento', id]); }

  /** Estrellas doradas a partir del score (escala 0–5). */
  estrellas(score: number): string {
    const llenas = Math.round(Math.min(score, 5));
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

}
