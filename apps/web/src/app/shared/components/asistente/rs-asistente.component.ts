import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect,
  inject, signal, viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  TIPO_LUGAR_LABELS, VERTICAL_LABELS,
  type MensajeAsistenteDto, type ResultadoAsistente, type TipoLugar, type VerticalKey,
  type VerTodosAsistente,
} from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { EurosPipe } from '../../pipes/euros.pipe';
import { AsistenteService } from './asistente.service';
import { AsistenteUiService } from './asistente-ui.service';

/** Un turno ya pintado, con los enlaces y las opciones que propuso el asistente. */
interface Turno extends MensajeAsistenteDto {
  readonly enlaces?: Array<{ titulo: string; ruta: string }>;
  readonly resultados?: ResultadoAsistente[];
  readonly verTodos?: VerTodosAsistente;
}

/** Dónde se pinta el panel abierto. */
interface Posicion {
  readonly top: number;
  readonly right: number;
  readonly maxHeight: number;
}

const SALUDO: Turno = {
  autor: 'asistente',
  texto: '¡Hola! Soy el asistente de Doogking. Pregúntame lo que quieras sobre la web: '
    + 'cómo reservar, qué servicios hay en tu ciudad o dónde ir con tu perro.',
};

/**
 * Pantallas con columna lateral fija a la izquierda: los paneles de comercio y
 * de administración. Sólo importa al flotante de reserva (ver abajo).
 */
const CON_COLUMNA_LATERAL = ['/comercio', '/admin'];

/** Por debajo de este ancho el panel ocupa la pantalla entera, como un chat de app. */
const ANCHO_MOVIL = 640;
/** Separación entre el botón de la cabecera y el panel, y margen con los bordes. */
const HUECO = 8;
const MARGEN = 16;

/** Lo que más se pregunta, para no empezar ante un cuadro en blanco. */
const SUGERENCIAS = [
  'Alojamiento canino en Valencia',
  '¿Hay playas para perros?',
  '¿Cómo reservo una cita?',
  '¿Puedo cancelar una reserva?',
] as const;

/**
 * Panel del asistente de la web: un chat que responde dudas sobre Doogking y
 * enseña opciones reales de la plataforma como tarjetas.
 *
 * **Se abre desde la cabecera** (`rs-asistente-disparador`, en `rs-navbar`).
 * El flotante de abajo a la izquierda tapaba contenido —la última tarjeta de
 * un listado, la paginación, el pie de un formulario— (observaciones de
 * octubre). Ahora el panel se ancla bajo el botón que lo abrió, y en móvil
 * ocupa la pantalla entera: nunca aparece desplazado a una esquina.
 *
 * Sólo cuando la pantalla no tiene cabecera (un paso de reserva a pantalla
 * completa) se pinta un flotante de reserva, para que la ayuda no desaparezca.
 */
