/** Estado de la reserva: color del badge + icono Lucide (TCK-8010, sin emojis). */
export interface EstadoReservaMeta {
  readonly badge: string;
  readonly icono: string;
  readonly label: string;
}

/**
 * Cómo se pinta cada estado de reserva en todo el panel.
 *
 * Vive aquí y no en el centro de reservas porque la ficha del comercio enseña
 * las mismas reservas: con dos tablas, "pago retenido" salía ámbar en una
 * pantalla y gris en la otra, y el admin las lee seguidas.
 */
export const ESTADO_RESERVA_META: Record<string, EstadoReservaMeta> = {
  pendiente:        { badge: 'rs-badge--warning', icono: 'hourglass',      label: 'Pendiente' },
  confirmada:       { badge: 'rs-badge--success', icono: 'check-circle',   label: 'Confirmada' },
  ajuste_solicitado:{ badge: 'rs-badge--warning', icono: 'alert-triangle', label: 'Ajuste solicitado' },
  en_curso:         { badge: 'rs-badge--accent',  icono: 'play',           label: 'En curso' },
  completada:       { badge: 'rs-badge--accent',  icono: 'badge-check',    label: 'Completada' },
  pago_retenido:    { badge: 'rs-badge--warning', icono: 'lock',           label: 'Pago retenido' },
  pago_liberado:    { badge: 'rs-badge--success', icono: 'banknote',       label: 'Pago liberado' },
  en_disputa:       { badge: 'rs-badge--error',   icono: 'siren',          label: 'En disputa' },
  reembolsada:      { badge: 'rs-badge--neutral', icono: 'rotate-ccw',     label: 'Reembolsada' },
  cancelada:        { badge: 'rs-badge--error',   icono: 'x',              label: 'Cancelada' },
  no_show:          { badge: 'rs-badge--neutral', icono: 'circle',         label: 'No show' },
};

/** Un estado desconocido se enseña tal cual en vez de dejar el hueco vacío. */
export function metaEstadoReserva(estado: string): EstadoReservaMeta {
  return ESTADO_RESERVA_META[estado] ?? { badge: 'rs-badge--neutral', icono: 'circle', label: estado };
}

/** Pastillas del filtro por estado, en el orden del ciclo de vida. */
export const FILTROS_ESTADO_RESERVA = [
  { label: 'Todas', valor: '' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Confirmadas', valor: 'confirmada' },
  { label: 'En curso', valor: 'en_curso' },
  { label: 'Completadas', valor: 'completada' },
  { label: 'Pago retenido', valor: 'pago_retenido' },
  { label: 'Pago liberado', valor: 'pago_liberado' },
  { label: 'En disputa', valor: 'en_disputa' },
  { label: 'Reembolsadas', valor: 'reembolsada' },
  { label: 'Canceladas', valor: 'cancelada' },
] as const;
