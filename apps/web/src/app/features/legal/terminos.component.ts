import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Términos y condiciones de uso, y aviso legal, para quien reserva.
 *
 * Las condiciones que acepta el **comercio** viven aparte, en
 * `condiciones-comercio.component`: son un contrato mercantil con comisiones y
 * liquidaciones, y mezclarlo con lo que lee un cliente antes de reservar deja
 * las dos partes peor.
 *
 * El pie de la portada enlazaba aquí desde el principio, pero la ruta no
 * existía y el comodín `**` devolvía a la portada: el enlace parecía roto.
 */
@Component({
  selector: 'app-terminos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraducirPipe, LegalDocumentoComponent, RouterLink],
  template: `
    <app-legal-documento
      [titulo]="'Términos y condiciones' | t"
      [entradilla]="'Las reglas de uso de Doogking: qué somos, qué papel tenemos en tu reserva y qué derechos y obligaciones tenemos cada parte.' | t">

      <h2>{{ '1. Quién presta el servicio' | t }}</h2>
      <p>
        {{ 'Doogking es un servicio de' | t }} <strong>{{ r.razonSocial }}</strong>
        ({{ r.identificacionFiscal }}), {{ 'con domicilio en' | t }} {{ r.domicilio }}.
        {{ 'Contacto:' | t }} <a [href]="'mailto:' + r.emailSoporte">{{ r.emailSoporte }}</a>.
      </p>

      <h2>{{ '2. Qué es Doogking y qué no es' | t }}</h2>
      <p>
        {{ 'Doogking es un' | t }} <strong>{{ 'intermediario' | t }}</strong>{{ ': ponemos en contacto a quien busca un servicio para su perro con el profesional que lo presta, y gestionamos la reserva y el cobro.' | t }}
      </p>
      <p>
        {{ 'El servicio en sí —el alojamiento, la consulta veterinaria, el corte de pelo, el traslado, la sesión de adiestramiento— lo presta el comercio, bajo su responsabilidad y con sus propios medios, seguros y titulaciones. Doogking no es residencia, ni clínica, ni peluquería, ni transportista.' | t }}
      </p>

      <h2>{{ '3. Tu cuenta' | t }}</h2>
      <ul>
        <li>{{ 'Debes ser mayor de 18 años para reservar.' | t }}</li>
        <li>{{ 'Los datos que facilitas deben ser ciertos y estar al día; los usamos para identificarte y para que el comercio pueda atenderte.' | t }}</li>
        <li>{{ 'Eres responsable de tu contraseña y de lo que se haga desde tu cuenta.' | t }}</li>
        <li>{{ 'Puedes cerrar tu cuenta cuando quieras desde tu perfil.' | t }}</li>
      </ul>

      <h2>{{ '4. Reservas y precios' | t }}</h2>
      <ul>
        <li>{{ 'Los precios se muestran en euros y con el IVA incluido: lo que ves es lo que pagas.' | t }}</li>
        <li>{{ 'La reserva no queda confirmada hasta que el pago se aprueba. Hasta entonces la plaza sólo está retenida durante unos minutos.' | t }}</li>
        <li>{{ 'Al confirmar recibes un código de reserva y un correo con el detalle.' | t }}</li>
        <li>{{ 'Algunos servicios requieren que el comercio acepte la solicitud antes de cobrarla; se indica en la ficha.' | t }}</li>
      </ul>

      <h2>{{ '5. Pagos' | t }}</h2>
      <p>
        {{ 'Los pagos los procesa' | t }} <strong>Stripe</strong>.
        {{ 'Los datos de tu tarjeta viajan directamente a Stripe y nunca pasan por nuestros servidores.' | t }}
      </p>

      <h2>{{ '6. Cancelaciones y reembolsos' | t }}</h2>
      <p>
        {{ 'Cada comercio fija su política de cancelación y la muestra en la ficha del servicio antes de que pagues. Es la que se aplica.' | t }}
      </p>
      <p>
        {{ 'Cuando la cancelación da derecho a devolución, el importe vuelve al mismo medio de pago. El plazo depende de tu banco.' | t }}
      </p>

      <h2>{{ '7. Obligaciones de quien reserva' | t }}</h2>
      <ul>
        <li>{{ 'Facilitar información veraz sobre tu perro: vacunas, tratamientos, alergias y comportamiento. De ello depende su seguridad y la de los demás animales.' | t }}</li>
        <li>{{ 'Cumplir la normativa aplicable a los perros potencialmente peligrosos.' | t }}</li>
        <li>{{ 'Presentarte a la hora acordada o avisar con la antelación que marque la política de cancelación.' | t }}</li>
      </ul>

      <h2>{{ '8. Reseñas' | t }}</h2>
      <p>
        {{ 'Sólo puede valorar quien ha completado una reserva. Retiramos las reseñas con insultos, datos personales de terceros o contenido ajeno al servicio prestado.' | t }}
      </p>

      <h2>{{ '9. Responsabilidad' | t }}</h2>
      <p>
        {{ 'Respondemos del funcionamiento de la plataforma, de la gestión de la reserva y del cobro. De la prestación del servicio responde el comercio.' | t }}
      </p>
      <p>
        {{ 'Si algo sale mal, abre una incidencia desde tu reserva: mediamos entre las dos partes y, cuando procede, gestionamos la devolución.' | t }}
      </p>

      <h2>{{ '10. Derecho de desistimiento' | t }}</h2>
      <p>
        {{ 'Los servicios reservados para una fecha concreta están excluidos del desistimiento de 14 días previsto en la normativa europea de consumo (artículo 16.l de la Directiva 2011/83/UE). Lo que se aplica es la política de cancelación del comercio.' | t }}
      </p>

      <h2>{{ '11. Propiedad intelectual' | t }}</h2>
      <p>
        {{ 'La marca, el diseño y el software de la plataforma son de' | t }} {{ r.razonSocial }}.
        {{ 'Las fotos y textos de cada ficha son de su comercio, que autoriza su publicación aquí.' | t }}
      </p>

      <h2>{{ '12. Cambios en estas condiciones' | t }}</h2>
      <p>
        {{ 'Podemos actualizarlas. Si el cambio te afecta de forma relevante te avisaremos por correo antes de que entre en vigor. Las reservas ya confirmadas se rigen por las condiciones vigentes cuando se hicieron.' | t }}
      </p>

      <h2>{{ '13. Ley aplicable y reclamaciones' | t }}</h2>
      <p>
        {{ 'Se aplica la legislación española y la de la Unión Europea. Como persona consumidora puedes acudir a los tribunales de tu domicilio y a la plataforma europea de resolución de litigios en línea.' | t }}
      </p>

      <h2>{{ '14. Documentos relacionados' | t }}</h2>
      <p>
        <a routerLink="/privacidad">{{ 'Política de privacidad' | t }}</a> ·
        <a routerLink="/cookies">{{ 'Política de cookies' | t }}</a> ·
        <a routerLink="/condiciones">{{ 'Condiciones para comercios' | t }}</a> ·
        <a routerLink="/contacto">{{ 'Contacto' | t }}</a>
      </p>
    </app-legal-documento>
  `,
})
export class TerminosComponent {
  readonly r = RESPONSABLE;
}
