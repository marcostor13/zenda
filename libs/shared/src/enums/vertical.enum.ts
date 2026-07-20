export enum VerticalKey {
  ALOJAMIENTO = 'alojamiento',
  TRANSPORTE = 'transporte',
  VETERINARIA = 'veterinaria',
  PELUQUERIA = 'peluqueria',
  ADIESTRAMIENTO = 'adiestramiento',
  HOTELES = 'hoteles',
}

/** Etiquetas legibles de cada categoría canina de Doogking. */
export const VERTICAL_LABELS: Record<VerticalKey, string> = {
  [VerticalKey.ALOJAMIENTO]: 'Alojamiento canino',
  [VerticalKey.TRANSPORTE]: 'Transporte de animales',
  [VerticalKey.VETERINARIA]: 'Veterinarios',
  [VerticalKey.PELUQUERIA]: 'Peluquerías caninas',
  [VerticalKey.ADIESTRAMIENTO]: 'Adiestramiento canino',
  [VerticalKey.HOTELES]: 'Hoteles pet-friendly',
};
