import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Asunto prefijado del correo, para que la solicitud llegue identificada. */
const ASUNTO = encodeURIComponent('Solicitud de eliminación de datos');

/**
 * Instrucciones de eliminación de datos de usuario.
 *
 * Es la URL que Meta exige para publicar una app con inicio de sesión de
 * Facebook ("Eliminación de datos de usuario"), y también sirve para el derecho
 * de supresión del RGPD.
 *
 * El texto describe el procedimiento **real**: hoy la baja del usuario se
 * atiende por correo, porque el API sólo expone el cierre de cuenta para
 * comercios (`DELETE /comercios/mi-cuenta`). Si algún día se añade un botón de
 * borrado en el perfil, esta página es lo primero que hay que actualizar.
 */
@Component({
  selector: 'app-eliminar-datos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TraducirPipe, LegalDocumentoComponent, RouterLink
  ],
  template: `
    <app-legal-documento
      titulo="Eliminación de datos"
      entradilla="Cómo pedir que borremos tu cuenta y los datos asociados, qué se elimina y en cuánto tiempo.">

      <h2>{{ 'Cómo solicitarlo' | t }}</h2>
      <ol>
        <li>
          {{ 'Escribe a' | t }} <a [href]="enlaceCorreo">{{ r.emailPrivacidad }}</a> {{ 'desde la dirección de correo con la que te registraste, con el asunto «Solicitud de eliminación de datos».' | t }}
        </li>
        <li>
          {{ 'Indica si quieres borrar' | t }} <strong>{{ 'toda la cuenta' | t }}</strong> {{ 'o solo' | t }} <strong>{{ 'la vinculación con Facebook o Google' | t }}</strong>{{ ', para poder seguir entrando con tu correo.' | t }}
        </li>
        <li>
          {{ 'Te confirmamos la recepción y completamos el borrado en un plazo máximo de' | t }}
          <strong>{{ '30 días' | t }}</strong>.
        </li>
      </ol>
      <p>
        {{ 'Si tu cuenta es de un' | t }} <strong>{{ 'comercio' | t }}</strong>{{ ', puedes hacerlo tú desde el panel:' | t }}
        <em>{{ 'Panel → Mi cuenta → Cerrar cuenta' | t }}</em>.
      </p>

      <h2>{{ 'Qué se elimina' | t }}</h2>
      <ul>
        <li>{{ 'Tu perfil: nombre, correo, teléfono, contraseña y foto.' | t }}</li>
        <li>{{ 'Las fichas de tus mascotas, con sus fotos y su información sanitaria.' | t }}</li>
        <li>{{ 'Tus favoritos y las reseñas que hayas publicado.' | t }}</li>
        <li>
          {{ 'Los dispositivos registrados para notificaciones, de modo que dejas de recibir avisos de inmediato.' | t }}
        </li>
        <li>{{ 'La vinculación con Google y con Meta, si la tenías.' | t }}</li>
      </ul>

      <h2>{{ 'Qué conservamos, y por qué' | t }}</h2>
      <p>
        {{ 'Las' | t }} <strong>{{ 'reservas y sus pagos' | t }}</strong> {{ 'no se borran con la cuenta: la normativa fiscal y mercantil obliga a conservar los justificantes de una operación económica durante seis años. Lo que sí hacemos es' | t }} <strong>{{ 'disociarlos' | t }}</strong>{{ ', de forma que dejan de estar vinculados a tu identidad y quedan solo como el registro contable de la transacción.' | t }}
      </p>
      <p>
        {{ 'Tampoco podemos borrar los datos que el comercio con el que reservaste conserve en sus propios sistemas: para eso tienes que dirigirte a él directamente.' | t }}
      </p>

      <h2>{{ 'Revocar el acceso desde Facebook' | t }}</h2>
      <p>
        Con independencia de lo anterior, puedes retirarle a {{ r.marca }} el permiso sobre tu
        cuenta de Facebook desde
        <em>{{ 'Configuración y privacidad → Configuración → Apps y sitios web' | t }}</em>{{ '. Eso corta el acceso, pero' | t }} <strong>{{ 'no borra' | t }}</strong> {{ 'los datos que ya tengamos: para eso, sigue los pasos de arriba.' | t }}
      </p>

      <p>
        {{ 'Más detalle sobre qué tratamos y durante cuánto tiempo, en la' | t }}
        <a routerLink="/privacidad">{{ 'política de privacidad' | t }}</a>.
      </p>
    </app-legal-documento>
  `,
})
export class EliminarDatosComponent {
  protected readonly r = RESPONSABLE;
  protected readonly enlaceCorreo = `mailto:${RESPONSABLE.emailPrivacidad}?subject=${ASUNTO}`;
}
