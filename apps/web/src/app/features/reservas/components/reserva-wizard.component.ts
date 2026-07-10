import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { VerticalKey, VERTICAL_LABELS, IVA_RATE } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { StripeService } from '../../../core/stripe/stripe.service';
import { ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { CuponesService } from '../services/cupones.service';
import type { Stripe, StripeElements } from '@stripe/stripe-js';

type Paso = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-reserva-wizard',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, RsNavbarComponent, ImgFallbackDirective],
  template: `
<div class="wizard-page">
  <rs-navbar />

  <div class="wizard-wrap rs-wrap">

    <!-- STEPS INDICATOR -->
    <div class="rs-steps wizard-steps">
      <div class="rs-steps__item" [class.active]="paso() >= 1" [class.done]="paso() > 1">
        <div class="rs-steps__num">{{ paso() > 1 ? '✓' : '1' }}</div>
        <span>{{ paso1Label() }}</span>
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

        <!-- ═══════════ PASO 1 ═══════════ -->
        @if (paso() === 1) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">{{ paso1Titulo() }}</h2>

            <!-- Resumen del servicio -->
            <div class="reserva-summary">
              <div class="reserva-summary__service">
                <img [src]="imagenServicio()" alt="Servicio" rsImg />
                <div>
                  <h3>{{ nombreServicio() || 'Servicio seleccionado' }}</h3>
                  <p>€{{ precioBase() }} / {{ precioPorLabel() }}</p>
                  <span class="rs-badge rs-badge--accent">{{ emojiVertical() }} {{ verticaLabel() }}</span>
                </div>
              </div>
            </div>

            <!-- ── ALOJAMIENTO CANINO ── -->
            @if (vertical() === 'alojamiento') {
              <form [formGroup]="paso1AlojamientoForm">
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
                    <label class="rs-lbl">Número de perros</label>
                    <select formControlName="perros" class="rs-inp rs-inp--lg">
                      <option value="1">1 perro</option>
                      <option value="2">2 perros</option>
                      <option value="3">3 perros</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Tamaño del perro</label>
                    <select formControlName="tamanoPerro" class="rs-inp rs-inp--lg">
                      <option value="pequeno">Pequeño (hasta 10 kg)</option>
                      <option value="mediano">Mediano (10–25 kg)</option>
                      <option value="grande">Grande (25–45 kg)</option>
                      <option value="gigante">Gigante (más de 45 kg)</option>
                    </select>
                  </div>
                </div>
                <div class="extras-section">
                  <h3>Servicios adicionales</h3>
                  <div class="extras-grid">
                    @for (extra of extras; track extra.id) {
                      <label class="extra-item" [class.selected]="extrasSelec().includes(extra.id)">
                        <input type="checkbox" [value]="extra.id" (change)="toggleExtra(extra.id)" />
                        <div class="extra-item__icon">{{ extra.icon }}</div>
                        <div class="extra-item__info">
                          <div class="extra-item__name">{{ extra.nombre }}</div>
                          <div class="extra-item__price">€{{ extra.precio }}</div>
                        </div>
                      </label>
                    }
                  </div>
                </div>
              </form>
            }

            <!-- ── TRANSPORTE DE ANIMALES ── -->
            @if (vertical() === 'transporte') {
              <form [formGroup]="paso1TransporteForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha del trayecto</label>
                    <input formControlName="fechaRecogida" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de recogida</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Dirección de recogida (origen)</label>
                  <input formControlName="origen" class="rs-inp rs-inp--lg"
                         placeholder="Ej. Calle Mayor 12, Madrid" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Destino</label>
                  <input formControlName="destino" class="rs-inp rs-inp--lg"
                         placeholder="Ej. Clínica veterinaria, Toledo" />
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Distancia estimada (km)</label>
                    <input formControlName="distanciaKm" type="number" class="rs-inp rs-inp--lg" min="1" />
                    <span class="rs-field-hint">Para estimar la tarifa (tarifa base + km)</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Número de perros</label>
                    <select formControlName="perros" class="rs-inp rs-inp--lg">
                      <option value="1">1 perro</option>
                      <option value="2">2 perros</option>
                      <option value="3">3 perros</option>
                      <option value="4">4 perros</option>
                    </select>
                  </div>
                </div>
              </form>
            }

            <!-- ── VETERINARIA ── -->
            @if (vertical() === 'veterinaria') {
              <form [formGroup]="paso1VeterinariaForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de la cita</label>
                    <input formControlName="fecha" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de la cita</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Servicio (opcional)</label>
                  <select formControlName="servicio" class="rs-inp rs-inp--lg">
                    <option value="consulta">Consulta general</option>
                    <option value="vacunacion">Vacunación</option>
                    <option value="revision">Revisión / chequeo</option>
                    <option value="dermatologia">Dermatología</option>
                    <option value="urgencia">Urgencia</option>
                  </select>
                  <span class="rs-field-hint">El precio final puede variar según el servicio clínico</span>
                </div>
              </form>
            }

            <!-- ── PELUQUERÍA CANINA ── -->
            @if (vertical() === 'peluqueria') {
              <form [formGroup]="paso1PeluqueriaForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de la cita</label>
                    <input formControlName="fecha" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de la cita</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Servicio de grooming</label>
                  <select formControlName="servicio" class="rs-inp rs-inp--lg">
                    <option value="bano">Baño y secado</option>
                    <option value="corte">Corte de pelo</option>
                    <option value="deslanado">Deslanado</option>
                    <option value="spa">Spa canino</option>
                    <option value="unas">Corte de uñas</option>
                  </select>
                </div>
              </form>
            }

            <!-- ── ADIESTRAMIENTO ── -->
            @if (vertical() === 'adiestramiento') {
              <form [formGroup]="paso1AdiestramientoForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de inicio</label>
                    <input formControlName="fechaInicio" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Modalidad</label>
                    <select formControlName="modalidad" class="rs-inp rs-inp--lg">
                      <option value="sesion">Sesión suelta</option>
                      <option value="programa">Programa completo</option>
                    </select>
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Edad del perro (meses)</label>
                  <input formControlName="edadMeses" type="number" class="rs-inp rs-inp--lg" min="0" max="240" />
                  <span class="rs-field-hint">Para verificar la edad mínima requerida por el adiestrador</span>
                </div>
              </form>
            }

            <button class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                    style="margin-top:var(--sp-6)"
                    [disabled]="!paso1Valido()"
                    (click)="irPaso(2)">
              Continuar → Tus datos
            </button>
          </div>
        }

        <!-- ═══════════ PASO 2 ═══════════ -->
        @if (paso() === 2) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Datos del contacto principal</h2>

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
                <input formControlName="telefono" type="tel" class="rs-inp rs-inp--lg" placeholder="+34 600 000 000" />
              </div>

              <div class="rs-field">
                <label class="rs-lbl">País de residencia</label>
                <select formControlName="pais" class="rs-inp rs-inp--lg">
                  <option value="ES">España</option>
                  <option value="PT">Portugal</option>
                  <option value="FR">Francia</option>
                  <option value="IT">Italia</option>
                  <option value="DE">Alemania</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Peticiones especiales (opcional)</label>
                <textarea formControlName="peticiones" class="rs-inp" rows="3"
                          placeholder="{{ peticionesPlaceholder() }}"></textarea>
              </div>

              <div class="consent-box">
                <label class="filter-check">
                  <input type="checkbox" formControlName="aceptaTerminos" />
                  <span>Acepto los <a routerLink="/terminos" style="color:var(--c-accent)">Términos y condiciones</a> y la <a routerLink="/privacidad" style="color:var(--c-accent)">Política de privacidad</a></span>
                </label>
              </div>
            </form>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(1)">← Atrás</button>
              <button class="rs-btn rs-btn--gold rs-btn--lg"
                      [disabled]="paso2Form.invalid"
                      (click)="irPaso(3)">
                Continuar → Pago
              </button>
            </div>
          </div>
        }

        <!-- ═══════════ PASO 3 ═══════════ -->
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
                <div class="payment-option__secure">
                  <svg width="38" height="16" viewBox="0 0 468 222" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 22.1C0 9.9 9.9 0 22.1 0h423.8c12.2 0 22.1 9.9 22.1 22.1v177.8c0 12.2-9.9 22.1-22.1 22.1H22.1C9.9 222 0 212.1 0 199.9V22.1z" fill="#635BFF"/>
                    <path d="M224.4 88.6c0-4.1 3.4-5.7 9-5.7 8 0 18.2 2.4 26.2 6.7V63.7c-8.8-3.5-17.5-4.9-26.2-4.9-21.4 0-35.7 11.2-35.7 29.9 0 29.2 40.2 24.5 40.2 37.1 0 4.8-4.2 6.4-10.1 6.4-8.7 0-19.8-3.6-28.6-8.4v26.3c9.7 4.2 19.5 5.9 28.6 5.9 21.8 0 36.8-10.8 36.8-29.7-.1-31.5-40.2-25.9-40.2-37.7zM290 42.6l-26.8 5.7v21.5h-14.7v22.8h14.7v42.8c0 18.9 13.7 26.1 32.6 26.1 8 0 15.7-1.4 21-4.2v-22.5c-3.8 1.9-11.8 3.6-17.2 3.6-6.5 0-9.6-2.4-9.6-9.3V92.6h26.8V69.8H290V42.6zM339.4 78.5l-1.5-8.7h-24.1v89.7h27.8v-56.2c7.3-9.6 19.6-7.8 23.4-6.5V69.4c-4-1.4-18.3-4-25.6 9.1zM393.5 59.3c-8.9 0-14.7 5.8-14.7 14.5 0 8.6 5.8 14.5 14.7 14.5 8.9 0 14.7-5.9 14.7-14.5 0-8.7-5.8-14.5-14.7-14.5zm-13.9 100.2h27.8V69.8h-27.8v89.7zM131.7 113c0 15.2 10.4 25.6 23.9 25.6 13.6 0 22.1-7.9 24.4-19.7H153c-1.3 5-3.8 8-7.8 8-5.3 0-8.3-3.6-8.8-10.1h44.3c.2-2.1.3-4.2.3-6.2 0-22.8-12.5-35.6-31.2-35.6-18.6 0-29.4 12.3-29.4 29.3l-.1.1-.1.1.2 8.5zm12.3-11.8c1.3-6.2 4.7-10 9.3-10 5.2 0 8.3 3.7 8.6 10h-17.9zM108.3 78.1c-4.4-1.9-13.5-3.5-21.2 0-8.7 4-13.6 12.3-13.6 22.4v59h27.8v-55.4c0-6.4 4.2-10.1 9.4-10.1 2.9 0 5.3.8 7.1 2.2l.5-18.1z" fill="white"/>
                  </svg>
                </div>
              </label>
              <label class="payment-option" [class.selected]="metodoPago() === 'bizum'">
                <input type="radio" name="metodo" value="bizum" [(ngModel)]="metodoPagoVal"
                       (change)="metodoPago.set('bizum')" />
                <div class="payment-option__icon">📱</div>
                <div>
                  <div class="payment-option__name">Bizum</div>
                  <div class="payment-option__brands">Pago móvil instantáneo</div>
                </div>
              </label>
            </div>

            @if (metodoPago() === 'card') {
              <div class="stripe-placeholder">
                <div class="stripe-placeholder__header">
                  <span>Datos de tarjeta</span>
                  <span class="rs-badge rs-badge--accent">🔒 Stripe · Cifrado SSL</span>
                </div>

                <div id="stripe-payment-element"></div>

                @if (!stripeListo()) {
                  <p style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-3)">
                    Modo demostración: el pago se simulará. El formulario seguro de Stripe
                    aparece al reservar desde un servicio real con la sesión iniciada.
                  </p>
                }

                @if (errorPago()) {
                  <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorPago() }}</div>
                }
              </div>
            }

            @if (metodoPago() === 'bizum') {
              <div class="bizum-placeholder">
                <div style="font-size:3rem;text-align:center;margin-bottom:var(--sp-4)">📱</div>
                <p style="text-align:center;color:var(--t-300)">Confirma el pago de €{{ total() }} desde tu app bancaria con Bizum</p>
                <div class="qr-mock">QR aquí</div>
              </div>
            }

            <div class="rs-alert rs-alert--info" style="margin-block:var(--sp-5);display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap">
              <span>🔒 Tu pago está protegido por</span>
              <svg width="42" height="17" viewBox="0 0 468 222" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe" style="flex-shrink:0">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M0 22.1C0 9.9 9.9 0 22.1 0h423.8c12.2 0 22.1 9.9 22.1 22.1v177.8c0 12.2-9.9 22.1-22.1 22.1H22.1C9.9 222 0 212.1 0 199.9V22.1z" fill="#635BFF"/>
                <path d="M224.4 88.6c0-4.1 3.4-5.7 9-5.7 8 0 18.2 2.4 26.2 6.7V63.7c-8.8-3.5-17.5-4.9-26.2-4.9-21.4 0-35.7 11.2-35.7 29.9 0 29.2 40.2 24.5 40.2 37.1 0 4.8-4.2 6.4-10.1 6.4-8.7 0-19.8-3.6-28.6-8.4v26.3c9.7 4.2 19.5 5.9 28.6 5.9 21.8 0 36.8-10.8 36.8-29.7-.1-31.5-40.2-25.9-40.2-37.7zM290 42.6l-26.8 5.7v21.5h-14.7v22.8h14.7v42.8c0 18.9 13.7 26.1 32.6 26.1 8 0 15.7-1.4 21-4.2v-22.5c-3.8 1.9-11.8 3.6-17.2 3.6-6.5 0-9.6-2.4-9.6-9.3V92.6h26.8V69.8H290V42.6zM339.4 78.5l-1.5-8.7h-24.1v89.7h27.8v-56.2c7.3-9.6 19.6-7.8 23.4-6.5V69.4c-4-1.4-18.3-4-25.6 9.1zM393.5 59.3c-8.9 0-14.7 5.8-14.7 14.5 0 8.6 5.8 14.5 14.7 14.5 8.9 0 14.7-5.9 14.7-14.5 0-8.7-5.8-14.5-14.7-14.5zm-13.9 100.2h27.8V69.8h-27.8v89.7zM131.7 113c0 15.2 10.4 25.6 23.9 25.6 13.6 0 22.1-7.9 24.4-19.7H153c-1.3 5-3.8 8-7.8 8-5.3 0-8.3-3.6-8.8-10.1h44.3c.2-2.1.3-4.2.3-6.2 0-22.8-12.5-35.6-31.2-35.6-18.6 0-29.4 12.3-29.4 29.3l-.1.1-.1.1.2 8.5zm12.3-11.8c1.3-6.2 4.7-10 9.3-10 5.2 0 8.3 3.7 8.6 10h-17.9zM108.3 78.1c-4.4-1.9-13.5-3.5-21.2 0-8.7 4-13.6 12.3-13.6 22.4v59h27.8v-55.4c0-6.4 4.2-10.1 9.4-10.1 2.9 0 5.3.8 7.1 2.2l.5-18.1z" fill="white"/>
              </svg>
              <span>· Nunca almacenamos datos de tarjeta.</span>
            </div>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(2)">← Atrás</button>
              <button class="rs-btn rs-btn--gold rs-btn--lg" (click)="procesarPago()">
                @if (procesando()) {
                  <span class="rs-spin"></span> Procesando…
                } @else {
                  🔒 Pagar €{{ total() }}
                }
              </button>
            </div>
          </div>
        }

        <!-- ═══════════ PASO 4 ═══════════ -->
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
                <span>{{ emojiVertical() }} Servicio</span>
                <strong>{{ nombreServicio() || verticaLabel() }}</strong>
              </div>
              <div class="cd-row">
                <span>📋 Detalle</span>
                <strong>{{ lineaResumen() }}</strong>
              </div>
              <div class="cd-row">
                <span>💰 Total pagado</span>
                <strong class="rs-gradient-text">€{{ total() }}</strong>
              </div>
            </div>

            <div class="confirmation__actions">
              <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--primary rs-btn--lg">
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
              <span>{{ lineaResumen() }}</span>
              <span>€{{ subtotal() }}</span>
            </div>
            @if (vertical() === 'alojamiento') {
              @for (extra of extrasSelec(); track extra) {
                <div class="price-row">
                  <span>{{ extraNombre(extra) }}</span>
                  <span>€{{ extraPrecio(extra) }}</span>
                </div>
              }
            }
            <hr class="rs-hr" style="margin-block:var(--sp-4)">
            <div class="price-row price-row--sub">
              <span>Subtotal</span>
              <span>€{{ subtotal() }}</span>
            </div>
            @if (descuento() > 0) {
              <div class="price-row price-row--sub" style="color:#16A34A">
                <span>Descuento ({{ cuponCodigo() }})</span>
                <span>−€{{ descuento() }}</span>
              </div>
            }
            <div class="price-row price-row--sub">
              <span>IVA (21%)</span>
              <span>€{{ iva() }}</span>
            </div>
            <div class="price-row price-row--total">
              <span>Total</span>
              <span>€{{ total() }}</span>
            </div>

            <!-- Cupón de descuento -->
            <div class="cupon-box">
              @if (descuento() > 0) {
                <div class="rs-alert rs-alert--success" style="font-size:var(--f-xs)">
                  ✓ Cupón {{ cuponCodigo() }} aplicado
                  <button class="cupon-box__quitar" (click)="quitarCupon()">Quitar</button>
                </div>
              } @else {
                <div class="cupon-box__row">
                  <input [(ngModel)]="cuponInput" name="cupon" class="rs-inp" placeholder="Código de descuento"
                         style="text-transform:uppercase" />
                  <button class="rs-btn rs-btn--secondary" [disabled]="aplicandoCupon()" (click)="aplicarCupon()">
                    {{ aplicandoCupon() ? '…' : 'Aplicar' }}
                  </button>
                </div>
                @if (cuponError()) {
                  <p style="font-size:var(--f-xs);color:#DC2626;margin-top:var(--sp-2)">{{ cuponError() }}</p>
                }
              }
            </div>
            <p style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-4)">
              Precio en euros (EUR). El cargo se realiza al confirmar.
            </p>

            <hr class="rs-hr" style="margin-block:var(--sp-5)">

            <div class="price-trust">
              <p>✓ Sin cargos ocultos</p>
              <p>✓ Pago 100% seguro vía Stripe</p>
              <p>✓ Confirmación inmediata por correo</p>
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

    .reserva-summary__service {
      display: flex;
      gap: var(--sp-4);
      padding: var(--sp-4);
      background: var(--c-raised);
      border-radius: var(--r-lg);
      margin-bottom: var(--sp-6);

      img { width: 100px; height: 80px; object-fit: cover; border-radius: var(--r-md); flex-shrink: 0; }
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
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); display: block; }

    .extras-section { margin-block: var(--sp-6); h3 { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-bottom: var(--sp-4); } }
    .extras-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); }
    .extra-item {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4);
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      cursor: pointer; transition: all var(--d-2);
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
      display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5);
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      cursor: pointer; transition: all var(--d-2);
      input { accent-color: var(--c-accent); }
      &.selected { border-color: var(--c-accent); background: var(--c-accent-lo); }
    }
    .payment-option__icon { font-size: 1.5rem; }
    .payment-option__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .payment-option__brands { font-size: var(--f-xs); color: var(--t-400); }
    .payment-option__secure { margin-left: auto; font-size: var(--f-xs); color: var(--t-400); }

    .stripe-placeholder { background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-xl); padding: var(--sp-6); margin-bottom: var(--sp-5); }
    .stripe-placeholder__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-5); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }

    .qr-mock { width: 160px; height: 160px; background: var(--c-surface); border-radius: var(--r-xl); margin: var(--sp-6) auto 0; display: flex; align-items: center; justify-content: center; color: var(--t-400); font-size: var(--f-sm); }
    .bizum-placeholder { text-align: center; }

    .confirmation { text-align: center; padding: var(--sp-16) var(--sp-8); }
    .confirmation__icon { font-size: 4rem; margin-bottom: var(--sp-4); animation: float 3s ease-in-out infinite; }
    .confirmation h2 { font-size: var(--f-4xl); font-weight: var(--w-9); color: var(--t-100); margin-bottom: var(--sp-4); }
    .confirmation p  { color: var(--t-300); margin-bottom: var(--sp-8); }
    .confirmation__code { margin-bottom: var(--sp-6); }
    .code-box { font-size: var(--f-3xl); font-weight: var(--w-9); letter-spacing: .1em; background: var(--g-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-top: var(--sp-3); }
    .confirmation__details { padding: var(--sp-6); text-align: left; margin-bottom: var(--sp-8); }
    .cd-row { display: flex; justify-content: space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-300); strong { color: var(--t-100); } &:last-child { border: none; } }
    .confirmation__actions { display: flex; gap: var(--sp-4); justify-content: center; flex-wrap: wrap; }

    .price-summary { position: sticky; top: 84px; }
    .price-summary__card { background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); padding: var(--sp-6); box-shadow: var(--sh-xl); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-6); } }
    .price-row { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-3); }
    .price-row--sub { color: var(--t-400); }
    .price-row--total { color: var(--t-100); font-weight: var(--w-8); font-size: var(--f-md); }
    .price-trust { display: flex; flex-direction: column; gap: var(--sp-2); p { font-size: var(--f-xs); color: var(--t-400); } }
    .cupon-box { margin-top: var(--sp-4); }
    .cupon-box__row { display: flex; gap: var(--sp-2); .rs-inp { flex: 1; } }
    .cupon-box__quitar { margin-left: var(--sp-3); text-decoration: underline; color: inherit; font-size: var(--f-xs); }

    .filter-check { display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; }
  `],
})
export class ReservaWizardComponent implements OnInit {
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly fb             = inject(FormBuilder);
  private readonly stripeService  = inject(StripeService);
  private readonly reservasService = inject(ReservasService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly cuponesService  = inject(CuponesService);

  // Navigation
  readonly paso       = signal<Paso>(1);
  readonly procesando = signal(false);
  readonly metodoPago = signal<'card' | 'bizum'>('card');
  readonly codigoReserva = signal('');

  // Vertical context (populated from route/query params)
  readonly vertical       = signal<string>(VerticalKey.ALOJAMIENTO);
  readonly nombreServicio = signal<string>('');
  readonly imagenServicio = signal<string>('');
  readonly precioBase     = signal<number>(0);

  // Stripe
  readonly stripeListo = signal(false);
  readonly errorPago   = signal<string | null>(null);
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private clientSecret: string | null = null;
  private servicioId?: string;
  private comercioId?: string;
  private espacioId: string | null = null;
  private reservaIdReal: string | null = null;
  readonly totalFromApi = signal<number | null>(null);

  metodoPagoVal = 'card';

  // ─── Step 1 forms (one per vertical) ───
  readonly paso1AlojamientoForm = this.fb.group({
    checkIn:     ['', Validators.required],
    checkOut:    ['', Validators.required],
    perros:      [1, [Validators.required, Validators.min(1), Validators.max(3)]],
    tamanoPerro: ['mediano', Validators.required],
  });

  readonly paso1TransporteForm = this.fb.group({
    fechaRecogida: ['', Validators.required],
    hora:          ['', Validators.required],
    origen:        ['', Validators.required],
    destino:       ['', Validators.required],
    distanciaKm:   [10, [Validators.required, Validators.min(1)]],
    perros:        [1],
  });

  readonly paso1VeterinariaForm = this.fb.group({
    fecha:    ['', Validators.required],
    hora:     ['', Validators.required],
    servicio: ['consulta'],
  });

  readonly paso1PeluqueriaForm = this.fb.group({
    fecha:    ['', Validators.required],
    hora:     ['', Validators.required],
    servicio: ['bano', Validators.required],
  });

  readonly paso1AdiestramientoForm = this.fb.group({
    fechaInicio: ['', Validators.required],
    modalidad:   ['sesion', Validators.required],
    edadMeses:   [12, [Validators.min(0), Validators.max(240)]],
  });

  // ─── Step 2 (shared) ───
  readonly paso2Form = this.fb.group({
    nombre:         ['', Validators.required],
    apellidos:      ['', Validators.required],
    email:          ['', [Validators.required, Validators.email]],
    telefono:       ['', Validators.required],
    pais:           ['ES'],
    peticiones:     [''],
    aceptaTerminos: [false, Validators.requiredTrue],
  });

  // ─── Extras (alojamiento only) ───
  readonly extrasSelec = signal<string[]>([]);
  readonly extras = [
    { id: 'paseo',    icon: '🐕', nombre: 'Paseo extra diario',     precio: 10 },
    { id: 'bano',     icon: '🛁', nombre: 'Baño y cepillado',       precio: 25 },
    { id: 'recogida', icon: '🚐', nombre: 'Recogida a domicilio',   precio: 15 },
    { id: 'camara',   icon: '📷', nombre: 'Acceso cámara 24/7',     precio: 5 },
  ];

  // ─── Coupon ───
  readonly descuento      = signal(0);
  readonly cuponCodigo    = signal<string | null>(null);
  readonly cuponError     = signal<string | null>(null);
  readonly aplicandoCupon = signal(false);
  cuponInput = '';

  // ─── Computed ───
  readonly paso1Valido = computed(() => {
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO:    return this.paso1AlojamientoForm.valid;
      case VerticalKey.TRANSPORTE:     return this.paso1TransporteForm.valid;
      case VerticalKey.VETERINARIA:    return this.paso1VeterinariaForm.valid;
      case VerticalKey.PELUQUERIA:     return this.paso1PeluqueriaForm.valid;
      case VerticalKey.ADIESTRAMIENTO: return this.paso1AdiestramientoForm.valid;
      default:                         return false;
    }
  });

