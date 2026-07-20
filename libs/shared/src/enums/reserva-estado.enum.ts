export enum ReservaEstado {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  // El comercio solicitó un ajuste de precio en recepción; la reserva vuelve a
  // CONFIRMADA si el cliente acepta (y paga la diferencia) o pasa a CANCELADA
  // si la rechaza (con reembolso íntegro del importe original).
  AJUSTE_SOLICITADO = 'ajuste_solicitado',
  CANCELADA = 'cancelada',
  COMPLETADA = 'completada',
  NO_SHOW = 'no_show',
}
