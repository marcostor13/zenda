export enum VerticalKey {
  ALOJAMIENTO = 'alojamiento',
  TRANSPORTE = 'transporte',
  VETERINARIA = 'veterinaria',
  PELUQUERIA = 'peluqueria',
  ADIESTRAMIENTO = 'adiestramiento',
  HOTELES = 'hoteles',
  SEGUROS = 'seguros',
  /**
   * Paseadores y cuidado a domicilio (Ref. COMI3). Se había retirado como "Cuidadores"
   * (TCK-8021) porque Doogking solo lista profesionales verificados, no particulares por
   * libre — se reintroduce exigiendo el mismo alta de comercio y aprobación del admin que
   * cualquier otro vertical, que ya cubre esa condición.
   */
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
  [VerticalKey.CUIDADORES]: 'Paseadores y cuidado a domicilio',
};
