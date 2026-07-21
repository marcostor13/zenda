import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TitleCasePipe } from '@angular/common';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { iconoVertical } from './vertical-icon';

const VERTICALES_OPCIONES = [
  { valor: 'alojamiento', label: 'Alojamiento' },
  { valor: 'transporte', label: 'Transporte' },
  { valor: 'veterinaria', label: 'Veterinaria' },
  { valor: 'peluqueria', label: 'Peluquería' },
  { valor: 'adiestramiento', label: 'Adiestramiento' },
];

const PLAN_BADGE: Record<string, string> = {
  basico: 'rs-badge--neutral', pro: 'rs-badge--accent', premium: 'rs-badge--warning',
};

const NAV_ITEMS = [
  { icon: 'sparkles',       label: 'Dashboard',      ruta: '/comercio',          exact: true  },
  { icon: 'calendar',       label: 'Reservas',        ruta: '/comercio/reservas', exact: false },
  { icon: 'tag',            label: 'Listados',        ruta: '/comercio/listados', exact: false },
  { icon: 'euro',           label: 'Suplementos',     ruta: '/comercio/suplementos', exact: false },
  { icon: 'trending-up',   label: 'Ingresos',        ruta: '/comercio/ingresos', exact: false },
  { icon: 'star',           label: 'Reseñas',         ruta: '/comercio/resenas',  exact: false },
  { icon: 'users',          label: 'Equipo',          ruta: '/comercio/equipo',   exact: false },
  { icon: 'settings',       label: 'Configuración',   ruta: '/comercio/config',   exact: false },
];

