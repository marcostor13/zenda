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
  { codigo: 'ES', nombre: 'España', bandera: '🇪🇸', moneda: 'EUR' },
  { codigo: 'PT', nombre: 'Portugal', bandera: '🇵🇹', moneda: 'EUR' },
  { codigo: 'FR', nombre: 'Francia', bandera: '🇫🇷', moneda: 'EUR' },
  { codigo: 'IT', nombre: 'Italia', bandera: '🇮🇹', moneda: 'EUR' },
  { codigo: 'DE', nombre: 'Alemania', bandera: '🇩🇪', moneda: 'EUR' },
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
    nombre: 'Alpha 1',
    reservasRequeridas: 0,
    descuentoPct: 0,
    beneficios: ['Promociones y ofertas exclusivas'],
  },
  {
    nivel: 2,
    nombre: 'Alpha 2',
    reservasRequeridas: 5,
    descuentoPct: 0.05,
    beneficios: ['Hasta 5% de descuento', 'Promociones exclusivas', 'Prioridad en campañas'],
  },
  {
    nivel: 3,
    nombre: 'Alpha 3',
    reservasRequeridas: 15,
    descuentoPct: 0.1,
    beneficios: ['Hasta 10% de descuento', 'Promociones premium', 'Ventajas exclusivas'],
  },
];
