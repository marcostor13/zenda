import { Component, input, model, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'rs-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RsInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="rs-form-group">
      @if (label()) {
        <label [for]="inputId()" class="rs-label">{{ label() }}</label>
      }
      <input
        [id]="inputId()"
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [class]="inputClasses"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()" />
      @if (error()) {
        <span class="rs-field-error">{{ error() }}</span>
      }
      @if (hint()) {
        <span style="font-size:var(--text-xs);color:var(--text-muted)">{{ hint() }}</span>
      }
    </div>
  `,
})
export class RsInputComponent implements ControlValueAccessor {
  readonly inputId    = input<string>(`rs-input-${Math.random().toString(36).slice(2)}`);
  readonly label      = input<string>('');
  readonly type       = input<string>('text');
  readonly placeholder = input<string>('');
  readonly disabled   = input(false);
  readonly error      = input<string>('');
  readonly hint       = input<string>('');

  value = '';
  onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  get inputClasses(): string {
    return ['rs-input', this.error() ? 'rs-input--error' : ''].filter(Boolean).join(' ');
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  writeValue(value: string): void { this.value = value ?? ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
