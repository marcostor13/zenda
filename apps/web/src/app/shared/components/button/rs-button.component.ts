import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'rs-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="buttonClasses"
      (click)="clicked.emit($event)">
      @if (loading()) {
        <span class="rs-spinner" style="width:16px;height:16px;"></span>
      }
      <ng-content />
    </button>
  `,
})
export class RsButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size    = input<ButtonSize>('md');
  readonly type    = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading  = input(false);
  readonly block    = input(false);

  readonly clicked = output<MouseEvent>();

  get buttonClasses(): string {
    const classes = ['rs-btn', `rs-btn--${this.variant()}`];
    if (this.size() !== 'md') classes.push(`rs-btn--${this.size()}`);
    if (this.block()) classes.push('rs-btn--block');
    return classes.join(' ');
  }
}
