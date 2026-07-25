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

/**
 * Vacunas caninas registrables en la ficha. Lista cerrada: sustituye al texto
 * libre para que las residencias y clínicas puedan comprobar requisitos sin
 * interpretar cómo escribió cada dueño el nombre de la vacuna.
 */
export enum Vacuna {
  TOS_PERRERA = 'tos_perrera',
  PUPPY = 'puppy',
  TETRAVALENTE = 'tetravalente',
  ANTIRRABICA = 'antirrabica',
  HEPTAVALENTE = 'heptavalente',
  MOQUILLO = 'moquillo',
  HEPATITIS = 'hepatitis',
  PARVOVIRUS = 'parvovirus',
  LEISHMANIA = 'leishmania',
}

export const VACUNA_LABELS: Record<Vacuna, string> = {
  [Vacuna.TOS_PERRERA]: 'Tos de las perreras',
  [Vacuna.PUPPY]: 'Puppy (primovacunación)',
  [Vacuna.TETRAVALENTE]: 'Tetravalente',
  [Vacuna.ANTIRRABICA]: 'Antirrábica',
  [Vacuna.HEPTAVALENTE]: 'Heptavalente',
  [Vacuna.MOQUILLO]: 'Moquillo',
  [Vacuna.HEPATITIS]: 'Hepatitis',
  [Vacuna.PARVOVIRUS]: 'Parvovirus',
  [Vacuna.LEISHMANIA]: 'Leishmania',
};

/** Deriva el tamaño estándar de Doogking a partir del peso en kg (usado como valor por defecto editable). */
export function calcularTamanoPorPeso(pesoKg: number): TamanoPerro {
  if (pesoKg <= 5) return TamanoPerro.MINI;
  if (pesoKg <= 10) return TamanoPerro.PEQUENO;
  if (pesoKg <= 25) return TamanoPerro.MEDIANO;
  if (pesoKg <= 40) return TamanoPerro.GRANDE;
  return TamanoPerro.GIGANTE;
}
