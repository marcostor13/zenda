import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import { TransporteService, TransporteCard, TipoVehiculoTransporte } from '../services/transporte.service';

@Component({
  selector: 'app-transporte-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent, RsIconComponent, ImgFallbackDirective, AnimateOnScrollDirective],
  template: `
<div class="transporte-page">
  <rs-navbar />

  <section class="transporte-hero">
    <div class="rs-wrap">
      <span class="rs-label-caps">Transporte de animales</span>
      <h1>Lleva a tu perro <span class="rs-gradient-text">a cualquier lugar</span></h1>
      <p>Vehículos acondicionados, conductores especializados y tarifas transparentes. Tu perro viaja seguro y cómodo.</p>

      <form [formGroup]="searchForm" (ngSubmit)="buscar()" class="transporte-search">
        <input formControlName="ciudad" class="rs-inp rs-inp--lg" placeholder="¿En qué ciudad? (Madrid, Barcelona…)" />
        <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg">Buscar</button>
      </form>
    </div>
  </section>

  <section class="rs-section">
    <div class="rs-wrap">
      @if (cargando()) {
        <div class="transporte-grid">
          @for (_ of [1,2,3,4,5,6]; track $index) {
            <div class="rs-skeleton rs-skeleton--img" style="height:280px;border-radius:var(--r-xl)"></div>
          }
        </div>
      } @else {
        <p class="transporte-count">{{ transportes().length }} servicios de transporte disponibles</p>
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

          @if (transportes().length === 0) {
            <div class="transporte-empty">
              <rs-icon name="paw" size="48" />
              <h3>No hay transportes para esa búsqueda</h3>
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
    .transporte-page { min-height: 100vh; background: var(--c-base); }
    .transporte-hero { padding: var(--sp-16) 0 var(--sp-10); background: var(--g-hero); text-align: center; }
    .transporte-hero h1 { font-size: var(--f-4xl); font-weight: var(--w-9); letter-spacing: -.03em; margin: var(--sp-3) 0 var(--sp-4); color: var(--dk-blue); }
    .transporte-hero p { color: var(--t-300); max-width: 52ch; margin: 0 auto var(--sp-8); }
    .transporte-search { display: flex; gap: var(--sp-3); max-width: 640px; margin: 0 auto; flex-wrap: wrap; }
    .transporte-search .rs-inp { flex: 1; min-width: 240px; }
    .transporte-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
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
  private readonly fb = inject(FormBuilder);
  private readonly transporteService = inject(TransporteService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly transportes = signal<TransporteCard[]>([]);

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
      const resultados = await this.transporteService.buscar(ciudad);
      this.transportes.set(resultados.length ? resultados : this.mock());
    } catch {
      this.transportes.set(this.mock());
    } finally {
      this.cargando.set(false);
    }
  }

  solicitar(t: TransporteCard): void {
    void this.router.navigate(['/reservas', 'transporte', t.id], {
      queryParams: {
        comercioId:  t.comercioId,
        nombre:      t.nombre,
        precioBase:  t.tarifaBase,
        imagen:      t.imagen,
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

  private mock(): TransporteCard[] {
    return [
      { id: 'tr1', nombre: 'DogVan Madrid — Traslados con cuidador', ciudad: 'Madrid', imagen: '', comercioId: '', tipoVehiculo: 'van_acondicionada', capacidadPerros: 4, zonaCobertura: ['Madrid', 'Toledo', 'Guadalajara'], tarifaBase: 15, tarifaKm: 0.9, jaulasIncluidas: true, acompananteHumano: true, destacado: true, score: 4.8, scoreLabel: 'Excepcional', numResenas: 214 },
      { id: 'tr2', nombre: 'PetMove Barcelona', ciudad: 'Barcelona', imagen: '', comercioId: '', tipoVehiculo: 'furgon_climatizado', capacidadPerros: 6, zonaCobertura: ['Barcelona', 'Girona', 'Tarragona'], tarifaBase: 20, tarifaKm: 1.1, jaulasIncluidas: true, acompananteHumano: false, destacado: false, score: 4.6, scoreLabel: 'Muy bueno', numResenas: 158 },
      { id: 'tr3', nombre: 'Traslados caninos Valencia', ciudad: 'Valencia', imagen: '', comercioId: '', tipoVehiculo: 'coche', capacidadPerros: 2, zonaCobertura: ['Valencia', 'Castellón'], tarifaBase: 10, tarifaKm: 0.7, jaulasIncluidas: false, acompananteHumano: true, destacado: false, score: 4.5, scoreLabel: 'Muy bueno', numResenas: 92 },
    ];
  }
}
