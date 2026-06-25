import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

@Component({
  selector: 'rs-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="'rs-badge rs-badge--' + variant()">
      <ng-content />
    </span>
  `,
})
export class RsBadgeComponent {
  readonly variant = input<BadgeVariant>('accent');
}
