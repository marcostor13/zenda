import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { AdjuntoRegistroApi } from '../expediente.service';

/** Tipos que el navegador pinta; el resto se descarga y ya. */
const SE_VEN = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

const ICONOS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^image\//, 'image'],
  [/pdf/, 'file-text'],
  [/word|msword|officedocument/, 'file-text'],
];

/**
 * Los documentos de un registro del historial: informes, analíticas, fotos.
 *
 * Cada uno ofrece las dos cosas por separado porque no son la misma: **ver**
 * lo abre en otra pestaña —un PDF o una foto se leen sin bajar nada— y
 * **descargar** lo guarda. Lo que no se puede pintar (un Word) sólo se
 * descarga: ofrecer "ver" para eso sería un enlace que no hace lo que dice.
 */
@Component({
  selector: 'app-adjuntos-registro',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<ul class="adj" data-testid="adjuntos-registro">
  @for (a of adjuntos(); track a.url) {
    <li class="adj__item">
      <rs-icon class="adj__icono" [name]="icono(a)" [size]="16" [stroke]="2" />
      <span class="adj__datos">
        <span class="adj__nombre" [title]="a.nombre">{{ a.nombre }}</span>
        @if (a.tamano) { <span class="adj__peso">{{ peso(a.tamano) }}</span> }
      </span>

      <span class="adj__acciones">
        @if (sePuedeVer(a)) {
          <a class="adj__accion" [href]="a.url" target="_blank" rel="noopener noreferrer"
             [attr.aria-label]="('Ver' | t) + ' ' + a.nombre">
            <rs-icon name="eye" [size]="14" [stroke]="2" /> {{ 'Ver' | t }}
          </a>
        }
        <a class="adj__accion" [href]="a.url" [download]="a.nombre" target="_blank" rel="noopener noreferrer"
           [attr.aria-label]="('Descargar' | t) + ' ' + a.nombre">
          <rs-icon name="download" [size]="14" [stroke]="2" /> {{ 'Descargar' | t }}
        </a>
        @if (quitable()) {
          <button type="button" class="adj__quitar" (click)="quitar.emit(a)"
                  [attr.aria-label]="('Quitar' | t) + ' ' + a.nombre">
            <rs-icon name="x" [size]="14" [stroke]="2.5" />
          </button>
        }
      </span>
    </li>
  }
</ul>
  `,
  styles: [`
    :host { display: block; }
    .adj { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
    .adj__item {
      display: flex; align-items: center; gap: var(--sp-3); min-width: 0;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-md); background: var(--c-card);
    }
    .adj__icono { color: var(--c-accent); flex: none; }
    .adj__datos { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .adj__nombre {
      font-size: var(--f-sm); color: var(--t-200); font-weight: var(--w-6);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .adj__peso { font-size: var(--f-xs); color: var(--t-400); }
    .adj__acciones { display: flex; align-items: center; gap: var(--sp-1); flex: none; }
    .adj__accion {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
      color: var(--c-accent); font-size: var(--f-xs); font-weight: var(--w-6); text-decoration: none;
      &:hover { background: var(--c-accent-lo); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }
    .adj__quitar {
      display: grid; place-items: center; width: 26px; height: 26px;
      border: none; border-radius: var(--r-full); background: transparent;
      color: var(--t-400); cursor: pointer;
      &:hover { background: var(--c-raised); color: var(--c-error); }
      &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    }
    /* En pantalla estrecha el nombre manda y las acciones bajan a su propia línea. */
    @media (max-width: 480px) {
      .adj__item { flex-wrap: wrap; }
      .adj__acciones { width: 100%; justify-content: flex-end; }
    }
  `],
})
export class AdjuntosRegistroComponent {
  readonly adjuntos = input.required<readonly AdjuntoRegistroApi[]>();
  /** En el formulario del comercio se pueden quitar; en la ficha, no. */
  readonly quitable = input(false);

  readonly quitar = output<AdjuntoRegistroApi>();

  /**
   * El tipo guardado manda; si falta —documentos de antes de que se guardara—
   * se mira la extensión, que es lo único que queda.
   */
  sePuedeVer(adjunto: AdjuntoRegistroApi): boolean {
    const tipo = adjunto.tipo ?? porExtension(adjunto.nombre);
    return SE_VEN.includes(tipo);
  }

  icono(adjunto: AdjuntoRegistroApi): string {
    const tipo = adjunto.tipo ?? porExtension(adjunto.nombre);
    return ICONOS.find(([patron]) => patron.test(tipo))?.[1] ?? 'paperclip';
  }

  peso(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }
}

const POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function porExtension(nombre: string): string {
  return POR_EXTENSION[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}
