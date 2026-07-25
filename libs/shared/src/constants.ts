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
