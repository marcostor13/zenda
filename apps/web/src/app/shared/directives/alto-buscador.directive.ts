import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/** Variable CSS donde se publica el alto de la barra de búsqueda. */
export const VAR_ALTO_BUSCADOR = '--alto-buscador';

/**
 * Publica el alto real de la barra de búsqueda fija en una variable CSS global.
 *
 * Los listados anclan el mapa justo debajo de esa barra, y su alto no es un
 * número fijo: cambia con el ancho de la ventana, con los campos propios de
 * cada vertical y se queda en cero cuando el mapa a pantalla completa la
 * esconde. Con un valor a ojo en el CSS, la barra acababa tapando la caja
 * "Buscar en el mapa" y el botón de cerrar del propio mapa.
 */
@Directive({
  selector: '[rsAltoBuscador]',
  standalone: true,
})
export class AltoBuscadorDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observador: ResizeObserver | null = null;

  constructor() {
    // jsdom (y cualquier render en servidor) no trae ResizeObserver; sin él
    // manda el valor de reserva declarado en el CSS.
    if (typeof ResizeObserver === 'undefined') return;
    this.observador = new ResizeObserver(() => this.publicar());
    this.observador.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.observador = null;
    document.documentElement.style.removeProperty(VAR_ALTO_BUSCADOR);
  }

  /** `offsetHeight` y no `contentRect`: hay que contar el relleno y el borde. */
  private publicar(): void {
    const alto = this.host.nativeElement.offsetHeight;
    document.documentElement.style.setProperty(VAR_ALTO_BUSCADOR, `${alto}px`);
  }
}
