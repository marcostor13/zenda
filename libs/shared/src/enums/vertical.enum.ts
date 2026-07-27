export enum VerticalKey {
  ALOJAMIENTO = 'alojamiento',
  TRANSPORTE = 'transporte',
  VETERINARIA = 'veterinaria',
  PELUQUERIA = 'peluqueria',
  ADIESTRAMIENTO = 'adiestramiento',
  HOTELES = 'hoteles',
  SEGUROS = 'seguros',
  /** Cuidado en el domicilio del cliente. Paseadores queda fuera (HU-048). */
  CUIDADORES = 'cuidadores',
}

/** Etiquetas legibles de cada categoría canina de Doogking. */
export const VERTICAL_LABELS: Record<VerticalKey, string> = {
  [VerticalKey.ALOJAMIENTO]: 'Alojamiento canino',
  [VerticalKey.TRANSPORTE]: 'Transporte de animales',
  [VerticalKey.VETERINARIA]: 'Veterinarios',
  [VerticalKey.PELUQUERIA]: 'Peluquerías caninas',
  [VerticalKey.ADIESTRAMIENTO]: 'Adiestramiento canino',
  [VerticalKey.HOTELES]: 'Hoteles pet-friendly',
  [VerticalKey.SEGUROS]: 'Seguros para mascotas',
  [VerticalKey.CUIDADORES]: 'Cuidadores a domicilio',
};
