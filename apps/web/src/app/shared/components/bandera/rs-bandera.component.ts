import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Franjas de una bandera: `h` horizontales, `v` verticales. `pesos` reparte el
 * ancho (o el alto) cuando no son iguales — España es 1:2:1, no tres tercios.
 */
interface Franjas {
  readonly tipo: 'franjas';
  readonly dir: 'h' | 'v';
  readonly colores: readonly string[];
  readonly pesos?: readonly number[];
}

/** Cruz nórdica: desplazada hacia el asta, no centrada. */
interface CruzNordica {
  readonly tipo: 'nordica';
  readonly fondo: string;
  readonly cruz: string;
  /** Filete alrededor de la cruz (Noruega, Islandia). */
  readonly filete?: string;
}

/** Bandera que no se deja describir con franjas; se dibuja a mano. */
interface Trazada {
  readonly tipo: 'trazada';
  readonly fondo: string;
  readonly partes: readonly { readonly d: string; readonly color: string }[];
}

type EspecBandera = Franjas | CruzNordica | Trazada;

const franjas = (
  dir: 'h' | 'v', colores: readonly string[], pesos?: readonly number[],
): Franjas => ({ tipo: 'franjas', dir, colores, pesos });

/**
 * Banderas de los países que ofrece Doogking, en SVG.
 *
 * Antes eran emoji de bandera. Windows no incluye esos glifos en su fuente
 * de emoji, así que Chrome y Edge pintan en su lugar las dos letras del
 * indicador regional: en la cabecera se leía "ES ES" — la "bandera" y el
 * código, repetidos — y en el selector de teléfono, una columna de siglas.
 * Dibujadas, se ven igual en cualquier sistema y además cumplen la regla del
 * proyecto de no usar emoji en la interfaz (TCK-8010).
 *
 * A 21x15 px un escudo mide cuatro píxeles y no se distingue, así que las
 * banderas con emblema (Portugal, Eslovaquia, España…) se resuelven con sus
 * franjas: es lo que de verdad las identifica a este tamaño.
 */
