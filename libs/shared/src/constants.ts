/** IVA estándar (España). Configurable por país en fases posteriores. */
export const IVA_RATE = 0.21;
/** Moneda por defecto de la plataforma (Eurozona). */
export const MONEDA_DEFAULT = 'EUR';

/**
 * Monedas en las que se pueden **mostrar** los precios. El cobro es siempre en
 * EUR: cambiar la divisa de cobro exigiría Stripe multi-divisa y rehacer las
 * liquidaciones, así que la conversión es informativa y se etiqueta como tal.
 */
export const MONEDAS_SOPORTADAS = ['EUR', 'GBP', 'CHF', 'USD'] as const;
export type MonedaSoportada = (typeof MONEDAS_SOPORTADAS)[number];

export const MONEDA_SIMBOLOS: Record<MonedaSoportada, string> = {
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  USD: '$',
};

/** Países del mercado europeo con oferta activa; fija región e idioma del buscador. */
export const PAISES_SOPORTADOS = [
  { codigo: 'ES', nombre: 'España', moneda: 'EUR' },
  { codigo: 'PT', nombre: 'Portugal', moneda: 'EUR' },
  { codigo: 'FR', nombre: 'Francia', moneda: 'EUR' },
  { codigo: 'IT', nombre: 'Italia', moneda: 'EUR' },
  { codigo: 'DE', nombre: 'Alemania', moneda: 'EUR' },
] as const;
export const SLOT_HOLD_TTL_MINUTOS = 15;
export const COMISION_PCT_DEFAULT = 0.15;

/**
 * Escalera de niveles del programa de fidelización Doogking Alpha (Bloque 13),
 * usada como valor efectivo mientras el admin no haya guardado su propia
 * configuración en `alpha_niveles` — "nada fijo en el código" (HU-13.4), pero
 * el programa tiene que funcionar desde el primer día sin intervención manual.
 */
export const ALPHA_NIVELES_DEFAULT: readonly {
  nivel: number;
  nombre: string;
  reservasRequeridas: number;
  descuentoPct: number;
  beneficios: string[];
}[] = [
  {
    nivel: 1,
    nombre: 'ALPHA I',
    reservasRequeridas: 0,
    descuentoPct: 0,
    beneficios: ['Accede antes que nadie a promociones exclusivas'],
  },
  {
    nivel: 2,
    nombre: 'ALPHA II',
    reservasRequeridas: 5,
    descuentoPct: 0.05,
    beneficios: [
      'Ahorra hasta un 5% en tus próximas reservas',
      'Accede antes que nadie a promociones exclusivas',
      'Prioridad en las campañas de temporada',
    ],
  },
  {
    nivel: 3,
    nombre: 'ALPHA III',
    reservasRequeridas: 15,
    descuentoPct: 0.1,
    beneficios: [
      'Ahorra hasta un 10% en tus próximas reservas',
      'Disfruta de promociones premium reservadas a miembros Alpha',
      'Ventajas exclusivas antes que el resto de usuarios',
    ],
  },
];

/**
 * Numeración romana del nivel Alpha. Los nombres pueden venir editados desde el
 * panel de administración (HU-13.4) con el formato antiguo "Alpha 2", así que la
 * presentación se normaliza aquí en lugar de asumir que la BD ya está migrada
 * (TCK-8011).
 */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

/** Etiqueta canónica del escalón ("ALPHA II"), al margen del nombre editable. */
export function etiquetaAlphaNivel(nivel: number): string {
  return `ALPHA ${ROMANOS[nivel - 1] ?? nivel}`;
}

export function nombreAlphaPresentacion(nombre: string, nivel: number): string {
  const yaEsRomano = /^ALPHA\s+[IVX]+$/i.test(nombre.trim());
  if (yaEsRomano) return nombre.trim().toUpperCase();

  const romano = ROMANOS[nivel - 1];
  if (!romano) return nombre.toUpperCase();

  // Sólo se reescribe el patrón por defecto "Alpha <n>"; un nombre propio que el
  // admin haya elegido a mano se respeta tal cual.
  return /^alpha\s*\d+$/i.test(nombre.trim()) ? `ALPHA ${romano}` : nombre;
}
