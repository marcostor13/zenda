import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { esNavegador } from '../../core/plataforma/almacen';

/**
 * Lo que ha de quedar libre bajo el panel para no darlo por encajado cuando en
 * realidad su última línea roza el borde de la pantalla.
 */
const HOLGURA = 16;

/** Lo mismo que usa `.rs-sticky-panel` cuando nadie declara `--sticky-top`. */
const DESDE_ARRIBA = 84;

/**
 * Columna lateral de una ficha: se queda pegada **sólo si cabe entera**.
 *
 * `position: sticky` es una promesa que sólo se puede cumplir cuando el panel
 * es más bajo que el hueco visible. En un portátil de pantalla corta —o en una
 * ventana a media altura— el panel de reserva mide más que eso, y pegarlo
 * significa cortarlo: el botón de reservar, o las claves de debajo, quedan
 * fuera y no hay forma de llegar a ellos, porque la página se desplaza por
 * detrás y el panel no.
 *
 * Antes se intentó tapar con `max-height` y un desplazamiento interno, pero un
 * panel con su propia barra dentro de una página que también se desplaza es
 * peor: casi nadie descubre que ahí dentro hay más, y en los sistemas que
 * ocultan las barras no queda ni la pista.
 *
 * Así que la regla es una y se mide, no se adivina: si cabe, se pega; si no
 * cabe, acompaña a la página y se lee entero bajando. Se vuelve a medir cuando
 * cambia el tamaño de la ventana y cuando cambia el propio panel —elegir un
 * espacio le añade una fila, el mapa carga y crece—, así que vale igual para
 * cualquier resolución y para cualquier contenido.
 */
@Directive({ selector: '[rsPanelLateral]', standalone: true })
export class PanelLateralDirective implements OnInit, OnDestroy {
  private observador?: ResizeObserver;
  private alRedimensionar?: () => void;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    /*
     * En el servidor no se toca nada: no hay ventana que medir y el HTML sale
     * con la clase que ya trae la plantilla, o sea igual que siempre. Al
     * hidratar se mide de verdad y, si no cabe, se le quita.
     */
    if (!esNavegador()) return;

    this.medir();

    this.alRedimensionar = () => this.medir();
    window.addEventListener('resize', this.alRedimensionar, { passive: true });

    /*
     * El alto del panel cambia sin que cambie el de la ventana: al elegir un
     * espacio aparece su fila, el mapa termina de cargar, un aviso de escasez
     * entra o sale. Sin observarlo, el panel se quedaría pegado con una medida
     * que ya no es la suya.
     */
    if (typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(() => this.medir());
      this.observador.observe(this.el.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    if (this.alRedimensionar) window.removeEventListener('resize', this.alRedimensionar);
  }

  private medir(): void {
    const el = this.el.nativeElement;
    const disponible = window.innerHeight - this.desdeArriba(el) - HOLGURA;

    el.classList.toggle('rs-sticky-panel', el.offsetHeight <= disponible);
  }

  /** Dónde se pega el panel; lo dice la hoja de estilos, no esta clase. */
  private desdeArriba(el: HTMLElement): number {
    const declarado = getComputedStyle(el).getPropertyValue('--sticky-top');
    return Number.parseFloat(declarado) || DESDE_ARRIBA;
  }
}
