import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsPetPickerComponent } from '../pet-picker/rs-pet-picker.component';
import { RsPlaceAutocompleteComponent } from '../place-autocomplete/rs-place-autocomplete.component';
import { RsCalendarioRangoComponent, type RangoFechas } from '../calendario-rango/rs-calendario-rango.component';
import { CoordenadasLugar } from '../../../core/geo/geo.service';
import { EventosService } from '../../../core/eventos/eventos.service';
import { CATEGORIA_ICONOS } from '../../media/images';
import { VERTICALES_PUBLICOS, VerticalUi, verticalUi } from '../../verticales/verticales.config';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Para pintar la fecha elegida en el disparador: "12 sep", no "2026-09-12". */
const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Parámetros de búsqueda: mismo contrato en toda la aplicación (URL incluida). */
export interface BusquedaParams {
  vertical: string;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  /** Hora de la cita, solo en verticales que reservan por slot. */
  hora: string | null;
  /** Total de perros de la reserva. Sin tope superior. */
  perros: number;
  /** Mascotas registradas elegidas; alimenta precio y compatibilidad. */
  perroIds: string[];
}

/**
 * Buscador único de Doogking. Se usa en el home (`variant="card"`) y encima de
 * cada listado (`variant="strip"`), de modo que el usuario encuentra siempre los
 * mismos campos en el mismo orden.
 *
 * La URL es la fuente de verdad de la búsqueda: al enviar navega al listado del
 * vertical con `ciudad`, `desde`, `hasta` y `perros` como query params, y se
 * inicializa leyendo esos mismos parámetros. Así la búsqueda sobrevive al
 * cambio de vista, al refresco y al compartir el enlace.
 */
