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
   */
  readonly titular?: string;
  /** Subtitular emocional bajo el titular. Si falta, la vista usa `descripcion`. */
  readonly subtitular?: string;
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
    titular: 'VETERINARIOS DE CONFIANZA',
    subtitular: 'Clínicas veterinarias para tu mascota: vacunación, citas, urgencias 24 h y más.',
    reservaPorNoches: false,
    pideHora: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad de la clínica',
    labelFecha: 'Fecha de la cita',
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
  },
  {
    key: VerticalKey.ALOJAMIENTO,
    label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],
    labelCorto: 'Alojamiento canino',
    route: '/alojamiento',
    icono: CATEGORIA_ICONOS['alojamiento'],
    icon: 'hotel',
    claim: 'Déjalo en las mejores manos mientras tú disfrutas con tranquilidad.',
    descripcion: 'Residencias caninas verificadas: suites, patio exterior, paseos diarios y cámaras 24/7.',
    titular: 'Más que un alojamiento',
    subtitular: 'Un lugar donde sentirse como en casa.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Entrada',
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
    titular: 'MÁS QUE UN TRANSPORTE',
    subtitular: 'Su bienestar es el destino más importante.',
    reservaPorNoches: false,
    labelUbicacion: 'Recogida',
    placeholderUbicacion: 'Ciudad de recogida',
    labelFecha: 'Fecha del traslado',
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
    reservaPorNoches: false,
    pideHora: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Fecha de la sesión',
  },
  {
    key: VerticalKey.HOTELES,
    label: VERTICAL_LABELS[VerticalKey.HOTELES],
    labelCorto: 'Hoteles',
    route: '/hoteles',
    icono: CATEGORIA_ICONOS['hoteles'],
    icon: 'building',
    claim: 'Descubre alojamientos donde vuestra mascota también es bienvenida.',
    descripcion: 'Hoteles donde tú y tu perro os quedáis juntos, con servicios pensados para mascotas.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad o destino',
    labelFecha: 'Entrada',
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
  },
  {
    key: VerticalKey.CUIDADORES,
    label: VERTICAL_LABELS[VerticalKey.CUIDADORES],
    labelCorto: 'Paseadores',
    route: '/cuidadores',
    icono: CATEGORIA_ICONOS['cuidadores'],
    icon: 'users',
    claim: 'Paseos y cuidado en su propia casa, sin moverlo de su rutina.',
    descripcion: 'Profesionales verificados que van a tu domicilio: paseos, visitas, día completo o noche.',
    titular: 'Su casa, su rutina',
    subtitular: 'Cuidado profesional sin sacarlo de donde se siente seguro.',
    fueraDelEscaparate: true,
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde buscas el servicio?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Fecha del servicio',
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