@Component({
  selector: 'app-comercio-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule, TitleCasePipe, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  @if (cargando()) {
    <div style="text-align:center;padding:var(--sp-20);color:var(--t-400)">Cargando…</div>
  } @else if (sinNegocio()) {
    <!-- ONBOARDING: cuenta de comercio sin negocio vinculado -->
    <div class="rs-wrap" style="padding-block:var(--sp-12);max-width:560px">
      <div class="rs-card" style="padding:var(--sp-8)">
        <h1 style="font-size:var(--f-2xl);font-weight:var(--w-8);color:var(--t-100);margin-bottom:var(--sp-2)">Configura tu negocio</h1>
        <p style="color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-6)">
          Tu cuenta aún no está vinculada a ningún negocio. Créalo para empezar a publicar servicios y recibir reservas.
        </p>
        <form [formGroup]="onboardingForm" (ngSubmit)="crearNegocio()" style="display:flex;flex-direction:column;gap:var(--sp-4)">
          <div class="rs-form-group">
            <label class="rs-label">Nombre comercial</label>
            <input class="rs-input" formControlName="nombreComercial" placeholder="Ej. Centro Canino Vila-Can" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Razón social</label>
            <input class="rs-input" formControlName="razonSocial" placeholder="Ej. Vila-Can S.L." />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">CIF / NIF</label>
            <input class="rs-input" formControlName="vatNumber" placeholder="Ej. B12345678" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">¿Qué servicios ofreces?</label>
            <div style="display:flex;flex-wrap:wrap;gap:var(--sp-3);margin-top:var(--sp-2)">
              @for (v of verticalesOpciones; track v.valor) {
                <label style="display:inline-flex;align-items:center;gap:var(--sp-2);cursor:pointer;font-size:var(--f-sm)">
                  <input type="checkbox" [checked]="verticalesSel().has(v.valor)" (change)="toggleVertical(v.valor)"
                         style="accent-color:var(--c-accent);width:16px;height:16px" />
                  {{ v.label }}
                </label>
              }
            </div>
          </div>
          @if (onboardingError()) { <div class="rs-alert rs-alert--error">{{ onboardingError() }}</div> }
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="onboardingForm.invalid || creando()">
            {{ creando() ? 'Creando…' : 'Crear mi negocio' }}
          </button>
        </form>
      </div>
    </div>
  } @else {

  <div class="cl-layout">

    <!-- SIDEBAR -->
    <aside class="cl-sidebar">

      <!-- Brand -->
      <div class="cl-brand">
        <div class="cl-brand__icon">
          <rs-icon [name]="iconVertical(comercio()?.verticales?.[0] ?? '')" [size]="20" [stroke]="1.75"></rs-icon>
        </div>
        <div class="cl-brand__info">
          <div class="cl-brand__name">{{ comercio()?.nombreComercial ?? 'Mi comercio' }}</div>
          <span class="rs-badge {{ planBadge(comercio()?.plan ?? 'basico') }}">
            {{ (comercio()?.plan ?? 'básico') | titlecase }}
          </span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="cl-nav">
        @for (item of navItems; track item.ruta) {
          <a
            [routerLink]="item.ruta"
            routerLinkActive="cl-nav__item--active"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            class="cl-nav__item">
            <rs-icon [name]="item.icon" [size]="16" [stroke]="2"></rs-icon>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>

      <!-- Footer -->
      <div class="cl-sidebar__footer">
        <a routerLink="/" class="cl-nav__item" style="color:var(--t-400)">
          <rs-icon name="log-out" [size]="16" [stroke]="2"></rs-icon>
          <span>Volver al inicio</span>
        </a>
      </div>

    </aside>

    <!-- MAIN -->
    <main class="cl-main">
      <router-outlet />
    </main>

  </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }

    .cl-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: calc(100vh - 64px);
    }
    @media (max-width: 1024px) { .cl-layout { grid-template-columns: 1fr; } }

    .cl-sidebar {
      background: var(--c-card);
      border-right: 1px solid var(--b-1);
      padding: var(--sp-6);
      position: sticky;
      top: 64px;
      height: calc(100vh - 64px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    @media (max-width: 1024px) { .cl-sidebar { display: none; } }

    .cl-brand {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding-bottom: var(--sp-6);
      margin-bottom: var(--sp-4);
      border-bottom: 1px solid var(--b-1);
    }
    .cl-brand__icon {
      width: 40px;
      height: 40px;
      border-radius: var(--r-lg);
      background: var(--g-accent);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cl-brand__name {
      font-size: var(--f-sm);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-1);
      line-height: 1.3;
    }

    .cl-nav {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      flex: 1;
    }

    .cl-nav__item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg);
      color: var(--t-300);
      font-size: var(--f-sm);
      font-weight: var(--w-5);
      text-decoration: none;
      transition: all var(--d-2);
      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .cl-nav__item--active { background: var(--c-accent-lo); color: var(--c-accent); font-weight: var(--w-6); }

    .cl-sidebar__footer {
      padding-top: var(--sp-4);
      border-top: 1px solid var(--b-1);
      margin-top: auto;
    }

    .cl-main {
      padding: var(--sp-8);
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      min-width: 0;
    }
    @media (max-width: 768px) { .cl-main { padding: var(--sp-4); } }
  `],
})
export class ComercioLayoutComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly comercio = signal<MiComercio | null>(null);
  readonly navItems = NAV_ITEMS;
  readonly verticalesOpciones = VERTICALES_OPCIONES;

  readonly cargando = signal(true);
  readonly sinNegocio = signal(false);
  readonly creando = signal(false);
  readonly onboardingError = signal('');
  readonly verticalesSel = signal<Set<string>>(new Set(['alojamiento']));

  readonly onboardingForm = this.fb.group({
    nombreComercial: ['', Validators.required],
    razonSocial: ['', Validators.required],
    vatNumber: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.comercio.set(await firstValueFrom(this.comercioApi.getMiComercio()));
    } catch {
      // 404/403 = cuenta de comercio sin negocio vinculado → onboarding.
      this.sinNegocio.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  toggleVertical(v: string): void {
    this.verticalesSel.update((set) => {
      const copia = new Set(set);
      copia.has(v) ? copia.delete(v) : copia.add(v);
      return copia;
    });
  }

  async crearNegocio(): Promise<void> {
    if (this.onboardingForm.invalid) return;
    this.creando.set(true);
    this.onboardingError.set('');
    try {
      const v = this.onboardingForm.getRawValue();
      const resp = await firstValueFrom(this.comercioApi.onboarding({
        nombreComercial: v.nombreComercial!,
        razonSocial: v.razonSocial!,
        vatNumber: v.vatNumber!,
        verticales: [...this.verticalesSel()],
      }));
      // Token nuevo ya incluye el comercioId → el panel funciona sin re-login manual.
      this.authService.aplicarSesion(resp as never);
      this.sinNegocio.set(false);
      this.comercio.set(await firstValueFrom(this.comercioApi.getMiComercio()));
    } catch {
      this.onboardingError.set('No se pudo crear el negocio. ¿El CIF/NIF ya está registrado?');
    } finally {
      this.creando.set(false);
    }
  }

  iconVertical(v: string): string {
    return iconoVertical(v);
  }

  planBadge(plan: string): string {
    return PLAN_BADGE[plan] ?? 'rs-badge--neutral';
  }
}
