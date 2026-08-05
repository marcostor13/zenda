import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsSearchBarComponent } from '../../../shared/components/search-bar/rs-search-bar.component';
import { AnimateOnScrollDirective } from '../../../shared/directives/animate-on-scroll.directive';
import {
  RsCardComponent, type CardAmenity, type CardBadge,
} from '../../../shared/components/card/rs-card.component';
import { subtitularDeVertical, titularDeVertical, verticalUi } from '../../../shared/verticales/verticales.config';
import { TransporteService, TransporteCard, TipoVehiculoTransporte } from '../services/transporte.service';
import { calcularBadgesAutomaticos } from '../../../shared/badges/badges-automaticos';

@Component({
  selector: 'app-transporte-lista',
  standalone: true,
  imports: [
    RsNavbarComponent, RsIconComponent, RsSearchBarComponent,
    AnimateOnScrollDirective, RsCardComponent,
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
            <rs-card rsAnim
              [imageUrl]="t.imagen" [imageAlt]="t.nombre"
              [title]="t.nombre" [subtitle]="t.ciudad"
              [badges]="badgesDe(t)"
              [rating]="{ score: t.score, label: t.scoreLabel, count: t.numResenas }"
              [price]="{ amount: 'desde €' + t.tarifaBase, period: '+ €' + t.tarifaKm + '/km' }"
              [amenities]="serviciosDe(t)"
              [favoritoServicioId]="t.id"
              [routerLink]="['/transporte', t.id]"
              ctaLabel="Ver ficha">
            </rs-card>
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
    .transporte-searchbar {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--c-card);
      padding-block: var(--sp-5);
      box-shadow: var(--sh-md);
      border-radius: 0 0 var(--r-lg) var(--r-lg);
    }
    .transporte-head { margin-bottom: var(--sp-6); }
    .transporte-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .transporte-head p { color: var(--t-400); max-width: 62ch; margin-top: var(--sp-2); font-size: var(--f-md); }
    .transporte-count { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-5); }
    .transporte-count__ciudad { color: var(--dk-blue); font-weight: var(--w-6); }
    /* La tarjeta (imagen 70-75%, badges, rating, precio) la aporta <rs-card>
       en modo "resultado" (HU-3.1) — ver rs-card.component.ts. */
    .transporte-grid { display: grid; grid-template-columns: repeat(3, 1fr); align-items: stretch; gap: var(--sp-5); @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .transporte-empty { grid-column: 1 / -1; text-align: center; padding: var(--sp-20); color: var(--t-400); rs-icon { color: var(--dk-gold); } h3 { color: var(--t-200); margin: var(--sp-4) 0 var(--sp-2); } }
  `],
})
export class TransporteListaComponent implements OnInit {
  private readonly transporteService = inject(TransporteService);
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

  tipoLabel(tipo: TipoVehiculoTransporte): string {
    const map: Record<TipoVehiculoTransporte, string> = {
      van_acondicionada: 'Van acondicionada',
      coche: 'Coche',
      furgon_climatizado: 'Furgón climatizado',
    };
    return map[tipo] ?? tipo;
  }

  /** Icono Lucide del vehículo; sustituye a los emojis de la tarjeta (TCK-8010). */
  private iconoVehiculo(tipo: TipoVehiculoTransporte): string {
    const map: Record<TipoVehiculoTransporte, string> = {
      van_acondicionada: 'truck',
      coche: 'car',
      furgon_climatizado: 'truck',
    };
    return map[tipo] ?? 'car';
  }

  /** Badges de la tarjeta unificada (HU-3.1/HU-3.2): tipo de vehículo + destacado + automáticos. */
  badgesDe(t: TransporteCard): CardBadge[] {
    const badges: CardBadge[] = [
      { icon: this.iconoVehiculo(t.tipoVehiculo), label: this.tipoLabel(t.tipoVehiculo) },
    ];
    if (t.destacado) badges.push({ icon: 'star', label: 'Premium', variant: 'warning' });
    badges.push(...calcularBadgesAutomaticos({ score: t.score, numResenas: t.numResenas }));
    return badges;
  }

  /** Servicios como iconos en una línea bajo la foto (HU-3.1). */
  serviciosDe(t: TransporteCard): CardAmenity[] {
    const items: CardAmenity[] = [
      { icon: 'paw', label: `Hasta ${t.capacidadPerros} ${t.capacidadPerros === 1 ? 'perro' : 'perros'}` },
    ];
    if (t.jaulasIncluidas) items.push({ icon: 'check', label: 'Jaulas incluidas' });
    if (t.acompananteHumano) items.push({ icon: 'check', label: 'Puedes acompañarlo' });
    if (t.zonaCobertura.length) {
      items.push({ icon: 'map-pin', label: `Cubre ${t.zonaCobertura.slice(0, 3).join(', ')}` });
    }
    return items;
  }

}
