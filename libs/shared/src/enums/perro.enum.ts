export enum TamanoPerro {
  MINI = 'mini',
  PEQUENO = 'pequeno',
  MEDIANO = 'mediano',
  GRANDE = 'grande',
  GIGANTE = 'gigante',
}

export enum TipoPelo {
  CORTO = 'corto',
  MEDIO = 'medio',
  LARGO = 'largo',
  RIZADO = 'rizado',
  DURO = 'duro',
  DOBLE_CAPA = 'doble_capa',
}

export enum SexoPerro {
  MACHO = 'macho',
  HEMBRA = 'hembra',
}

export enum NivelSociabilidad {
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
  NO_TOLERA = 'no_tolera',
}

/** Deriva el tamaño estándar de Doogking a partir del peso en kg (usado como valor por defecto editable). */
export function calcularTamanoPorPeso(pesoKg: number): TamanoPerro {
  if (pesoKg <= 5) return TamanoPerro.MINI;
  if (pesoKg <= 10) return TamanoPerro.PEQUENO;
  if (pesoKg <= 25) return TamanoPerro.MEDIANO;
  if (pesoKg <= 40) return TamanoPerro.GRANDE;
  return TamanoPerro.GIGANTE;
}
