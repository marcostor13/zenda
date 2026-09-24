import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import {
  ConfirmacionEntrega, PatronRecurrenciaTransporte, PersonaContactoViaje, ResultadoTransporte, SolicitudTransporte,
  VerticalKey, instanteDeRecogida, resumenSolicitudTransporte,
} from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsOpcionesComponent } from '../../../../shared/components/opciones/rs-opciones.component';
import { RsPhoneInputComponent } from '../../../../shared/components/phone-input/rs-phone-input.component';
import { RsBarraCtaComponent } from '../../../../shared/components/barra-cta/rs-barra-cta.component';
import { RsDesglosePrecioComponent } from '../../../../shared/components/desglose-precio/rs-desglose-precio.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { StripeService } from '../../../../core/stripe/stripe.service';
import { esNavegador } from '../../../../core/plataforma/almacen';
import { mensajeDeError } from '../../../../shared/mensaje-error';
import { CrearReservaPayload, ReservasService } from '../../../reservas/services/reservas.service';
import { PaymentsService } from '../../../reservas/services/payments.service';
import { PagoEnCursoService } from '../../../reservas/services/pago-en-curso.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { ContactoViajeBorrador, TransporteViajeStore } from '../transporte-viaje.store';
import { OPCIONES_CONFIRMACION, OPCIONES_ENTREGA, OPCIONES_RECOGIDA } from '../transporte-viaje.opciones';

type Fase = 'datos' | 'pago';

const telefonoValido = Validators.pattern(/^\+?[\d\s]{6,20}$/);

