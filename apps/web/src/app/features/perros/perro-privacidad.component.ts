import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  HISTORIAL_ORIGEN, TIPO_HISTORIAL_LABELS, TipoHistorial, VERTICAL_LABELS, VerticalKey,
} from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ConsentimientoApi, PerroApi, PerrosService } from './perros.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Matriz de privacidad de la ficha (HU-016): qué tipo de historial puede leer
 * cada categoría de servicio.
 *
 * La regla por defecto —cada categoría solo ve lo que ella misma generó— se
 * muestra explícita y bloqueada, para que el dueño entienda que **no está
 * compartiendo nada** salvo lo que active a mano.
 */
@Component({
  selector: 'app-perro-privacidad',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="priv-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--lg priv-wrap">
    <a routerLink="/perros" class="back-link">
      <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis mascotas' | t }}
    </a>

    <header class="priv-head">
      <h1>Privacidad de {{ perro()?.nombre ?? 'tu mascota' }}</h1>
      <p>
        {{ 'Tú decides qué información ve cada tipo de servicio. Por defecto, lo que registra un profesional' | t }} <strong>{{ 'no sale de su propia categoría' | t }}</strong>.
      </p>
    </header>

    @if (cargando()) {
      <p class="priv-cargando">{{ 'Cargando permisos…' | t }}</p>
    } @else {
      <div class="priv-tabla-wrap">
        <table class="priv-tabla">
          <caption class="rs-sr-only">{{ 'Permisos de compartición por tipo de historial y categoría' | t }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ 'Historial' | t }}</th>
              @for (v of verticales; track v) {
                <th scope="col">{{ etiquetaVertical(v) }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (t of tiposHistorial; track t) {
              <tr>
                <th scope="row">{{ etiquetaHistorial(t) }}</th>
                @for (v of verticales; track v) {
                  <td>
                    @if (esOrigen(t, v)) {
                      <span class="priv-propio" [title]="'Quien genera el historial siempre lo ve' | t">
                        <rs-icon name="check" [size]="14" [stroke]="3"></rs-icon>
                        <span class="rs-sr-only">{{ 'Siempre visible: es quien lo generó' | t }}</span>
                      </span>
                    } @else {
                      <label class="priv-check">
                        <input type="checkbox"
                               [checked]="estaConcedido(t, v)"
                               [disabled]="guardando()"
                               (change)="alternar(t, v)" />
                        <span class="rs-sr-only">
                          Compartir {{ etiquetaHistorial(t) }} con {{ etiquetaVertical(v) }}
                        </span>
                      </label>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="priv-pie">
        <p>
          <rs-icon name="lock" [size]="14" [stroke]="2"></rs-icon>
          {{ 'Cada cambio queda registrado con su fecha. Puedes revocarlo cuando quieras.' | t }}
        </p>
        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                [disabled]="guardando() || !hayAlgunoConcedido()"
                (click)="revocarTodo()">
          {{ 'Revocar todos los permisos' | t }}
        </button>
      </div>

      @if (mensaje()) { <p class="priv-mensaje">{{ mensaje() }}</p> }
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .priv-page { min-height: 100vh; background: var(--c-base); }
    .priv-wrap { padding-block: var(--sp-8); }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      color: var(--t-400); font-size: var(--f-sm); text-decoration: none;
      margin-bottom: var(--sp-4);
    }

    .priv-head { margin-bottom: var(--sp-6); max-width: 68ch; }
    .priv-head h1 { font-size: var(--f-2xl); color: var(--dk-blue); margin-bottom: var(--sp-2); }
    .priv-head p { color: var(--t-400); line-height: 1.6; }

    .priv-cargando { color: var(--t-400); }

    /* En móvil la matriz se desplaza en horizontal en vez de comprimirse. */
    .priv-tabla-wrap { overflow-x: auto; background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg); }

    .priv-tabla {
      width: 100%; border-collapse: collapse; min-width: 640px;

      th, td { padding: var(--sp-3) var(--sp-4); text-align: center; font-size: var(--f-sm); }
      thead th { color: var(--dk-blue); font-weight: var(--w-7); border-bottom: 1px solid var(--b-1); }
      tbody th { text-align: left; color: var(--t-200); font-weight: var(--w-6); white-space: nowrap; }
      tbody tr + tr { border-top: 1px solid var(--b-1); }
    }

    .priv-propio {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--c-accent-lo); color: var(--dk-blue);
    }

    .priv-check input { width: 18px; height: 18px; cursor: pointer; }

    .priv-pie {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-4); flex-wrap: wrap; margin-top: var(--sp-5);

      p { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); }
    }

    .priv-mensaje { margin-top: var(--sp-4); font-size: var(--f-sm); color: var(--dk-blue); }
  `],
})
export class PerroPrivacidadComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly perrosService = inject(PerrosService);

  readonly tiposHistorial = Object.values(TipoHistorial);
  readonly verticales = Object.values(VerticalKey);

  readonly perro = signal<PerroApi | null>(null);
  readonly consentimientos = signal<ConsentimientoApi[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly mensaje = signal('');

  readonly hayAlgunoConcedido = computed(() => this.consentimientos().some((c) => c.concedido));

  private perroId = '';

  async ngOnInit(): Promise<void> {
    this.perroId = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const [perro, consentimientos] = await Promise.all([
        this.perrosService.obtener(this.perroId),
        this.perrosService.consentimientos(this.perroId),
      ]);
      this.perro.set(perro);
      this.consentimientos.set(consentimientos);
    } catch {
      this.mensaje.set('No se pudieron cargar los permisos. Vuelve a intentarlo.');
    } finally {
      this.cargando.set(false);
    }
  }

  etiquetaHistorial(t: TipoHistorial): string {
    return TIPO_HISTORIAL_LABELS[t];
  }

  etiquetaVertical(v: VerticalKey): string {
    return VERTICAL_LABELS[v];
  }

  /** El vertical que genera un historial siempre lo ve: no es una decisión. */
  esOrigen(t: TipoHistorial, v: VerticalKey): boolean {
    return HISTORIAL_ORIGEN[t] === v;
  }

  estaConcedido(t: TipoHistorial, v: VerticalKey): boolean {
    return this.consentimientos().some(
      (c) => c.tipoHistorial === t && c.verticalDestino === v && c.concedido,
    );
  }

  async alternar(t: TipoHistorial, v: VerticalKey): Promise<void> {
    const concedido = !this.estaConcedido(t, v);
    this.guardando.set(true);
    this.mensaje.set('');
    try {
      const actualizado = await this.perrosService.fijarConsentimiento(this.perroId, {
        tipoHistorial: t, verticalDestino: v, concedido,
      });
      this.consentimientos.update((lista) => [
        ...lista.filter((c) => !(c.tipoHistorial === t && c.verticalDestino === v)),
        actualizado,
      ]);
      this.mensaje.set(
        concedido
          ? `${TIPO_HISTORIAL_LABELS[t]} ya es visible para ${VERTICAL_LABELS[v]}.`
          : `${VERTICAL_LABELS[v]} ha dejado de ver ${TIPO_HISTORIAL_LABELS[t]}.`,
      );
    } catch {
      this.mensaje.set('No se pudo guardar el cambio. Vuelve a intentarlo.');
    } finally {
      this.guardando.set(false);
    }
  }

  async revocarTodo(): Promise<void> {
    this.guardando.set(true);
    try {
      await this.perrosService.revocarTodos(this.perroId);
      this.consentimientos.update((lista) => lista.map((c) => ({ ...c, concedido: false })));
      this.mensaje.set('Se han revocado todos los permisos de compartición.');
    } catch {
      this.mensaje.set('No se pudieron revocar los permisos. Vuelve a intentarlo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
