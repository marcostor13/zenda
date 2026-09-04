import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { StripeService } from '../../../core/stripe/stripe.service';
import { CarritoService } from '../../carrito/carrito.service';
import { PagoEnCursoService } from '../services/pago-en-curso.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { EurosFijosPipe, EurosPipe } from '../../../shared/pipes/euros.pipe';
import { MonedaService } from '../../../core/moneda/moneda.service';

const TITULO_VIAJE = 'Confirma tu viaje';
const DESCRIPCION_VIAJE =
  'Un solo pago para todo el viaje. Cada servicio queda como una reserva independiente, con su propia política de cancelación.';

/**
 * Pago único de un viaje multi-vertical. Las reservas **ya existen** en estado
 * pendiente cuando se llega aquí: este paso solo cobra. Si el pago falla, las
 * retenciones de plaza caducan solas por TTL y el viaje vuelve a estar libre.
 */
@Component({
  selector: 'app-viaje-pago',
  standalone: true,
  imports: [
    TraducirPipe, EurosPipe, EurosFijosPipe, RouterLink, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="vp-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--sm vp-wrap">
    @if (!clientSecret()) {
      <div class="rs-card vp-card">
        <h1>{{ 'No hay ningún pago en curso' | t }}</h1>
        <p>{{ 'Vuelve a tus reservas y retoma desde ahí el pago que dejaste a medias.' | t }}</p>
        <a routerLink="/reservas" class="rs-btn rs-btn--primary">{{ 'Ir a mis reservas' | t }}</a>
      </div>
    } @else {
      <div class="rs-card vp-card">
        <header class="vp-head">
          <p class="vp-eyebrow">{{ 'Último paso' | t }}</p>
          <h1>{{ titulo() | t }}</h1>
          <p class="vp-sub">{{ descripcion() | t }}</p>
        </header>

        <div class="vp-total">
          <span>{{ 'Total' | t }}</span>
          <strong>{{ montoTotal() | euros }}</strong>
        </div>

        <!-- Mismo aviso que en la reserva simple: el cargo va en euros. -->
        @if (moneda.esConvertida()) {
          <p class="vp-divisa" role="status">
            <rs-icon name="alert-circle" [size]="13" [stroke]="2"></rs-icon>
            {{ 'Importe orientativo. El cargo se hará en euros por' | t }}
            <strong>{{ montoTotal() | eurosFijos }}</strong>.
          </p>
        }

        <div id="vp-stripe" class="vp-stripe"></div>

        @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

        <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                [disabled]="!listo() || procesando()" (click)="pagar()">
          @if (procesando()) { Procesando el pago… }
          @else if (!listo()) { Preparando el pago… }
          @else { Pagar {{ montoTotal() | euros }} }
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
    .vp-page { min-height: 100vh; min-height: 100dvh; background: var(--c-base); }
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

    .vp-divisa {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      margin-bottom: var(--sp-5); font-size: var(--f-xs); line-height: 1.45; color: var(--t-400);
      rs-icon { flex-shrink: 0; margin-top: 2px; }
      strong { color: var(--t-200); }
    }
  `],
})
export class ViajePagoComponent implements OnInit {
  /** Divisa de visualización; el cobro sigue siendo en euros. */
  readonly moneda = inject(MonedaService);

  private readonly router = inject(Router);
  private readonly stripeService = inject(StripeService);
  private readonly carritoService = inject(CarritoService);
  private readonly pagoEnCurso = inject(PagoEnCursoService);

  readonly clientSecret = signal('');
  readonly montoTotal = signal(0);

  /*
   * La pantalla cobra algo que **ya está reservado**, y eso vale igual para un
   * viaje entero que para una reserva suelta que se quedó sin pagar. Sólo
   * cambia el texto, así que lo trae quien navega en vez de duplicar el
   * componente: el formulario de pago, el aviso de divisa y el cierre contra el
   * servidor son los mismos.
   */
  readonly titulo = signal(TITULO_VIAJE);
  readonly descripcion = signal(DESCRIPCION_VIAJE);
  readonly listo = signal(false);
  readonly procesando = signal(false);
  readonly error = signal('');

  private pagoId = '';
  private stripe: Stripe | null = null;
  private elements?: StripeElements;

  async ngOnInit(): Promise<void> {
    // Vuelta de la autenticación de la tarjeta: la página se ha recargado y lo
    // único que queda del pago es el apunte de sesión. Se cierra ahí mismo, sin
    // volver a montar el formulario de una tarjeta que ya se ha cobrado.
    if (this.vuelveDeLaPasarela()) {
      await this.terminar();
      return;
    }

    const estado = this.router.getCurrentNavigation()?.extras.state
      ?? (history.state as Record<string, unknown> | undefined);

    const secret = (estado?.['clientSecret'] as string) ?? '';
    if (!secret) return;

    this.clientSecret.set(secret);
    this.montoTotal.set((estado?.['montoTotal'] as number) ?? 0);
    this.pagoId = (estado?.['pagoId'] as string) ?? '';
    this.titulo.set((estado?.['titulo'] as string) || TITULO_VIAJE);
    this.descripcion.set((estado?.['descripcion'] as string) || DESCRIPCION_VIAJE);
    await this.montarStripe(secret);
  }

  /** Stripe devuelve al usuario con el resultado en la barra de direcciones. */
  private vuelveDeLaPasarela(): boolean {
    return new URLSearchParams(window.location.search).has('payment_intent');
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

    /*
     * El apunte va **antes** de confirmar: si la tarjeta pide autenticación,
     * Stripe se lleva al navegador fuera y esta instancia deja de existir con
     * el `pagoId` dentro. `return_url` trae al usuario de vuelta a esta misma
     * pantalla, que en `ngOnInit` cierra el pago contra el servidor.
     */
    if (this.pagoId) this.pagoEnCurso.anotar(this.pagoId);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: window.location.href },
      // Sin esto todo pago se iba por recarga completa, incluso los que no la
      // necesitan, y se perdía el resultado que Stripe ya había devuelto.
      redirect: 'if_required',
    });

    if (error) {
      // El viaje sigue reservado en estado pendiente y sus retenciones caducan
      // solas por TTL: se puede reintentar sin volver a montar el carrito.
      this.pagoEnCurso.olvidar();
      this.error.set(error.message ?? 'No se pudo completar el pago.');
      this.procesando.set(false);
      return;
    }

    await this.terminar();
  }

  /**
   * Cierra el cobro contra el servidor y lleva al listado.
   *
   * El paso que faltaba: hasta ahora se navegaba a `/reservas` nada más
   * confirmar en el navegador y las reservas del viaje se quedaban
   * «pendientes» hasta que llegara el webhook de Stripe —en local, nunca—,
   * aunque el dinero ya estuviera cobrado.
   */
  private async terminar(): Promise<void> {
    const confirmado = await this.pagoEnCurso.cerrarPendiente();
    await this.carritoService.cargar();
    await this.router.navigate(['/reservas'], {
      // El listado avisa de que la confirmación va con retraso en vez de
      // enseñar «pendiente» sin explicación.
      queryParams: confirmado ? {} : { confirmacionPendiente: 1 },
    });
  }
}
