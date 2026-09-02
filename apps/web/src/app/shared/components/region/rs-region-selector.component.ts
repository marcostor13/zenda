import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal,
} from '@angular/core';
import { IdiomaSoportado, MONEDA_SIMBOLOS, MonedaSoportada } from 'shared';
import { MonedaService } from '../../../core/moneda/moneda.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsBanderaComponent } from '../bandera/rs-bandera.component';

/**
 * Idioma y moneda de la cabecera. Dos controles separados: el idioma cambia lo
 * que el usuario está leyendo y la moneda solo cambia cómo se muestran los
 * precios — el cobro sigue siendo en euros y así se advierte.
 *
 * El idioma va primero porque es el único de los dos que reescribe la página.
 *
 * Hubo un tercer control de país con su bandera. Se retiró: no filtraba la
 * búsqueda ni cambiaba nada —ningún otro componente leía `pais()`—, así que
 * enseñaba dos banderas seguidas en la cabecera y sugería una selección de
 * región que el producto no hacía. La región efectiva la fija el buscador con
 * la ciudad que escribe el usuario.
 */
@Component({
  selector: 'rs-region-selector',
  standalone: true,
  imports: [RsIconComponent, RsBanderaComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="rg" [class.rg--block]="block()">
  <div class="rg__wrap">
    <button type="button" class="rg__trigger" (click)="abrir('idioma')"
            [attr.aria-expanded]="panel() === 'idioma'" aria-haspopup="true"
            [attr.aria-label]="('Idioma' | t) + ': ' + i18n.ficha().nombre">
      <rs-icon name="globe" [size]="15" [stroke]="2"></rs-icon>
      <span class="rg__code">{{ codigoIdioma() }}</span>
    </button>

    @if (panel() === 'idioma') {
      <ul class="rg__pop" role="menu" [attr.aria-label]="'Elegir idioma' | t">
        @for (idi of i18n.idiomas; track idi.codigo) {
          <li>
            <button type="button" role="menuitemradio" class="rg__opt"
                    [class.is-on]="idi.codigo === i18n.idioma()"
                    [attr.aria-checked]="idi.codigo === i18n.idioma()"
                    (click)="elegirIdioma(idi.codigo)">
              <rs-bandera class="rg__flag" [codigo]="idi.bandera" [alto]="14" />
              {{ idi.nombre }}
            </button>
          </li>
        }
      </ul>
    }
  </div>

  <div class="rg__wrap">
    <button type="button" class="rg__trigger" (click)="abrir('moneda')"
            [attr.aria-expanded]="panel() === 'moneda'" aria-haspopup="true"
            [attr.aria-label]="('Moneda' | t) + ': ' + moneda.moneda()">
      <span class="rg__sym" aria-hidden="true">{{ simbolo() }}</span>
      <span class="rg__code">{{ moneda.moneda() }}</span>
    </button>

    @if (panel() === 'moneda') {
      <div class="rg__pop rg__pop--moneda" role="menu" [attr.aria-label]="'Elegir moneda' | t">
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
          {{ 'Los precios se muestran convertidos; el cobro se realiza siempre en euros.' | t }}
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
    .rg__flag { flex: none; }
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
  readonly i18n = inject(I18nService);

  /** En el drawer móvil los controles ocupan todo el ancho. */
  readonly block = input(false);

  readonly simbolos = MONEDA_SIMBOLOS;

  readonly panel = signal<'idioma' | 'moneda' | null>(null);

  /** El disparador enseña el código en versales ("ES", "DE"), no el nombre. */
  codigoIdioma(): string {
    return this.i18n.idioma().toUpperCase();
  }

  simbolo(): string {
    return this.simbolos[this.moneda.moneda()];
  }

  abrir(cual: 'idioma' | 'moneda'): void {
    this.panel.set(this.panel() === cual ? null : cual);
  }

  elegirIdioma(codigo: IdiomaSoportado): void {
    // El diccionario se descarga en segundo plano; cerrar ya el panel es lo que
    // espera quien acaba de pulsar, y el texto cambia solo al llegar.
    void this.i18n.elegirIdioma(codigo);
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
