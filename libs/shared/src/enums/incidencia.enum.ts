/** Qué se está reclamando. Cambia el circuito interno de resolución. */
export enum TipoIncidencia {
  RECLAMACION = 'reclamacion',
  DEVOLUCION = 'devolucion',
  INCIDENCIA = 'incidencia',
}

/** Ciclo de vida de una incidencia en el panel de administración. */
export enum EstadoIncidencia {
  ABIERTA = 'abierta',
  EN_REVISION = 'en_revision',
  RESUELTA = 'resuelta',
}

export const TIPO_INCIDENCIA_LABELS: Record<TipoIncidencia, string> = {
  [TipoIncidencia.RECLAMACION]: 'Reclamación',
  [TipoIncidencia.DEVOLUCION]: 'Solicitud de devolución',
  [TipoIncidencia.INCIDENCIA]: 'Incidencia',
};

export const ESTADO_INCIDENCIA_LABELS: Record<EstadoIncidencia, string> = {
  [EstadoIncidencia.ABIERTA]: 'Abierta',
  [EstadoIncidencia.EN_REVISION]: 'En revisión',
  [EstadoIncidencia.RESUELTA]: 'Resuelta',
};
