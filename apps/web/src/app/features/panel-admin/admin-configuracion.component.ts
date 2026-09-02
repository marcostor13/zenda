import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  TIPO_AVISO_DESTINATARIO, TIPO_AVISO_LABELS, TipoAviso,
  VERTICAL_LABELS, VerticalKey,
} from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

interface CanalesAviso {
  email: boolean;
  plataforma: boolean;
  push: boolean;
}

interface ConfiguracionPlataforma {
  notificaciones: Record<string, CanalesAviso>;
  nombrePlataforma: string;
  emailSoporte: string;
  telefonoSoporte?: string;
  diasAvisoCaducidad: number;
  verticalesActivos: string[];
  modoMantenimiento: boolean;
  mensajeMantenimiento?: string;
}

const CANALES: ReadonlyArray<{ clave: keyof CanalesAviso; label: string; nota?: string }> = [
  { clave: 'email', label: 'Email' },
  { clave: 'plataforma', label: 'En la plataforma' },
  { clave: 'push', label: 'Push', nota: 'cuando esté disponible' },
];

/**
 * Ajustes globales de Doogking (TCK-8040 §6 y §8): qué avisos se mandan y por
 * qué canal, y los parámetros generales de funcionamiento.
 */
@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [
    TraducirPipe, RsIconComponent
  ],
  template: `
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">{{ 'Configuración de la plataforma' | t }}</h1>
        <p class="rs-page-sub">{{ 'Avisos automáticos y parámetros generales de Doogking.' | t }}</p>
      </div>
      <button class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="guardando()" (click)="guardar()">
        <rs-icon name="save" [size]="14" [stroke]="2"></rs-icon>
        {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>

    @if (okMsg()) {
      <div class="rs-alert rs-alert--success">
        <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> {{ okMsg() }}
      </div>
    }
    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    @if (cargando()) {
      <p style="color:var(--t-400)">{{ 'Cargando la configuración…' | t }}</p>
    } @else if (config(); as c) {
      <!-- Avisos automáticos (TCK-8040 §6) -->
      <div class="rs-card panel">
        <h3 class="panel__titulo">{{ 'Avisos automáticos' | t }}</h3>
        <p class="panel__nota">
          {{ 'Qué se comunica y por dónde. Desactivar un aviso deja de enviarlo a todos los destinatarios de esa fila.' | t }}
        </p>

        <div class="avisos">
          <div class="avisos__head">
            <span>{{ 'Aviso' | t }}</span>
            <span>{{ 'A quién' | t }}</span>
            @for (canal of canales; track canal.clave) {
              <span>{{ canal.label | t }}</span>
            }
          </div>
          @for (aviso of avisos; track aviso.tipo) {
            <div class="avisos__row">
              <span class="avisos__nombre">{{ aviso.label | t }}</span>
              <span class="avisos__destino">{{ aviso.destinatario }}</span>
              @for (canal of canales; track canal.clave) {
                <label class="avisos__check">
                  <input type="checkbox"
                         [checked]="canalActivo(aviso.tipo, canal.clave)"
                         (change)="alternarCanal(aviso.tipo, canal.clave)" />
                  <span class="avisos__check-label">{{ canal.label | t }}</span>
                </label>
              }
            </div>
          }
        </div>
      </div>

      <!-- Parámetros generales (TCK-8040 §8) -->
      <div class="rs-card panel">
        <h3 class="panel__titulo">{{ 'Parámetros generales' | t }}</h3>

        <div class="form-grid">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Nombre de la plataforma' | t }}</label>
            <input class="rs-inp" [value]="c.nombrePlataforma"
                   (input)="editar('nombrePlataforma', $any($event.target).value)" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Email de soporte' | t }}</label>
            <input class="rs-inp" type="email" [value]="c.emailSoporte"
                   (input)="editar('emailSoporte', $any($event.target).value)" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Teléfono de soporte' | t }}</label>
            <input class="rs-inp" [value]="c.telefonoSoporte ?? ''"
                   (input)="editar('telefonoSoporte', $any($event.target).value)" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Avisar de documentación que caduca (días antes)' | t }}</label>
            <input class="rs-inp" type="number" min="1" [value]="c.diasAvisoCaducidad"
                   (input)="editar('diasAvisoCaducidad', +$any($event.target).value)" />
          </div>
        </div>

        <div class="rs-form-group">
          <label class="rs-label">{{ 'Verticales abiertos al público' | t }}</label>
          <p class="panel__nota">{{ 'Un vertical desactivado deja de ofrecerse, sin borrar nada.' | t }}</p>
          <div class="verticales">
            @for (v of verticales; track v.valor) {
              <label class="vertical">
                <input type="checkbox" [checked]="verticalActivo(v.valor)"
                       (change)="alternarVertical(v.valor)" />
                {{ v.label | t }}
              </label>
            }
          </div>
        </div>

        <div class="rs-form-group">
          <label class="mantenimiento">
            <input type="checkbox" [checked]="c.modoMantenimiento"
                   (change)="editar('modoMantenimiento', !c.modoMantenimiento)" />
            <span>
              <strong>{{ 'Modo mantenimiento' | t }}</strong>
              <em>{{ 'El público ve un aviso; el panel de administración sigue accesible.' | t }}</em>
            </span>
          </label>
          @if (c.modoMantenimiento) {
            <input class="rs-inp" [value]="c.mensajeMantenimiento ?? ''"
                   (input)="editar('mensajeMantenimiento', $any($event.target).value)"
                   [placeholder]="'Mensaje que verá el público' | t" />
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .panel { padding: var(--sp-6); }
    .panel__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .panel__nota { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); max-width: 70ch; }

    .avisos { background: var(--c-raised); border-radius: var(--r-xl); overflow: hidden; }
    .avisos__head, .avisos__row {
      display: grid; grid-template-columns: 1.4fr 1fr 110px 150px 110px; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1);
    }
    .avisos__head { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .avisos__row:last-child { border-bottom: none; }
    .avisos__nombre { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .avisos__destino { font-size: var(--f-xs); color: var(--t-400); }
    .avisos__check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; }
    .avisos__check-label { display: none; font-size: var(--f-xs); color: var(--t-400); }

    @media (max-width: 860px) {
      .avisos__head { display: none; }
      .avisos__row { grid-template-columns: 1fr; gap: var(--sp-2); border-bottom: 6px solid var(--c-base); }
      .avisos__check-label { display: inline; }
    }

    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--sp-4); margin-bottom: var(--sp-4); }
    .verticales { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
    .vertical { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; }
    .mantenimiento { display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; margin-bottom: var(--sp-3); }
    .mantenimiento span { display: flex; flex-direction: column; gap: 2px; }
    .mantenimiento strong { font-size: var(--f-sm); color: var(--t-100); }
    .mantenimiento em { font-size: var(--f-xs); color: var(--t-400); font-style: normal; }
  `],
})
export class AdminConfiguracionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion`;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly okMsg = signal('');
  readonly errorMsg = signal('');
  readonly config = signal<ConfiguracionPlataforma | null>(null);

  readonly canales = CANALES;
  readonly avisos = Object.values(TipoAviso).map((tipo) => ({
    tipo,
    label: TIPO_AVISO_LABELS[tipo],
    destinatario: TIPO_AVISO_DESTINATARIO[tipo],
  }));
  readonly verticales = Object.values(VerticalKey).map((valor) => ({
    valor,
    label: VERTICAL_LABELS[valor] ?? valor,
  }));

  async ngOnInit(): Promise<void> {
    try {
      this.config.set(await firstValueFrom(this.http.get<ConfiguracionPlataforma>(this.url)));
    } catch {
      this.errorMsg.set('Error cargando la configuración. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Un aviso sin fila guardada se considera activo por email, como antes. */
  canalActivo(tipo: string, canal: keyof CanalesAviso): boolean {
    const fila = this.config()?.notificaciones?.[tipo];
    if (!fila) return canal !== 'push';
    return fila[canal];
  }

  alternarCanal(tipo: string, canal: keyof CanalesAviso): void {
    this.config.update((c) => {
      if (!c) return c;
      const fila = c.notificaciones?.[tipo] ?? { email: true, plataforma: true, push: false };
      return {
        ...c,
        notificaciones: { ...c.notificaciones, [tipo]: { ...fila, [canal]: !fila[canal] } },
      };
    });
  }

  verticalActivo(vertical: string): boolean {
    return this.config()?.verticalesActivos?.includes(vertical) ?? false;
  }

  alternarVertical(vertical: string): void {
    this.config.update((c) => {
      if (!c) return c;
      const activos = c.verticalesActivos ?? [];
      return {
        ...c,
        verticalesActivos: activos.includes(vertical)
          ? activos.filter((v) => v !== vertical)
          : [...activos, vertical],
      };
    });
  }

  editar<K extends keyof ConfiguracionPlataforma>(campo: K, valor: ConfiguracionPlataforma[K]): void {
    this.config.update((c) => (c ? { ...c, [campo]: valor } : c));
  }

  async guardar(): Promise<void> {
    const config = this.config();
    if (!config) return;
    this.guardando.set(true);
    this.errorMsg.set('');
    this.okMsg.set('');
    try {
      this.config.set(await firstValueFrom(this.http.put<ConfiguracionPlataforma>(this.url, config)));
      this.okMsg.set('Configuración guardada correctamente.');
      setTimeout(() => this.okMsg.set(''), 3000);
    } catch {
      this.errorMsg.set('No se pudo guardar la configuración.');
    } finally {
      this.guardando.set(false);
    }
  }
}
