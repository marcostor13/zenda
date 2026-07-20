export enum ReservaEstado {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  // El comercio solicitó un ajuste de precio en recepción; la reserva vuelve a
  // CONFIRMADA si el cliente acepta (y paga la diferencia) o pasa a CANCELADA
  // si la rechaza (con reembolso íntegro del importe original).
  AJUSTE_SOLICITADO = 'ajuste_solicitado',
  // El servicio está en curso (mascota entregada / cita en marcha).
  EN_CURSO = 'en_curso',
  CANCELADA = 'cancelada',
  COMPLETADA = 'completada',
  NO_SHOW = 'no_show',
  // Estados operativos del marketplace (gestión de disputas y liquidación):
  // el dinero se retiene hasta que el servicio se confirma como prestado.
  PAGO_RETENIDO = 'pago_retenido',
  PAGO_LIBERADO = 'pago_liberado',
  EN_DISPUTA = 'en_disputa',
  REEMBOLSADA = 'reembolsada',
}
