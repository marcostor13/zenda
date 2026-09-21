import { ChangeDetectionStrategy, Component, Input, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  COMPORTAMIENTOS_MASCOTA, CONFIRMACION_ENTREGA_LABELS, ConfirmacionEntrega,
  ESPECIES_TRANSPORTE, FLEXIBILIDAD_HORARIA_LABELS, FRANJA_RECOGIDA_LABELS, FlexibilidadHoraria,
  FranjaRecogida, MODALIDAD_VIAJE_LABELS, ModalidadViaje, NECESIDADES_MASCOTA,
  NECESIDAD_TRANSPORTE_LABELS, NecesidadTransporte, PREFERENCIAS_VIAJE, RESPONSABLE_ENTREGA_LABELS,
  ResponsableEntrega, TRAMOS_PESO_TRANSPORTE, type DesglosePrecioTransporte,
} from 'shared';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import {
  RsPlaceAutocompleteComponent, type LugarElegido,
} from '../../../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';

/** Un suplemento del transportista, tal y como se le enseña al cliente. */
export interface SuplementoOfrecido {
  readonly clave: string;
  readonly nombre: string;
  readonly importe: number;
}

/**
 * El paso 1 de una reserva de transporte de mascotas.
 *
 * Vive fuera de `reserva-wizard` porque este vertical pregunta mucho más que
 * los demás —quién viaja, cómo se porta la mascota, quién la recoge y quién la
 * recibe— y meterlo en el componente que ya sirve a ocho verticales lo haría
 * ilegible.
 *
 * El orden de las preguntas es el del documento de flujo: **necesidad → ruta →
 * fecha → mascota → modalidad → contactos**. Y ninguna de ellas habla de
 * tarifas: el cliente describe lo que necesita y Doogking lo traduce al sistema
 * de precios de cada empresa. Nunca se le pregunta si prefiere pagar «por km» o
 * «por zona».
 */
