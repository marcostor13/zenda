import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { ApplicationRef, Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { of, tap } from 'rxjs';

/** Lo que se guarda de cada respuesta para reutilizarla en el navegador. */
interface RespuestaTransferida {
  readonly body: unknown;
  readonly status: number;
  readonly statusText: string;
}

/**
 * Tope por respuesta. Lo transferido viaja dentro del HTML: una lista enorme
 * engordaría la página más de lo que ahorra no repetir la petición.
 */
const TAMANO_MAXIMO = 200_000;

/**
 * Clave de la respuesta: método y ruta con su consulta, **sin el dominio**. El
 * render de servidor puede hablar con el API por otra dirección (la interna del
 * contenedor) que el navegador; con el dominio dentro, las claves no casarían.
 *
 * No entra `Accept-Language`: el API responde igual en todos los idiomas (ver
 * `idioma.interceptor.ts`). Si algún día traduce, hay que añadirlo aquí.
 */
export function claveDeTransferencia(peticion: HttpRequest<unknown>): string {
  const ruta = peticion.urlWithParams.replace(/^https?:\/\/[^/]+/i, '');
  return `dk-http:${peticion.method}:${ruta}`;
}

/**
 * La caché sólo vale para el primer pintado: en cuanto la aplicación se
 * estabiliza, cada navegación vuelve a pedir datos frescos.
 */
@Injectable({ providedIn: 'root' })
export class VentanaDeTransferencia {
  private abierta = true;

  constructor() {
    void inject(ApplicationRef).whenStable().then(() => { this.abierta = false; });
  }

  get estaAbierta(): boolean {
    return this.abierta;
  }
}

function esTransferible(peticion: HttpRequest<unknown>): boolean {
  // Con sesión, la respuesta puede depender de quién pide; el servidor nunca
  // tiene sesión, así que no habría nada que reutilizar.
  return peticion.method === 'GET'
    && peticion.responseType === 'json'
    && !peticion.headers.has('Authorization');
}

/**
 * Evita la doble petición del render de servidor.
 *
 * Sin esto, cada ficha se pedía dos veces: una en Node para pintar el HTML y
 * otra en el navegador al arrancar Angular, que no reutiliza lo que ya vino.
 * El servidor deja cada respuesta pública en `TransferState` —viaja serializada
 * en el HTML— y el navegador la consume una sola vez en lugar de volver a
 * llamar al API. Va después de `authInterceptor` para ver si hay sesión.
 */
export const transferenciaInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!esTransferible(peticion)) return siguiente(peticion);

  const estado = inject(TransferState);
  const clave = makeStateKey<RespuestaTransferida>(claveDeTransferencia(peticion));

  if (isPlatformServer(inject(PLATFORM_ID))) {
    return siguiente(peticion).pipe(tap((evento) => {
      if (!(evento instanceof HttpResponse) || !evento.ok) return;
      if (JSON.stringify(evento.body ?? null).length > TAMANO_MAXIMO) return;
      estado.set(clave, { body: evento.body, status: evento.status, statusText: evento.statusText });
    }));
  }

  if (!inject(VentanaDeTransferencia).estaAbierta) return siguiente(peticion);

  const guardada = estado.get(clave, null);
  if (!guardada) return siguiente(peticion);

  estado.remove(clave);
  return of(new HttpResponse({
    body: guardada.body,
    status: guardada.status,
    statusText: guardada.statusText,
    url: peticion.urlWithParams,
  }));
};
