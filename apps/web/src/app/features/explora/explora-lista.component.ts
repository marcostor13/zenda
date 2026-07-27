import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TIPO_LUGAR_LABELS, TipoLugar } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { LugarApi, LugaresService } from './lugares.service';

/** Icono de cada tipo de lugar, para reconocerlo de un vistazo. */
const ICONOS: Record<TipoLugar, string> = {
  [TipoLugar.PLAYA]: 'globe',
  [TipoLugar.PARQUE]: 'paw',
  [TipoLugar.RESTAURANTE]: 'bone',
  [TipoLugar.RUTA]: 'map-pin',
  [TipoLugar.RIO]: 'globe',
};

/**
 * "Explora con tu mascota": el catálogo de sitios donde llevar al perro.
 *
 * No son servicios reservables, así que la pantalla no promete precios ni
 * disponibilidad. Su función es traer gente y devolverla al marketplace: cada
 * ficha enlaza los servicios de Doogking cercanos.
 */
@Component({
  selector: 'app-explora-lista',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ex-page">
  <rs-navbar />

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap rs-wrap--2xl">
      <header class="ex-head">
        <p class="ex-eyebrow">Comunidad Doogking</p>
        <h1>Explora con tu mascota</h1>
        <p class="ex-sub">
          Playas, parques, rutas y restaurantes donde tu perro es bienvenido de verdad.
          Lo mantiene la comunidad; nosotros lo revisamos antes de publicarlo.
        </p>
      </header>

      <div class="ex-filtros" role="tablist" aria-label="Tipo de lugar">
        <button type="button" role="tab" class="ex-chip" [class.is-on]="!tipo()"
                [attr.aria-selected]="!tipo()" (click)="filtrar(null)">
          Todos
        </button>
        @for (t of tipos; track t) {
          <button type="button" role="tab" class="ex-chip" [class.is-on]="tipo() === t"
                  [attr.aria-selected]="tipo() === t" (click)="filtrar(t)">
            <rs-icon [name]="icono(t)" [size]="14" [stroke]="2"></rs-icon>
            {{ etiqueta(t) }}
          </button>
        }
      </div>

      <div class="ex-acciones">
        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="buscarCerca()">
          <rs-icon name="map-pin" [size]="14" [stroke]="2"></rs-icon>
          {{ cerca() ? 'Mostrando lo más cercano' : 'Ver lo más cercano' }}
        </button>
        <a routerLink="/explora/planificador" class="rs-btn rs-btn--gold rs-btn--sm">
          <rs-icon name="sparkles" [size]="14" [stroke]="2"></rs-icon>
          Planificar un viaje
        </a>
        @if (avisoUbicacion()) { <span class="ex-aviso">{{ avisoUbicacion() }}</span> }
      </div>

      @if (cargando()) {
        <div class="ex-grid">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:240px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else if (!lugares().length) {
        <div class="ex-vacio">
          <rs-icon name="paw" [size]="40" [stroke]="1.25"></rs-icon>
          <p>Todavía no hay sitios publicados con este filtro.</p>
          <p class="ex-vacio__sub">¿Conoces uno? Ayúdanos a construir el mapa pet-friendly de Europa.</p>
        </div>
      } @else {
        <p class="ex-count">{{ lugares().length }} {{ lugares().length === 1 ? 'sitio' : 'sitios' }}</p>

        <div class="ex-grid">
          @for (l of lugares(); track l._id) {
            <a class="ex-card" [routerLink]="['/explora', l._id]">
              <div class="ex-card__img">
                <img [src]="l.fotos[0]" [alt]="l.nombre" loading="lazy" rsImg />
                <span class="ex-card__tipo">{{ etiqueta(l.tipo) }}</span>
              </div>
              <div class="ex-card__body">
                <h2>{{ l.nombre }}</h2>
                <p class="ex-card__loc">
                  <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon>
                  {{ l.ubicacion.ciudad }}@if (l.ubicacion.provincia) { · {{ l.ubicacion.provincia }} }
                </p>
                @if (l.totalReviews) {
                  <p class="ex-card__rating">
                    <rs-icon name="star" [size]="13" [stroke]="2"></rs-icon>
                    {{ l.ratingPromedio }} · {{ l.totalReviews }} {{ l.totalReviews === 1 ? 'opinión' : 'opiniones' }}
                  </p>
                } @else {
                  <p class="ex-card__rating ex-card__rating--vacio">Sé el primero en opinar</p>
                }
              </div>
            </a>
          }
        </div>
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .ex-page { min-height: 100vh; background: var(--c-base); }

    .ex-head { margin-bottom: var(--sp-6); max-width: 64ch; }
    .ex-eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .ex-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .ex-sub { color: var(--t-400); margin-top: var(--sp-2); font-size: var(--f-md); line-height: 1.6; }

    .ex-filtros { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-4); }
    .ex-chip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-300); cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    }

    .ex-acciones { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-5); }
    .ex-aviso { font-size: var(--f-xs); color: var(--t-400); }

    .ex-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-4); }

    .ex-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5);
      @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .ex-card {
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      overflow: hidden; text-decoration: none;
      transition: transform var(--d-2), box-shadow var(--d-2);
      &:hover { transform: translateY(-4px); box-shadow: var(--sh-lg); }
      @media (prefers-reduced-motion: reduce) { &:hover { transform: none; } }
    }

    .ex-card__img {
      position: relative; aspect-ratio: 16/10; overflow: hidden;
      background: linear-gradient(135deg, #143C7A, #1668E3);
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .ex-card__tipo {
      position: absolute; top: var(--sp-3); left: var(--sp-3);
      padding: 2px var(--sp-3); border-radius: var(--r-full);
      background: rgba(255,255,255,.92); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-7);
    }

    .ex-card__body { padding: var(--sp-4); }
    .ex-card__body h2 { font-size: var(--f-md); color: var(--t-100); margin-bottom: var(--sp-2); }
    .ex-card__loc, .ex-card__rating {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400);
    }
    .ex-card__rating { margin-top: var(--sp-1); color: var(--dk-blue); font-weight: var(--w-6); }
    .ex-card__rating--vacio { color: var(--t-500); font-weight: var(--w-5); }

    .ex-vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
      padding: var(--sp-16) var(--sp-4); text-align: center; color: var(--t-400);
      rs-icon { color: var(--t-500); }
    }
    .ex-vacio__sub { font-size: var(--f-sm); color: var(--t-500); }
  `],
})
export class ExploraListaComponent implements OnInit {
  private readonly lugaresService = inject(LugaresService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tipos = Object.values(TipoLugar);

  readonly lugares = signal<LugarApi[]>([]);
  readonly cargando = signal(true);
  readonly tipo = signal<TipoLugar | null>(null);
  readonly avisoUbicacion = signal('');

  private readonly coordenadas = signal<{ lat: number; lng: number } | null>(null);
  readonly cerca = computed(() => this.coordenadas() !== null);

  private ciudad?: string;

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    this.tipo.set((params.get('tipo') as TipoLugar) ?? null);
    this.ciudad = params.get('ciudad') ?? undefined;
    await this.cargar();
  }

  etiqueta(tipo: TipoLugar): string {
    return TIPO_LUGAR_LABELS[tipo];
  }

  icono(tipo: TipoLugar): string {
    return ICONOS[tipo];
  }

  async filtrar(tipo: TipoLugar | null): Promise<void> {
    this.tipo.set(tipo);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tipo: tipo ?? null },
      queryParamsHandling: 'merge',
    });
    await this.cargar();
  }

  /**
   * La ubicación solo se pide cuando el usuario la solicita explícitamente:
   * pedirla al abrir la pantalla hace que mucha gente la deniegue para siempre.
   */
  async buscarCerca(): Promise<void> {
    if (!navigator.geolocation) {
      this.avisoUbicacion.set('Tu navegador no comparte la ubicación.');
      return;
    }

    this.avisoUbicacion.set('Buscando tu ubicación…');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      this.coordenadas.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      this.avisoUbicacion.set('');
    } catch {
      this.avisoUbicacion.set('Sin acceso a tu ubicación; te mostramos los mejor valorados.');
    }
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.lugares.set(
        await this.lugaresService.buscar({
          tipo: this.tipo() ?? undefined,
          ciudad: this.ciudad,
          lat: this.coordenadas()?.lat,
          lng: this.coordenadas()?.lng,
        }),
      );
    } catch {
      this.lugares.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}