@Component({
  selector: 'dk-paso-transporte',
  standalone: true,
  imports: [
    ReactiveFormsModule, RsIconComponent, RsPlaceAutocompleteComponent, TraducirPipe, EurosPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<form class="tr" [formGroup]="grupo">

  <!-- 1 · ¿Qué necesitas? ------------------------------------------------ -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ '¿Qué tipo de servicio necesitas?' | t }}</legend>
    <div class="tr__tarjetas" role="radiogroup" [attr.aria-label]="'Tipo de servicio' | t">
      @for (n of necesidades; track n) {
        <button type="button" class="tr__tarjeta" role="radio"
                [class.is-on]="grupo.get('necesidad')?.value === n"
                [attr.aria-checked]="grupo.get('necesidad')?.value === n"
                [attr.data-testid]="'necesidad-' + n"
                (click)="elegirNecesidad(n)">
          {{ necesidadLabel(n) | t }}
        </button>
      }
    </div>
  </fieldset>

  <!-- 2 · ¿Dónde? --------------------------------------------------------- -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ '¿Dónde llevamos a tu rey?' | t }}</legend>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-origen">{{ 'Dirección de recogida (origen)' | t }}</label>
      <div class="rs-inp rs-inp--lg rs-inp--host">
        <rs-place-autocomplete formControlName="origen" inputId="wz-origen"
                               [placeholder]="'Ej. Madrid' | t"
                               (lugarElegido)="origenElegido.emit($event)" />
      </div>
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-destino">{{ 'Destino' | t }}</label>
      <div class="rs-inp rs-inp--lg rs-inp--host">
        <rs-place-autocomplete formControlName="destino" inputId="wz-destino"
                               [placeholder]="'Ej. Toledo' | t"
                               (lugarElegido)="destinoElegido.emit($event)" />
      </div>
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-distancia">{{ 'Distancia del trayecto (km)' | t }}</label>
      <input id="wz-distancia" formControlName="distanciaKm" type="number"
             class="rs-inp rs-inp--lg" min="1" inputmode="numeric" />
      @if (calculando()) {
        <span class="rs-field-hint">{{ 'Calculando la distancia…' | t }}</span>
      } @else if (resumenTrayecto()) {
        <span class="rs-field-hint">{{ resumenTrayecto() }}</span>
      } @else {
        <span class="rs-field-hint">
          {{ 'Elige origen y destino y la calculamos por ti.' | t }}
        </span>
      }
    </div>

    @if (admiteParadas()) {
      <div class="rs-field">
        <label class="rs-lbl" for="wz-paradas">{{ 'Paradas intermedias' | t }}</label>
        <input id="wz-paradas" formControlName="paradasExtra" type="number"
               class="rs-inp rs-inp--lg" min="0" inputmode="numeric" />
      </div>
    }
  </fieldset>

  <!-- 3 · ¿Cuándo? -------------------------------------------------------- -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ '¿Cuándo necesitas el transporte?' | t }}</legend>

    <div class="tr__fila">
      <div class="rs-field">
        <label class="rs-lbl" for="wz-fecha">{{ 'Fecha de recogida' | t }}</label>
        <input id="wz-fecha" formControlName="fechaRecogida" type="date" class="rs-inp rs-inp--lg" />
      </div>
      <div class="rs-field">
        <label class="rs-lbl" for="wz-flex">{{ 'Horario' | t }}</label>
        <select id="wz-flex" formControlName="flexibilidad" class="rs-inp rs-inp--lg">
          @for (f of flexibilidades; track f) {
            <option [value]="f">{{ flexibilidadLabel(f) | t }}</option>
          }
        </select>
      </div>
    </div>

    <!-- Campos condicionales: la hora exacta solo se pide a quien la necesita. -->
    @if (grupo.get('flexibilidad')?.value === 'hora_concreta') {
      <div class="rs-field">
        <label class="rs-lbl" for="wz-hora">{{ 'Hora de recogida' | t }}</label>
        <input id="wz-hora" formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
      </div>
    }
    @if (grupo.get('flexibilidad')?.value === 'flexible') {
      <div class="rs-field">
        <label class="rs-lbl" for="wz-franja">{{ 'Franja que te viene bien' | t }}</label>
        <select id="wz-franja" formControlName="franja" class="rs-inp rs-inp--lg">
          @for (f of franjas; track f) {
            <option [value]="f">{{ franjaLabel(f) | t }}</option>
          }
        </select>
      </div>
    }

    @if (esIdaVuelta()) {
      <div class="rs-field">
        <label class="rs-lbl" for="wz-espera">{{ 'Tiempo de espera estimado (minutos)' | t }}</label>
        <input id="wz-espera" formControlName="esperaMinutos" type="number" min="0" step="5"
               class="rs-inp rs-inp--lg" inputmode="numeric" />
        <span class="rs-field-hint">
          {{ 'Para llevar y traer del veterinario: el transportista espera y os devuelve a casa.' | t }}
        </span>
      </div>
    }
  </fieldset>

  <!-- 4 · ¿Quién viaja? --------------------------------------------------- -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ 'Cuéntanos quién viaja' | t }}</legend>

    <div class="tr__fila">
      <div class="rs-field">
        <label class="rs-lbl" for="wz-especie">{{ 'Tipo de mascota' | t }}</label>
        <select id="wz-especie" formControlName="especie" class="rs-inp rs-inp--lg">
          @for (e of especies; track e.valor) {
            <option [value]="e.valor">{{ e.etiqueta | t }}</option>
          }
        </select>
      </div>
      <div class="rs-field">
        <label class="rs-lbl" for="wz-peso">{{ 'Peso o tamaño' | t }}</label>
        <select id="wz-peso" formControlName="tramoPeso" class="rs-inp rs-inp--lg">
          @for (t of tamanos; track t.valor) {
            <option [value]="t.valor">{{ t.etiqueta | t }}</option>
          }
        </select>
      </div>
      <div class="rs-field">
        <label class="rs-lbl" for="wz-mascotas">{{ 'Número de mascotas' | t }}</label>
        <input id="wz-mascotas" formControlName="perros" type="number" min="1"
               class="rs-inp rs-inp--lg" inputmode="numeric" />
      </div>
    </div>

    <div class="rs-field">
      <span class="rs-lbl">{{ 'Necesidades especiales' | t }}</span>
      <div class="tr__checks">
        @for (n of necesidadesMascota; track n.valor) {
          <label class="rs-checkbox">
            <input type="checkbox" [checked]="tiene('necesidades', n.valor)"
                   (change)="alternar('necesidades', n.valor)"> {{ n.etiqueta | t }}
          </label>
        }
      </div>
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-comportamiento">{{ '¿Cómo se porta en el coche?' | t }}</label>
      <select id="wz-comportamiento" formControlName="comportamiento" class="rs-inp rs-inp--lg">
        @for (c of comportamientos; track c.valor) {
          <option [value]="c.valor">{{ c.etiqueta | t }}</option>
        }
      </select>
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-notas">{{ 'Información importante para el transportista' | t }}</label>
      <textarea id="wz-notas" formControlName="notasMascota" class="rs-inp rs-inp--lg" rows="3"
                [placeholder]="'Medicación, miedos, costumbres…' | t"></textarea>
    </div>
  </fieldset>

  <!-- 5 · Modalidad del viaje --------------------------------------------- -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ 'Elige cómo quieres realizar el trayecto' | t }}</legend>

    <div class="tr__tarjetas" role="radiogroup" [attr.aria-label]="'Modalidad del viaje' | t">
      @for (m of modalidades; track m) {
        <button type="button" class="tr__tarjeta" role="radio"
                [class.is-on]="grupo.get('modalidad')?.value === m"
                [attr.aria-checked]="grupo.get('modalidad')?.value === m"
                [attr.data-testid]="'modalidad-' + m"
                (click)="elegirModalidad(m)">
          {{ modalidadLabel(m) | t }}
        </button>
      }
    </div>

    @if (viajaElResponsable()) {
      <div class="tr__fila">
        <div class="rs-field">
          <label class="rs-lbl" for="wz-pasajeros">{{ 'Número de personas' | t }}</label>
          <input id="wz-pasajeros" formControlName="pasajeros" type="number" min="1" max="4"
                 class="rs-inp rs-inp--lg" inputmode="numeric" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="wz-equipaje">{{ 'Equipaje' | t }}</label>
          <select id="wz-equipaje" formControlName="equipaje" class="rs-inp rs-inp--lg">
            <option value="sin_equipaje">{{ 'Sin equipaje' | t }}</option>
            <option value="bolso">{{ 'Bolso o mochila' | t }}</option>
            <option value="maleta">{{ 'Maleta' | t }}</option>
            <option value="varias_maletas">{{ 'Varias maletas' | t }}</option>
          </select>
        </div>
      </div>
    }

    <div class="rs-field">
      <span class="rs-lbl">{{ 'Preferencias (opcional)' | t }}</span>
      <div class="tr__checks">
        @for (p of preferencias; track p.valor) {
          <label class="rs-checkbox">
            <input type="checkbox" [checked]="tiene('preferencias', p.valor)"
                   (change)="alternar('preferencias', p.valor)"> {{ p.etiqueta | t }}
          </label>
        }
      </div>
    </div>

    @if (suplementos().length) {
      <div class="rs-field">
        <span class="rs-lbl">{{ 'Servicios de este transportista' | t }}</span>
        <div class="tr__extras">
          @for (s of suplementos(); track s.clave) {
            <label class="tr__extra" [class.is-on]="tiene('suplementos', s.clave)">
              <input type="checkbox" [checked]="tiene('suplementos', s.clave)"
                     (change)="alternar('suplementos', s.clave)"
                     [attr.data-testid]="'extra-' + s.clave" />
              <span class="tr__extra-icono"><rs-icon name="sparkles" [size]="16" [stroke]="2" /></span>
              <span class="tr__extra-info">
                <span class="tr__extra-nombre">{{ s.nombre | t }}</span>
                <span class="tr__extra-precio">{{ s.importe | euros }}</span>
              </span>
            </label>
          }
        </div>
      </div>
    }
  </fieldset>

  <!-- 6 · Recogida y entrega ---------------------------------------------- -->
  <fieldset class="tr__bloque">
    <legend class="tr__leyenda">{{ 'Últimos detalles del viaje' | t }}</legend>

    <div class="tr__fila">
      <div class="rs-field">
        <label class="rs-lbl" for="wz-quien-entrega">{{ '¿Quién entrega la mascota?' | t }}</label>
        <select id="wz-quien-entrega" formControlName="quienEntrega" class="rs-inp rs-inp--lg">
          @for (r of responsablesEntrega; track r) {
            <option [value]="r">{{ responsableLabel(r) | t }}</option>
          }
        </select>
      </div>
      @if (grupo.get('quienEntrega')?.value !== 'yo') {
        <div class="rs-field">
          <label class="rs-lbl" for="wz-entrega-nombre">{{ 'Nombre de contacto' | t }}</label>
          <input id="wz-entrega-nombre" formControlName="contactoRecogidaNombre" class="rs-inp rs-inp--lg" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="wz-entrega-tel">{{ 'Teléfono' | t }}</label>
          <input id="wz-entrega-tel" formControlName="contactoRecogidaTelefono" type="tel" class="rs-inp rs-inp--lg" />
        </div>
      }
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-indic-recogida">{{ 'Indicaciones de recogida' | t }}</label>
      <input id="wz-indic-recogida" formControlName="indicacionesRecogida" class="rs-inp rs-inp--lg"
             [placeholder]="'Portal, piso, dónde aparcar…' | t" />
    </div>

    <div class="tr__fila">
      <div class="rs-field">
        <label class="rs-lbl" for="wz-quien-recibe">{{ '¿Quién recibe la mascota?' | t }}</label>
        <select id="wz-quien-recibe" formControlName="quienRecibe" class="rs-inp rs-inp--lg">
          @for (r of responsablesEntrega; track r) {
            <option [value]="r">{{ responsableLabel(r) | t }}</option>
          }
        </select>
      </div>
      @if (grupo.get('quienRecibe')?.value !== 'yo') {
        <div class="rs-field">
          <label class="rs-lbl" for="wz-recibe-nombre">{{ 'Nombre o empresa' | t }}</label>
          <input id="wz-recibe-nombre" formControlName="contactoEntregaNombre" class="rs-inp rs-inp--lg" />
        </div>
        <div class="rs-field">
          <label class="rs-lbl" for="wz-recibe-tel">{{ 'Teléfono' | t }}</label>
          <input id="wz-recibe-tel" formControlName="contactoEntregaTelefono" type="tel" class="rs-inp rs-inp--lg" />
        </div>
      }
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-indic-entrega">{{ 'Indicaciones de entrega' | t }}</label>
      <input id="wz-indic-entrega" formControlName="indicacionesEntrega" class="rs-inp rs-inp--lg"
             [placeholder]="'Quién abre, horario, referencias…' | t" />
    </div>

    <div class="rs-field">
      <label class="rs-lbl" for="wz-confirmacion">{{ 'Confirmación de entrega' | t }}</label>
      <select id="wz-confirmacion" formControlName="confirmacionEntrega" class="rs-inp rs-inp--lg">
        @for (c of confirmaciones; track c) {
          <option [value]="c">{{ confirmacionLabel(c) | t }}</option>
        }
      </select>
    </div>
  </fieldset>

  <!-- 7 · Lo que vas a pagar ---------------------------------------------- -->
  @if (desglose(); as d) {
    <section class="tr__precio" data-testid="desglose-transporte">
      @if (d.requierePresupuesto) {
        <p class="tr__presupuesto">
          <rs-icon name="alert-circle" [size]="18" [stroke]="2" />
          <span>
            <strong>{{ 'Este viaje necesita presupuesto' | t }}</strong><br>
            {{ d.motivoPresupuesto ?? '' | t }}
            {{ 'Pídelo sin rellenar nada más: el transportista te responde con el importe y solo tendrás que aceptarlo.' | t }}
          </span>
        </p>
      } @else {
        <h3 class="tr__precio-titulo">{{ 'Lo que vas a pagar' | t }}</h3>
        <dl class="tr__lineas">
          <div><dt>{{ 'Distancia del trayecto' | t }}</dt><dd>{{ d.distanciaKm }} km</dd></div>
          @if (d.kmFacturables !== d.distanciaKm) {
            <div><dt>{{ 'Kilómetros facturables' | t }}</dt><dd>{{ d.kmFacturables }} km</dd></div>
          }
          @for (l of d.lineas; track l.concepto) {
            <div><dt>{{ l.concepto | t }}</dt><dd>{{ l.importe | euros }}</dd></div>
          }
          <div class="tr__total">
            <dt>{{ 'Total' | t }}</dt>
            <dd data-testid="total-transporte">{{ d.total | euros }}</dd>
          </div>
        </dl>
        <p class="tr__nota">
          {{ 'Precio cerrado: es lo que se cobrará salvo que pidas algo más durante el viaje.' | t }}
        </p>
      }
    </section>
  }
