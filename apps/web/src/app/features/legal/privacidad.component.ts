import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Política de privacidad.
 *
 * El contenido describe lo que la plataforma hace de verdad: cada categoría de
 * datos sale de un esquema real (`usuarios`, `perros`, `reservas`, `pagos`,
 * `dispositivos`, `reseñas`) y cada destinatario, de una integración que existe
 * en el código. Al tocar cualquiera de esas piezas hay que revisar esta página.
 */
@Component({
  selector: 'app-privacidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TraducirPipe, LegalDocumentoComponent, RouterLink
  ],
  template: `
    <app-legal-documento
      titulo="Política de privacidad"
      entradilla="Qué datos tratamos cuando reservas servicios para tu mascota en Doogking, para qué los usamos y cómo ejercer tus derechos.">

      <h2>{{ '1. Quién trata tus datos' | t }}</h2>
      <p>
        {{ 'El responsable del tratamiento es' | t }} <strong>{{ r.razonSocial }}</strong>
        ({{ r.identificacionFiscal }}), con domicilio en {{ r.domicilio }}, titular de la
        plataforma {{ r.marca }} ({{ r.web }}).
      </p>
      <p>{{ 'Para cualquier asunto de privacidad:' | t }} <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a>.</p>

      <h2>{{ '2. Qué datos tratamos' | t }}</h2>

      <h3>{{ 'Datos de tu cuenta' | t }}</h3>
      <ul>
        <li>{{ 'Nombre, correo electrónico y, si lo facilitas, teléfono.' | t }}</li>
        <li>Contraseña, guardada siempre cifrada: nadie de {{ r.marca }} puede leerla.</li>
        <li>
          {{ 'Si entras con Google o con Meta, el proveedor nos comunica tu correo, tu nombre y tu foto de perfil. No recibimos tu contraseña ni accedemos a tus contactos ni a tus publicaciones.' | t }}
        </li>
      </ul>

      <h3>{{ 'Datos de tu mascota' | t }}</h3>
      <p>
        {{ 'Los que rellenes en su ficha: nombre, fotos, especie y raza, fecha de nacimiento, sexo, si está esterilizada, peso, tamaño, tipo de pelo, número de microchip y su información sanitaria (vacunas y fechas, alergias y medicación).' | t }}
      </p>
      <p>
        {{ 'Esa información sanitaria se comparte' | t }} <strong>{{ 'únicamente con el comercio de la reserva' | t }}</strong>
        {{ '—la residencia, la clínica o el peluquero— porque la necesita para atenderla con seguridad.' | t }}
      </p>

      <h3>{{ 'Reservas y pagos' | t }}</h3>
      <ul>
        <li>{{ 'Servicio y comercio reservados, fechas, importe, estado y código de reserva.' | t }}</li>
        <li>
          {{ 'Los pagos los procesa' | t }} <strong>Stripe</strong>{{ '. Los datos de tu tarjeta viajan directamente a Stripe y' | t }} <strong>{{ 'nunca pasan por nuestros servidores' | t }}</strong>{{ ': de un pago solo guardamos su importe, su estado y la referencia que nos devuelve Stripe.' | t }}
        </li>
      </ul>

      <h3>{{ 'Uso de la plataforma' | t }}</h3>
      <ul>
        <li>{{ 'Reseñas y valoraciones que publiques, y los servicios que marques como favoritos.' | t }}</li>
        <li>
          {{ 'Si activas las notificaciones en el móvil, el identificador del dispositivo y su plataforma, para poder enviarte los avisos de tus reservas.' | t }}
        </li>
        <li>{{ 'Registro de los correos y avisos que te enviamos, para poder comprobar qué se te comunicó.' | t }}</li>
      </ul>

      <h2>{{ '3. Para qué los usamos y con qué base legal' | t }}</h2>
      <table class="rs-tabla">
        <thead>
          <tr><th>{{ 'Finalidad' | t }}</th><th>{{ 'Base legal' | t }}</th></tr>
        </thead>
        <tbody>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Crear y mantener tu cuenta, y darte acceso a la plataforma.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Ejecución del contrato.' | t }}</td>
          </tr>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Gestionar tus reservas y ponerte en contacto con el comercio.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Ejecución del contrato.' | t }}</td>
          </tr>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Cobrar la reserva y liquidar al comercio.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Ejecución del contrato y obligación legal (contabilidad y facturación).' | t }}</td>
          </tr>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Avisarte del estado de tu reserva por correo o notificación.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Ejecución del contrato.' | t }}</td>
          </tr>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Prevenir usos fraudulentos y mantener la seguridad del servicio.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Interés legítimo.' | t }}</td>
          </tr>
          <tr>
            <td [attr.data-label]="'Finalidad' | t">{{ 'Conservar reseñas publicadas.' | t }}</td>
            <td [attr.data-label]="'Base legal' | t">{{ 'Consentimiento, que puedes retirar retirando la reseña.' | t }}</td>
          </tr>
        </tbody>
      </table>

      <h2>{{ '4. Quién más ve tus datos' | t }}</h2>
      <p>{{ 'No vendemos tus datos ni los cedemos con fines publicitarios. Acceden a ellos:' | t }}</p>
      <ul>
        <li>
          <strong>{{ 'El comercio que reservas' | t }}</strong>{{ ': tu nombre, tu contacto y los datos de la mascota que necesita para prestarte el servicio.' | t }}
        </li>
        <li><strong>Stripe</strong> {{ '(Irlanda), para procesar el pago.' | t }}</li>
        <li><strong>Google</strong> y <strong>{{ 'Meta' | t }}</strong>{{ ', solo si eliges entrar con sus botones.' | t }}</li>
        <li>
          <strong>{{ 'Google Maps y Places' | t }}</strong>{{ ', para buscar por ciudad y situar los negocios en el mapa. Las consultas salen desde nuestro servidor.' | t }}
        </li>
        <li><strong>{{ 'Firebase Cloud Messaging' | t }}</strong> {{ '(Google), para entregar las notificaciones push.' | t }}</li>
        <li>{{ 'El proveedor de correo con el que enviamos las confirmaciones y avisos.' | t }}</li>
        <li>{{ 'Nuestros proveedores de alojamiento y base de datos, que guardan la información cifrada.' | t }}</li>
      </ul>
      <p>
        {{ 'Cuando un proveedor está fuera del Espacio Económico Europeo, la transferencia se ampara en las cláusulas contractuales tipo aprobadas por la Comisión Europea.' | t }}
      </p>

      <h3>{{ 'Solicitudes de autoridades públicas' | t }}</h3>
      <p>
        {{ 'Podemos vernos obligados a facilitar datos a juzgados, fuerzas y cuerpos de seguridad o autoridades administrativas. Cuando ocurre:' | t }}
      </p>
      <ul>
        <li>{{ 'Comprobamos que la solicitud tiene amparo legal y viene de quien dice venir.' | t }}</li>
        <li>{{ 'La recurrimos si la consideramos ilícita o desproporcionada.' | t }}</li>
        <li>{{ 'Entregamos' | t }} <strong>{{ 'solo' | t }}</strong> {{ 'los datos concretos que la solicitud requiere, nunca más.' | t }}</li>
        <li>{{ 'Dejamos constancia escrita de cada solicitud, de nuestra respuesta y de su base legal.' | t }}</li>
        <li>{{ 'Te avisamos siempre que la ley nos lo permita.' | t }}</li>
      </ul>

      <h2>{{ '5. Cuánto tiempo los guardamos' | t }}</h2>
      <ul>
        <li>{{ 'Los datos de la cuenta y de tus mascotas, mientras la cuenta siga abierta.' | t }}</li>
        <li>
          {{ 'Las reservas y sus pagos, durante los plazos que exige la normativa fiscal y mercantil (seis años desde la última operación), aunque cierres la cuenta.' | t }}
        </li>
        <li>{{ 'Las reseñas, hasta que las retires.' | t }}</li>
      </ul>

      <h2>{{ '6. Tus derechos' | t }}</h2>
      <p>
        {{ 'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, limitarlo y pedir que te los entreguemos en un formato portable. También puedes retirar tu consentimiento en cualquier momento.' | t }}
      </p>
      <p>
        {{ 'Escribe a' | t }} <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a> {{ 'desde la dirección de tu cuenta y te respondemos en un plazo máximo de 30 días. Para borrar tus datos tienes los pasos detallados en' | t }}
        <a routerLink="/eliminar-datos">{{ 'Eliminación de datos' | t }}</a>.
      </p>
      <p>
        {{ 'Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (' | t }}<a href="https://www.aepd.es" rel="noopener" target="_blank">{{ 'aepd.es' | t }}</a>).
      </p>

      <h2>{{ '7. Menores' | t }}</h2>
      <p>
        {{ 'La plataforma está dirigida a mayores de 18 años. No solicitamos ni tratamos datos de menores de forma consciente.' | t }}
      </p>

      <h2>{{ '8. Cambios en esta política' | t }}</h2>
      <p>
        {{ 'Si cambiamos cómo tratamos tus datos, actualizamos esta página y te avisamos por correo cuando el cambio te afecte de forma relevante.' | t }}
      </p>
    </app-legal-documento>
  `,
})
export class PrivacidadComponent {
  protected readonly r = RESPONSABLE;
}
