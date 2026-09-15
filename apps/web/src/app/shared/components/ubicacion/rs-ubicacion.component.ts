import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsMapaComponent } from '../mapa/rs-mapa.component';
import { PuntoUbicacion, enlaceComoLlegar, enlaceGoogleMaps, tieneCoordenadas } from '../../mapas/google-maps';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * "Dónde está" de la ficha de un servicio: el mapa con el punto exacto, la
 * dirección y las dos acciones que de verdad se piden desde aquí —abrirlo en
 * Google Maps y calcular la ruta—.
 *
 * Compartido por las fichas de todos los verticales: la ubicación se enseña
 * igual en un hotel canino que en una clínica, y duplicar el bloque garantizaba
 * que se quedara desactualizado en la mitad de ellos.
 *
 * Sin coordenadas no se pinta el mapa —un mapa centrado en el país no dice
 * nada— pero sí se ofrecen los enlaces con la dirección escrita, que es lo
 * único con lo que se puede llegar.
 */
@Component({
  selector: 'rs-ubicacion',
  standalone: true,
  imports: [
    TraducirPipe, RsIconComponent, RsMapaComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ubi" [class.ubi--compacta]="compacto()">
      <h3 class="ubi__titulo">
        <rs-icon name="map-pin" [size]="17" [stroke]="2" />
        {{ titulo() }}
      </h3>

      @if (direccionLegible()) {
        <p class="ubi__direccion">{{ direccionLegible() }}</p>
      }

      @if (punto(); as p) {
        <div class="ubi__mapa">
          <rs-mapa
            [puntos]="[p]"
            [centro]="{ lat: p.lat, lng: p.lng, zoom: 15 }"
            [ariaLabel]="'Mapa con la ubicación de ' + (lugar().nombre ?? 'el servicio')" />
        </div>
      } @else {
        <p class="ubi__sin-mapa">
          {{ 'Este negocio todavía no ha fijado su ubicación exacta.' | t }}
        </p>
      }

      @if (enlaceMapa() || enlaceRuta()) {
        <div class="ubi__acciones">
          @if (enlaceMapa(); as url) {
            <a class="rs-btn rs-btn--outline rs-btn--sm" [href]="url" target="_blank" rel="noopener">
              <rs-icon name="map-pin" [size]="14" [stroke]="2" />
              {{ 'Ver en Google Maps' | t }}
            </a>
          }
          @if (enlaceRuta(); as url) {
            <a class="rs-btn rs-btn--secondary rs-btn--sm" [href]="url" target="_blank" rel="noopener">
              <rs-icon name="navigation" [size]="14" [stroke]="2" />
              {{ 'Cómo llegar' | t }}
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .ubi__titulo {
      display: flex; align-items: center; gap: var(--sp-2);
      font-family: var(--font-display);
      font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100);
      margin-bottom: var(--sp-2);
    }
    .ubi__direccion { font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-3); }
    .ubi__sin-mapa { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-3); }
    .ubi__mapa {
      height: 280px; margin-bottom: var(--sp-3);
      border-radius: var(--r-xl); overflow: hidden;
      border: 1px solid var(--b-1);
    }
    .ubi__mapa rs-mapa { display: block; height: 100%; }
    .ubi__acciones { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .ubi--compacta {
      .ubi__titulo { font-size: var(--f-md); margin-bottom: var(--sp-1); }
      .ubi__direccion, .ubi__sin-mapa { font-size: var(--f-xs); margin-bottom: var(--sp-2); }
      .ubi__mapa { height: 160px; margin-bottom: var(--sp-2); border-radius: var(--r-lg); }
      /* Los dos enlaces, en una fila: en 380 px partidos ocupaban dos. */
      .ubi__acciones { flex-wrap: nowrap; .rs-btn { flex: 1; min-width: 0; } }
    }
  `],
})
export class RsUbicacionComponent {
  readonly lugar = input.required<PuntoUbicacion>();
  readonly titulo = input('Dónde está');
  /**
   * Versión para la columna lateral: mismo bloque, mapa más bajo.
   *
   * En el panel de reserva el mapa de 280 px dejaba la columna en más de 800,
   * y una columna pegajosa más alta que la pantalla se queda cortada por abajo
   * en cualquier portátil. A 160 px se sigue reconociendo el barrio, que es
   * para lo que se mira desde ahí: para el plano entero están los dos enlaces.
   */
  readonly compacto = input(false);

  /** Punto para el mapa; `null` mientras el negocio no tenga coordenadas. */
  readonly punto = computed(() => {
    const lugar = this.lugar();
    if (!tieneCoordenadas(lugar)) return null;
    return {
      id: 'ubicacion',
      lat: lugar.lat as number,
      lng: lugar.lng as number,
      titulo: lugar.nombre,
    };
  });

  readonly direccionLegible = computed(() => {
    const { direccion, ciudad } = this.lugar();
    return [direccion, ciudad].filter(Boolean).join(' · ');
  });

  readonly enlaceMapa = computed(() => enlaceGoogleMaps(this.lugar()));
  readonly enlaceRuta = computed(() => enlaceComoLlegar(this.lugar()));
}
