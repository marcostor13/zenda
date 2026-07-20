import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../shared/directives/animate-on-scroll.directive';
import { RsFavoritoBtnComponent } from '../../shared/components/favorito-btn/rs-favorito-btn.component';
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
    vertical: 'veterinaria', eyebrow: 'VETERINARIOS', titulo: 'Cuidado veterinario', tituloHighlight: 'de confianza',
    sub: 'Clínicas verificadas para tu perro: vacunación, cirugía, dermatología y urgencias 24h.',
    placeholder: 'Ciudad de la clínica (Madrid, Barcelona…)', cta: 'Pedir cita', priceLabel: 'consulta desde',
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
    vertical: 'peluqueria', eyebrow: 'PELUQUERÍAS CANINAS', titulo: 'Peluquería y spa', tituloHighlight: 'para tu perro',
    sub: 'Baño, corte, deslanado y spa con groomers profesionales, en salón o a domicilio.',
    placeholder: 'Ciudad (Madrid, Barcelona…)', cta: 'Reservar cita', priceLabel: 'servicio desde',
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
    vertical: 'adiestramiento', eyebrow: 'ADIESTRAMIENTO CANINO', titulo: 'Educadores caninos', tituloHighlight: 'certificados',
    sub: 'Obediencia, modificación de conducta y educación de cachorros, por sesión o programa.',
    placeholder: 'Ciudad (Madrid, Barcelona…)', cta: 'Reservar sesión', priceLabel: 'sesión desde',
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
    vertical: 'hoteles', eyebrow: 'HOTELES PET-FRIENDLY', titulo: 'Alojamiento', tituloHighlight: 'para ti y tu perro',
    sub: 'Hoteles donde tú y tu perro os quedáis juntos, con servicios y suplementos pensados para mascotas.',
    placeholder: 'Ciudad (Madrid, Barcelona…)', cta: 'Reservar hotel', priceLabel: 'habitación desde',
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
  imports: [ReactiveFormsModule, RsNavbarComponent, ImgFallbackDirective, AnimateOnScrollDirective, RsFavoritoBtnComponent],
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
  private readonly fb = inject(FormBuilder);
  private readonly browseService = inject(CatalogBrowseService);

  readonly cfg = signal<VerticalConfig>(CONFIGS['veterinaria']);
  readonly cargando = signal(true);
  readonly items = signal<ServicioCard[]>([]);
  readonly error = signal(false);
  readonly solicitadoId = signal<string | null>(null);

  readonly searchForm = this.fb.group({ ciudad: [''] });

  ngOnInit(): void {
    const vertical = (this.route.snapshot.data['vertical'] as string) ?? 'veterinaria';
    this.cfg.set(CONFIGS[vertical] ?? CONFIGS['veterinaria']);
    void this.cargar();
  }

  async buscar(): Promise<void> {
    await this.cargar(this.searchForm.value.ciudad ?? undefined);
  }

  private async cargar(ciudad?: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    this.solicitadoId.set(null);
    try {
      // Datos reales del catálogo: nunca mocks, para no ofrecer servicios
      // inexistentes que romperían la reserva.
      this.items.set(await this.browseService.buscar(this.cfg().vertical, ciudad));
    } catch {
      this.items.set([]);
      this.error.set(true);
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