</form>
  `,
  styles: [`
    .tr { display: flex; flex-direction: column; gap: var(--sp-6); }

    .tr__bloque { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-4); }
    .tr__leyenda {
      padding: 0; margin-bottom: var(--sp-1);
      font: var(--w-7) var(--f-lg) var(--font-display); color: var(--t-100);
    }
    .tr__fila {
      display: grid; gap: var(--sp-3);
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
    .tr__checks { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-4); }

    /* ── Tarjetas de elección ─────────────────────────────────────── */
    .tr__tarjetas {
      display: grid; gap: var(--sp-2);
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .tr__tarjeta {
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); color: var(--t-200);
      font: var(--w-6) var(--f-base) var(--font); text-align: start; cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
    }
    .tr__tarjeta:hover { border-color: var(--b-a); }
    .tr__tarjeta.is-on {
      border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--t-100);
      box-shadow: 0 0 0 1px var(--c-accent) inset;
    }

    /* ── Suplementos del transportista ────────────────────────────── */
    .tr__extras {
      display: grid; gap: var(--sp-2);
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .tr__extra {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
    }
    .tr__extra.is-on { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .tr__extra input { flex: none; }
    .tr__extra-icono { display: grid; place-items: center; color: var(--c-amber); }
    .tr__extra-info { display: flex; flex-direction: column; min-width: 0; }
    .tr__extra-nombre { font: var(--w-6) var(--f-sm) var(--font); color: var(--t-100); }
    .tr__extra-precio { font-size: var(--f-xs); color: var(--t-400); }

    /* ── Precio ───────────────────────────────────────────────────── */
    .tr__precio {
      padding: var(--sp-5);
      border: 1px solid var(--b-1); border-radius: var(--r-xl); background: var(--c-raised);
    }
    .tr__precio-titulo {
      margin: 0 0 var(--sp-3);
      font: var(--w-7) var(--f-lg) var(--font-display); color: var(--t-100);
    }
    .tr__lineas { margin: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
    .tr__lineas > div { display: flex; justify-content: space-between; gap: var(--sp-4); }
    .tr__lineas dt { color: var(--t-300); font-size: var(--f-sm); }
    .tr__lineas dd { margin: 0; color: var(--t-100); font: var(--w-6) var(--f-sm) var(--font); }
    .tr__total { padding-top: var(--sp-2); border-top: 1px solid var(--b-1); }
    .tr__total dt, .tr__total dd {
      font: var(--w-7) var(--f-xl) var(--font-display); color: var(--t-100);
    }
    .tr__nota { margin: var(--sp-3) 0 0; color: var(--t-400); font-size: var(--f-xs); }
    .tr__presupuesto {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      margin: 0; color: var(--t-200); font-size: var(--f-sm);
    }
    .tr__presupuesto rs-icon { flex: none; color: var(--c-warning); }
  `],
})
export class PasoTransporteComponent {
  /** El formulario del paso 1; lo crea y lo valida el wizard. */
  @Input({ required: true }) grupo!: FormGroup;

  /** Suplementos que ofrece este transportista, ya con su importe. */
  readonly suplementos = input<readonly SuplementoOfrecido[]>([]);
  /** Desglose calculado con el motor de tarifas; `null` mientras no hay datos. */
  readonly desglose = input<DesglosePrecioTransporte | null>(null);
  readonly calculando = input(false);
  readonly resumenTrayecto = input('');
  /** La empresa admite paradas intermedias (con o sin suplemento). */
  readonly admiteParadas = input(false);

  readonly origenElegido = output<LugarElegido>();
  readonly destinoElegido = output<LugarElegido>();

  readonly necesidades = Object.values(NecesidadTransporte);
  readonly modalidades = Object.values(ModalidadViaje);
  readonly flexibilidades = Object.values(FlexibilidadHoraria);
  readonly franjas = Object.values(FranjaRecogida);
  readonly responsablesEntrega = Object.values(ResponsableEntrega);
  readonly confirmaciones = Object.values(ConfirmacionEntrega);

  readonly especies = ESPECIES_TRANSPORTE;
  readonly tamanos = TRAMOS_PESO_TRANSPORTE;
  readonly necesidadesMascota = NECESIDADES_MASCOTA;
  readonly comportamientos = COMPORTAMIENTOS_MASCOTA;
  readonly preferencias = PREFERENCIAS_VIAJE;

  necesidadLabel(n: NecesidadTransporte): string { return NECESIDAD_TRANSPORTE_LABELS[n]; }
  modalidadLabel(m: ModalidadViaje): string { return MODALIDAD_VIAJE_LABELS[m]; }
  flexibilidadLabel(f: FlexibilidadHoraria): string { return FLEXIBILIDAD_HORARIA_LABELS[f]; }
  franjaLabel(f: FranjaRecogida): string { return FRANJA_RECOGIDA_LABELS[f]; }
  responsableLabel(r: ResponsableEntrega): string { return RESPONSABLE_ENTREGA_LABELS[r]; }
  confirmacionLabel(c: ConfirmacionEntrega): string { return CONFIRMACION_ENTREGA_LABELS[c]; }

  tiene(control: string, valor: string): boolean {
    return ((this.grupo.get(control)?.value as string[]) ?? []).includes(valor);
  }

  alternar(control: string, valor: string): void {
    const actual = (this.grupo.get(control)?.value as string[]) ?? [];
    this.grupo.get(control)?.setValue(
      actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor],
    );
    this.grupo.get(control)?.markAsDirty();
  }

  /**
   * Elegir la necesidad arrastra la modalidad cuando esta se deduce sola.
   *
   * Quien dice «quiero viajar con mi mascota» ya ha elegido modalidad;
   * volvérselo a preguntar dos bloques más abajo es hacerle repetir lo que
   * acaba de decir.
   */
  elegirNecesidad(necesidad: NecesidadTransporte): void {
    this.grupo.patchValue({ necesidad });
    if (necesidad === NecesidadTransporte.VIAJO_CON_MI_MASCOTA) {
      this.grupo.patchValue({ modalidad: ModalidadViaje.VIAJO_CON_MI_MASCOTA, pasajeros: 1 });
    }
    this.grupo.markAsDirty();
  }

  elegirModalidad(modalidad: ModalidadViaje): void {
    this.grupo.patchValue({ modalidad });
    if (modalidad === ModalidadViaje.VIAJO_CON_MI_MASCOTA
        && Number(this.grupo.get('pasajeros')?.value ?? 0) < 1) {
      this.grupo.patchValue({ pasajeros: 1 });
    }
    if (modalidad !== ModalidadViaje.VIAJO_CON_MI_MASCOTA) {
      this.grupo.patchValue({ pasajeros: 0 });
    }
    this.grupo.markAsDirty();
  }

  viajaElResponsable(): boolean {
    return this.grupo.get('modalidad')?.value === ModalidadViaje.VIAJO_CON_MI_MASCOTA;
  }

  esIdaVuelta(): boolean {
    return this.grupo.get('necesidad')?.value === NecesidadTransporte.IDA_VUELTA;
  }
}
