import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { CATEGORIA_ICONOS } from '../media/images';

/**
 * Configuración de UI de cada categoría canina: única fuente de verdad para el
 * menú, el buscador y las vistas de listado. Añadir un vertical = añadir una
 * entrada aquí (más su ruta en `app.routes.ts`); ningún componente mantiene su
 * propia copia de rutas, etiquetas o iconos.
 */
export interface VerticalUi {
  readonly key: VerticalKey;
  /** Etiqueta completa: 'Alojamiento canino'. */
  readonly label: string;
  /** Etiqueta corta para chips y menús: 'Alojamiento'. */
  readonly labelCorto: string;
  readonly route: string;
  /** Icono SVG de marca (`public/icons`). */
  readonly icono: string;
  /** Nombre del icono de trazo (`<rs-icon>`) para textos y botones. */
  readonly icon: string;
  /** Gancho comercial de una línea. */
  readonly claim: string;
  /** Descripción de la vista de listado. */
  readonly descripcion: string;
  /**
   * Titular de la cabecera del listado. Si falta, la vista usa `label`.
   * Es el único sitio donde vive el copy de marca de cada categoría: ninguna
   * plantilla debe escribir estos textos a mano.
   *
   * Se escribe con mayúscula solo en la primera palabra y en los nombres
   * propios, nunca en versales: dos categorías estaban en MAYÚSCULAS y las
   * demás no, así que cambiar de servicio cambiaba el tono de la pantalla. El
   * tamaño y el peso ya los pone `.ls__head h1`; el texto no tiene que gritar.
   */
  readonly titular?: string;
  /** Subtitular emocional bajo el titular. Si falta, la vista usa `descripcion`. */
  readonly subtitular?: string;
  /**
   * Reclamo que se pinta bajo el buscador en la página de resultados, con la
   * ilustración de la categoría al lado.
   *
   * Va aparte de `titular`/`subtitular`, que encabezan la vista: este habla al
   * que ya está buscando y le dice por qué merece la pena reservar aquí.
   */
  readonly reclamo: { readonly titulo: string; readonly texto: string };
  /** true = se reserva por noches (entrada/salida); false = cita puntual. */
  readonly reservaPorNoches: boolean;
  /**
   * true = la reserva ocupa un slot horario, así que el buscador pide la hora
   * además del día y puede devolver directamente los servicios que encajan.
   */
  readonly pideHora?: boolean;
  readonly labelUbicacion: string;
  readonly placeholderUbicacion: string;
  readonly labelFecha: string;
  /**
   * true = la categoría existe (ruta, fichas, panel de comercio) pero no se
   * anuncia todavía en la navegación pública. Se retira del escaparate sin
   * borrar el vertical ni romper los enlaces de quien ya la tenga guardada.
   */
  readonly fueraDelEscaparate?: boolean;
}

