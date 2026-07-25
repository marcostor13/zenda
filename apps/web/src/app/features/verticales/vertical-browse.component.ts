import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsSearchBarComponent } from '../../shared/components/search-bar/rs-search-bar.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsFavoritoBtnComponent } from '../../shared/components/favorito-btn/rs-favorito-btn.component';
import { VerticalUi, verticalUi } from '../../shared/verticales/verticales.config';
import { CatalogBrowseService, ServicioCard } from './catalog-browse.service';

/** Filtros de búsqueda vigentes, tal y como llegan en la URL. */
interface Busqueda {
  ciudad?: string;
  desde?: string;
  /** Hora pedida en el buscador; ordena los resultados por cercanía al slot. */
  hora?: string;
  perros?: string;
  /** Mascota elegida en el buscador: filtra por compatibilidad. */
  perroId?: string;
}

/**
 * Presentación de las tarjetas de cada vertical de cita. El título, la
 * descripción y el buscador ya no viven aquí: vienen de `verticales.config.ts`
 * y de `<rs-search-bar>`, comunes a toda la aplicación.
 */
interface VerticalConfig {
  vertical: string;
  cta: string;
  priceLabel: string;
  badge: (c: ServicioCard) => string | null;
  titulo3: (c: ServicioCard) => string;
  loc: (c: ServicioCard) => string;
  meta: (c: ServicioCard) => string[];
  price: (c: ServicioCard) => number;
  confirmMsg: string;
}

interface ItemConNombre {
  nombre: string;
  precio: number;
}

/** Nombres del primer/menor servicio y precio mínimo entre los servicios propios del vertical (o el precio base si no hay ninguno). */
const resumenServicios = (items: ItemConNombre[] | undefined, c: ServicioCard): { primero: string | null; nombres: string; precioMin: number } => {
  if (!items?.length) return { primero: null, nombres: '', precioMin: c.precioPorNoche };
  return {
    primero: items[0].nombre,
    nombres: items.map((i) => i.nombre).join(' · '),
    precioMin: Math.min(...items.map((i) => i.precio)),
  };
};

