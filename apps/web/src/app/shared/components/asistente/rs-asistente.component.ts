import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect,
  inject, signal, viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import type { MensajeAsistenteDto } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { AsistenteService } from './asistente.service';

/** Un turno ya pintado, con los enlaces que propuso el asistente. */
interface Turno extends MensajeAsistenteDto {
  readonly enlaces?: Array<{ titulo: string; ruta: string }>;
}

const SALUDO: Turno = {
  autor: 'asistente',
  texto: '¡Hola! Soy el asistente de Doogking. Pregúntame lo que quieras sobre la web: '
    + 'cómo reservar, qué pasa si cancelas, o cómo publicar tu negocio.',
};

/**
 * Pantallas con columna lateral fija a la izquierda: los paneles de comercio y
 * de administración. Ahí abajo a la izquierda no hay sitio libre, lo ocupa el
 * menú.
 */
const CON_COLUMNA_LATERAL = ['/comercio', '/admin'];

/** Lo que más se pregunta, para no empezar ante un cuadro en blanco. */
const SUGERENCIAS = [
  '¿Cómo reservo una cita?',
  '¿Cuándo se me cobra?',
  '¿Cómo publico mi negocio?',
  '¿Puedo cancelar una reserva?',
] as const;

/**
 * Asistente de la web: un botón flotante abajo a la izquierda que abre un chat
 * y responde dudas sobre Doogking y sus procedimientos.
 *
 * Va a la izquierda a propósito: la derecha es de la acción que da dinero —el
 * panel de reserva de las fichas, el botón de "Reservar"— y un flotante encima
 * de eso estorba justo donde no se puede estorbar.
 *
 * **Sólo en escritorio.** Por debajo de 1024 px la parte de abajo de la
 * pantalla ya la ocupan barras fijas —la de reservar de las fichas, la
 * navegación de la app instalada—, y un botón flotante ahí taparía el precio o
 * la acción. En móvil el centro de ayuda sigue a un toque desde la cabecera.
 */
@Component({
  selector: 'rs-asistente',
  standalone: true,
  imports: [TraducirPipe, RouterLink, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="as" [class.as--tras-columna]="trasColumna()">
  @if (abierto()) {
    <section class="as__panel" role="dialog" aria-modal="false"
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

  <button type="button" class="as__lanzador" [class.as__lanzador--abierto]="abierto()"
          (click)="alternar()" data-testid="lanzador-asistente"
          [attr.aria-expanded]="abierto()"
          [attr.aria-label]="(abierto() ? 'Cerrar el asistente' : 'Abrir el asistente de Doogking') | t">
    @if (abierto()) {
      <rs-icon name="x" [size]="22" [stroke]="2.5" />
    } @else {
      <rs-icon name="sparkles" [size]="22" [stroke]="2" />
      <span class="as__lanzador-txt">{{ '¿Te ayudo?' | t }}</span>
    }
  </button>
</div>
  `,
  styles: [`
    /*
      Fuera de escritorio no se pinta: por debajo de 1024 px la parte de abajo
      ya la ocupan la barra de reservar de las fichas y la navegación de la app
      instalada, y un flotante ahí taparía el precio o la acción.
    */
    :host { display: none; }
    @media (min-width: 1025px) { :host { display: block; } }

    .as {
      position: fixed;
      left: var(--sp-5);
      bottom: var(--sp-5);
      z-index: var(--z-4);
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-3);
    }
    /*
      En los paneles la esquina de abajo a la izquierda es del menú lateral: el
      flotante se aparta hasta pasarlo. El ancho sale del mismo token que usa la
      columna, para que no se separen si algún día cambia.
    */
    .as--tras-columna { left: calc(var(--panel-lateral) + var(--sp-5)); }

    /* ── Lanzador ─────────────────────────────────────────────────── */
    /*
      Un círculo, no una pastilla con texto.

      Con la etiqueta siempre visible ocupaba 150 px de ancho y se comía el
      titular de la portada al desplazarse: un flotante permanente sólo se
      perdona si en reposo casi no está. La etiqueta aparece al acercar el ratón
      —y al recibir el foco, para quien navega con teclado—, que es cuando de
      verdad hace falta saber qué es.

      El ancho del botón NUNCA se anima ni baja de --as-lado: lo que crece es la
      etiqueta, y el botón la sigue. Animar el width del botón lo encogía al
      tamaño del icono en el primer fotograma —"auto" no se interpola, salta,
      mientras el relleno y la etiqueta seguían a cero—, así que se escapaba de
      debajo del puntero y el mousedown caía fuera: el clic no abría nada.
    */
    .as__lanzador {
      --as-lado: 52px;
      --as-icono: 22px;

      display: inline-flex; align-items: center; justify-content: center;
      min-width: var(--as-lado); height: var(--as-lado);
      /* En reposo el relleno completa el círculo alrededor del icono. */
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

    /* La etiqueta no ocupa sitio —ni su separación— hasta que se despliega. */
    .as__lanzador-txt {
      white-space: nowrap; max-width: 0; margin-inline-start: 0;
      overflow: hidden; opacity: 0;
      transition: max-width var(--d-2), margin-inline-start var(--d-2), opacity var(--d-2);
    }
    .as__lanzador:hover .as__lanzador-txt,
    .as__lanzador:focus-visible .as__lanzador-txt {
      max-width: 160px; margin-inline-start: var(--sp-2); opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .as__lanzador, .as__lanzador-txt { transition: none; }
    }

    /* ── Panel ────────────────────────────────────────────────────── */
    .as__panel {
      width: 380px; max-height: min(560px, calc(100dvh - 140px));
      display: flex; flex-direction: column; overflow: hidden;
      border: 1px solid var(--b-1); border-radius: var(--r-2xl);
      background: var(--c-card);
      box-shadow: 0 24px 60px rgba(8,37,139,.26);
      animation: asEntra var(--d-3) cubic-bezier(.2,.8,.2,1) both;
    }
    @keyframes asEntra {
      from { opacity: 0; transform: translateY(12px) scale(.98); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) { .as__panel { animation: none; } }

    .as__cab {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-5);
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
      padding: var(--sp-4) var(--sp-4);
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

    /* Tres puntos mientras el modelo piensa: sin esto el panel se queda mudo. */
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
  protected readonly trasColumna = computed(
    () => CON_COLUMNA_LATERAL.some((prefijo) => this.ruta().startsWith(prefijo)));

  protected readonly abierto = signal(false);
  protected readonly escribiendo = signal(false);
  protected readonly borrador = signal('');
  protected readonly turnos = signal<Turno[]>([SALUDO]);

  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  /** Lo que se le manda al API como contexto: sin el saludo, que no aporta. */
  private readonly historial = computed<MensajeAsistenteDto[]>(
    () => this.turnos().slice(1).map(({ autor, texto }) => ({ autor, texto })));

  constructor() {
    // Al abrir, el foco al campo; y con cada turno nuevo, el hilo abajo.
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
  }

  /** Escape cierra, como cualquier panel de la web. */
  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    if (this.abierto()) this.cerrar();
  }

  protected alternar(): void { this.abierto.update((v) => !v); }
  protected cerrar(): void { this.abierto.set(false); }

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
        autor: 'asistente', texto: r.respuesta, ...(r.enlaces ? { enlaces: r.enlaces } : {}),
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
}
