import {
  ChangeDetectionStrategy, Component, computed, input, linkedSignal, output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsIconComponent } from '../icon/rs-icon.component';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { IMG_FALLBACK } from '../../media/images';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import type { PuntoMapa } from '../mapa/rs-mapa.component';

/**
 * Ficha del pin elegido en el buscador por mapa, al estilo de Booking: las
 * fotos del comercio en carrusel, su nombre, dónde está, la nota, el precio y
 * el paso a la ficha completa.
 *
 * Es un componente de Angular y no la tarjeta emergente del proveedor del mapa
 * porque aquella sólo admite HTML plano: sin carrusel, sin `routerLink` y con
 * un aspecto distinto según pinte Google u OpenStreetMap.
 */
@Component({
  selector: 'rs-ficha-mapa',
  standalone: true,
  imports: [RouterLink, RsIconComponent, ImgFallbackDirective, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<article class="fm" [attr.aria-label]="punto().titulo">
  <div class="fm__fotos">
    <img class="fm__foto" [src]="fotoActual()" rsImg [alt]="punto().titulo ?? ''" />

    @if (fotos().length > 1) {
      <button type="button" class="fm__flecha fm__flecha--ant"
              [attr.aria-label]="'Foto anterior' | t" (click)="mover(-1)">
        <rs-icon name="chevron-left" [size]="18" [stroke]="2.5" />
      </button>
      <button type="button" class="fm__flecha fm__flecha--sig"
              [attr.aria-label]="'Foto siguiente' | t" (click)="mover(1)">
        <rs-icon name="chevron-right" [size]="18" [stroke]="2.5" />
      </button>
      <span class="fm__cuenta" aria-hidden="true">{{ indice() + 1 }} / {{ fotos().length }}</span>
    }
  </div>

  <!-- Cuelga de la ficha y no de la foto: en móvil la foto es un tercio del
       ancho y el cierre quedaría pegado a las flechas del carrusel. -->
  <button type="button" class="fm__cerrar" [attr.aria-label]="'Cerrar' | t" (click)="cerrar.emit()">
    <rs-icon name="x" [size]="16" [stroke]="2.5" />
  </button>

  <div class="fm__cuerpo">
    <h3 class="fm__titulo">
      @if (punto().enlace; as enlace) {
        <a [routerLink]="enlace">{{ punto().titulo }}</a>
      } @else {
        {{ punto().titulo }}
      }
    </h3>

    @if (punto().subtitulo) {
      <p class="fm__lugar">
        <rs-icon name="map-pin" [size]="13" [stroke]="2" />
        {{ punto().subtitulo }}
      </p>
    }

    <div class="fm__datos">
      <span class="fm__valoracion">
        @if (punto().rating) {
          <span class="fm__nota">{{ nota() }}</span>
          @if (punto().totalResenas; as total) {
            <span class="fm__resenas">{{ (total === 1 ? '{n} reseña' : '{n} reseñas') | t: { n: total } }}</span>
          }
        } @else {
          <span class="rs-badge rs-badge--accent">{{ 'Nuevo' | t }}</span>
        }
      </span>

      @if (punto().etiqueta) {
        <span class="fm__precio">
          <span class="fm__desde">{{ 'Desde' | t }}</span>
          <strong>{{ punto().etiqueta }}</strong>
        </span>
      }
    </div>

    @if (punto().enlace; as enlace) {
      <a class="rs-btn rs-btn--primary rs-btn--sm rs-btn--block fm__cta" [routerLink]="enlace">
        {{ 'Ver ficha' | t }}
        <rs-icon name="arrow-right" [size]="15" [stroke]="2.5" />
      </a>
    }
  </div>
</article>
  `,
  styles: [`
    :host { display: block; }

    .fm {
      position: relative;
      overflow: hidden;
      background: var(--c-card);
      border-radius: var(--r-xl);
      box-shadow: var(--sh-xl);
      animation: fm-entrar var(--t-base, .2s) ease-out;
    }

    @keyframes fm-entrar {
      from { opacity: 0; transform: translateY(var(--sp-3)); }
      to { opacity: 1; transform: none; }
    }

    .fm__fotos {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--c-raised);
    }

    .fm__foto {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .fm__flecha,
    .fm__cerrar {
      position: absolute;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: var(--r-full);
      background: var(--c-card);
      box-shadow: var(--sh-md);
      color: var(--t-100);
      cursor: pointer;

      &:hover { background: var(--c-raised); }
    }

    /* El objetivo táctil llega a 44px sin agrandar el botón que se ve. */
    .fm__flecha::before,
    .fm__cerrar::before {
      content: '';
      position: absolute;
      inset: -6px;
    }

    .fm__flecha { top: 50%; transform: translateY(-50%); }
    .fm__flecha--ant { left: var(--sp-2); }
    .fm__flecha--sig { right: var(--sp-2); }
    .fm__cerrar { top: var(--sp-2); right: var(--sp-2); }

    .fm__cuenta {
      position: absolute;
      left: var(--sp-2);
      bottom: var(--sp-2);
      padding: 2px var(--sp-2);
      border-radius: var(--r-full);
      background: var(--dk-blue-deep);
      color: #fff;
      font-size: var(--f-xs);
      font-weight: var(--w-6);
    }

    .fm__cuerpo {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4) var(--sp-4);
    }

    .fm__titulo {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--f-md);
      font-weight: var(--w-7);
      line-height: 1.25;
      color: var(--dk-blue);
      /* Dos líneas como mucho: un nombre largo no puede empujar el precio
         fuera de la ficha. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;

      a { color: inherit; text-decoration: none; }
      a:hover { text-decoration: underline; }
    }

    .fm__lugar {
      display: flex;
      align-items: center;
      gap: var(--sp-1);
      margin: 0;
      color: var(--t-400);
      font-size: var(--f-sm);
    }

    .fm__datos {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .fm__valoracion {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 0;
    }

    /* Mismo marcador de puntuación que Booking: la nota en su insignia. */
    .fm__nota {
      padding: var(--sp-1) var(--sp-2);
      border-radius: var(--r-md) var(--r-md) var(--r-md) 0;
      background: var(--dk-blue);
      color: #fff;
      font-size: var(--f-sm);
      font-weight: var(--w-7);
    }

    .fm__resenas { color: var(--t-400); font-size: var(--f-xs); }

    .fm__precio {
      display: inline-flex;
      align-items: baseline;
      gap: var(--sp-1);
      white-space: nowrap;
      color: var(--t-100);

      strong { font-size: var(--f-lg); font-weight: var(--w-7); }
    }

    .fm__desde { color: var(--t-400); font-size: var(--f-xs); }

    .fm__cta { margin-top: var(--sp-1); text-decoration: none; }

    /* Móvil: foto a un lado y datos al otro. Apilada ocuparía media pantalla y
       taparía justo el mapa que se está explorando. */
    @media (max-width: 640px) {
      .fm { display: grid; grid-template-columns: 38% minmax(0, 1fr); }
      .fm__fotos { aspect-ratio: auto; min-height: 148px; }
      .fm__cuerpo { padding: var(--sp-3); }
      /* Hueco para el cierre, que aquí cae sobre los datos y no sobre la foto. */
      .fm__titulo { font-size: var(--f-base); padding-right: var(--sp-10, 2.5rem); }
      .fm__cerrar { box-shadow: none; background: var(--c-raised); }
    }

    @media (prefers-reduced-motion: reduce) {
      .fm { animation: none; }
    }
  `],
})
export class RsFichaMapaComponent {
  readonly punto = input.required<PuntoMapa>();
  readonly cerrar = output<void>();

  /** Fotos del carrusel; con una sola miniatura no hay nada que pasar. */
  readonly fotos = computed<readonly string[]>(() => {
    const punto = this.punto();
    if (punto.imagenes?.length) return punto.imagenes;
    return punto.imagen ? [punto.imagen] : [];
  });

  /** Vuelve a la primera foto al cambiar de pin: el índice es de cada ficha. */
  readonly indice = linkedSignal<string, number>({
    source: () => this.punto().id,
    computation: () => 0,
  });

  readonly fotoActual = computed(() => this.fotos()[this.indice()] ?? IMG_FALLBACK);
  readonly nota = computed(() => (this.punto().rating ?? 0).toFixed(1));

  /** Pasa de foto en círculo: tras la última vuelve la primera. */
  mover(paso: number): void {
    const total = this.fotos().length;
    if (total < 2) return;
    this.indice.update((actual) => (actual + paso + total) % total);
  }
}