  readonly subtotal = computed(() => {
    const base = this.precioBase();
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO: {
        const { checkIn, checkOut } = this.paso1AlojamientoForm.value;
        const noches = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        const extras = this.extrasSelec().reduce(
          (s, id) => s + (this.extras.find(e => e.id === id)?.precio ?? 0), 0,
        );
        return base * noches + extras;
      }
      default:
        return base;
    }
  });

  readonly subtotalNeto = computed(() => Math.max(0, this.subtotal() - this.descuento()));
  readonly iva          = computed(() => Math.round(this.subtotalNeto() * IVA_RATE * 100) / 100);
  readonly total        = computed(() => {
    const real = this.totalFromApi();
    return real !== null ? real : Math.round((this.subtotalNeto() + this.iva()) * 100) / 100;
  });

  readonly paso1Label = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Tu estancia',
      [VerticalKey.TRANSPORTE]: 'Tu trayecto',
      [VerticalKey.VETERINARIA]: 'Tu cita',
      [VerticalKey.PELUQUERIA]: 'Tu cita',
      [VerticalKey.ADIESTRAMIENTO]: 'Tu sesión',
    };
    return m[this.vertical()] ?? 'Selección';
  });

  readonly paso1Titulo = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Detalles de la estancia de tu perro',
      [VerticalKey.TRANSPORTE]: 'Detalles del trayecto',
      [VerticalKey.VETERINARIA]: 'Detalles de la cita veterinaria',
      [VerticalKey.PELUQUERIA]: 'Detalles de la cita de peluquería',
      [VerticalKey.ADIESTRAMIENTO]: 'Detalles del adiestramiento',
    };
    return m[this.vertical()] ?? 'Resumen de tu reserva';
  });

  readonly emojiVertical = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: '🏠',
      [VerticalKey.TRANSPORTE]: '🚐',
      [VerticalKey.VETERINARIA]: '🩺',
      [VerticalKey.PELUQUERIA]: '✂️',
      [VerticalKey.ADIESTRAMIENTO]: '🎓',
    };
    return m[this.vertical()] ?? '🐾';
  });

  readonly verticaLabel = computed(() =>
    VERTICAL_LABELS[this.vertical() as VerticalKey] ?? this.vertical(),
  );

  readonly precioPorLabel = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'noche',
      [VerticalKey.TRANSPORTE]: 'trayecto',
      [VerticalKey.VETERINARIA]: 'cita',
      [VerticalKey.PELUQUERIA]: 'servicio',
      [VerticalKey.ADIESTRAMIENTO]: 'sesión',
    };
    return m[this.vertical()] ?? '';
  });

  readonly lineaResumen = computed(() => {
    const base = this.precioBase();
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO: {
        const { checkIn, checkOut, perros } = this.paso1AlojamientoForm.value;
        const n = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        const p = Number(perros ?? 1);
        return `€${base} × ${n} noche${n !== 1 ? 's' : ''} · ${p} perro${p !== 1 ? 's' : ''}`;
      }
      case VerticalKey.TRANSPORTE:
        return `Tarifa base €${base} + km`;
      case VerticalKey.VETERINARIA:
        return `Cita veterinaria · €${base}`;
      case VerticalKey.PELUQUERIA:
        return `Cita de peluquería · €${base}`;
      case VerticalKey.ADIESTRAMIENTO:
        return this.paso1AdiestramientoForm.value.modalidad === 'programa'
          ? `Programa de adiestramiento · €${base}`
          : `Sesión de adiestramiento · €${base}`;
      default:
        return `€${base}`;
    }
  });

  readonly peticionesPlaceholder = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Alergias, medicación, hábitos de tu perro…',
      [VerticalKey.TRANSPORTE]: 'Mi perro viaja mejor con su manta, jaula propia…',
      [VerticalKey.VETERINARIA]: 'Síntomas, historial médico, cartilla de vacunas…',
      [VerticalKey.PELUQUERIA]: 'Piel sensible, nudos, corte preferido…',
      [VerticalKey.ADIESTRAMIENTO]: 'Conducta a trabajar, nivel de socialización…',
    };
    return m[this.vertical()] ?? 'Peticiones especiales…';
  });

  ngOnInit(): void {
    const routeParams = this.route.snapshot.paramMap;
    const queryParams = this.route.snapshot.queryParamMap;

    this.vertical.set(routeParams.get('vertical') ?? VerticalKey.ALOJAMIENTO);
    this.servicioId = routeParams.get('servicioId') ?? undefined;
    this.comercioId = queryParams.get('comercioId') ?? undefined;
    this.nombreServicio.set(queryParams.get('nombre') ?? '');
    this.imagenServicio.set(queryParams.get('imagen') ?? '');
    this.precioBase.set(Number(queryParams.get('precioBase') ?? 0));
    this.espacioId = queryParams.get('espacioId');
  }

  irPaso(p: number): void {
    this.paso.set(p as Paso);
    if (p === 3 && this.metodoPago() === 'card' && !this.stripeListo()) {
      void this.prepararStripe();
    }
  }

  private buildPayload(): import('../services/reservas.service').CrearReservaPayload {
    const v = this.vertical();
    switch (v) {
      case VerticalKey.ALOJAMIENTO: {
        const f = this.paso1AlojamientoForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: f.checkIn!, fechaFin: f.checkOut ?? undefined,
          cantidad: Number(f.perros ?? 1),
          detalle: {
            tamanoPerro: f.tamanoPerro,
            ...(this.espacioId ? { espacioId: this.espacioId } : {}),
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.TRANSPORTE: {
        const f = this.paso1TransporteForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: `${f.fechaRecogida}T${f.hora}:00`,
          cantidad: 1,
          detalle: {
            origen: f.origen, destino: f.destino,
            distanciaKm: Number(f.distanciaKm ?? 10),
            perros: Number(f.perros ?? 1),
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.VETERINARIA: {
        const f = this.paso1VeterinariaForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: f.fecha!,
          cantidad: 1,
          detalle: { hora: f.hora, servicio: f.servicio },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.PELUQUERIA: {
        const f = this.paso1PeluqueriaForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: f.fecha!,
          cantidad: 1,
          detalle: { hora: f.hora, servicio: f.servicio },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.ADIESTRAMIENTO: {
        const f = this.paso1AdiestramientoForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: f.fechaInicio!,
          cantidad: 1,
          detalle: { modalidad: f.modalidad, edadMeses: Number(f.edadMeses ?? 0) },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      default:
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          fechaInicio: new Date().toISOString(), cantidad: 1,
        };
    }
  }

  private async prepararStripe(): Promise<void> {
    if (!this.servicioId || !this.comercioId) return;
    this.errorPago.set(null);
    try {
      const payload = this.buildPayload();
      const reserva = await this.reservasService.crear(payload);
      this.reservaIdReal = reserva._id ?? reserva.id ?? null;
      this.codigoReserva.set(reserva.codigo);
      if (!this.reservaIdReal) return;

      const intent = await this.paymentsService.crearIntent(this.reservaIdReal);
      this.clientSecret = intent.clientSecret;
      this.totalFromApi.set(intent.montoTotal);

      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe || !this.clientSecret) return;

      this.elements = this.stripe.elements({ clientSecret: this.clientSecret });
      const paymentElement = this.elements.create('payment');
      setTimeout(() => paymentElement.mount('#stripe-payment-element'), 0);
      this.stripeListo.set(true);
    } catch {
      this.stripeListo.set(false);
    }
  }

  toggleExtra(id: string): void {
    this.extrasSelec.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  extraNombre(id: string): string { return this.extras.find(e => e.id === id)?.nombre ?? ''; }
  extraPrecio(id: string): number  { return this.extras.find(e => e.id === id)?.precio ?? 0; }

  async aplicarCupon(): Promise<void> {
    const codigo = this.cuponInput.trim().toUpperCase();
    if (!codigo) return;
    this.aplicandoCupon.set(true);
    this.cuponError.set(null);
    try {
      const res = await this.cuponesService.validar(codigo, this.vertical(), this.subtotal());
      this.descuento.set(res.descuento);
      this.cuponCodigo.set(res.codigo);
    } catch {
      this.cuponError.set('Cupón no válido o no aplicable a esta reserva.');
    } finally {
      this.aplicandoCupon.set(false);
    }
  }

  quitarCupon(): void {
    this.descuento.set(0);
    this.cuponCodigo.set(null);
    this.cuponInput = '';
  }

  async procesarPago(): Promise<void> {
    this.procesando.set(true);
    this.errorPago.set(null);

    if (this.stripe && this.elements && this.clientSecret) {
      const { error } = await this.stripe.confirmPayment({
        elements: this.elements,
        redirect: 'if_required',
      });
      this.procesando.set(false);
      if (error) {
        this.errorPago.set(error.message ?? 'No se pudo procesar el pago. Revisa los datos de la tarjeta.');
        return;
      }
      this.irPaso(4);
      return;
    }

    // Modo demostración
    await new Promise(r => setTimeout(r, 1500));
    if (!this.codigoReserva()) {
      this.codigoReserva.set('RES-' + Math.random().toString(36).substr(2, 8).toUpperCase());
    }
    this.procesando.set(false);
    this.irPaso(4);
  }

  private calcularNoches(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 1;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const diff = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }
}
