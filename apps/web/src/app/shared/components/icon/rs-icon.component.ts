import { ChangeDetectionStrategy, Component, HostBinding, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DIBUJOS_ICONO } from './iconos';

/**
 * Icono de trazo del sistema de diseño.
 *
 * El dibujo se busca en `DIBUJOS_ICONO` y se inserta de una vez, en lugar del
 * `@switch` de 105 ramas que había antes. El motivo es medible: Angular crea un
 * nodo comentario de anclaje por cada rama de un bloque de control, así que cada
 * icono pintado dejaba casi cien `<!---->` en el HTML. La portada llegaba a
 * 5.114 comentarios vacíos —unos 36 KB que no dibujan nada— y fue el hallazgo
 * SEO-13 de la auditoría de septiembre de 2026.
 *
 * El `<svg>` entero se compone como texto y se inserta en el propio anfitrión.
 * No vale poner el `innerHTML` **dentro** de un `<svg>` de la plantilla: el DOM
 * que usa el render de servidor no lo implementa para elementos SVG y los
 * iconos salían vacíos justo en el HTML que ven los buscadores.
 *
 * La API del componente (`name`, `size`, `stroke`, `filled`) no cambia, así que
 * ninguna de sus más de mil apariciones se toca.
 */
@Component({
  selector: 'rs-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  // `vertical-align` sólo lo lee un contexto inline, así que en un padre flex se
  // ignora sin efectos: sirve para centrar el icono junto al texto cuando va
  // suelto dentro de un <p>/<li>, sin romper los usos dentro de .rs-badge.
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; line-height: 1; vertical-align: -.15em; }`],
})
export class RsIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input<string>('');
  readonly size = input<number | string>(24);
  readonly stroke = input<number | string>(1.75);
  /** Rellena el trazo con el color actual (estrellas de valoración, corazones). */
  readonly filled = input(false);

  /**
   * El `<svg>` completo, listo para insertar.
   *
   * Se salta el saneador de Angular, que borra `<path>`, `<circle>` y compañía
   * al insertarlos como HTML y dejaría el icono vacío. Es seguro **aquí y sólo
   * aquí**: lo que se inserta son constantes del propio código, y de las
   * entradas sólo se usa `name` para elegir una clave del mapa; los números van
   * forzados a número antes de escribirse. Nada de lo que llega se copia tal
   * cual al marcado.
   */
  private readonly svg = computed<SafeHtml>(() => {
    const dibujo = DIBUJOS_ICONO[this.name()];
    if (!dibujo) return '';

    const lado = numero(this.size(), 24);
    const grosor = numero(this.stroke(), 1.75);
    const relleno = this.filled() ? 'currentColor' : 'none';

    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg viewBox="0 0 24 24" width="${lado}" height="${lado}" fill="${relleno}"`
      + ` stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round"`
      + ` stroke-linejoin="round" aria-hidden="true">${dibujo}</svg>`,
    );
  });

  /** Se pinta en el propio `<rs-icon>`: sin envoltorio, sin nodos de anclaje. */
  @HostBinding('innerHTML')
  get contenido(): SafeHtml {
    return this.svg();
  }
}

/**
 * Fuerza el valor a número. Las medidas llegan como número o como cadena
 * (`[size]="14"` y `size="14"` son las dos formas que hay en el código), y lo
 * que se escribe en el marcado tiene que ser siempre un número.
 */
function numero(valor: number | string, porDefecto: number): number {
  const convertido = typeof valor === 'number' ? valor : Number.parseFloat(valor);
  return Number.isFinite(convertido) ? convertido : porDefecto;
}
