import { Injectable, inject } from '@angular/core';
import { PaymentsService } from './payments.service';

const CLAVE = 'doogking_pago_en_curso';

/**
 * El pago que el navegador dejó a medias al irse a la pasarela.
 *
 * Stripe se lleva al usuario fuera de la aplicación cuando la tarjeta pide
 * autenticación (3-D Secure) y lo devuelve a `return_url` con la página
 * recargada: la instancia del componente, y con ella el `pagoId`, ya no
 * existen. Sin este apunte no había forma de preguntarle al servidor cómo
 * quedó el cobro, así que la reserva se quedaba «pendiente de pago» con el
 * dinero ya cobrado hasta que llegara el webhook —y en local no llega nunca—.
 *
 * Va en `sessionStorage` y no en `localStorage` a propósito: es un apunte de
 * esta pestaña y de este rato, no una preferencia que deba sobrevivir a cerrar
 * el navegador.
 */
@Injectable({ providedIn: 'root' })
export class PagoEnCursoService {
  private readonly paymentsService = inject(PaymentsService);

  /** Deja anotado el pago justo antes de confirmar con la pasarela. */
  anotar(pagoId: string): void {
    try {
      sessionStorage.setItem(CLAVE, pagoId);
    } catch {
      // Navegación privada o almacenamiento lleno: el pago sigue su curso y el
      // webhook confirma igual, sólo que sin el atajo.
    }
  }

  olvidar(): void {
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      // Nada que hacer: el apunte caduca solo al cerrar la pestaña.
    }
  }

  pendiente(): string | null {
    try {
      return sessionStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  }

  /**
   * Pide al servidor que consulte el cobro en la pasarela y confirme lo
   * reservado.
   *
   * Devuelve `true` sólo cuando el pago está aprobado. Cualquier otra cosa
   * —incluido un fallo de red— devuelve `false`: el webhook sigue de respaldo,
   * y lo que no se puede hacer es prometer una reserva confirmada que el
   * listado enseña como pendiente.
   */
  async sincronizar(pagoId: string): Promise<boolean> {
    try {
      const { estado } = await this.paymentsService.sincronizar(pagoId);
      return estado === 'aprobado';
    } catch {
      return false;
    }
  }

  /**
   * Cierra el pago que quedó a medias, si lo hay. Se llama al aterrizar en las
   * pantallas a las que Stripe devuelve al usuario.
   */
  async cerrarPendiente(): Promise<boolean> {
    const pagoId = this.pendiente();
    if (!pagoId) return false;

    this.olvidar();
    return this.sincronizar(pagoId);
  }
}
