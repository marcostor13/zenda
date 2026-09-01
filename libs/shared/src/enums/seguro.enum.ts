/** Coberturas que puede ofrecer una aseguradora en Doogking (HU-038). */
/**
 * Una aseguradora no se da de alta como los demás comercios: entrega una
 * solicitud con su documentación y Doogking la revisa a mano antes de dejarla
 * publicar nada. Estos son los tres estados de ese trámite.
 */
export enum EstadoSolicitudSeguros {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

export const ESTADO_SOLICITUD_SEGUROS_LABELS: Record<EstadoSolicitudSeguros, string> = {
  [EstadoSolicitudSeguros.PENDIENTE]: 'Pendiente de revisión',
  [EstadoSolicitudSeguros.APROBADA]: 'Aprobada',
  [EstadoSolicitudSeguros.RECHAZADA]: 'No aprobada',
};

export enum TipoSeguro {
  RC_OBLIGATORIA = 'rc_obligatoria',
  RC_AMPLIADA = 'rc_ampliada',
  GASTOS_VET_ACCIDENTE = 'gastos_vet_accidente',
  GASTOS_VET_ENFERMEDAD = 'gastos_vet_enfermedad',
  ASISTENCIA = 'asistencia',
  ROBO_PERDIDA = 'robo_perdida',
  FALLECIMIENTO = 'fallecimiento',
  DEFENSA_JURIDICA = 'defensa_juridica',
  VIAJE = 'viaje',
  PPP = 'ppp',
  VIDA = 'vida',
}

export const TIPO_SEGURO_LABELS: Record<TipoSeguro, string> = {
  [TipoSeguro.RC_OBLIGATORIA]: 'Responsabilidad civil obligatoria',
  [TipoSeguro.RC_AMPLIADA]: 'Responsabilidad civil ampliada',
  [TipoSeguro.GASTOS_VET_ACCIDENTE]: 'Gastos veterinarios por accidente',
  [TipoSeguro.GASTOS_VET_ENFERMEDAD]: 'Gastos veterinarios por enfermedad',
  [TipoSeguro.ASISTENCIA]: 'Asistencia 24 h',
  [TipoSeguro.ROBO_PERDIDA]: 'Robo o pérdida',
  [TipoSeguro.FALLECIMIENTO]: 'Fallecimiento',
  [TipoSeguro.DEFENSA_JURIDICA]: 'Defensa jurídica',
  [TipoSeguro.VIAJE]: 'Viaje y estancias',
  [TipoSeguro.PPP]: 'Cobertura PPP',
  [TipoSeguro.VIDA]: 'Vida',
};

/**
 * Estado de una póliza. Nace `pendiente_validacion` porque el precio que ve el
 * cliente es **orientativo** hasta que la aseguradora revisa los datos (HU-040).
 */
export enum EstadoPoliza {
  PENDIENTE_VALIDACION = 'pendiente_validacion',
  VIGENTE = 'vigente',
  SUSPENDIDA = 'suspendida',
  CANCELADA = 'cancelada',
  RECHAZADA = 'rechazada',
}

/**
 * Resultado de comprobar si una mascota puede contratar una póliza. En este
 * vertical `checkAvailability` no mira calendario: mira elegibilidad (HU-039).
 */
export enum ResultadoElegibilidad {
  ELEGIBLE = 'elegible',
  ELEGIBLE_CON_RECARGO = 'elegible_con_recargo',
  NO_ELEGIBLE = 'no_elegible',
}
