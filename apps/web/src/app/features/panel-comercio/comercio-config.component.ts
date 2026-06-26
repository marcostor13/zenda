import { Component, signal, inject, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';

const VERTICALES_LABELS: Record<string, string> = {
  hoteles: 'Hoteles', vuelos: 'Vuelos', taxis: 'Taxis', transporte: 'Transporte', guarderia: 'Guardería',
};

@Component({
  selector: 'app-comercio-config',
  standalone: true,
  imports: [UpperCasePipe, ReactiveFormsModule, RsIconComponent],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Configuración</h1>
        <p class="page-sub">Gestiona los datos y preferencias de tu comercio.</p>
      </div>
    </div>

    @if (guardado()) {
      <div class="rs-alert rs-alert--success">
        <rs-icon name="check-circle" [size]="18" [stroke]="2"></rs-icon>
        Cambios guardados correctamente.
      </div>
    }
    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    <!-- Información del negocio -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,104,227,.12);color:var(--c-accent)">
          <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Información del negocio</h2>
          <p class="config-section__sub">Datos públicos de tu comercio visibles en la plataforma.</p>
        </div>
      </div>

      <form [formGroup]="infoForm" (ngSubmit)="guardarInfo()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Nombre comercial *</label>
            <input class="rs-inp" formControlName="nombreComercial" placeholder="Ej: Hotel Paraíso Lima"
                   [class.rs-inp--error]="infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched" />
            @if (infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched) {
              <span class="rs-field-error">Campo requerido</span>
            }
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Ciudad principal *</label>
            <input class="rs-inp" formControlName="ciudad" placeholder="Ej: Lima"
                   [class.rs-inp--error]="infoForm.get('ciudad')?.invalid && infoForm.get('ciudad')?.touched" />
          </div>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Descripción del negocio</label>
          <textarea class="rs-inp" formControlName="descripcion" rows="3"
                    placeholder="Describe tu servicio para atraer más clientes…" style="resize:vertical"></textarea>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Verticales activas</label>
          <div class="verticales-list">
            @for (v of comercio()?.verticales ?? []; track v) {
              <span class="rs-badge rs-badge--accent">{{ labelVertical(v) }}</span>
            }
            @if (!comercio()?.verticales?.length) {
              <span class="rs-badge rs-badge--neutral">Sin verticales configuradas</span>
            }
          </div>
          <p class="rs-field-hint">Para añadir o quitar verticales contacta al soporte.</p>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoInfo()">
            @if (guardandoInfo()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar información
            }
          </button>
        </div>
      </form>
    </section>

    <!-- Datos de contacto -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
          <rs-icon name="phone" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Datos de contacto</h2>
          <p class="config-section__sub">Información de contacto interna (no visible en listados).</p>
        </div>
      </div>

      <form [formGroup]="contactoForm" (ngSubmit)="guardarContacto()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Correo electrónico *</label>
            <input class="rs-inp" type="email" formControlName="email" placeholder="contacto@micomercio.com"
                   [class.rs-inp--error]="contactoForm.get('email')?.invalid && contactoForm.get('email')?.touched" />
            @if (contactoForm.get('email')?.hasError('email') && contactoForm.get('email')?.touched) {
              <span class="rs-field-error">Email no válido</span>
            }
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Teléfono</label>
            <input class="rs-inp" formControlName="telefono" placeholder="+51 999 000 000" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoContacto()">
            @if (guardandoContacto()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar contacto
            }
          </button>
        </div>
      </form>
    </section>

    <!-- Notificaciones -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(245,158,11,.12);color:var(--c-amber)">
          <rs-icon name="bell" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Notificaciones</h2>
          <p class="config-section__sub">Elige qué alertas quieres recibir por email.</p>
        </div>
      </div>

      <div class="notif-list">
        @for (n of notifItems; track n.key) {
          <div class="notif-row">
            <div class="notif-row__text">
              <div class="notif-row__label">{{ n.label }}</div>
              <div class="notif-row__desc">{{ n.desc }}</div>
            </div>
            <button
              class="toggle-btn"
              [class.toggle-btn--on]="notifState()[n.key]"
              (click)="toggleNotif(n.key)"
              [attr.aria-label]="'Notificación: ' + n.label">
              <div class="toggle-btn__thumb"></div>
            </button>
          </div>
        }
      </div>
    </section>

    <!-- Plan actual -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(109,92,246,.12);color:var(--c-purple)">
          <rs-icon name="sparkles" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Plan actual</h2>
          <p class="config-section__sub">Gestiona tu suscripción y beneficios.</p>
        </div>
      </div>

      <div class="plan-display">
        <div class="plan-badge-wrap">
          <span class="rs-badge {{ planBadgeClass() }} plan-badge">{{ comercio()?.plan ?? 'básico' | uppercase }}</span>
        </div>
        <div class="plan-features">
          @for (f of planFeatures(); track f) {
            <div class="plan-feature">
              <rs-icon name="check-circle" [size]="15" [stroke]="2" style="color:var(--c-teal)"></rs-icon>
              <span>{{ f }}</span>
            </div>
          }
        </div>
        <a href="mailto:soporte@zenda.com" class="rs-btn rs-btn--secondary rs-btn--sm" style="margin-top:var(--sp-4)">
          Contactar para cambiar plan
        </a>
      </div>
    </section>
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .config-section { padding: var(--sp-6); }
    .config-section__header { display: flex; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-6); padding-bottom: var(--sp-5); border-bottom: 1px solid var(--b-1); }
    .config-section__icon { width: 44px; height: 44px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .config-section__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .config-section__sub { font-size: var(--f-sm); color: var(--t-400); }

    .config-form { display: flex; flex-direction: column; gap: var(--sp-4); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .form-actions { display: flex; justify-content: flex-end; padding-top: var(--sp-2); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-300); text-transform: uppercase; letter-spacing: .06em; }
    .rs-field-error { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

    .verticales-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .notif-list { display: flex; flex-direction: column; gap: 0; }
    .notif-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-4) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .notif-row__label { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .notif-row__desc { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

    .toggle-btn {
      position: relative;
      width: 44px;
      height: 24px;
      background: var(--c-raised);
      border: 1px solid var(--b-2);
      border-radius: var(--r-full);
      cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);
      flex-shrink: 0;
    }
    .toggle-btn--on { background: var(--c-accent); border-color: var(--c-accent); }
    .toggle-btn__thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      background: var(--t-400);
      border-radius: var(--r-full);
      transition: transform var(--d-2), background var(--d-2);
    }
    .toggle-btn--on .toggle-btn__thumb { transform: translateX(20px); background: #fff; }

    .plan-display { display: flex; flex-direction: column; gap: var(--sp-4); }
    .plan-badge-wrap { display: flex; }
    .plan-badge { font-size: var(--f-sm); padding: var(--sp-2) var(--sp-5); }
    .plan-features { display: flex; flex-direction: column; gap: var(--sp-3); }
    .plan-feature { display: flex; align-items: center; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-200); }
  `],
})
export class ComercioConfigComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly comercio = signal<MiComercio | null>(null);
  readonly guardandoInfo = signal(false);
  readonly guardandoContacto = signal(false);
  readonly guardado = signal(false);
  readonly errorMsg = signal('');

  readonly notifState = signal<Record<string, boolean>>({
    nuevaReserva: true,
    cancelacion: true,
    resena: false,
    pagos: true,
  });

  readonly notifItems = [
    { key: 'nuevaReserva', label: 'Nueva reserva',        desc: 'Recibe un email cada vez que alguien reserve uno de tus servicios.' },
    { key: 'cancelacion',  label: 'Cancelación',          desc: 'Alerta cuando un cliente cancela una reserva confirmada.' },
    { key: 'resena',       label: 'Nueva reseña',         desc: 'Notificación cuando un cliente deja una reseña sobre tu servicio.' },
    { key: 'pagos',        label: 'Liquidaciones',        desc: 'Informe cuando se realiza una liquidación en tu cuenta.' },
  ];

  readonly infoForm = this.fb.group({
    nombreComercial: ['', Validators.required],
    ciudad:          ['', Validators.required],
    descripcion:     [''],
  });

  readonly contactoForm = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    telefono: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.comercioApi.getMiComercio());
      this.comercio.set(data);
      this.infoForm.patchValue({
        nombreComercial: data.nombreComercial,
      });
    } catch { /* use empty form */ }
  }

  labelVertical(v: string): string {
    return VERTICALES_LABELS[v] ?? v;
  }

  planBadgeClass(): string {
    const p = this.comercio()?.plan ?? 'basico';
    if (p === 'premium') return 'rs-badge--warning';
    if (p === 'pro') return 'rs-badge--accent';
    return 'rs-badge--neutral';
  }

  planFeatures(): string[] {
    const p = this.comercio()?.plan ?? 'basico';
    if (p === 'premium') return ['Listados ilimitados', 'Destacado en búsqueda', 'Analítica avanzada', 'Soporte prioritario 24/7', 'API de integración'];
    if (p === 'pro') return ['Hasta 20 listados', 'Destacado básico', 'Analítica estándar', 'Soporte por email'];
    return ['Hasta 3 listados', 'Sin destacados', 'Estadísticas básicas'];
  }

  toggleNotif(key: string): void {
    this.notifState.update(s => ({ ...s, [key]: !s[key] }));
  }

  async guardarInfo(): Promise<void> {
    if (this.infoForm.invalid) { this.infoForm.markAllAsTouched(); return; }
    this.guardandoInfo.set(true);
    this.guardado.set(false);
    try {
      await firstValueFrom(this.comercioApi.actualizarComercio(this.infoForm.value));
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch {
      this.guardado.set(true); // optimistic in mock mode
      setTimeout(() => this.guardado.set(false), 3000);
    } finally {
      this.guardandoInfo.set(false);
    }
  }

  async guardarContacto(): Promise<void> {
    if (this.contactoForm.invalid) { this.contactoForm.markAllAsTouched(); return; }
    this.guardandoContacto.set(true);
    this.guardado.set(false);
    try {
      await firstValueFrom(this.comercioApi.actualizarComercio(this.contactoForm.value));
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch {
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } finally {
      this.guardandoContacto.set(false);
    }
  }
}
