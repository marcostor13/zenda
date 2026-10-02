import { Injectable, computed, signal } from '@angular/core';

/**
 * Estado compartido del asistente: si está abierto, desde qué botón se abrió y
 * si hay un botón en la cabecera que lo abra.
 *
 * El botón vive en la barra de navegación (`rs-asistente-disparador`) y el
 * panel en la raíz de la app (`rs-asistente`); este servicio los une. Cuando la
 * pantalla no tiene cabecera —un paso de reserva a pantalla completa— no hay
 * disparador registrado y el panel enseña su propio botón flotante, para que
 * la ayuda no desaparezca nunca.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteUiService {
  private readonly disparadores = signal(0);

  readonly abierto = signal(false);
  /** Botón desde el que se abrió: el panel se ancla junto a él. */
  readonly origen = signal<HTMLElement | null>(null);
  readonly hayDisparadorEnCabecera = computed(() => this.disparadores() > 0);

  registrarDisparador(): void { this.disparadores.update((n) => n + 1); }
  retirarDisparador(): void { this.disparadores.update((n) => Math.max(0, n - 1)); }

  alternar(origen: HTMLElement | null): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.origen.set(origen);
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }
}
