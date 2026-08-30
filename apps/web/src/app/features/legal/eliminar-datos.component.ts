import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';

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
  imports: [LegalDocumentoComponent, RouterLink],
  template: `
    <app-legal-documento
      titulo="Eliminación de datos"
      entradilla="Cómo pedir que borremos tu cuenta y los datos asociados, qué se elimina y en cuánto tiempo.">

      <h2>Cómo solicitarlo</h2>
      <ol>
        <li>
          Escribe a <a [href]="enlaceCorreo">{{ r.emailPrivacidad }}</a> desde la dirección de
          correo con la que te registraste, con el asunto «Solicitud de eliminación de datos».
        </li>
        <li>
          Indica si quieres borrar <strong>toda la cuenta</strong> o solo <strong>la vinculación
          con Facebook o Google</strong>, para poder seguir entrando con tu correo.
        </li>
        <li>
          Te confirmamos la recepción y completamos el borrado en un plazo máximo de
          <strong>30 días</strong>.
        </li>
      </ol>
      <p>
        Si tu cuenta es de un <strong>comercio</strong>, puedes hacerlo tú desde el panel:
        <em>Panel → Mi cuenta → Cerrar cuenta</em>.
      </p>

      <h2>Qué se elimina</h2>
      <ul>
        <li>Tu perfil: nombre, correo, teléfono, contraseña y foto.</li>
        <li>Las fichas de tus mascotas, con sus fotos y su información sanitaria.</li>
        <li>Tus favoritos y las reseñas que hayas publicado.</li>
        <li>
          Los dispositivos registrados para notificaciones, de modo que dejas de recibir avisos
          de inmediato.
        </li>
        <li>La vinculación con Google y con Meta, si la tenías.</li>
      </ul>

      <h2>Qué conservamos, y por qué</h2>
      <p>
        Las <strong>reservas y sus pagos</strong> no se borran con la cuenta: la normativa fiscal
        y mercantil obliga a conservar los justificantes de una operación económica durante seis
        años. Lo que sí hacemos es <strong>disociarlos</strong>, de forma que dejan de estar
        vinculados a tu identidad y quedan solo como el registro contable de la transacción.
      </p>
      <p>
        Tampoco podemos borrar los datos que el comercio con el que reservaste conserve en sus
        propios sistemas: para eso tienes que dirigirte a él directamente.
      </p>

      <h2>Revocar el acceso desde Facebook</h2>
      <p>
        Con independencia de lo anterior, puedes retirarle a {{ r.marca }} el permiso sobre tu
        cuenta de Facebook desde
        <em>Configuración y privacidad → Configuración → Apps y sitios web</em>. Eso corta el
        acceso, pero <strong>no borra</strong> los datos que ya tengamos: para eso, sigue los
        pasos de arriba.
      </p>

      <p>
        Más detalle sobre qué tratamos y durante cuánto tiempo, en la
        <a routerLink="/privacidad">política de privacidad</a>.
      </p>
    </app-legal-documento>
  `,
})
export class EliminarDatosComponent {
  protected readonly r = RESPONSABLE;
  protected readonly enlaceCorreo = `mailto:${RESPONSABLE.emailPrivacidad}?subject=${ASUNTO}`;
}
