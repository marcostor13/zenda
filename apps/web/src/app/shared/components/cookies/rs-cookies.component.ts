import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { ConsentimientoService, type CategoriaCookies } from '../../../core/cookies/consentimiento.service';
import { RsIconComponent } from '../icon/rs-icon.component';

interface FichaCategoria {
  readonly clave: CategoriaCookies;
  readonly titulo: string;
  readonly explicacion: string;
}

/**
 * Las tres familias que el visitante puede activar o desactivar, con el texto
 * que se le enseña. Se escribe en cristiano y diciendo **para qué** sirve cada
 * una: «cookies analíticas» no le dice nada a nadie.
 */
const CATEGORIAS: readonly FichaCategoria[] = [
  {
    clave: 'preferencias',
    titulo: 'Preferencias',
    explicacion: 'Recuerdan cómo te gusta ver la web: el mapa de las fichas, la moneda, '
      + 'los filtros que sueles usar.',
  },
  {
    clave: 'analitica',
    titulo: 'Medición',
    explicacion: 'Nos dicen qué páginas se usan y dónde se atasca la gente, siempre en '
      + 'conjunto y sin identificarte.',
  },
  {
    clave: 'marketing',
    titulo: 'Publicidad',
    explicacion: 'Permiten medir si una campaña ha funcionado y no repetirte el mismo '
      + 'anuncio una y otra vez.',
  },
];

/**
 * Aviso de cookies.
 *
 * Antes de esto la web no preguntaba nada: cargaba Google Maps en las fichas y
 * los SDK de Google y Meta en las pantallas de acceso —los tres ponen cookies de
 * terceros en cuanto se ejecutan—. Había política de cookies, pero ningún
 * mecanismo para aceptar, rechazar o configurar, que es justo lo que la
 * normativa exige **antes** de usarlas.
 *
 * Las tres acciones están al mismo nivel visual a propósito: la AEPD considera
 * que un "rechazar" escondido detrás de un menú invalida también el
 * consentimiento de quienes aceptan. Rechazar cuesta un clic, igual que aceptar.
 */
