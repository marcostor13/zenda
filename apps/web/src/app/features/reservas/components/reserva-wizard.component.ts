import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';

type Paso = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-reserva-wizard',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, RsNavbarComponent],
  template: `
<div class="wizard-page">
  <rs-navbar />

  <div class="wizard-wrap rs-wrap">

    <!-- STEPS INDICATOR -->
    <div class="rs-steps wizard-steps">
      <div class="rs-steps__item" [class.active]="paso() >= 1" [class.done]="paso() > 1">
        <div class="rs-steps__num">{{ paso() > 1 ? '✓' : '1' }}</div>
        <span>Tu estancia</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() >= 2" [class.done]="paso() > 2">
        <div class="rs-steps__num">{{ paso() > 2 ? '✓' : '2' }}</div>
        <span>Tus datos</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() >= 3" [class.done]="paso() > 3">
        <div class="rs-steps__num">{{ paso() > 3 ? '✓' : '3' }}</div>
        <span>Pago</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() === 4">
        <div class="rs-steps__num">4</div>
        <span>Confirmación</span>
      </div>
    </div>

    <div class="wizard-body">

      <!-- COLUMNA PRINCIPAL -->
      <div class="wizard-main">

        <!-- PASO 1: Resumen de la reserva -->
        @if (paso() === 1) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Resumen de tu reserva</h2>

            <div class="reserva-summary">
              <div class="reserva-summary__hotel">
                <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200" alt="Hotel" />
                <div>
                  <h3>Casa Andina Premium Miraflores</h3>
                  <p>📍 Miraflores, Lima · ★★★★★</p>
                  <span class="rs-badge rs-badge--success">✓ Cancelación gratis</span>
                </div>
              </div>
            </div>

            <form [formGroup]="paso1Form">
              <div class="form-row">
                <div class="rs-field">
                  <label class="rs-lbl">Check-in</label>
                  <input formControlName="checkIn" type="date" class="rs-inp rs-inp--lg" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Check-out</label>
                  <input formControlName="checkOut" type="date" class="rs-inp rs-inp--lg" />
                </div>
              </div>

              <div class="form-row">
                <div class="rs-field">
                  <label class="rs-lbl">Adultos</label>
                  <select formControlName="adultos" class="rs-inp rs-inp--lg">
                    <option value="1">1 adulto</option>
                    <option value="2">2 adultos</option>
                    <option value="3">3 adultos</option>
                    <option value="4">4 adultos</option>
                  </select>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Niños</label>
                  <select formControlName="ninos" class="rs-inp rs-inp--lg">
                    <option value="0">Sin niños</option>
                    <option value="1">1 niño</option>
                    <option value="2">2 niños</option>
                  </select>
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Tipo de habitación</label>
                <select formControlName="habitacionId" class="rs-inp rs-inp--lg">
                  <option value="h1-r1">Habitación Superior — S/ 320/noche</option>
                  <option value="h1-r2">Suite Junior Vista al Mar — S/ 580/noche</option>
                </select>
              </div>

              <div class="extras-section">
                <h3>Servicios adicionales</h3>
                <div class="extras-grid">
                  @for (extra of extras; track extra.id) {
                    <label class="extra-item" [class.selected]="extrasSelec().includes(extra.id)">
                      <input type="checkbox" [value]="extra.id"
                             (change)="toggleExtra(extra.id)" />
                      <div class="extra-item__icon">{{ extra.icon }}</div>
                      <div class="extra-item__info">
                        <div class="extra-item__name">{{ extra.nombre }}</div>
                        <div class="extra-item__price">S/ {{ extra.precio }}</div>
                      </div>
                    </label>
                  }
                </div>
              </div>
            </form>

            <button class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                    [disabled]="paso1Form.invalid"
                    (click)="irPaso(2)">
              Continuar → Tus datos
            </button>
          </div>
        }

        <!-- PASO 2: Datos del huésped -->
        @if (paso() === 2) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Datos del huésped principal</h2>

            <form [formGroup]="paso2Form">
              <div class="form-row">
                <div class="rs-field">
                  <label class="rs-lbl">Nombre</label>
                  <input formControlName="nombre" class="rs-inp rs-inp--lg" placeholder="Tu nombre" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Apellidos</label>
                  <input formControlName="apellidos" class="rs-inp rs-inp--lg" placeholder="Tus apellidos" />
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Correo electrónico</label>
                <input formControlName="email" type="email" class="rs-inp rs-inp--lg" placeholder="tu@email.com" />
                <span class="rs-field-hint">La confirmación se enviará a este correo</span>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Teléfono</label>
                <input formControlName="telefono" type="tel" class="rs-inp rs-inp--lg" placeholder="+51 999 999 999" />
              </div>

              <div class="rs-field">
                <label class="rs-lbl">País de residencia</label>
                <select formControlName="pais" class="rs-inp rs-inp--lg">
                  <option value="PE">Perú</option>
                  <option value="CO">Colombia</option>
                  <option value="AR">Argentina</option>
                  <option value="CL">Chile</option>
                  <option value="US">Estados Unidos</option>
                  <option value="ES">España</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Peticiones especiales (opcional)</label>
                <textarea formControlName="peticiones" class="rs-inp" rows="3"
                          placeholder="Cama extra, planta alta, llegada tarde…"></textarea>
              </div>

              <div class="consent-box">
                <label class="filter-check">
                  <input type="checkbox" formControlName="aceptaTerminos" />
                  <span>Acepto los <a routerLink="/terminos" style="color:#7AA3FF">Términos y condiciones</a> y la <a routerLink="/privacidad" style="color:#7AA3FF">Política de privacidad</a></span>
                </label>
              </div>
            </form>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(1)">← Atrás</button>
              <button class="rs-btn rs-btn--primary rs-btn--lg"
                      [disabled]="paso2Form.invalid"
                      (click)="irPaso(3)">
                Continuar → Pago
              </button>
            </div>
          </div>
        }

        <!-- PASO 3: Pago -->
        @if (paso() === 3) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Método de pago</h2>

            <div class="payment-options">
              <label class="payment-option" [class.selected]="metodoPago() === 'card'">
                <input type="radio" name="metodo" value="card" [(ngModel)]="metodoPagoVal"
                       (change)="metodoPago.set('card')" />
                <div class="payment-option__icon">💳</div>
                <div>
                  <div class="payment-option__name">Tarjeta de crédito / débito</div>
                  <div class="payment-option__brands">Visa · Mastercard · American Express</div>
                </div>
                <div class="payment-option__secure">🔒 Stripe</div>
              </label>
              <label class="payment-option" [class.selected]="metodoPago() === 'yape'">
                <input type="radio" name="metodo" value="yape" [(ngModel)]="metodoPagoVal"
                       (change)="metodoPago.set('yape')" />
                <div class="payment-option__icon">📱</div>
                <div>
                  <div class="payment-option__name">Yape</div>
                  <div class="payment-option__brands">Pago móvil instantáneo</div>
                </div>
              </label>
            </div>

            @if (metodoPago() === 'card') {
              <div class="stripe-placeholder">
                <div class="stripe-placeholder__header">
                  <span>Datos de tarjeta</span>
                  <span class="rs-badge rs-badge--accent">🔒 Cifrado SSL</span>
                </div>
                <!-- Aquí va Stripe Elements en producción -->
                <div class="rs-field">
                  <label class="rs-lbl">Número de tarjeta</label>
                  <input class="rs-inp rs-inp--lg" placeholder="1234 5678 9012 3456" maxlength="19" />
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Vencimiento</label>
                    <input class="rs-inp rs-inp--lg" placeholder="MM/AA" maxlength="5" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">CVV</label>
                    <input class="rs-inp rs-inp--lg" placeholder="123" maxlength="4" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Nombre en la tarjeta</label>
                  <input class="rs-inp rs-inp--lg" placeholder="Igual que aparece en la tarjeta" />
                </div>
              </div>
            }

            @if (metodoPago() === 'yape') {
              <div class="yape-placeholder">
                <div style="font-size:3rem;text-align:center;margin-bottom:var(--sp-4)">📱</div>
                <p style="text-align:center;color:var(--t-300)">Escanea el QR con tu app Yape para pagar S/ {{ total() }}</p>
                <div class="qr-mock">QR aquí</div>
              </div>
            }

            <div class="rs-alert rs-alert--info" style="margin-block:var(--sp-5)">
              🔒 Tu pago está protegido por Stripe. Nunca almacenamos datos de tarjeta.
            </div>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(2)">← Atrás</button>
              <button class="rs-btn rs-btn--primary rs-btn--lg" (click)="procesarPago()">
                @if (procesando()) {
                  <span class="rs-spin"></span> Procesando…
                } @else {
                  🔒 Pagar S/ {{ total() }}
                }
              </button>
            </div>
          </div>
        }

        <!-- PASO 4: Confirmación -->
        @if (paso() === 4) {
          <div class="wizard-card confirmation">
            <div class="confirmation__icon">🎉</div>
            <h2>¡Reserva confirmada!</h2>
            <p>Tu reserva ha sido procesada exitosamente. Recibirás la confirmación en tu correo.</p>

            <div class="confirmation__code">
              <span class="rs-label-caps">Código de reserva</span>
              <div class="code-box">{{ codigoReserva() }}</div>
            </div>

            <div class="confirmation__details rs-card">
              <div class="cd-row">
                <span>🏨 Hotel</span>
                <strong>Casa Andina Premium Miraflores</strong>
              </div>
              <div class="cd-row">
                <span>📅 Fechas</span>
                <strong>{{ paso1Form.value.checkIn }} → {{ paso1Form.value.checkOut }}</strong>
              </div>
              <div class="cd-row">
                <span>👥 Huéspedes</span>
                <strong>{{ paso1Form.value.adultos }} adultos</strong>
              </div>
              <div class="cd-row">
                <span>💰 Total pagado</span>
                <strong class="rs-gradient-text">S/ {{ total() }}</strong>
              </div>
            </div>

            <div class="confirmation__actions">
              <a routerLink="/mis-reservas" class="rs-btn rs-btn--primary rs-btn--lg">
                Ver mis reservas
              </a>
              <a routerLink="/" class="rs-btn rs-btn--secondary">
                Seguir explorando
              </a>
            </div>
          </div>
        }
      </div>

      <!-- PANEL LATERAL: resumen de precio -->
      @if (paso() < 4) {
        <div class="price-summary">
          <div class="price-summary__card">
            <h3>Resumen de precio</h3>

            <div class="price-row">
              <span>Habitación Superior × 2 noches</span>
              <span>S/ 640</span>
            </div>
            @for (extra of extrasSelec(); track extra) {
              <div class="price-row">
                <span>{{ extraNombre(extra) }}</span>
                <span>S/ {{ extraPrecio(extra) }}</span>
              </div>
            }
            <hr class="rs-hr" style="margin-block:var(--sp-4)">
            <div class="price-row price-row--sub">
              <span>Subtotal</span>
              <span>S/ {{ subtotal() }}</span>
            </div>
            <div class="price-row price-row--sub">
              <span>IGV (18%)</span>
              <span>S/ {{ igv() }}</span>
            </div>
            <div class="price-row price-row--total">
              <span>Total</span>
              <span>S/ {{ total() }}</span>
            </div>
            <p style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-4)">
              Precio final en soles peruanos. El cargo se hará en el momento de confirmar.
            </p>

            <hr class="rs-hr" style="margin-block:var(--sp-5)">

            <div class="price-trust">
              <p>✓ Precio más bajo garantizado</p>
              <p>✓ Sin cargos ocultos</p>
              <p>✓ Cancelación gratis hasta 24h antes</p>
            </div>
          </div>
        </div>
      }
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .wizard-page { min-height: 100vh; background: var(--c-base); }
    .wizard-wrap { padding-block: var(--sp-8); }

    .wizard-steps { justify-content: center; margin-bottom: var(--sp-10); padding: var(--sp-6); background: var(--c-raised); border-radius: var(--r-xl); border: 1px solid var(--b-1); }

    .wizard-body {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--sp-8);
      align-items: start;
      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    .wizard-card {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-2xl);
      padding: var(--sp-8);
      animation: scaleIn var(--d-3) ease;
    }

    .wizard-card__title {
      font-size: var(--f-2xl);
      font-weight: var(--w-8);
      color: var(--t-100);
      margin-bottom: var(--sp-8);
      letter-spacing: -.02em;
    }

    .reserva-summary__hotel {
      display: flex;
      gap: var(--sp-4);
      padding: var(--sp-4);
      background: var(--c-raised);
      border-radius: var(--r-lg);
      margin-bottom: var(--sp-6);

      img { width: 100px; height: 80px; object-fit: cover; border-radius: var(--r-md); }
      h3  { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
      p   { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-3); }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-4);
      margin-bottom: var(--sp-5);
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .rs-field { margin-bottom: var(--sp-5); }

    .extras-section { margin-block: var(--sp-6); h3 { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-bottom: var(--sp-4); } }

    .extras-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); }

    .extra-item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-4);
      background: var(--c-raised);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      cursor: pointer;
      transition: all var(--d-2);

      input { display: none; }
      &.selected { border-color: var(--c-accent); background: var(--c-accent-lo); }
      &:hover:not(.selected) { border-color: var(--b-2); }
    }

    .extra-item__icon { font-size: 1.5rem; }
    .extra-item__name { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .extra-item__price { font-size: var(--f-xs); color: var(--t-400); }

    .wizard-nav { display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-8); gap: var(--sp-4); flex-wrap: wrap; }

    .consent-box { margin-block: var(--sp-5); font-size: var(--f-sm); color: var(--t-300); label { display: flex; align-items: flex-start; gap: var(--sp-3); input { margin-top: 2px; accent-color: var(--c-accent); } } }

    .payment-options { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-6); }

    .payment-option {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5);
      background: var(--c-raised);
      border: 1px solid var(--b-2);
      border-radius: var(--r-lg);
      cursor: pointer;
      transition: all var(--d-2);

      input { accent-color: var(--c-accent); }
      &.selected { border-color: var(--c-accent); background: var(--c-accent-lo); }
      &:hover:not(.selected) { border-color: var(--b-2); background: var(--c-card); }
    }

    .payment-option__icon { font-size: 1.5rem; }
    .payment-option__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .payment-option__brands { font-size: var(--f-xs); color: var(--t-400); }
    .payment-option__secure { margin-left: auto; font-size: var(--f-xs); color: var(--t-400); }

    .stripe-placeholder { background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-xl); padding: var(--sp-6); margin-bottom: var(--sp-5); }
    .stripe-placeholder__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-5); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }

    .qr-mock { width: 160px; height: 160px; background: var(--c-surface); border-radius: var(--r-xl); margin: var(--sp-6) auto 0; display: flex; align-items: center; justify-content: center; color: var(--t-400); font-size: var(--f-sm); }
    .yape-placeholder { text-align: center; }

    .confirmation { text-align: center; padding: var(--sp-16) var(--sp-8); }
    .confirmation__icon { font-size: 4rem; margin-bottom: var(--sp-4); animation: float 3s ease-in-out infinite; }
    .confirmation h2 { font-size: var(--f-4xl); font-weight: var(--w-9); color: var(--t-100); margin-bottom: var(--sp-4); }
    .confirmation p  { color: var(--t-300); margin-bottom: var(--sp-8); }
    .confirmation__code { margin-bottom: var(--sp-6); }
    .code-box { font-size: var(--f-3xl); font-weight: var(--w-9); letter-spacing: .1em; background: var(--g-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-top: var(--sp-3); }
    .confirmation__details { padding: var(--sp-6); text-align: left; margin-bottom: var(--sp-8); }
    .cd-row { display: flex; justify-content: space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-300); strong { color: var(--t-100); } &:last-child { border: none; } }
    .confirmation__actions { display: flex; gap: var(--sp-4); justify-content: center; flex-wrap: wrap; }

    /* PRICE SUMMARY */
    .price-summary { position: sticky; top: 84px; }
    .price-summary__card { background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); padding: var(--sp-6); box-shadow: var(--sh-xl); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-6); } }
    .price-row { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-3); }
    .price-row--sub { color: var(--t-400); }
    .price-row--total { color: var(--t-100); font-weight: var(--w-8); font-size: var(--f-md); }
    .price-trust { display: flex; flex-direction: column; gap: var(--sp-2); p { font-size: var(--f-xs); color: var(--t-400); } }

    .filter-check { display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; }
  `],
})
export class ReservaWizardComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);

  readonly paso      = signal<Paso>(1);
  readonly procesando = signal(false);
  readonly metodoPago = signal<'card' | 'yape'>('card');
  readonly extrasSelec = signal<string[]>([]);
  readonly codigoReserva = signal('RES-' + Math.random().toString(36).substr(2,8).toUpperCase());

  metodoPagoVal = 'card';

  readonly paso1Form = this.fb.group({
    checkIn:      ['', Validators.required],
    checkOut:     ['', Validators.required],
    adultos:      [2],
    ninos:        [0],
    habitacionId: ['h1-r1', Validators.required],
  });

  readonly paso2Form = this.fb.group({
    nombre:         ['', Validators.required],
    apellidos:      ['', Validators.required],
    email:          ['', [Validators.required, Validators.email]],
    telefono:       ['', Validators.required],
    pais:           ['PE'],
    peticiones:     [''],
    aceptaTerminos: [false, Validators.requiredTrue],
  });

  readonly extras = [
    { id: 'desayuno',  icon: '🍳', nombre: 'Desayuno buffet',  precio: 45 },
    { id: 'transfer',  icon: '🚗', nombre: 'Transfer aeropuerto', precio: 80 },
    { id: 'spa',       icon: '💆', nombre: 'Sesión de spa',     precio: 120 },
    { id: 'late',      icon: '🌙', nombre: 'Late check-out',    precio: 50 },
  ];

  readonly subtotal = computed(() => {
    const base = 640;
    const extTotal = this.extrasSelec().reduce((s, id) => {
      return s + (this.extras.find(e => e.id === id)?.precio ?? 0);
    }, 0);
    return base + extTotal;
  });

  readonly igv   = computed(() => Math.round(this.subtotal() * 0.18));
  readonly total = computed(() => this.subtotal() + this.igv());

  ngOnInit(): void {
    const habitacionId = this.route.snapshot.queryParamMap.get('habitacionId');
    if (habitacionId) this.paso1Form.patchValue({ habitacionId });
  }

  irPaso(p: number): void { this.paso.set(p as Paso); }

  toggleExtra(id: string): void {
    this.extrasSelec.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  extraNombre(id: string): string {
    return this.extras.find(e => e.id === id)?.nombre ?? '';
  }

  extraPrecio(id: string): number {
    return this.extras.find(e => e.id === id)?.precio ?? 0;
  }

  async procesarPago(): Promise<void> {
    this.procesando.set(true);
    await new Promise(r => setTimeout(r, 2000));
    this.procesando.set(false);
    this.irPaso(4);
  }
}
