import { Component, signal, inject, OnInit, WritableSignal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { ComercioApiService, MiComercio, ActualizarPerfilComercioPayload, HorarioDia } from './comercio-api.service';

const DIAS: ReadonlyArray<{ clave: string; label: string }> = [
  { clave: 'lunes', label: 'Lunes' },
  { clave: 'martes', label: 'Martes' },
  { clave: 'miercoles', label: 'Miércoles' },
  { clave: 'jueves', label: 'Jueves' },
  { clave: 'viernes', label: 'Viernes' },
  { clave: 'sabado', label: 'Sábado' },
  { clave: 'domingo', label: 'Domingo' },
];

const VERIFICACION_BADGE: Record<string, string> = {
  sin_verificar: 'rs-badge--neutral',
  pendiente: 'rs-badge--warning',
  verificado: 'rs-badge--success',
  rechazado: 'rs-badge--error',
};

const VERIFICACION_LABEL: Record<string, string> = {
  sin_verificar: 'Sin verificar',
  pendiente: 'En revisión',
  verificado: 'Verificado',
  rechazado: 'Rechazado',
};

function primero(arr: string[]): string | undefined {
  return arr[0] || undefined;
}
function comoArray(v?: string): string[] {
  return v ? [v] : [];
}

@Component({
  selector: 'app-comercio-config',
  standalone: true,
  imports: [UpperCasePipe, ReactiveFormsModule, RsIconComponent, RsImageUploadComponent],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Perfil del comercio</h1>
        <p class="page-sub">Completa todos los datos de tu negocio: cuanta más información, más confianza generas ante los clientes.</p>
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
          <p class="config-section__sub">Datos públicos de tu comercio, visibles en tus listados y en tu perfil.</p>
        </div>
      </div>

      <form [formGroup]="infoForm" (ngSubmit)="guardarInfo()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Nombre comercial *</label>
          <input class="rs-inp" formControlName="nombreComercial" placeholder="Ej: Residencia Canina Villa Perruna"
                 [class.rs-inp--error]="infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched" />
          @if (infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched) {
            <span class="rs-field-error">Campo requerido</span>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Descripción del negocio</label>
          <textarea class="rs-inp" formControlName="descripcion" rows="3"
                    placeholder="Describe tu negocio, tu experiencia y lo que lo hace especial…" style="resize:vertical"></textarea>
        </div>

        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Logo</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="logoUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Imagen de portada</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="coverUrl"></rs-image-upload>
          </div>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Galería de fotos</label>
          <rs-image-upload [multiple]="true" [maxFiles]="10" formControlName="galeria"></rs-image-upload>
          <span class="rs-field-hint">Muestra tus instalaciones, equipo y trabajo realizado.</span>
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

    <!-- Ubicación -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(16,185,129,.12);color:var(--c-success, #10B981)">
          <rs-icon name="map-pin" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Ubicación</h2>
          <p class="config-section__sub">Dirección desde la que operas o atiendes a tus clientes.</p>
        </div>
      </div>

      <form [formGroup]="direccionForm" (ngSubmit)="guardarDireccion()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Calle</label>
            <input class="rs-inp" formControlName="calle" placeholder="Ej: Calle Mayor" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Número</label>
            <input class="rs-inp" formControlName="numero" placeholder="Ej: 24, 2ºB" />
          </div>
        </div>
        <div class="form-row form-row--3">
          <div class="rs-field">
            <label class="rs-lbl">Ciudad</label>
            <input class="rs-inp" formControlName="ciudad" placeholder="Ej: Madrid" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Provincia</label>
            <input class="rs-inp" formControlName="provincia" placeholder="Ej: Madrid" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Código postal</label>
            <input class="rs-inp" formControlName="codigoPostal" placeholder="Ej: 28013" />
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">País</label>
          <input class="rs-inp" formControlName="pais" placeholder="España" />
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoDireccion()">
            @if (guardandoDireccion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar ubicación
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
          <p class="config-section__sub">Información de contacto interna (no visible públicamente en los listados).</p>
        </div>
      </div>

      <form [formGroup]="contactoForm" (ngSubmit)="guardarContacto()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Persona de contacto</label>
            <input class="rs-inp" formControlName="nombreContacto" placeholder="Nombre y apellidos" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Correo electrónico *</label>
            <input class="rs-inp" type="email" formControlName="email" placeholder="contacto@micomercio.com"
                   [class.rs-inp--error]="contactoForm.get('email')?.invalid && contactoForm.get('email')?.touched" />
            @if (contactoForm.get('email')?.hasError('email') && contactoForm.get('email')?.touched) {
              <span class="rs-field-error">Email no válido</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Teléfono</label>
            <input class="rs-inp" formControlName="telefono" placeholder="+34 600 000 000" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">WhatsApp</label>
            <input class="rs-inp" formControlName="whatsapp" placeholder="+34 600 000 000" />
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

    <!-- Redes y web -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(109,92,246,.12);color:var(--c-purple)">
          <rs-icon name="globe" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Redes sociales y web</h2>
          <p class="config-section__sub">Enlaces visibles en tu perfil público.</p>
        </div>
      </div>

      <form [formGroup]="redesForm" (ngSubmit)="guardarRedes()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Sitio web</label>
          <input class="rs-inp" formControlName="sitioWeb" placeholder="https://miweb.com" />
        </div>
        <div class="form-row form-row--3">
          <div class="rs-field">
            <label class="rs-lbl">Instagram</label>
            <input class="rs-inp" formControlName="instagram" placeholder="@usuario" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Facebook</label>
            <input class="rs-inp" formControlName="facebook" placeholder="facebook.com/miempresa" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">TikTok</label>
            <input class="rs-inp" formControlName="tiktok" placeholder="@usuario" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoRedes()">
            @if (guardandoRedes()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar enlaces
            }
          </button>
        </div>
      </form>
    </section>

    <!-- Horario de atención -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(245,158,11,.12);color:var(--c-amber)">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Horario de atención</h2>
          <p class="config-section__sub">Indica tus horas de apertura por día.</p>
        </div>
      </div>

      <form [formGroup]="horarioForm" (ngSubmit)="guardarHorario()" class="config-form">
        <div formArrayName="dias" class="horario-list">
          @for (dia of diasControls; track dia; let i = $index) {
            <div [formGroupName]="i" class="horario-row">
              <span class="horario-row__label">{{ dias[i].label }}</span>
              <label class="rs-checkbox">
                <input type="checkbox" formControlName="cerrado" (change)="onCerradoChange(i)"> Cerrado
              </label>
              <input class="rs-inp rs-inp--time" type="time" formControlName="abre">
              <span class="horario-row__sep">—</span>
              <input class="rs-inp rs-inp--time" type="time" formControlName="cierra">
            </div>
          }
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoHorario()">
            @if (guardandoHorario()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar horario
            }
          </button>
        </div>
      </form>
    </section>

    <!-- Políticas y datos bancarios -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(239,68,68,.10);color:#B91C1C">
          <rs-icon name="shield-check" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Políticas y cobros</h2>
          <p class="config-section__sub">Política de cancelación y cuenta donde recibirás tus liquidaciones.</p>
        </div>
      </div>

      <form [formGroup]="politicasForm" (ngSubmit)="guardarPoliticas()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Política de cancelación por defecto</label>
          <select class="rs-inp" formControlName="politicaCancelacion">
            <option value="">— Sin especificar —</option>
            <option value="flexible">Flexible</option>
            <option value="moderada">Moderada</option>
            <option value="estricta">Estricta</option>
          </select>
        </div>

        <div class="rs-hr"></div>

        <div class="rs-field">
          <label class="rs-lbl">Titular de la cuenta</label>
          <input class="rs-inp" formControlName="titular" placeholder="Nombre del titular" />
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">IBAN</label>
            <input class="rs-inp" formControlName="iban" placeholder="ES00 0000 0000 0000 0000 0000" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Banco</label>
            <input class="rs-inp" formControlName="banco" placeholder="Nombre del banco" />
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">SWIFT / BIC</label>
          <input class="rs-inp" formControlName="swift" placeholder="Opcional" />
        </div>
        <p class="rs-field-hint">Estos datos sólo se usan para tus liquidaciones y nunca se muestran públicamente.</p>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoPoliticas()">
            @if (guardandoPoliticas()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar políticas y cobros
            }
          </button>
        </div>
      </form>
    </section>

    <!-- Verificación de identidad -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,163,74,.12);color:#16A34A">
          <rs-icon name="badge-check" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Verificación de identidad</h2>
          <p class="config-section__sub">Sube tus documentos para obtener la insignia de comercio verificado.</p>
        </div>
        <span class="rs-badge {{ verificacionBadge() }}" style="margin-left:auto">{{ verificacionLabel() }}</span>
      </div>

      <form [formGroup]="verificacionForm" (ngSubmit)="guardarVerificacion()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Documento de identidad del titular</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="documentoIdentidadUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Licencia o registro del negocio</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="licenciaNegocioUrl"></rs-image-upload>
          </div>
        </div>
        <p class="rs-field-hint">Nuestro equipo revisará tus documentos en un plazo de 24–48 horas.</p>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoVerificacion()">
            @if (guardandoVerificacion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Enviar para verificación
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

    <!-- Verticales activas -->
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,104,227,.12);color:var(--c-accent)">
          <rs-icon name="tag" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Verticales activas</h2>
          <p class="config-section__sub">Categorías de servicio en las que puedes publicar listados.</p>
        </div>
      </div>

      <div class="verticales-list">
        @for (v of comercio()?.verticales ?? []; track v) {
          <span class="rs-badge rs-badge--accent">{{ labelVertical(v) }}</span>
        }
        @if (!comercio()?.verticales?.length) {
          <span class="rs-badge rs-badge--neutral">Sin verticales configuradas</span>
        }
      </div>
      <p class="rs-field-hint">Para añadir o quitar verticales contacta al soporte.</p>
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
        <a href="mailto:soporte@doogking.com" class="rs-btn rs-btn--secondary rs-btn--sm" style="margin-top:var(--sp-4)">
          Contactar para cambiar plan
        </a>
      </div>
    </section>
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 60ch; }

    .config-section { padding: var(--sp-6); }
    .config-section__header { display: flex; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-6); padding-bottom: var(--sp-5); border-bottom: 1px solid var(--b-1); }
    .config-section__icon { width: 44px; height: 44px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .config-section__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .config-section__sub { font-size: var(--f-sm); color: var(--t-400); }

    .config-form { display: flex; flex-direction: column; gap: var(--sp-4); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .form-row--3 { grid-template-columns: 1fr 1fr 1fr; @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .form-actions { display: flex; justify-content: flex-end; padding-top: var(--sp-2); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-300); text-transform: uppercase; letter-spacing: .06em; }
    .rs-field-error { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .rs-hr { border-top: 1px solid var(--b-1); margin: var(--sp-2) 0; }

    .rs-checkbox { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; white-space: nowrap; }
    .rs-checkbox input { accent-color: var(--c-accent); width: 16px; height: 16px; }

    .verticales-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .horario-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .horario-row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .horario-row__label { width: 90px; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); flex-shrink: 0; }
    .horario-row__sep { color: var(--t-400); }
    .rs-inp--time { width: 130px; padding: var(--sp-2) var(--sp-3); }

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
  readonly guardado = signal(false);
  readonly errorMsg = signal('');

  readonly guardandoInfo = signal(false);
  readonly guardandoDireccion = signal(false);
  readonly guardandoContacto = signal(false);
  readonly guardandoRedes = signal(false);
  readonly guardandoHorario = signal(false);
  readonly guardandoPoliticas = signal(false);
  readonly guardandoVerificacion = signal(false);

  readonly dias = DIAS;

  readonly notifState = signal<Record<string, boolean>>({
    nuevaReserva: true,
    cancelacion: true,
    resena: false,
    pagos: true,
  });

  readonly notifItems = [
    { key: 'nuevaReserva', label: 'Nueva reserva',  desc: 'Recibe un email cada vez que alguien reserve uno de tus servicios.' },
    { key: 'cancelacion',  label: 'Cancelación',    desc: 'Alerta cuando un cliente cancela una reserva confirmada.' },
    { key: 'resena',       label: 'Nueva reseña',   desc: 'Notificación cuando un cliente deja una reseña sobre tu servicio.' },
    { key: 'pagos',        label: 'Liquidaciones',  desc: 'Informe cuando se realiza una liquidación en tu cuenta.' },
  ];

  readonly infoForm = this.fb.group({
    nombreComercial: ['', Validators.required],
    descripcion: [''],
    logoUrl: [[] as string[]],
    coverUrl: [[] as string[]],
    galeria: [[] as string[]],
  });

  readonly direccionForm = this.fb.group({
    calle: [''], numero: [''], ciudad: [''], provincia: [''], codigoPostal: [''], pais: ['España'],
  });

  readonly contactoForm = this.fb.group({
    nombreContacto: [''],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    whatsapp: [''],
  });

  readonly redesForm = this.fb.group({
    sitioWeb: [''], instagram: [''], facebook: [''], tiktok: [''],
  });

  readonly horarioForm = this.fb.group({
    dias: this.fb.array(DIAS.map(d => this.fb.group({
      dia: [d.clave],
      abre: ['09:00'],
      cierra: ['18:00'],
      cerrado: [false],
    }))),
  });

  readonly politicasForm = this.fb.group({
    politicaCancelacion: [''],
    titular: [''], iban: [''], banco: [''], swift: [''],
  });

  readonly verificacionForm = this.fb.group({
    documentoIdentidadUrl: [[] as string[]],
    licenciaNegocioUrl: [[] as string[]],
  });

  get diasControls() {
    return this.horarioForm.controls.dias.controls;
  }

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.comercioApi.getMiComercio());
      this.aplicarDatos(data);
    } catch { /* usa formularios vacíos */ }
  }

  private aplicarDatos(data: MiComercio): void {
    this.comercio.set(data);

    this.infoForm.patchValue({
      nombreComercial: data.nombreComercial,
      descripcion: data.descripcion ?? '',
      logoUrl: comoArray(data.logoUrl),
      coverUrl: comoArray(data.coverUrl),
      galeria: data.galeria ?? [],
    });

    this.direccionForm.patchValue({
      calle: data.direccion?.calle ?? '',
      numero: data.direccion?.numero ?? '',
      ciudad: data.direccion?.ciudad ?? '',
      provincia: data.direccion?.provincia ?? '',
      codigoPostal: data.direccion?.codigoPostal ?? '',
      pais: data.direccion?.pais ?? 'España',
    });

    this.contactoForm.patchValue({
      nombreContacto: data.contacto?.nombreContacto ?? '',
      email: data.contacto?.email ?? '',
      telefono: data.contacto?.telefono ?? '',
      whatsapp: data.contacto?.whatsapp ?? '',
    });

    this.redesForm.patchValue({
      sitioWeb: data.sitioWeb ?? '',
      instagram: data.redesSociales?.instagram ?? '',
      facebook: data.redesSociales?.facebook ?? '',
      tiktok: data.redesSociales?.tiktok ?? '',
    });

    if (data.horario?.length) {
      const porDia = new Map(data.horario.map(h => [h.dia, h]));
      this.diasControls.forEach((ctrl, i) => {
        const h = porDia.get(DIAS[i].clave);
        if (h) ctrl.patchValue({ abre: h.abre ?? '09:00', cierra: h.cierra ?? '18:00', cerrado: h.cerrado });
      });
    }

    this.politicasForm.patchValue({
      politicaCancelacion: data.politicaCancelacion ?? '',
      titular: data.datosBancarios?.titular ?? '',
      iban: data.datosBancarios?.iban ?? '',
      banco: data.datosBancarios?.banco ?? '',
      swift: data.datosBancarios?.swift ?? '',
    });

    this.verificacionForm.patchValue({
      documentoIdentidadUrl: comoArray(data.verificacion?.documentoIdentidadUrl),
      licenciaNegocioUrl: comoArray(data.verificacion?.licenciaNegocioUrl),
    });

    if (data.preferenciasNotificacion) {
      this.notifState.set({ ...data.preferenciasNotificacion });
    }
  }

  labelVertical(v: string): string {
    return VERTICAL_LABELS[v as VerticalKey] ?? v;
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

  verificacionBadge(): string {
    return VERIFICACION_BADGE[this.comercio()?.verificacion?.estado ?? 'sin_verificar'];
  }

  verificacionLabel(): string {
    return VERIFICACION_LABEL[this.comercio()?.verificacion?.estado ?? 'sin_verificar'];
  }

  onCerradoChange(i: number): void {
    const ctrl = this.diasControls[i];
    if (ctrl.get('cerrado')?.value) {
      ctrl.patchValue({ abre: '', cierra: '' });
    }
  }

  toggleNotif(key: string): void {
    this.notifState.update(s => ({ ...s, [key]: !s[key] }));
    void this.guardarSeccion({ preferenciasNotificacion: this.notifState() as unknown as MiComercio['preferenciasNotificacion'] }, signal(false));
  }

  private async guardarSeccion(
    payload: ActualizarPerfilComercioPayload,
    guardando: WritableSignal<boolean>,
  ): Promise<void> {
    guardando.set(true);
    this.guardado.set(false);
    this.errorMsg.set('');
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarComercio(payload));
      this.comercio.set(actualizado);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar los cambios. Intenta de nuevo.');
      setTimeout(() => this.errorMsg.set(''), 4000);
    } finally {
      guardando.set(false);
    }
  }

  async guardarInfo(): Promise<void> {
    if (this.infoForm.invalid) { this.infoForm.markAllAsTouched(); return; }
    const v = this.infoForm.getRawValue();
    await this.guardarSeccion({
      nombreComercial: v.nombreComercial,
      descripcion: v.descripcion,
      logoUrl: primero(v.logoUrl),
      coverUrl: primero(v.coverUrl),
      galeria: v.galeria,
    }, this.guardandoInfo);
  }

  async guardarDireccion(): Promise<void> {
    await this.guardarSeccion({ direccion: this.direccionForm.getRawValue() }, this.guardandoDireccion);
  }

  async guardarContacto(): Promise<void> {
    if (this.contactoForm.invalid) { this.contactoForm.markAllAsTouched(); return; }
    await this.guardarSeccion({ contacto: this.contactoForm.getRawValue() }, this.guardandoContacto);
  }

  async guardarRedes(): Promise<void> {
    const v = this.redesForm.getRawValue();
    await this.guardarSeccion({
      sitioWeb: v.sitioWeb,
      redesSociales: { instagram: v.instagram, facebook: v.facebook, tiktok: v.tiktok },
    }, this.guardandoRedes);
  }

  async guardarHorario(): Promise<void> {
    const horario: HorarioDia[] = this.diasControls.map(ctrl => ctrl.getRawValue());
    await this.guardarSeccion({ horario }, this.guardandoHorario);
  }

  async guardarPoliticas(): Promise<void> {
    const v = this.politicasForm.getRawValue();
    await this.guardarSeccion({
      politicaCancelacion: (v.politicaCancelacion || undefined) as MiComercio['politicaCancelacion'],
      datosBancarios: { titular: v.titular, iban: v.iban, banco: v.banco, swift: v.swift },
    }, this.guardandoPoliticas);
  }

  async guardarVerificacion(): Promise<void> {
    const v = this.verificacionForm.getRawValue();
    await this.guardarSeccion({
      documentoIdentidadUrl: primero(v.documentoIdentidadUrl),
      licenciaNegocioUrl: primero(v.licenciaNegocioUrl),
    }, this.guardandoVerificacion);
  }
}
