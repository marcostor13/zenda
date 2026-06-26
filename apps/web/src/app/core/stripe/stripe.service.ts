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
    if (!this.stripePromise) {
      this.stripePromise = loadStripe(environment.stripePublicKey);
    }
    return this.stripePromise;
  }
}
