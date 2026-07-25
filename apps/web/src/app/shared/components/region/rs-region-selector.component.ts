import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal,
} from '@angular/core';
import { MONEDA_SIMBOLOS, MonedaSoportada, PAISES_SOPORTADOS } from 'shared';
import { MonedaService } from '../../../core/moneda/moneda.service';
import { RsIconComponent } from '../icon/rs-icon.component';

/**
 * País y moneda de la cabecera (R2 y R3). Son dos controles separados, como en
 * Booking: la bandera fija la región del buscador y la moneda solo cambia cómo
 * se muestran los precios — el cobro sigue siendo en euros y así se advierte.
 */
@Component({
  selector: 'rs-region-selector',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="rg" [class.rg--block]="block()">
  <div class="rg__wrap">
    <button type="button" class="rg__trigger" (click)="abrir('pais')"
            [attr.aria-expanded]="panel() === 'pais'" aria-haspopup="true"
            [attr.aria-label]="'País: ' + paisActual().nombre">
      <span class="rg__flag" aria-hidden="true">{{ paisActual().bandera }}</span>
      <span class="rg__code">{{ paisActual().codigo }}</span>
    </button>

    @if (panel() === 'pais') {
      <ul class="rg__pop" role="menu" aria-label="Elegir país">
        @for (p of paises; track p.codigo) {
          <li>
            <button type="button" role="menuitemradio" class="rg__opt"
                    [class.is-on]="p.codigo === moneda.pais()"
                    [attr.aria-checked]="p.codigo === moneda.pais()"
                    (click)="elegirPais(p.codigo)">
              <span class="rg__flag" aria-hidden="true">{{ p.bandera }}</span>
              {{ p.nombre }}
            </button>
          </li>
        }
      </ul>
    }
  </div>

  <div class="rg__wrap">
    <button type="button" class="rg__trigger" (click)="abrir('moneda')"
            [attr.aria-expanded]="panel() === 'moneda'" aria-haspopup="true"
            [attr.aria-label]="'Moneda: ' + moneda.moneda()">
      <span class="rg__sym" aria-hidden="true">{{ simbolo() }}</span>
      <span class="rg__code">{{ moneda.moneda() }}</span>
    </button>

    @if (panel() === 'moneda') {
      <div class="rg__pop rg__pop--moneda" role="menu" aria-label="Elegir moneda">
        <ul>
          @for (m of moneda.monedas; track m) {
            <li>
              <button type="button" role="menuitemradio" class="rg__opt"
                      [class.is-on]="m === moneda.moneda()"
                      [attr.aria-checked]="m === moneda.moneda()"
                      (click)="elegirMoneda(m)">
                <span class="rg__sym" aria-hidden="true">{{ simbolos[m] }}</span>
                {{ m }}
              </button>
            </li>
          }
        </ul>
        <p class="rg__nota">
          <rs-icon name="lock" [size]="12" [stroke]="2"></rs-icon>
          Los precios se muestran convertidos; el cobro se realiza siempre en euros.
        </p>
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .rg { display: flex; align-items: center; gap: var(--sp-1); }
    .rg--block { width: 100%; .rg__wrap { flex: 1; } .rg__trigger { width: 100%; justify-content: center; } }
    .rg__wrap { position: relative; }

    .rg__trigger {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid transparent; border-radius: var(--r-md);
      background: transparent; cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-300);
      transition: background var(--d-2), color var(--d-2);
      &:hover { background: rgba(5,26,102,.05); color: var(--t-100); }
    }
    .rg__flag { font-size: 1.05rem; line-height: 1; }
    .rg__sym  { font-weight: var(--w-7); color: var(--dk-blue); }
    .rg__code { letter-spacing: .02em; }

    .rg__pop {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-2)); right: 0;
      min-width: 200px;
      padding: var(--sp-2);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
      ul { list-style: none; }
    }

    .rg__opt {
      display: flex; align-items: center; gap: var(--sp-3);
      width: 100%; padding: var(--sp-2) var(--sp-3);
      border: none; border-radius: var(--r-md); background: transparent;
      font-size: var(--f-sm); color: var(--t-200); text-align: left; cursor: pointer;
      &:hover { background: var(--c-accent-lo); }
      &.is-on { background: var(--c-accent-lo); color: var(--dk-blue); font-weight: var(--w-6); }
    }

    .rg__nota {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      margin-top: var(--sp-2); padding-top: var(--sp-2);
      border-top: 1px solid var(--b-1);
      font-size: var(--f-xs); line-height: 1.45; color: var(--t-400);
      rs-icon { flex-shrink: 0; margin-top: 2px; }
    }
  `],
})
export class RsRegionSelectorComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly moneda = inject(MonedaService);

  /** En el drawer móvil los controles ocupan todo el ancho. */
  readonly block = input(false);

  readonly paises = PAISES_SOPORTADOS;
  readonly simbolos = MONEDA_SIMBOLOS;

  readonly panel = signal<'pais' | 'moneda' | null>(null);

  paisActual(): (typeof PAISES_SOPORTADOS)[number] {
    return this.paises.find((p) => p.codigo === this.moneda.pais()) ?? this.paises[0];
  }

  simbolo(): string {
    return this.simbolos[this.moneda.moneda()];
  }

  abrir(cual: 'pais' | 'moneda'): void {
    this.panel.set(this.panel() === cual ? null : cual);
  }

  elegirPais(codigo: string): void {
    this.moneda.elegirPais(codigo);
    this.panel.set(null);
  }

  elegirMoneda(m: MonedaSoportada): void {
    this.moneda.elegirMoneda(m);
    this.panel.set(null);
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.host.nativeElement.contains(evento.target as Node)) this.panel.set(null);
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.panel.set(null);
  }
}
