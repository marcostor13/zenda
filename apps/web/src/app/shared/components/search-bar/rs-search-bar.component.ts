import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsPetPickerComponent } from '../pet-picker/rs-pet-picker.component';
import { RsPlaceAutocompleteComponent } from '../place-autocomplete/rs-place-autocomplete.component';
import { CoordenadasLugar } from '../../../core/geo/geo.service';
import { EventosService } from '../../../core/eventos/eventos.service';
import { CATEGORIA_ICONOS } from '../../media/images';
import { VERTICALES_UI, VerticalUi, verticalUi } from '../../verticales/verticales.config';

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
    ReactiveFormsModule, RouterLink, RsIconComponent,
    RsPetPickerComponent, RsPlaceAutocompleteComponent,
  ],
  template: `
<div class="sb" [class.sb--strip]="variant() === 'strip'">
  @if (categorias()) {
    <div class="sb__cats" role="tablist" aria-label="Categorías de servicio">
      @for (v of verticales; track v.key) {
        <button type="button" class="sb__cat" role="tab"
                [class.is-active]="activo().key === v.key"
                [attr.aria-selected]="activo().key === v.key"
                (click)="seleccionarVertical(v.key)">
          <img [src]="v.icono" alt="" class="sb__cat-icon" aria-hidden="true" />
          <span class="sb__cat-label">{{ v.labelCorto }}</span>
        </button>
      }
      <a class="sb__cat sb__cat--more" routerLink="/" fragment="categorias">
        <img [src]="iconoMas" alt="" class="sb__cat-icon" aria-hidden="true" />
        <span class="sb__cat-label">Más servicios</span>
      </a>
    </div>
  }

  <form class="sb__form" [formGroup]="formulario" (ngSubmit)="buscar()">
    <div class="sb__field sb__field--where">
      <label class="sb__lbl" [attr.for]="idCiudad">{{ activo().labelUbicacion }}</label>
      <rs-place-autocomplete formControlName="ciudad"
                             [inputId]="idCiudad"
                             [placeholder]="activo().placeholderUbicacion"
                             (lugarElegido)="elegirPoblacion($event)"
                             (confirmado)="buscar()" />
    </div>

    <div class="sb__field">
      <label class="sb__lbl" [attr.for]="idDesde">{{ activo().labelFecha }}</label>
      <div class="sb__ctrl">
        <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
        <input [id]="idDesde" formControlName="desde" type="date" class="sb__inp" />
      </div>
    </div>

    @if (activo().reservaPorNoches) {
      <div class="sb__field">
        <label class="sb__lbl" [attr.for]="idHasta">Salida</label>
        <div class="sb__ctrl">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
          <input [id]="idHasta" formControlName="hasta" type="date" class="sb__inp" />
        </div>
      </div>
    }

    @if (activo().pideHora) {
      <div class="sb__field sb__field--hora">
        <label class="sb__lbl" [attr.for]="idHora">Hora</label>
        <div class="sb__ctrl">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
          <input [id]="idHora" formControlName="hora" type="time" class="sb__inp" />
        </div>
      </div>
    }

    <div class="sb__field sb__field--pets">
      <span class="sb__lbl">¿Para qué mascota?</span>
      <rs-pet-picker [(perroIds)]="perroIds" [(numPerros)]="numPerros" />
    </div>

    <!-- El botón solo vive en el home: sobre un listado cualquier cambio ya
         relanza la búsqueda, así que un "Buscar" aparte sería un paso de más. -->
    @if (variant() === 'card') {
      <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg sb__cta">
        <rs-icon name="search" [size]="21" [stroke]="2.5"></rs-icon>
        <span>Buscar</span>
      </button>
    }
  </form>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* Fila de categorías */
    .sb__cats {
      display: flex;
      align-items: stretch;
      gap: var(--sp-2);
      overflow-x: auto;
      padding-bottom: var(--sp-4);
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

    /* Fila de campos */
    .sb__form {
      display: flex;
      align-items: stretch;
      gap: var(--sp-3);
      flex-wrap: wrap;
    }

    .sb__field {
      flex: 1 1 150px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      border: 1px solid var(--b-2);
      border-radius: var(--r-md);
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within {
        border-color: var(--c-accent);
        box-shadow: 0 0 0 3px var(--c-accent-lo);
      }
    }

    .sb__field--where { flex: 2 1 240px; }
    .sb__field--pets  { flex: 1.1 1 190px; }
    .sb__field--hora  { flex: .7 1 120px; }

    /* El desplegable de mascotas debe poder salirse de su campo. */
    .sb__field--pets { position: relative; overflow: visible; }

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
  /** Muestra la fila de categorías con iconos. */
  readonly categorias = input(true);
  /** En los listados, cambiar de categoría lanza la búsqueda al momento. */
  readonly buscarAlCambiar = input(false);

  /** Se emite además de navegar, por si la vista necesita reaccionar. */
  readonly buscado = output<BusquedaParams>();

  readonly verticales = VERTICALES_UI;
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
   * Elegir una población es una acción de búsqueda, no solo de escritura:
   * "pulsar la provincia debe llevarme al resultado" (P4). Además guarda las
   * coordenadas, que alimentan el orden por distancia sin volver a pedir permiso
   * de ubicación al navegador.
   */
  elegirPoblacion(lugar: CoordenadasLugar): void {
    this.coordenadas.set(Number.isFinite(lugar.lat) ? { lat: lugar.lat, lng: lugar.lng } : null);
    this.buscar();
  }

  seleccionarVertical(key: string): void {
    this.seleccion.set(key);
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
