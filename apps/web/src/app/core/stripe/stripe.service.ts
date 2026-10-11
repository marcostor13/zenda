import { Injectable } from '@angular/core';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';

/**
 * Carga perezosa del SDK de Stripe.js con la clave publicable del entorno.
 * Mantiene una única promesa para no recargar el script en cada uso.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private stripePromise?: Promise<Stripe | null>;

  getStripe(): Promise<Stripe | null> {
    /*
     * Con una clave de pruebas Stripe.js pinta su asistente: una pastilla negra
     * fija abajo a la derecha. En móvil caía justo encima del botón de pagar de
     * la barra inferior y lo tapaba. No aporta nada a quien reserva, así que
     * se apaga.
     */
    const promise = this.stripePromise ?? loadStripe(environment.stripePublicKey, {
      developerTools: { assistant: { enabled: false } },
    });
    this.stripePromise = promise;
    return promise;
  }
}
