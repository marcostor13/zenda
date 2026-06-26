import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { CatalogBrowseService, ServicioCard } from './catalog-browse.service';

interface VerticalConfig {
  vertical: string;
  eyebrow: string;
  titulo: string;
  tituloHighlight: string;
  sub: string;
  placeholder: string;
  cta: string;
  priceLabel: string;
  badge: (c: ServicioCard) => string | null;
  titulo3: (c: ServicioCard) => string;
  loc: (c: ServicioCard) => string;
  meta: (c: ServicioCard) => string[];
  price: (c: ServicioCard) => number;
  confirmMsg: string;
  mock: ServicioCard[];
}

const card = (over: Partial<ServicioCard> & { extra: Record<string, unknown> }): ServicioCard => ({
  id: over.id ?? 'x', nombre: over.nombre ?? '', ciudad: over.ciudad ?? '',
  comercioId: over.comercioId ?? 'demo-comercio',
  precioPorNoche: over.precioPorNoche ?? 0, score: over.score ?? 4.6,
  scoreLabel: over.scoreLabel ?? 'Muy bueno', numResenas: over.numResenas ?? 200,
  imagenes: over.imagenes ?? [], destacado: false, extra: over.extra,
});

const CONFIGS: Record<string, VerticalConfig> = {
  vuelos: {
    vertical: 'vuelos', eyebrow: 'Vuelos', titulo: 'Vuelos por toda', tituloHighlight: 'Europa',
    sub: 'Compara rutas y aerolíneas. Reserva tu asiento al mejor precio.',
    placeholder: 'Origen o destino (Madrid, París…)', cta: 'Reservar vuelo', priceLabel: 'por asiento',
    confirmMsg: '✓ Asiento bloqueado. Continúa al pago para confirmar.',
    badge: (c) => `✈️ ${(c.extra['aerolinea'] as string) ?? 'Vuelo'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `🛫 ${(c.extra['origen'] as string) ?? c.ciudad}`,
    meta: (c) => [`💺 ${(c.extra['asientosDisponibles'] as number) ?? 0} asientos`, `🛬 ${(c.extra['destino'] as string) ?? ''}`],
    price: (c) => (c.extra['precioAsiento'] as number) ?? c.precioPorNoche,
    mock: [
      card({ id: 'v1', nombre: 'Madrid (MAD) → Barcelona (BCN)', ciudad: 'Madrid', precioPorNoche: 79, score: 4.4, extra: { aerolinea: 'Iberia', origen: 'Madrid (MAD)', destino: 'Barcelona (BCN)', asientosDisponibles: 48, precioAsiento: 79 } }),
      card({ id: 'v2', nombre: 'Barcelona (BCN) → París (CDG)', ciudad: 'Barcelona', precioPorNoche: 119, score: 4.5, extra: { aerolinea: 'Vueling', origen: 'Barcelona (BCN)', destino: 'París (CDG)', asientosDisponibles: 22, precioAsiento: 119 } }),
      card({ id: 'v3', nombre: 'Madrid (MAD) → Roma (FCO)', ciudad: 'Madrid', precioPorNoche: 99, score: 4.6, extra: { aerolinea: 'Air Europa', origen: 'Madrid (MAD)', destino: 'Roma (FCO)', asientosDisponibles: 60, precioAsiento: 99 } }),
    ],
  },
  transporte: {
    vertical: 'transporte', eyebrow: 'Transporte de carga', titulo: 'Logística y', tituloHighlight: 'mudanzas',
    sub: 'Transporte de mercancías por peso y ruta, con seguimiento y seguro.',
    placeholder: '¿En qué ciudad? (Madrid, Barcelona…)', cta: 'Solicitar transporte', priceLabel: 'tarifa base',
    confirmMsg: '✓ Te enviaremos un presupuesto según peso y ruta.',
    badge: (c) => `📦 ${(c.extra['tipoCarga'] as string) ?? 'Carga'}`,
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [`⚖️ Hasta ${(c.extra['capacidadKg'] as number) ?? 0} kg`, `📐 ${(c.extra['capacidadM3'] as number) ?? 0} m³`],
    price: (c) => (c.extra['tarifaBase'] as number) ?? c.precioPorNoche,
    mock: [
      card({ id: 'tr1', nombre: 'Mudanzas Express Madrid', ciudad: 'Madrid', precioPorNoche: 150, score: 4.6, extra: { tipoCarga: 'Mudanzas', capacidadKg: 1500, capacidadM3: 20, tarifaBase: 150 } }),
      card({ id: 'tr2', nombre: 'Carga Refrigerada Barcelona', ciudad: 'Barcelona', precioPorNoche: 220, score: 4.7, extra: { tipoCarga: 'Refrigerado', capacidadKg: 3000, capacidadM3: 30, tarifaBase: 220 } }),
    ],
  },
  guarderia: {
    vertical: 'guarderia', eyebrow: 'Guarderías', titulo: 'Cuidado infantil', tituloHighlight: 'de confianza',
    sub: 'Plazas por edad y modalidad (hora, día o mes), con personal titulado.',
    placeholder: '¿En qué ciudad? (Madrid, Barcelona…)', cta: 'Reservar plaza', priceLabel: 'según modalidad',
    confirmMsg: '✓ Plaza solicitada. Te contactaremos para formalizar la matrícula.',
    badge: (c) => `👶 ${(c.extra['rangoEdadMin'] as number) ?? 0}-${(c.extra['rangoEdadMax'] as number) ?? 3} años`,
    titulo3: (c) => c.nombre,
    loc: (c) => `📍 ${c.ciudad}`,
    meta: (c) => [`🕐 ${(c.extra['horario'] as string) ?? ''}`, `🎟️ ${(c.extra['cuposDisponibles'] as number) ?? 0} cupos`],
    price: (c) => (c.extra['precioMes'] as number) || (c.extra['precioDia'] as number) || c.precioPorNoche,
    mock: [
      card({ id: 'g1', nombre: 'Escuela Infantil Sol y Luna', ciudad: 'Madrid', precioPorNoche: 520, score: 4.9, scoreLabel: 'Excepcional', extra: { rangoEdadMin: 0, rangoEdadMax: 3, cuposDisponibles: 24, modalidad: 'mes', precioMes: 520, precioDia: 45, horario: 'L-V 07:30–18:00' } }),
      card({ id: 'g2', nombre: 'Petits Barcelona', ciudad: 'Barcelona', precioPorNoche: 560, score: 4.8, scoreLabel: 'Excepcional', extra: { rangoEdadMin: 1, rangoEdadMax: 4, cuposDisponibles: 16, modalidad: 'dia', precioMes: 560, precioDia: 50, horario: 'L-V 08:00–17:00' } }),
    ],
  },
};

@Component({
  selector: 'app-vertical-browse',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent, ImgFallbackDirective, AnimateOnScrollDirective],
  template: `
<div class="vb-page">
  <rs-navbar />

  <section class="vb-hero">
    <div class="rs-wrap">
      <span class="rs-label-caps">{{ cfg().eyebrow }}</span>
      <h1>{{ cfg().titulo }} <span class="rs-gradient-text">{{ cfg().tituloHighlight }}</span></h1>
      <p>{{ cfg().sub }}</p>
      <form [formGroup]="searchForm" (ngSubmit)="buscar()" class="vb-search">
        <input formControlName="ciudad" class="rs-inp rs-inp--lg" [placeholder]="cfg().placeholder" />
        <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg">Buscar</button>
      </form>
    </div>
  </section>

  <section class="rs-section">
    <div class="rs-wrap">
      @if (cargando()) {
        <div class="vb-grid">
          @for (_ of [1,2,3]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="vb-count">{{ items().length }} resultados</p>
        <div class="vb-grid">
          @for (c of items(); track c.id) {
            <article class="vb-card" rsAnim>
              <div class="vb-card__img">
                <img [src]="c.imagenes[0]" [alt]="c.nombre" loading="lazy" rsImg />
                <span class="rs-badge rs-badge--accent vb-card__badge">{{ cfg().badge(c) }}</span>
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
          @if (items().length === 0) {
            <div class="vb-empty"><div style="font-size:3rem">🔍</div><h3>Sin resultados</h3><p>Prueba con otra ciudad.</p></div>
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
    .vb-hero { padding: var(--sp-16) 0 var(--sp-10); background: var(--g-hero); text-align: center; }
    .vb-hero h1 { font-size: var(--f-4xl); font-weight: var(--w-9); letter-spacing: -.03em; margin: var(--sp-3) 0 var(--sp-4); }
    .vb-hero p { color: var(--t-300); max-width: 52ch; margin: 0 auto var(--sp-8); }
    .vb-search { display: flex; gap: var(--sp-3); max-width: 640px; margin: 0 auto; flex-wrap: wrap; }
    .vb-search .rs-inp { flex: 1; min-width: 240px; }
    .vb-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .vb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .vb-card { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); overflow: hidden; box-shadow: var(--sh-card); transition: all var(--d-3); &:hover { box-shadow: var(--sh-lg); transform: translateY(-4px); .vb-card__img img { transform: scale(1.06); } } }
    .vb-card__img { position: relative; aspect-ratio: 16/10; overflow: hidden; background: linear-gradient(135deg, #143C7A, #1668E3); img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); } }
    .vb-card__badge { position: absolute; top: var(--sp-3); left: var(--sp-3); background: rgba(255,255,255,.92); color: var(--t-100); border-color: rgba(255,255,255,.6); backdrop-filter: blur(6px); }
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
  private readonly fb = inject(FormBuilder);
  private readonly browseService = inject(CatalogBrowseService);

  private readonly useMock = true;

  readonly cfg = signal<VerticalConfig>(CONFIGS['vuelos']);
  readonly cargando = signal(true);
  readonly items = signal<ServicioCard[]>([]);
  readonly solicitadoId = signal<string | null>(null);

  readonly searchForm = this.fb.group({ ciudad: [''] });

  ngOnInit(): void {
    const vertical = (this.route.snapshot.data['vertical'] as string) ?? 'vuelos';
    this.cfg.set(CONFIGS[vertical] ?? CONFIGS['vuelos']);
    void this.cargar();
  }

  async buscar(): Promise<void> {
    await this.cargar(this.searchForm.value.ciudad ?? undefined);
  }

  private async cargar(ciudad?: string): Promise<void> {
    this.cargando.set(true);
    this.solicitadoId.set(null);
    try {
      const resultados = await this.browseService.buscar(this.cfg().vertical, ciudad);
      this.items.set(resultados.length ? resultados : (this.useMock ? this.cfg().mock : []));
    } catch {
      this.items.set(this.useMock ? this.cfg().mock : []);
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(c: ServicioCard): void {
    void this.router.navigate(
      ['/reservas', this.cfg().vertical, c.id],
      {
        queryParams: {
          comercioId: c.comercioId ?? '',
          nombre:     c.nombre,
          precioBase: this.cfg().price(c),
          imagen:     c.imagenes?.[0] ?? '',
        },
      },
    );
  }
}
