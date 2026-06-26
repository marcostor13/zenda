import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const STORAGE_KEY = 'zenda_notif_prefs';

interface NotifPrefs {
  emailConfirmacion: boolean;
  emailMarketing: boolean;
  emailRecordatorio: boolean;
  whatsappAlertas: boolean;
  pushReservas: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  emailConfirmacion: true,
  emailMarketing: false,
  emailRecordatorio: true,
  whatsappAlertas: false,
  pushReservas: false,
};

interface NotifGroup {
  title: string;
  icon: string;
  items: Array<{ key: keyof NotifPrefs; label: string; sub: string; comingSoon?: boolean }>;
}

@Component({
  selector: 'app-perfil-notificaciones',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Notificaciones</h1>
      <p>Elige cómo y cuándo quieres recibir actualizaciones sobre tus reservas.</p>
    </div>

    <div class="notif-wrap">
      @for (grupo of grupos; track grupo.title) {
        <div class="rs-card notif-group">
          <div class="group-header">
            <div class="group-icon">
              <rs-icon [name]="grupo.icon" [size]="18" [stroke]="1.75"></rs-icon>
            </div>
            <h2>{{ grupo.title }}</h2>
          </div>

          @for (item of grupo.items; track item.key) {
            <div class="notif-row" [class.notif-row--disabled]="item.comingSoon">
              <div class="notif-row__info">
                <div class="notif-row__label">{{ item.label }}</div>
                <div class="notif-row__sub">
                  {{ item.sub }}
                  @if (item.comingSoon) {
                    <span class="rs-badge rs-badge--neutral" style="margin-left:var(--sp-2);font-size:10px">Próximamente</span>
                  }
                </div>
              </div>
              <button
                type="button"
                class="toggle-btn"
                [class.toggle-btn--on]="prefs()[item.key]"
                [disabled]="item.comingSoon ?? false"
                (click)="toggle(item.key)"
                [attr.aria-checked]="prefs()[item.key]">
                <span class="toggle-btn__thumb"></span>
              </button>
            </div>
          }
        </div>
      }

      @if (guardado()) {
        <div class="rs-alert rs-alert--success">✓ Preferencias guardadas.</div>
      }
    </div>

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-6); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    .page-header {
      margin-bottom: var(--sp-8);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .notif-wrap { display: flex; flex-direction: column; gap: var(--sp-5); max-width: 640px; }

    .notif-group { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4); }

    .group-header { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); h2 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }
    .group-icon {
      width: 36px; height: 36px; border-radius: var(--r-lg);
      background: var(--c-accent-lo); display: flex; align-items: center; justify-content: center;
      color: var(--c-accent);
    }

    .notif-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
      padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1);
      &:last-child { border-bottom: none; padding-bottom: 0; }
    }
    .notif-row--disabled { opacity: .5; }
    .notif-row__info { flex: 1; }
    .notif-row__label { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .notif-row__sub { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }

    .toggle-btn {
      position: relative; width: 44px; height: 24px;
      border-radius: var(--r-full); border: none; cursor: pointer;
      background: var(--b-2); transition: background var(--d-2);
      flex-shrink: 0;
      &:disabled { cursor: not-allowed; }
    }
    .toggle-btn--on { background: var(--c-accent); }
    .toggle-btn__thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; transition: transform var(--d-2);
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .toggle-btn--on .toggle-btn__thumb { transform: translateX(20px); }
  `],
})
export class PerfilNotificacionesComponent implements OnInit {
  readonly prefs = signal<NotifPrefs>({ ...DEFAULT_PREFS });
  readonly guardado = signal(false);

  readonly grupos: NotifGroup[] = [
    {
      title: 'Email',
      icon: 'mail',
      items: [
        { key: 'emailConfirmacion', label: 'Confirmaciones de reserva', sub: 'Recibe el comprobante en tu correo al confirmar.' },
        { key: 'emailRecordatorio', label: 'Recordatorios', sub: 'Te avisamos 24h antes de tu check-in o servicio.' },
        { key: 'emailMarketing', label: 'Novedades y ofertas', sub: 'Promociones y recomendaciones personalizadas.' },
      ],
    },
    {
      title: 'WhatsApp',
      icon: 'phone',
      items: [
        { key: 'whatsappAlertas', label: 'Alertas por WhatsApp', sub: 'Confirmaciones y cambios de estado vía WhatsApp.', comingSoon: true },
      ],
    },
    {
      title: 'Push (app móvil)',
      icon: 'smartphone',
      items: [
        { key: 'pushReservas', label: 'Notificaciones push', sub: 'Alertas instantáneas en la app móvil.', comingSoon: true },
      ],
    },
  ];

  ngOnInit(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.prefs.set({ ...DEFAULT_PREFS, ...JSON.parse(stored) as Partial<NotifPrefs> });
      } catch { /* invalid JSON — use defaults */ }
    }
  }

  toggle(key: keyof NotifPrefs): void {
    this.prefs.update(p => ({ ...p, [key]: !p[key] }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs()));
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 2000);
  }
}
