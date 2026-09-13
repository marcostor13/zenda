import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { almacenSesion, esNavegador } from '../plataforma/almacen';
import { esErrorDeChunk } from './chunk-fallido';

/**
 * Margen entre dos recargas de recuperación en la misma pestaña. Si tras
 * recargar el trozo sigue sin cargarse, el problema no es la versión guardada y
 * volver a recargar sólo dejaría al visitante en un bucle de pantallas en blanco.
 */
const ESPERA_ENTRE_RECARGAS_MS = 60_000;

const CLAVE_ULTIMA_RECARGA = 'doogking.chunk.ultimaRecarga';

/**
 * Convierte la pantalla en blanco en una recarga.
 *
 * El caso real: alguien entra desde el móvil, deja la pestaña abierta, se
 * despliega una versión nueva y al volver pulsa "Buscar". El listado vive en un
 * fichero aparte que se pide en ese momento, con el nombre que tenía en el
 * despliegue con el que arrancó la pestaña. Ese fichero ya no existe —cada
 * despliegue construye una imagen nueva y la anterior se va entera—, la carga
 * falla y la navegación muere sin pintar nada: el buscador se queda en blanco.
 * A quien tenía guardado el HTML del despliegue actual no le pasa, y de ahí que
 * «en algunos dispositivos funciona».
 *
 * `VersionService` se adelanta a esto comparando versiones, pero depende de que
 * dé tiempo a consultar `/version.json` antes de que el visitante pulse. Esto es
 * la red debajo: si el fallo llega igualmente, se recarga la página —que es lo
 * único que trae el HTML nuevo y con él los nombres buenos— en vez de dejar la
 * pantalla vacía.
 */
@Injectable({ providedIn: 'root' })
export class RecuperacionChunkService {
  private readonly documento = inject(DOCUMENT);

  /**
   * Escucha los fallos que no pasan por el router: la carga del diccionario de
   * idioma, un componente que se pide desde una plantilla. Se llama una vez al
   * arrancar y nunca lanza.
   */
  iniciar(): void {
    // En la app nativa el código viene del paquete instalado: no hay nada que
    // volver a pedir al servidor y recargar no arreglaría nada.
    if (!esNavegador() || Capacitor.isNativePlatform()) return;

    this.documento.defaultView?.addEventListener('unhandledrejection', (evento) => {
      this.recuperar((evento as PromiseRejectionEvent).reason);
    });
  }

  /**
   * Recarga la página si el error es un trozo que no se pudo traer. Devuelve
   * `true` cuando ha pedido la recarga, para que quien llama sepa que no tiene
   * que enseñar ningún mensaje de error.
   *
   * @param destino URL a la que se iba, si la navegación no llegó a cambiarla.
   */
  recuperar(error: unknown, destino?: string): boolean {
    if (!esNavegador() || Capacitor.isNativePlatform()) return false;
    if (!esErrorDeChunk(error) || !this.puedeRecargar()) return false;

    almacenSesion().setItem(CLAVE_ULTIMA_RECARGA, String(Date.now()));

    const ventana = this.documento.defaultView;
    // `assign` y no `reload`: al fallar la navegación la barra de direcciones
    // se queda en la página anterior, así que recargar devolvería al visitante
    // a donde estaba y no a donde iba.
    if (destino) ventana?.location.assign(destino);
    else ventana?.location.reload();

    return true;
  }

  private puedeRecargar(): boolean {
    const ultima = Number(almacenSesion().getItem(CLAVE_ULTIMA_RECARGA) ?? 0);
    return !Number.isFinite(ultima) || Date.now() - ultima > ESPERA_ENTRE_RECARGAS_MS;
  }
}
