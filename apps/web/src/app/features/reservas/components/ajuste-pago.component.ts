import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { StripeService } from '../../../core/stripe/stripe.service';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { PagoEnCursoService } from '../services/pago-en-curso.service';
import type { Stripe, StripeElements } from '@stripe/stripe-js';

import { EurosPipe } from '../../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
@Component({
  selector: 'app-ajuste-pago',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, EurosPipe
  ],
  template: `
<div class="dk-pagina">
  <rs-navbar />

  <div class="rs-wrap" style="max-width:520px;padding-block:var(--sp-10)">
    <a routerLink="/reservas/mis-reservas" class="back-link">{{ '← Volver a mis reservas' | t }}</a>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">{{ 'Cargando…' | t }}</div>
    } @else if (pagado()) {
      <div class="rs-card" style="padding:var(--sp-10);text-align:center">
        <h2 style="color:var(--t-100);margin-bottom:var(--sp-2)">{{ '¡Suplemento pagado!' | t }}</h2>
        @if (confirmacionPendiente()) {
          <!-- El cobro entró pero el servidor aún no ha aplicado el ajuste:
               decirlo evita que el listado parezca contradecir esta pantalla. -->
          <p style="color:var(--t-400);margin-bottom:var(--sp-6)">
            {{ 'El pago se ha realizado correctamente. Estamos terminando de aplicar el ajuste: puede tardar un momento en verse en tus reservas.' | t }}
          </p>
        } @else {
          <p style="color:var(--t-400);margin-bottom:var(--sp-6)">Tu reserva {{ reserva()?.codigo }} vuelve a estar confirmada.</p>
        }
        <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--primary">{{ 'Volver a mis reservas' | t }}</a>
      </div>
    } @else if (errorCarga()) {
      <div class="rs-alert rs-alert--error">{{ errorCarga() }}</div>
    } @else {
      <div class="rs-card ajuste-card">
        <h1>{{ 'Ajuste de precio solicitado' | t }}</h1>
        <p class="ajuste-card__sub">
          {{ reserva()?.codigo }} · el comercio ha detectado circunstancias no indicadas en la reserva.
        </p>

        <div class="ajuste-card__suplementos">
          @for (s of reserva()?.suplementos; track s.concepto) {
            <div class="ajuste-linea">
              <span>{{ s.concepto }}</span>
              <span>+{{ s.monto | euros:'1.2-2' }}</span>
            </div>
          }
        </div>

        <div class="ajuste-card__totales">
          <div class="ajuste-linea"><span>{{ 'Precio inicial' | t }}</span><span>{{ reserva()?.montoTotal | euros:'1.2-2' }}</span></div>
          <div class="ajuste-linea"><span>{{ 'Nuevo precio' | t }}</span><span>{{ reserva()?.montoAjustado | euros:'1.2-2' }}</span></div>
          <div class="ajuste-linea ajuste-linea--total"><span>{{ 'Diferencia a pagar' | t }}</span><span>{{ diferencia() | euros:'1.2-2' }}</span></div>
        </div>

        <p class="ajuste-card__legal">
          {{ 'Ningún coste adicional se aplicará sin tu aprobación. Si prefieres no continuar, puedes rechazar el ajuste: se te reembolsará el importe original y la reserva se cancelará.' | t }}
        </p>

        @if (errorPago()) {
          <div class="rs-alert rs-alert--error">{{ errorPago() }}</div>
        }

        @if (stripeListo()) {
          <div id="stripe-ajuste-element" style="margin:var(--sp-4) 0"></div>
          <div class="ajuste-card__actions">
            <button class="rs-btn rs-btn--ghost" [disabled]="procesando() || rechazando()" (click)="rechazar()">
              {{ rechazando() ? 'Rechazando…' : 'Rechazar y cancelar' }}
            </button>
            <button class="rs-btn rs-btn--primary" [disabled]="procesando()" (click)="confirmarPago()">
              {{ procesando() ? 'Procesando…' : 'Pagar diferencia' }}
            </button>
          </div>
        } @else {
          <button class="rs-btn rs-btn--ghost" [disabled]="rechazando()" (click)="rechazar()">
            {{ rechazando() ? 'Rechazando…' : 'Rechazar y cancelar' }}
          </button>
        }
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    .back-link { display: inline-block; color: var(--t-400); font-size: var(--f-sm); text-decoration: none; margin-bottom: var(--sp-6); }
    .ajuste-card { padding: var(--sp-8); }
    .ajuste-card h1 { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .ajuste-card__sub { color: var(--t-400); font-size: var(--f-sm); margin-bottom: var(--sp-6); }
    .ajuste-card__suplementos { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); padding-bottom: var(--sp-4); border-bottom: 1px solid var(--b-1); }
    .ajuste-linea { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-300); }
    .ajuste-linea--total { font-size: var(--f-md); font-weight: var(--w-8); color: var(--t-100); margin-top: var(--sp-2); }
    .ajuste-card__totales { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .ajuste-card__legal { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-4); }
    .ajuste-card__actions { display: flex; justify-content: space-between; gap: var(--sp-3); }
  `],
})
export class AjustePagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservasService = inject(ReservasService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly stripeService = inject(StripeService);
  private readonly pagoEnCurso = inject(PagoEnCursoService);

  readonly cargando = signal(true);
  readonly reserva = signal<ReservaApi | null>(null);
  readonly errorCarga = signal<string | null>(null);
  readonly errorPago = signal<string | null>(null);
  readonly stripeListo = signal(false);
  readonly procesando = signal(false);
  readonly rechazando = signal(false);
  readonly pagado = signal(false);

  /** El cobro entró pero el servidor aún no ha aplicado el ajuste. */
  readonly confirmacionPendiente = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private reservaId: string | null = null;
  private pagoId: string | null = null;

  readonly diferencia = computed(() => {
    const r = this.reserva();
    if (!r || r.montoAjustado === undefined) return 0;
    return Math.round((r.montoAjustado - r.montoTotal) * 100) / 100;
  });

  async ngOnInit(): Promise<void> {
    // Vuelta de la autenticación de la tarjeta: la página se ha recargado y lo
    // único que queda del cobro es el apunte de sesión.
    if (new URLSearchParams(window.location.search).has('payment_intent')
        && this.pagoEnCurso.pendiente()) {
      this.confirmacionPendiente.set(!await this.pagoEnCurso.cerrarPendiente());
      this.pagado.set(true);
      this.cargando.set(false);
      return;
    }

    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (!codigo) { this.cargando.set(false); return; }

    try {
      const reserva = await this.reservasService.obtenerPorCodigo(codigo);
      this.reserva.set(reserva);
      this.reservaId = reserva._id ?? reserva.id ?? null;

      if (reserva.estado !== 'ajuste_solicitado' || !this.reservaId) {
        this.errorCarga.set('Esta reserva no tiene ningún ajuste de precio pendiente de aprobación.');
        return;
      }
      await this.prepararStripe();
    } catch {
      this.errorCarga.set('No se pudo cargar la reserva.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async prepararStripe(): Promise<void> {
    if (!this.reservaId) return;
    try {
      const intent = await this.paymentsService.aceptarAjuste(this.reservaId);
      this.pagoId = intent.pagoId;
      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe) return;

      this.elements = this.stripe.elements({ clientSecret: intent.clientSecret });
      const paymentElement = this.elements.create('payment');
      setTimeout(() => paymentElement.mount('#stripe-ajuste-element'), 0);
      this.stripeListo.set(true);
    } catch {
      this.errorPago.set('No se pudo preparar el cobro de la diferencia. Inténtalo de nuevo.');
    }
  }

  async confirmarPago(): Promise<void> {
    if (!this.stripe || !this.elements) {
      this.errorPago.set('El pago no está disponible ahora mismo. Vuelve a intentarlo en unos segundos.');
      return;
    }
    this.procesando.set(true);
    this.errorPago.set(null);

    /*
     * El apunte va antes de confirmar, y `return_url` trae al cliente a esta
     * misma pantalla: si la tarjeta pide autenticación, Stripe se lleva el
     * navegador fuera y esta instancia deja de existir con el `pagoId` dentro.
     * Sin `return_url`, además, `redirect: 'if_required'` devuelve error en vez
     * de autenticar, así que el 3-D Secure —obligatorio en la mayoría de
     * emisores europeos— no tenía forma de completarse.
     */
    if (this.pagoId) this.pagoEnCurso.anotar(this.pagoId);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    this.procesando.set(false);

    if (error) {
      this.pagoEnCurso.olvidar();
      this.errorPago.set(error.message ?? 'No se pudo procesar el pago. Revisa los datos de la tarjeta.');
      return;
    }

    await this.cerrarCobro();
  }

  /**
   * Cierra el cobro del suplemento contra el servidor.
   *
   * Sin esto el ajuste quedaba aprobado sólo en el navegador y la reserva
   * seguía en «ajuste solicitado» hasta que llegara el webhook —en local,
   * nunca—, con la diferencia ya cobrada.
   */
  private async cerrarCobro(): Promise<void> {
    this.confirmacionPendiente.set(!await this.pagoEnCurso.sincronizar(this.pagoId ?? ''));
    this.pagoEnCurso.olvidar();
    this.pagado.set(true);
  }

  async rechazar(): Promise<void> {
    if (!this.reservaId) return;
    if (!confirm('¿Rechazar el ajuste? Se te reembolsará el importe original y la reserva se cancelará.')) return;

    this.rechazando.set(true);
    this.errorPago.set(null);
    try {
      await this.paymentsService.rechazarAjuste(this.reservaId);
      this.reserva.update((r) => (r ? { ...r, estado: 'cancelada' } : r));
      this.errorCarga.set('Has rechazado el ajuste. La reserva ha sido cancelada y el pago original reembolsado.');
    } catch {
      this.errorPago.set('No se pudo rechazar el ajuste. Inténtalo de nuevo.');
    } finally {
      this.rechazando.set(false);
    }
  }
}
