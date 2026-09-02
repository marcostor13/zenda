import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { StripeService } from '../../../core/stripe/stripe.service';
import { CarritoService } from '../../carrito/carrito.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Pago único de un viaje multi-vertical. Las reservas **ya existen** en estado
 * pendiente cuando se llega aquí: este paso solo cobra. Si el pago falla, las
 * retenciones de plaza caducan solas por TTL y el viaje vuelve a estar libre.
 */
@Component({
  selector: 'app-viaje-pago',
  standalone: true,
  imports: [
    TraducirPipe, CurrencyPipe, RouterLink, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="vp-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--sm vp-wrap">
    @if (!clientSecret()) {
      <div class="rs-card vp-card">
        <h1>{{ 'No hay ningún pago en curso' | t }}</h1>
        <p>{{ 'Vuelve a tu viaje y pulsa «Reservar el viaje» para continuar.' | t }}</p>
        <a routerLink="/reservas" class="rs-btn rs-btn--primary">{{ 'Ir a mis reservas' | t }}</a>
      </div>
    } @else {
      <div class="rs-card vp-card">
        <header class="vp-head">
          <p class="vp-eyebrow">{{ 'Último paso' | t }}</p>
          <h1>{{ 'Confirma tu viaje' | t }}</h1>
          <p class="vp-sub">
            {{ 'Un solo pago para todo el viaje. Cada servicio queda como una reserva independiente, con su propia política de cancelación.' | t }}
          </p>
        </header>

        <div class="vp-total">
          <span>{{ 'Total' | t }}</span>
          <strong>{{ montoTotal() | currency: 'EUR' }}</strong>
        </div>

        <div id="vp-stripe" class="vp-stripe"></div>

        @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

        <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                [disabled]="!listo() || procesando()" (click)="pagar()">
          @if (procesando()) { Procesando el pago… }
          @else if (!listo()) { Preparando el pago… }
          @else { Pagar {{ montoTotal() | currency: 'EUR' }} }
        </button>

        <p class="vp-seguro">
          <rs-icon name="lock" [size]="13" [stroke]="2"></rs-icon>
          {{ 'Pago seguro con Stripe. El importe se retiene hasta que se preste el servicio.' | t }}
        </p>
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .vp-page { min-height: 100vh; background: var(--c-base); }
    .vp-wrap { padding-block: var(--sp-10); }
    .vp-card { padding: var(--sp-8); }

    .vp-head { margin-bottom: var(--sp-6); }
    .vp-eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .vp-head h1 { font-size: var(--f-2xl); color: var(--dk-blue); }
    .vp-sub { color: var(--t-400); margin-top: var(--sp-2); line-height: 1.6; }

    .vp-total {
      display: flex; align-items: baseline; justify-content: space-between;
      padding: var(--sp-4) 0; margin-bottom: var(--sp-5);
      border-block: 1px solid var(--b-1);
      span { color: var(--t-400); }
      strong { font-size: var(--f-2xl); color: var(--dk-blue); }
    }

    .vp-stripe { min-height: 220px; margin-bottom: var(--sp-5); }

    .vp-seguro {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
      margin-top: var(--sp-4); font-size: var(--f-xs); color: var(--t-400);
    }
  `],
})
export class ViajePagoComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly stripeService = inject(StripeService);
  private readonly carritoService = inject(CarritoService);

  readonly clientSecret = signal('');
  readonly montoTotal = signal(0);
  readonly listo = signal(false);
  readonly procesando = signal(false);
  readonly error = signal('');

  private stripe: Stripe | null = null;
  private elements?: StripeElements;

  async ngOnInit(): Promise<void> {
    const estado = this.router.getCurrentNavigation()?.extras.state
      ?? (history.state as Record<string, unknown> | undefined);

    const secret = (estado?.['clientSecret'] as string) ?? '';
    if (!secret) return;

    this.clientSecret.set(secret);
    this.montoTotal.set((estado?.['montoTotal'] as number) ?? 0);
    await this.montarStripe(secret);
  }

  private async montarStripe(clientSecret: string): Promise<void> {
    try {
      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe) throw new Error('Stripe no disponible');

      this.elements = this.stripe.elements({ clientSecret });
      this.elements.create('payment').mount('#vp-stripe');
      this.listo.set(true);
    } catch {
      this.error.set('No se pudo cargar el formulario de pago. Recarga la página.');
    }
  }

  async pagar(): Promise<void> {
    if (!this.stripe || !this.elements) return;

    this.procesando.set(true);
    this.error.set('');

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: `${window.location.origin}/reservas` },
    });

    if (error) {
      this.error.set(error.message ?? 'No se pudo completar el pago.');
      this.procesando.set(false);
      return;
    }

    // Si Stripe no redirige (pagos sin 3-D Secure), se navega a mano.
    await this.carritoService.cargar();
    await this.router.navigate(['/reservas']);
  }
}
