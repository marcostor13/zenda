import { esNavegador } from '../../core/plataforma/almacen';

export interface EventoCalendario {
  readonly uid: string;
  readonly titulo: string;
  readonly inicio: Date;
  /** Sin fin, el evento dura una hora. */
  readonly fin?: Date;
  readonly lugar?: string;
  readonly descripcion?: string;
}

const UNA_HORA_MS = 3_600_000;

/** `20260925T083000Z`: el instante en UTC, que cualquier calendario pasa a la hora local. */
function instanteIcs(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Comas, puntos y coma y saltos de línea van escapados en un .ics (RFC 5545 §3.3.11). */
function textoIcs(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Contenido de un .ics con un evento a su hora (no de día completo). */
export function construirIcs(evento: EventoCalendario): string {
  const fin = evento.fin ?? new Date(evento.inicio.getTime() + UNA_HORA_MS);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Doogking//Reservas//ES', 'BEGIN:VEVENT',
    `UID:${evento.uid}@doogking.com`,
    `DTSTAMP:${instanteIcs(new Date())}`,
    `DTSTART:${instanteIcs(evento.inicio)}`,
    `DTEND:${instanteIcs(fin)}`,
    `SUMMARY:${textoIcs(evento.titulo)}`,
    ...(evento.lugar ? [`LOCATION:${textoIcs(evento.lugar)}`] : []),
    ...(evento.descripcion ? [`DESCRIPTION:${textoIcs(evento.descripcion)}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

/** Descarga el .ics; el sistema lo abre con el calendario del usuario. */
export function descargarIcs(evento: EventoCalendario): void {
  if (!esNavegador()) return;
  const url = URL.createObjectURL(new Blob([construirIcs(evento)], { type: 'text/calendar' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `doogking-${evento.uid}.ics`;
  enlace.click();
  URL.revokeObjectURL(url);
}
