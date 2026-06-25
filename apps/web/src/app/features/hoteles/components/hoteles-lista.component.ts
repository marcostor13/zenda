import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../../shared/media/images';
import { HotelesService, HotelCard, FiltrosHotel } from '../services/hoteles.service';

@Component({
  selector: 'app-hoteles-lista',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, RsNavbarComponent, AnimateOnScrollDirective, ImgFallbackDirective],
  template: `
<div class="hoteles-page">
  <rs-navbar />

  <!-- Barra de búsqueda refinada -->
  <div class="search-bar-strip">
    <div class="rs-wrap">
      <form [formGroup]="searchForm" (ngSubmit)="aplicarBusqueda()" class="search-bar-strip__form">
        <div class="rs-field">
          <input formControlName="ciudad" class="rs-inp" placeholder="🏙️ Ciudad o zona" />
        </div>
        <div class="rs-field">
          <input formControlName="desde" type="date" class="rs-inp" />
        </div>
        <div class="rs-field">
          <input formControlName="hasta" type="date" class="rs-inp" />
        </div>
        <div class="rs-field">
          <select formControlName="huespedes" class="rs-inp">
            <option value="1">1 huésped</option>
            <option value="2">2 huéspedes</option>
            <option value="3">3 huéspedes</option>
            <option value="4">4+ huéspedes</option>
          </select>
        </div>
        <button type="submit" class="rs-btn rs-btn--primary">Buscar</button>
      </form>
    </div>
  </div>

  <div class="rs-wrap hoteles-body">

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
            <input type="number" [(ngModel)]="precioMin" class="rs-inp" placeholder="€0" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Máximo</label>
            <input type="number" [(ngModel)]="precioMax" class="rs-inp" placeholder="€2000" />
          </div>
        </div>
      </div>

      <!-- Estrellas -->
      <div class="filter-group">
        <h4>Categoría</h4>
        <div class="filter-checks">
          @for (s of [5,4,3,2,1]; track s) {
            <label class="filter-check">
              <input type="checkbox" [checked]="estrellasSelec().includes(s)"
                     (change)="toggleEstrellas(s)" />
              <span>{{ '★'.repeat(s) }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Score mínimo -->
      <div class="filter-group">
        <h4>Valoración mínima</h4>
        <div class="filter-checks">
          @for (sc of scoreOpciones; track sc.valor) {
            <label class="filter-check">
              <input type="radio" name="score" [value]="sc.valor" [(ngModel)]="scoreMinimo" />
              <span><strong>{{ sc.valor }}+</strong> {{ sc.label }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Servicios -->
      <div class="filter-group">
        <h4>Servicios incluidos</h4>
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

      <!-- Cancelación -->
      <div class="filter-group">
        <label class="filter-check filter-check--toggle">
          <input type="checkbox" [(ngModel)]="soloCancelacionGratis" />
          <span>Solo cancelación gratis</span>
        </label>
        <label class="filter-check filter-check--toggle">
          <input type="checkbox" [(ngModel)]="soloDesayuno" />
          <span>Desayuno incluido</span>
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
            {{ cargando() ? 'Buscando…' : totalLabel() }}
          </h1>
          <p class="results-header__sub">Precios en euros (€) · IVA incluido</p>
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
            <div class="hotel-row-card">
              <div class="rs-skeleton rs-skeleton--img" style="width:280px;flex-shrink:0;border-radius:var(--r-xl)"></div>
              <div class="hotel-row-card__body" style="flex:1;display:flex;flex-direction:column;gap:var(--sp-3)">
                <div class="rs-skeleton rs-skeleton--title"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:40%"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:60%"></div>
                <div class="rs-skeleton rs-skeleton--text" style="width:30%;margin-top:auto"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Lista de hoteles -->
      @if (!cargando()) {
        <div class="results-list">
          @for (h of hoteles(); track h.id) {
            <a [routerLink]="['/hoteles', h.id]" class="hotel-row-card" rsAnim>
              <!-- Imagen -->
              <div class="hotel-row-card__imgs">
                <img [src]="h.imagenes[0]" [alt]="h.nombre" loading="lazy" rsImg />
                @if (h.destacado) {
                  <span class="rs-badge rs-badge--warning" style="position:absolute;top:var(--sp-3);left:var(--sp-3)">
                    ⭐ Destacado
                  </span>
                }
                @if (h.descuentoPct) {
                  <span class="rs-badge rs-badge--success" style="position:absolute;top:var(--sp-3);right:var(--sp-3)">
                    -{{ h.descuentoPct }}%
                  </span>
                }
                <button class="rs-hotel-card__wishlist" (click)="$event.preventDefault()">♡</button>
              </div>

              <!-- Info -->
              <div class="hotel-row-card__body">
                <div class="hotel-row-card__stars">{{ '★'.repeat(h.estrellas) }}</div>
                <h3 class="hotel-row-card__name">{{ h.nombre }}</h3>
                <p class="hotel-row-card__loc">📍 {{ h.barrio }}, {{ h.ciudad }}</p>

                <div class="hotel-row-card__amenities">
                  @for (a of h.amenities.slice(0,4); track a) {
                    <span class="rs-amenity">{{ a }}</span>
                  }
                </div>

                <div class="hotel-row-card__tags">
                  @if (h.cancelacionGratis) {
                    <span class="tag-green">✓ Cancelación gratis</span>
                  }
                  @if (h.desayunoIncluido) {
                    <span class="tag-green">✓ Desayuno incluido</span>
                  }
                  @if (h.habitacionesDisponibles <= 3 && h.habitacionesDisponibles > 0) {
                    <span class="tag-amber">⚡ Solo {{ h.habitacionesDisponibles }} hab. disponibles</span>
                  }
                </div>
              </div>

              <!-- Precio + CTA -->
              <div class="hotel-row-card__price">
                <div class="rs-rating">
                  <div class="rs-rating__score">{{ h.score }}</div>
                  <div>
                    <div class="rs-rating__label">{{ h.scoreLabel }}</div>
                    <div class="rs-rating__count">{{ h.numResenas }} reseñas</div>
                  </div>
                </div>
                <div class="hotel-row-card__price-box">
                  @if (h.precioAnterior) {
                    <div class="rs-price__old">€{{ h.precioAnterior }}</div>
                  }
                  <div class="hotel-row-card__amount">€{{ h.precioPorNoche }}</div>
                  <div class="hotel-row-card__period">por noche</div>
                  <div class="hotel-row-card__taxes">Impuestos incluidos</div>
                </div>
                <button class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)"
                        (click)="$event.preventDefault(); verDetalle(h.id)">
                  Ver disponibilidad
                </button>
              </div>
            </a>
          }

          @if (!cargando() && hoteles().length === 0) {
            <div class="empty-state">
              <div style="font-size:4rem">🔍</div>
              <h3>No encontramos hoteles</h3>
              <p>Prueba cambiando los filtros o la ciudad.</p>
              <button class="rs-btn rs-btn--secondary" style="margin-top:var(--sp-6)"
                      (click)="limpiarFiltros()">Limpiar filtros</button>
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

    .hoteles-page { min-height: 100vh; background: var(--c-base); }

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

    .hoteles-body {
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

      h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
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

    .results-header__title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .results-header__sub { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

    .results-list { display: flex; flex-direction: column; gap: var(--sp-4); }

    /* HOTEL ROW CARD */
    .hotel-row-card {
      display: grid;
      grid-template-columns: 280px 1fr 220px;
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

        .hotel-row-card__imgs img { transform: scale(1.05); }
      }

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .hotel-row-card__imgs {
      position: relative;
      overflow: hidden;
      min-height: 200px;

      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
    }

    .hotel-row-card__body { padding: var(--sp-5); }
    .hotel-row-card__stars { font-size: var(--f-sm); color: var(--c-amber); margin-bottom: var(--sp-2); }
    .hotel-row-card__name { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); line-height: 1.3; }
    .hotel-row-card__loc { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-4); }

    .hotel-row-card__amenities { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }

    .hotel-row-card__tags { display: flex; flex-direction: column; gap: var(--sp-2); }

    .tag-green { font-size: var(--f-xs); color: #34D399; }
    .tag-amber { font-size: var(--f-xs); color: #FCD34D; }

    .hotel-row-card__price {
      padding: var(--sp-5);
      border-left: 1px solid var(--b-1);
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);

      @media (max-width: 768px) { border-left: none; border-top: 1px solid var(--b-1); }
    }

    .hotel-row-card__price-box { text-align: right; }
    .hotel-row-card__amount { font-size: var(--f-3xl); font-weight: var(--w-8); color: var(--t-100); letter-spacing: -.03em; }
    .hotel-row-card__period { font-size: var(--f-xs); color: var(--t-400); }
    .hotel-row-card__taxes { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

    /* EMPTY STATE */
    .empty-state {
      text-align: center;
      padding: var(--sp-20) var(--sp-8);
      color: var(--t-400);

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
export class HotelesListaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly hotelesService = inject(HotelesService);

  readonly cargando = signal(true);
  readonly hoteles = signal<HotelCard[]>([]);
  readonly paginaActual = signal(1);
  readonly totalPaginas = signal(1);
  readonly totalItems = signal(0);

  readonly totalLabel = computed(() =>
    `${this.totalItems()} hoteles encontrados`
  );

  readonly searchForm = this.fb.group({
    ciudad: [''], desde: [''], hasta: [''], huespedes: [2],
  });

  /* Filtros locales */
  precioMin = 0;
  precioMax = 2000;
  estrellasSelec = signal<number[]>([]);
  scoreMinimo = 0;
  amenitiesSelec = signal<string[]>([]);
  soloCancelacionGratis = false;
  soloDesayuno = false;
  ordenamiento = 'relevancia';

  readonly scoreOpciones = [
    { valor: 9, label: 'Excepcional' },
    { valor: 8, label: 'Muy bueno' },
    { valor: 7, label: 'Bueno' },
    { valor: 6, label: 'Aceptable' },
  ];

  readonly amenitiesOpciones = ['🌊 Piscina', '🅿️ Parking', '🍳 Desayuno', '🐾 Mascotas', '♿ Accesible', '💆 Spa'];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['ciudad'])  this.searchForm.patchValue({ ciudad: params['ciudad'] });
      if (params['desde'])   this.searchForm.patchValue({ desde: params['desde'] });
      if (params['hasta'])   this.searchForm.patchValue({ hasta: params['hasta'] });
      this.cargarHoteles();
    });
  }

  async cargarHoteles(): Promise<void> {
    this.cargando.set(true);
    try {
      const form = this.searchForm.value;
      const filtros: FiltrosHotel = {
        ciudad:   form.ciudad   ?? undefined,
        desde:    form.desde    ?? undefined,
        hasta:    form.hasta    ?? undefined,
        huespedes: form.huespedes ?? undefined,
        precioMin: this.precioMin || undefined,
        precioMax: this.precioMax < 2000 ? this.precioMax : undefined,
        estrellas: this.estrellasSelec().length ? this.estrellasSelec() : undefined,
        cancelacionGratis: this.soloCancelacionGratis || undefined,
        page: this.paginaActual(),
        limit: 10,
      };
      const result = await this.hotelesService.buscar(filtros);
      this.hoteles.set(result.items);
      this.totalItems.set(result.total);
      this.totalPaginas.set(result.totalPages);
    } catch {
      this.hoteles.set(this.mockHoteles());
      this.totalItems.set(this.mockHoteles().length);
      this.totalPaginas.set(1);
    } finally {
      this.cargando.set(false);
    }
  }

  aplicarBusqueda(): void { this.paginaActual.set(1); this.cargarHoteles(); }
  aplicarFiltros(): void  { this.paginaActual.set(1); this.cargarHoteles(); }

  limpiarFiltros(): void {
    this.precioMin = 0; this.precioMax = 2000;
    this.estrellasSelec.set([]); this.amenitiesSelec.set([]);
    this.soloCancelacionGratis = false; this.soloDesayuno = false;
    this.scoreMinimo = 0;
    this.aplicarFiltros();
  }

  toggleEstrellas(n: number): void {
    this.estrellasSelec.update(list =>
      list.includes(n) ? list.filter(x => x !== n) : [...list, n]
    );
  }

  toggleAmenity(a: string): void {
    this.amenitiesSelec.update(list =>
      list.includes(a) ? list.filter(x => x !== a) : [...list, a]
    );
  }

  cambiarPagina(n: number): void { this.paginaActual.set(n); this.cargarHoteles(); }
  verDetalle(id: string): void { void this.router.navigate(['/hoteles', id]); }

  private mockHoteles(): HotelCard[] {
    return [
      { id: 'h1', nombre: 'Gran Hotel Madrid Salamanca', ciudad: 'Madrid', barrio: 'Salamanca', direccion: 'Calle de Serrano 463', estrellas: 5, score: 9.2, scoreLabel: 'Excepcional', numResenas: 2840, precioPorNoche: 320, precioAnterior: 420, descuentoPct: 24, imagenes: [hotelImage(0, 600)], amenities: ['🌊 Piscina', '🅿️ Parking', '🍳 Desayuno'], cancelacionGratis: true, desayunoIncluido: true, habitacionesDisponibles: 4, destacado: true },
      { id: 'h2', nombre: 'Hotel Catalonia Barcelona', ciudad: 'Barcelona', barrio: 'Centro Histórico', direccion: 'Plaza Mayor 130', estrellas: 4, score: 8.9, scoreLabel: 'Muy bueno', numResenas: 1240, precioPorNoche: 185, imagenes: [hotelImage(5, 600)], amenities: ['♨️ Jacuzzi', '🍽️ Restaurante', '🛎️ Concierge'], cancelacionGratis: true, desayunoIncluido: false, habitacionesDisponibles: 8, destacado: false },
      { id: 'h3', nombre: 'Grand Hotel Villa d\'Este Como', ciudad: 'Bilbao', barrio: 'Orilla del Lago', direccion: 'Isla Bella', estrellas: 5, score: 9.4, scoreLabel: 'Excepcional', numResenas: 890, precioPorNoche: 450, imagenes: [hotelImage(2, 600)], amenities: ['🌊 Vista lago', '🛶 Kayak', '🍽️ Restaurante'], cancelacionGratis: false, desayunoIncluido: true, habitacionesDisponibles: 2, destacado: true },
      { id: 'h4', nombre: 'JW Marriott Madrid', ciudad: 'Madrid', barrio: 'Salamanca', direccion: 'Paseo de la Castellana 615', estrellas: 5, score: 9.1, scoreLabel: 'Excepcional', numResenas: 3210, precioPorNoche: 480, imagenes: [hotelImage(6, 600)], amenities: ['🏊 Piscina infinity', '💆 Spa', '🌊 Vista al mar'], cancelacionGratis: true, desayunoIncluido: false, habitacionesDisponibles: 12, destacado: false },
    ];
  }
}