/** Orden de aparición en el menú y en el buscador (frecuencia de uso). */
export const VERTICALES_UI: readonly VerticalUi[] = [
  {
    key: VerticalKey.VETERINARIA,
    label: VERTICAL_LABELS[VerticalKey.VETERINARIA],
    labelCorto: 'Veterinarios',
    route: '/veterinaria',
    icono: CATEGORIA_ICONOS['veterinaria'],
    icon: 'stethoscope',
    claim: 'Cuida su salud con veterinarios de confianza.',
    // No se nombran cirugía ni dermatología: Doogking no intermedia esos
    // servicios (regla de negocio, ver plan unificado §2.2).
    descripcion: 'Clínicas verificadas: consulta, vacunación, urgencias 24 h, higiene dental y teleconsulta.',
    titular: 'Veterinarios de confianza',
    subtitular: 'Clínicas veterinarias para tu mascota: vacunación, citas, urgencias 24 h y más.',
    reservaPorNoches: false,
    pideHora: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad de la clínica',
    labelFecha: 'Fecha de la cita',
    reclamo: {
      titulo: 'Cuidar su salud es cuidar su felicidad',
      texto: 'Encuentra clínicas y veterinarios certificados con atención profesional, cercana y de confianza para tu mejor amigo.',
    },
  },
  {
    key: VerticalKey.PELUQUERIA,
    label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],
    labelCorto: 'Peluquería',
    route: '/peluqueria',
    icono: CATEGORIA_ICONOS['peluqueria'],
    icon: 'scissors',
    claim: 'Porque también merece verse y sentirse increíble.',
    descripcion: 'Baño, corte, deslanado y spa con groomers profesionales, en salón o a domicilio.',
    titular: 'El cuidado que merece',
    subtitular: 'Encuentra y reserva el cuidado ideal para su pelo, su piel y bienestar.',
    reservaPorNoches: false,
    pideHora: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Fecha de la cita',
    reclamo: {
      titulo: 'Bienestar y belleza para tu mejor amigo',
      texto: 'Reserva con peluquerías caninas profesionales para mantener a tu perro limpio, cómodo y con el mejor estilo.',
    },
  },
  {
    key: VerticalKey.ALOJAMIENTO,
    label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],
    labelCorto: 'Alojamiento canino',
    route: '/alojamiento',
    icono: CATEGORIA_ICONOS['alojamiento'],
    // Casa, no edificio: es la residencia canina. El icono de hotel queda
    // para la categoría de hoteles pet friendly, que sí es un hotel.
    icon: 'home',
    claim: 'Déjalo en las mejores manos mientras tú disfrutas con tranquilidad.',
    descripcion: 'Residencias caninas verificadas: suites, patio exterior, paseos diarios y cámaras 24/7.',
    titular: 'Más que un alojamiento',
    subtitular: 'Un lugar donde sentirse como en casa.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Ingreso',
    reclamo: {
      titulo: 'Un lugar seguro mientras tú no estás',
      texto: 'Encuentra residencias y guarderías caninas con experiencia, atención personalizada y tranquilidad para tu mascota.',
    },
  },
  {
    key: VerticalKey.TRANSPORTE,
    label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],
    labelCorto: 'Transporte',
    route: '/transporte',
    icono: CATEGORIA_ICONOS['transporte'],
    icon: 'truck',
    claim: 'Viajes seguros y cómodos para tu mascota.',
    descripcion: 'Vehículos acondicionados y conductores especializados, con tarifas transparentes.',
    titular: 'Más que un transporte',
    subtitular: 'Su bienestar es el destino más importante.',
    reservaPorNoches: false,
    labelUbicacion: 'Recogida',
    placeholderUbicacion: 'Ciudad de recogida',
    labelFecha: 'Fecha del traslado',
    reclamo: {
      titulo: 'Traslados cómodos y seguros para tu mascota',
      texto: 'Profesionales del transporte para que tu compañero viaje con tranquilidad, puntualidad y confianza.',
    },
  },
  {
    key: VerticalKey.ADIESTRAMIENTO,
    label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO],
    labelCorto: 'Adiestramiento',
    route: '/adiestramiento',
    icono: CATEGORIA_ICONOS['adiestramiento'],
    icon: 'graduation-cap',
    claim: 'Mejora su comportamiento con profesionales especializados.',
    descripcion: 'Educadores certificados: obediencia, modificación de conducta y educación de cachorros.',
    titular: 'Entenderse es cuestión de método',
    subtitular: 'Educadores certificados para obediencia, conducta y cachorros.',
    reservaPorNoches: false,
    pideHora: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Fecha de la sesión',
    reclamo: {
      titulo: 'Cada perro tiene su camino',
      texto: 'Educación, adiestramiento, socialización y modificación de conducta. Reserva tu cita y valora con el profesional el mejor camino para alcanzar tus objetivos.',
    },
  },
  {
    key: VerticalKey.HOTELES,
    label: VERTICAL_LABELS[VerticalKey.HOTELES],
    labelCorto: 'Hoteles',
    route: '/hoteles',
    icono: CATEGORIA_ICONOS['hoteles'],
    icon: 'hotel',
    claim: 'Descubre alojamientos donde vuestra mascota también es bienvenida.',
    descripcion: 'Hoteles donde tú y tu perro os quedáis juntos, con servicios pensados para mascotas.',
    titular: 'Viajad juntos, dormid juntos',
    subtitular: 'Hoteles donde tu perro también es un huésped, no una excepción.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad o destino',
    labelFecha: 'Ingreso',
    reclamo: {
      titulo: 'Viajar juntos también es parte del plan',
      texto: 'Descubre alojamientos pet-friendly cuidadosamente seleccionados para que disfrutéis juntos de cada destino.',
    },
  },
  {
    key: VerticalKey.SEGUROS,
    label: VERTICAL_LABELS[VerticalKey.SEGUROS],
    labelCorto: 'Seguros',
    route: '/seguros',
    icono: CATEGORIA_ICONOS['seguros'],
    icon: 'shield-check',
    claim: 'Protege a quien más quieres frente a cualquier imprevisto.',
    descripcion: 'Pólizas para tu mascota: responsabilidad civil, gastos veterinarios y asistencia.',
    titular: 'Protege a tu rey',
    subtitular: 'La tranquilidad de saber que, pase lo que pase, está cubierto.',
    // No se reserva por fechas: se contrata cuando el perro cumple las
    // condiciones de admisión de la póliza.
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde resides?',
    placeholderUbicacion: 'Ciudad de residencia',
    labelFecha: 'Inicio de la cobertura',
    reclamo: {
      titulo: 'Tranquilidad para lo que no se puede prever',
      texto: 'Compara pólizas para tu mascota y protégela frente a imprevistos veterinarios y de responsabilidad civil.',
    },
  },
  {
    key: VerticalKey.FUNERARIOS,
    label: VERTICAL_LABELS[VerticalKey.FUNERARIOS],
    labelCorto: 'Funerarios',
    route: '/funerarios',
    icono: CATEGORIA_ICONOS['funerarios'],
    icon: 'heart',
    claim: 'Una despedida serena, con todo claro desde el principio.',
    descripcion: 'Empresas verificadas: cremación individual o colectiva, recogida 24 h, urna y entrega de cenizas.',
    titular: 'Una despedida como se merece',
    subtitular: 'Sabes qué contratas, qué incluye y cuánto cuesta antes de confirmar.',
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde necesitas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: '¿Cuándo lo necesitas?',
    reclamo: {
      titulo: 'Acompañamiento en el peor momento',
      texto: 'Empresas verificadas que recogen, informan y entregan con respeto, y te dicen el precio cerrado antes de contratar.',
    },
  },
];

