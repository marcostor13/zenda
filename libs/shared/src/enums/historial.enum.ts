/**
 * Tipos de historial que se acumulan en la ficha de una mascota. Se separan
 * porque el propietario decide qué comparte con cada tipo de servicio: a la
 * peluquería no tiene por qué llegarle el informe del veterinario (HU-016).
 */
export enum TipoHistorial {
  VETERINARIO = 'veterinario',
  GROOMING = 'grooming',
  CONDUCTA = 'conducta',
  ALOJAMIENTO = 'alojamiento',
  TRANSPORTE = 'transporte',
}

export const TIPO_HISTORIAL_LABELS: Record<TipoHistorial, string> = {
  [TipoHistorial.VETERINARIO]: 'Historial veterinario',
  [TipoHistorial.GROOMING]: 'Historial de peluquería',
  [TipoHistorial.CONDUCTA]: 'Observaciones de conducta',
  [TipoHistorial.ALOJAMIENTO]: 'Estancias en alojamiento',
  [TipoHistorial.TRANSPORTE]: 'Traslados',
};

/** Vertical que genera cada tipo de historial: siempre puede leer el suyo. */
export const HISTORIAL_ORIGEN: Record<TipoHistorial, string> = {
  [TipoHistorial.VETERINARIO]: 'veterinaria',
  [TipoHistorial.GROOMING]: 'peluqueria',
  [TipoHistorial.CONDUCTA]: 'adiestramiento',
  [TipoHistorial.ALOJAMIENTO]: 'alojamiento',
  [TipoHistorial.TRANSPORTE]: 'transporte',
};
