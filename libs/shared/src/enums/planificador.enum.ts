/**
 * Preguntas del planificador de viajes con mascota.
 *
 * Observación del cliente 28-09: el planificador debía hacer más preguntas para
 * afinar el itinerario y terminar siempre en un servicio de la plataforma. Cada
 * respuesta cambia el plan: el ritmo decide cuántas paradas caben en un día, y
 * el alojamiento, el desplazamiento y los servicios extra deciden qué se puede
 * reservar al final.
 */

/** Cuántas cosas se hacen al día. */
export enum RitmoViaje {
  TRANQUILO = 'tranquilo',
  EQUILIBRADO = 'equilibrado',
  INTENSO = 'intenso',
}

export const RITMO_VIAJE_LABELS: Record<RitmoViaje, string> = {
  [RitmoViaje.TRANQUILO]: 'Tranquilo',
  [RitmoViaje.EQUILIBRADO]: 'Equilibrado',
  [RitmoViaje.INTENSO]: 'Intenso',
};

/** Paradas en lugares por día según el ritmo; los servicios van aparte. */
export const PARADAS_POR_RITMO: Record<RitmoViaje, number> = {
  [RitmoViaje.TRANQUILO]: 2,
  [RitmoViaje.EQUILIBRADO]: 3,
  [RitmoViaje.INTENSO]: 4,
};

/** ¿Hay que buscarle dónde dormir? */
export enum AlojamientoViaje {
  NECESITO = 'necesito',
  YA_LO_TENGO = 'ya_lo_tengo',
}

export const ALOJAMIENTO_VIAJE_LABELS: Record<AlojamientoViaje, string> = {
  [AlojamientoViaje.NECESITO]: 'Necesito alojamiento',
  [AlojamientoViaje.YA_LO_TENGO]: 'Ya lo tengo',
};

/** Cómo llegáis: con coche propio o con un transporte de mascotas. */
export enum DesplazamientoViaje {
  COCHE_PROPIO = 'coche_propio',
  TRANSPORTE_MASCOTA = 'transporte_mascota',
}

export const DESPLAZAMIENTO_VIAJE_LABELS: Record<DesplazamientoViaje, string> = {
  [DesplazamientoViaje.COCHE_PROPIO]: 'Vamos en nuestro coche',
  [DesplazamientoViaje.TRANSPORTE_MASCOTA]: 'Necesito transporte para mi mascota',
};

/** Días que puede abarcar un itinerario: más ya no es una escapada. */
export const MAX_DIAS_ITINERARIO = 5;
