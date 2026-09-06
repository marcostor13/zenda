import { Directive, ElementRef, HostListener, inject, input, output } from '@angular/core';

/** Medidas por defecto del desplegable, para decidir hacia dónde abrirlo. */
const ANCHO = 210;
const ALTO = 220;
const MARGEN = 4;

export interface PosicionMenu {
  readonly top: number;
  readonly left: number;
}

/**
 * Ancla un desplegable al botón que lo abre, **fuera** del recorte de su tabla.
 *
 * Las tarjetas del panel (`.rs-card`) llevan `overflow: hidden` para que el
 * `border-radius` recorte a sus hijos, y las que tienen scroll lateral obligan
 * además a recortar en vertical: la especificación no permite un eje `auto` y
 * el otro `visible`. Un menú posicionado en `absolute` dentro de esas tarjetas
 * pierde sus últimas opciones en las filas de abajo —justo las destructivas—
 * sin que nada avise.
 *
 * La solución es sacarlo del flujo con `position: fixed`, y para eso hace falta
 * calcular sus coordenadas desde el botón. Eso es lo único que hace esta
 * directiva: se pone en el disparador y emite dónde tiene que dibujarse.
 */
@Directive({
  selector: '[rsMenuAnclado]',
  standalone: true,
})
export class MenuAncladoDirective {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Alto estimado del menú; sólo decide si se abre hacia abajo o hacia arriba. */
  readonly altoMenu = input<number>(ALTO, { alias: 'rsMenuAlto' });
  readonly anchoMenu = input<number>(ANCHO, { alias: 'rsMenuAncho' });

  readonly posicion = output<PosicionMenu>({ alias: 'rsMenuAnclado' });

  @HostListener('click')
  calcular(): void {
    this.posicion.emit(this.medir());
  }

  /**
   * Debajo del botón si hay sitio; si no, encima. Nunca por fuera del viewport,
   * ni por arriba ni por el borde izquierdo.
   */
  private medir(): PosicionMenu {
    const boton = this.elemento.nativeElement.getBoundingClientRect();
    const cabeDebajo = window.innerHeight - boton.bottom > this.altoMenu() + MARGEN;

    return {
      top: Math.round(cabeDebajo
        ? boton.bottom + MARGEN
        : Math.max(MARGEN, boton.top - this.altoMenu() - MARGEN)),
      left: Math.round(Math.max(MARGEN, boton.right - this.anchoMenu())),
    };
  }
}
