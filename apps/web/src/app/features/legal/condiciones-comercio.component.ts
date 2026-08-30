import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CONDICIONES_COMERCIO_VERSION } from 'shared';
import { LegalDocumentoComponent } from './legal-documento.component';
import { RESPONSABLE } from './legal.datos';

/**
 * Condiciones generales del servicio para comercios.
 *
 * Es el texto que el comercio acepta al cerrar su alta guiada. La versión que se
 * muestra al pie es la misma que se sella junto a la aceptación
 * (`CONDICIONES_COMERCIO_VERSION`): si se publica un texto nuevo hay que subir
 * esa constante, o las aceptaciones antiguas dirían apuntar a un documento que
 * ya no es el que se firmó.
 */
@Component({
  selector: 'app-condiciones-comercio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LegalDocumentoComponent],
  template: `
    <app-legal-documento
      titulo="Condiciones generales del servicio"
      entradilla="Las reglas del acuerdo entre {{ r.marca }} y los negocios que ofrecen sus servicios en la plataforma.">

      <p class="version">Versión {{ version }}</p>

      <h2>1. Qué es {{ r.marca }}</h2>
      <p>
        {{ r.marca }} es un <strong>intermediario</strong>: pone en contacto a dueños de perros con
        negocios que prestan servicios caninos y gestiona la reserva y el cobro. No presta los
        servicios anunciados ni es parte del contrato de prestación, que se celebra entre el
        cliente y el comercio.
      </p>

      <h2>2. Quién puede darse de alta</h2>
      <p>
        Puede publicar en {{ r.marca }} cualquier empresa o profesional que opere legalmente y que
        cuente con los permisos, licencias, seguros y titulaciones que su actividad exija en el
        país donde la presta. Al completar el alta, el comercio declara que cumple esos
        requisitos.
      </p>
      <p>
        {{ r.marca }} puede solicitar documentación acreditativa en cualquier momento y verificar
        los datos aportados. Si la documentación no se aporta, no corresponde con la realidad o
        caduca, la cuenta puede quedar suspendida hasta regularizarla.
      </p>

      <h2>3. Publicación de servicios</h2>
      <p>
        El comercio es responsable de que la información de sus fichas —descripción, precios,
        dirección, horarios, capacidad y condiciones— sea exacta y esté al día. Las fichas se
        crean en estado <strong>borrador</strong> y sólo son visibles en el buscador cuando el
        comercio las publica y su cuenta está activa.
      </p>

      <h2>4. Reservas y cancelaciones</h2>
      <p>
        Una reserva confirmada obliga al comercio a prestar el servicio en las condiciones
        anunciadas. Las cancelaciones se rigen por la política que el propio comercio declara en
        su ficha (flexible, moderada o estricta), que se muestra al cliente antes de pagar.
      </p>
      <p>
        Las cancelaciones repetidas por parte del comercio afectan a su posición en los resultados
        y pueden motivar la suspensión de la cuenta.
      </p>

      <h2>5. Precios, comisión y liquidaciones</h2>
      <p>
        Los precios los fija el comercio e incluyen los impuestos aplicables. {{ r.marca }} cobra
        al cliente en el momento de la reserva y aplica una <strong>comisión</strong> sobre el
        importe, según el porcentaje vigente para su categoría o el pactado con el comercio.
      </p>
      <p>
        La liquidación se abona en la cuenta bancaria declarada por el comercio, descontando la
        comisión de la plataforma y los costes de la pasarela de pago. El detalle de cada
        liquidación está disponible en el panel.
      </p>

      <h2>6. Obligaciones del comercio</h2>
      <ul>
        <li>Prestar el servicio con la diligencia profesional exigible a su actividad.</li>
        <li>Mantener vigentes los permisos, licencias y seguros que su actividad requiera.</li>
        <li>Tratar los datos de los clientes conforme a la normativa de protección de datos y
            usarlos únicamente para prestar el servicio reservado.</li>
        <li>Atender las reservas recibidas y mantener la disponibilidad publicada.</li>
        <li>No dirigir a los clientes captados en la plataforma fuera de ella para eludir la
            comisión.</li>
      </ul>

      <h2>7. Reseñas</h2>
      <p>
        Los clientes pueden valorar el servicio recibido. {{ r.marca }} no edita ni retira reseñas
        por petición del comercio, salvo que incumplan las normas de publicación (contenido
        ofensivo, datos personales o valoraciones no vinculadas a una reserva real). El comercio
        puede responder públicamente a cualquier reseña.
      </p>

      <h2>8. Suspensión y baja</h2>
      <p>
        El comercio puede darse de baja cuando quiera desde <em>Panel → Mi cuenta</em>, sin
        permanencia. Las reservas ya confirmadas deben atenderse o cancelarse conforme a la
        política declarada.
      </p>
      <p>
        {{ r.marca }} puede suspender una cuenta que incumpla estas condiciones, que no acredite
        los requisitos legales de su actividad o que acumule incidencias graves con clientes. La
        suspensión se comunica con su motivo.
      </p>

      <h2>9. Responsabilidad</h2>
      <p>
        {{ r.marca }} responde del funcionamiento de la plataforma y de la gestión del cobro. La
        prestación del servicio, su calidad y los daños derivados de ella corresponden al comercio,
        que debe contar con la cobertura de responsabilidad civil que su actividad exija.
      </p>

      <h2>10. Cambios en estas condiciones</h2>
      <p>
        Si estas condiciones cambian, se avisa al comercio con antelación razonable y se le pide
        aceptar la nueva versión. La versión aceptada por cada comercio queda registrada con su
        fecha.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Para cualquier duda sobre estas condiciones:
        <a [href]="'mailto:' + r.emailSoporte">{{ r.emailSoporte }}</a>.
      </p>
    </app-legal-documento>
  `,
  styles: [`
    .version {
      font-size: .875rem; color: var(--t-400);
      margin-bottom: 1.5rem;
    }
  `],
})
export class CondicionesComercioComponent {
  readonly r = RESPONSABLE;
  readonly version = CONDICIONES_COMERCIO_VERSION;
}
