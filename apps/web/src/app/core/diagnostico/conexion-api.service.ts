import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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

  /**
   * El aviso en pantalla es **sólo para la app instalada**.
   *
   * Ahí ganaba algo: sin él, un API inalcanzable dejaba una pantalla en blanco
   * y la única salida era depurar el móvil por cable. En el navegador ese dato
   * ya está en la consola y en la pestaña de red, así que la banda roja sobra
   * y molesta durante el desarrollo.
   */
  readonly mostrarAviso = computed(() => this.fallo() !== null && Capacitor.isNativePlatform());

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
