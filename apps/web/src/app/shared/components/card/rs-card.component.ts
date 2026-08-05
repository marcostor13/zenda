import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RsBadgeComponent, type BadgeVariant } from '../badge/rs-badge.component';
import { RsRatingComponent } from '../rating/rs-rating.component';
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
  imports: [CommonModule, RouterLink, RsBadgeComponent, RsRatingComponent, RsFavoritoBtnComponent, ImgFallbackDirective, RsIconComponent],
  template: `
    @if (imageUrl()) {
      @if (routerLink()) {
        <a
          class="rs-hotel-card"
          [routerLink]="routerLink()!"
          [queryParams]="queryParams()">
          <ng-container *ngTemplateOutlet="cardBody" />
        </a>
      } @else {
        <article
          class="rs-hotel-card"
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
          @if (subtitle()) {
            <p class="rs-hotel-card__loc"><rs-icon name="map-pin" [size]="14" [stroke]="2" /> {{ subtitle() }}</p>
          }
          @if (amenities().length) {
            <div class="rs-hotel-card__amenities">
              @for (a of amenities(); track etiquetaAmenity(a)) {
                <span class="rs-amenity">
                  @if (iconoAmenity(a); as icono) { <rs-icon [name]="icono" [size]="12" [stroke]="2" /> }
                  {{ etiquetaAmenity(a) }}
                </span>
              }
            </div>
          }
          <div class="rs-hotel-card__footer">
            @if (rating()) {
              <rs-rating [score]="rating()!.score" [label]="rating()!.label || ''" [count]="rating()!.count ?? null" size="sm"></rs-rating>
            }
            @if (price()) {
              <div class="rs-price">
                @if (price()!.oldAmount) { <span class="rs-price__old">{{ price()!.oldAmount }}</span> }
                <span class="rs-price__amount">{{ price()!.amount }}</span>
                @if (price()!.period) { <span class="rs-price__period">{{ price()!.period }}</span> }
              </div>
            }
          </div>
          @if (ctaLabel()) {
            <button type="button" class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-4)">
              {{ ctaLabel() }}
            </button>
          }
          <ng-content select="[cardFooter]" />
        </div>
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

    .rs-hotel-card { height: 100%; display: flex; flex-direction: column; }
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
  readonly clickable = input(true);
  readonly favoritoServicioId = input<string | null>(null);
  /** Si se define, toda la tarjeta se renderiza como `<a routerLink>` (SEO, ctrl+click) en vez de `<article (click)>`. */
  readonly routerLink = input<string | unknown[] | null>(null);
  readonly queryParams = input<Record<string, unknown>>({});

  readonly cardClick = output<void>();

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

  etiquetaAmenity(amenity: CardAmenity): string {
    return typeof amenity === 'string' ? amenity : amenity.label;
  }

  iconoAmenity(amenity: CardAmenity): string {
    return typeof amenity === 'string' ? '' : amenity.icon;
  }
}
