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
  /** true = se reserva por noches (entrada/salida); false = cita puntual. */
  readonly reservaPorNoches: boolean;
  readonly labelUbicacion: string;
  readonly placeholderUbicacion: string;
  readonly labelFecha: string;
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
    claim: 'Consultas, vacunas y urgencias con cita online.',
    descripcion: 'Clínicas verificadas para tu perro: vacunación, cirugía, dermatología y urgencias 24h.',
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde?',
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
    claim: 'Baño, corte, deslanado y spa canino.',
    descripcion: 'Baño, corte, deslanado y spa con groomers profesionales, en salón o a domicilio.',
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde?',
    placeholderUbicacion: 'Ciudad, zona o dirección',
    labelFecha: 'Fecha de la cita',
  },
  {
    key: VerticalKey.ALOJAMIENTO,
    label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],
    labelCorto: 'Alojamiento',
    route: '/alojamiento',
    icono: CATEGORIA_ICONOS['alojamiento'],
    icon: 'hotel',
    claim: 'Residencias y suites con cámaras 24/7.',
    descripcion: 'Residencias caninas verificadas: suites, patio exterior, paseos diarios y cámaras 24/7.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde?',
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
    claim: 'Traslados en vehículos climatizados.',
    descripcion: 'Vehículos acondicionados y conductores especializados, con tarifas transparentes.',
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
    claim: 'Obediencia, conducta y cachorros.',
    descripcion: 'Educadores certificados: obediencia, modificación de conducta y educación de cachorros.',
    reservaPorNoches: false,
    labelUbicacion: '¿Dónde?',
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
    claim: 'Hoteles pet-friendly para viajar juntos.',
    descripcion: 'Hoteles donde tú y tu perro os quedáis juntos, con servicios pensados para mascotas.',
    reservaPorNoches: true,
    labelUbicacion: '¿Dónde?',
    placeholderUbicacion: 'Ciudad o destino',
    labelFecha: 'Entrada',
  },
];

const POR_KEY = new Map<string, VerticalUi>(VERTICALES_UI.map((v) => [v.key, v]));

/** Categoría por defecto cuando la clave recibida no existe. */
export const VERTICAL_POR_DEFECTO = POR_KEY.get(VerticalKey.ALOJAMIENTO) as VerticalUi;

/** Devuelve la config del vertical, o la de alojamiento si la clave no existe. */
export function verticalUi(key: string | null | undefined): VerticalUi {
  return (key && POR_KEY.get(key)) || VERTICAL_POR_DEFECTO;
}

/** Ruta del listado de un vertical (`/veterinaria`, `/alojamiento`…). */
export function rutaDeVertical(key: string | null | undefined): string {
  return verticalUi(key).route;
}
