export enum VerticalKey {
  ALOJAMIENTO = 'alojamiento',
  TRANSPORTE = 'transporte',
  VETERINARIA = 'veterinaria',
  PELUQUERIA = 'peluqueria',
  ADIESTRAMIENTO = 'adiestramiento',
  HOTELES = 'hoteles',
  SEGUROS = 'seguros',
  /**
   * Servicios funerarios para mascotas: cremación individual o colectiva,
   * recogida, entierro y despedida. Sustituye a "Paseadores y cuidado a
   * domicilio" (2026-09-01), que se retira del catálogo.
   */
  FUNERARIOS = 'funerarios',
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
  [VerticalKey.FUNERARIOS]: 'Servicios funerarios',
};
