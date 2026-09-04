import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsPhoneInputComponent } from '../../../shared/components/phone-input/rs-phone-input.component';
import { iconoVertical } from '../../panel-comercio/vertical-icon';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

const BORRADOR_KEY = 'dk_registro_comercio_borrador';

/**
 * Alta de comercio en dos pasos.
 *
 * El flujo sigue el patrón que usan Airbnb ("¿qué vas a ofrecer?" como primera
 * pregunta, sin teclado de por medio) y Booking ("list your property": el
 * formulario a la izquierda y la propuesta de valor siempre visible al lado).
 * Negocio y acceso van en un mismo paso porque entre los dos suman cinco
 * campos: partirlos añadía un clic y escondía cuánto quedaba por rellenar, que
 * es justo lo que hace abandonar un alta.
 */
@Component({
  selector: 'app-registro-comercio',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RouterLink, RsIconComponent,
    RsPhoneInputComponent,
  ],
  template: `
    <div class="rc">

      <main class="rc__main">
        <div class="rc__col">

          <a routerLink="/" class="rc__back">
            <rs-icon name="arrow-left" [size]="16" [stroke]="2" />
            {{ 'Volver al inicio' | t }}
          </a>

          <a routerLink="/" class="rc__logo" [attr.aria-label]="'Ir a la Home de Doogking' | t">
            <img src="/images/logo-doogking.png" alt="Doogking" />
          </a>

          @if (pendiente()) {
            <section class="rc__ok">
              <svg width="140" height="104" viewBox="0 0 140 104" class="rc__ok-art" aria-hidden="true">
                <rect x="10" y="18" width="120" height="80" rx="14" fill="var(--c-raised)" stroke="var(--b-1)" stroke-width="2"/>
                <path d="M14 26 L70 66 L126 26" fill="none" stroke="var(--dk-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 32 L10 92 Q10 98 16 98 L124 98 Q130 98 130 92 L130 32" fill="none" stroke="var(--b-1)" stroke-width="2"/>
                <circle cx="108" cy="80" r="22" fill="var(--dk-gold)"/>
                <path d="M97 80 L104 87 L119 71" fill="none" stroke="var(--dk-blue-deep)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>

              <h1 class="rc__ok-title">{{ 'Tu cuenta ya está creada' | t }}</h1>
              <p class="rc__ok-text">
                {{ 'Solo queda verificar tu correo. Hemos enviado un enlace a' | t }}
                <strong>{{ emailRegistrado() }}</strong>.
              </p>
              <p class="rc__ok-hint">
                {{ 'Ábrelo y te llevamos directo a publicar tu primer servicio. Si no lo ves, revisa el spam.' | t }}
              </p>

              @if (reenviado()) {
                <div class="rs-alert rs-alert--success rc__gap" role="status">
                  {{ 'Correo reenviado' | t }} <rs-icon name="check" [size]="14" [stroke]="3" />
                </div>
              }
              @if (error()) {
                <div class="rs-alert rs-alert--error rc__gap" role="alert">{{ error() }}</div>
              }

              <button type="button" class="rs-btn rs-btn--outline rs-btn--block rc__gap"
                      (click)="reenviar()" [disabled]="reenviando()">
                {{ reenviando() ? 'Reenviando…' : 'Reenviar correo' }}
              </button>

              <p class="rc__alt"><a routerLink="/auth/login">{{ 'Volver a iniciar sesión' | t }}</a></p>
            </section>

          } @else {

            <header class="rc__head">
              <p class="rc__eyebrow">Paso {{ paso() }} de {{ pasos.length }} · {{ pasoActual().label | t }}</p>
              <div class="rc__bar" role="progressbar" [attr.aria-label]="'Progreso del alta' | t"
                   [attr.aria-valuenow]="paso()" aria-valuemin="1" [attr.aria-valuemax]="pasos.length">
                <span class="rc__bar-fill" [style.width.%]="progreso()"></span>
              </div>
            </header>

            <!-- PASO 1 · Servicios -->
            @if (paso() === 1) {
              <section class="rc__panel">
                <h1 id="rc-t1" class="rc__title">{{ '¿Qué servicios ofreces?' | t }}</h1>
                <p class="rc__sub">{{ 'Marca todos los que quieras. Podrás cambiarlos más adelante.' | t }}</p>

                <div class="rc-cats" role="group" aria-labelledby="rc-t1">
                  @for (v of verticalesDisponibles; track v.key) {
                    <button type="button" class="rc-cat" [class.is-sel]="estaSeleccionada(v.key)"
                            [attr.aria-pressed]="estaSeleccionada(v.key)" (click)="toggleVertical(v.key)">
                      <span class="rc-cat__ico"><rs-icon [name]="v.icon" [size]="20" [stroke]="1.75" /></span>
                      <span class="rc-cat__label">{{ v.label | t }}</span>
                      <span class="rc-cat__mark" aria-hidden="true">
                        <rs-icon name="check" [size]="12" [stroke]="3" />
                      </span>
                    </button>
                  }
                </div>

                <div class="rc__acciones">
                  <p class="rc__contador" aria-live="polite">
                    @if (verticalesSel().length) {
                      {{ verticalesSel().length }}
                      {{ verticalesSel().length === 1 ? 'servicio seleccionado' : 'servicios seleccionados' }}
                    } @else {
                      Elige al menos un servicio para continuar
                    }
                  </p>
                  <button type="button" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                          [disabled]="!seleccionValida()" (click)="siguiente()">
                    {{ 'Continuar' | t }}
                    <rs-icon name="arrow-right" [size]="16" [stroke]="2.5" />
                  </button>
                </div>
              </section>
            }

            <!-- PASO 2 · Negocio + acceso -->
            @if (paso() === 2) {
              <section class="rc__panel">
                <h1 class="rc__title">{{ 'Crea tu cuenta' | t }}</h1>
                <p class="rc__sub">
                  {{ 'Cuatro datos y listo. En cuanto verifiques tu correo te llevamos a publicar tu primer servicio; los datos del negocio se completan al final.' | t }}
                </p>

                <form class="rc-form" [formGroup]="registroForm" (ngSubmit)="onSubmit()" novalidate>

                  <div class="rc-fs" role="group" aria-labelledby="rc-fs-acceso" formGroupName="cuenta">
                    <p class="rc-fs__legend" id="rc-fs-acceso">
                      <rs-icon name="user" [size]="14" [stroke]="2" /> {{ 'Tu acceso' | t }}
                    </p>

                    <div class="rs-field">
                      <label for="nombre" class="rs-lbl">{{ 'Tu nombre' | t }}</label>
                      <input id="nombre" type="text" formControlName="nombre" class="rs-inp" autocomplete="name"
                             [placeholder]="'Nombre y apellidos' | t"
                             [class.rs-inp--error]="invalido(cuentaForm, 'nombre')"
                             [attr.aria-invalid]="invalido(cuentaForm, 'nombre') || null" />
                      @if (invalido(cuentaForm, 'nombre')) { <span class="rs-field-err">{{ 'Escribe tu nombre' | t }}</span> }
                    </div>

                    <div class="rc-row">
                      <div class="rs-field">
                        <label for="email" class="rs-lbl">{{ 'Correo electrónico' | t }}</label>
                        <input id="email" type="email" formControlName="email" class="rs-inp" autocomplete="email"
                               placeholder="tu@negocio.com"
                               [class.rs-inp--error]="invalido(cuentaForm, 'email')"
                               [attr.aria-invalid]="invalido(cuentaForm, 'email') || null" inputmode="email" />
                        @if (invalido(cuentaForm, 'email')) { <span class="rs-field-err">{{ 'Escribe un correo válido' | t }}</span> }
                      </div>

                      <div class="rs-field">
                        <label for="telefono" class="rs-lbl">{{ 'Teléfono' | t }} <span class="rc-opt">{{ 'opcional' | t }}</span></label>
                        <rs-phone-input inputId="telefono" formControlName="telefono" [etiqueta]="'Teléfono' | t" />
                      </div>
                    </div>

                    <div class="rs-field">
                      <label for="password" class="rs-lbl">{{ 'Contraseña' | t }}</label>
                      <div class="rc-pw">
                        <input id="password" [type]="mostrarPassword() ? 'text' : 'password'"
                               formControlName="password" class="rs-inp" autocomplete="new-password"
                               [placeholder]="'Mínimo 8 caracteres' | t"
                               [class.rs-inp--error]="invalido(cuentaForm, 'password')"
                               [attr.aria-invalid]="invalido(cuentaForm, 'password') || null" />
                        <button type="button" class="rc-pw__toggle"
                                [attr.aria-label]="mostrarPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                                [class.is-on]="mostrarPassword()"
                                (click)="mostrarPassword.set(!mostrarPassword())">
                          <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2" />
                        </button>
                      </div>
                      @if (invalido(cuentaForm, 'password')) {
                        <span class="rs-field-err">{{ 'La contraseña debe tener al menos 8 caracteres' | t }}</span>
                      } @else if (cuentaForm.value.password) {
                        <div class="rc-pwf">
                          <div class="rc-pwf__track">
                            <div class="rc-pwf__fill" [class]="'rc-pwf__fill--' + fuerzaPassword()"
                                 [style.width.%]="(nivelFuerzaPassword() / 4) * 100"></div>
                          </div>
                          <span [class]="'rc-pwf__label rc-pwf__label--' + fuerzaPassword()" aria-live="polite">
                            {{ etiquetaFuerzaPassword() }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>

                  @if (error()) {
                    <div class="rs-alert rs-alert--error" role="alert">
                      {{ error() }}
                      @if (emailDuplicado()) {
                        <a routerLink="/auth/login" class="rc-alert__link">{{ 'Iniciar sesión' | t }}</a>
                      }
                    </div>
                  }

                  <p class="rc-legal">
                    {{ 'Al crear tu negocio aceptas los' | t }} <a routerLink="/terminos">{{ 'Términos' | t }}</a>
                    {{ 'y la' | t }} <a routerLink="/privacidad">{{ 'Política de privacidad' | t }}</a>.
                  </p>

                  <div class="rc__acciones rc__acciones--fila">
                    <button type="button" class="rs-btn rs-btn--outline" (click)="atras()" [disabled]="cargando()">
                      {{ 'Atrás' | t }}
                    </button>
                    <button type="submit" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                            [disabled]="cargando()">
                      @if (cargando()) { <span class="rs-spin"></span> }
                      {{ cargando() ? 'Creando…' : 'Crear mi negocio gratis' }}
                    </button>
                  </div>
                </form>
              </section>
            }

            @if (hayBorrador()) {
              <p class="rc__autosave">
                <rs-icon name="check-circle" [size]="13" [stroke]="2" />
                {{ 'Guardamos tu progreso en este dispositivo' | t }}
              </p>
            }

            <p class="rc__alt">
              {{ '¿Buscas servicios para tu mascota?' | t }}
              <a routerLink="/auth/registro">{{ 'Crear cuenta de cliente' | t }}</a>
            </p>
          }
        </div>
      </main>

      <aside class="rc__aside">
        <div class="rc__aside-inner">
          <span class="rc__pill">{{ 'Gratis · Sin cuota de alta' | t }}</span>
          <h2 class="rc__pitch">{{ 'Llena tu agenda con clientes que ya están buscando tu servicio.' | t }}</h2>

          <ul class="rc__list">
            <li><span><rs-icon name="check" [size]="12" [stroke]="3" /></span> {{ 'Miles de usuarios buscando servicios como el tuyo' | t }}</li>
            <li><span><rs-icon name="check" [size]="12" [stroke]="3" /></span> {{ 'Reservas online 24 h, sin llamadas ni agenda en papel' | t }}</li>
            <li><span><rs-icon name="check" [size]="12" [stroke]="3" /></span> {{ 'Calendario, clientes y cobros en un solo panel' | t }}</li>
            <li><span><rs-icon name="check" [size]="12" [stroke]="3" /></span> {{ 'Cobro seguro con Stripe y liquidaciones claras' | t }}</li>
            <li><span><rs-icon name="check" [size]="12" [stroke]="3" /></span> {{ 'Sin permanencia: date de baja cuando quieras' | t }}</li>
          </ul>

          <div class="rc__trust">
            <p><rs-icon name="clock" [size]="14" [stroke]="2" /> {{ 'Menos de 2 minutos' | t }}</p>
            <p><rs-icon name="lock" [size]="14" [stroke]="2" /> {{ 'Tus datos viajan cifrados' | t }}</p>
            <p><rs-icon name="file-text" [size]="14" [stroke]="2" /> {{ 'Datos fiscales y bancarios, más tarde' | t }}</p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    /* ── Layout: formulario a la izquierda, propuesta de valor al lado ────── */
    .rc {
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      grid-template-columns: 1fr;
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(8,37,139,.14) 0%, transparent 60%),
        var(--c-base);
    }
    @media (min-width: 1024px) {
      .rc { grid-template-columns: 1fr minmax(360px, 420px); }
    }

    .rc__main { display: flex; justify-content: center; padding: var(--sp-8) var(--sp-5) var(--sp-12); }
    @media (min-width: 1024px) { .rc__main { padding: var(--sp-12) var(--sp-8); align-items: flex-start; } }
    .rc__col { width: 100%; max-width: 520px; }

    .rc__back {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      margin-left: calc(var(--sp-3) * -1);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--r-full);
      color: var(--t-400); font-size: var(--f-sm); font-weight: var(--w-6); text-decoration: none;
      transition: color var(--d-2), background var(--d-2);
    }
    .rc__back:hover { color: var(--dk-blue); background: var(--c-raised); }

    .rc__logo { display: block; width: fit-content; margin: var(--sp-4) auto var(--sp-8); }
    .rc__logo img { height: 64px; width: auto; display: block; }

    /* ── Progreso ─────────────────────────────────────────────────────────── */
    .rc__eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase; color: var(--t-400);
      margin-bottom: var(--sp-2);
    }
    .rc__bar { height: 4px; border-radius: var(--r-full); background: var(--b-1); overflow: hidden; }
    .rc__bar-fill {
      display: block; height: 100%; border-radius: var(--r-full);
      background: var(--g-accent); transition: width var(--d-3);
    }
    .rc__head { margin-bottom: var(--sp-8); }

    .rc__title {
      font-family: var(--font-display);
      font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100);
      letter-spacing: -.02em; line-height: 1.2; margin-bottom: var(--sp-2);
    }
    .rc__sub { font-size: var(--f-base); color: var(--t-400); line-height: 1.5; margin-bottom: var(--sp-6); }

    /* ── Selector de servicios: filas anchas con icono, no rejilla apretada ─ */
    .rc-cats { display: grid; grid-template-columns: 1fr; gap: var(--sp-2); }
    @media (min-width: 560px) { .rc-cats { grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); } }

    .rc-cat {
      position: relative;
      display: flex; align-items: center; gap: var(--sp-3);
      width: 100%; min-height: 64px;
      padding: var(--sp-3) var(--sp-10) var(--sp-3) var(--sp-3);
      text-align: left;
      border: 1.5px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); color: var(--t-200);
      font-size: var(--f-base); font-weight: var(--w-6); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2), box-shadow var(--d-2);
    }
    .rc-cat:hover { border-color: var(--b-a); box-shadow: var(--sh-md); }
    .rc-cat:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    .rc-cat.is-sel {
      border-color: var(--c-accent); background: var(--c-accent-lo);
      color: var(--dk-blue); box-shadow: var(--sh-md);
    }
    .rc-cat__ico {
      flex: none; display: grid; place-items: center;
      width: 40px; height: 40px; border-radius: var(--r-md);
      background: var(--c-raised); color: var(--t-300);
      transition: background var(--d-2), color var(--d-2);
    }
    .rc-cat.is-sel .rc-cat__ico { background: var(--dk-blue); color: #fff; }
    .rc-cat__label { line-height: 1.25; }
    .rc-cat__mark {
      position: absolute; top: 50%; right: var(--sp-3); transform: translateY(-50%) scale(.6);
      width: 20px; height: 20px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff;
      display: grid; place-items: center;
      opacity: 0; transition: opacity var(--d-2), transform var(--d-2);
    }
    .rc-cat.is-sel .rc-cat__mark { opacity: 1; transform: translateY(-50%) scale(1); }

    .rc__acciones { margin-top: var(--sp-8); }
    .rc__acciones--fila { display: flex; gap: var(--sp-3); align-items: stretch; margin-top: var(--sp-6); }
    .rc__contador { font-size: var(--f-sm); color: var(--t-400); text-align: center; margin-bottom: var(--sp-3); }

    /* ── Formulario ───────────────────────────────────────────────────────── */
    .rc-form { display: flex; flex-direction: column; gap: var(--sp-6); }
    .rc-fs { display: flex; flex-direction: column; gap: var(--sp-5); }
    .rc-fs__legend {
      display: flex; align-items: center; gap: var(--sp-2); width: 100%;
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase; color: var(--dk-blue);
      padding-bottom: var(--sp-3); margin-bottom: var(--sp-1);
      border-bottom: 1px solid var(--b-1);
    }
    .rc-row { display: grid; grid-template-columns: 1fr; gap: var(--sp-5); }
    @media (min-width: 560px) { .rc-row { grid-template-columns: 1fr 1fr; } }

    .rc-hint { display: block; margin-top: var(--sp-1); font-size: var(--f-xs); color: var(--t-400); }
    .rc-opt { font-size: var(--f-xs); font-weight: var(--w-4); color: var(--t-400); }

    .rc-pw { position: relative; }
    .rc-pw .rs-inp { padding-right: var(--sp-10); }
    .rc-pw__toggle {
      position: absolute; right: var(--sp-2); top: 50%; transform: translateY(-50%);
      display: grid; place-items: center; width: 40px; height: 40px;
      border-radius: var(--r-full); color: var(--t-400);
      transition: color var(--d-1), background var(--d-1);
    }
    .rc-pw__toggle:hover { background: var(--c-raised); }
    .rc-pw__toggle.is-on { color: var(--c-accent); }

    .rc-pwf { margin-top: var(--sp-2); }
    .rc-pwf__track { height: 4px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .rc-pwf__fill { height: 100%; border-radius: var(--r-full); transition: width var(--d-2), background var(--d-2); }
    .rc-pwf__fill--debil { background: #EF4444; }
    .rc-pwf__fill--media { background: #F59E0B; }
    .rc-pwf__fill--segura, .rc-pwf__fill--muy_segura { background: var(--c-success); }
    .rc-pwf__label { font-size: var(--f-xs); font-weight: var(--w-6); margin-top: var(--sp-1); display: inline-block; }
    .rc-pwf__label--debil { color: #EF4444; }
    .rc-pwf__label--media { color: #B45309; }
    .rc-pwf__label--segura, .rc-pwf__label--muy_segura { color: var(--c-success); }

    .rc-alert__link {
      display: inline-block; margin-left: var(--sp-2);
      color: inherit; font-weight: var(--w-7); text-decoration: underline;
    }
    .rc-legal { font-size: var(--f-xs); color: var(--t-400); line-height: 1.5; }
    .rc-legal a { color: var(--c-accent); font-weight: var(--w-6); }

    /* ── Pie ──────────────────────────────────────────────────────────────── */
    .rc__autosave {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
      margin-top: var(--sp-6); font-size: var(--f-xs); color: var(--t-400);
    }
    .rc__alt { text-align: center; margin-top: var(--sp-6); font-size: var(--f-sm); color: var(--t-400); }
    .rc__alt a { color: var(--c-accent); font-weight: var(--w-6); }
    .rc__alt a:hover { color: var(--c-accent-h); }

    /* ── Confirmación ─────────────────────────────────────────────────────── */
    .rc__ok { text-align: center; }
    .rc__ok-art { display: block; margin: 0 auto var(--sp-4); }
    .rc__ok-title {
      font-family: var(--font-display);
      font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2);
    }
    .rc__ok-text { font-size: var(--f-base); color: var(--t-200); line-height: 1.6; }
    .rc__ok-hint { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-3); line-height: 1.5; }
    .rc__gap { margin-top: var(--sp-4); }

    /* ── Panel de valor: a la derecha en escritorio, debajo en móvil ──────── */
    .rc__aside {
      background: linear-gradient(160deg, var(--dk-blue) 0%, var(--dk-blue-deep) 100%);
      color: #fff;
      padding: var(--sp-8) var(--sp-6) var(--sp-10);
    }
    @media (min-width: 1024px) {
      .rc__aside { padding: var(--sp-12) var(--sp-8); }
      .rc__aside-inner { position: sticky; top: var(--sp-12); }
    }
    .rc__aside-inner { max-width: 420px; margin-inline: auto; }

    .rc__pill {
      display: inline-block; padding: var(--sp-1) var(--sp-3);
      border-radius: var(--r-full); background: var(--g-warm); color: var(--dk-blue-deep);
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .04em; text-transform: uppercase;
    }
    .rc__pitch {
      font-family: var(--font-display);
      /* El color va explícito: sin él, el h2 hereda el azul de marca de la
         regla global de encabezados y se perdía sobre el navy del panel. */
      color: #fff;
      font-size: var(--f-xl); font-weight: var(--w-8); line-height: 1.3; letter-spacing: -.02em;
      margin: var(--sp-4) 0 var(--sp-6);
    }
    @media (min-width: 1024px) { .rc__pitch { font-size: var(--f-2xl); } }

    .rc__list { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }
    .rc__list li {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      font-size: var(--f-sm); line-height: 1.45; color: rgba(255,255,255,.88);
    }
    .rc__list li > span {
      flex: none; margin-top: 2px;
      width: 18px; height: 18px; border-radius: var(--r-full);
      background: var(--dk-gold); color: var(--dk-blue-deep);
      display: grid; place-items: center;
    }

    .rc__trust {
      margin-top: var(--sp-8); padding-top: var(--sp-6);
      border-top: 1px solid rgba(255,255,255,.18);
      display: flex; flex-direction: column; gap: var(--sp-3);
    }
    .rc__trust p {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-xs); color: rgba(255,255,255,.7); margin: 0;
    }
  `],
})
export class RegistroComercioComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly paso = signal(1);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly emailDuplicado = signal(false);
  readonly mostrarPassword = signal(false);
  readonly verticalesSel = signal<VerticalKey[]>([]);
  readonly pendiente = signal(false);
  readonly emailRegistrado = signal('');
  readonly reenviando = signal(false);
  readonly reenviado = signal(false);
  readonly hayBorrador = signal(false);

  readonly pasos = [
    { n: 1, label: 'Servicios' },
    { n: 2, label: 'Tu cuenta' },
  ];

  readonly verticalesDisponibles = Object.values(VerticalKey).map((key) => ({
    key,
    label: VERTICAL_LABELS[key],
    icon: iconoVertical(key),
  }));

  /**
   * Los dos bloques cuelgan de un grupo raíz que se enlaza en el `<form>`.
   *
   * No es cosmético: `(ngSubmit)` lo emite `FormGroupDirective`, y con los
   * `formGroup` sólo en los `<div>` de dentro ningún directiva casaba con el
   * `<form>`. El binding quedaba escuchando un evento DOM inexistente, el botón
   * hacía un submit nativo del navegador y la página se recargaba entera: el
   * alta parecía "volver al paso 1" cuando en realidad la SPA arrancaba de cero.
   */
  readonly registroForm = this.fb.group({
    cuenta: this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
    }),
  });

  readonly cuentaForm = this.registroForm.controls.cuenta;

  readonly seleccionValida = computed(() => this.verticalesSel().length > 0);
  readonly pasoActual = computed(() => this.pasos[this.paso() - 1] ?? this.pasos[0]);
  readonly progreso = computed(() => (this.paso() / this.pasos.length) * 100);

  /** Fuerza de la contraseña (HU-6.1.4): sin validación de servidor, solo guía visual. */
  nivelFuerzaPassword(): 1 | 2 | 3 | 4 {
    const pwd = this.cuentaForm.value.password ?? '';
    let puntos = 0;
    if (pwd.length >= 8) puntos++;
    if (pwd.length >= 12) puntos++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) puntos++;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) puntos++;
    return Math.max(1, puntos) as 1 | 2 | 3 | 4;
  }

  fuerzaPassword(): 'debil' | 'media' | 'segura' | 'muy_segura' {
    return (['debil', 'media', 'segura', 'muy_segura'] as const)[this.nivelFuerzaPassword() - 1];
  }

  etiquetaFuerzaPassword(): string {
    return { debil: 'Débil', media: 'Media', segura: 'Segura', muy_segura: 'Muy segura' }[this.fuerzaPassword()];
  }

  constructor() {
    this.restaurarBorrador();
  }

  invalido(form: FormGroup, control: string): boolean {
    const c = form.get(control);
    return !!c && c.invalid && c.touched;
  }

  estaSeleccionada(v: VerticalKey): boolean {
    return this.verticalesSel().includes(v);
  }

  toggleVertical(v: VerticalKey): void {
    this.verticalesSel.update((lista) =>
      lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v],
    );
    this.guardarBorrador();
  }

  siguiente(): void {
    if (this.paso() === 1 && !this.seleccionValida()) return;
    this.guardarBorrador();
    this.paso.update((p) => Math.min(this.pasos.length, p + 1));
  }

  atras(): void {
    this.error.set(null);
    this.emailDuplicado.set(false);
    this.paso.update((p) => Math.max(1, p - 1));
  }

  async onSubmit(): Promise<void> {
    if (!this.formulariosValidos()) return;

    this.cargando.set(true);
    this.error.set(null);
    this.emailDuplicado.set(false);

    try {
      const cuenta = this.cuentaForm.getRawValue();
      const respuesta = await this.authService.registrarComercio({
        nombre: cuenta.nombre!,
        email: cuenta.email!,
        password: cuenta.password!,
        telefono: cuenta.telefono || undefined,
        verticales: this.verticalesSel().length ? this.verticalesSel() : undefined,
      });
      localStorage.removeItem(BORRADOR_KEY);
      this.hayBorrador.set(false);
      this.emailRegistrado.set(respuesta.email);
      this.pendiente.set(true);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409) {
        this.emailDuplicado.set(true);
        this.error.set('Ese email ya está registrado.');
      } else {
        this.error.set('No pudimos crear tu negocio. Inténtalo de nuevo.');
      }
    } finally {
      this.cargando.set(false);
    }
  }

  async reenviar(): Promise<void> {
    this.reenviando.set(true);
    this.reenviado.set(false);
    try {
      await this.authService.reenviarVerificacion(this.emailRegistrado());
      this.reenviado.set(true);
    } catch {
      this.error.set('No se pudo reenviar el correo.');
    } finally {
      this.reenviando.set(false);
    }
  }

  private formulariosValidos(): boolean {
    if (this.cuentaForm.valid) return true;
    this.cuentaForm.markAllAsTouched();
    return false;
  }

  /**
   * Sólo se recuerdan las categorías marcadas. Los datos de acceso no se
   * guardan en el dispositivo: entre ellos va la contraseña, y dejarla escrita
   * en `localStorage` para ahorrar un campo no compensa.
   */
  private guardarBorrador(): void {
    localStorage.setItem(BORRADOR_KEY, JSON.stringify({ verticales: this.verticalesSel() }));
    this.hayBorrador.set(true);
  }

  private restaurarBorrador(): void {
    const raw = localStorage.getItem(BORRADOR_KEY);
    if (!raw) return;
    try {
      const b = JSON.parse(raw) as { verticales?: VerticalKey[] };
      if (Array.isArray(b.verticales)) this.verticalesSel.set(b.verticales);
      this.hayBorrador.set(true);
    } catch {
      localStorage.removeItem(BORRADOR_KEY);
    }
  }
}
