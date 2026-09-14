import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { esNavegador } from '../../core/plataforma/almacen';

/**
 * Margen de seguridad antes de destapar el contenido pase lo que pase. Es más
 * de lo que tarda la animación de entrada (400 ms) y bastante menos de lo que
 * nadie espera mirando una pantalla en blanco.
 */
const MS_RED_DE_SEGURIDAD = 1200;

@Directive({ selector: '[rsAnim]', standalone: true })
export class AnimateOnScrollDirective implements OnInit, OnDestroy {
  @Input() rsAnim = '';
  @Input() rsAnimDelay = 0;

  private observer?: IntersectionObserver;
  private redDeSeguridad?: ReturnType<typeof setTimeout>;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    /*
     * En el render de servidor no se hace nada, y es a propósito doble:
     *
     * - `IntersectionObserver` no existe en Node, y sin esta salida el render
     *   de la portada reventaba con «IntersectionObserver is not defined».
     * - La clase `rs-anim` deja el elemento transparente hasta que entra en
     *   pantalla. Ponerla en el HTML del servidor dejaría el contenido invisible
     *   para quien llega con JavaScript desactivado o mientras se hidrata, que
     *   es justo lo contrario de lo que busca renderizar en servidor.
     *
     * En el navegador el efecto es el de siempre: `ngOnInit` se ejecuta al
     * hidratar y desde ahí anima con normalidad.
     */
    if (!esNavegador()) return;

    const el = this.el.nativeElement;

    /* Sin observador no hay forma de saber cuándo entra en pantalla, y dejar el
       contenido tapado es peor que no animarlo. */
    if (typeof IntersectionObserver === 'undefined') return;

    el.classList.add('rs-anim');
    if (this.rsAnim) el.classList.add(`rs-anim--${this.rsAnim}`);
    if (this.rsAnimDelay > 0) el.style.transitionDelay = `${this.rsAnimDelay}ms`;

    /*
     * Umbral a cero, no a 0.12: la parte visible se mide contra el tamaño del
     * propio elemento, así que una tarjeta más alta que la pantalla nunca
     * llegaba a la fracción pedida y se quedaba tapada para siempre. Con cero
     * basta un píxel dentro, que es lo que la animación quiere saber.
     */
    this.observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) this.destapar(); },
      { threshold: 0, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(el);

    /*
     * Red de seguridad. El observador solo recalcula al desplazar o al cambiar
     * el tamaño de la ventana: si el elemento aparece fuera de pantalla y algo
     * lo trae a la vista sin mediar desplazamiento —contenido que se carga
     * encima y recoloca la página, el propio Safari de iOS recolocando el
     * ancla al crecer el documento—, el aviso no llega nunca y la tarjeta se
     * queda invisible. Una animación jamás debe poder esconder contenido de
     * forma permanente: pasado el plazo, se destapa.
     */
    this.redDeSeguridad = setTimeout(() => this.destapar(), MS_RED_DE_SEGURIDAD);
  }

  ngOnDestroy(): void { this.limpiar(); }

  /** Muestra el elemento y deja de vigilarlo: ya no hay nada que esperar. */
  private destapar(): void {
    this.el.nativeElement.classList.add('visible');
    this.limpiar();
  }

  private limpiar(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.redDeSeguridad) clearTimeout(this.redDeSeguridad);
    this.redDeSeguridad = undefined;
  }
}
