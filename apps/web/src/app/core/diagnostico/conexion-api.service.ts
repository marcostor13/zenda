import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Registra si el API está respondiendo.
 *
 * Existe por un fallo que costó dos APKs: la app se instalaba, abría y no
 * cargaba nada, **sin decir por qué**. Las dos causas —una URL apuntando a
 * `localhost` y un CORS que bloqueaba el origen del WebView— se ven igual desde
 * dentro: la petición ni siquiera llega a tener código de estado. Sin nada en
 * pantalla, la única forma de averiguarlo era depurar el móvil por cable.
 */
@Injectable({ providedIn: 'root' })
export class ConexionApiService {
  /** Última URL que no se pudo alcanzar; null mientras el API responda. */
  readonly fallo = signal<string | null>(null);

  /** La dirección a la que está llamando la app, para poder enseñarla. */
  readonly apiUrl = environment.apiUrl;

  registrarFallo(url: string): void {
    this.fallo.set(url);
    // Queda también en el log del WebView: con `chrome://inspect` se lee sin
    // tener que reproducir el caso a mano.
    console.error(`[Doogking] No se pudo contactar con el API: ${url} (base: ${this.apiUrl})`);
  }

  registrarExito(): void {
    if (this.fallo() !== null) this.fallo.set(null);
  }
}
