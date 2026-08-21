import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RsBadgeComponent, type BadgeVariant } from '../badge/rs-badge.component';
import { RsRatingComponent } from '../rating/rs-rating.component';
import { RsStarsComponent } from '../stars/rs-stars.component';
import { RsFavoritoBtnComponent } from '../favorito-btn/rs-favorito-btn.component';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { RsIconComponent } from '../icon/rs-icon.component';

export interface CardBadge {
  label: string;
  variant?: BadgeVariant;
  /** Nombre de icono de `rs-icon` (Lucide). Nunca un emoji: TCK-8010. */
  icon?: string;
}

/**
 * Servicio destacado de la tarjeta. Admite texto suelto (uso histórico) o texto
 * con icono Lucide, que es lo que se debe usar en pantallas nuevas (TCK-8010).
 */
export type CardAmenity = string | { icon: string; label: string };

export interface CardRating {
  score: number | string;
  label?: string;
  count?: number;
}

export interface CardPrice {
  amount: number | string;
  period?: string;
  oldAmount?: number | string;
  discountLabel?: string;
}

/**
 * Componente Card unificado (HU-0.1/0.2/0.11). Con `imageUrl()` se renderiza
 * como tarjeta de resultado (imagen + badges + rating + precio + CTA, toda la
 * tarjeta clicable, altura uniforme dentro de un grid con `align-items:stretch`);
 * sin `imageUrl()` se comporta como antes (título/subtítulo + `<ng-content>`),
 * para no romper los usos existentes en paneles y formularios.
 */