@Component({
  selector: 'rs-search-bar',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RouterLink, RsIconComponent,
    RsPetPickerComponent, RsPlaceAutocompleteComponent, RsCalendarioRangoComponent,
  ],
  template: `
<div class="sb" [class.sb--strip]="variant() === 'strip'">
  @if (categorias()) {
    <div class="sb__cats" role="tablist" [attr.aria-label]="'Categorías de servicio' | t">
      @for (v of verticales; track v.key) {
        <button type="button" class="sb__cat" role="tab"
                [class.is-active]="activo().key === v.key"
                [attr.aria-selected]="activo().key === v.key"
                (click)="seleccionarVertical(v.key)">
          <img [src]="v.icono" alt="" class="sb__cat-icon" aria-hidden="true" />
          <span class="sb__cat-label">{{ v.labelCorto | t }}</span>
        </button>
      }
      <a class="sb__cat sb__cat--more" routerLink="/" fragment="categorias">
        <img [src]="iconoMas" alt="" class="sb__cat-icon" aria-hidden="true" />
        <span class="sb__cat-label">{{ 'Más servicios' | t }}</span>
      </a>
    </div>
  }

  <form class="sb__form" [formGroup]="formulario" (ngSubmit)="buscar()">
    <div class="sb__field sb__field--where">
      <label class="sb__lbl" [attr.for]="idCiudad">{{ activo().labelUbicacion | t }}</label>
      <rs-place-autocomplete formControlName="ciudad"
                             [inputId]="idCiudad"
                             [placeholder]="activo().placeholderUbicacion"
                             (lugarElegido)="elegirPoblacion($event)"
                             (confirmado)="buscar()" />
    </div>

    <div class="sb__field sb__field--fechas">
      <label class="sb__lbl" [attr.for]="idDesde">{{ activo().labelFecha | t }}</label>
      <button type="button" [id]="idDesde" class="sb__ctrl sb__fecha"
              (click)="abrirCalendario()"
              [attr.aria-expanded]="calendarioAbierto()" aria-haspopup="dialog">
        <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
        <span class="sb__fecha-txt" [class.is-vacio]="!entradaSel()">
          {{ entradaSel() ? etiquetaFecha(entradaSel()) : 'Añadir fecha' }}
        </span>
      </button>

      @if (calendarioAbierto()) {
        <!-- Sólo se ve en móvil, donde el panel pasa a ser una hoja inferior. -->
        <div class="sb__velo" (click)="cerrarCalendario()" aria-hidden="true"></div>

        <div class="sb__cal" role="dialog" [attr.aria-label]="tituloFechas()">
          <div class="sb__cal-cab">
            <strong class="sb__cal-titulo">{{ tituloFechas() }}</strong>
            <button type="button" class="sb__cal-x" (click)="cerrarCalendario()"
                    [attr.aria-label]="'Cerrar el calendario' | t">
              <rs-icon name="x" [size]="18" [stroke]="2.5"></rs-icon>
            </button>
          </div>

          <rs-calendario-rango
            [entrada]="entradaSel()" [salida]="salidaSel()"
            [conDisponibilidad]="false" [plano]="true"
            [soloUnDia]="!activo().reservaPorNoches"
            (rangoElegido)="elegirFechas($event)" />

          <div class="sb__cal-pie">
            <button type="button" class="sb__cal-link" (click)="borrarFechas()">
              {{ 'Borrar fechas' | t }}
            </button>
            <button type="button" class="rs-btn rs-btn--primary rs-btn--sm"
                    (click)="cerrarCalendario()">
              {{ 'Listo' | t }}
            </button>
          </div>
        </div>
      }
    </div>

    @if (activo().reservaPorNoches) {
      <div class="sb__field sb__field--fechas">
        <label class="sb__lbl" [attr.for]="idHasta">{{ 'Salida' | t }}</label>
        <button type="button" [id]="idHasta" class="sb__ctrl sb__fecha"
                (click)="abrirCalendario()"
                [attr.aria-expanded]="calendarioAbierto()" aria-haspopup="dialog">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
          <span class="sb__fecha-txt" [class.is-vacio]="!salidaSel()">
            {{ salidaSel() ? etiquetaFecha(salidaSel()) : 'Añadir salida' }}
          </span>
        </button>
      </div>
    }

    @if (activo().pideHora) {
      <div class="sb__field sb__field--hora">
        <label class="sb__lbl" [attr.for]="idHora">{{ 'Hora' | t }}</label>
        <div class="sb__ctrl">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
          <input [id]="idHora" formControlName="hora" type="time" class="sb__inp" />
        </div>
      </div>
    }

    <div class="sb__field sb__field--pets">
      <span class="sb__lbl">{{ '¿Para qué mascota?' | t }}</span>
      <rs-pet-picker [(perroIds)]="perroIds" [(numPerros)]="numPerros" />
    </div>

    <!-- El botón solo vive en el home: sobre un listado cualquier cambio ya
         relanza la búsqueda, así que un "Buscar" aparte sería un paso de más. -->
    @if (variant() === 'card') {
      <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg sb__cta">
        <rs-icon name="search" [size]="21" [stroke]="2.5"></rs-icon>
        <span>{{ 'Buscar' | t }}</span>
      </button>
    }
  </form>
</div>
  `,
  styles: [`
    :host { display: block; }

    /*
     * Fila de categorías. overflow-x: auto hace que el navegador compute
     * overflow-y como auto también (regla CSS: si un eje no es 'visible', el
     * otro deja de serlo) — sin padding-top, ese recorte vertical se comía
     * los 2px que .sb__cat:hover sube con translateY, y el borde/sombra del
     * botón se veía "cortado" por arriba al pasar el ratón.
     */
    .sb__cats {
      display: flex;
      align-items: stretch;
      gap: var(--sp-2);
      overflow-x: auto;
      padding-top: var(--sp-2);
      padding-bottom: var(--sp-4);
      margin-top: calc(var(--sp-2) * -1);
      margin-bottom: var(--sp-4);
      border-bottom: 1px solid var(--b-1);
      scrollbar-width: thin;
    }

    .sb__cat {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      min-width: 96px;
      padding: var(--sp-3) var(--sp-3) var(--sp-2);
      border-radius: var(--r-md);
      border: 1px solid transparent;
      background: transparent;
      color: var(--t-300);
      text-align: center;
      transition: background var(--d-2), border-color var(--d-2), color var(--d-2), transform var(--d-2);

      &:hover { background: var(--c-accent-lo); color: var(--dk-blue); transform: translateY(-2px); }

      &.is-active {
        border: 2px solid var(--dk-gold);
        background: var(--c-accent-lo);
        color: var(--dk-blue);
        box-shadow: var(--sh-sm), inset 0 -3px 0 var(--dk-gold);

        .sb__cat-icon { transform: scale(1.12); }
      }
    }

    .sb__cat-icon { width: 34px; height: 34px; transition: transform var(--d-2); }

    .sb__cat-label {
      font-size: var(--f-xs);
      font-weight: var(--w-6);
      line-height: 1.25;
    }

    /*
     * Fila de campos con el marco dorado tipo Booking (PDF 27/07 §1, capturas
     * WA0005/WA0009): un marco continuo de 3px envuelve las celdas blancas y
     * asoma entre ellas como separador. El fondo del contenedor ES el marco,
     * por eso el gap entre celdas es de 3px y no un espaciado normal.
     */
    .sb__form {
      display: flex;
      align-items: stretch;
      gap: 3px;
      flex-wrap: wrap;
      background: var(--dk-gold);
      border: 3px solid var(--dk-gold);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-sm);
    }

    .sb__field {
      flex: 1 1 150px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      border-radius: 0;
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      transition: box-shadow var(--d-2);

      /* Sin overflow:hidden en el contenedor (el desplegable de mascotas debe
         salirse), así que el foco se marca con un anillo interior. */
      &:focus-within {
        box-shadow: inset 0 0 0 2px var(--c-accent);
      }
    }

    /*
     * Solo las celdas de los extremos redondean, y solo por el lado que hace
     * de esquina exterior de la tarjeta: las celdas del medio van a 0 (si no,
     * el radio completo de cada celda blanca sobre el fondo dorado dibuja un
     * "ojal" dorado en las junturas, arriba y abajo, entre cada par de
     * campos). En fila (desktop) las esquinas exteriores son las de
     * izquierda/derecha; apiladas en móvil (<861px, ver media query de
     * .sb__field/.sb__cta más abajo) pasan a ser arriba/abajo.
     */
    .sb__form > :first-child { border-radius: calc(var(--r-lg) - 3px) 0 0 calc(var(--r-lg) - 3px); }
    .sb__form > :last-child  { border-radius: 0 calc(var(--r-lg) - 3px) calc(var(--r-lg) - 3px) 0; }
    .sb__form > :first-child:last-child { border-radius: calc(var(--r-lg) - 3px); }

    .sb__field--where { flex: 2 1 240px; }
    .sb__field--pets  { flex: 1.1 1 190px; }
    .sb__field--hora  { flex: .7 1 120px; }

    /* El desplegable de mascotas debe poder salirse de su campo. */
    .sb__field--pets { position: relative; overflow: visible; }

    /* Ancla del calendario: cuelga del campo de entrada, no del formulario. */
    .sb__field--fechas { position: relative; overflow: visible; }

    /*
     * El disparador imita al input al que sustituye (mismo alto, misma
     * tipografía) para que la fila siga leyéndose como una sola barra y no
     * como "tres cajas y dos botones".
     */
    .sb__fecha {
      width: 100%;
      border: none; background: transparent; padding: 0;
      text-align: left; cursor: pointer;
      font-family: var(--font); font-size: var(--f-base);
    }
    .sb__fecha-txt {
      flex: 1; min-width: 0;
      padding-block: 2px;
      color: var(--t-100);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;

      &.is-vacio { color: var(--t-500); }
    }

    .sb__cal {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-3)); left: 0;
      /* Ancho fijo: colgando en absoluto encoge hasta el contenido, y la
         rejilla del calendario se queda en celdas de 20 px. */
      width: min(360px, 92vw);
      padding: var(--sp-4);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
      animation: sb-cal-in .18s cubic-bezier(.22, .9, .3, 1) both;
    }
    @keyframes sb-cal-in {
      from { opacity: 0; transform: translateY(-8px) scale(.97); }
      to   { opacity: 1; transform: none; }
    }

    .sb__cal-pie {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-3); margin-top: var(--sp-3);
    }
    .sb__cal-link {
      border: none; background: none; padding: 0; cursor: pointer;
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6);
      color: var(--t-400); text-decoration: underline;

      &:hover { color: var(--dk-blue); }
    }

    /* La cabecera y el velo son de la hoja de móvil: en escritorio el panel
       cuelga del campo y no necesita ni título ni fondo que lo aísle. */
    .sb__cal-cab, .sb__velo { display: none; }

    /*
     * Móvil: colgando del campo, el calendario tapaba el resto del buscador y
     * se salía de la pantalla por abajo —no había forma de llegar al pie—. Pasa
     * a ser una hoja inferior, que es el patrón con el que se eligen fechas en
     * el móvil de Booking y Airbnb: ocupa el ancho entero, sube desde abajo y
     * el velo deja claro que el resto de la página está en pausa.
     */
    @media (max-width: 640px) {
      .sb__velo {
        display: block;
        position: fixed; inset: 0; z-index: var(--z-3);
        background: rgba(0, 5, 30, .48);
        animation: sb-velo-in .2s ease both;
      }

      .sb__cal {
        position: fixed; inset: auto 0 0 0;
        width: 100%;
        max-height: 88vh; overflow-y: auto; overscroll-behavior: contain;
        z-index: var(--z-4);
        border: none;
        border-radius: var(--r-xl) var(--r-xl) 0 0;
        /* El respiro de abajo cuenta con la barra de gestos del móvil. */
        padding: var(--sp-4) var(--sp-5) calc(var(--sp-5) + env(safe-area-inset-bottom));
        animation: sb-hoja-in .26s cubic-bezier(.22, .9, .3, 1) both;
      }

      .sb__cal-cab {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--sp-3); margin-bottom: var(--sp-3);
      }
      .sb__cal-titulo {
        font-family: var(--font-display, var(--font));
        font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      }
      .sb__cal-x {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; flex-shrink: 0;
        border: 1px solid var(--b-2); border-radius: var(--r-full);
        background: var(--c-card); color: var(--t-300); cursor: pointer;
      }

      /* Botones a lo ancho: en la hoja son la acción final, no un pie discreto. */
      .sb__cal-pie { margin-top: var(--sp-4); }
      .sb__cal-pie .rs-btn { flex: 1; max-width: 60%; }
    }
    @keyframes sb-velo-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sb-hoja-in { from { transform: translateY(100%); } to { transform: none; } }
    @media (prefers-reduced-motion: reduce) {
      .sb__velo, .sb__cal { animation: none; }
    }

    .sb__lbl {
      font-family: var(--font-accent);
      font-size: var(--f-xs);
      font-weight: var(--w-7);
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--dk-blue);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sb__ctrl {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      color: var(--t-400);
    }

    .sb__inp {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      padding-block: 2px;
      font-family: var(--font);
      font-size: var(--f-base);
      color: var(--t-100);

      &::placeholder { color: var(--t-500); }
    }

    .sb__inp--select { cursor: pointer; }

    .sb__cta {
      flex: 0 0 auto;
      min-width: 170px;
      font-size: var(--f-md);
      font-weight: var(--w-7);
      box-shadow: var(--sh-md);
      /* El radio de esquina lo decide su posición en la fila (:first-child/
         :last-child arriba), no esta clase: si el botón cae en medio de la
         fila en algún layout futuro, no debe heredar redondeo de aquí. */
      border-radius: 0;
    }

    /* Variante compacta para las cabeceras de listado */
    .sb--strip {
      .sb__cats { padding-bottom: var(--sp-3); margin-bottom: var(--sp-3); }
      .sb__cat { min-width: 84px; padding: var(--sp-2); gap: var(--sp-1); }
      .sb__cat-icon { width: 26px; height: 26px; }
      .sb__field { padding-block: var(--sp-1); }
      .sb__cta { min-width: 120px; padding-block: var(--sp-3); font-size: var(--f-sm); }
    }

    @media (max-width: 860px) {
      .sb__field { flex: 1 1 100%; }
      .sb__cta { width: 100%; }

      /* Apiladas, la esquina exterior pasa de izq/der a arriba/abajo. */
      .sb__form > :first-child { border-radius: calc(var(--r-lg) - 3px) calc(var(--r-lg) - 3px) 0 0; }
      .sb__form > :last-child  { border-radius: 0 0 calc(var(--r-lg) - 3px) calc(var(--r-lg) - 3px); }
    }

    /*
     * Móvil: los campos del buscador son la interacción principal de la app, así
     * que cada uno tiene que ser un objetivo táctil cómodo (44px) y el texto de
     * 16px para que iOS no haga zoom al enfocar.
     */
    @media (max-width: 768px) {
      .sb__ctrl { min-height: 32px; }
      .sb__inp { font-size: var(--f-md); padding-block: var(--sp-2); }
      .sb__field { padding-block: var(--sp-2); }

      /*
       * El carrusel de categorías llega hasta el borde de la tarjeta: si se
       * queda dentro del padding, la pastilla cortada parece un fallo de
       * maquetación en vez de un "desliza para ver más".
       */
      .sb__cats {
        scroll-snap-type: x proximity;
        scroll-padding-inline: var(--sp-6);
        margin-inline: calc(var(--sp-6) * -1);
        padding-inline: var(--sp-6);
        -webkit-overflow-scrolling: touch;
      }
      .sb__cat { scroll-snap-align: center; }
    }
  `],
})
export class RsSearchBarComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly eventosService = inject(EventosService);

  /** Categoría inicial del buscador. */
  readonly vertical = input<string>(VerticalKey.ALOJAMIENTO);
  /** `card` en el home (tarjeta flotante), `strip` sobre los listados. */
  readonly variant = input<'card' | 'strip'>('card');
  /**
   * Muestra la fila de categorías con iconos dentro de la tarjeta. Las
   * pantallas actuales la traen apagada: en escritorio las categorías están en
   * la barra superior y en móvil, en la tira del encabezado (`rs-navbar`).
   */
  readonly categorias = input(true);
  /** En los listados, cambiar de categoría lanza la búsqueda al momento. */
  readonly buscarAlCambiar = input(false);

  /** Se emite además de navegar, por si la vista necesita reaccionar. */
  readonly buscado = output<BusquedaParams>();

  readonly verticales = VERTICALES_PUBLICOS;
  readonly iconoMas = CATEGORIA_ICONOS['mas'];

  readonly idCiudad = 'sb-ciudad';
  readonly idDesde = 'sb-desde';
  readonly idHasta = 'sb-hasta';
  readonly idHora = 'sb-hora';

  /** Mascotas de la reserva: viven fuera del formulario porque el selector es un componente propio. */
  readonly perroIds = signal<string[]>([]);
  readonly numPerros = signal(1);

  /** Coordenadas de la población elegida en el autocompletado, si las hubo. */
  private readonly coordenadas = signal<{ lat: number; lng: number } | null>(null);

  /** Categoría elegida por el usuario; si no ha tocado nada, manda el input. */
  private readonly seleccion = signal<string | null>(null);

  readonly activo = computed<VerticalUi>(() => verticalUi(this.seleccion() ?? this.vertical()));

  readonly formulario = this.fb.nonNullable.group({
    ciudad: [''],
    desde: [''],
    hasta: [''],
    hora: [''],
  });

  /** Panel del calendario desplegado bajo el campo de entrada. */
  readonly calendarioAbierto = signal(false);

  /**
   * Espejo en señales de lo que hay en el formulario: el calendario y los
   * disparadores son plantilla con `OnPush` alrededor, y necesitan una señal
   * de la que colgar, no un `FormControl`.
   */
  private readonly valoresFormulario = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });
  readonly entradaSel = computed(() => this.valoresFormulario().desde || null);
  readonly salidaSel = computed(() => this.valoresFormulario().hasta || null);

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    this.formulario.patchValue({
      ciudad: qp.get('ciudad') ?? '',
      desde: qp.get('desde') ?? '',
      hasta: qp.get('hasta') ?? '',
      hora: qp.get('hora') ?? '',
    });

    const ids = (qp.get('perroIds') ?? '').split(',').filter(Boolean);
    this.perroIds.set(ids);
    this.numPerros.set(Math.max(1, ids.length, Number(qp.get('perros')) || 1));

    const lat = Number(qp.get('lat'));
    const lng = Number(qp.get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && qp.get('lat')) {
      this.coordenadas.set({ lat, lng });
    }

    // Sobre un listado, cambiar cualquier campo relanza la búsqueda: no hay
    // botón "Buscar" que pulsar (P4). El debounce evita disparar una petición
    // por cada tecla mientras se escribe la ciudad.
    this.formulario.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(sonIguales), takeUntilDestroyed())
      .subscribe(() => {
        if (this.buscarAlCambiar()) this.buscar();
      });
  }

  /**
   * Elegir una población solo rellena el campo y guarda las coordenadas —que
   * alimentan el orden por distancia sin volver a pedir permiso de ubicación al
   * navegador—. La búsqueda la lanza el botón "Buscar" o Enter: elegir la
   * ciudad y salir disparado al listado dejaba fuera las fechas y las mascotas
   * que el usuario aún no había puesto (feedback 2026-08-30).
   *
   * Sobre un listado no hay botón que pulsar, así que allí sigue buscando al
   * momento, igual que cualquier otro cambio de la barra.
   */
  elegirPoblacion(lugar: CoordenadasLugar): void {
    this.coordenadas.set(Number.isFinite(lugar.lat) ? { lat: lugar.lat, lng: lugar.lng } : null);

    if (this.buscarAlCambiar()) {
      this.buscar();
      return;
    }

    // Elegido el dónde, lo siguiente es el cuándo: el calendario se abre solo
    // para encadenar los dos campos sin un clic de más.
    this.abrirCalendario();
  }

  abrirCalendario(): void {
    this.calendarioAbierto.set(true);
  }

  cerrarCalendario(): void {
    this.calendarioAbierto.set(false);
  }

  /**
   * Un rango cerrado (o el día suelto de las categorías de cita) ya no necesita
   * el panel: se guarda y se cierra, que es lo que espera quien acaba de pulsar
   * el segundo día.
   */
  elegirFechas(rango: RangoFechas): void {
    this.formulario.patchValue({ desde: rango.entrada ?? '', hasta: rango.salida ?? '' });
    if (!this.activo().reservaPorNoches || rango.salida) this.cerrarCalendario();
  }

  borrarFechas(): void {
    this.formulario.patchValue({ desde: '', hasta: '' });
  }

  /** Título de la hoja de fechas en móvil; también su etiqueta accesible. */
  readonly tituloFechas = computed(() =>
    this.activo().reservaPorNoches ? 'Entrada y salida' : 'Elige la fecha',
  );

  /** `2026-09-12` → `12 sep`, que es lo que cabe en el campo. */
  etiquetaFecha(iso: string | null): string {
    if (!iso) return '';
    const [, mes, dia] = iso.split('-').map(Number);
    return `${dia} ${MESES_CORTOS[mes - 1] ?? ''}`.trim();
  }

  /**
   * `pointerdown` y no `click`: elegir una población dispara el autocompletado
   * en `mousedown`, y con `click` el mismo gesto abría el calendario y lo
   * cerraba acto seguido. `pointerdown` llega **antes** de que se abra.
   */
  @HostListener('document:pointerdown', ['$event'])
  cerrarAlPulsarFuera(evento: Event): void {
    if (!this.calendarioAbierto()) return;
    const destino = evento.target as HTMLElement | null;
    if (!destino?.closest('.sb__field--fechas')) this.cerrarCalendario();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.cerrarCalendario();
  }

  seleccionarVertical(key: string): void {
    this.seleccion.set(key);
    this.cerrarCalendario();
    // Pulsar la categoría lleva directamente al resultado, esté donde esté el
    // buscador: es la acción que sustituye al botón "Buscar" (P4).
    this.buscar();
  }

  /** Enter en cualquier campo confirma la búsqueda, también sin botón. */
  buscar(): void {
    const params = this.valores();
    // Arranca el cronómetro del embudo: es el punto donde empieza a contar
    // la meta de reservar en menos de 30 segundos (T4).
    this.eventosService.iniciarEmbudo(params.vertical);
    this.buscado.emit(params);
    void this.router.navigate([this.activo().route], {
      queryParams: {
        ciudad: params.ciudad,
        desde: params.desde,
        hasta: params.hasta,
        hora: params.hora,
        perros: params.perros,
        perroIds: params.perroIds.length ? params.perroIds.join(',') : null,
        lat: this.coordenadas()?.lat ?? null,
        lng: this.coordenadas()?.lng ?? null,
      },
      // Conserva los filtros propios del listado (precio, rating…) que ya
      // estuvieran en la URL; los nulos los elimina.
      queryParamsHandling: 'merge',
    });
  }

  private valores(): BusquedaParams {
    const { ciudad, desde, hasta, hora } = this.formulario.getRawValue();
    const activo = this.activo();
    const ids = this.perroIds();
    return {
      vertical: activo.key,
      ciudad: ciudad.trim() || null,
      desde: desde || null,
      hasta: activo.reservaPorNoches ? hasta || null : null,
      hora: activo.pideHora ? hora || null : null,
      perros: Math.max(1, ids.length, this.numPerros()),
      perroIds: ids,
    };
  }
}

/** Dos estados del formulario son iguales si coinciden todos sus campos. */
function sonIguales(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
