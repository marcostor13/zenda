import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Métodos de pago que Doogking acepta a través de Stripe. */
export type MarcaPagoKey =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'stripe'
  | 'apple-pay'
  | 'google-pay';

const ETIQUETAS: Record<MarcaPagoKey, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  stripe: 'Stripe',
  'apple-pay': 'Apple Pay',
  'google-pay': 'Google Pay',
};

/**
 * Marca del método de pago (TCK-8008): en el paso de pago y en el pie el usuario
 * reconoce la tarjeta por su marca, no leyendo el nombre en una lista separada
 * por puntos.
 *
 * Va aparte de `rs-icon` por lo mismo que `rs-social-icon`: son glifos de marca,
 * no iconos de trazo, así que no siguen el contrato `fill=none` de Lucide.
 *
 * El símbolo de Mastercard son sus dos círculos, que es geometría exacta. El
 * resto de marcas son logotipos de texto: aquí se dibujan como lettering sobre
 * el fondo corporativo, que es reconocible y no depende de ningún asset externo
 * (el CSP de la app no permite cargar imágenes de terceros). Para usar el
 * artwork oficial basta con dejar los SVG en `public/icons/pagos/` y cambiar
 * este componente por un `<img>`; el resto de la app no se entera.
 */
@Component({
  selector: 'rs-brand-icon',
  standalone: true,
  imports: [TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 48 32"
      [attr.width]="ancho"
      [attr.height]="alto"
      role="img"
      [attr.aria-label]="etiqueta">
      <rect x="0.5" y="0.5" width="47" height="31" rx="4" [attr.fill]="fondo" stroke="rgba(0,0,0,.12)" />

      @switch (name) {
        @case ('mastercard') {
          <circle cx="19" cy="16" r="8" fill="#EB001B" />
          <circle cx="29" cy="16" r="8" fill="#F79E1B" />
          <path
            d="M24 10.1a7.98 7.98 0 0 0 0 11.8 7.98 7.98 0 0 0 0-11.8Z"
            fill="#FF5F00" />
        }
        @case ('visa') {
          <text x="24" y="21" text-anchor="middle" fill="#FFFFFF"
                font-family="Georgia, 'Times New Roman', serif"
                font-size="12" font-style="italic" font-weight="700"
                letter-spacing=".5">VISA</text>
        }
        @case ('amex') {
          <text x="24" y="14" text-anchor="middle" fill="#FFFFFF"
                font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="700">{{ 'AMERICAN' | t }}</text>
          <text x="24" y="23" text-anchor="middle" fill="#FFFFFF"
                font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="700">{{ 'EXPRESS' | t }}</text>
        }
        @case ('stripe') {
          <text x="24" y="21" text-anchor="middle" fill="#FFFFFF"
                font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700"
                letter-spacing="-.3">{{ 'stripe' | t }}</text>
        }
        @case ('apple-pay') {
          <text x="24" y="21" text-anchor="middle" fill="#FFFFFF"
                font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="11" font-weight="500">
            <tspan font-size="13"></tspan><tspan> {{ 'Pay' | t }}</tspan>
          </text>
        }
        @case ('google-pay') {
          <text x="24" y="21" text-anchor="middle"
                font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700">
            <tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan
              fill="#FBBC04">o</tspan><tspan fill="#4285F4">g</tspan><tspan
              fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan><tspan
              fill="#5F6368" font-weight="500"> {{ 'Pay' | t }}</tspan>
          </text>
        }
      }
    </svg>
  `,
  styles: [`:host { display: inline-flex; align-items: center; line-height: 1; }`],
})
export class RsBrandIconComponent {
  @Input({ required: true }) name!: MarcaPagoKey;
  /** Alto en píxeles; el ancho mantiene la proporción 3:2 de una tarjeta. */
  @Input() size = 22;

  get alto(): number { return this.size; }
  get ancho(): number { return Math.round(this.size * 1.5); }

  get etiqueta(): string { return ETIQUETAS[this.name] ?? this.name; }

  /** Fondo corporativo de cada marca; blanco cuando el logotipo lleva color. */
  get fondo(): string {
    const fondos: Record<MarcaPagoKey, string> = {
      visa: '#1A1F71',
      mastercard: '#FFFFFF',
      amex: '#2E77BC',
      stripe: '#635BFF',
      'apple-pay': '#000000',
      'google-pay': '#FFFFFF',
    };
    return fondos[this.name] ?? '#FFFFFF';
  }
}
