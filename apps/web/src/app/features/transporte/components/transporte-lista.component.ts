import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import { TransporteService, TransporteCard, TipoVehiculoTransporte } from '../services/transporte.service';

@Component({
  selector: 'app-transporte-lista',
  standalone: true,
  imports: [
    RsNavbarComponent, RsIconComponent, RsSearchBarComponent,
    ImgFallbackDirective, AnimateOnScrollDirective,
  ],
  template: `
<div class="transporte-page">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="transporte-searchbar">
    <div class="rs-wrap">
      <rs-search-bar variant="strip" [vertical]="ui.key" [buscarAlCambiar]="true" />
    </div>
  </div>

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap">
      <header class="transporte-head">
        <h1>{{ titular }}</h1>
        <p>{{ subtitular }}</p>
      </header>

      @if (cargando()) {
        <div class="transporte-grid">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="transporte-count">{{ transportes().length }} servicios de transporte disponibles<span class="transporte-count__ciudad">{{ sufijoCiudad() }}</span></p>
        <div class="transporte-grid">
          @for (t of transportes(); track t.id) {
            <article class="transporte-card" [class.transporte-card--premium]="t.destacado" rsAnim>
              <div class="transporte-card__img">
                <img [src]="t.imagen" [alt]="t.nombre" loading="lazy" rsImg />
                <span class="rs-badge rs-badge--accent transporte-card__type">{{ tipoLabel(t.tipoVehiculo) }}</span>
                @if (t.destacado) {
                  <span class="premium-badge">★ Premium</span>
                }
              </div>
              <div class="transporte-card__body">
                <h3 class="transporte-card__name">{{ t.nombre }}</h3>
                <p class="transporte-card__loc">📍 {{ t.ciudad }}
                  @if (t.zonaCobertura.length) {
                    · Cubre {{ t.zonaCobertura.slice(0,3).join(', ') }}
                  }
                </p>
                <div class="transporte-card__meta">
                  <span><rs-icon name="paw" size="14" /> Hasta {{ t.capacidadPerros }} {{ t.capacidadPerros === 1 ? 'perro' : 'perros' }}</span>
                  @if (t.jaulasIncluidas) { <span>✓ Jaulas incluidas</span> }
                  @if (t.acompananteHumano) { <span>✓ Puedes acompañarlo</span> }
                </div>
                <div class="transporte-card__footer">
                  <div class="rs-rating">
                    <div class="rs-rating__score">{{ t.score }}</div>
                    <div>
                      <div class="rs-rating__label">{{ t.scoreLabel }}</div>
                      <div class="rs-rating__count">{{ t.numResenas }} reseñas</div>
                    </div>
                  </div>
                  <div class="transporte-card__price">
                    <div class="transporte-card__amount">desde €{{ t.tarifaBase }}</div>
                    <div class="transporte-card__period">+ €{{ t.tarifaKm }}/km</div>
                  </div>
                </div>
                <button class="rs-btn rs-btn--gold rs-btn--block" style="margin-top:var(--sp-4)"
                        (click)="solicitar(t)">Reservar transporte</button>
              </div>
            </article>
          }

          @if (transportes().length === 0 && !error()) {
            <div class="transporte-empty">
              <rs-icon name="paw" size="48" />
              <h3>No hay transportes para esa búsqueda</h3>
              <p>Prueba con otra ciudad.</p>
            </div>
          }
          @if (error()) {
            <div class="transporte-empty">
              <rs-icon name="paw" size="48" />
              <h3>No se pudo cargar el catálogo</h3>
              <p>Inténtalo de nuevo en unos momentos.</p>
            </div>
          }
        </div>
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .transporte-page { min-height: 100vh; background: var(--c-base); }
    .transporte-searchbar { background: var(--c-card); border-bottom: 1px solid var(--b-1); padding-block: var(--sp-4); box-shadow: var(--sh-sm); }
    .transporte-head { margin-bottom: var(--sp-6); }
    .transporte-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .transporte-head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    .transporte-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .transporte-count__ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    .transporte-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .transporte-card { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); overflow: hidden; box-shadow: var(--sh-card); transition: all var(--d-3); &:hover { box-shadow: var(--sh-lg); transform: translateY(-4px); .transporte-card__img img { transform: scale(1.06); } } }
    .transporte-card--premium { border-top: 4px solid var(--dk-gold); }
    .premium-badge { position: absolute; top: var(--sp-3); right: var(--sp-3); background: var(--dk-gold); color: var(--dk-blue-deep); font-size: var(--f-xs); font-weight: var(--w-7); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-md); }
    .transporte-card__img { position: relative; aspect-ratio: 16/10; overflow: hidden; background: var(--g-accent); img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); } }
    .transporte-card__type { position: absolute; top: var(--sp-3); left: var(--sp-3); background: rgba(255,255,255,.92); color: var(--t-100); border-color: rgba(255,255,255,.6); backdrop-filter: blur(6px); }
    .transporte-card__body { padding: var(--sp-5); }
    .transporte-card__name { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); margin-bottom: var(--sp-1); }
    .transporte-card__loc { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-3); }
    .transporte-card__meta { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); span { display: inline-flex; align-items: center; gap: var(--sp-1); } rs-icon { color: var(--dk-gold); } }
    .transporte-card__footer { display: flex; align-items: flex-end; justify-content: space-between; }
    .transporte-card__price { text-align: right; }
    .transporte-card__amount { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--dk-blue); letter-spacing: -.02em; }
    .transporte-card__period { font-size: var(--f-xs); color: var(--t-400); }
    .transporte-empty { grid-column: 1 / -1; text-align: center; padding: var(--sp-20); color: var(--t-400); rs-icon { color: var(--dk-gold); } h3 { color: var(--t-200); margin: var(--sp-4) 0 var(--sp-2); } }
  `],
})
export class TransporteListaComponent implements OnInit {
  private readonly transporteService = inject(TransporteService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly ui = verticalUi(VerticalKey.TRANSPORTE);
  readonly titular = titularDeVertical(VerticalKey.TRANSPORTE);
  readonly subtitular = subtitularDeVertical(VerticalKey.TRANSPORTE);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly transportes = signal<TransporteCard[]>([]);

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
    try {
      // Datos reales del catálogo; nunca mocks (evita ofrecer traslados inexistentes).
      this.transportes.set(await this.transporteService.buscar(this.busqueda().ciudad));
    } catch {
      this.transportes.set([]);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(t: TransporteCard): void {
    const { ciudad, desde, perros } = this.busqueda();
    void this.router.navigate(['/reservas', 'transporte', t.id], {
      queryParams: {
        comercioId:  t.comercioId,
        nombre:      t.nombre,
        precioBase:  t.tarifaBase,
        imagen:      t.imagen,
        // Continuidad: origen, fecha y mascotas buscados prellenan la reserva.
        ciudad:      ciudad ?? null,
        desde:       desde ?? null,
        perros:      perros ?? null,
      },
    });
  }

  tipoLabel(tipo: TipoVehiculoTransporte): string {
    const map: Record<TipoVehiculoTransporte, string> = {
      van_acondicionada: '🚐 Van acondicionada',
      coche: '🚗 Coche',
      furgon_climatizado: '🚚 Furgón climatizado',
    };
    return map[tipo] ?? tipo;
  }

}
