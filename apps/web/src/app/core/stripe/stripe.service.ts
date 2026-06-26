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
    const promise = this.stripePromise ?? loadStripe(environment.stripePublicKey);
    this.stripePromise = promise;
    return promise;
  }
}
