import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, startWith } from 'rxjs';
import {
  ESPECIE_MASCOTA_LABELS, MODALIDAD_TRANSPORTE_LABELS, MODO_PRECIO_TRANSPORTE_LABELS, ModalidadTransporte,
  ModoHorarioTransporte, ModoPrecioTransporte, PREFERENCIA_TRANSPORTE_LABELS, TamanoPerro, TarifarioTransporte,
  TipoServicioTransporte, cotizarTransporte,
} from 'shared';
import { OpcionElegible, RsOpcionesComponent } from '../../../shared/components/opciones/rs-opciones.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { PROVINCIAS_ES } from '../../../shared/catalogos/lugares.catalogo';
import { zonaPrecioGrupo } from './tarifario-transporte';

const aOpciones = <T extends string>(labels: Record<T, string>): OpcionElegible[] =>
  (Object.keys(labels) as T[]).map((valor) => ({ valor, etiqueta: labels[valor] }));

/** Viaje de muestra para el ejemplo de precio: lo típico, Castellón → Valencia. */
const KM_EJEMPLO = 70;

/**
 * Tarifario del transportista (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md, F1).
 *
 * El cliente no ve nada de esto: describe su viaje y Doogking lo traduce a
 * estas reglas. Por eso aquí se pregunta en términos del negocio —cómo cobras,
 * qué modalidades haces, qué suplementos tienes— y se enseña al lado un
 * ejemplo con el precio final que vería un cliente, calculado con la misma
 * función que usa el servidor.
 */
