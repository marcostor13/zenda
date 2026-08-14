/** Sobre qué se registra una acción administrativa. */
export enum EntidadAuditada {
  COMERCIO = 'comercio',
  USUARIO = 'usuario',
  COMISION = 'comision',
  ALPHA = 'alpha',
  RESENA = 'resena',
  RESERVA = 'reserva',
  INCIDENCIA = 'incidencia',
}

export const ENTIDAD_AUDITADA_LABELS: Record<EntidadAuditada, string> = {
  [EntidadAuditada.COMERCIO]: 'Comercios',
  [EntidadAuditada.USUARIO]: 'Usuarios',
  [EntidadAuditada.COMISION]: 'Comisiones',
  [EntidadAuditada.ALPHA]: 'Programa Alpha',
  [EntidadAuditada.RESENA]: 'Reseñas',
  [EntidadAuditada.RESERVA]: 'Reservas',
  [EntidadAuditada.INCIDENCIA]: 'Incidencias',
};
