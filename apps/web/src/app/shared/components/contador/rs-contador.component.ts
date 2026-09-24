import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Selector numérico − / + (número de mascotas, de acompañantes). Sustituye al
 * `.contador` que vivía dentro del asistente de reserva. Funciona con
 * `formControlName` y anuncia el valor al lector de pantalla.
 */
@Component({
  selector: 'rs-contador',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsContadorComponent), multi: true }],
  template: `
<div class="ct" role="group" [attr.aria-label]="etiqueta() | t">
  <span class="ct__etiqueta">{{ etiqueta() | t }}</span>
  <div class="ct__control">
    <button type="button" class="ct__btn" [disabled]="deshabilitado() || valor() <= min()"
            [attr.aria-label]="'Quitar uno' | t" (click)="cambiar(-1)">
      <rs-icon name="minus" [size]="16" [stroke]="2.4"></rs-icon>
    </button>
    <output class="ct__valor" aria-live="polite">{{ valor() }}</output>
    <button type="button" class="ct__btn" [disabled]="deshabilitado() || valor() >= max()"
            [attr.aria-label]="'Añadir uno' | t" (click)="cambiar(1)">
      <rs-icon name="plus" [size]="16" [stroke]="2.4"></rs-icon>
    </button>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .ct { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
    .ct__etiqueta { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }
    .ct__control { display: flex; align-items: center; gap: var(--sp-2); }
    .ct__btn {
      display: grid; place-items: center; width: 40px; height: 40px;
      border-radius: var(--r-full); border: 1.5px solid var(--b-2);
      background: var(--c-card); color: var(--dk-blue);
      transition: border-color var(--d-2), background var(--d-2);
      &:hover:not(:disabled) { border-color: var(--dk-blue); background: var(--c-accent-lo); }
      &:disabled { opacity: .35; cursor: not-allowed; }
      &:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--c-accent-lo); border-color: var(--c-accent); }
    }
    .ct__valor { min-width: 2ch; text-align: center; font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
  `],
})
export class RsContadorComponent implements ControlValueAccessor {
  readonly etiqueta = input.required<string>();
  readonly min = input(1);
  readonly max = input(10);

  readonly valor = signal(1);
  readonly deshabilitado = signal(false);
  private alCambiar: (valor: number) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  cambiar(paso: number): void {
    const siguiente = Math.min(this.max(), Math.max(this.min(), this.valor() + paso));
    if (siguiente === this.valor()) return;
    this.valor.set(siguiente);
    this.alCambiar(siguiente);
    this.alTocar();
  }

  writeValue(valor: number | null): void {
    this.valor.set(Number.isFinite(valor) ? Number(valor) : this.min());
  }

  registerOnChange(fn: (valor: number) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}
