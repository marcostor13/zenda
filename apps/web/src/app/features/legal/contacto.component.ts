import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';
import { REDES_SOCIALES } from '../../shared/catalogos/redes-sociales.catalogo';
import { RsSocialIconComponent } from '../../shared/components/social-icon/rs-social-icon.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Página de contacto.
 *
 * **No lleva formulario a propósito.** Un formulario que no tiene detrás un
 * buzón atendido es peor que no tenerlo: el usuario escribe, ve un «gracias» y
 * se queda esperando una respuesta que nunca llega. Aquí se dan los canales que
 * existen de verdad —el correo de soporte, la ayuda de la aplicación y el
 * circuito de incidencias de una reserva—, y cada uno lleva a alguien.
 *
 * Vive junto a los documentos legales y fuera del guard de «muy pronto» por el
 * mismo motivo que ellos: es una página que se consulta desde fuera.
 */
@Component({
  selector: 'app-contacto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraducirPipe, LegalDocumentoComponent, RouterLink, RsSocialIconComponent],
  template: `
    <app-legal-documento
      [titulo]="'Contacto' | t"
      [entradilla]="'Cómo llegar hasta nosotros según lo que necesites.' | t">

      <h2>{{ 'Si tienes una reserva en marcha' | t }}</h2>
      <p>
        {{ 'Es el camino más rápido: abre la reserva desde' | t }}
        <a routerLink="/reservas">{{ 'Mis reservas' | t }}</a>
        {{ 'y usa «Tengo una incidencia». Así el mensaje llega con el código de reserva, el comercio y las fechas, y no hay que reconstruir nada.' | t }}
      </p>
      <p>
        {{ 'Si además necesitas hablar con el comercio, tienes su contacto en la propia reserva.' | t }}
      </p>

      <h2>{{ 'Dudas sobre cómo funciona' | t }}</h2>
      <p>
        <a routerLink="/ayuda">{{ 'Ayuda' | t }}</a>
        {{ 'reúne las preguntas más frecuentes sobre reservas, pagos, cancelaciones y cuentas.' | t }}
      </p>

      <h2>{{ 'Soporte' | t }}</h2>
      <p>
        <a [href]="'mailto:' + r.emailSoporte">{{ r.emailSoporte }}</a><br />
        {{ 'Respondemos de lunes a viernes. Si escribes por una reserva, incluye su código: acorta la respuesta a la mitad.' | t }}
      </p>

      <h2>{{ 'Privacidad y protección de datos' | t }}</h2>
      <p>
        <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a><br />
        {{ 'Para ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación o portabilidad. Puedes ver el detalle en la' | t }}
        <a routerLink="/privacidad">{{ 'política de privacidad' | t }}</a>
        {{ 'o pedir directamente la' | t }}
        <a routerLink="/eliminar-datos">{{ 'eliminación de tus datos' | t }}</a>.
      </p>

      <h2>{{ '¿Tienes un negocio de servicios para perros?' | t }}</h2>
      <p>
        {{ 'El alta es gratuita y se hace en un par de minutos. Tienes las condiciones, las comisiones y los planes en' | t }}
        <a routerLink="/para-comercios">{{ 'Doogking para empresas' | t }}</a>.
      </p>

      <h2>{{ 'Datos del titular' | t }}</h2>
      <p>
        <strong>{{ r.razonSocial }}</strong><br />
        {{ r.identificacionFiscal }}<br />
        {{ r.domicilio }}<br />
        <a [href]="r.web" target="_blank" rel="noopener">{{ r.web }}</a>
      </p>

      <h2>{{ 'Redes sociales' | t }}</h2>
      <ul class="ct-redes">
        @for (red of redes; track red.nombre) {
          <li>
            <a [href]="red.url" target="_blank" rel="noopener">
              <rs-social-icon [name]="red.icono" [size]="18" />
              <span>{{ red.nombre }}</span>
            </a>
          </li>
        }
      </ul>
    </app-legal-documento>
  `,
  styles: [`
    .ct-redes { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: var(--sp-3); }
    .ct-redes a {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--c-border); border-radius: var(--r-lg);
      text-decoration: none; color: var(--t-200);
    }
    .ct-redes a:hover { border-color: var(--c-accent); color: var(--c-accent); }
  `],
})
export class ContactoComponent {
  readonly r = RESPONSABLE;
  readonly redes = REDES_SOCIALES;
}
