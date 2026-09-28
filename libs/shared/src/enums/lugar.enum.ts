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
  /** Tiendas de animales (piensos, accesorios): el sitio al que se va con el perro. */
  TIENDA = 'tienda',
}

export const TIPO_LUGAR_LABELS: Record<TipoLugar, string> = {
  [TipoLugar.PLAYA]: 'Playa canina',
  [TipoLugar.PARQUE]: 'Parque canino',
  [TipoLugar.RESTAURANTE]: 'Restaurante pet-friendly',
  [TipoLugar.RUTA]: 'Ruta con perro',
  [TipoLugar.RIO]: 'Río o lago',
  [TipoLugar.TIENDA]: 'Tienda de animales',
};

/**
 * Dónde admite perros un restaurante o cafetería. `por_confirmar` es lo que
 * trae una fuente documental (guía, directorio) mientras nadie ha llamado al
 * local: la ficha lo dice para que nadie se plante en la puerta a ciegas.
 */
export enum ZonaAdmitidaLugar {
  INTERIOR = 'interior',
  TERRAZA = 'terraza',
  AMBAS = 'ambas',
  POR_CONFIRMAR = 'por_confirmar',
}

export const ZONA_ADMITIDA_LABELS: Record<ZonaAdmitidaLugar, string> = {
  [ZonaAdmitidaLugar.INTERIOR]: 'Admite perros en el interior',
  [ZonaAdmitidaLugar.TERRAZA]: 'Admite perros en la terraza',
  [ZonaAdmitidaLugar.AMBAS]: 'Admite perros en interior y terraza',
  [ZonaAdmitidaLugar.POR_CONFIRMAR]: 'Zona admitida por confirmar: pregunta al local antes de ir',
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
