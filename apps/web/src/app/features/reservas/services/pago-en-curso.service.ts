import { Injectable, inject } from '@angular/core';
import { PaymentsService } from './payments.service';
import { almacenSesion } from '../../../core/plataforma/almacen';

const CLAVE = 'doogking_pago_en_curso';

/** Cómo quedó un cobro, en los términos que necesita la pantalla. */
export type ResultadoPago = 'aprobado' | 'procesando' | 'no_cobrado' | 'desconocido';

/** El cobro se hizo —o no sabemos que no— pero la reserva aún no consta confirmada. */
export const vaConRetraso = (resultado: ResultadoPago | null): boolean =>
  resultado === 'procesando' || resultado === 'desconocido';

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
      almacenSesion().setItem(CLAVE, pagoId);
    } catch {
      // Navegación privada o almacenamiento lleno: el pago sigue su curso y el
      // webhook confirma igual, sólo que sin el atajo.
    }
  }

  olvidar(): void {
    try {
      almacenSesion().removeItem(CLAVE);
    } catch {
      // Nada que hacer: el apunte caduca solo al cerrar la pestaña.
    }
  }

  pendiente(): string | null {
    try {
      return almacenSesion().getItem(CLAVE);
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
    return (await this.consultar(pagoId)) === 'aprobado';
  }

  /**
   * Lo mismo que `sincronizar`, pero contando **por qué** no está aprobado.
   *
   * Hace falta al volver de una pasarela con redirección (Bancontact, Klarna,
   * la app del banco…): el cliente puede haber cancelado allí, y entonces
   * decirle «tu pago se está confirmando» es mentirle. `no_cobrado` es ese
   * caso; `desconocido` es que no se ha podido preguntar, y ahí manda la
   * prudencia: no se afirma ni que pagó ni que no.
   */
  async consultar(pagoId: string): Promise<ResultadoPago> {
    try {
      const { estado } = await this.paymentsService.sincronizar(pagoId);
      if (estado === 'aprobado' || estado === 'procesando') return estado;
      return 'no_cobrado';
    } catch {
      return 'desconocido';
    }
  }

  /**
   * Cierra el pago que quedó a medias, si lo hay, y cuenta cómo quedó. Se llama
   * al aterrizar en las pantallas a las que Stripe devuelve al usuario. `null`
   * si no había ninguno.
   */
  async resolverPendiente(): Promise<ResultadoPago | null> {
    const pagoId = this.pendiente();
    if (!pagoId) return null;

    this.olvidar();
    return this.consultar(pagoId);
  }
}
