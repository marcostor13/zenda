/**
 * Planes de suscripción del comercio.
 *
 * **Ningún plan limita cuántos servicios se pueden publicar.** Es la decisión
 * de fondo: interesa que cada profesional tenga en Doogking todo lo que ofrece
 * y reciba el máximo de reservas posible. El argumento comercial no es "paga
 * para publicar más", sino "publica gratis y hazte Pro para conseguir más
 * visibilidad y herramientas para crecer".
 *
 * La lista es la única fuente de verdad de la pantalla de suscripción: añadir
 * una modalidad nueva es añadir una entrada aquí y su columna en la comparativa,
 * sin tocar el componente.
 *
 * Nota de lenguaje: de cara al comercio no se usa la palabra "verticales".
 */

export type ClavePlan = 'basico' | 'pro';

export interface Plan {
  readonly clave: ClavePlan;
  readonly nombre: string;
  /** 0 = gratuito. El importe se formatea con `EurosPipe`, no se escribe a mano. */
  readonly precioMensual: number;
  /** Una línea que explica para quién es el plan. */
  readonly gancho: string;
  readonly icono: string;
  /** Marca la tarjeta con el distintivo de recomendado. */
  readonly recomendado?: boolean;
  /**
   * Plan cuyos beneficios se dan por incluidos. Evita repetir en el Pro los
   * siete puntos del Básico: la tarjeta dice "Todo lo incluido en…, más:".
   */
  readonly incluye?: ClavePlan;
  readonly beneficios: readonly string[];
}

export const PLANES: readonly Plan[] = [
  {
    clave: 'basico',
    nombre: 'Plan Básico',
    precioMensual: 0,
    gancho: 'Empieza a recibir clientes con Doogking.',
    icono: 'store',
    beneficios: [
      'Servicios publicados sin límite',
      'Perfil profesional del negocio',
      'Gestión de reservas',
      'Calendario y disponibilidad',
      'Gestión de precios y suplementos',
      'Estadísticas básicas',
      'Soporte estándar',
    ],
  },
  {
    clave: 'pro',
    nombre: 'Plan Pro',
    precioMensual: 29,
    gancho: 'Consigue más visibilidad y haz crecer tu negocio.',
    icono: 'crown',
    recomendado: true,
    incluye: 'basico',
    beneficios: [
      'Mayor visibilidad dentro de Doogking',
      'Posicionamiento preferente cuando corresponda',
      'Posibilidad de destacar servicios',
      'Distintivo PRO en tu perfil',
      'Estadísticas avanzadas',
      'Información sobre visitas, reservas y rendimiento',
      'Herramientas promocionales',
      'Acceso a campañas y promociones especiales',
      'Mayor presencia en recomendaciones de Doogking',
      'Soporte prioritario',
    ],
  },
];

/**
 * Fila de la comparativa. El valor de cada plan es `true` (lo tiene), `false`
 * (no lo tiene, se pinta con una raya) o un texto cuando la diferencia es de
 * grado y no de tenerlo o no —"Básicas" frente a "Avanzadas"—.
 */
export interface FilaComparativa {
  readonly icono: string;
  readonly concepto: string;
  readonly basico: boolean | string;
  readonly pro: boolean | string;
}

export const COMPARATIVA: readonly FilaComparativa[] = [
  { icono: 'tag', concepto: 'Publicar servicios', basico: 'Sin límite', pro: 'Sin límite' },
  { icono: 'calendar', concepto: 'Recibir reservas', basico: true, pro: true },
  { icono: 'store', concepto: 'Gestión del negocio', basico: true, pro: true },
  { icono: 'bar-chart', concepto: 'Estadísticas', basico: 'Básicas', pro: 'Avanzadas' },
  { icono: 'trending-up', concepto: 'Mayor visibilidad', basico: false, pro: true },
  { icono: 'star', concepto: 'Servicios destacados', basico: false, pro: true },
  { icono: 'badge-check', concepto: 'Distintivo PRO', basico: false, pro: true },
  { icono: 'sparkles', concepto: 'Herramientas promocionales', basico: false, pro: true },
  { icono: 'headphones', concepto: 'Soporte', basico: 'Estándar', pro: 'Prioritario' },
];

/** El plan por el que se empieza cuando el comercio no tiene ninguno. */
export const PLAN_POR_DEFECTO: Plan = PLANES[0];

/**
 * Plan del comercio a partir de lo guardado.
 *
 * Los comercios dados de alta con la escala anterior pueden tener `premium`,
 * que ya no existe: se les trata como Pro, que es el plan de pago actual. Así
 * no hace falta migrar nada y ninguno pierde lo que estaba pagando.
 */
export function planDeComercio(guardado: string | null | undefined): Plan {
  if (guardado === 'pro' || guardado === 'premium') {
    return PLANES.find((p) => p.clave === 'pro') as Plan;
  }
  return PLAN_POR_DEFECTO;
}

/** ¿Es el plan que tiene contratado el comercio? */
export function esPlanActual(plan: Plan, guardado: string | null | undefined): boolean {
  return planDeComercio(guardado).clave === plan.clave;
}
