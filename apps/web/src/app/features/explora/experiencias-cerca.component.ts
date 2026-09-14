import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TIPO_LUGAR_LABELS, TipoLugar } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { fotoDeLugar } from '../../shared/media/images';
import { LugarApi, LugaresService, rutaDeLugar } from './lugares.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Carrusel "Descubre experiencias cerca de ti" bajo los resultados de búsqueda
 * (DK-K06). Es contenido de descubrimiento, no oferta reservable: por eso va
 * **después** de los resultados y no compite con ellos.
 *
 * Se oculta por completo si no hay nada que enseñar; una sección vacía resta.
 */
@Component({
  selector: 'app-experiencias-cerca',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsIconComponent, ImgFallbackDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (lugares().length) {
  <section class="ec">
    <div class="ec__head">
      <div>
        <h2>{{ 'Descubre experiencias cerca de ti' | t }}</h2>
        <p>Sitios donde llevar a tu perro{{ ciudad() ? ' en ' + ciudad() : '' }}, aportados por la comunidad.</p>
      </div>
      <a routerLink="/explora" [queryParams]="{ ciudad: ciudad() || null }" class="ec__link">
        {{ 'Ver todos' | t }}
        <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
      </a>
    </div>

    <ul class="ec__lista">
      @for (l of lugares(); track l._id) {
        <li>
          <a class="ec__card" [routerLink]="rutaDeLugar(l)">
            <div class="ec__img">
              <img [src]="foto(l)" [alt]="l.nombre" loading="lazy" rsImg />
            </div>
            <span class="ec__tipo">{{ etiqueta(l.tipo) }}</span>
            <strong>{{ l.nombre }}</strong>
            <em>{{ l.ubicacion.ciudad }}</em>
          </a>
        </li>
      }
    </ul>
  </section>
}
  `,
  styles: [`
    :host { display: block; }

    .ec { margin-top: var(--sp-10); padding-top: var(--sp-8); border-top: 1px solid var(--b-1); }

    .ec__head {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-5);

      h2 { font-size: var(--f-xl); color: var(--dk-blue); }
      p { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); }
    }

    .ec__link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--dk-blue);
      &:hover { text-decoration: underline; }
    }

    .ec__lista {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4);
      list-style: none;

      /* El ancho lo manda la columna, nunca la foto: una casilla de rejilla
         arranca en "min-width: auto", así que el ancho natural de la imagen
         cuenta como mínimo de la columna. Con una foto de comunidad subida a
         4032 px, la columna se iba a 4032 px y arrastraba el alto con ella. */
      > li { min-width: 0; }

      @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
      /* Móvil: carrusel, para no empujar el resto de la página. */
      @media (max-width: 560px) {
        grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 68%;
        overflow-x: auto; scroll-snap-type: x mandatory;
        margin-inline: calc(var(--sp-4) * -1); padding-inline: var(--sp-4);
        li { scroll-snap-align: start; }
      }
    }

    .ec__card {
      display: flex; flex-direction: column; gap: var(--sp-1);
      text-decoration: none;

      strong { font-size: var(--f-sm); color: var(--t-100); }
      em { font-style: normal; font-size: var(--f-xs); color: var(--t-400); }
      &:hover .ec__img img { transform: scale(1.06); }
      @media (prefers-reduced-motion: reduce) { &:hover .ec__img img { transform: none; } }
    }

    /*
      El alto de la foto lo manda la proporción, nunca la imagen.

      Safari/iOS no da por definido el ancho de una caja con "aspect-ratio"
      cuando ese ancho sale del estirado del contenedor (aquí, una casilla
      flexible sin "width"). Sin ancho definido no hay alto del que colgar el
      "height: 100%" de la foto, así que caía a su alto natural, y como la caja
      arranca en "min-height: auto" ese alto natural pasaba a ser su mínimo:
      una foto de comunidad de 4032x3024 dejaba la tarjeta en 3000 px de alto y
      el listado en un desplazamiento sin fin sobre el azul de este degradado.

      Ancho explícito, mínimo a cero y la foto fuera del flujo: así la caja mide
      lo que dice la proporción venga la foto que venga.
    */
    .ec__img {
      position: relative;
      width: 100%; min-width: 0; min-height: 0;
      aspect-ratio: 4/3; overflow: hidden; border-radius: var(--r-lg);
      background: linear-gradient(135deg, #143C7A, #1668E3);
      margin-bottom: var(--sp-2);
      img {
        position: absolute; inset: 0;
        width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4);
      }
    }

    .ec__tipo {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--dk-gold);
    }
  `],
})
export class ExperienciasCercaComponent {
  private readonly lugaresService = inject(LugaresService);

  /** Enlace a la ficha: la dirección legible si la tiene, el id si todavía no. */
  protected readonly rutaDeLugar = rutaDeLugar;

  /** Ciudad de la búsqueda en curso; sin ella se muestran los mejor valorados. */
  readonly ciudad = input<string | undefined>(undefined);
  readonly limite = input(4);

  readonly lugares = signal<LugarApi[]>([]);

  constructor() {
    effect(() => {
      const ciudad = this.ciudad();
      void this.cargar(ciudad);
    });
  }

  /** Foto propia si la hay; si no, una de ambiente de su tipo. */
  foto(lugar: LugarApi): string {
    return fotoDeLugar(lugar, 400);
  }

  etiqueta(tipo: TipoLugar): string {
    return TIPO_LUGAR_LABELS[tipo];
  }

  private async cargar(ciudad?: string): Promise<void> {
    try {
      this.lugares.set(await this.lugaresService.buscar({ ciudad, limit: this.limite() }));
    } catch {
      // Es contenido complementario: si falla, la búsqueda sigue siendo válida.
      this.lugares.set([]);
    }
  }
}
