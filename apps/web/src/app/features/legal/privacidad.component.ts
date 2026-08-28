import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';

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
  imports: [LegalDocumentoComponent, RouterLink],
  template: `
    <app-legal-documento
      titulo="Política de privacidad"
      entradilla="Qué datos tratamos cuando reservas servicios para tu mascota en Doogking, para qué los usamos y cómo ejercer tus derechos.">

      <h2>1. Quién trata tus datos</h2>
      <p>
        El responsable del tratamiento es <strong>{{ r.razonSocial }}</strong>
        ({{ r.identificacionFiscal }}), con domicilio en {{ r.domicilio }}, titular de la
        plataforma {{ r.marca }} ({{ r.web }}).
      </p>
      <p>Para cualquier asunto de privacidad: <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a>.</p>

      <h2>2. Qué datos tratamos</h2>

      <h3>Datos de tu cuenta</h3>
      <ul>
        <li>Nombre, correo electrónico y, si lo facilitas, teléfono.</li>
        <li>Contraseña, guardada siempre cifrada: nadie de {{ r.marca }} puede leerla.</li>
        <li>
          Si entras con Google o con Meta, el proveedor nos comunica tu correo, tu nombre y tu
          foto de perfil. No recibimos tu contraseña ni accedemos a tus contactos ni a tus
          publicaciones.
        </li>
      </ul>

      <h3>Datos de tu mascota</h3>
      <p>
        Los que rellenes en su ficha: nombre, fotos, especie y raza, fecha de nacimiento, sexo,
        si está esterilizada, peso, tamaño, tipo de pelo, número de microchip y su información
        sanitaria (vacunas y fechas, alergias y medicación).
      </p>
      <p>
        Esa información sanitaria se comparte <strong>únicamente con el comercio de la reserva</strong>
        —la residencia, la clínica o el peluquero— porque la necesita para atenderla con seguridad.
      </p>

      <h3>Reservas y pagos</h3>
      <ul>
        <li>Servicio y comercio reservados, fechas, importe, estado y código de reserva.</li>
        <li>
          Los pagos los procesa <strong>Stripe</strong>. Los datos de tu tarjeta viajan directamente
          a Stripe y <strong>nunca pasan por nuestros servidores</strong>: de un pago solo guardamos
          su importe, su estado y la referencia que nos devuelve Stripe.
        </li>
      </ul>

      <h3>Uso de la plataforma</h3>
      <ul>
        <li>Reseñas y valoraciones que publiques, y los servicios que marques como favoritos.</li>
        <li>
          Si activas las notificaciones en el móvil, el identificador del dispositivo y su
          plataforma, para poder enviarte los avisos de tus reservas.
        </li>
        <li>Registro de los correos y avisos que te enviamos, para poder comprobar qué se te comunicó.</li>
      </ul>

      <h2>3. Para qué los usamos y con qué base legal</h2>
      <table>
        <thead>
          <tr><th>Finalidad</th><th>Base legal</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Crear y mantener tu cuenta, y darte acceso a la plataforma.</td>
            <td>Ejecución del contrato.</td>
          </tr>
          <tr>
            <td>Gestionar tus reservas y ponerte en contacto con el comercio.</td>
            <td>Ejecución del contrato.</td>
          </tr>
          <tr>
            <td>Cobrar la reserva y liquidar al comercio.</td>
            <td>Ejecución del contrato y obligación legal (contabilidad y facturación).</td>
          </tr>
          <tr>
            <td>Avisarte del estado de tu reserva por correo o notificación.</td>
            <td>Ejecución del contrato.</td>
          </tr>
          <tr>
            <td>Prevenir usos fraudulentos y mantener la seguridad del servicio.</td>
            <td>Interés legítimo.</td>
          </tr>
          <tr>
            <td>Conservar reseñas publicadas.</td>
            <td>Consentimiento, que puedes retirar retirando la reseña.</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Quién más ve tus datos</h2>
      <p>No vendemos tus datos ni los cedemos con fines publicitarios. Acceden a ellos:</p>
      <ul>
        <li>
          <strong>El comercio que reservas</strong>: tu nombre, tu contacto y los datos de la
          mascota que necesita para prestarte el servicio.
        </li>
        <li><strong>Stripe</strong> (Irlanda), para procesar el pago.</li>
        <li><strong>Google</strong> y <strong>Meta</strong>, solo si eliges entrar con sus botones.</li>
        <li>
          <strong>Google Maps y Places</strong>, para buscar por ciudad y situar los negocios en el
          mapa. Las consultas salen desde nuestro servidor.
        </li>
        <li><strong>Firebase Cloud Messaging</strong> (Google), para entregar las notificaciones push.</li>
        <li>El proveedor de correo con el que enviamos las confirmaciones y avisos.</li>
        <li>Nuestros proveedores de alojamiento y base de datos, que guardan la información cifrada.</li>
      </ul>
      <p>
        Cuando un proveedor está fuera del Espacio Económico Europeo, la transferencia se ampara en
        las cláusulas contractuales tipo aprobadas por la Comisión Europea.
      </p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Los datos de la cuenta y de tus mascotas, mientras la cuenta siga abierta.</li>
        <li>
          Las reservas y sus pagos, durante los plazos que exige la normativa fiscal y mercantil
          (seis años desde la última operación), aunque cierres la cuenta.
        </li>
        <li>Las reseñas, hasta que las retires.</li>
      </ul>

      <h2>6. Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, limitarlo
        y pedir que te los entreguemos en un formato portable. También puedes retirar tu
        consentimiento en cualquier momento.
      </p>
      <p>
        Escribe a <a [href]="'mailto:' + r.emailPrivacidad">{{ r.emailPrivacidad }}</a> desde la
        dirección de tu cuenta y te respondemos en un plazo máximo de 30 días. Para borrar tus
        datos tienes los pasos detallados en
        <a routerLink="/eliminar-datos">Eliminación de datos</a>.
      </p>
      <p>
        Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española
        de Protección de Datos (<a href="https://www.aepd.es" rel="noopener" target="_blank">aepd.es</a>).
      </p>

      <h2>7. Menores</h2>
      <p>
        La plataforma está dirigida a mayores de 18 años. No solicitamos ni tratamos datos de
        menores de forma consciente.
      </p>

      <h2>8. Cambios en esta política</h2>
      <p>
        Si cambiamos cómo tratamos tus datos, actualizamos esta página y te avisamos por correo
        cuando el cambio te afecte de forma relevante.
      </p>
    </app-legal-documento>
  `,
})
export class PrivacidadComponent {
  protected readonly r = RESPONSABLE;
}