@Component({
  selector: 'rs-card',
  standalone: true,
  imports: [CommonModule, RouterLink, RsBadgeComponent, RsRatingComponent, RsStarsComponent, RsFavoritoBtnComponent, ImgFallbackDirective, RsIconComponent],
  template: `
    @if (imageUrl()) {
      @if (routerLink()) {
        <a
          class="rs-hotel-card"
          [class.rs-hotel-card--horizontal]="horizontal()"
          [routerLink]="routerLink()!"
          [queryParams]="queryParams()">
          <ng-container *ngTemplateOutlet="cardBody" />
        </a>
      } @else {
        <article
          class="rs-hotel-card"
          [class.rs-hotel-card--horizontal]="horizontal()"
          [class.rs-hotel-card--clickable]="clickable()"
          (click)="onCardClick()">
          <ng-container *ngTemplateOutlet="cardBody" />
        </article>
      }
      <ng-template #cardBody>
        <div class="rs-hotel-card__img">
          <img [src]="imageUrl()" [alt]="imageAlt() || title()" loading="lazy" rsImg />
          @if (badges().length) {
            <div class="rs-hotel-card__img-badges">
              @for (b of badges(); track b.label) {
                <rs-badge [variant]="b.variant || 'accent'">
                  @if (b.icon) { <rs-icon [name]="b.icon" [size]="12" [stroke]="2.5" /> }
                  {{ b.label }}
                </rs-badge>
              }
            </div>
          }
          @if (favoritoServicioId()) {
            <div class="rs-hotel-card__wishlist" (click)="$event.stopPropagation()">
              <rs-favorito-btn [servicioId]="favoritoServicioId()!"></rs-favorito-btn>
            </div>
          }
        </div>
        <div class="rs-hotel-card__body">
          @if (title()) { <h3 class="rs-hotel-card__name">{{ title() }}</h3> }

          @if (horizontal()) {
            <!-- Valoración y ubicación en una línea, como en el listado de
                 alojamiento: las estrellas sitúan la nota de un vistazo y el
                 precio se lee aparte, en su propia columna. -->
            <p class="rs-hotel-card__meta">
              @if (sinValorar()) {
                <!-- Un servicio recien publicado no tiene nota: pintar "0" con
                     cinco estrellas vacias lo hace parecer valorado y pesimo,
                     que es lo contrario de lo que dice el dato. -->
                <span class="rs-hotel-card__nuevo">Nuevo</span>
                <span>Aún sin valoraciones</span>
              } @else if (rating(); as r) {
                <rs-stars [score]="+r.score" [size]="13" />
                <strong>{{ r.score }}</strong>
                @if (r.count) { <span>({{ r.count }} {{ r.count === 1 ? 'reseña' : 'reseñas' }})</span> }
              }
              @if (subtitle()) { <span class="rs-hotel-card__meta-loc">· {{ subtitle() }}</span> }
            </p>
          } @else if (subtitle()) {
            <p class="rs-hotel-card__loc"><rs-icon name="map-pin" [size]="14" [stroke]="2" /> {{ subtitle() }}</p>
          }
          <!-- La zona de etiquetas se pinta siempre, aunque el servicio no
               traiga ninguna: su hueco reservado es lo que mantiene el precio
               y el botón a la misma altura en todas las tarjetas. -->
          <div class="rs-hotel-card__amenities">
            @for (a of amenidadesVisibles(); track etiquetaAmenity(a)) {
              <span class="rs-amenity">
                @if (iconoAmenity(a); as icono) { <rs-icon [name]="icono" [size]="12" [stroke]="2" /> }
                {{ etiquetaAmenity(a) }}
              </span>
            }
          </div>
          <!-- Distintivos con marca de verificación, separados de las etiquetas
               porque no describen el servicio sino lo que incluye la reserva. -->
          @if (destacados().length) {
            <ul class="rs-hotel-card__destacados">
              @for (d of destacados(); track d) {
                <li><rs-icon name="check" [size]="13" [stroke]="2.5" /> {{ d }}</li>
              }
            </ul>
          }

          @if (!horizontal()) {
            <div class="rs-hotel-card__footer">
              @if (rating()) {
                <rs-rating [score]="rating()!.score" [label]="rating()!.label || ''" [count]="rating()!.count ?? null" size="sm"></rs-rating>
              }
              <ng-container *ngTemplateOutlet="bloquePrecio" />
            </div>
            <ng-container *ngTemplateOutlet="bloqueAccion" />
          }
          <!--
            En apaisado el precio cierra el cuerpo, no una columna aparte: es lo
            último que se lee de cada tarjeta y así queda alineado con el nombre
            en vez de contra el borde derecho de la pantalla.
          -->
          @if (horizontal()) {
            <div class="rs-hotel-card__pie">
              <div class="rs-hotel-card__pie-precio">
                <ng-container *ngTemplateOutlet="bloquePrecio" />
                @if (notaPrecio()) { <span class="rs-hotel-card__nota">{{ notaPrecio() }}</span> }
              </div>
              <ng-container *ngTemplateOutlet="bloqueAccion" />
            </div>
          }
          <ng-content select="[cardFooter]" />
        </div>
      </ng-template>

      <ng-template #bloquePrecio>
        @if (price()) {
          <div class="rs-price">
            @if (price()!.oldAmount) { <span class="rs-price__old">{{ price()!.oldAmount }}</span> }
            <span class="rs-price__amount">{{ price()!.amount }}</span>
            @if (price()!.period) { <span class="rs-price__period">{{ price()!.period }}</span> }
          </div>
        }
      </ng-template>

      <!-- El aviso ocupa el sitio del botón, no se añade debajo: así la tarjeta
           no cambia de alto al confirmar una solicitud. -->
      <ng-template #bloqueAccion>
        @if (mensaje()) {
          <div class="rs-alert rs-alert--success rs-hotel-card__cta">{{ mensaje() }}</div>
        } @else if (ctaLabel()) {
          <button type="button"
                  class="rs-btn rs-btn--primary rs-btn--block rs-hotel-card__cta"
                  [class.rs-hotel-card__cta--escritorio]="accionSoloEscritorio()"
                  (click)="onCtaClick($event)">
            {{ ctaLabel() }}
          </button>
        }
      </ng-template>
    } @else {
      <div [class]="cardClasses">
        @if (title()) {
          <div class="rs-card__header">
            <h3 class="rs-card__title">{{ title() }}</h3>
            @if (subtitle()) {
              <p class="rs-card__subtitle">{{ subtitle() }}</p>
            }
          </div>
        }
        <ng-content />
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    :host:has(.rs-hotel-card) { height: 100%; }

    /* La dirección se lee de una variable en vez de fijarse aquí: Angular
       añade [_ngcontent-…] a los estilos de componente y eso sube su
       especificidad por encima de la hoja global, así que fijar aquí
       flex-direction en column ganaba siempre y la variante
       apaisada (.rs-hotel-card--horizontal, en styles.scss) no se aplicaba
       nunca. Con la variable, la hoja global solo cambia el valor y no tiene
       que pelear por especificidad. */
    .rs-hotel-card {
      height: 100%;
      display: flex;
      flex-direction: var(--rs-card-dir, column);
    }

    .rs-hotel-card--clickable { cursor: pointer; }
    .rs-hotel-card__amount { font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue); }

    .rs-card__header {
      margin-bottom: var(--s-6);
    }

    .rs-card__title {
      font-size: var(--text-xl);
      font-weight: var(--fw-bold);
      color: var(--text-primary);
      margin-bottom: var(--s-1);
    }

    .rs-card__subtitle {
      font-size: var(--text-sm);
      color: var(--text-muted);
    }
  `],
})
export class RsCardComponent {
  readonly title    = input<string>('');
  readonly subtitle = input<string>('');
  readonly glass    = input(false);
  readonly padding  = input<'sm' | 'md' | 'lg'>('md');

