import { VerticalKey } from 'shared';

/**
 * Criterios de valoración por aspecto de cada categoría (HU-11.4): fuente única
 * de verdad para el formulario de reseña y para pintar el desglose en la
 * tarjeta. Añadir un vertical = añadir una entrada aquí; el fallback genérico
 * cubre categorías sin criterios propios definidos todavía.
 */
export interface AspectoResenaUi {
  readonly key: string;
  readonly label: string;
}

const ASPECTOS_GENERICOS: readonly AspectoResenaUi[] = [
  { key: 'trato', label: 'Trato' },
  { key: 'profesionalidad', label: 'Profesionalidad' },
  { key: 'relacionCalidadPrecio', label: 'Relación calidad-precio' },
];

export const ASPECTOS_POR_VERTICAL: Record<VerticalKey, readonly AspectoResenaUi[]> = {
  [VerticalKey.ALOJAMIENTO]: [
    { key: 'limpieza', label: 'Limpieza' },
    { key: 'atencion', label: 'Atención' },
    { key: 'instalaciones', label: 'Instalaciones' },
    { key: 'comodidad', label: 'Comodidad' },
    { key: 'adaptacionMascotas', label: 'Adaptación para mascotas' },
    { key: 'relacionCalidadPrecio', label: 'Relación calidad-precio' },
  ],
  [VerticalKey.HOTELES]: [
    { key: 'limpieza', label: 'Limpieza' },
    { key: 'atencion', label: 'Atención' },
    { key: 'instalaciones', label: 'Instalaciones' },
    { key: 'comodidad', label: 'Comodidad' },
    { key: 'adaptacionMascotas', label: 'Adaptación para mascotas' },
    { key: 'relacionCalidadPrecio', label: 'Relación calidad-precio' },
  ],
  [VerticalKey.VETERINARIA]: [
    { key: 'trato', label: 'Trato' },
    { key: 'profesionalidad', label: 'Profesionalidad' },
    { key: 'tiempoEspera', label: 'Tiempo de espera' },
    { key: 'instalaciones', label: 'Instalaciones' },
  ],
  [VerticalKey.PELUQUERIA]: [
    { key: 'resultado', label: 'Resultado' },
    { key: 'tratoAlPerro', label: 'Trato al perro' },
    { key: 'puntualidad', label: 'Puntualidad' },
  ],
  [VerticalKey.TRANSPORTE]: [
    { key: 'puntualidad', label: 'Puntualidad' },
    { key: 'tratoAlPerro', label: 'Trato al perro' },
    { key: 'seguridadVehiculo', label: 'Seguridad del vehículo' },
  ],
  [VerticalKey.ADIESTRAMIENTO]: [
    { key: 'resultado', label: 'Resultado' },
    { key: 'profesionalidad', label: 'Profesionalidad' },
    { key: 'tratoAlPerro', label: 'Trato al perro' },
  ],
  [VerticalKey.SEGUROS]: [
    { key: 'atencion', label: 'Atención' },
    { key: 'rapidezGestion', label: 'Rapidez de gestión' },
    { key: 'claridadCondiciones', label: 'Claridad de condiciones' },
  ],
};

/** Criterios de valoración del vertical, o un set genérico si la clave no existe. */
export function aspectosDeVertical(key: string | null | undefined): readonly AspectoResenaUi[] {
  return (key && ASPECTOS_POR_VERTICAL[key as VerticalKey]) || ASPECTOS_GENERICOS;
}