@Component({
  selector: 'rs-asistente',
  standalone: true,
  imports: [TraducirPipe, RouterLink, RsIconComponent, EurosPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="as" [class.as--tras-columna]="trasColumna()">
  @if (abierto()) {
    <section #panel class="as__panel" role="dialog" aria-modal="false"
             [class.as__panel--anclado]="posicion()"
             [style.top.px]="posicion()?.top"
             [style.right.px]="posicion()?.right"
             [style.max-height.px]="posicion()?.maxHeight"
             [attr.aria-label]="'Asistente de Doogking' | t" data-testid="panel-asistente">

      <header class="as__cab">
        <span class="as__avatar" aria-hidden="true">
          <rs-icon name="sparkles" [size]="18" [stroke]="2" />
        </span>
        <div class="as__quien">
          <strong>{{ 'Asistente Doogking' | t }}</strong>
          <span class="as__estado">
            <i class="as__punto" aria-hidden="true"></i>
            {{ escribiendo() ? ('Escribiendo…' | t) : ('Te responde al momento' | t) }}
          </span>
        </div>
        <button type="button" class="as__cerrar" (click)="cerrar()"
                [attr.aria-label]="'Cerrar el asistente' | t">
          <rs-icon name="x" [size]="18" [stroke]="2.5" />
        </button>
      </header>

      <div class="as__hilo" #hilo role="log" aria-live="polite" data-testid="hilo-asistente">
        @for (t of turnos(); track $index) {
          <div class="as__turno" [class.as__turno--mio]="t.autor === 'cliente'">
            <p class="as__burbuja">{{ t.texto }}</p>

            @if (t.resultados?.length) {
              <ul class="as__resultados" data-testid="resultados-asistente">
                @for (r of t.resultados!; track r.ruta) {
                  <li>
                    <a class="as__res" [routerLink]="r.ruta" (click)="cerrar()">
                      @if (r.imagen) {
                        <img class="as__res-img" [src]="r.imagen" alt="" loading="lazy" />
                      } @else {
                        <span class="as__res-img as__res-img--vacia" aria-hidden="true">
                          <rs-icon name="paw" [size]="18" [stroke]="2" />
                        </span>
                      }
                      <span class="as__res-info">
                        <strong class="as__res-titulo">{{ r.titulo }}</strong>
                        <span class="as__res-meta">{{ r.ciudad }} · {{ etiqueta(r) | t }}</span>
                        <span class="as__res-datos">
                          @if (r.precioDesde != null) {
                            <span class="as__res-precio">{{ 'Desde' | t }} {{ r.precioDesde | euros }}</span>
                          }
                          @if (r.nota != null) {
                            <span class="as__res-nota">
                              <rs-icon name="star" [size]="12" [stroke]="2.5" />
                              {{ r.nota }} ({{ r.numResenas }})
                            </span>
                          }
                        </span>
                      </span>
                      <span class="as__res-ver">
                        {{ (r.tipo === 'lugar' ? 'Ver sitio' : 'Ver ficha') | t }}
                        <rs-icon name="arrow-right" [size]="12" [stroke]="2.5" />
                      </span>
                    </a>
                  </li>
                }
              </ul>
            }

            @if (t.verTodos; as v) {
              <a class="as__enlace" [routerLink]="v.ruta" [queryParams]="v.queryParams ?? null" (click)="cerrar()">
                {{ v.titulo | t }}
                <rs-icon name="arrow-right" [size]="13" [stroke]="2.5" />
              </a>
            }

            @if (t.enlaces?.length) {
              <div class="as__enlaces">
                @for (e of t.enlaces!; track e.ruta) {
                  <a class="as__enlace" [routerLink]="e.ruta" (click)="cerrar()">
                    {{ e.titulo }}
                    <rs-icon name="arrow-right" [size]="13" [stroke]="2.5" />
                  </a>
                }
              </div>
            }
          </div>
        }

        @if (escribiendo()) {
          <div class="as__turno">
            <p class="as__burbuja as__burbuja--puntos" aria-hidden="true"><i></i><i></i><i></i></p>
          </div>
        }

        <!-- Sólo mientras no se ha preguntado nada: después estorban. -->
        @if (turnos().length === 1 && !escribiendo()) {
          <div class="as__sugerencias">
            @for (s of sugerencias; track s) {
              <button type="button" class="as__sugerencia" (click)="enviar(s)">{{ s | t }}</button>
            }
          </div>
        }
      </div>

      <form class="as__pie" (submit)="alEnviar($event)">
        <input #campo class="as__campo" [value]="borrador()" (input)="escribir($event)"
               [placeholder]="'Escribe tu pregunta…' | t" [disabled]="escribiendo()"
               [attr.aria-label]="'Tu pregunta' | t" autocomplete="off" />
        <button type="submit" class="as__enviar" [disabled]="!borrador().trim() || escribiendo()"
                [attr.aria-label]="'Enviar' | t">
          <rs-icon name="arrow-right" [size]="17" [stroke]="2.5" />
        </button>
      </form>
    </section>
  }

  @if (!ui.hayDisparadorEnCabecera()) {
    <button #lanzador type="button" class="as__lanzador" [class.as__lanzador--abierto]="abierto()"
            (click)="alternarDesdeFlotante()" data-testid="lanzador-asistente"
            [attr.aria-expanded]="abierto()"
            [attr.aria-label]="(abierto() ? 'Cerrar el asistente' : 'Abrir el asistente de Doogking') | t">
      @if (abierto()) {
        <rs-icon name="x" [size]="22" [stroke]="2.5" />
      } @else {
        <rs-icon name="sparkles" [size]="22" [stroke]="2" />
        <span class="as__lanzador-txt">{{ '¿Te ayudo?' | t }}</span>
      }
    </button>
  }
</div>
  `,
  styles: [`
    :host { display: block; }

    /* El contenedor sólo coloca el flotante de reserva; el panel va por libre. */
    .as {
      position: fixed;
      left: var(--sp-5);
      bottom: calc(var(--sp-5) + var(--dk-nav-inferior-h, 0px) + var(--dk-barra-reserva-h, 0px));
      z-index: var(--z-4);
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-3);
    }
    .as--tras-columna { left: calc(var(--panel-lateral) + var(--sp-5)); }

    /* ── Flotante de reserva (sólo en pantallas sin cabecera) ──────── */
    /*
      El ancho del botón NUNCA se anima: "auto" no se interpola y el botón se
      escapaba de debajo del puntero en el primer fotograma.
    */
    .as__lanzador {
      --as-lado: 52px;
      --as-icono: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: var(--as-lado); height: var(--as-lado);
      padding-inline: calc((var(--as-lado) - var(--as-icono)) / 2);
      border: none; border-radius: var(--r-full);
      background: var(--g-accent); color: #fff;
      font: var(--w-7) var(--f-sm) var(--font);
      cursor: pointer;
      box-shadow: 0 10px 28px rgba(8,37,139,.34);
      transition: transform var(--d-2), box-shadow var(--d-2);
      &:hover, &:focus-visible {
        transform: translateY(-2px); box-shadow: 0 14px 34px rgba(8,37,139,.42);
      }
      &:focus-visible { outline: 3px solid var(--dk-gold); outline-offset: 3px; }
      rs-icon { color: var(--dk-gold-light); flex: none; }
    }
    .as__lanzador--abierto rs-icon { color: #fff; }
    .as__lanzador-txt { white-space: nowrap; margin-inline-start: var(--sp-2); }

    /* ── Panel ────────────────────────────────────────────────────── */
    /*
      Por defecto (abierto desde el flotante) se apila sobre él, abajo a la
      izquierda. Abierto desde la cabecera, --anclado lo saca del flujo y lo
      coloca bajo el botón con top/right calculados en el componente.
    */
    .as__panel {
      width: 380px; max-height: min(560px, calc(100dvh - 140px));
      display: flex; flex-direction: column; overflow: hidden;
      border: 1px solid var(--b-1); border-radius: var(--r-2xl);
      background: var(--c-card);
      box-shadow: 0 24px 60px rgba(8,37,139,.26);
      animation: asEntra var(--d-3) cubic-bezier(.2,.8,.2,1) both;
    }
    .as__panel--anclado {
      position: fixed; left: auto; bottom: auto;
      width: min(400px, calc(100vw - 2 * var(--sp-4)));
      height: min(600px, 100%);
      transform-origin: top right;
      animation-name: asBaja;
    }
    @keyframes asEntra {
      from { opacity: 0; transform: translateY(12px) scale(.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes asBaja {
      from { opacity: 0; transform: translateY(-8px) scale(.98); }
      to   { opacity: 1; transform: none; }
    }

    /*
      Móvil: el panel a pantalla completa, como los chats de las apps. Va
      DESPUÉS de las reglas base a propósito: antes estaba delante y el
      width: 380px / max-height: 560px de la regla base —misma especificidad,
      escrita más abajo— le ganaban, así que en el móvil el panel salía como
      una caja de 380 px pegada arriba a la izquierda en vez de ocupar la
      pantalla.
    */
    @media (max-width: 640px) {
      .as { left: var(--sp-4); }
      .as__lanzador { --as-lado: 48px; }
      .as__lanzador-txt { display: none; }
      .as:has(.as__panel) .as__lanzador { display: none; }
      .as__panel, .as__panel--anclado {
        position: fixed; inset: 0;
        width: auto; height: 100dvh; max-height: none;
        border: 0; border-radius: 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation-name: asEntra;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .as__lanzador { transition: none; }
      .as__panel { animation: none; }
    }

    .as__cab {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-5);
      padding-top: max(var(--sp-4), env(safe-area-inset-top, 0px));
      background: var(--g-accent); color: #fff;
    }
    .as__avatar {
      display: grid; place-items: center; flex: none;
      width: 38px; height: 38px; border-radius: var(--r-full);
      background: rgba(255,255,255,.16); color: var(--dk-gold-light);
    }
    .as__quien { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
    .as__quien strong { font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7); }
    .as__estado {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-xs); color: rgba(255,255,255,.82);
    }
    .as__punto {
      width: 7px; height: 7px; border-radius: var(--r-full);
      background: #4ADE80; box-shadow: 0 0 0 3px rgba(74,222,128,.22);
    }
    .as__cerrar {
      display: grid; place-items: center; flex: none;
      width: 34px; height: 34px; border: none; border-radius: var(--r-full);
      background: rgba(255,255,255,.12); color: #fff; cursor: pointer;
      transition: background var(--d-2);
      &:hover { background: rgba(255,255,255,.24); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }

    /* ── Hilo ─────────────────────────────────────────────────────── */
    .as__hilo {
      flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-4);
      background: var(--c-base);
    }
    .as__turno { display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-2); }
    .as__turno--mio { align-items: flex-end; }

    .as__burbuja {
      max-width: 88%; padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-xl) var(--r-xl) var(--r-xl) var(--r-sm);
      background: var(--c-card); border: 1px solid var(--b-1);
      font-size: var(--f-sm); line-height: 1.55; color: var(--t-200);
      white-space: pre-line; overflow-wrap: anywhere;
    }
    .as__turno--mio .as__burbuja {
      border-radius: var(--r-xl) var(--r-xl) var(--r-sm) var(--r-xl);
      background: var(--dk-blue); border-color: var(--dk-blue); color: #fff;
    }

    .as__burbuja--puntos {
      display: flex; gap: 5px; padding: var(--sp-4);
      i {
        width: 7px; height: 7px; border-radius: var(--r-full); background: var(--t-400);
        animation: asPunto 1.2s infinite ease-in-out both;
        &:nth-child(2) { animation-delay: .16s; }
        &:nth-child(3) { animation-delay: .32s; }
      }
    }
    @keyframes asPunto { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }

    /* ── Tarjetas de resultados ───────────────────────────────────── */
    .as__resultados {
      list-style: none; margin: 0; padding: 0; width: 100%;
      display: flex; flex-direction: column; gap: var(--sp-2);
    }
    .as__res {
      display: grid; grid-template-columns: 52px 1fr; grid-template-rows: auto auto;
      column-gap: var(--sp-3); row-gap: var(--sp-1);
      padding: var(--sp-2); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); color: inherit; text-decoration: none;
      transition: border-color var(--d-2), box-shadow var(--d-2);
      &:hover { border-color: var(--dk-blue); box-shadow: var(--sh-md); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }
    .as__res-img {
      grid-row: 1 / 3; width: 52px; height: 52px; border-radius: var(--r-md);
      object-fit: cover; background: var(--c-raised);
    }
    .as__res-img--vacia { display: grid; place-items: center; color: var(--dk-blue); }
    .as__res-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .as__res-titulo {
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .as__res-meta { font-size: var(--f-xs); color: var(--t-300); }
    .as__res-datos { display: flex; flex-wrap: wrap; gap: var(--sp-2); font-size: var(--f-xs); }
    .as__res-precio { color: var(--dk-blue); font-weight: var(--w-7); }
    .as__res-nota {
      display: inline-flex; align-items: center; gap: 2px; color: var(--t-200);
      rs-icon { color: var(--dk-gold); }
    }
    .as__res-ver {
      grid-column: 2; justify-self: start;
      display: inline-flex; align-items: center; gap: var(--sp-1);
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--dk-blue);
    }

    .as__enlaces { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .as__enlace {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-full);
      border: 1px solid var(--dk-blue); background: var(--c-accent-lo);
      color: var(--dk-blue); font-size: var(--f-xs); font-weight: var(--w-6);
      text-decoration: none;
      &:hover { background: var(--dk-blue); color: #fff; }
    }

    .as__sugerencias { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-1); }
    .as__sugerencia {
      align-self: flex-start; max-width: 100%;
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px dashed var(--b-2); background: var(--c-card);
      color: var(--dk-blue); font: var(--w-6) var(--f-xs) var(--font);
      text-align: left; cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      &:hover { border-style: solid; border-color: var(--dk-blue); background: var(--c-accent-lo); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }

    /* ── Pie ──────────────────────────────────────────────────────── */
    .as__pie {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3); border-top: 1px solid var(--b-1); background: var(--c-card);
    }
    .as__campo {
      flex: 1; min-width: 0; height: 42px; padding-inline: var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-base); color: var(--t-100);
      font: var(--f-sm) var(--font);
      &::placeholder { color: var(--t-400); }
      &:focus { outline: none; border-color: var(--dk-blue); background: var(--c-card); }
      &:disabled { opacity: .6; }
    }
    .as__enviar {
      display: grid; place-items: center; flex: none;
      width: 42px; height: 42px; border: none; border-radius: var(--r-full);
      background: var(--dk-gold); color: var(--dk-blue-deep); cursor: pointer;
      transition: background var(--d-2), opacity var(--d-2);
      &:hover:not(:disabled) { background: var(--dk-gold-light); }
      &:disabled { opacity: .45; cursor: not-allowed; }
      &:focus-visible { outline: 2px solid var(--dk-blue); outline-offset: 2px; }
    }
  `],
})
export class RsAsistenteComponent {
  private readonly router = inject(Router);
  private readonly asistente = inject(AsistenteService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ui = inject(AsistenteUiService);

  protected readonly sugerencias = SUGERENCIAS;

  /** La ruta actual, para saber si hay una columna lateral que esquivar. */
  private readonly ruta = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  private readonly pagina = computed(() => this.ruta().split(/[?#]/)[0]);
  protected readonly trasColumna = computed(
    () => CON_COLUMNA_LATERAL.some((prefijo) => this.ruta().startsWith(prefijo)));

  protected readonly abierto = this.ui.abierto;
  protected readonly escribiendo = signal(false);
  protected readonly borrador = signal('');
  protected readonly turnos = signal<Turno[]>([SALUDO]);
  /** null = panel sobre el flotante, o a pantalla completa en móvil. */
  protected readonly posicion = signal<Posicion | null>(null);

  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly lanzador = viewChild<ElementRef<HTMLButtonElement>>('lanzador');

  /** Lo que se le manda al API como contexto: sin el saludo, que no aporta. */
  private readonly historial = computed<MensajeAsistenteDto[]>(
    () => this.turnos().slice(1).map(({ autor, texto }) => ({ autor, texto })));

  constructor() {
    // Al abrir, colocar el panel junto a su botón y llevar el foco al campo.
    effect(() => {
      if (!this.abierto()) return;
      this.ui.origen();
      this.recolocar();
    });
    // Con cada turno nuevo, el hilo abajo.
    effect(() => {
      if (!this.abierto()) return;
      this.turnos();
      this.escribiendo();
      queueMicrotask(() => {
        const hilo = this.hilo()?.nativeElement;
        if (hilo) hilo.scrollTop = hilo.scrollHeight;
        this.campo()?.nativeElement.focus();
      });
    });
    // Al cambiar de página el panel se cierra: la respuesta ya llevó al usuario.
    // Sólo cuenta la ruta, no la query: un listado que reescribe sus filtros
    // en la URL no debe cerrar el chat mientras se usa.
    effect(() => {
      this.pagina();
      this.ui.cerrar();
    });
  }

  /** Escape cierra, como cualquier panel de la web. */
  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    if (this.abierto()) this.cerrar();
  }

  /** Abierto desde la cabecera, un clic fuera lo cierra como un desplegable. */
  @HostListener('document:click', ['$event'])
  protected alClicFuera(evento: MouseEvent): void {
    if (!this.abierto() || !this.posicion()) return;
    const destino = evento.target as Node | null;
    if (!destino || this.host.nativeElement.contains(destino)) return;
    if (this.ui.origen()?.contains(destino)) return;
    this.cerrar();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected recolocar(): void {
    if (this.abierto()) this.posicion.set(this.calcularPosicion());
  }

  protected alternarDesdeFlotante(): void {
    this.ui.alternar(null);
  }

  protected cerrar(): void {
    const volverA = this.ui.origen() ?? this.lanzador()?.nativeElement;
    this.ui.cerrar();
    volverA?.focus();
  }

  protected etiqueta(r: ResultadoAsistente): string {
    return r.tipo === 'lugar'
      ? TIPO_LUGAR_LABELS[r.categoria as TipoLugar] ?? r.categoria
      : VERTICAL_LABELS[r.categoria as VerticalKey] ?? r.categoria;
  }

  protected escribir(evento: Event): void {
    this.borrador.set((evento.target as HTMLInputElement).value);
  }

  protected alEnviar(evento: Event): void {
    evento.preventDefault();
    void this.enviar(this.borrador());
  }

  protected async enviar(pregunta: string): Promise<void> {
    const texto = pregunta.trim();
    if (!texto || this.escribiendo()) return;

    this.borrador.set('');
    this.turnos.update((t) => [...t, { autor: 'cliente', texto }]);
    this.escribiendo.set(true);

    try {
      const r = await this.asistente.preguntar({
        pregunta: texto,
        historial: this.historial().slice(0, -1),
        ruta: this.router.url,
      });
      this.turnos.update((t) => [...t, {
        autor: 'asistente', texto: r.respuesta,
        ...(r.enlaces ? { enlaces: r.enlaces } : {}),
        ...(r.resultados?.length ? { resultados: r.resultados } : {}),
        ...(r.verTodos ? { verTodos: r.verTodos } : {}),
      }]);
    } catch {
      // Que el hilo nunca se quede mudo: un fallo de red también se contesta.
      this.turnos.update((t) => [...t, {
        autor: 'asistente',
        texto: 'No he podido conectar. Inténtalo de nuevo en un momento.',
        enlaces: [{ titulo: 'Centro de ayuda', ruta: '/ayuda' }],
      }]);
    } finally {
      this.escribiendo.set(false);
    }
  }

  /**
   * Bajo el botón de la cabecera, con el borde derecho alineado al suyo y sin
   * salirse de la pantalla. En móvil, o sin botón de origen visible, null: el
   * CSS lo pone a pantalla completa o sobre el flotante.
   */
  private calcularPosicion(): Posicion | null {
    if (typeof window === 'undefined' || window.innerWidth <= ANCHO_MOVIL) return null;
    const origen = this.ui.origen();
    if (!origen?.isConnected) return null;

    const caja = origen.getBoundingClientRect();
    if (!caja.width && !caja.height) return null;

    const top = Math.round(caja.bottom + HUECO);
    return {
      top,
      right: Math.max(MARGEN, Math.round(window.innerWidth - caja.right)),
      maxHeight: Math.max(240, window.innerHeight - top - MARGEN),
    };
  }
}
