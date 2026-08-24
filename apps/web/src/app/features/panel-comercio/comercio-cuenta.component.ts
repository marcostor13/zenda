import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ImpactoBajaComercioDto,
  MOTIVOS_BAJA_COMERCIO,
  MOTIVOS_BAJA_CON_DETALLE,
  MotivoBajaComercio,
  etiquetaMotivoBaja,
} from 'shared';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { mensajeDeError } from '../../shared/mensaje-error';
import { AuthService } from '../../core/auth/auth.service';

type Dialogo = 'pausar' | 'baja' | null;

/**
 * Estado de la cuenta del comercio: pausarla temporalmente o cerrarla.
 *
 * Vive fuera de `comercio-config` a propósito: esa pantalla es el recorrido de
 * alta y mide su progreso por pasos completados, así que meter ahí la zona de
 * peligro la contaría como un paso más del onboarding.
 */
@Component({
  selector: 'app-comercio-cuenta',
  standalone: true,
  imports: [DatePipe, RsIconComponent],
  template: `
    <header class="cabecera">
      <h1 class="titulo">Estado de la cuenta</h1>
      <p class="sub">Pausa tu negocio cuando lo necesites o cierra la cuenta definitivamente.</p>
    </header>

    @if (cargando()) {
      <div class="cargando">Cargando…</div>
    } @else if (comercio(); as c) {

      <!-- Estado actual -->
      <section class="rs-card bloque">
        <div class="estado">
          <span class="rs-badge {{ badgeEstado(c.estado) }}">{{ etiquetaEstado(c.estado) }}</span>
          <p class="estado__texto">{{ explicacionEstado(c.estado) }}</p>
        </div>

        @if (c.baja; as b) {
          <p class="motivo-previo">
            Último motivo registrado: <strong>{{ etiqueta(b.motivo) }}</strong>
            @if (b.comentario) { — “{{ b.comentario }}” }
            <span class="motivo-previo__fecha">({{ b.fecha | date: 'd MMM y' }})</span>
          </p>
        }
      </section>

      @if (mensaje()) {
        <div class="rs-alert rs-alert--success">{{ mensaje() }}</div>
      }
      @if (error()) {
        <div class="rs-alert rs-alert--error">{{ error() }}</div>
      }

      <!-- Pausa / reactivación -->
      <section class="rs-card bloque">
        <h2 class="bloque__titulo">
          <rs-icon name="clock" [size]="18" [stroke]="2"></rs-icon> Pausar temporalmente
        </h2>
        <p class="bloque__texto">
          Tu negocio deja de aparecer en el buscador y de recibir reservas nuevas. Conservas tus
          servicios, tu equipo, tus reseñas y todo tu historial. Puedes volver cuando quieras.
        </p>

        @if (c.estado === 'inactivo') {
          <button class="rs-btn rs-btn--primary" [disabled]="guardando()" (click)="reactivar()">
            {{ guardando() ? 'Reactivando…' : 'Reactivar mi cuenta' }}
          </button>
        } @else {
          <button class="rs-btn rs-btn--outline" [disabled]="guardando() || c.estado === 'suspendido'"
                  (click)="abrir('pausar')">
            Poner la cuenta en pausa
          </button>
        }
      </section>

      <!-- Baja -->
      <section class="rs-card bloque bloque--peligro">
        <h2 class="bloque__titulo">
          <rs-icon name="alert-circle" [size]="18" [stroke]="2"></rs-icon> Cerrar la cuenta
        </h2>
        <p class="bloque__texto">
          Tu negocio desaparece de Doogking y tu equipo pierde el acceso al panel. Conservamos las
          reservas y las facturas ya emitidas porque la ley nos obliga a guardarlas, pero nadie
          podrá encontrarte ni reservar contigo.
        </p>
        @if (impacto(); as i) {
          <ul class="impacto">
            <li><strong>{{ i.servicios }}</strong> servicios ({{ i.serviciosPublicados }} publicados)</li>
            <li><strong>{{ i.usuarios }}</strong> cuentas de tu equipo</li>
            <li><strong>{{ i.reservas }}</strong> reservas y <strong>{{ i.resenas }}</strong> reseñas en tu historial</li>
          </ul>
          @if (!i.puedeDarseDeBaja) {
            <div class="rs-alert rs-alert--warning">
              Tienes {{ i.reservasActivas }} reserva(s) en curso. Complétalas o cancélalas antes de
              cerrar la cuenta: no podemos dejar a esos clientes sin servicio.
            </div>
          }
        }
        <button class="rs-btn rs-btn--danger"
                [disabled]="guardando() || impacto()?.puedeDarseDeBaja === false"
                (click)="abrir('baja')">
          Quiero darme de baja
        </button>
      </section>
    }

    <!-- Diálogo: siempre pide el motivo. Una baja sin motivo es una métrica perdida. -->
    @if (dialogo()) {
      <div class="overlay" (click)="cerrar()">
        <div class="modal rs-card" (click)="$event.stopPropagation()">
          <h2 class="modal__titulo">
            {{ dialogo() === 'pausar' ? '¿Por qué pausas tu cuenta?' : '¿Por qué te vas?' }}
          </h2>
          <p class="modal__sub">
            Nos ayuda a mejorar y a saber si podemos hacer algo por ti antes de que te marches.
          </p>

          <div class="opciones">
            @for (m of motivos; track m.valor) {
              <label class="opcion" [class.opcion--activa]="motivo() === m.valor">
                <input type="radio" name="motivo" [value]="m.valor" [checked]="motivo() === m.valor"
                       (change)="motivo.set(m.valor)" />
                <span>{{ m.label }}</span>
              </label>
            }
          </div>

          <div class="rs-form-group">
            <label class="rs-label" for="comentario">
              Cuéntanos más {{ requiereDetalle() ? '(obligatorio)' : '(opcional)' }}
            </label>
            <textarea id="comentario" class="rs-input" rows="3" [value]="comentario()"
                      [placeholder]="requiereDetalle() ? 'Explícanos qué ha pasado' : 'Lo que quieras contarnos'"
                      (input)="comentario.set($any($event.target).value)"></textarea>
          </div>

          @if (dialogo() === 'pausar') {
            <div class="rs-form-group">
              <label class="rs-label" for="volver">¿Cuándo piensas volver? (opcional)</label>
              <input id="volver" type="date" class="rs-input" [value]="reactivarEl()"
                     (input)="reactivarEl.set($any($event.target).value)" />
            </div>
          } @else {
            <label class="contacto">
              <input type="checkbox" [checked]="aceptaContacto()"
                     (change)="aceptaContacto.set($any($event.target).checked)" />
              <span>Podéis escribirme para entender mejor mi decisión</span>
            </label>

            <div class="rs-form-group">
              <label class="rs-label" for="confirmacion">
                Escribe <strong>{{ comercio()?.nombreComercial }}</strong> para confirmar
              </label>
              <input id="confirmacion" class="rs-input" [value]="confirmacion()"
                     (input)="confirmacion.set($any($event.target).value)" />
            </div>
          }

          @if (errorModal()) {
            <div class="rs-alert rs-alert--error">{{ errorModal() }}</div>
          }

          <div class="modal__acciones">
            <button class="rs-btn rs-btn--ghost" (click)="cerrar()">Volver</button>
            <button class="rs-btn" [class.rs-btn--primary]="dialogo() === 'pausar'"
                    [class.rs-btn--danger]="dialogo() === 'baja'"
                    [disabled]="guardando() || !puedeConfirmar()" (click)="confirmar()">
              {{ guardando() ? 'Guardando…' : (dialogo() === 'pausar' ? 'Pausar cuenta' : 'Cerrar mi cuenta') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .cabecera { margin-bottom: var(--s-6); }
    .titulo { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--fw-extrabold); color: var(--text-primary); }
    .sub { color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--s-1); }
    .cargando { text-align: center; padding: var(--s-16); color: var(--text-muted); }

    .bloque { padding: var(--s-6); margin-bottom: var(--s-5); }
    .bloque__titulo { display: flex; align-items: center; gap: var(--s-2); font-family: var(--font-display);
      font-size: var(--text-lg); font-weight: var(--fw-bold); color: var(--text-primary); margin-bottom: var(--s-2); }
    .bloque__texto { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6; margin-bottom: var(--s-5); }
    .bloque--peligro { border: 1px solid var(--dk-divider); }

    .estado { display: flex; align-items: center; gap: var(--s-4); flex-wrap: wrap; }
    .estado__texto { color: var(--text-secondary); font-size: var(--text-sm); margin: 0; }
    .motivo-previo { margin-top: var(--s-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .motivo-previo__fecha { color: var(--text-muted); }

    .impacto { list-style: none; padding: var(--s-4); margin: 0 0 var(--s-5); border-radius: var(--r-lg);
      background: var(--c-surface); display: flex; flex-direction: column; gap: var(--s-2);
      font-size: var(--text-sm); color: var(--text-secondary); }
    .impacto strong { color: var(--text-primary); }

    .overlay { position: fixed; inset: 0; background: rgba(0, 19, 93, .45); display: flex;
      align-items: center; justify-content: center; padding: var(--s-4); z-index: 100; overflow-y: auto; }
    .modal { width: 100%; max-width: 520px; padding: var(--s-7); max-height: 90vh; overflow-y: auto; }
    .modal__titulo { font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--fw-bold);
      color: var(--text-primary); }
    .modal__sub { color: var(--text-secondary); font-size: var(--text-sm); margin: var(--s-2) 0 var(--s-5); }
    .modal__acciones { display: flex; gap: var(--s-3); justify-content: flex-end; margin-top: var(--s-6); }

    .opciones { display: flex; flex-direction: column; gap: var(--s-2); margin-bottom: var(--s-5); }
    .opcion { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4);
      border: 1px solid var(--dk-divider); border-radius: var(--r-lg); cursor: pointer;
      font-size: var(--text-sm); color: var(--text-secondary); transition: all var(--t-fast); }
    .opcion--activa { border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--text-primary); }

    .contacto { display: flex; gap: var(--s-3); align-items: center; font-size: var(--text-sm);
      color: var(--text-secondary); margin-bottom: var(--s-4); cursor: pointer; }
  `],
})
export class ComercioCuentaComponent implements OnInit {
  private readonly api = inject(ComercioApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly comercio = signal<MiComercio | null>(null);
  readonly impacto = signal<ImpactoBajaComercioDto | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly dialogo = signal<Dialogo>(null);
  readonly motivo = signal<string>(MOTIVOS_BAJA_COMERCIO[0].valor);
  readonly comentario = signal('');
  readonly reactivarEl = signal('');
  readonly confirmacion = signal('');
  readonly aceptaContacto = signal(false);
  readonly errorModal = signal('');

  readonly motivos = MOTIVOS_BAJA_COMERCIO;

  /** Algunos motivos no dicen nada por sí solos; ahí el detalle es obligatorio. */
  readonly requiereDetalle = computed(() =>
    MOTIVOS_BAJA_CON_DETALLE.includes(this.motivo() as MotivoBajaComercio),
  );

  readonly puedeConfirmar = computed(() => {
    if (this.requiereDetalle() && !this.comentario().trim()) return false;
    if (this.dialogo() !== 'baja') return true;
    const nombre = this.comercio()?.nombreComercial ?? '';
    return this.confirmacion().trim().toLowerCase() === nombre.trim().toLowerCase();
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [comercio, impacto] = await Promise.all([
        firstValueFrom(this.api.getMiComercio()),
        firstValueFrom(this.api.getImpactoCuenta()),
      ]);
      this.comercio.set(comercio);
      this.impacto.set(impacto);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar el estado de tu cuenta.'));
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(dialogo: Exclude<Dialogo, null>): void {
    this.dialogo.set(dialogo);
    this.motivo.set(MOTIVOS_BAJA_COMERCIO[0].valor);
    this.comentario.set('');
    this.reactivarEl.set('');
    this.confirmacion.set('');
    this.aceptaContacto.set(false);
    this.errorModal.set('');
  }

  cerrar(): void {
    this.dialogo.set(null);
  }

  async confirmar(): Promise<void> {
    if (!this.puedeConfirmar()) return;
    return this.dialogo() === 'pausar' ? this.pausar() : this.darDeBaja();
  }

  private async pausar(): Promise<void> {
    this.guardando.set(true);
    this.errorModal.set('');
    try {
      const actualizado = await firstValueFrom(
        this.api.pausarCuenta({
          motivo: this.motivo(),
          comentario: this.comentario().trim() || undefined,
          reactivarEl: this.reactivarEl() || undefined,
        }),
      );
      this.comercio.set(actualizado);
      this.dialogo.set(null);
      this.mensaje.set('Tu cuenta está en pausa. Puedes reactivarla cuando quieras desde aquí.');
    } catch (error) {
      this.errorModal.set(mensajeDeError(error, 'No se pudo pausar la cuenta.'));
    } finally {
      this.guardando.set(false);
    }
  }

  async reactivar(): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      this.comercio.set(await firstValueFrom(this.api.reactivarCuenta()));
      this.mensaje.set('Tu cuenta vuelve a estar activa y visible en el buscador.');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo reactivar la cuenta.'));
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Tras la baja la sesión ya no vale para nada: la cuenta queda desactivada en
   * el servidor, así que se cierra en el cliente y se vuelve a la home.
   */
  private async darDeBaja(): Promise<void> {
    this.guardando.set(true);
    this.errorModal.set('');
    try {
      await firstValueFrom(
        this.api.darDeBajaCuenta({
          motivo: this.motivo(),
          comentario: this.comentario().trim() || undefined,
          confirmacion: this.confirmacion().trim(),
          aceptaContacto: this.aceptaContacto(),
        }),
      );
      this.auth.logout();
      await this.router.navigate(['/'], { queryParams: { baja: 'comercio' } });
    } catch (error) {
      this.errorModal.set(mensajeDeError(error, 'No se pudo cerrar la cuenta.'));
    } finally {
      this.guardando.set(false);
    }
  }

  etiqueta(motivo: string): string {
    return etiquetaMotivoBaja(motivo);
  }

  etiquetaEstado(estado: string): string {
    const map: Record<string, string> = {
      activo: 'Activa',
      pendiente: 'Pendiente de aprobación',
      inactivo: 'En pausa',
      suspendido: 'Suspendida',
    };
    return map[estado] ?? estado;
  }

  explicacionEstado(estado: string): string {
    const map: Record<string, string> = {
      activo: 'Tu negocio aparece en el buscador y puede recibir reservas.',
      pendiente: 'Estamos revisando tu alta. Te avisaremos en cuanto esté aprobada.',
      inactivo: 'No apareces en el buscador ni recibes reservas nuevas. Nada se ha perdido.',
      suspendido: 'La plataforma ha suspendido tu cuenta. Escríbenos para revisar el caso.',
    };
    return map[estado] ?? '';
  }

  badgeEstado(estado: string): string {
    const map: Record<string, string> = {
      activo: 'rs-badge--success',
      pendiente: 'rs-badge--warning',
      inactivo: 'rs-badge--neutral',
      suspendido: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }
}
