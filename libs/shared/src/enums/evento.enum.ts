/**
 * Eventos del embudo. Son la base común de tres cosas que, si se midieran por
 * separado, acabarían dando cifras distintas: la meta de reservar en menos de
 * 30 s (T4), la recuperación de abandonos (HU-055) y las métricas de campaña.
 */
export enum TipoEvento {
  BUSQUEDA_INICIADA = 'busqueda_iniciada',
  SERVICIO_ABIERTO = 'servicio_abierto',
  RESERVA_INICIADA = 'reserva_iniciada',
  PASO_COMPLETADO = 'paso_completado',
  PAGO_INICIADO = 'pago_iniciado',
  RESERVA_CONFIRMADA = 'reserva_confirmada',
  RESERVA_ABANDONADA = 'reserva_abandonada',
  CARRITO_ABANDONADO = 'carrito_abandonado',
  SERVICIO_COMPLETADO = 'servicio_completado',
}

/** Pasos del embudo de reserva, para saber dónde se cae la gente. */
export enum PasoEmbudo {
  BUSQUEDA = 'busqueda',
  LISTADO = 'listado',
  DETALLE = 'detalle',
  DATOS = 'datos',
  PAGO = 'pago',
  CONFIRMACION = 'confirmacion',
}

/** Quién asume el descuento de un cupón: cambia el margen real de la reserva. */
export enum AsumeDescuento {
  PLATAFORMA = 'plataforma',
  COMERCIO = 'comercio',
}

/** Estados de una solicitud de valoración, para el panel de seguimiento. */
export enum EstadoSolicitudValoracion {
  PENDIENTE = 'pendiente',
  ENVIADA = 'enviada',
  ABIERTA = 'abierta',
  COMPLETADA = 'completada',
  FALLIDA = 'fallida',
}
