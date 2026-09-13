import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { VACUNA_LABELS, Vacuna, nombreTamanoPerro } from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { PerroApi } from '../perros.service';
import { edadLegible } from '../edad';

export type SeccionFicha = 'general' | 'salud' | 'comportamiento' | 'documentos';

interface Fila {
  readonly etiqueta: string;
  readonly valor: string;
  /** El valor es un dato del dueño (texto libre): no se pasa por el traductor. */
  readonly literal?: boolean;
}

interface Chip {
  readonly texto: string;
  readonly detalle?: string;
}

const SOCIABILIDAD: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', no_tolera: 'No tolera' };
const PELO: Record<string, string> = {
  corto: 'Corto', medio: 'Medio', largo: 'Largo', rizado: 'Rizado', duro: 'Duro', doble_capa: 'Doble capa',
};

/**
 * Datos de la ficha que rellena el dueño, agrupados por sección. Lo pintan la
 * ficha del cliente y el expediente del comercio: el profesional ve
 * exactamente lo que declaró el dueño, con las mismas etiquetas.
 */
@Component({
  selector: 'app-ficha-perro-datos',
  standalone: true,
  imports: [DatePipe, RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (mostrar('general')) {
  <section class="ficha-sec">
    <h3 class="ficha-sec__titulo"><rs-icon name="dog" [size]="18" [stroke]="2"></rs-icon> {{ 'Datos generales' | t }}</h3>
    <dl class="ficha-sec__datos">
      @for (f of general(); track f.etiqueta) {
        <div><dt>{{ f.etiqueta | t }}</dt><dd>{{ f.literal ? f.valor : (f.valor | t) }}</dd></div>
      }
    </dl>
  </section>
}

@if (mostrar('salud')) {
  <section class="ficha-sec">
    <h3 class="ficha-sec__titulo"><rs-icon name="heart" [size]="18" [stroke]="2"></rs-icon> {{ 'Salud' | t }}</h3>

    <div class="ficha-sec__bloque">
      <span class="ficha-sec__subtitulo"><rs-icon name="syringe" [size]="14" [stroke]="2"></rs-icon> {{ 'Vacunas' | t }}</span>
      @if (vacunas().length) {
        <div class="ficha-chips">
          @for (v of vacunas(); track v.texto) {
            <span class="ficha-chip ficha-chip--ok">
              <rs-icon name="check" [size]="12" [stroke]="3"></rs-icon> {{ v.texto | t }}
              @if (v.detalle) { <small>{{ v.detalle | date:'MMM yyyy' }}</small> }
            </span>
          }
        </div>
      } @else { <p class="ficha-sec__vacio">{{ 'Sin vacunas registradas' | t }}</p> }
    </div>

    @for (grupo of gruposSalud(); track grupo.etiqueta) {
      <div class="ficha-sec__bloque">
        <span class="ficha-sec__subtitulo"><rs-icon [name]="grupo.icono" [size]="14" [stroke]="2"></rs-icon> {{ grupo.etiqueta | t }}</span>
        @if (grupo.valores.length) {
          <div class="ficha-chips">
            @for (valor of grupo.valores; track valor) { <span class="ficha-chip" [class]="'ficha-chip ' + grupo.clase">{{ valor }}</span> }
          </div>
        } @else { <p class="ficha-sec__vacio">{{ 'Nada registrado' | t }}</p> }
      </div>
    }

    @if (perro().dieta) {
      <div class="ficha-sec__bloque">
        <span class="ficha-sec__subtitulo"><rs-icon name="utensils" [size]="14" [stroke]="2"></rs-icon> {{ 'Dieta' | t }}</span>
        <p class="ficha-sec__texto">{{ perro().dieta }}</p>
      </div>
    }
  </section>
}

@if (mostrar('comportamiento')) {
  <section class="ficha-sec">
    <h3 class="ficha-sec__titulo"><rs-icon name="brain" [size]="18" [stroke]="2"></rs-icon> {{ 'Comportamiento' | t }}</h3>
    <dl class="ficha-sec__datos">
      @for (f of comportamiento(); track f.etiqueta) {
        <div><dt>{{ f.etiqueta | t }}</dt><dd>{{ f.literal ? f.valor : (f.valor | t) }}</dd></div>
      }
    </dl>
    @if (rasgos().length) {
      <div class="ficha-sec__bloque">
        <span class="ficha-sec__subtitulo"><rs-icon name="alert-triangle" [size]="14" [stroke]="2"></rs-icon> {{ 'A tener en cuenta' | t }}</span>
        <div class="ficha-chips">
          @for (r of rasgos(); track r) { <span class="ficha-chip ficha-chip--aviso">{{ r | t }}</span> }
        </div>
      </div>
    }
    @if (perro().miedos.length) {
      <div class="ficha-sec__bloque">
        <span class="ficha-sec__subtitulo">{{ 'Miedos' | t }}</span>
        <div class="ficha-chips">
          @for (m of perro().miedos; track m) { <span class="ficha-chip">{{ m }}</span> }
        </div>
      </div>
    }
    @if (perro().notasAlojamiento) {
      <div class="ficha-sec__bloque">
        <span class="ficha-sec__subtitulo">{{ 'Notas del dueño' | t }}</span>
        <p class="ficha-sec__texto">{{ perro().notasAlojamiento }}</p>
      </div>
    }
  </section>
}

@if (mostrar('documentos')) {
  <section class="ficha-sec">
    <h3 class="ficha-sec__titulo"><rs-icon name="file-text" [size]="18" [stroke]="2"></rs-icon> {{ 'Documentos' | t }}</h3>
    @if (documentos().length) {
      <ul class="ficha-docs">
        @for (d of documentos(); track d.url) {
          <li>
            <a [href]="d.url" target="_blank" rel="noopener" class="ficha-doc">
              <rs-icon name="file-text" [size]="18" [stroke]="2"></rs-icon>
              <span>{{ d.etiqueta | t }}</span>
              <rs-icon name="download" [size]="16" [stroke]="2"></rs-icon>
            </a>
          </li>
        }
      </ul>
    } @else { <p class="ficha-sec__vacio">{{ 'No hay documentos subidos' | t }}</p> }
  </section>
}
  `,
  styles: [`
    :host { display: grid; gap: var(--sp-4); }
    .ficha-sec { background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg); padding: var(--sp-5); box-shadow: var(--sh-sm); }
    .ficha-sec__titulo {
      display: flex; align-items: center; gap: var(--sp-2); margin: 0 0 var(--sp-4);
      font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      rs-icon { color: var(--c-accent); }
    }
    .ficha-sec__datos { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(170px, 100%), 1fr)); gap: var(--sp-4); margin: 0; }
    .ficha-sec__datos dt { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
    .ficha-sec__datos dd { margin: 0; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); overflow-wrap: anywhere; }
    .ficha-sec__bloque { margin-top: var(--sp-4); }
    .ficha-sec__bloque:first-of-type { margin-top: 0; }
    .ficha-sec__datos + .ficha-sec__bloque { margin-top: var(--sp-5); }
    .ficha-sec__subtitulo { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-xs); font-weight: var(--w-7); color: var(--t-300); margin-bottom: var(--sp-2); text-transform: uppercase; letter-spacing: .05em; }
    .ficha-sec__vacio { font-size: var(--f-sm); color: var(--t-500); margin: 0; }
    .ficha-sec__texto { font-size: var(--f-sm); color: var(--t-200); margin: 0; line-height: 1.6; white-space: pre-line; }
    .ficha-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .ficha-chip {
      display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3);
      border-radius: var(--r-full); background: var(--c-raised); color: var(--t-200); font-size: var(--f-sm);
      small { color: var(--t-400); font-size: var(--f-xs); }
    }
    .ficha-chip--ok { background: var(--c-success-lo); color: var(--c-success); }
    .ficha-chip--alerta { background: var(--c-error-lo); color: var(--c-error); }
    .ficha-chip--aviso { background: var(--c-warning-lo); color: var(--c-warning); }
    .ficha-docs { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
    .ficha-doc {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md);
      border: 1px solid var(--b-1); color: var(--t-200); text-decoration: none; font-size: var(--f-sm);
      span { flex: 1; }
      &:hover { border-color: var(--c-accent); color: var(--c-accent); }
    }
  `],
})
export class FichaPerroDatosComponent {
  private readonly i18n = inject(I18nService);

  readonly perro = input.required<PerroApi>();
  readonly secciones = input<readonly SeccionFicha[]>(['general', 'salud', 'comportamiento', 'documentos']);

  readonly general = computed<Fila[]>(() => {
    const p = this.perro();
    return filtrarFilas([
      { etiqueta: 'Raza', valor: p.raza ?? (p.esMestizo ? 'Mestizo' : ''), literal: !!p.raza },
      { etiqueta: 'Sexo', valor: p.sexo === 'macho' ? 'Macho' : p.sexo === 'hembra' ? 'Hembra' : '' },
      { etiqueta: 'Edad', valor: edadLegible(p.fechaNacimiento, (t, params) => this.i18n.t(t, params)) ?? '', literal: true },
      { etiqueta: 'Peso', valor: p.peso != null ? `${p.peso} kg` : '', literal: true },
      { etiqueta: 'Tamaño', valor: p.tamano ? nombreTamanoPerro(p.tamano) : '' },
      { etiqueta: 'Esterilizado', valor: p.esterilizado ? 'Sí' : 'No' },
      { etiqueta: 'Microchip', valor: p.microchip ?? '', literal: true },
      { etiqueta: 'Tipo de pelo', valor: p.tipoPelo.map((t) => this.i18n.t(PELO[t] ?? t)).join(', '), literal: true },
      { etiqueta: 'Estado del manto', valor: p.estadoManto ?? '', literal: true },
      { etiqueta: 'Ciudad', valor: p.ciudad ?? '', literal: true },
    ]);
  });

  readonly vacunas = computed<Chip[]>(() => {
    const p = this.perro();
    const detalle = (p.vacunasDetalle ?? []).map((v) => ({ texto: VACUNA_LABELS[v.tipo as Vacuna] ?? v.tipo, detalle: v.fecha }));
    return [...detalle, ...p.vacunas.map((texto) => ({ texto }))];
  });

  readonly gruposSalud = computed(() => {
    const p = this.perro();
    return [
      { etiqueta: 'Alergias', icono: 'alert-triangle', clase: 'ficha-chip--alerta', valores: p.alergias },
      { etiqueta: 'Enfermedades', icono: 'stethoscope', clase: 'ficha-chip--aviso', valores: p.enfermedades },
      { etiqueta: 'Medicación', icono: 'pill', clase: '', valores: p.medicacion },
    ];
  });

  readonly comportamiento = computed<Fila[]>(() => {
    const p = this.perro();
    return filtrarFilas([
      { etiqueta: 'Temperamento', valor: p.temperamento ?? '', literal: true },
      { etiqueta: 'Con otros perros', valor: SOCIABILIDAD[p.sociabilidadPerros ?? ''] ?? '' },
      { etiqueta: 'Con personas', valor: SOCIABILIDAD[p.sociabilidadPersonas ?? ''] ?? '' },
      { etiqueta: 'Puede quedarse solo', valor: p.puedeQuedarseSolo ? 'Sí' : 'No' },
      { etiqueta: 'Tolera viajes largos', valor: p.toleraTrayectosLargos === false ? 'No' : 'Sí' },
    ]);
  });

  readonly rasgos = computed<string[]>(() => {
    const p = this.perro();
    return [
      p.ansiedadSeparacion && 'Ansiedad por separación',
      p.reactividadCorrea && 'Reactivo con correa',
      p.protectorRecursos && 'Protector de recursos',
      p.tendenciaEscapar && 'Tiende a escaparse',
      p.destructivoEnSoledad && 'Destructivo en soledad',
      p.ladraAlQuedarseSolo && 'Ladra al quedarse solo',
      p.orinaEnInterior && 'Puede orinar en interior',
      p.seMarea && 'Se marea en viajes',
      p.requiereTransportin && 'Requiere transportín',
    ].filter((r): r is string => !!r);
  });

  readonly documentos = computed(() => {
    const p = this.perro();
    return [
      p.cartillaSanitariaUrl && { etiqueta: 'Cartilla sanitaria', url: p.cartillaSanitariaUrl },
      p.pasaporteEuropeoUrl && { etiqueta: 'Pasaporte europeo', url: p.pasaporteEuropeoUrl },
      ...(p.certificadosUrl ?? []).map((url) => ({ etiqueta: 'Certificado', url })),
    ].filter((d): d is { etiqueta: string; url: string } => !!d);
  });

  mostrar(seccion: SeccionFicha): boolean {
    return this.secciones().includes(seccion);
  }
}

function filtrarFilas(filas: Fila[]): Fila[] {
  return filas.filter((f) => f.valor !== '');
}
