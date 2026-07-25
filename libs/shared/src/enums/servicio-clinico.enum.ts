/**
 * Catálogo **cerrado** de servicios veterinarios reservables en Doogking.
 *
 * Regla de negocio: la plataforma solo intermedia servicios de precio acotado.
 * **Dermatología y cirugía quedan fuera a propósito**, igual que cualquier
 * tratamiento de precio abierto: se presupuestan y facturan directamente entre
 * la clínica y el cliente, y Doogking no los comisiona.
 *
 * Unifica la lista de la revisión del cliente (Q7) con la de `new-modules.md`
 * (HU-028), que llegaban con nombres distintos para los mismos servicios.
 */
export enum ServicioClinicoTipo {
  CONSULTA_GENERAL = 'consulta_general',
  CONSULTA_REVISION = 'consulta_revision',
  CONSULTA_URGENTE = 'consulta_urgente',
  SEGUNDA_OPINION = 'segunda_opinion',
  ESTERILIZACION = 'esterilizacion',
  CASTRACION = 'castracion',
  HIGIENE_DENTAL = 'higiene_dental',
  VACUNACION = 'vacunacion',
  MICROCHIP = 'microchip',
  TELECONSULTA = 'teleconsulta',
}

export const SERVICIO_CLINICO_LABELS: Record<ServicioClinicoTipo, string> = {
  [ServicioClinicoTipo.CONSULTA_GENERAL]: 'Consulta general',
  [ServicioClinicoTipo.CONSULTA_REVISION]: 'Consulta de revisión',
  [ServicioClinicoTipo.CONSULTA_URGENTE]: 'Urgencia',
  [ServicioClinicoTipo.SEGUNDA_OPINION]: 'Segunda opinión',
  [ServicioClinicoTipo.ESTERILIZACION]: 'Esterilización',
  [ServicioClinicoTipo.CASTRACION]: 'Castración',
  [ServicioClinicoTipo.HIGIENE_DENTAL]: 'Higiene dental',
  [ServicioClinicoTipo.VACUNACION]: 'Vacunación',
  [ServicioClinicoTipo.MICROCHIP]: 'Microchip',
  [ServicioClinicoTipo.TELECONSULTA]: 'Teleconsulta',
};

/**
 * Servicios que Doogking **no** intermedia. Se listan de forma explícita para
 * que la validación pueda dar un mensaje útil al comercio en vez de un genérico
 * "valor no permitido".
 */
export const SERVICIOS_CLINICOS_EXCLUIDOS = [
  'dermatologia', 'dermatología', 'cirugia', 'cirugía',
] as const;
