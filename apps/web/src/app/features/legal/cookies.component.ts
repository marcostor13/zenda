import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Una entrada de la tabla de almacenamiento del navegador. */
interface EntradaAlmacen {
  readonly clave: string;
  readonly proposito: string;
  readonly duracion: string;
}

/**
 * Política de cookies.
 *
 * El documento describe lo que la aplicación guarda **de verdad** en el
 * navegador, no una plantilla genérica: cada clave de la tabla existe en el
 * código (`auth.service`, `i18n.service`, `theme.service`…). Si se añade o se
 * retira alguna, esta lista se actualiza con ella.
 *
 * Que sean `localStorage` y no cookies no cambia las obligaciones: el artículo
 * 5.3 de la Directiva 2002/58/CE habla de almacenar información en el equipo
 * del usuario, sea con la tecnología que sea.
 */
@Component({
  selector: 'app-cookies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraducirPipe, LegalDocumentoComponent, RouterLink],
  template: `
    <app-legal-documento
      [titulo]="'Política de cookies' | t"
      [entradilla]="'Qué guarda Doogking en tu navegador, para qué sirve cada cosa y cómo borrarlo.' | t">

      <h2>{{ '1. Qué guardamos y por qué' | t }}</h2>
      <p>
        {{ 'Doogking no usa cookies de publicidad ni de seguimiento, y no comparte tu navegación con redes publicitarias ni con perfiladores. Lo que guardamos en tu navegador es lo imprescindible para que la sesión y tus preferencias sobrevivan de una página a otra.' | t }}
      </p>
      <p>
        {{ 'Se guarda con' | t }} <code>localStorage</code>{{ ', en tu propio dispositivo: no viaja en cada petición como una cookie clásica y no lo puede leer ningún otro sitio web.' | t }}
      </p>

      <h2>{{ '2. Detalle de lo que se almacena' | t }}</h2>
      <table class="lg-tabla">
        <thead>
          <tr>
            <th>{{ 'Clave' | t }}</th>
            <th>{{ 'Para qué sirve' | t }}</th>
            <th>{{ 'Cuánto dura' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (e of entradas; track e.clave) {
            <tr>
              <td><code>{{ e.clave }}</code></td>
              <td>{{ e.proposito | t }}</td>
              <td>{{ e.duracion | t }}</td>
            </tr>
          }
        </tbody>
      </table>

      <h2>{{ '3. Terceros' | t }}</h2>
      <ul>
        <li>
          <strong>Stripe</strong>{{ ': al pagar, Stripe puede fijar sus propias cookies para prevenir el fraude. Son necesarias para que el cobro funcione y se rigen por su política de privacidad.' | t }}
        </li>
        <li>
          <strong>{{ 'Google y Meta' | t }}</strong>{{ ': sólo si eliges entrar con una de esas cuentas. En ese caso su propio inicio de sesión usa sus cookies.' | t }}
        </li>
        <li>
          <strong>{{ 'Mapas' | t }}</strong>{{ ': las fichas cargan un mapa para mostrar dónde está el servicio. El proveedor del mapa recibe la petición de las teselas que se pintan en pantalla.' | t }}
        </li>
      </ul>

      <h2>{{ '4. ¿Hace falta tu consentimiento?' | t }}</h2>
      <p>
        {{ 'Lo que guarda Doogking por su cuenta es estrictamente necesario para prestarte el servicio que pides —mantener la sesión, recordar tu idioma—, así que la normativa no exige consentimiento previo. Como no hay cookies de análisis ni de publicidad, tampoco hay nada que aceptar o rechazar.' | t }}
      </p>

      <h2>{{ '5. Cómo borrarlo' | t }}</h2>
      <ul>
        <li>{{ 'Cerrar sesión desde tu perfil borra la sesión y tus datos de cuenta del dispositivo.' | t }}</li>
        <li>{{ 'Borrar los datos del sitio desde los ajustes de tu navegador lo elimina todo, incluidas tus preferencias.' | t }}</li>
        <li>{{ 'Navegar en modo privado hace que nada de esto sobreviva al cierre de la ventana.' | t }}</li>
      </ul>
      <p>
        {{ 'Ten en cuenta que si borras la sesión tendrás que volver a entrar, y que sin la clave de idioma la plataforma volverá a mostrarse en el idioma de tu navegador.' | t }}
      </p>

      <h2>{{ '6. Dudas' | t }}</h2>
      <p>
        {{ 'Escríbenos a' | t }} <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a>
        {{ 'o consulta la' | t }} <a routerLink="/privacidad">{{ 'política de privacidad' | t }}</a>
        {{ 'y los' | t }} <a routerLink="/terminos">{{ 'términos y condiciones' | t }}</a>.
      </p>
    </app-legal-documento>
  `,
  styles: [`
    .lg-tabla { width: 100%; border-collapse: collapse; margin-block: var(--sp-4); font-size: var(--f-sm); }
    .lg-tabla th, .lg-tabla td { text-align: left; padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--c-border); vertical-align: top; }
    .lg-tabla th { color: var(--t-300); font-weight: var(--fw-semibold); }
    .lg-tabla code { font-size: var(--f-xs); }

    /* En móvil la tabla no cabe: se desplaza dentro de su caja, nunca la página. */
    @media (max-width: 640px) {
      .lg-tabla { display: block; overflow-x: auto; white-space: nowrap; }
    }
  `],
})
export class CookiesComponent {
  readonly r = RESPONSABLE;

  /** Cada clave existe en el código; ver la nota de clase antes de tocar la lista. */
  readonly entradas: readonly EntradaAlmacen[] = [
    { clave: 'zenda_token', proposito: 'Mantiene tu sesión iniciada sin pedirte la contraseña en cada página.', duracion: 'Hasta cerrar sesión o 7 días' },
    { clave: 'zenda_usuario', proposito: 'Tu nombre y tu tipo de cuenta, para pintar el menú sin esperar al servidor.', duracion: 'Hasta cerrar sesión' },
    { clave: 'doogking_idioma', proposito: 'El idioma que has elegido.', duracion: 'Hasta que lo borres' },
    { clave: 'doogking_moneda', proposito: 'La moneda en la que prefieres ver los precios (el cobro siempre es en euros).', duracion: 'Hasta que lo borres' },
    { clave: 'zenda-theme', proposito: 'Si prefieres el tema claro u oscuro.', duracion: 'Hasta que lo borres' },
    { clave: 'dk_login_email', proposito: 'Tu correo en la pantalla de acceso, sólo si marcas «recordarme».', duracion: 'Hasta que lo desmarques' },
    { clave: 'dk_registro_comercio_borrador', proposito: 'Las categorías marcadas en un alta de negocio a medias. Nunca guarda la contraseña.', duracion: 'Hasta completar el alta' },
    { clave: 'zenda_notif_prefs', proposito: 'Qué avisos quieres recibir.', duracion: 'Hasta que lo borres' },
  ];
}