@Component({
  selector: 'rs-cookies',
  standalone: true,
  imports: [RouterLink, TraducirPipe, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (consentimiento.pendiente()) {
  <div class="ck" role="dialog" aria-modal="false"
       [attr.aria-label]="'Aviso de cookies' | t">
    <div class="ck__caja">
      <div class="ck__texto">
        <h2 class="ck__titulo">{{ 'Tú decides qué cookies usamos' | t }}</h2>
        <p class="ck__cuerpo">
          {{ 'Las imprescindibles para que la web funcione —mantener tu sesión, recordar tu idioma— van siempre. Del resto no usamos ninguna hasta que nos digas que sí.' | t }}
          <a routerLink="/cookies" class="ck__enlace">{{ 'Leer la política de cookies' | t }}</a>
        </p>
      </div>

      @if (detalle()) {
        <ul class="ck__lista">
          @for (categoria of categorias; track categoria.clave) {
            <li class="ck__fila">
              <label class="ck__switch">
                <input type="checkbox"
                       [checked]="eleccion()[categoria.clave]"
                       (change)="alternar(categoria.clave)" />
                <span class="ck__switch-pista" aria-hidden="true"></span>
                <span class="ck__switch-texto">
                  <strong>{{ categoria.titulo | t }}</strong>
                  <em>{{ categoria.explicacion | t }}</em>
                </span>
              </label>
            </li>
          }
          <li class="ck__fila ck__fila--fija">
            <span class="ck__switch-texto">
              <strong>{{ 'Necesarias' | t }}</strong>
              <em>{{ 'Mantienen tu sesión y tu idioma. Sin ellas la web no funciona, así que no se pueden desactivar.' | t }}</em>
            </span>
            <span class="ck__siempre">{{ 'Siempre activas' | t }}</span>
          </li>
        </ul>
      }

      <div class="ck__acciones">
        <button type="button" class="rs-btn rs-btn--gold ck__btn" (click)="consentimiento.aceptarTodo()">
          {{ 'Aceptar todas' | t }}
        </button>
        <button type="button" class="rs-btn rs-btn--outline ck__btn" (click)="consentimiento.rechazarTodo()">
          {{ 'Rechazar todas' | t }}
        </button>
        @if (detalle()) {
          <button type="button" class="rs-btn rs-btn--ghost ck__btn" (click)="guardarEleccion()">
            {{ 'Guardar mi elección' | t }}
          </button>
        } @else {
          <button type="button" class="rs-btn rs-btn--ghost ck__btn" (click)="detalle.set(true)">
            <rs-icon name="settings" [size]="16" [stroke]="2"></rs-icon>
            {{ 'Configurar' | t }}
          </button>
        }
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    .ck {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 1200;
      display: flex;
      justify-content: center;
      padding: var(--s-4);
      /* Por encima de la barra inferior de la app instalada y del notch. */
      padding-bottom: calc(var(--s-4) + env(safe-area-inset-bottom, 0px));
      pointer-events: none;
    }

    .ck__caja {
      pointer-events: auto;
      width: min(58rem, 100%);
      background: var(--c-card);
      border: 1px solid var(--c-surface);
      border-radius: var(--r-lg);
      box-shadow: var(--shadow-lg);
      padding: var(--s-6);
      display: flex;
      flex-direction: column;
      gap: var(--s-4);
      max-height: 80vh;
      overflow-y: auto;
    }

    .ck__titulo {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: var(--fw-bold);
      color: var(--dk-blue-text);
      margin: 0 0 var(--s-2);
    }

    .ck__cuerpo { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.55; }

    .ck__enlace { color: var(--c-accent); font-weight: var(--fw-semibold); }

    .ck__lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-3); }

    .ck__fila {
      border: 1px solid var(--c-surface);
      border-radius: var(--r-md);
      padding: var(--s-3) var(--s-4);
    }

    .ck__fila--fija {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-3);
      background: var(--c-base);
    }

    .ck__switch { display: flex; align-items: flex-start; gap: var(--s-3); cursor: pointer; }
    .ck__switch input { position: absolute; opacity: 0; width: 0; height: 0; }

    .ck__switch-pista {
      flex: none;
      width: 2.5rem;
      height: 1.4rem;
      margin-top: 2px;
      border-radius: var(--r-full);
      background: var(--dk-divider);
      position: relative;
      transition: background var(--t-fast);
    }

    .ck__switch-pista::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 1rem;
      height: 1rem;
      border-radius: var(--r-full);
      background: #fff;
      transition: transform var(--t-fast);
    }

    .ck__switch input:checked + .ck__switch-pista { background: var(--c-accent); }
    .ck__switch input:checked + .ck__switch-pista::after { transform: translateX(1.1rem); }

    /* El foco tiene que verse: el conmutador real está oculto tras la pista. */
    .ck__switch input:focus-visible + .ck__switch-pista {
      outline: 2px solid var(--c-accent);
      outline-offset: 2px;
    }

    .ck__switch-texto { display: flex; flex-direction: column; gap: 2px; }
    .ck__switch-texto strong { font-size: var(--text-sm); color: var(--dk-blue-text); }
    .ck__switch-texto em { font-style: normal; font-size: var(--text-xs); color: var(--text-muted); }

    .ck__siempre {
      flex: none;
      font-size: var(--text-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-muted);
    }

    /*
     * Las tres acciones comparten fila y tamaño. Rechazar no puede costar más
     * que aceptar: si costara, el consentimiento no sería válido.
     */
    .ck__acciones { display: flex; flex-wrap: wrap; gap: var(--s-3); }
    .ck__btn { flex: 1 1 12rem; justify-content: center; }

    @media (max-width: 640px) {
      .ck { padding: var(--s-3); }
      .ck__caja { padding: var(--s-4); gap: var(--s-3); }
      .ck__btn { flex-basis: 100%; }
    }
  `],
})
export class RsCookiesComponent {
  protected readonly consentimiento = inject(ConsentimientoService);

  protected readonly categorias = CATEGORIAS;

  /** El panel de detalle sólo se despliega si el visitante pulsa "Configurar". */
  protected readonly detalle = signal(false);

  /**
   * Lo marcado en el panel mientras el visitante decide.
   *
   * Arranca todo **desactivado**, nunca preseleccionado: unas casillas marcadas
   * de partida convierten el consentimiento en tácito, que es exactamente lo que
   * la normativa no admite.
   */
  private readonly marcado = signal<Record<CategoriaCookies, boolean>>({
    preferencias: false, analitica: false, marketing: false,
  });

  protected readonly eleccion = computed(() => this.marcado());

  protected alternar(categoria: CategoriaCookies): void {
    this.marcado.update((actual) => ({ ...actual, [categoria]: !actual[categoria] }));
  }

  protected guardarEleccion(): void {
    this.consentimiento.guardar(this.marcado());
  }
}
