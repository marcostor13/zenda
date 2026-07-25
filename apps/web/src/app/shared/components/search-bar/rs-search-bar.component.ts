import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { VerticalKey } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { CATEGORIA_ICONOS } from '../../media/images';
import { VERTICALES_UI, VerticalUi, verticalUi } from '../../verticales/verticales.config';

/** Parámetros de búsqueda: mismo contrato en toda la aplicación (URL incluida). */
export interface BusquedaParams {
  vertical: string;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  perros: number;
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
  imports: [ReactiveFormsModule, RouterLink, RsIconComponent],
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
      <div class="sb__ctrl">
        <rs-icon name="map-pin" [size]="18" [stroke]="2"></rs-icon>
        <input [id]="idCiudad" formControlName="ciudad" class="sb__inp"
               [placeholder]="activo().placeholderUbicacion" autocomplete="off" />
      </div>
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

    <div class="sb__field sb__field--pets">
      <label class="sb__lbl" [attr.for]="idPerros">Mascotas</label>
      <div class="sb__ctrl">
        <rs-icon name="paw" [size]="18" [stroke]="2"></rs-icon>
        <select [id]="idPerros" formControlName="perros" class="sb__inp sb__inp--select">
          @for (n of opcionesPerros; track n) {
            <option [value]="n">{{ n }} {{ n === 1 ? 'perro' : 'perros' }}</option>
          }
        </select>
      </div>
    </div>

    <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg sb__cta">
      <rs-icon name="search" [size]="18" [stroke]="2.5"></rs-icon>
      <span>Buscar</span>
    </button>
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
        border-color: rgba(8,37,139,.22);
        background: var(--c-accent-lo);
        color: var(--dk-blue);
        box-shadow: inset 0 -3px 0 var(--dk-gold);
      }
    }

    .sb__cat-icon { width: 34px; height: 34px; }

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
    .sb__field--pets  { flex: .9 1 140px; }

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
      min-width: 148px;
      font-size: var(--f-md);
      font-weight: var(--w-7);
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
  readonly opcionesPerros = [1, 2, 3, 4];

  readonly idCiudad = 'sb-ciudad';
  readonly idDesde = 'sb-desde';
  readonly idHasta = 'sb-hasta';
  readonly idPerros = 'sb-perros';

  /** Categoría elegida por el usuario; si no ha tocado nada, manda el input. */
  private readonly seleccion = signal<string | null>(null);

  readonly activo = computed<VerticalUi>(() => verticalUi(this.seleccion() ?? this.vertical()));

  readonly formulario = this.fb.nonNullable.group({
    ciudad: [''],
    desde: [''],
    hasta: [''],
    perros: [1],
  });

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    this.formulario.patchValue({
      ciudad: qp.get('ciudad') ?? '',
      desde: qp.get('desde') ?? '',
      hasta: qp.get('hasta') ?? '',
      perros: Number(qp.get('perros')) || 1,
    });
  }

  seleccionarVertical(key: string): void {
    this.seleccion.set(key);
    if (this.buscarAlCambiar()) this.buscar();
  }

  buscar(): void {
    const params = this.valores();
    this.buscado.emit(params);
    void this.router.navigate([this.activo().route], {
      queryParams: {
        ciudad: params.ciudad,
        desde: params.desde,
        hasta: params.hasta,
        perros: params.perros,
      },
      // Conserva los filtros propios del listado (precio, rating…) que ya
      // estuvieran en la URL; los nulos los elimina.
      queryParamsHandling: 'merge',
    });
  }

  private valores(): BusquedaParams {
    const { ciudad, desde, hasta, perros } = this.formulario.getRawValue();
    const porNoches = this.activo().reservaPorNoches;
    return {
      vertical: this.activo().key,
      ciudad: ciudad.trim() || null,
      desde: desde || null,
      hasta: porNoches ? hasta || null : null,
      perros: perros || 1,
    };
  }
}