const BANDERAS: Record<string, EspecBandera> = {
  // Tricolores verticales
  FR: franjas('v', ['#002654', '#FFFFFF', '#ED2939']),
  IT: franjas('v', ['#008C45', '#F4F5F0', '#CD212A']),
  BE: franjas('v', ['#000000', '#FDDA24', '#EF3340']),
  IE: franjas('v', ['#169B62', '#FFFFFF', '#FF883E']),
  RO: franjas('v', ['#002B7F', '#FCD116', '#CE1126']),
  MD: franjas('v', ['#0046AE', '#FFD200', '#CC092F']),
  AD: franjas('v', ['#10069F', '#FEDD00', '#D50032']),

  // Tricolores y bicolores horizontales
  DE: franjas('h', ['#000000', '#DD0000', '#FFCE00']),
  NL: franjas('h', ['#AE1C28', '#FFFFFF', '#21468B']),
  RU: franjas('h', ['#FFFFFF', '#0039A6', '#D52B1E']),
  EE: franjas('h', ['#0072CE', '#000000', '#FFFFFF']),
  LT: franjas('h', ['#FDB913', '#006A44', '#C1272D']),
  BG: franjas('h', ['#FFFFFF', '#00966E', '#D62612']),
  HU: franjas('h', ['#CD2A3E', '#FFFFFF', '#436F4D']),
  LU: franjas('h', ['#ED2939', '#FFFFFF', '#00A1DE']),
  RS: franjas('h', ['#C6363C', '#0C4076', '#FFFFFF']),
  SI: franjas('h', ['#FFFFFF', '#0000FF', '#FF0000']),
  SK: franjas('h', ['#FFFFFF', '#0B4EA2', '#EE1C25']),
  HR: franjas('h', ['#FF0000', '#FFFFFF', '#171796']),
  UA: franjas('h', ['#0057B7', '#FFD700']),
  PL: franjas('h', ['#FFFFFF', '#DC143C']),
  MC: franjas('h', ['#CE1126', '#FFFFFF']),
  SM: franjas('h', ['#FFFFFF', '#5EB6E4']),
  LI: franjas('h', ['#002B7F', '#CE1126']),
  VA: franjas('v', ['#FFE000', '#FFFFFF']),
  MT: franjas('v', ['#FFFFFF', '#CF142B']),
  MK: franjas('h', ['#D20000', '#FFE600', '#D20000'], [1, 1, 1]),

  // Franjas desiguales
  ES: franjas('h', ['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]),
  LV: franjas('h', ['#9E3039', '#FFFFFF', '#9E3039'], [2, 1, 2]),
  AT: franjas('h', ['#ED2939', '#FFFFFF', '#ED2939'], [1, 1, 1]),
  PT: franjas('v', ['#046A38', '#DA291C'], [2, 3]),
  BY: franjas('h', ['#C8313E', '#4AA657'], [2, 1]),
  ME: franjas('h', ['#C40308', '#C40308']),
  BA: franjas('h', ['#002F6C', '#002F6C']),
  AL: franjas('h', ['#E41E20', '#E41E20']),
  CZ: franjas('h', ['#FFFFFF', '#D7141A']),

  // Cruces nórdicas
  DK: { tipo: 'nordica', fondo: '#C8102E', cruz: '#FFFFFF' },
  SE: { tipo: 'nordica', fondo: '#006AA7', cruz: '#FECC02' },
  FI: { tipo: 'nordica', fondo: '#FFFFFF', cruz: '#002F6C' },
  NO: { tipo: 'nordica', fondo: '#BA0C2F', cruz: '#00205B', filete: '#FFFFFF' },
  IS: { tipo: 'nordica', fondo: '#02529C', cruz: '#DC1E35', filete: '#FFFFFF' },
};

/** Bandera suiza: cuadrada, cruz griega centrada. */
BANDERAS['CH'] = {
  tipo: 'trazada', fondo: '#D52B1E',
  partes: [{ color: '#FFFFFF', d: 'M9 4h3v3h3v3h-3v3H9v-3H6V7h3z' }],
};

/** Grecia: nueve franjas y cantón con cruz. */
BANDERAS['GR'] = {
  tipo: 'trazada', fondo: '#0D5EAF',
  partes: [
    { color: '#FFFFFF', d: 'M0 1.67h21v1.66H0zM0 5h21v1.67H0zM0 8.33h21V10H0zM0 11.67h21v1.66H0z' },
    { color: '#0D5EAF', d: 'M0 0h8.33v8.33H0z' },
    { color: '#FFFFFF', d: 'M3.33 0h1.67v8.33H3.33zM0 3.33h8.33V5H0z' },
  ],
};

/** Reino Unido: la Union Jack, simplificada a sus aspas y cruz. */
BANDERAS['GB'] = {
  tipo: 'trazada', fondo: '#012169',
  partes: [
    { color: '#FFFFFF', d: 'M0 0l21 15M21 0L0 15' },
    { color: '#C8102E', d: 'M0 0l21 15M21 0L0 15' },
    { color: '#FFFFFF', d: 'M8.4 0h4.2v15H8.4zM0 5.4h21v4.2H0z' },
    { color: '#C8102E', d: 'M9.45 0h2.1v15h-2.1zM0 6.45h21v2.1H0z' },
  ],
};

/** Chipre: fondo blanco con la silueta de la isla en cobre. */
BANDERAS['CY'] = {
  tipo: 'trazada', fondo: '#FFFFFF',
  partes: [{ color: '#D57800', d: 'M6 5.5h9l-1.5 3H8.5z' }],
};

/** Una franja ya resuelta a coordenadas del lienzo 21x15. */
interface Banda {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
}

const ANCHO = 21;
const ALTO = 15;

/**
 * Bandera de un país en SVG, por su código ISO de dos letras.
 *
 * Si el país no está en la tabla no se deja un hueco: se pinta una pastilla
 * neutra con el código, que se lee como una etiqueta y no como un fallo.
 */
@Component({
  selector: 'rs-bandera',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="ancho()" [attr.height]="alto()" viewBox="0 0 21 15"
         class="bd" role="img" [attr.aria-label]="etiqueta() || null"
         [attr.aria-hidden]="etiqueta() ? null : true">
      <defs>
        <clipPath [attr.id]="idRecorte">
          <rect x="0" y="0" width="21" height="15" rx="2.5" />
        </clipPath>
      </defs>

      <g [attr.clip-path]="'url(#' + idRecorte + ')'">
        @if (espec(); as e) {
          @switch (e.tipo) {
            @case ('franjas') {
              @for (b of bandas(); track $index) {
                <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h"
                      [attr.fill]="b.color" />
              }
            }
            @case ('nordica') {
              <rect x="0" y="0" width="21" height="15" [attr.fill]="e.fondo" />
              @if (e.filete) {
                <path [attr.fill]="e.filete" d="M6 0h4v15H6zM0 5.5h21v4H0z" />
              }
              <path [attr.fill]="e.cruz" d="M7 0h2v15H7zM0 6.5h21v2H0z" />
            }
            @case ('trazada') {
              <rect x="0" y="0" width="21" height="15" [attr.fill]="e.fondo" />
              @for (p of e.partes; track $index) {
                <path [attr.d]="p.d" [attr.fill]="p.color"
                      [attr.stroke]="esAspa(p.d) ? p.color : null"
                      [attr.stroke-width]="esAspa(p.d) ? (p.color === '#FFFFFF' ? 3 : 1.6) : null" />
              }
            }
          }
        } @else {
          <rect x="0" y="0" width="21" height="15" fill="var(--c-surface)" />
          <text x="10.5" y="10.5" text-anchor="middle" font-size="7" font-weight="700"
                fill="var(--t-400)" font-family="var(--font)">{{ codigo() }}</text>
        }
      </g>

      <!-- Filo tenue: sobre fondo blanco, una bandera con blanco en el borde
           (Polonia, Finlandia) se quedaba sin silueta. -->
      <rect x="0.25" y="0.25" width="20.5" height="14.5" rx="2.25"
            fill="none" stroke="rgba(5,26,102,.22)" stroke-width="0.5" />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; line-height: 0; }
    .bd { display: block; flex: none; }
  `],
})
export class RsBanderaComponent {
  private static contador = 0;

  readonly codigo = input('');
  /** Alto en píxeles; el ancho se deriva de la proporción 7:5. */
  readonly alto = input(15);
  /** Nombre del país. Si se pasa, la bandera deja de ser decorativa. */
  readonly etiqueta = input('');

  /** Cada instancia necesita su propio clipPath o el primero recorta a todos. */
  readonly idRecorte = `bd-${++RsBanderaComponent.contador}`;

  readonly ancho = computed(() => Math.round((this.alto() * ANCHO) / ALTO));

  readonly espec = computed<EspecBandera | undefined>(
    () => BANDERAS[this.codigo().toUpperCase()],
  );

  /** Las aspas de la Union Jack son trazos, no rellenos. */
  esAspa(d: string): boolean {
    return d.includes('21 15');
  }

  readonly bandas = computed<Banda[]>(() => {
    const e = this.espec();
    if (!e || e.tipo !== 'franjas') return [];

    const pesos = e.pesos ?? e.colores.map(() => 1);
    const total = pesos.reduce((a, b) => a + b, 0);
    const largo = e.dir === 'h' ? ALTO : ANCHO;

    let desplazamiento = 0;
    return e.colores.map((color, i) => {
      const trozo = (pesos[i] / total) * largo;
      const banda: Banda = e.dir === 'h'
        ? { x: 0, y: desplazamiento, w: ANCHO, h: trozo, color }
        : { x: desplazamiento, y: 0, w: trozo, h: ALTO, color };
      desplazamiento += trozo;
      return banda;
    });
  });
}
