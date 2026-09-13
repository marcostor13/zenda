import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { almacenSesion, esNavegador } from '../plataforma/almacen';

/** Entre dos consultas seguidas a `/version.json`. No hace falta más fino. */
const INTERVALO_MINIMO_MS = 60_000;

/**
 * Margen antes de permitir otra recarga automática en la misma pestaña.
 *
 * Durante un despliegue conviven un momento el contenedor viejo y el nuevo. Sin
 * este freno, una pestaña que cayera alternativamente en uno y en otro se
 * recargaría en bucle: llega al viejo, ve versión distinta, recarga, llega al
 * nuevo, ve versión distinta, recarga otra vez.
 */
const ESPERA_ENTRE_RECARGAS_MS = 10 * 60_000;

const CLAVE_ULTIMA_RECARGA = 'doogking.version.ultimaRecarga';

/**
 * Detecta que se ha desplegado una versión nueva mientras la pestaña seguía
 * abierta, y la trae en la siguiente navegación.
 *
 * Existe por el caso de móvil: la pestaña o la app añadida a la pantalla de
 * inicio viven días sin cerrarse, el HTML se pidió una sola vez y los bundles
 * que cargó siguen sirviéndose igual —llevan hash, no caducan nunca—, así que
 * el visitante se queda en el despliegue del día que entró y no hay nada que le
 * saque de ahí salvo recargar a mano.
 *
 * Las cabeceras de `server.ts` arreglan la mitad del problema (quien recarga o
 * vuelve a entrar recibe el HTML nuevo); esto arregla la otra mitad, la de
 * quien no recarga nunca.
 *
 * La recarga se aplica **en la siguiente navegación**, no en cuanto se detecta:
 * cambiar de página es justo el momento en que no se pierde nada, y arrancarle
 * la pantalla a alguien que está rellenando una reserva sería peor que el fallo
 * que se intenta arreglar.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);

  /** La que servía el contenedor cuando se cargó esta pestaña. */
  private versionInicial: string | null = null;
  private ultimaConsulta = 0;
  private hayDespliegueNuevo = false;

  /** Se llama una vez al arrancar la aplicación. Nunca lanza. */
  iniciar(): void {
    // En la app nativa el código viene del paquete instalado, no del servidor:
    // ahí `/version.json` no existe y actualizar es cosa de la tienda.
    if (!esNavegador() || Capacitor.isNativePlatform()) return;

    this.versionInicial = this.marcaDelHtml();

    void this.consultar();

    // Volver a la pestaña tras dejarla de fondo es el momento típico en móvil:
    // el sistema la mantuvo viva horas y nadie ha pedido nada al servidor.
    this.documento.addEventListener('visibilitychange', () => {
      if (this.documento.visibilityState === 'visible') void this.consultar();
    });

    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) this.alNavegar(evento.url);
    });
  }

  private alNavegar(url: string): void {
    if (!this.hayDespliegueNuevo) {
      void this.consultar();
      return;
    }
    if (!this.puedeRecargar()) return;

    almacenSesion().setItem(CLAVE_ULTIMA_RECARGA, String(Date.now()));
    // Recarga completa y no navegación de Angular: es lo único que vuelve a
    // pedir el HTML, y con él las etiquetas `<script>` del despliegue nuevo.
    this.documento.defaultView?.location.assign(url);
  }

  private puedeRecargar(): boolean {
    const ultima = Number(almacenSesion().getItem(CLAVE_ULTIMA_RECARGA) ?? 0);
    return !Number.isFinite(ultima) || Date.now() - ultima > ESPERA_ENTRE_RECARGAS_MS;
  }

  private async consultar(): Promise<void> {
    const ahora = Date.now();
    if (this.hayDespliegueNuevo || ahora - this.ultimaConsulta < INTERVALO_MINIMO_MS) return;
    this.ultimaConsulta = ahora;

    const publicada = await this.leerVersionPublicada();
    if (publicada === null) return;

    if (this.versionInicial === null) {
      this.versionInicial = publicada;
      return;
    }
    this.hayDespliegueNuevo = publicada !== this.versionInicial;
  }

  /**
   * Build del que salió el HTML que tiene delante el visitante, que `server.ts`
   * estampa al renderizarlo.
   *
   * Es la mitad que faltaba. Antes la referencia se tomaba de la **primera**
   * consulta a `/version.json`, que la responde el contenedor en marcha: una
   * pestaña que arrancaba con el HTML de hace tres días guardaba como "su"
   * versión la del despliegue actual y a partir de ahí todo le cuadraba, así
   * que no se detectaba nunca el caso más común —quedarse atrás— sino sólo el
   * despliegue que ocurría con la pestaña ya abierta.
   *
   * Si no hay marca (`ng serve` sin render de servidor) se vuelve al
   * comportamiento anterior: mejor eso que no vigilar nada.
   */
  private marcaDelHtml(): string | null {
    const meta = this.documento.querySelector?.('meta[name="dk-build"]');
    return meta?.getAttribute('content') || null;
  }

  private async leerVersionPublicada(): Promise<string | null> {
    try {
      const respuesta = await fetch('/version.json', { cache: 'no-store' });
      if (!respuesta.ok) return null;
      const cuerpo = (await respuesta.json()) as { version?: unknown };
      return typeof cuerpo.version === 'string' ? cuerpo.version : null;
    } catch {
      // Sin red o con el servidor caído no hay nada que decidir: se reintenta
      // en la siguiente navegación. Esto nunca debe romper la navegación.
      return null;
    }
  }
}
