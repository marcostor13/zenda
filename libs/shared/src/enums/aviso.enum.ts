/**
 * Avisos automáticos que manda la plataforma (TCK-8040 §6). Cada uno se puede
 * activar o desactivar por canal desde el panel de administración.
 */
export enum TipoAviso {
  NUEVA_RESERVA = 'nueva_reserva',
  MODIFICACION_RESERVA = 'modificacion_reserva',
  CANCELACION = 'cancelacion',
  RECORDATORIO = 'recordatorio',
  NUEVA_RESENA = 'nueva_resena',
  PAGO_RECIBIDO = 'pago_recibido',
  LIQUIDACION = 'liquidacion',
  DOCUMENTACION_CADUCA = 'documentacion_caduca',
  PROMOCIONES = 'promociones',
}

export const TIPO_AVISO_LABELS: Record<TipoAviso, string> = {
  [TipoAviso.NUEVA_RESERVA]: 'Nueva reserva',
  [TipoAviso.MODIFICACION_RESERVA]: 'Modificación de reserva',
  [TipoAviso.CANCELACION]: 'Cancelación',
  [TipoAviso.RECORDATORIO]: 'Recordatorio antes del servicio',
  [TipoAviso.NUEVA_RESENA]: 'Nueva reseña',
  [TipoAviso.PAGO_RECIBIDO]: 'Pago recibido',
  [TipoAviso.LIQUIDACION]: 'Liquidación al comercio',
  [TipoAviso.DOCUMENTACION_CADUCA]: 'Documentación próxima a caducar',
  [TipoAviso.PROMOCIONES]: 'Promociones y novedades',
};

export const TIPO_AVISO_DESTINATARIO: Record<TipoAviso, string> = {
  [TipoAviso.NUEVA_RESERVA]: 'Cliente y comercio',
  [TipoAviso.MODIFICACION_RESERVA]: 'Cliente y comercio',
  [TipoAviso.CANCELACION]: 'Cliente y comercio',
  [TipoAviso.RECORDATORIO]: 'Cliente',
  [TipoAviso.NUEVA_RESENA]: 'Comercio',
  [TipoAviso.PAGO_RECIBIDO]: 'Cliente',
  [TipoAviso.LIQUIDACION]: 'Comercio',
  [TipoAviso.DOCUMENTACION_CADUCA]: 'Comercio',
  [TipoAviso.PROMOCIONES]: 'Cliente',
};
