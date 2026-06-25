import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { IMG_FALLBACK } from '../media/images';

/**
 * Aplica un fallback a las `<img>` que fallan al cargar (URL caída, host
 * bloqueado, id de Pexels obsoleto). Evita que se muestre el ícono de imagen
 * rota: la imagen se reemplaza por una foto de respaldo garantizada o por la
 * URL que se pase en `rsImg`.
 *
 * Uso: <img [src]="foto" rsImg />  ó  <img [src]="foto" [rsImg]="otraUrl" />
 */
@Directive({
  selector: 'img[rsImg]',
  standalone: true,
})
export class ImgFallbackDirective {
  /** URL de respaldo opcional; si se omite se usa IMG_FALLBACK. */
  readonly rsImg = input<string>('');

  private readonly el = inject(ElementRef<HTMLImageElement>);
  private yaFallo = false;

  @HostListener('error')
  onError(): void {
    if (this.yaFallo) return; // evita bucle si el fallback también falla
    this.yaFallo = true;
    const img = this.el.nativeElement as HTMLImageElement;
    img.src = this.rsImg() || IMG_FALLBACK;
  }
}
