/**
 * Vocabulario de la categoría "Servicios funerarios".
 *
 * Vive en `shared` porque lo usan las tres capas: el formulario del comercio
 * declara con él lo que ofrece, la estrategia de disponibilidad calcula el
 * precio cerrado a partir de esos mismos valores, y el wizard de reserva pide
 * al cliente exactamente lo que la empresa dijo que sabe hacer.
 */

/** Qué se contrata. Determina si hay devolución de cenizas y qué hitos aplican. */
export enum TipoServicioFunerario {
  CREMACION_INDIVIDUAL = 'cremacion_individual',
  CREMACION_COLECTIVA = 'cremacion_colectiva',
  SERVICIO_COMPLETO = 'servicio_completo',
  RECOGIDA = 'recogida',
  ENTIERRO = 'entierro',
  OTROS = 'otros',
}

export const TIPO_SERVICIO_FUNERARIO_LABELS: Record<TipoServicioFunerario, string> = {
  [TipoServicioFunerario.CREMACION_INDIVIDUAL]: 'Cremación individual',
  [TipoServicioFunerario.CREMACION_COLECTIVA]: 'Cremación colectiva',
  [TipoServicioFunerario.SERVICIO_COMPLETO]: 'Servicio completo',
  [TipoServicioFunerario.RECOGIDA]: 'Recogida',
  [TipoServicioFunerario.ENTIERRO]: 'Entierro / cementerio',
  [TipoServicioFunerario.OTROS]: 'Otros',
};

/** De dónde se recoge al animal. */
export enum LugarRecogida {
  DOMICILIO = 'domicilio',
  VETERINARIO = 'veterinario',
  RESIDENCIA = 'residencia',
  OTRO = 'otro',
}

export const LUGAR_RECOGIDA_LABELS: Record<LugarRecogida, string> = {
  [LugarRecogida.DOMICILIO]: 'Domicilio',
  [LugarRecogida.VETERINARIO]: 'Clínica veterinaria',
  [LugarRecogida.RESIDENCIA]: 'Residencia o centro',
  [LugarRecogida.OTRO]: 'Otro lugar',
};

/**
 * Cuándo lo necesita el cliente. No se pide hora exacta: en este sector se
 * trabaja por franjas y prometer una hora cerrada sería mentir.
 */
export enum UrgenciaFunerario {
  LO_ANTES_POSIBLE = 'lo_antes_posible',
  HOY = 'hoy',
  MANANA = 'manana',
  FECHA = 'fecha',
}

export const URGENCIA_FUNERARIO_LABELS: Record<UrgenciaFunerario, string> = {
  [UrgenciaFunerario.LO_ANTES_POSIBLE]: 'Lo antes posible',
  [UrgenciaFunerario.HOY]: 'Hoy',
  [UrgenciaFunerario.MANANA]: 'Mañana',
  [UrgenciaFunerario.FECHA]: 'Elegir fecha',
};

/** Las urgencias que llevan suplemento si la empresa lo ha configurado. */
export const URGENCIAS_CON_SUPLEMENTO: readonly UrgenciaFunerario[] = [
  UrgenciaFunerario.LO_ANTES_POSIBLE,
  UrgenciaFunerario.HOY,
];

/** Franja horaria de la recogida o de la entrega. */
export enum FranjaHoraria {
  MANANA = 'manana',
  TARDE = 'tarde',
  NOCHE = 'noche',
}

export const FRANJA_HORARIA_LABELS: Record<FranjaHoraria, string> = {
  [FranjaHoraria.MANANA]: 'Mañana (8:00–14:00)',
  [FranjaHoraria.TARDE]: 'Tarde (14:00–20:00)',
  [FranjaHoraria.NOCHE]: 'Noche (20:00–8:00)',
};

/** Cómo tarifica la empresa el desplazamiento de recogida. */
export enum ModoPrecioRecogida {
  FIJA = 'fija',
  POR_KM = 'por_km',
  POR_ZONA = 'por_zona',
}

export const MODO_PRECIO_RECOGIDA_LABELS: Record<ModoPrecioRecogida, string> = {
  [ModoPrecioRecogida.FIJA]: 'Precio fijo',
  [ModoPrecioRecogida.POR_KM]: 'Según distancia',
  [ModoPrecioRecogida.POR_ZONA]: 'Por zonas',
};

/**
 * Seguimiento del servicio. Es una secuencia, no un estado único: la empresa va
 * marcando los hitos que apliquen y el cliente los ve en "Mis reservas". Un
 * servicio sin recogida, o sin devolución de cenizas, simplemente se salta los
 * suyos.
 */
export enum HitoFunerario {
  RECOGIDA_PROGRAMADA = 'recogida_programada',
  RECOGIDO = 'recogido',
  EN_PROCESO = 'servicio_en_proceso',
  CENIZAS_PREPARADAS = 'cenizas_preparadas',
  ENTREGA_PROGRAMADA = 'entrega_programada',
  ENTREGADO = 'entregado',
  FINALIZADA = 'finalizada',
}

export const HITO_FUNERARIO_LABELS: Record<HitoFunerario, string> = {
  [HitoFunerario.RECOGIDA_PROGRAMADA]: 'Recogida programada',
  [HitoFunerario.RECOGIDO]: 'Recogido',
  [HitoFunerario.EN_PROCESO]: 'Servicio en proceso',
  [HitoFunerario.CENIZAS_PREPARADAS]: 'Cenizas preparadas',
  [HitoFunerario.ENTREGA_PROGRAMADA]: 'Entrega programada',
  [HitoFunerario.ENTREGADO]: 'Entregado',
  [HitoFunerario.FINALIZADA]: 'Finalizado',
};

/** Especies que acepta la categoría; el peso importa más que la raza. */
export const ESPECIES_FUNERARIO: readonly string[] = [
  'Perro', 'Gato', 'Conejo', 'Hurón', 'Ave', 'Roedor', 'Reptil', 'Otro',
];
