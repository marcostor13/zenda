import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { esNavegador } from '../../core/plataforma/almacen';

@Directive({ selector: '[rsAnim]', standalone: true })
export class AnimateOnScrollDirective implements OnInit, OnDestroy {
  @Input() rsAnim = '';
  @Input() rsAnimDelay = 0;

  private observer?: IntersectionObserver;

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
    el.classList.add('rs-anim');
    if (this.rsAnim) el.classList.add(`rs-anim--${this.rsAnim}`);
    if (this.rsAnimDelay > 0) el.style.transitionDelay = `${this.rsAnimDelay}ms`;

    this.observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); this.observer?.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
