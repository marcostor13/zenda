import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TIPO_LUGAR_LABELS, TipoLugar, VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsStarsComponent } from '../../shared/components/stars/rs-stars.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { fotoDeLugar } from '../../shared/media/images';
import { rutaDeVertical } from '../../shared/verticales/verticales.config';
import { LugarApi, LugarReviewApi, LugaresService } from './lugares.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Cómo se lee cada atributo en la ficha; el resto se muestran tal cual. */
const ATRIBUTO_LABELS: Record<string, string> = {
  vallado: 'Vallado',
  sombra: 'Zonas de sombra',
  iluminacion: 'Iluminación',
  agility: 'Circuito de agility',
  superficie: 'Superficie',
  duchas: 'Duchas',
  fuentes: 'Fuentes de agua',
  aparcamiento: 'Aparcamiento',
  normativa: 'Normativa',
  temporada: 'Temporada',
  ocupacion: 'Ocupación habitual',
  terraza: 'Terraza',
  interior: 'Admite perros en interior',
  bebederos: 'Bebederos',
  menuCanino: 'Menú canino',
};

/**
 * Ficha de un lugar de la comunidad. Cierra el círculo con el marketplace:
 * debajo de la información enlaza los servicios de Doogking en esa ciudad, que
 * es la razón de negocio por la que existe el módulo.
 */