const CONFIGS: Record<string, VerticalConfig> = {
  veterinaria: {
    vertical: 'veterinaria',
    cta: 'Pedir cita', priceLabel: 'consulta desde',
    confirmMsg: '✓ Cita solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `🩺 ${(c.extra['especialidades'] as string[] | undefined)?.[0] ?? 'Medicina general'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [
      `💉 ${resumenServicios(c.extra['serviciosClinicos'] as ItemConNombre[] | undefined, c).nombres || 'Consulta general'}`,
      c.extra['atiendeUrgencias'] ? '🚑 Urgencias 24h' : `🕐 ${(c.extra['horario'] as string) ?? 'Consulta horario'}`,
    ],
    price: (c) => (c.extra['precioConsulta'] as number) ?? c.precioPorNoche,
  },
  peluqueria: {
    vertical: 'peluqueria',
    cta: 'Reservar cita', priceLabel: 'servicio desde',
    confirmMsg: '✓ Cita de peluquería solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `✂️ ${resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).primero ?? 'Corte y baño'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [
      `🛁 ${resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).nombres || 'Baño completo'}`,
      c.extra['aDomicilio'] ? '🏠 A domicilio' : '🐩 En salón',
    ],
    price: (c) => resumenServicios(c.extra['serviciosGrooming'] as ItemConNombre[] | undefined, c).precioMin,
  },
  adiestramiento: {
    vertical: 'adiestramiento',
    cta: 'Reservar sesión', priceLabel: 'sesión desde',
    confirmMsg: '✓ Sesión solicitada. Continúa al pago para confirmarla.',
    badge: (c) => `🎓 ${(c.extra['tiposAdiestramiento'] as string[] | undefined)?.[0] ?? 'Obediencia básica'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [
      `🐕 ${c.extra['modalidad'] === 'programa' ? 'Programa completo' : 'Por sesión'}`,
      `🦮 Desde ${(c.extra['edadMinimaMeses'] as number) ?? 3} meses`,
    ],
    price: (c) => (c.extra['precioSesion'] as number) ?? c.precioPorNoche,
  },
  hoteles: {
    vertical: 'hoteles',
    cta: 'Reservar hotel', priceLabel: 'habitación desde',
    confirmMsg: '✓ Hotel solicitado. Continúa al pago para confirmarlo.',
    badge: (c) => (c.extra['admiteMascotas'] ?? true) ? '🐾 Pet-friendly' : '🏨 Hotel',
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [
      `🐾 Hasta ${(c.extra['maxMascotasPorReserva'] as number | undefined) ?? 'sin límite de'} mascota(s)`,
      `🎁 ${((c.extra['serviciosPetfriendly'] as string[] | undefined) ?? [])[0] ?? 'Servicios pet-friendly'}`,
    ],
    price: (c) => c.precioPorNoche,
  },
};

@Component({
  selector: 'app-vertical-browse',
  standalone: true,
  imports: [
    RsNavbarComponent, RsSearchBarComponent, ImgFallbackDirective,
    AnimateOnScrollDirective, RsFavoritoBtnComponent,
  ],
  template: `
<div class="vb-page">
  <rs-navbar />

  <!-- Buscador estándar: mismos campos y orden que en el home -->
  <div class="vb-searchbar">
    <div class="rs-wrap">
      <rs-search-bar variant="strip" [vertical]="ui().key" [buscarAlCambiar]="true" />
    </div>
  </div>

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap">
      <header class="vb-head">
        <h1>{{ titular() }}</h1>
        <p>{{ subtitular() }}</p>
      </header>

      @if (cargando()) {
        <div class="vb-grid">
          @for (_ of [1,2,3]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="vb-count">
          {{ items().length }} {{ items().length === 1 ? 'resultado' : 'resultados' }}<span class="vb-count__ciudad">{{ sufijoCiudad() }}</span>
          @for (c of contextoBusqueda(); track c) {
            <span class="vb-chip">{{ c }}</span>
          }
        </p>
        <div class="vb-grid">
          @for (c of items(); track c.id) {
            <article class="vb-card" rsAnim>
              <div class="vb-card__img">
                <img [src]="c.imagenes[0]" [alt]="c.nombre" loading="lazy" rsImg />
                <span class="rs-badge rs-badge--accent vb-card__badge">{{ cfg().badge(c) }}</span>
                <div class="vb-card__fav">
                  <rs-favorito-btn [servicioId]="c.id"></rs-favorito-btn>
                </div>
              </div>
              <div class="vb-card__body">
                <h3 class="vb-card__name">{{ cfg().titulo3(c) }}</h3>
                <p class="vb-card__loc">{{ cfg().loc(c) }}</p>
                <div class="vb-card__meta">
                  @for (m of cfg().meta(c); track m) { <span>{{ m }}</span> }
                </div>
                <div class="vb-card__footer">
                  <div class="rs-rating">
                    <div class="rs-rating__score">{{ c.score }}</div>
                    <div>
                      <div class="rs-rating__label">{{ c.scoreLabel }}</div>
                      <div class="rs-rating__count">{{ c.numResenas }} reseñas</div>
                    </div>
                  </div>
                  <div class="vb-card__price">
                    <div class="vb-card__amount">€{{ cfg().price(c) }}</div>
                    <div class="vb-card__period">{{ cfg().priceLabel }}</div>
                  </div>
                </div>
                @if (solicitadoId() === c.id) {
                  <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">{{ cfg().confirmMsg }}</div>
                } @else {
                  <button class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)"
                          (click)="solicitar(c)">{{ cfg().cta }}</button>
                }
              </div>
            </article>
          }
          @if (items().length === 0 && !error()) {
            <div class="vb-empty"><div style="font-size:3rem">🔍</div><h3>Sin resultados</h3><p>Prueba con otra ciudad.</p></div>
          }
          @if (error()) {
            <div class="vb-empty"><div style="font-size:3rem">⚠️</div><h3>No se pudo cargar el catálogo</h3><p>Inténtalo de nuevo en unos momentos.</p></div>
          }
        </div>
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .vb-page { min-height: 100vh; background: var(--c-base); }
    .vb-searchbar { background: var(--c-card); border-bottom: 1px solid var(--b-1); padding-block: var(--sp-4); box-shadow: var(--sh-sm); }
    .vb-head { margin-bottom: var(--sp-6); }
    .vb-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .vb-head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    .vb-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .vb-count__ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    .vb-chip {
      display: inline-block; margin-left: var(--sp-2);
      padding: 2px var(--sp-2); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }
    .vb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .vb-card { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); overflow: hidden; box-shadow: var(--sh-card); transition: all var(--d-3); &:hover { box-shadow: var(--sh-lg); transform: translateY(-4px); .vb-card__img img { transform: scale(1.06); } } }
    .vb-card__img { position: relative; aspect-ratio: 16/10; overflow: hidden; background: linear-gradient(135deg, #143C7A, #1668E3); img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); } }
    .vb-card__badge { position: absolute; top: var(--sp-3); left: var(--sp-3); background: rgba(255,255,255,.92); color: var(--t-100); border-color: rgba(255,255,255,.6); backdrop-filter: blur(6px); }
    .vb-card__fav { position: absolute; top: var(--sp-3); right: var(--sp-3); z-index: 2; }
    .vb-card__body { padding: var(--sp-5); }
    .vb-card__name { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); line-height: 1.3; }
    .vb-card__loc { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-3); }
    .vb-card__meta { display: flex; gap: var(--sp-4); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); flex-wrap: wrap; }
    .vb-card__footer { display: flex; align-items: flex-end; justify-content: space-between; }
    .vb-card__price { text-align: right; }
    .vb-card__amount { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); letter-spacing: -.02em; }
    .vb-card__period { font-size: var(--f-xs); color: var(--t-400); }
    .vb-empty { grid-column: 1 / -1; text-align: center; padding: var(--sp-20); color: var(--t-400); h3 { color: var(--t-200); margin: var(--sp-4) 0 var(--sp-2); } }
  `],
})
export class VerticalBrowseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browseService = inject(CatalogBrowseService);

  readonly cfg = signal<VerticalConfig>(CONFIGS['veterinaria']);
  readonly ui = signal<VerticalUi>(verticalUi(VerticalKey.VETERINARIA));

  /** Copy de marca del vertical; cae a la etiqueta/descripción si no lo tiene. */
  readonly titular = computed(() => this.ui().titular ?? this.ui().label);
  readonly subtitular = computed(() => this.ui().subtitular ?? this.ui().descripcion);
  readonly cargando = signal(true);
  readonly items = signal<ServicioCard[]>([]);
  readonly error = signal(false);
  readonly solicitadoId = signal<string | null>(null);

  /** Búsqueda activa, leída de la URL (fuente de verdad compartida). */
  private readonly busqueda = signal<Busqueda>({});

  /**
   * Resume lo que el usuario pidió (fecha, hora, mascota) junto al recuento:
   * sin esto, al quitarse el botón "Buscar" no queda ninguna confirmación
   * visible de que la búsqueda se aplicó.
   */
  readonly contextoBusqueda = computed(() => {
    const { desde, hora, perroId } = this.busqueda();
    const chips: string[] = [];
    if (desde) chips.push(desde);
    if (hora) chips.push(hora);
    if (perroId) chips.push('Compatible con tu mascota');
    return chips;
  });

  readonly sufijoCiudad = computed(() => {
    const ciudad = this.busqueda().ciudad;
    return ciudad ? ` en ${ciudad}` : '';
  });

  ngOnInit(): void {
    const vertical = (this.route.snapshot.data['vertical'] as string) ?? VerticalKey.VETERINARIA;
    this.cfg.set(CONFIGS[vertical] ?? CONFIGS['veterinaria']);
    this.ui.set(verticalUi(vertical));

    // La URL manda: cada búsqueda del buscador recarga el listado.
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.busqueda.set({
        ciudad: params['ciudad'] || undefined,
        desde: params['desde'] || undefined,
        hora: params['hora'] || undefined,
        perros: params['perros'] || undefined,
        perroId: (params['perroIds'] ?? '').split(',').filter(Boolean)[0] || undefined,
      });
      void this.cargar();
    });
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    this.solicitadoId.set(null);
    try {
      // Datos reales del catálogo: nunca mocks, para no ofrecer servicios
      // inexistentes que romperían la reserva.
      this.items.set(await this.browseService.buscar(this.cfg().vertical, {
        ciudad: this.busqueda().ciudad,
        perroId: this.busqueda().perroId,
      }));
    } catch {
      this.items.set([]);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(c: ServicioCard): void {
    const { desde, perros } = this.busqueda();
    void this.router.navigate(
      ['/reservas', this.cfg().vertical, c.id],
      {
        queryParams: {
          comercioId: c.comercioId ?? '',
          nombre:     c.nombre,
          precioBase: this.cfg().price(c),
          imagen:     c.imagenes?.[0] ?? '',
          // Continuidad: la fecha y las mascotas buscadas prellenan la reserva.
          desde:      desde ?? null,
          perros:     perros ?? null,
        },
      },
    );
  }
}
