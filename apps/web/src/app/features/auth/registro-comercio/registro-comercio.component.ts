import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsPlaceAutocompleteComponent } from '../../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { RsPhoneInputComponent } from '../../../shared/components/phone-input/rs-phone-input.component';
import { iconoVertical } from '../../panel-comercio/vertical-icon';

const BORRADOR_KEY = 'dk_registro_comercio_borrador';

@Component({
  selector: 'app-registro-comercio',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, RsIconComponent,
    RsPlaceAutocompleteComponent, RsPhoneInputComponent,
  ],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card" style="max-width:560px">

        <a routerLink="/" class="rs-auth__volver">
          <rs-icon name="arrow-left" [size]="16" [stroke]="2" />
          Volver al inicio
        </a>

        <div class="rs-auth__brand">
          <a routerLink="/" aria-label="Ir a la Home de Doogking" style="display:inline-block;cursor:pointer">
            <img src="/images/logo-doogking.jpg" alt="Doogking"
                 style="height:96px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-2)" />
          </a>
          <p>{{ pendiente() ? '¡Ya casi está!' : 'Empieza a recibir reservas con Doogking' }}</p>
        </div>

        @if (pendiente()) {
          <div style="text-align:center">
            <svg width="140" height="104" viewBox="0 0 140 104" style="margin:0 auto var(--sp-4);display:block" aria-hidden="true">
              <rect x="10" y="18" width="120" height="80" rx="14" fill="var(--c-raised)" stroke="var(--b-1)" stroke-width="2"/>
              <path d="M14 26 L70 66 L126 26" fill="none" stroke="var(--dk-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 32 L10 92 Q10 98 16 98 L124 98 Q130 98 130 92 L130 32" fill="none" stroke="var(--b-1)" stroke-width="2"/>
              <circle cx="108" cy="80" r="22" fill="var(--dk-gold)"/>
              <path d="M97 80 L104 87 L119 71" fill="none" stroke="var(--dk-blue-deep)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p style="color:var(--t-200);font-size:var(--f-base);line-height:1.6">
              Solo queda verificar tu correo para empezar a recibir reservas.<br>
              Hemos enviado un correo a: <strong>{{ emailRegistrado() }}</strong>.
            </p>
            <p style="color:var(--t-400);font-size:var(--f-sm);margin-top:var(--sp-3)">
              Haz clic en el enlace del correo para activar tu cuenta y entrar a tu panel de comercio. Revisa también el spam.
            </p>
            @if (reenviado()) {
              <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">Correo reenviado <rs-icon name="check" [size]="14" [stroke]="3"></rs-icon></div>
            }
            <button type="button" class="rs-btn rs-btn--outline rs-btn--block" style="margin-top:var(--sp-5)"
                    (click)="reenviar()" [disabled]="reenviando()">
              {{ reenviando() ? 'Reenviando…' : 'Reenviar correo' }}
            </button>
            <div class="rs-auth__footer" style="margin-top:var(--sp-4)">
              <a routerLink="/auth/login">Volver a iniciar sesión</a>
            </div>
          </div>
        } @else {

        <!-- Stepper -->
        <div class="wz-steps">
          @for (s of pasos; track s.n; let last = $last) {
            <div class="wz-step" [class.wz-step--activo]="paso() === s.n" [class.wz-step--hecho]="paso() > s.n">
              <div class="wz-step__dot">
                @if (paso() > s.n) {
                  <rs-icon name="check" [size]="14" [stroke]="2.5"></rs-icon>
                } @else {
                  {{ s.n }}
                }
              </div>
              <span class="wz-step__label">{{ s.label }}</span>
            </div>
            @if (!last) {
              <div class="wz-step__track" [class.wz-step__track--hecho]="paso() > s.n"></div>
            }
          }
        </div>

        <!-- PASO 1: Categorías -->
        @if (paso() === 1) {
          <div class="wz-panel">
            <h2 class="wz-title">¿Qué servicios quieres ofrecer?</h2>
            <p class="wz-sub">Puedes seleccionar uno o varios servicios. Más adelante podrás modificarlos cuando quieras.</p>

            <div class="wz-grid">
              @for (v of verticalesDisponibles; track v.key) {
                <button type="button" class="wz-cat" [class.wz-cat--sel]="estaSeleccionada(v.key)"
                        (click)="toggleVertical(v.key)">
                  <rs-icon [name]="v.icon" [size]="24" [stroke]="1.75"></rs-icon>
                  <span>{{ v.label }}</span>
                  @if (estaSeleccionada(v.key)) {
                    <span class="wz-cat__check"><rs-icon name="check" [size]="12" [stroke]="3"></rs-icon></span>
                  }
                </button>
              }
            </div>

            <div class="wz-benefits">
              <strong>¿Qué conseguirás al unirte?</strong>
              <ul>
                <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> Miles de usuarios buscando servicios como el tuyo</li>
                <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> Reservas online 24 h, sin llamadas ni gestión manual</li>
                <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> Calendario y gestión de tu negocio en un solo panel</li>
                <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> Cobro seguro con Stripe</li>
                <li><rs-icon name="check" [size]="14" [stroke]="3"></rs-icon> Sin permanencia: date de baja cuando quieras</li>
              </ul>
            </div>

            <button type="button" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                    style="margin-top:var(--sp-6)"
                    [disabled]="verticalesSel().length === 0" (click)="siguiente()">
              Continuar
            </button>
          </div>
        }

        <!-- PASO 2: Negocio -->
        @if (paso() === 2) {
          <form [formGroup]="negocioForm" class="wz-panel" (ngSubmit)="siguiente()">
            <h2 class="wz-title">Cuéntanos sobre tu negocio</h2>
            <p class="wz-sub">Estos datos aparecerán en tu perfil público.</p>

            <div class="rs-field">
              <label for="nombreComercial" class="rs-lbl">Nombre del negocio</label>
              <input id="nombreComercial" type="text" formControlName="nombreComercial" class="rs-inp"
                     autocomplete="organization" [class.rs-inp--error]="invalido(negocioForm, 'nombreComercial')"
                     [placeholder]="placeholderNombreNegocio()" />
              @if (invalido(negocioForm, 'nombreComercial')) {
                <span class="rs-field-err">Ingresa el nombre de tu negocio</span>
              }
            </div>

            <div class="rs-field">
              <label for="ciudad" class="rs-lbl">¿Dónde prestas tus servicios?</label>
              <rs-place-autocomplete inputId="ciudad" formControlName="ciudad"
                                     apariencia="campo" placeholder="¿Dónde prestas tus servicios?" />
              @if (invalido(negocioForm, 'ciudad')) {
                <span class="rs-field-err">Ingresa tu ciudad</span>
              }
            </div>

            <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
              <button type="button" class="rs-btn rs-btn--outline" (click)="atras()">Atrás</button>
              <button type="submit" class="rs-btn rs-btn--primary rs-btn--block"
                      [disabled]="negocioForm.invalid">Continuar</button>
            </div>
          </form>
        }

        <!-- PASO 3: Cuenta -->
        @if (paso() === 3) {
          <form [formGroup]="cuentaForm" class="wz-panel" (ngSubmit)="onSubmit()">
            <h2 class="wz-title">Tu acceso</h2>
            <p class="wz-sub">Crea tu cuenta para empezar a gestionar tus reservas.</p>

            <div class="rs-field">
              <label for="nombre" class="rs-lbl">Tu nombre</label>
              <input id="nombre" type="text" formControlName="nombre" class="rs-inp" autocomplete="name"
                     [class.rs-inp--error]="invalido(cuentaForm, 'nombre')" placeholder="Nombre y apellidos" />
              @if (invalido(cuentaForm, 'nombre')) { <span class="rs-field-err">Ingresa tu nombre</span> }
            </div>

            <div class="rs-field">
              <label for="email" class="rs-lbl">Correo electrónico</label>
              <input id="email" type="email" formControlName="email" class="rs-inp" autocomplete="email"
                     [class.rs-inp--error]="invalido(cuentaForm, 'email')" placeholder="tu@negocio.com" />
              @if (invalido(cuentaForm, 'email')) { <span class="rs-field-err">Ingresa un email válido</span> }
            </div>

            <div class="rs-field">
              <label for="telefono" class="rs-lbl">Teléfono</label>
              <rs-phone-input inputId="telefono" formControlName="telefono" etiqueta="Teléfono" />
              <span class="wz-opt">Opcional</span>
            </div>

            <div class="rs-field">
              <label for="password" class="rs-lbl">Contraseña</label>
              <div style="position:relative">
                <input id="password" [type]="mostrarPassword() ? 'text' : 'password'" formControlName="password"
                       class="rs-inp" autocomplete="new-password" [class.rs-inp--error]="invalido(cuentaForm, 'password')"
                       style="padding-right:var(--sp-10)" placeholder="Mínimo 8 caracteres" />
                <button type="button" (click)="mostrarPassword.set(!mostrarPassword())"
                        style="position:absolute;right:var(--sp-2);top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:40px;height:40px"
                        [style.color]="mostrarPassword() ? 'var(--c-accent)' : 'var(--t-400)'">
                  <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
                </button>
              </div>
              @if (invalido(cuentaForm, 'password')) {
                <span class="rs-field-err">La contraseña debe tener al menos 8 caracteres</span>
              } @else if (cuentaForm.value.password) {
                <div class="wz-pwstrength">
                  <div class="wz-pwstrength__track">
                    <div class="wz-pwstrength__fill" [class]="'wz-pwstrength__fill--' + fuerzaPassword()"
                         [style.width.%]="(nivelFuerzaPassword() / 4) * 100"></div>
                  </div>
                  <span [class]="'wz-pwstrength__label wz-pwstrength__label--' + fuerzaPassword()">
                    {{ etiquetaFuerzaPassword() }}
                  </span>
                </div>
              }
            </div>

            @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

            <div class="wz-trust">
              <p><rs-icon name="lock" [size]="14" [stroke]="2"></rs-icon> Tus datos están protegidos</p>
              <p><rs-icon name="file-text" [size]="14" [stroke]="2"></rs-icon> Podrás completar la información fiscal y bancaria más adelante</p>
              <p><rs-icon name="clock" [size]="14" [stroke]="2"></rs-icon> En menos de 2 minutos tendrás tu negocio creado</p>
            </div>

            <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-4)">
              <button type="button" class="rs-btn rs-btn--outline" (click)="atras()" [disabled]="cargando()">Atrás</button>
              <button type="submit" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                      [disabled]="cuentaForm.invalid || cargando()">
                @if (cargando()) { <span class="rs-spin"></span> }
                {{ cargando() ? 'Creando…' : 'Crear mi negocio' }}
              </button>
            </div>
          </form>
        }
        }

        <div class="rs-auth__footer">
          ¿Buscas servicios para tu mascota? <a routerLink="/auth/registro">Crear cuenta de cliente</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wz-steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-6);
    }
    .wz-step { display: flex; align-items: center; gap: var(--sp-2); }
    .wz-step__track {
      width: 24px; height: 2px; border-radius: var(--r-full);
      background: var(--b-1); transition: background var(--d-2);
    }
    .wz-step__track--hecho { background: var(--g-accent); }
    @media (max-width: 480px) { .wz-step__track { width: 12px; } }
    .wz-step__dot {
      width: 28px; height: 28px; border-radius: var(--r-full);
      display: flex; align-items: center; justify-content: center;
      font-size: var(--f-xs); font-weight: var(--w-7);
      background: var(--c-raised); color: var(--t-400);
      border: 1px solid var(--b-1); transition: all var(--d-2);
    }
    .wz-step__label { font-size: var(--f-xs); color: var(--t-400); font-weight: var(--w-5); }
    .wz-step--activo .wz-step__dot { background: var(--c-accent); color: #fff; border-color: var(--c-accent); }
    .wz-step--activo .wz-step__label { color: var(--t-100); }
    .wz-step--hecho .wz-step__dot { background: var(--g-accent); color: #fff; border-color: transparent; }
    @media (max-width: 480px) { .wz-step__label { display: none; } }

    .wz-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .wz-sub { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-5); }
    .wz-opt { display: inline-block; margin-top: var(--sp-1); color: var(--t-400); font-weight: var(--w-4); font-size: var(--f-xs); }

    .wz-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); }
    @media (min-width: 480px) { .wz-grid { grid-template-columns: repeat(3, 1fr); } }

    .wz-cat {
      position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2);
      padding: var(--sp-4) var(--sp-2);
      border: 1.5px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); color: var(--t-300);
      font-size: var(--f-sm); font-weight: var(--w-6); cursor: pointer;
      transition: all var(--d-2);
    }
    .wz-cat:hover { border-color: var(--c-accent); color: var(--t-100); }
    .wz-cat--sel {
      border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--c-accent);
      box-shadow: var(--sh-md); transform: translateY(-1px);
    }
    .wz-cat__check {
      position: absolute; top: var(--sp-2); right: var(--sp-2);
      width: 18px; height: 18px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
    }

    .wz-benefits {
      margin-top: var(--sp-5);
      padding: var(--sp-4);
      background: var(--c-accent-lo);
      border-radius: var(--r-lg);
      strong { font-size: var(--f-sm); color: var(--dk-blue); }
      ul { list-style: none; margin-top: var(--sp-2); display: flex; flex-direction: column; gap: var(--sp-1); }
      li { font-size: var(--f-xs); color: var(--t-300); }
    }

    .wz-trust {
      margin-top: var(--sp-4);
      display: flex; flex-direction: column; gap: var(--sp-2);
      p { font-size: var(--f-xs); color: var(--t-400); margin: 0; }
    }

    .wz-pwstrength { margin-top: var(--sp-2); }
    .wz-pwstrength__track { height: 4px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .wz-pwstrength__fill { height: 100%; border-radius: var(--r-full); transition: width var(--d-2), background var(--d-2); }
    .wz-pwstrength__fill--debil { background: #EF4444; }
    .wz-pwstrength__fill--media { background: #F59E0B; }
    .wz-pwstrength__fill--segura { background: #10B981; }
    .wz-pwstrength__fill--muy_segura { background: #047857; }
    .wz-pwstrength__label { font-size: var(--f-xs); font-weight: var(--w-6); margin-top: var(--sp-1); display: inline-block; }
    .wz-pwstrength__label--debil { color: #EF4444; }
    .wz-pwstrength__label--media { color: #B45309; }
    .wz-pwstrength__label--segura { color: #047857; }
    .wz-pwstrength__label--muy_segura { color: #047857; }
  `],
})
export class RegistroComercioComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly paso = signal(1);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);
  readonly verticalesSel = signal<VerticalKey[]>([]);
  readonly pendiente = signal(false);
  readonly emailRegistrado = signal('');
  readonly reenviando = signal(false);
  readonly reenviado = signal(false);

  readonly pasos = [
    { n: 1, label: 'Servicios' },
    { n: 2, label: 'Negocio' },
    { n: 3, label: 'Acceso' },
  ];

  readonly verticalesDisponibles = Object.values(VerticalKey).map((key) => ({
    key,
    label: VERTICAL_LABELS[key],
    icon: iconoVertical(key),
  }));

  readonly negocioForm = this.fb.group({
    nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
    ciudad: ['', [Validators.required, Validators.minLength(2)]],
  });

  readonly cuentaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly seleccionValida = computed(() => this.verticalesSel().length > 0);

  private readonly placeholdersPorVertical: Partial<Record<VerticalKey, string>> = {
    [VerticalKey.VETERINARIA]: 'Ej. Veterinario Pérez',
    [VerticalKey.PELUQUERIA]: 'Ej. Peluquería Canina Vila-Can',
    [VerticalKey.ALOJAMIENTO]: 'Ej. Residencia Canina Vila-Can',
    [VerticalKey.TRANSPORTE]: 'Ej. Transportes Caninos Madrid',
    [VerticalKey.ADIESTRAMIENTO]: 'Ej. Adiestramiento Canino Vila-Can',
    [VerticalKey.HOTELES]: 'Ej. Hotel Canino Luna',
    [VerticalKey.CUIDADORES]: 'Ej. Paseos y Cuidado Canino Vila-Can',
  };

  /** Placeholder del nombre del negocio según el primer servicio elegido (HU-6.1.1). */
  placeholderNombreNegocio(): string {
    const primero = this.verticalesSel()[0];
    return (primero && this.placeholdersPorVertical[primero]) || 'Ej. Royal Dog Resort';
  }

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
    if (this.paso() === 2) {
      if (this.negocioForm.invalid) {
        this.negocioForm.markAllAsTouched();
        return;
      }
    }
    this.guardarBorrador();
    this.paso.update((p) => Math.min(3, p + 1));
  }

  atras(): void {
    this.error.set(null);
    this.paso.update((p) => Math.max(1, p - 1));
  }

  async onSubmit(): Promise<void> {
    if (this.cuentaForm.invalid) {
      this.cuentaForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      const negocio = this.negocioForm.getRawValue();
      const cuenta = this.cuentaForm.getRawValue();
      const respuesta = await this.authService.registrarComercio({
        nombre: cuenta.nombre!,
        email: cuenta.email!,
        password: cuenta.password!,
        telefono: cuenta.telefono || undefined,
        nombreComercial: negocio.nombreComercial!,
        ciudad: negocio.ciudad || undefined,
        verticales: this.verticalesSel().length ? this.verticalesSel() : undefined,
      });
      localStorage.removeItem(BORRADOR_KEY);
      this.emailRegistrado.set(respuesta.email);
      this.pendiente.set(true);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409) {
        this.error.set('Ese email ya está registrado. ¿Quieres iniciar sesión?');
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

  private guardarBorrador(): void {
    const borrador = {
      verticales: this.verticalesSel(),
      negocio: this.negocioForm.getRawValue(),
    };
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(borrador));
  }

  private restaurarBorrador(): void {
    const raw = localStorage.getItem(BORRADOR_KEY);
    if (!raw) return;
    try {
      const b = JSON.parse(raw) as {
        verticales?: VerticalKey[];
        negocio?: { nombreComercial?: string; ciudad?: string };
      };
      if (Array.isArray(b.verticales)) this.verticalesSel.set(b.verticales);
      if (b.negocio) this.negocioForm.patchValue(b.negocio);
    } catch {
      localStorage.removeItem(BORRADOR_KEY);
    }
  }
}