@Component({
  selector: 'app-explora-detalle',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, RouterLink, RsNavbarComponent, RsIconComponent, ImgFallbackDirective, RsStarsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ed-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--lg ed-wrap">
    <a routerLink="/explora" class="back-link">
      <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon> {{ 'Explora con tu mascota' | t }}
    </a>

    @if (cargando()) {
      <p class="ed-cargando">{{ 'Cargando…' | t }}</p>
    } @else if (!lugar()) {
      <div class="rs-alert rs-alert--error">{{ 'No hemos encontrado este sitio.' | t }}</div>
    } @else {
      <header class="ed-head">
        <p class="ed-tipo">{{ etiquetaTipo() }}</p>
        <h1>{{ lugar()!.nombre }}</h1>
        <p class="ed-loc">
          <rs-icon name="map-pin" [size]="15" [stroke]="2"></rs-icon>
          {{ lugar()!.ubicacion.direccion || lugar()!.ubicacion.ciudad }}@if (lugar()!.ubicacion.provincia) { · {{ lugar()!.ubicacion.provincia }} }
        </p>
        @if (lugar()!.totalReviews) {
          <p class="ed-rating">
            <rs-icon name="star" [size]="15" [stroke]="2"></rs-icon>
            {{ lugar()!.ratingPromedio }} sobre 5 · {{ lugar()!.totalReviews }} opiniones
          </p>
        }
      </header>

      <!--
        Con fotos propias se enseñan todas; sin ellas, una de ambiente del tipo
        de sitio para que la ficha no abra con un hueco. No se hace pasar por
        una foto del lugar: el pie lo dice.
      -->
      @if (lugar()!.fotos.length) {
        <div class="ed-fotos">
          @for (f of lugar()!.fotos.slice(0, 4); track f) {
            <img [src]="f" [alt]="lugar()!.nombre" loading="lazy" rsImg />
          }
        </div>
      } @else {
        <figure class="ed-fotos ed-fotos--ambiente">
          <img [src]="fotoAmbiente()" [alt]="" aria-hidden="true" loading="lazy" rsImg />
          <figcaption>
            {{ 'Imagen de ambiente. ¿Has estado aquí? Sube tu foto y ayuda a los demás.' | t }}
          </figcaption>
        </figure>
      }

      @if (lugar()!.descripcion) {
        <p class="ed-desc">{{ lugar()!.descripcion }}</p>
      }

      @if (atributos().length) {
        <section class="ed-bloque">
          <h2>{{ 'Qué vas a encontrar' | t }}</h2>
          <dl class="ed-atributos">
            @for (a of atributos(); track a.clave) {
              <div>
                <dt>{{ a.etiqueta }}</dt>
                <dd>{{ a.valor }}</dd>
              </div>
            }
          </dl>
        </section>
      }

      @if (comoLlegar()) {
        <a class="rs-btn rs-btn--outline" [href]="comoLlegar()" target="_blank" rel="noopener">
          <rs-icon name="map-pin" [size]="15" [stroke]="2"></rs-icon>
          {{ 'Cómo llegar' | t }}
        </a>
      }

      <section class="ed-bloque">
        <h2>{{ 'Opiniones de la comunidad' | t }}</h2>
        @if (!reviews().length) {
          <p class="ed-vacio">{{ 'Aún no hay opiniones publicadas de este sitio.' | t }}</p>
        } @else {
          <ul class="ed-reviews">
            @for (r of reviews(); track r._id) {
              <li class="ed-review" [class.is-incidencia]="r.esIncidencia">
                <div class="ed-review__cabecera">
                  <strong>{{ r.usuarioNombre }}</strong>
                  @if (r.esIncidencia) {
                    <span class="ed-incidencia">
                      <rs-icon name="alert-circle" [size]="12" [stroke]="2"></rs-icon> {{ 'Incidencia' | t }}
                    </span>
                  } @else {
                    <rs-stars class="ed-estrellas" [score]="r.puntuacion" />
                  }
                  <em>{{ r.createdAt | date: 'd MMM y' }}</em>
                </div>
                @if (r.texto) { <p>{{ r.texto }}</p> }
              </li>
            }
          </ul>
        }
      </section>

      <!-- Aquí es donde la comunidad devuelve tráfico al marketplace. -->
      <section class="ed-servicios">
        <div>
          <h2>Servicios de Doogking en {{ lugar()!.ubicacion.ciudad }}</h2>
          <p>{{ '¿Vas a pasar el día por la zona? Reserva peluquería, veterinario o alojamiento cerca.' | t }}</p>
        </div>
        <div class="ed-servicios__acciones">
          <a class="rs-btn rs-btn--gold" [routerLink]="rutaAlojamiento"
             [queryParams]="{ ciudad: lugar()!.ubicacion.ciudad }">
            {{ 'Ver alojamientos' | t }}
          </a>
          <a class="rs-btn rs-btn--outline" [routerLink]="rutaPeluqueria"
             [queryParams]="{ ciudad: lugar()!.ubicacion.ciudad }">
            {{ 'Ver peluquerías' | t }}
          </a>
        </div>
      </section>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .ed-page { min-height: 100vh; background: var(--c-base); }
    .ed-wrap { padding-block: var(--sp-8); }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      color: var(--t-400); font-size: var(--f-sm); text-decoration: none; margin-bottom: var(--sp-4);
    }
    .ed-cargando { color: var(--t-400); }

    .ed-head { margin-bottom: var(--sp-6); }
    .ed-tipo {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .ed-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .ed-loc, .ed-rating {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-2); font-size: var(--f-sm); color: var(--t-400);
    }
    .ed-rating { color: var(--dk-blue); font-weight: var(--w-6); }

    .ed-fotos {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2);
      margin-bottom: var(--sp-6);
      img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--r-lg); }
      @media (max-width: 640px) { grid-template-columns: repeat(2, 1fr); }
    }

    /* Sin fotos propias: una sola imagen apaisada, no una rejilla de cuadrados
       repetidos, y con el pie que aclara que es de ambiente. */
    .ed-fotos--ambiente {
      display: block;

      img { aspect-ratio: 21 / 9; }
    }
    .ed-fotos--ambiente figcaption {
      margin-top: var(--sp-2);
      font-size: var(--f-xs); color: var(--t-400);
    }

    .ed-desc { color: var(--t-300); line-height: 1.7; max-width: 72ch; margin-bottom: var(--sp-6); }

    .ed-bloque { margin-block: var(--sp-8); }
    .ed-bloque h2 { font-size: var(--f-xl); color: var(--dk-blue); margin-bottom: var(--sp-4); }

    .ed-atributos {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--sp-4);
      dt { font-size: var(--f-xs); color: var(--t-400); margin-bottom: 2px; }
      dd { font-size: var(--f-sm); color: var(--t-200); font-weight: var(--w-6); }
    }

    .ed-vacio { color: var(--t-400); font-size: var(--f-sm); }

    .ed-reviews { list-style: none; display: flex; flex-direction: column; gap: var(--sp-4); }
    .ed-review {
      padding: var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      &.is-incidencia { border-color: rgba(251,174,23,.5); background: rgba(251,174,23,.06); }
      p { margin-top: var(--sp-2); color: var(--t-300); line-height: 1.6; }
    }
    .ed-review__cabecera {
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
      strong { font-size: var(--f-sm); color: var(--t-100); }
      em { font-size: var(--f-xs); font-style: normal; color: var(--t-500); margin-left: auto; }
    }
    .ed-estrellas { color: var(--dk-gold); letter-spacing: .08em; }
    .ed-incidencia {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      font-size: var(--f-xs); font-weight: var(--w-6); color: #92600A;
    }

    .ed-servicios {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-6); flex-wrap: wrap;
      margin-top: var(--sp-10); padding: var(--sp-8);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      h2 { font-size: var(--f-xl); color: var(--dk-blue); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); max-width: 48ch; }
    }
    .ed-servicios__acciones { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
  `],
})
export class ExploraDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lugaresService = inject(LugaresService);

  readonly lugar = signal<LugarApi | null>(null);

  /**
   * Foto de ambiente del tipo de sitio, para cuando el lugar no tiene ninguna
   * propia. No es una foto del sitio y la ficha lo dice: el censo trae más de
   * cien municipios que nadie ha fotografiado todavia.
   */
  readonly fotoAmbiente = computed(() => {
    const l = this.lugar();
    return l ? fotoDeLugar(l, 1200) : '';
  });
  readonly reviews = signal<LugarReviewApi[]>([]);
  readonly cargando = signal(true);

  readonly rutaAlojamiento = rutaDeVertical(VerticalKey.ALOJAMIENTO);
  readonly rutaPeluqueria = rutaDeVertical(VerticalKey.PELUQUERIA);

  readonly atributos = computed(() =>
    Object.entries(this.lugar()?.atributos ?? {})
      // Un `false` no aporta nada en una ficha de descubrimiento: solo se listan
      // las cosas que el sitio SÍ tiene.
      .filter(([, valor]) => valor !== false && valor !== null && valor !== '')
      .map(([clave, valor]) => ({
        clave,
        etiqueta: ATRIBUTO_LABELS[clave] ?? clave,
        valor: valor === true ? 'Sí' : String(valor),
      })),
  );

  readonly comoLlegar = computed(() => {
    const geo = this.lugar()?.ubicacion.geo;
    if (!geo) return '';
    const [lng, lat] = geo.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const [lugar, reviews] = await Promise.all([
        this.lugaresService.obtener(id),
        this.lugaresService.reviews(id),
      ]);
      this.lugar.set(lugar);
      this.reviews.set(reviews);
    } catch {
      this.lugar.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  etiquetaTipo(): string {
    const tipo = this.lugar()?.tipo;
    return tipo ? TIPO_LUGAR_LABELS[tipo as TipoLugar] : '';
  }

}
