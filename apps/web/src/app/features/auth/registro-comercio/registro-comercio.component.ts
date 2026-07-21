import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { iconoVertical } from '../../panel-comercio/vertical-icon';

const BORRADOR_KEY = 'dk_registro_comercio_borrador';

@Component({
  selector: 'app-registro-comercio',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RsIconComponent],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card" style="max-width:560px">

        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking"
               style="height:96px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-2)" />
          <p>{{ pendiente() ? 'Verifica tu correo' : 'Hazte partner de Doogking' }}</p>
        </div>

        @if (pendiente()) {
          <div style="text-align:center">
            <div style="width:64px;height:64px;border-radius:50%;background:var(--c-accent-lo);color:var(--c-accent);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)">
              <rs-icon name="mail" [size]="30" [stroke]="1.75"></rs-icon>
            </div>
            <p style="color:var(--t-200);font-size:var(--f-base);line-height:1.6">
              Te enviamos un enlace de verificación a<br><strong>{{ emailRegistrado() }}</strong>.
            </p>
            <p style="color:var(--t-400);font-size:var(--f-sm);margin-top:var(--sp-3)">
              Ábrelo para activar tu cuenta y entrar a tu panel de comercio. Revisa también el spam.
            </p>
            @if (reenviado()) {
              <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">Correo reenviado ✓</div>
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
          @for (s of pasos; track s.n) {
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
          }
        </div>

        <!-- PASO 1: Categorías -->
        @if (paso() === 1) {
          <div class="wz-panel">
            <h2 class="wz-title">¿Qué ofreces?</h2>
            <p class="wz-sub">Elige una o varias categorías. Podrás añadir más luego.</p>

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
            <h2 class="wz-title">Tu negocio</h2>
            <p class="wz-sub">Lo básico para que tus clientes te encuentren.</p>

            <div class="rs-field">
              <label for="nombreComercial" class="rs-lbl">Nombre del negocio</label>
              <input id="nombreComercial" type="text" formControlName="nombreComercial" class="rs-inp"
                     autocomplete="organization" [class.rs-inp--error]="invalido(negocioForm, 'nombreComercial')"
                     placeholder="Ej. Royal Dog Resort" />
              @if (invalido(negocioForm, 'nombreComercial')) {
                <span class="rs-field-err">Ingresa el nombre de tu negocio</span>
              }
            </div>

            <div class="rs-field">
              <label for="ciudad" class="rs-lbl">Ciudad</label>
              <input id="ciudad" type="text" formControlName="ciudad" class="rs-inp"
                     autocomplete="address-level2" [class.rs-inp--error]="invalido(negocioForm, 'ciudad')"
                     placeholder="Ej. Madrid" />
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
            <p class="wz-sub">Con estos datos entrarás a gestionar tu negocio.</p>

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
              <label for="telefono" class="rs-lbl">Teléfono <span class="wz-opt">(opcional)</span></label>
              <input id="telefono" type="tel" formControlName="telefono" class="rs-inp" autocomplete="tel"
                     placeholder="+34 600 000 000" />
            </div>

            <div class="rs-field">
              <label for="password" class="rs-lbl">Contraseña</label>
              <div style="position:relative">
                <input id="password" [type]="mostrarPassword() ? 'text' : 'password'" formControlName="password"
                       class="rs-inp" autocomplete="new-password" [class.rs-inp--error]="invalido(cuentaForm, 'password')"
                       style="padding-right:var(--sp-10)" placeholder="Mínimo 8 caracteres" />
                <button type="button" (click)="mostrarPassword.set(!mostrarPassword())"
                        style="position:absolute;right:var(--sp-3);top:50%;transform:translateY(-50%);display:flex;align-items:center"
                        [style.color]="mostrarPassword() ? 'var(--c-accent)' : 'var(--t-400)'">
                  <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
                </button>
              </div>
              @if (invalido(cuentaForm, 'password')) {
                <span class="rs-field-err">La contraseña debe tener al menos 8 caracteres</span>
              }
            </div>

            @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }

            <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-4)">
              <button type="button" class="rs-btn rs-btn--outline" (click)="atras()" [disabled]="cargando()">Atrás</button>
              <button type="submit" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                      [disabled]="cuentaForm.invalid || cargando()">
                @if (cargando()) { <span class="rs-spin"></span> }
                {{ cargando() ? 'Creando…' : 'Crear mi negocio' }}
              </button>
            </div>

            <p style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-top:var(--sp-4);line-height:1.5">
              Los datos fiscales y bancarios los completarás luego, sin prisa, desde tu panel.
            </p>
          </form>
        }
        }

        <div class="rs-auth__footer">
          ¿Eres dueño de un perro? <a routerLink="/auth/registro">Crea tu cuenta de cliente</a>
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
    .wz-opt { color: var(--t-400); font-weight: var(--w-4); }

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
    .wz-cat--sel { border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--c-accent); }
    .wz-cat__check {
      position: absolute; top: var(--sp-2); right: var(--sp-2);
      width: 18px; height: 18px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
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