const POR_KEY = new Map<string, VerticalUi>(VERTICALES_UI.map((v) => [v.key, v]));

/**
 * Las categorías que se ofrecen al público: menú, buscador y portada.
 *
 * `VERTICALES_UI` sigue siendo la lista completa —la usan los paneles de admin
 * y de comercio, que sí tienen que ver todo lo que existe—; ésta es la que
 * decide qué se enseña a quien llega a la web.
 */
export const VERTICALES_PUBLICOS: readonly VerticalUi[] =
  VERTICALES_UI.filter((v) => !v.fueraDelEscaparate);

/** Categoría por defecto cuando la clave recibida no existe. */
export const VERTICAL_POR_DEFECTO = POR_KEY.get(VerticalKey.ALOJAMIENTO) as VerticalUi;

/** Devuelve la config del vertical, o la de alojamiento si la clave no existe. */
export function verticalUi(key: string | null | undefined): VerticalUi {
  return (key && POR_KEY.get(key)) || VERTICAL_POR_DEFECTO;
}

/**
 * Icono `rs-icon` del vertical. Única fuente de verdad para los paneles de
 * admin y comercio, que antes mantenían cada uno su propio mapa de emojis
 * (TCK-8010). `global` no es un vertical: es el ámbito de la config general.
 */
export function iconoDeVertical(key: string | null | undefined): string {
  if (key === 'global') return 'globe';
  // Una clave desconocida no debe disfrazarse del icono de alojamiento.
  return (key && POR_KEY.get(key)?.icon) ?? 'paw';
}

/** Ruta del listado de un vertical (`/veterinaria`, `/alojamiento`…). */
export function rutaDeVertical(key: string | null | undefined): string {
  return verticalUi(key).route;
}

/**
 * Verticales con página de ficha propia (`/<vertical>/:id`). El resto solo tiene
 * listado, así que enlazar a `[ruta, id]` para ellos daría un 404.
 */
const VERTICALES_CON_FICHA = new Set<string>([
  VerticalKey.ALOJAMIENTO,
  VerticalKey.TRANSPORTE,
  VerticalKey.ADIESTRAMIENTO,
  VerticalKey.HOTELES,
  // Estas cuatro no estaban, y sin ficha sus tarjetas llevaban de vuelta al
  // listado: no había forma de ver el detalle de una clínica ni de una
  // peluquería. Ahora todas las categorías se comportan igual.
  VerticalKey.VETERINARIA,
  VerticalKey.PELUQUERIA,
  VerticalKey.SEGUROS,
  VerticalKey.FUNERARIOS,
]);

/**
 * Enlace al servicio: su ficha si el vertical tiene una, y si no el listado de
 * la categoría — nunca una ruta que no exista.
 */
export function enlaceAServicio(vertical: string | null | undefined, servicioId: string): unknown[] {
  const ruta = rutaDeVertical(vertical);
  return vertical && VERTICALES_CON_FICHA.has(vertical) ? [ruta, servicioId] : [ruta];
}

/** Titular de cabecera del vertical; cae a la etiqueta si no hay copy propio. */
export function titularDeVertical(key: string | null | undefined): string {
  const ui = verticalUi(key);
  return ui.titular ?? ui.label;
}

/** Subtitular de cabecera del vertical; cae a la descripción del listado. */
export function subtitularDeVertical(key: string | null | undefined): string {
  const ui = verticalUi(key);
  return ui.subtitular ?? ui.descripcion;
}