function grupoContacto(c: ContactoViajeBorrador): FormGroup {
  return new FormGroup({
    quien: new FormControl<string>(c.quien, { nonNullable: true }),
    nombre: new FormControl<string>(c.nombre, { nonNullable: true, validators: [Validators.maxLength(120)] }),
    telefono: new FormControl<string>(c.telefono, { nonNullable: true, validators: [Validators.required, telefonoValido] }),
    complementoDireccion: new FormControl<string>(c.complementoDireccion, { nonNullable: true, validators: [Validators.maxLength(200)] }),
    indicaciones: new FormControl<string>(c.indicaciones, { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
}

/**
 * Pantallas 4 y 5 (diapositivas 07 y 08): quién entrega y quién recibe a la
 * mascota, y después la revisión con el precio cerrado y el pago.
 *
 * La reserva se crea al entrar en el pago, con los mismos datos con los que el
 * servidor cotizó: si el precio hubiera cambiado entre medias (otra empresa
 * cambió su tarifa), la reserva nace con el precio nuevo y se le enseña al
 * cliente antes de cobrar, nunca después.
 */
@Component({
  selector: 'app-reserva-viaje',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MarcoViajeComponent, RsOpcionesComponent, RsPhoneInputComponent, RsBarraCtaComponent,
    RsDesglosePrecioComponent, RsIconComponent, EurosPipe, TraducirPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje [paso]="fase() === 'datos' ? 4 : 5"
                 [titulo]="fase() === 'datos' ? 'Completa tu reserva' : 'Revisa y paga'"
                 [subtitulo]="fase() === 'datos' ? 'Todo claro antes de pagar.' : 'En pocos segundos.'"
                 [volverA]="fase() === 'datos' ? '/transporte/viaje/resultados' : null">
  @if (cargando()) {
    <div class="rs-skeleton rp__cargando"></div>
  } @else if (errorCarga()) {
    <div class="rs-alert rs-alert--error">{{ errorCarga() }}</div>
    <a class="rs-btn rs-btn--outline" routerLink="/transporte/viaje/resultados">{{ 'Volver a los resultados' | t }}</a>
  } @else {
    <div class="rp__empresa">
      @if (resultado()?.imagen) { <img [src]="resultado()?.imagen" [alt]="titulo()" /> }
      <div>
        <p class="rs-label-caps">{{ 'Transportista' | t }}</p>
        <strong>{{ titulo() }}</strong>
      </div>
    </div>

    @if (fase() === 'datos') {
      <form class="rp" [formGroup]="form" (ngSubmit)="irAPago()" novalidate>
        <section class="rp__bloque" formGroupName="recogida">
          <h2>{{ 'Datos de recogida' | t }}</h2>
          <p class="rp__direccion"><rs-icon name="map-pin" [size]="15" [stroke]="2"></rs-icon>{{ origenTexto() }}</p>
          <rs-opciones formControlName="quien" leyenda="Persona que entrega a la mascota" variante="segmento" [opciones]="opcionesRecogida" />
          @if (form.value.recogida?.quien !== 'yo') {
            <div class="rs-field">
              <label class="rs-lbl" for="recogida-nombre">{{ 'Nombre' | t }}</label>
              <input id="recogida-nombre" class="rs-inp" formControlName="nombre" autocomplete="name" />
            </div>
          }
          <rs-phone-input formControlName="telefono" inputId="recogida-telefono" etiqueta="Teléfono de contacto"
                          [error]="invalido('recogida', 'telefono')" />
          @if (invalido('recogida', 'telefono')) { <p class="rs-field-err">{{ 'Indica un teléfono para que el transportista pueda llamar.' | t }}</p> }
          <div class="rs-field">
            <label class="rs-lbl" for="recogida-complemento">{{ 'Piso, puerta, portal (opcional)' | t }}</label>
            <input id="recogida-complemento" class="rs-inp" formControlName="complementoDireccion" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="recogida-indicaciones">{{ 'Indicaciones (opcional)' | t }}</label>
            <textarea id="recogida-indicaciones" class="rs-inp" rows="2" formControlName="indicaciones"
                      [placeholder]="'Ej.: timbre 3B, recogida en recepción…' | t"></textarea>
          </div>
        </section>

        <section class="rp__bloque" formGroupName="entrega">
          <h2>{{ 'Datos de entrega' | t }}</h2>
          <p class="rp__direccion"><rs-icon name="map-pin" [size]="15" [stroke]="2"></rs-icon>{{ destinoTexto() }}</p>
          <rs-opciones formControlName="quien" leyenda="Persona que recibe a la mascota" variante="segmento" [opciones]="opcionesEntrega" />
          @if (form.value.entrega?.quien !== 'yo') {
            <div class="rs-field">
              <label class="rs-lbl" for="entrega-nombre">{{ (form.value.entrega?.quien === 'empresa' ? 'Nombre de la empresa' : 'Nombre') | t }}</label>
              <input id="entrega-nombre" class="rs-inp" formControlName="nombre" />
              @if (invalido('entrega', 'nombre')) { <p class="rs-field-err">{{ 'Indica quién la recibe.' | t }}</p> }
            </div>
          }
          <rs-phone-input formControlName="telefono" inputId="entrega-telefono" etiqueta="Teléfono de contacto"
                          [error]="invalido('entrega', 'telefono')" />
          @if (invalido('entrega', 'telefono')) { <p class="rs-field-err">{{ 'Indica un teléfono de quien recibe.' | t }}</p> }
          <div class="rs-field">
            <label class="rs-lbl" for="entrega-complemento">{{ 'Piso, puerta, portal (opcional)' | t }}</label>
            <input id="entrega-complemento" class="rs-inp" formControlName="complementoDireccion" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="entrega-indicaciones">{{ 'Indicaciones (opcional)' | t }}</label>
            <textarea id="entrega-indicaciones" class="rs-inp" rows="2" formControlName="indicaciones"
                      [placeholder]="'Ej.: horario de recepción, a quién preguntar…' | t"></textarea>
          </div>
        </section>

        <section class="rp__bloque">
          <rs-opciones formControlName="confirmacionEntrega" leyenda="¿Cómo quieres saber que ha llegado?" variante="chip" [opciones]="opcionesConfirmacion" />
        </section>

        <rs-barra-cta [precio]="total()">
          <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg">
            {{ 'Continuar' | t }} <rs-icon name="arrow-right" [size]="18" [stroke]="2.2"></rs-icon>
          </button>
        </rs-barra-cta>
      </form>
    } @else {
      <div class="rp">
        <section class="rp__bloque">
          <div class="rp__titulo-bloque">
            <h2>{{ 'Resumen de tu reserva' | t }}</h2>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="volverADatos()">{{ 'Editar' | t }}</button>
          </div>
          <dl class="rp__resumen">
            @for (fila of resumen(); track fila[0]) {
              <div><dt>{{ fila[0] | t }}</dt><dd>{{ fila[1] }}</dd></div>
            }
          </dl>
        </section>

        <section class="rp__bloque">
          <h2>{{ 'Precio' | t }}</h2>
          @if (precioCambiado()) {
            <div class="rs-alert rs-alert--warning">{{ 'El precio se ha actualizado desde que lo viste. Este es el importe final.' | t }}</div>
          }
          <rs-desglose-precio [lineas]="lineas()" [viajes]="viajes()" />
          <p class="rp__cerrado"><rs-icon name="shield-check" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Precio cerrado: sólo cambiaría si pides extras más tarde.' | t }}</p>
        </section>

        <section class="rp__bloque rp__politica">
          <h2><rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon> {{ 'Política de cancelación' | t }}</h2>
          <p>{{ politicaTexto() }}</p>
          @if (resultado()?.requiereAceptacion) {
            <p class="rp__aceptacion">{{ 'Este viaje no tiene hora cerrada: el transportista lo confirmará. Si no lo acepta a tiempo, te devolvemos el dinero.' | t }}</p>
          }
        </section>

        <section class="rp__bloque">
          <h2>{{ 'Método de pago' | t }}</h2>
          @if (preparandoPago()) { <div class="rs-skeleton rp__pago-cargando"></div> }
          <div id="stripe-payment-element-transporte" class="rp__stripe"></div>
          <label class="rp__acepto">
            <input type="checkbox" [formControl]="acepto" />
            <span>{{ 'Acepto las' | t }} <a routerLink="/terminos" target="_blank">{{ 'condiciones del servicio' | t }}</a>
              {{ 'y la política de cancelación de este transportista.' | t }}</span>
          </label>
          @if (errorPago()) { <div class="rs-alert rs-alert--error">{{ errorPago() }}</div> }
          @if (bypassDisponible()) {
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="procesando() || !reservaId()" (click)="confirmarSinPagar()">
              {{ 'Confirmar sin pagar (entorno de pruebas)' | t }}
            </button>
          }
        </section>

        <rs-barra-cta [precio]="total()">
          <button type="button" class="rs-btn rs-btn--gold rs-btn--lg" [disabled]="!puedePagar()" (click)="pagar()">
            <rs-icon name="lock" [size]="16" [stroke]="2.2"></rs-icon>
            {{ (procesando() ? 'Procesando…' : 'Confirmar y pagar {total}') | t: { total: (total() | euros) } }}
          </button>
        </rs-barra-cta>
      </div>
    }
  }
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .rp { display: flex; flex-direction: column; gap: var(--sp-5); }
    .rp__cargando { height: 360px; border-radius: var(--r-2xl); }
    .rp__empresa {
      display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-5);
      padding: var(--sp-3); background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-xl);
      img { width: 64px; height: 48px; object-fit: cover; border-radius: var(--r-md); }
      p { margin: 0; }
      strong { font-family: var(--font-display); color: var(--dk-blue-text); }
    }
    .rp__bloque {
      display: flex; flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-5); background: var(--c-card); border: 1px solid var(--b-2);
      border-radius: var(--r-2xl); box-shadow: var(--sh-sm);
      h2 { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-family: var(--font-display);
        font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue-text); }
    }
    .rp__titulo-bloque { display: flex; justify-content: space-between; align-items: center; }
    .rp__direccion { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-size: var(--f-sm); color: var(--t-300);
      rs-icon { color: var(--dk-gold); flex: 0 0 auto; }
    }
    .rp__resumen { display: flex; flex-direction: column; gap: var(--sp-2); margin: 0;
      div { display: grid; grid-template-columns: minmax(110px, 38%) 1fr; gap: var(--sp-3); font-size: var(--f-sm); }
      dt { color: var(--t-400); }
      dd { margin: 0; color: var(--t-100); overflow-wrap: anywhere; }
    }
    .rp__cerrado, .rp__aceptacion { display: flex; align-items: flex-start; gap: var(--sp-2); margin: 0; font-size: var(--f-xs); color: var(--t-300); }
    .rp__aceptacion { color: var(--dk-gold-text); font-weight: var(--w-6); }
    .rp__politica p { margin: 0; font-size: var(--f-sm); color: var(--t-300); }
    .rp__stripe { min-height: 40px; }
    .rp__pago-cargando { height: 180px; border-radius: var(--r-lg); }
    .rp__acepto { display: flex; align-items: flex-start; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-300);
      input { margin-top: 3px; accent-color: var(--dk-blue); width: 18px; height: 18px; flex: 0 0 auto; }
      a { color: var(--c-accent); text-decoration: underline; }
    }
    @media (max-width: 480px) { .rp__bloque { padding: var(--sp-4); } }
  `],
})
export class ReservaViajeComponent implements OnInit, OnDestroy {
  private readonly store = inject(TransporteViajeStore);
  private readonly api = inject(TransporteViajeApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservasService);
  private readonly pagos = inject(PaymentsService);
  private readonly pagoEnCurso = inject(PagoEnCursoService);
  private readonly stripeService = inject(StripeService);
  private readonly i18n = inject(I18nService);

  readonly opcionesRecogida = OPCIONES_RECOGIDA;
  readonly opcionesEntrega = OPCIONES_ENTREGA;
  readonly opcionesConfirmacion = OPCIONES_CONFIRMACION;

  readonly fase = signal<Fase>('datos');
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);
  readonly resultado = signal<ResultadoTransporte | null>(null);
  readonly viajes = signal(1);
  readonly importePresupuesto = signal<number | null>(null);
  readonly intento = signal(false);

  readonly preparandoPago = signal(false);
  readonly procesando = signal(false);
  readonly errorPago = signal<string | null>(null);
  readonly reservaId = signal<string | null>(null);
  readonly codigo = signal<string | null>(null);
  readonly totalReserva = signal<number | null>(null);
  readonly bypassDisponible = signal(false);
  readonly stripeListo = signal(false);
  private readonly aceptado = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private pagoId: string | null = null;

  readonly acepto = new FormControl<boolean>(false, { nonNullable: true });
  readonly form = new FormGroup({
    recogida: grupoContacto(this.store.borrador().recogida),
    entrega: grupoContacto(this.store.borrador().entrega),
    confirmacionEntrega: new FormControl<string>(this.store.borrador().confirmacionEntrega, { nonNullable: true }),
  });

  readonly titulo = computed(() => this.store.borrador().eleccion?.titulo ?? this.resultado()?.titulo ?? '');
  readonly origenTexto = computed(() => this.store.borrador().origen?.texto ?? '');
  readonly destinoTexto = computed(() => this.store.borrador().destino?.texto ?? '');
  readonly resumen = computed(() => {
    const solicitud = this.store.solicitud();
    return solicitud ? resumenSolicitudTransporte(solicitud) : [];
  });
  readonly lineas = computed(() => {
    const importe = this.importePresupuesto();
    if (importe !== null) return [{ concepto: 'Presupuesto aceptado', importe }];
    return this.resultado()?.desglose ?? [];
  });
  /** El total de la reserva creada manda sobre el de la cotización: es lo que se va a cobrar. */
  readonly total = computed(() => this.totalReserva() ?? this.lineas().reduce((s, l) => s + l.importe, 0) * this.viajes());
  readonly precioCambiado = computed(() => {
    const visto = this.store.borrador().eleccion?.total;
    const actual = this.resultado()?.total;
    return this.importePresupuesto() === null && visto !== undefined && actual !== undefined && Math.abs(visto - actual) > 0.009;
  });
  readonly politicaTexto = computed(() => {
    const p = this.resultado()?.cancelacion;
    if (!p) return '';
    return p.reembolsoTardioPct > 0
      ? this.i18n.t('Cancelación gratuita hasta {h} h antes de la recogida. Después se devuelve el {pct} %.', { h: p.gratisHastaHoras, pct: p.reembolsoTardioPct })
      : this.i18n.t('Cancelación gratuita hasta {h} h antes de la recogida. Después no hay reembolso.', { h: p.gratisHastaHoras });
  });
  readonly puedePagar = computed(() => this.stripeListo() && this.aceptado() && !this.procesando());

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const v = this.form.getRawValue() as {
        recogida: ContactoViajeBorrador; entrega: ContactoViajeBorrador; confirmacionEntrega: string;
      };
      this.store.actualizar({
        recogida: v.recogida, entrega: v.entrega, confirmacionEntrega: v.confirmacionEntrega as ConfirmacionEntrega,
      });
      this.ajustarValidadores();
    });
    this.acepto.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.aceptado.set(v));
  }

  async ngOnInit(): Promise<void> {
    this.ajustarValidadores();
    void this.pagos.configuracion().then((c) => this.bypassDisponible.set(c.bypassPagoHabilitado)).catch(() => undefined);
    const presupuestoId = this.ruta.snapshot.queryParamMap.get('presupuesto');
    const servicioId = this.ruta.snapshot.queryParamMap.get('servicio');
    try {
      if (presupuestoId && servicioId) await this.prepararPresupuesto(presupuestoId, servicioId);
      await this.cotizar();
    } catch (error) {
      this.errorCarga.set(mensajeDeError(error, 'No hemos podido preparar la reserva. Vuelve a los resultados.'));
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.elements?.getElement('payment')?.destroy();
  }

  invalido(grupo: 'recogida' | 'entrega', campo: string): boolean {
    const control = this.form.get([grupo, campo]);
    return !!control && control.invalid && (control.touched || this.intento());
  }

  async irAPago(): Promise<void> {
    this.intento.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.fase.set('pago');
    if (esNavegador()) window.scrollTo({ top: 0, behavior: 'smooth' });
    await this.prepararPago();
  }

  volverADatos(): void {
    this.fase.set('datos');
  }

  async pagar(): Promise<void> {
    if (!this.stripe || !this.elements) return;
    const codigo = this.codigo();
    if (!codigo) return;
    this.procesando.set(true);
    this.errorPago.set(null);
    if (this.pagoId) this.pagoEnCurso.anotar(this.pagoId);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: { return_url: `${window.location.origin}/transporte/viaje/confirmada/${codigo}` },
      redirect: 'if_required',
    });
    if (error) {
      this.procesando.set(false);
      this.pagoEnCurso.olvidar();
      this.errorPago.set(error.message ?? 'No se pudo procesar el pago. Revisa los datos de la tarjeta.');
      return;
    }
    if (this.pagoId) await this.pagoEnCurso.sincronizar(this.pagoId);
    this.pagoEnCurso.olvidar();
    this.terminar(codigo);
  }

  async confirmarSinPagar(): Promise<void> {
    const reservaId = this.reservaId();
    const codigo = this.codigo();
    if (!reservaId || !codigo) return;
    this.procesando.set(true);
    try {
      await this.pagos.confirmarSinCobro(reservaId);
      this.terminar(codigo);
    } catch {
      this.errorPago.set('No se pudo confirmar la reserva sin pago en este entorno.');
      this.procesando.set(false);
    }
  }

  private terminar(codigo: string): void {
    this.store.reiniciar();
    void this.router.navigate(['/transporte/viaje/confirmada', codigo]);
  }

  private async prepararPresupuesto(presupuestoId: string, servicioId: string): Promise<void> {
    const presupuesto = await this.api.presupuesto(presupuestoId);
    const respuesta = presupuesto.respuestas.find((r) => r.servicioId === servicioId);
    const solicitud = presupuesto.detalle['solicitud'] as SolicitudTransporte | undefined;
    if (!respuesta?.importe || !solicitud) throw new Error('Presupuesto no disponible');
    this.store.cargarSolicitud(solicitud, presupuestoId, {
      servicioId, comercioId: respuesta.comercioId, titulo: respuesta.titulo, modalidad: solicitud.modalidad, total: respuesta.importe,
    });
    this.importePresupuesto.set(respuesta.importe);
  }

  /** Precio y política vigentes de la empresa elegida, con la modalidad elegida. */
  private async cotizar(): Promise<void> {
    const solicitud = this.store.solicitud();
    const eleccion = this.store.borrador().eleccion;
    if (!solicitud || !eleccion) {
      void this.router.navigate(['/transporte']);
      return;
    }
    const respuesta = await this.api.cotizarEmpresa(eleccion.servicioId, solicitud);
    this.viajes.set(respuesta.viajes);
    const resultado = respuesta.resultados.find((r) => r.modalidad === eleccion.modalidad);
    if (!resultado) throw new Error(respuesta.motivo ?? 'Este transportista ya no puede hacer el viaje.');
    this.resultado.set(resultado);
    this.prefillYo();
  }

  /** Crea la reserva (retiene la plaza) y monta el formulario de pago de Stripe. */
  private async prepararPago(): Promise<void> {
    if (this.reservaId()) return;
    this.preparandoPago.set(true);
    this.errorPago.set(null);
    try {
      const reserva = await this.reservas.crear(this.payload());
      const reservaId = reserva._id ?? reserva.id ?? null;
      this.reservaId.set(reservaId);
      this.codigo.set(reserva.codigo);
      this.totalReserva.set(reserva.montoTotal);
      if (!reservaId) return;

      const intent = await this.pagos.crearIntent(reservaId);
      this.pagoId = intent.pagoId;
      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe) throw new Error('Stripe no disponible');
      this.elements = this.stripe.elements({ clientSecret: intent.clientSecret });
      const elemento = this.elements.create('payment', { layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } });
      setTimeout(() => elemento.mount('#stripe-payment-element-transporte'), 0);
      this.stripeListo.set(true);
    } catch (error) {
      this.errorPago.set(mensajeDeError(error, 'No se pudo preparar el pago. Vuelve a intentarlo o elige otro transportista.'));
    } finally {
      this.preparandoPago.set(false);
    }
  }

  private payload(): CrearReservaPayload {
    const b = this.store.borrador();
    const solicitud = this.store.solicitud();
    const eleccion = b.eleccion;
    if (!solicitud || !eleccion) throw new Error('Viaje incompleto');
    const guardadas = solicitud.mascotas.flatMap((m) => (m.perroId ? [m.perroId] : []));
    return {
      servicioId: eleccion.servicioId,
      comercioId: eleccion.comercioId,
      vertical: VerticalKey.TRANSPORTE,
      perroId: guardadas[0],
      perroIdsAdicionales: guardadas.slice(1),
      fechaInicio: instanteDeRecogida(solicitud).toISOString(),
      cantidad: 1,
      detalle: {
        solicitud,
        entrega: { recogida: b.recogida, entrega: b.entrega, confirmacionEntrega: b.confirmacionEntrega },
        // Para el correo y los listados que ya pintan origen y destino.
        origen: solicitud.origen.texto,
        destino: solicitud.destino.texto,
        perros: solicitud.mascotas.length,
        resumen: resumenSolicitudTransporte(solicitud),
      },
      recurrencia: solicitud.recurrencia ? {
        diasSemana: solicitud.recurrencia.diasSemana,
        hora: solicitud.recurrencia.hora,
        fechaFin: solicitud.recurrencia.hasta,
        mensual: solicitud.recurrencia.patron === PatronRecurrenciaTransporte.MENSUAL,
      } : undefined,
      presupuestoId: b.presupuestoId ?? undefined,
    };
  }

  /** «Yo» lleva el nombre de la cuenta: no hace falta escribirlo. */
  private prefillYo(): void {
    const nombre = this.auth.usuario()?.nombre ?? '';
    for (const grupo of ['recogida', 'entrega'] as const) {
      const control = this.form.get([grupo, 'nombre']);
      if (control && !control.value && this.form.get([grupo, 'quien'])?.value === PersonaContactoViaje.YO) {
        control.setValue(nombre);
      }
    }
  }

  /** El nombre sólo se pide cuando entrega o recibe otra persona o una empresa. */
  private ajustarValidadores(): void {
    for (const grupo of ['recogida', 'entrega'] as const) {
      const nombre = this.form.get([grupo, 'nombre']);
      const quien = this.form.get([grupo, 'quien'])?.value;
      if (!nombre) continue;
      const requerido = quien !== PersonaContactoViaje.YO;
      const tiene = nombre.hasValidator(Validators.required);
      if (requerido && !tiene) nombre.addValidators(Validators.required);
      if (!requerido && tiene) nombre.removeValidators(Validators.required);
      nombre.updateValueAndValidity({ emitEvent: false });
    }
  }
}
