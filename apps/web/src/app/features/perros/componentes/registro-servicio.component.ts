import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { VERTICAL_LABELS, VerticalKey, camposDeRegistro } from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { RegistroServicioApi } from '../expediente.service';
import { AdjuntosRegistroComponent } from './adjuntos-registro.component';
import { iconoDeVertical as iconoVertical } from '../../../shared/verticales/verticales.config';
import { FechaPipe } from '../../../shared/pipes/fecha.pipe';

interface DatoVisible {
  readonly etiqueta: string;
  readonly valor: string;
  readonly largo: boolean;
}

/**
 * Un registro del historial en la línea de tiempo: qué se hizo, quién lo hizo y
 * los datos estructurados de su categoría. Lo usan la ficha del dueño y el
 * expediente del panel del comercio, para que ambos lean lo mismo.
 */
@Component({
  selector: 'app-registro-servicio',
  standalone: true,
  imports: [FechaPipe, RsIconComponent, TraducirPipe, AdjuntosRegistroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<article class="registro" [attr.data-vertical]="registro().vertical">
  <div class="registro__icono" aria-hidden="true">
    <rs-icon [name]="icono()" [size]="18" [stroke]="2"></rs-icon>
  </div>

  <div class="registro__cuerpo">
    <header class="registro__cabecera">
      <div class="registro__titulos">
        <span class="registro__categoria">{{ categoria() | t }}</span>
        <h3 class="registro__titulo">{{ registro().titulo || registro().nota }}</h3>
        <p class="registro__meta">
          <rs-icon name="calendar" [size]="13" [stroke]="2"></rs-icon>
          {{ fecha() | date:'d MMM yyyy' }}
          @if (mostrarComercio() && registro().comercioNombre) {
            <span class="registro__sep">·</span>
            <rs-icon name="store" [size]="13" [stroke]="2"></rs-icon> {{ registro().comercioNombre }}
          }
          @if (registro().profesional) {
            <span class="registro__sep">·</span>
            <rs-icon name="user" [size]="13" [stroke]="2"></rs-icon> {{ registro().profesional }}
          }
        </p>
      </div>
      @if (editable() && registro().esPropio) {
        <div class="registro__acciones">
          <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="editar.emit(registro())"
                  [attr.aria-label]="'Editar registro' | t">
            <rs-icon name="pencil" [size]="14" [stroke]="2"></rs-icon>
          </button>
          <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="eliminar.emit(registro())"
                  [attr.aria-label]="'Eliminar registro' | t">
            <rs-icon name="trash" [size]="14" [stroke]="2"></rs-icon>
          </button>
        </div>
      }
    </header>

    @if (datos().length) {
      <dl class="registro__datos">
        @for (d of datos(); track d.etiqueta) {
          <div class="registro__dato" [class.registro__dato--largo]="d.largo">
            <dt>{{ d.etiqueta | t }}</dt>
            <dd>{{ d.valor }}</dd>
          </div>
        }
      </dl>
    }

    @if (observaciones()) {
      <p class="registro__nota">{{ observaciones() }}</p>
    }

    @if (adjuntos().length) {
      <div class="registro__adjuntos">
        <p class="registro__adjuntos-titulo">
          <rs-icon name="paperclip" [size]="13" [stroke]="2"></rs-icon>
          {{ 'Documentos' | t }}
        </p>
        <app-adjuntos-registro [adjuntos]="adjuntos()" />
      </div>
    }

    @if (registro().proximaCita || registro().editadaAt) {
      <footer class="registro__pie">
        @if (registro().proximaCita) {
          <span class="rs-badge rs-badge--teal">
            <rs-icon name="calendar-plus" [size]="12" [stroke]="2"></rs-icon>
            {{ 'Próxima cita' | t }}: {{ registro().proximaCita | date:'d MMM yyyy' }}
          </span>
        }
        @if (registro().editadaAt) {
          <span class="registro__editada">{{ 'Editado por el propietario' | t }}</span>
        }
      </footer>
    }
  </div>
</article>
  `,
  styles: [`
    :host { display: block; }
    .registro { display: grid; grid-template-columns: 40px 1fr; gap: var(--sp-4); }
    .registro__icono {
      width: 40px; height: 40px; border-radius: var(--r-full);
      display: flex; align-items: center; justify-content: center;
      background: var(--c-accent-lo); color: var(--c-accent);
      box-shadow: 0 0 0 4px var(--c-card);
      position: relative; z-index: 1;
    }
    .registro[data-vertical="peluqueria"] .registro__icono { background: var(--dk-gold-lo); color: var(--dk-gold-text); }
    .registro[data-vertical="adiestramiento"] .registro__icono { background: var(--c-purple-lo); color: var(--c-purple); }

    .registro__cuerpo {
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      padding: var(--sp-4) var(--sp-5); box-shadow: var(--sh-sm); min-width: 0;
    }
    .registro__cabecera { display: flex; justify-content: space-between; gap: var(--sp-3); align-items: flex-start; }
    .registro__titulos { min-width: 0; }
    .registro__categoria {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase; color: var(--t-400);
    }
    .registro__titulo {
      font-family: var(--font-display); font-size: var(--f-md); font-weight: var(--w-7);
      color: var(--t-100); margin: 2px 0 var(--sp-1); overflow-wrap: anywhere;
    }
    .registro__meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1);
      font-size: var(--f-xs); color: var(--t-400); margin: 0;
    }
    .registro__sep { margin-inline: var(--sp-1); }
    .registro__acciones { display: flex; gap: var(--sp-1); flex-shrink: 0; }

    .registro__datos {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
      gap: var(--sp-3) var(--sp-5); margin: var(--sp-4) 0 0; padding-top: var(--sp-4);
      border-top: 1px dashed var(--b-1);
    }
    .registro__dato { min-width: 0; }
    .registro__dato--largo { grid-column: 1 / -1; }
    .registro__dato dt { font-size: var(--f-xs); color: var(--t-400); margin-bottom: 2px; }
    .registro__dato dd { margin: 0; font-size: var(--f-sm); color: var(--t-200); white-space: pre-line; overflow-wrap: anywhere; }

    .registro__nota {
      margin: var(--sp-4) 0 0; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md);
      background: var(--c-raised); font-size: var(--f-sm); color: var(--t-300); line-height: 1.6;
      white-space: pre-line; overflow-wrap: anywhere;
    }
    .registro__adjuntos { margin-top: var(--sp-4); }
    .registro__adjuntos-titulo {
      display: flex; align-items: center; gap: var(--sp-2); margin: 0 0 var(--sp-2);
      font-size: var(--f-xs); color: var(--t-400);
    }
    .registro__pie { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; margin-top: var(--sp-3); }
    .registro__editada { font-size: var(--f-xs); color: var(--t-400); font-style: italic; }
  `],
})
export class RegistroServicioComponent {
  readonly registro = input.required<RegistroServicioApi>();
  /** En la ficha del dueño interesa quién lo atendió; en el panel, ya se sabe. */
  readonly mostrarComercio = input(true);
  readonly editable = input(false);

  readonly editar = output<RegistroServicioApi>();
  readonly eliminar = output<RegistroServicioApi>();

  readonly icono = computed(() => iconoVertical(this.registro().vertical));
  readonly categoria = computed(() => VERTICAL_LABELS[this.registro().vertical as VerticalKey] ?? this.registro().vertical);
  readonly fecha = computed(() => this.registro().fechaServicio ?? this.registro().createdAt);
  readonly adjuntos = computed(() => this.registro().adjuntos ?? []);

  readonly datos = computed<DatoVisible[]>(() => {
    const r = this.registro();
    return camposDeRegistro(r.vertical)
      .filter((campo) => r.datosEstructurados?.[campo.clave] !== undefined && r.datosEstructurados[campo.clave] !== '')
      .map((campo) => ({
        etiqueta: campo.etiqueta,
        valor: formatearValor(r.datosEstructurados[campo.clave], campo.unidad),
        largo: campo.tipo === 'textoLargo',
      }));
  });

  /** La nota repite el título cuando el profesional no escribió observaciones. */
  readonly observaciones = computed(() => {
    const r = this.registro();
    return r.nota && r.nota !== r.titulo ? r.nota : '';
  });
}

function formatearValor(valor: string | number | undefined, unidad?: string): string {
  const texto = typeof valor === 'number' ? valor.toLocaleString() : String(valor ?? '');
  return unidad ? `${texto} ${unidad}` : texto;
}