@Component({
  selector: 'app-tarifario-transporte',
  standalone: true,
  imports: [ReactiveFormsModule, RsOpcionesComponent, RsIconComponent, EurosPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="tt" [formGroup]="grupo()">
  <h2 class="section-title">{{ 'Cómo cobras el trayecto' | t }}</h2>
  <p class="rs-field-hint">{{ 'El cliente sólo verá el precio final del viaje; nunca cómo lo calculas.' | t }}</p>
  <rs-opciones formControlName="modoPrecio" leyenda="Modo de precio" [leyendaVisible]="false" [opciones]="opcionesModo" [columnas]="3" />

  @switch (grupo().value.modoPrecio) {
    @case ('por_km') {
      <div class="tt__fila">
        <label class="rs-field"><span class="rs-lbl">{{ 'Tarifa base (€) *' | t }}</span>
          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaBase" inputmode="decimal"></label>
        <label class="rs-field"><span class="rs-lbl">{{ 'Precio por km (€) *' | t }}</span>
          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaKm" inputmode="decimal"></label>
        <label class="rs-field"><span class="rs-lbl">{{ 'Distancia mínima facturable (km)' | t }}</span>
          <input class="rs-inp" type="number" min="0" formControlName="distanciaMinimaKm" inputmode="numeric"></label>
      </div>
    }
    @case ('fijo') {
      <label class="rs-field"><span class="rs-lbl">{{ 'Precio por trayecto dentro de tu zona (€)' | t }}</span>
        <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioFijo" inputmode="decimal"></label>
    }
    @case ('por_zona') {
      <p class="rs-field-hint">{{ 'Precio entre dos provincias. Vale en los dos sentidos; las rutas sin precio se piden como presupuesto.' | t }}</p>
      <div formArrayName="zonasPrecio" class="tt__zonas">
        @for (z of zonas.controls; track $index; let i = $index) {
          <div [formGroupName]="i" class="tt__zona">
            <select class="rs-inp" formControlName="origen" [attr.aria-label]="'Provincia de origen' | t">
              <option value="">{{ 'Origen' | t }}</option>
              @for (p of provincias; track p) { <option [value]="p">{{ p }}</option> }
            </select>
            <rs-icon name="arrow-left-right" [size]="16" [stroke]="2"></rs-icon>
            <select class="rs-inp" formControlName="destino" [attr.aria-label]="'Provincia de destino' | t">
              <option value="">{{ 'Destino' | t }}</option>
              @for (p of provincias; track p) { <option [value]="p">{{ p }}</option> }
            </select>
            <input class="rs-inp tt__precio" type="number" min="0" step="0.01" formControlName="precio" [placeholder]="'€' | t" inputmode="decimal">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="zonas.removeAt(i)" [attr.aria-label]="'Quitar' | t">
              <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon>
            </button>
          </div>
        }
      </div>
      <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="anadirZona()">
        <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir ruta con precio' | t }}
      </button>
    }
  }

  <h2 class="section-title">{{ 'Modalidades que ofreces' | t }}</h2>
  <rs-opciones formControlName="modalidades" leyenda="Modalidades" [leyendaVisible]="false" variante="chip" [multiple]="true" [opciones]="opcionesModalidad" />
  <div class="tt__fila">
    @if (ofrece('exclusivo')) {
      <label class="rs-field"><span class="rs-lbl">{{ 'Suplemento por viaje exclusivo (€)' | t }}</span>
        <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioExclusivo" inputmode="decimal"></label>
    }
    @if (ofrece('compartido')) {
      <label class="rs-field"><span class="rs-lbl">{{ 'Tiempo extra por paradas en compartido (min)' | t }}</span>
        <input class="rs-inp" type="number" min="0" formControlName="tiempoExtraCompartidoMin" inputmode="numeric"></label>
    }
    @if (ofrece('con_propietario')) {
      <label class="rs-field"><span class="rs-lbl">{{ 'Plazas para acompañantes' | t }}</span>
        <input class="rs-inp" type="number" min="1" formControlName="plazasPasajeros" inputmode="numeric"></label>
    }
  </div>

  <h2 class="section-title">{{ 'Qué animales transportas' | t }}</h2>
  <rs-opciones formControlName="especiesAceptadas" leyenda="Especies" [leyendaVisible]="false" variante="chip" [multiple]="true" [opciones]="opcionesEspecies" />

  <h2 class="section-title">{{ 'Incluido en el precio' | t }}</h2>
  <p class="rs-field-hint">{{ 'El cliente puede filtrar por estas opciones: marca sólo lo que haces siempre.' | t }}</p>
  <rs-opciones formControlName="incluidos" leyenda="Incluidos" [leyendaVisible]="false" variante="chip" [multiple]="true" [opciones]="opcionesIncluidos" />

  <h2 class="section-title">{{ 'Urgencias y horario' | t }}</h2>
  <div class="checkbox-row">
    <label class="rs-checkbox"><input type="checkbox" formControlName="aceptaUrgentes"> {{ 'Acepto traslados urgentes' | t }}</label>
    <label class="rs-checkbox"><input type="checkbox" formControlName="aceptaLoAntesPosible"> {{ 'Acepto «lo antes posible»' | t }}</label>
  </div>
  <p class="rs-field-hint">{{ 'Los viajes urgentes o sin hora cerrada los tendrás que aceptar desde tus reservas; si no respondes a tiempo, se devuelve el dinero al cliente.' | t }}</p>

  <h2 class="section-title">{{ 'Suplementos' | t }}</h2>
  <p class="rs-field-hint">{{ 'Déjalos vacíos si no los cobras. Se suman solos cuando el viaje lo requiere.' | t }}</p>
  <div formGroupName="suplementos" class="tt__rejilla">
    @for (s of suplementos; track s.control) {
      <label class="rs-field"><span class="rs-lbl">{{ s.etiqueta | t }}</span>
        <input class="rs-inp" type="number" min="0" step="0.01" [formControlName]="s.control" inputmode="decimal"></label>
    }
  </div>

  <h2 class="section-title">{{ 'Cuándo prefieres presupuestar a medida' | t }}</h2>
  <div formGroupName="reglasPresupuesto" class="tt__presupuesto">
    <div class="checkbox-row">
      <label class="rs-checkbox"><input type="checkbox" formControlName="internacional"> {{ 'Viajes internacionales' | t }}</label>
      <label class="rs-checkbox"><input type="checkbox" formControlName="necesidadesEspeciales"> {{ 'Necesidades especiales' | t }}</label>
      <label class="rs-checkbox"><input type="checkbox" formControlName="especiesExoticas"> {{ 'Animales que no son perro ni gato' | t }}</label>
    </div>
    <div class="tt__fila">
      <label class="rs-field"><span class="rs-lbl">{{ 'Más de estas mascotas' | t }}</span>
        <input class="rs-inp" type="number" min="1" formControlName="masDeMascotas" inputmode="numeric"></label>
      <label class="rs-field"><span class="rs-lbl">{{ 'Más de estos km' | t }}</span>
        <input class="rs-inp" type="number" min="1" formControlName="masDeKm" inputmode="numeric"></label>
    </div>
  </div>

  <h2 class="section-title">{{ 'Política de cancelación' | t }}</h2>
  <div formGroupName="cancelacion" class="tt__fila">
    <label class="rs-field"><span class="rs-lbl">{{ 'Cancelación gratuita hasta (horas antes)' | t }}</span>
      <input class="rs-inp" type="number" min="0" formControlName="gratisHastaHoras" inputmode="numeric"></label>
    <label class="rs-field"><span class="rs-lbl">{{ 'Después se devuelve (%)' | t }}</span>
      <input class="rs-inp" type="number" min="0" max="100" formControlName="reembolsoTardioPct" inputmode="numeric"></label>
  </div>

  <aside class="tt__ejemplo" aria-live="polite">
    <p class="rs-label-caps">{{ 'Así lo vería un cliente' | t }}</p>
    <p class="tt__ejemplo-ruta">{{ 'Viaje de {km} km, un perro mediano' | t: { km: kmEjemplo } }}</p>
    @for (e of ejemplo(); track e.modalidad) {
      <div class="tt__ejemplo-fila">
        <span>{{ e.etiqueta | t }}</span>
        <strong>
          @switch (e.estado) {
            @case ('precio') { {{ e.total | euros }} }
            @case ('presupuesto') { {{ 'Presupuesto a medida' | t }} }
            @default { {{ 'Revisa esta modalidad' | t }} }
          }
        </strong>
      </div>
    } @empty {
      <p class="rs-field-hint">{{ 'Elige al menos una modalidad para ver el ejemplo.' | t }}</p>
    }
  </aside>
</div>
  `,
  styles: [`
    :host { display: block; }
    .tt { display: flex; flex-direction: column; gap: var(--sp-3); }
    .tt__fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-3); }
    .tt__rejilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--sp-3); }
    .tt__zonas { display: flex; flex-direction: column; gap: var(--sp-2); }
    .tt__zona { display: grid; grid-template-columns: 1fr auto 1fr 110px auto; gap: var(--sp-2); align-items: center;
      rs-icon { color: var(--t-400); }
    }
    .tt__presupuesto { display: flex; flex-direction: column; gap: var(--sp-3); }
    .tt__ejemplo { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); padding: var(--sp-4);
      border-radius: var(--r-xl); border: 1px solid var(--dk-blue); background: var(--c-accent-lo);
      p { margin: 0; }
    }
    .tt__ejemplo-ruta { font-size: var(--f-sm); color: var(--t-300); }
    .tt__ejemplo-fila { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: var(--f-sm);
      strong { font-family: var(--font-display); color: var(--dk-blue-text); }
    }
    @media (max-width: 640px) {
      .tt__zona { grid-template-columns: 1fr 1fr; }
      .tt__zona rs-icon { display: none; }
    }
  `],
})
export class TarifarioTransporteComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  /** El grupo `transporte` del formulario de la ficha. */
  readonly grupo = input.required<FormGroup>();

  readonly opcionesModo = aOpciones(MODO_PRECIO_TRANSPORTE_LABELS);
  readonly opcionesModalidad = aOpciones(MODALIDAD_TRANSPORTE_LABELS);
  readonly opcionesEspecies = aOpciones(ESPECIE_MASCOTA_LABELS);
  readonly opcionesIncluidos = aOpciones(PREFERENCIA_TRANSPORTE_LABELS);
  readonly provincias = PROVINCIAS_ES;
  readonly kmEjemplo = KM_EJEMPLO;

  readonly suplementos: ReadonlyArray<{ control: string; etiqueta: string }> = [
    { control: 'urgente', etiqueta: 'Traslado urgente (€)' },
    { control: 'nocturno', etiqueta: 'Recogida nocturna, 22–7 h (€)' },
    { control: 'mascotaAdicional', etiqueta: 'Cada mascota adicional (€)' },
    { control: 'mascotaGrande', etiqueta: 'Mascota de más de 25 kg (€)' },
    { control: 'medicacion', etiqueta: 'Administrar medicación (€)' },
    { control: 'largaDistanciaDesdeKm', etiqueta: 'Larga distancia a partir de (km)' },
    { control: 'largaDistancia', etiqueta: 'Suplemento de larga distancia (€)' },
    { control: 'porPersona', etiqueta: 'Cada acompañante (€)' },
    { control: 'porMaleta', etiqueta: 'Cada maleta (€)' },
  ];

  private readonly valor = signal<Record<string, unknown>>({});

  readonly ejemplo = computed(() => {
    const v = this.valor();
    const tarifa = this.tarifarioDe(v);
    return (tarifa.modalidades ?? []).map((modalidad) => {
      const cotizacion = cotizarTransporte(tarifa, {
        tipoServicio: TipoServicioTransporte.SOLO_IDA,
        origen: { texto: '' }, destino: { texto: '' }, fecha: '',
        modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '10:00',
        mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
        necesidades: [], preferencias: [], modalidad, personas: 1,
      }, {
        km: KM_EJEMPLO, horasHastaRecogida: 999,
        // Sin provincias reales, el modo por zonas se ilustra con la primera ruta declarada.
        provinciaOrigen: tarifa.zonasPrecio?.[0]?.origen, provinciaDestino: tarifa.zonasPrecio?.[0]?.destino,
      });
      return { modalidad, etiqueta: MODALIDAD_TRANSPORTE_LABELS[modalidad], estado: cotizacion.estado, total: cotizacion.total };
    });
  });

  constructor() {
    toObservable(this.grupo)
      .pipe(switchMap((g) => g.valueChanges.pipe(startWith(g.getRawValue()))), takeUntilDestroyed())
      .subscribe(() => this.valor.set(this.grupo().getRawValue()));
  }

  get zonas(): FormArray {
    return this.grupo().get('zonasPrecio') as FormArray;
  }

  ofrece(modalidad: string): boolean {
    return ((this.valor()['modalidades'] as string[] | undefined) ?? []).includes(modalidad);
  }

  anadirZona(): void {
    this.zonas.push(zonaPrecioGrupo(this.fb));
  }

  /** Los mismos campos que lee el API, con los números vacíos como «no se cobra». */
  private tarifarioDe(v: Record<string, unknown>): TarifarioTransporte {
    const numero = (x: unknown): number | undefined => (x === null || x === '' || x === undefined ? undefined : Number(x));
    const suplementos = Object.fromEntries(
      Object.entries((v['suplementos'] as Record<string, unknown>) ?? {}).map(([k, x]) => [k, numero(x)]),
    );
    return {
      modoPrecio: (v['modoPrecio'] as ModoPrecioTransporte | undefined) ?? ModoPrecioTransporte.POR_KM,
      tarifaBase: numero(v['tarifaBase']) ?? 0,
      tarifaKm: numero(v['tarifaKm']) ?? 0,
      precioFijo: numero(v['precioFijo']),
      zonasPrecio: (v['zonasPrecio'] as TarifarioTransporte['zonasPrecio']) ?? [],
      distanciaMinimaKm: numero(v['distanciaMinimaKm']),
      modalidades: (v['modalidades'] as ModalidadTransporte[] | undefined) ?? [],
      precioExclusivo: numero(v['precioExclusivo']),
      suplementos,
      capacidadPerros: numero(v['capacidadPerros']) ?? 1,
      plazasPasajeros: numero(v['plazasPasajeros']) ?? 0,
      especiesAceptadas: ['perro'],
    };
  }
}
