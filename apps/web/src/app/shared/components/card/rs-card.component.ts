import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'rs-card',
  standalone: true,
  imports: [CommonModule],
  template: `
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
  `,
  styles: [`
    :host { display: block; }

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

  get cardClasses(): string {
    const classes = ['rs-card'];
    if (this.glass()) classes.push('rs-card--glass');
    if (this.padding() === 'sm') classes.push('rs-card--sm');
    if (this.padding() === 'lg') classes.push('rs-card--lg');
    return classes.join(' ');
  }
}
