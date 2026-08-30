import { VerticalKey } from 'shared';

/**
 * Preguntas frecuentes de la pantalla de confirmación de reserva.
 *
 * Es el momento en que al cliente le asaltan las dudas —cuándo le cobran, qué
 * pasa si cancela, qué papeles tiene que llevar— y hasta ahora la única salida
 * era abandonar la pantalla e irse al centro de ayuda. Contestarlas aquí evita
 * la mitad de los correos de soporte.
 *
 * Las respuestas son copy: se cambian aquí, sin tocar el componente.
 */
export interface PreguntaFrecuente {
  readonly pregunta: string;
  readonly respuesta: string;
}

/** Valen para cualquier categoría: el cobro, la confirmación y la cancelación. */
const COMUNES: ReadonlyArray<PreguntaFrecuente> = [
  {
    pregunta: '¿Cuándo recibo la confirmación?',
    respuesta: 'Ya está enviada al correo con el que has reservado. Si en unos minutos no aparece, revisa la carpeta de spam; también tienes la reserva completa en «Mis reservas».',
  },
  {
    pregunta: '¿Cuándo se cobra el importe?',
    respuesta: 'Se ha cobrado al confirmar la reserva. Si el estado de tu mascota no coincidiera con lo indicado al llegar al servicio, el establecimiento te avisará y tendrás que aceptar cualquier ajuste antes de que se cobre nada más.',
  },
  {
    pregunta: '¿Cómo cancelo o modifico la reserva?',
    respuesta: 'Desde «Mis reservas», entrando en esta reserva. El importe que se devuelve depende de la política de cancelación del establecimiento, que aparece en su ficha y en el detalle de la reserva.',
  },
  {
    pregunta: '¿Cómo contacto con el establecimiento?',
    respuesta: 'Sus datos de contacto están en el detalle de la reserva. Para cualquier cosa que no puedan resolver ellos, escríbenos desde el centro de ayuda.',
  },
];

/** Lo propio de cada categoría, que es donde están las dudas de verdad. */
const POR_VERTICAL: Partial<Record<VerticalKey, ReadonlyArray<PreguntaFrecuente>>> = {
  [VerticalKey.ALOJAMIENTO]: [
    {
      pregunta: '¿Qué tengo que llevar el día del ingreso?',
      respuesta: 'La cartilla de vacunación al día y, si el alojamiento lo pide, el certificado de desparasitación. Llevar su comida habitual y algo con su olor le ayuda a adaptarse.',
    },
    {
      pregunta: '¿Puedo saber cómo está durante la estancia?',
      respuesta: 'Sí. Muchos alojamientos envían fotos o tienen cámaras; consulta en su ficha qué ofrece el tuyo y acuérdalo con ellos al llegar.',
    },
  ],
  [VerticalKey.VETERINARIA]: [
    {
      pregunta: '¿Qué llevo a la cita?',
      respuesta: 'La cartilla sanitaria y, si los tienes, informes o analíticas previas. Si es una revisión por algo concreto, apunta desde cuándo lo notas: ayuda más de lo que parece.',
    },
    {
      pregunta: '¿Y si necesita pruebas o tratamiento?',
      respuesta: 'Lo que has pagado es la consulta. Cualquier prueba o tratamiento adicional lo presupuesta la clínica y lo autorizas tú antes de hacerlo.',
    },
  ],
  [VerticalKey.PELUQUERIA]: [
    {
      pregunta: '¿Cuánto dura la sesión?',
      respuesta: 'Depende del servicio y del tamaño y estado del manto. La peluquería te lo confirma al llegar; si el pelo está muy enredado puede llevar más tiempo del previsto.',
    },
    {
      pregunta: '¿Qué pasa si llego tarde?',
      respuesta: 'Avisa cuanto antes al salón. Las citas van seguidas, así que puede que haya que acortar el servicio o buscar otro hueco.',
    },
  ],
  [VerticalKey.TRANSPORTE]: [
    {
      pregunta: '¿Cómo se coordina la recogida?',
      respuesta: 'El transportista te contacta para cerrar la hora y el punto exacto. Ten localizable el teléfono que has dejado en la reserva.',
    },
    {
      pregunta: '¿Puedo acompañar a mi perro?',
      respuesta: 'Depende del vehículo y del servicio contratado. Lo indica la ficha del transportista; si no lo tienes claro, pregúntaselo al confirmar la recogida.',
    },
  ],
  [VerticalKey.ADIESTRAMIENTO]: [
    {
      pregunta: '¿Qué pasa en la primera sesión?',
      respuesta: 'El educador valora a tu perro y acordáis los objetivos. Lleva su collar y correa habituales, y premios de los que le gusten de verdad.',
    },
    {
      pregunta: '¿Puedo cambiar la fecha de una sesión?',
      respuesta: 'Sí, hablándolo con el educador con antelación. Un programa de varias sesiones funciona mejor si se mantiene el ritmo, así que evita espaciarlas demasiado.',
    },
  ],
  [VerticalKey.HOTELES]: [
    {
      pregunta: '¿El hotel cobra algo por mi mascota?',
      respuesta: 'El suplemento por mascota, si lo hay, está incluido en el importe que has pagado y desglosado en el detalle de la reserva.',
    },
    {
      pregunta: '¿Puede quedarse solo en la habitación?',
      respuesta: 'Cada hotel tiene su norma y muchos no lo permiten. Lo indica su ficha; confírmalo en recepción al hacer el ingreso.',
    },
  ],
};

/**
 * Preguntas de la confirmación para una categoría dada.
 *
 * Las propias van primero: son las que el cliente acaba de ganarse al reservar
 * justo eso, y las comunes ya se las sabe a la tercera reserva.
 */
export function faqDeConfirmacion(vertical: string): ReadonlyArray<PreguntaFrecuente> {
  return [...(POR_VERTICAL[vertical as VerticalKey] ?? []), ...COMUNES];
}
