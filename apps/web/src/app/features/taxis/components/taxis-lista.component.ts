import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { TaxisService, TaxiCard } from '../services/taxis.service';

@Component({
  selector: 'app-taxis-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent, ImgFallbackDirective, AnimateOnScrollDirective],
  template: `
<div class="taxis-page">
  <rs-navbar />

  <section class="taxis-hero">
    <div class="rs-wrap">
      <span class="rs-label-caps">Traslados</span>
      <h1>Taxis y traslados <span class="rs-gradient-text">en toda Europa</span></h1>
      <p>Aeropuerto, ciudad o larga distancia. Tarifa transparente y reserva inmediata.</p>

      <form [formGroup]="searchForm" (ngSubmit)="buscar()" class="taxis-search">
        <input formControlName="ciudad" class="rs-inp rs-inp--lg" placeholder="¿En qué ciudad? (Madrid, Barcelona…)" />
        <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg">Buscar</button>
      </form>
    </div>
  </section>

  <section class="rs-section">
    <div class="rs-wrap">
      @if (cargando()) {
        <div class="taxis-grid">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="taxis-count">{{ taxis().length }} servicios de traslado disponibles</p>
        <div class="taxis-grid">
          @for (t of taxis(); track t.id) {
            <article class="taxi-card" rsAnim>
              <div class="taxi-card__img">
                <img [src]="t.imagen" [alt]="t.nombre" loading="lazy" rsImg />
                <span class="rs-badge rs-badge--accent taxi-card__type">{{ tipoLabel(t.tipoVehiculo) }}</span>
              </div>
              <div class="taxi-card__body">
                <h3 class="taxi-card__name">{{ t.nombre }}</h3>
                <p class="taxi-card__loc">📍 {{ t.ciudad }}</p>
                <div class="taxi-card__meta">
                  <span>👥 Hasta {{ t.capacidad }}</span>
                  <span>🛣️ €{{ t.tarifaKm }}/km</span>
                </div>
                <div class="taxi-card__footer">
                  <div class="rs-rating">
                    <div class="rs-rating__score">{{ t.score }}</div>
                    <div>
                      <div class="rs-rating__label">{{ t.scoreLabel }}</div>
                      <div class="rs-rating__count">{{ t.numResenas }} reseñas</div>
                    </div>
                  </div>
                  <div class="taxi-card__price">
                    <div class="taxi-card__amount">€{{ t.tarifaBase }}</div>
                    <div class="taxi-card__period">tarifa base</div>
                  </div>
                </div>
                <button class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)"
                        (click)="solicitar(t)">Reservar traslado</button>
              </div>
            </article>
          }

          @if (taxis().length === 0) {
            <div class="taxis-empty">
              <div style="font-size:3rem">🚕</div>
              <h3>No hay traslados para esa búsqueda</h3>
              <p>Prueba con otra ciudad.</p>
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
    .taxis-page { min-height: 100vh; background: var(--c-base); }
    .taxis-hero { padding: var(--sp-16) 0 var(--sp-10); background: var(--g-hero); text-align: center; }
    .taxis-hero h1 { font-size: var(--f-4xl); font-weight: var(--w-9); letter-spacing: -.03em; margin: var(--sp-3) 0 var(--sp-4); }
    .taxis-hero p { color: var(--t-300); max-width: 52ch; margin: 0 auto var(--sp-8); }
    .taxis-search { display: flex; gap: var(--sp-3); max-width: 640px; margin: 0 auto; flex-wrap: wrap; }
    .taxis-search .rs-inp { flex: 1; min-width: 240px; }
    .taxis-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .taxis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .taxi-card { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl); overflow: hidden; box-shadow: var(--sh-card); transition: all var(--d-3); &:hover { box-shadow: var(--sh-lg); transform: translateY(-4px); .taxi-card__img img { transform: scale(1.06); } } }
    .taxi-card__img { position: relative; aspect-ratio: 16/10; overflow: hidden; background: linear-gradient(135deg, #143C7A, #1668E3); img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); } }
    .taxi-card__type { position: absolute; top: var(--sp-3); left: var(--sp-3); background: rgba(255,255,255,.92); color: var(--t-100); border-color: rgba(255,255,255,.6); backdrop-filter: blur(6px); }
    .taxi-card__body { padding: var(--sp-5); }
    .taxi-card__name { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .taxi-card__loc { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-3); }
    .taxi-card__meta { display: flex; gap: var(--sp-4); font-size: var(--f-xs); color: var(--t-300); margin-bottom: var(--sp-4); }
    .taxi-card__footer { display: flex; align-items: flex-end; justify-content: space-between; }
    .taxi-card__price { text-align: right; }
    .taxi-card__amount { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); letter-spacing: -.02em; }
    .taxi-card__period { font-size: var(--f-xs); color: var(--t-400); }
    .taxis-empty { grid-column: 1 / -1; text-align: center; padding: var(--sp-20); color: var(--t-400); h3 { color: var(--t-200); margin: var(--sp-4) 0 var(--sp-2); } }
  `],
})
export class TaxisListaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxisService = inject(TaxisService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly taxis = signal<TaxiCard[]>([]);

  readonly searchForm = this.fb.group({ ciudad: [''] });

  ngOnInit(): void {
    void this.cargar();
  }

  async buscar(): Promise<void> {
    await this.cargar(this.searchForm.value.ciudad ?? undefined);
  }

  private async cargar(ciudad?: string): Promise<void> {
    this.cargando.set(true);
    try {
      const resultados = await this.taxisService.buscar(ciudad);
      this.taxis.set(resultados.length ? resultados : this.mock());
    } catch {
      this.taxis.set(this.mock());
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(t: TaxiCard): void {
    void this.router.navigate(['/reservas', 'taxis', t.id], {
      queryParams: {
        comercioId:  t.comercioId,
        nombre:      t.nombre,
        precioBase:  t.tarifaBase,
        imagen:      t.imagen,
      },
    });
  }

  tipoLabel(tipo: string): string {
    const map: Record<string, string> = { sedan: '🚗 Sedán', suv: '🚙 SUV', van: '🚐 Van', premium: '✨ Premium' };
    return map[tipo] ?? tipo;
  }

  private mock(): TaxiCard[] {
    return [
      { id: 't1', nombre: 'Traslado Aeropuerto Madrid-Barajas', ciudad: 'Madrid', imagen: '', comercioId: '', tipoVehiculo: 'sedan', capacidad: 4, tarifaBase: 25, tarifaKm: 1.2, score: 4.7, scoreLabel: 'Muy bueno', numResenas: 320 },
      { id: 't2', nombre: 'VTC Premium Barcelona', ciudad: 'Barcelona', imagen: '', comercioId: '', tipoVehiculo: 'premium', capacidad: 4, tarifaBase: 35, tarifaKm: 1.8, score: 4.9, scoreLabel: 'Excepcional', numResenas: 210 },
      { id: 't3', nombre: 'Van 8 plazas Valencia', ciudad: 'Valencia', imagen: '', comercioId: '', tipoVehiculo: 'van', capacidad: 8, tarifaBase: 40, tarifaKm: 1.5, score: 4.6, scoreLabel: 'Muy bueno', numResenas: 140 },
    ];
  }
}