  /** Modo "tarjeta de resultado": si se define, sustituye el render simple por el layout completo. */
  readonly imageUrl = input<string>('');
  readonly imageAlt = input<string>('');
  readonly badges = input<CardBadge[]>([]);
  readonly rating = input<CardRating | null>(null);
  readonly price = input<CardPrice | null>(null);
  readonly amenities = input<CardAmenity[]>([]);
  readonly ctaLabel = input<string>('');
  /**
   * Aviso que sustituye al botón una vez completada la acción (p. ej. "Cita
   * solicitada"). Va aquí y no proyectado para que ocupe exactamente el mismo
   * hueco que el botón y la tarjeta no se descuadre respecto a sus vecinas.
   */
  readonly mensaje = input<string>('');
  readonly clickable = input(true);

  /**
   * Disposición de la tarjeta. `true` la pinta apaisada (foto · contenido ·
   * precio), que es el formato de los listados de resultados; `false` la deja
   * en columna, para escaparates como el de la portada.
   */
  readonly horizontal = input(false);

  /** Lo que incluye la reserva, con marca de verificación bajo las etiquetas. */
  readonly destacados = input<string[]>([]);

  /** Letra pequeña bajo el precio ("IVA incluido"). Solo en horizontal. */
  readonly notaPrecio = input<string>('');

  /**
   * El botón sólo lleva a donde ya lleva la tarjeta entera. En móvil se
   * esconde: el ancho del cuerpo no da para el precio con su unidad y una
   * etiqueta larga a la vez, y de las dos cosas la que se puede quitar sin
   * perder nada es el botón, porque tocar la tarjeta hace lo mismo. Los
   * listados cuyo botón hace algo más (solicitar una cita, por ejemplo) lo
   * dejan en false.
   */
  readonly accionSoloEscritorio = input(false);
  readonly favoritoServicioId = input<string | null>(null);
  /** Si se define, toda la tarjeta se renderiza como `<a routerLink>` (SEO, ctrl+click) en vez de `<article (click)>`. */
  readonly routerLink = input<string | unknown[] | null>(null);
  readonly queryParams = input<Record<string, unknown>>({});

  readonly cardClick = output<void>();
  /**
   * Acción del botón para las tarjetas que no navegan a una ficha (pedir cita,
   * reservar sesión…). Antes cada listado proyectaba su propio botón por
   * `[cardFooter]`, y ese DOM distinto lo dejaba a otra altura.
   */
  readonly ctaClick = output<void>();

  /**
   * Tope de etiquetas visibles. Lo aplica la tarjeta y no cada listado para
   * que todos los verticales enseñen lo mismo. En apaisado cabe más porque el
   * contenido dispone de todo el ancho; en columna, tres es lo que entra sin
   * que la tarjeta crezca a lo alto.
   */
  private static readonly MAX_AMENITIES_HORIZONTAL = 6;
  private static readonly MAX_AMENITIES_VERTICAL = 3;

  readonly amenidadesVisibles = computed(() =>
    this.amenities().slice(0, this.horizontal()
      ? RsCardComponent.MAX_AMENITIES_HORIZONTAL
      : RsCardComponent.MAX_AMENITIES_VERTICAL),
  );

  /**
   * Servicio sin ninguna resena. Se mira el contador y no la nota: un score de
   * 0 con 12 resenas es un dato real que hay que ensenar, mientras que 0 de 0
   * es simplemente que todavia no lo ha valorado nadie.
   */
  readonly sinValorar = computed(() => {
    const r = this.rating();
    return !!r && !r.count && !+r.score;
  });

  get cardClasses(): string {
    const classes = ['rs-card'];
    if (this.glass()) classes.push('rs-card--glass');
    if (this.padding() === 'sm') classes.push('rs-card--sm');
    if (this.padding() === 'lg') classes.push('rs-card--lg');
    return classes.join(' ');
  }

  onCardClick(): void {
    if (this.clickable()) this.cardClick.emit();
  }

  /**
   * En una tarjeta con `routerLink` el botón vive dentro del enlace y debe
   * dejar navegar; en una tarjeta de acción se queda el evento para no
   * disparar además el clic de la tarjeta entera.
   */
  onCtaClick(evento: Event): void {
    if (this.routerLink()) return;
    evento.stopPropagation();
    this.ctaClick.emit();
  }

  etiquetaAmenity(amenity: CardAmenity): string {
    return typeof amenity === 'string' ? amenity : amenity.label;
  }

  iconoAmenity(amenity: CardAmenity): string {
    return typeof amenity === 'string' ? '' : amenity.icon;
  }
}
