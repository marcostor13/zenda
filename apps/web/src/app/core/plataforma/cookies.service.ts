import { DOCUMENT, Injectable, REQUEST, inject } from '@angular/core';
import { esNavegador } from './almacen';

/**
 * Cookies que el servidor **también** puede leer.
 *
 * `localStorage` no sirve para decidir qué se renderiza: vive en el navegador y
 * el servidor no lo ve. Al montar SSR eso dejó de ser un detalle. El guard de
 * "muy pronto" guardaba el acceso anticipado en `localStorage`, así que en el
 * render de servidor siempre parecía que nadie lo tenía y todo el mundo acababa
 * en la pantalla de espera; sólo al hidratar, ya en el navegador, la página
 * saltaba a la de verdad. Una cookie viaja en la petición y elimina ese salto.
 *
 * Sólo para banderas cortas que el servidor necesita conocer antes de pintar
 * (acceso anticipado, consentimiento de cookies). Todo lo demás sigue en
 * `localStorage`, que no viaja en cada petición y no tiene límite de 4 KB.
 */
@Injectable({ providedIn: 'root' })
export class CookiesService {
  private readonly documento = inject(DOCUMENT);
  private readonly peticion = inject(REQUEST, { optional: true });

  /** Valor de la cookie, o `null` si no está. Funciona en servidor y navegador. */
  leer(nombre: string): string | null {
    const cabecera = esNavegador()
      ? this.documento.cookie
      : (this.peticion?.headers.get('cookie') ?? '');

    return leerDeCabecera(cabecera ?? '', nombre);
  }

  /**
   * Escribe la cookie. Sólo tiene efecto en el navegador: en el render de
   * servidor no hay a quién devolvérsela.
   *
   * `SameSite=Lax` deja que la cookie viaje cuando el visitante llega desde un
   * enlace externo —que es justo el caso del acceso anticipado, que se abre
   * desde un correo— pero no en peticiones de terceros.
   */
  escribir(nombre: string, valor: string, diasDeVida: number): void {
    if (!esNavegador()) return;

    const segundos = Math.round(diasDeVida * 24 * 60 * 60);
    const seguro = this.documento.location.protocol === 'https:' ? '; Secure' : '';

    this.documento.cookie =
      `${nombre}=${encodeURIComponent(valor)}; Path=/; Max-Age=${segundos}; SameSite=Lax${seguro}`;
  }

  /** Borra la cookie. Sólo tiene efecto en el navegador. */
  borrar(nombre: string): void {
    if (!esNavegador()) return;
    this.documento.cookie = `${nombre}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/** Separado de la clase para poder probarlo sin montar el inyector. */
export function leerDeCabecera(cabecera: string, nombre: string): string | null {
  for (const trozo of cabecera.split(';')) {
    const separador = trozo.indexOf('=');
    if (separador < 0) continue;

    if (trozo.slice(0, separador).trim() === nombre) {
      return decodeURIComponent(trozo.slice(separador + 1).trim());
    }
  }

  return null;
}
