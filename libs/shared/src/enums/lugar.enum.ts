/**
 * Tipos de lugar pet-friendly del módulo Comunidad. No son servicios
 * reservables ni comisionables: viven fuera del catálogo a propósito
 * (decisión D-5 del plan unificado).
 */
export enum TipoLugar {
  PLAYA = 'playa',
  PARQUE = 'parque',
  RESTAURANTE = 'restaurante',
  RUTA = 'ruta',
  RIO = 'rio',
}

export const TIPO_LUGAR_LABELS: Record<TipoLugar, string> = {
  [TipoLugar.PLAYA]: 'Playa canina',
  [TipoLugar.PARQUE]: 'Parque canino',
  [TipoLugar.RESTAURANTE]: 'Restaurante pet-friendly',
  [TipoLugar.RUTA]: 'Ruta con perro',
  [TipoLugar.RIO]: 'Río o lago',
};

/** Estado de moderación: nada llega al público sin pasar por un administrador. */
export enum EstadoModeracion {
  PENDIENTE = 'pendiente',
  PUBLICADO = 'publicado',
  RECHAZADO = 'rechazado',
}

/** Aquello a lo que se puede dar "me gusta": servicios reservables o lugares. */
export enum TipoFavorito {
  SERVICIO = 'servicio',
  LUGAR = 'lugar',
}
