import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RESPONSABLE, ULTIMA_ACTUALIZACION, hayDatosPendientes } from './legal.datos';

/**
 * Marco común de los documentos legales (privacidad, eliminación de datos).
 *
 * Deliberadamente **no monta la navbar**: estas páginas tienen que poder leerse
 * sin sesión y sin que la app esté abierta al público —las revisa un tercero,
 * como Meta o Google, antes de aprobar el inicio de sesión social—, así que
 * cuanto menos dependan del resto de la aplicación, mejor.
 */
@Component({
  selector: 'app-legal-documento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="lg">
      <header class="lg__cabecera">
        <a routerLink="/" class="lg__marca" aria-label="Ir al inicio de Doogking">
          <img src="/favicon.svg" alt="" class="lg__marca-icono" width="36" height="36" />
          <span class="lg__marca-texto">{{ marca }}</span>
        </a>
      </header>

      <main class="lg__doc">
        <h1>{{ titulo() }}</h1>
        <p class="lg__entradilla">{{ entradilla() }}</p>

        @if (datosPendientes) {
          <!--
            Visible a propósito: si el documento se publica sin identificar al
            responsable, ni cumple el RGPD ni lo acepta Meta. Desaparece solo en
            cuanto se rellenan los datos de legal.datos.ts.
          -->
          <div class="rs-alert rs-alert--warning lg__aviso">
            <span><strong>Borrador sin publicar.</strong> Faltan los datos de identidad del
              responsable del tratamiento en <code>legal.datos.ts</code>.</span>
          </div>
        }

        <ng-content />

        <footer class="lg__pie">
          <p>Última actualización: {{ ultimaActualizacion }}.</p>
          <p>
            <a routerLink="/privacidad">Política de privacidad</a> ·
            <a routerLink="/eliminar-datos">Eliminación de datos</a> ·
            <a [href]="'mailto:' + emailSoporte">{{ emailSoporte }}</a>
          </p>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; background: var(--c-base); min-height: 100vh; }

    .lg__cabecera {
      padding: var(--sp-5) var(--sp-6);
      border-bottom: 1px solid var(--b-1);
      background: var(--c-card);
    }
    .lg__marca { display: inline-flex; align-items: center; gap: var(--sp-3); text-decoration: none; }
    .lg__marca-icono { width: 36px; height: 36px; border-radius: var(--r-md); }
    .lg__marca-texto {
      font-family: var(--font-display); font-weight: var(--w-8);
      color: var(--dk-blue); font-size: var(--f-lg);
    }

    .lg__doc {
      max-width: 780px; margin: 0 auto;
      padding: var(--sp-10) var(--sp-6) var(--sp-16);
      color: var(--t-200); font-size: var(--f-md); line-height: 1.7;
    }

    h1 {
      font-family: var(--font-display); font-weight: var(--w-8);
      font-size: var(--f-3xl); color: var(--dk-blue); margin-bottom: var(--sp-3);
    }
    .lg__entradilla { color: var(--t-300); margin-bottom: var(--sp-8); }
    .lg__aviso { margin-bottom: var(--sp-8); }

    /*
     * El contenido llega proyectado, así que hay que alcanzarlo con ::ng-deep.
     * Va plano, un selector por regla: anidando las reglas dentro de un solo
     * bloque ":host ::ng-deep { ... }" el conjunto se queda sin aplicar y el
     * documento se ve con los estilos globales, listas sin viñetas incluidas.
     */
    :host ::ng-deep h2 {
      font-family: var(--font-display); font-weight: var(--w-7);
      font-size: var(--f-xl); color: var(--dk-blue);
      margin: var(--sp-10) 0 var(--sp-3);
    }
    :host ::ng-deep h3 {
      font-weight: var(--w-7); font-size: var(--f-md); color: var(--t-100);
      margin: var(--sp-5) 0 var(--sp-2);
    }
    :host ::ng-deep p { margin-bottom: var(--sp-3); }

    /* El reset global quita las viñetas; una lista de pasos sin números no se entiende. */
    :host ::ng-deep ul,
    :host ::ng-deep ol { margin: 0 0 var(--sp-4) var(--sp-6); padding-left: var(--sp-2); }
    :host ::ng-deep ul { list-style: disc; }
    :host ::ng-deep ol { list-style: decimal; }
    :host ::ng-deep li { margin-bottom: var(--sp-2); }
    :host ::ng-deep li::marker { color: var(--dk-gold); }

    :host ::ng-deep a { color: var(--c-accent); }
    :host ::ng-deep code {
      background: var(--c-surface); padding: 2px var(--sp-1);
      border-radius: var(--r-xs); font-size: var(--f-sm);
    }
    :host ::ng-deep table {
      width: 100%; border-collapse: collapse; margin-bottom: var(--sp-5);
      font-size: var(--f-sm);
    }
    :host ::ng-deep th,
    :host ::ng-deep td {
      text-align: left; padding: var(--sp-2);
      border-bottom: 1px solid var(--b-1); vertical-align: top;
    }
    :host ::ng-deep th { color: var(--dk-blue); font-weight: var(--w-7); }

    .lg__pie {
      margin-top: var(--sp-10); padding-top: var(--sp-5);
      border-top: 1px solid var(--b-1);
      font-size: var(--f-sm); color: var(--t-400);
      a { color: var(--c-accent); }
    }
  `],
})
export class LegalDocumentoComponent {
  readonly titulo = input.required<string>();
  readonly entradilla = input.required<string>();

  protected readonly marca = RESPONSABLE.marca;
  protected readonly emailSoporte = RESPONSABLE.emailSoporte;
  protected readonly ultimaActualizacion = ULTIMA_ACTUALIZACION;
  protected readonly datosPendientes = hayDatosPendientes();
}
