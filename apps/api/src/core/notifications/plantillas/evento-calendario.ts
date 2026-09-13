/**
 * Evento de calendario (.ics) de una reserva, para adjuntarlo al correo.
 *
 * Con el adjunto, Gmail, Outlook y el Calendario de Apple ofrecen "Añadir al
 * calendario" con la hora correcta: el instante va en UTC (`Z`) y cada
 * aplicación lo pinta en la zona de quien lo abre.
 */
export interface EventoCalendario {
  readonly uid: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly lugar?: string;
  readonly inicio: Date;
  readonly fin?: Date;
  /** Sin hora: evento de día completo (una estancia). */
  readonly diaCompleto: boolean;
  readonly url?: string;
}

export function construirIcs(evento: EventoCalendario, ahora = new Date()): string {
  const fin = evento.fin ?? new Date(evento.inicio.getTime() + (evento.diaCompleto ? 86_400_000 : 3_600_000));
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Doogking//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evento.uid}@doogking.com`,
    `DTSTAMP:${instanteIcs(ahora)}`,
    evento.diaCompleto ? `DTSTART;VALUE=DATE:${diaIcs(evento.inicio)}` : `DTSTART:${instanteIcs(evento.inicio)}`,
    evento.diaCompleto ? `DTEND;VALUE=DATE:${diaIcs(fin)}` : `DTEND:${instanteIcs(fin)}`,
    `SUMMARY:${textoIcs(evento.titulo)}`,
    `DESCRIPTION:${textoIcs(evento.descripcion)}`,
    ...(evento.lugar ? [`LOCATION:${textoIcs(evento.lugar)}`] : []),
    ...(evento.url ? [`URL:${evento.url}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${textoIcs(evento.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545: fin de línea CRLF y líneas de 75 octetos como mucho.
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

function instanteIcs(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Día de una estancia: se guarda a medianoche UTC, así que la fecha UTC es la buena. */
function diaIcs(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '');
}

function textoIcs(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function plegar(linea: string): string {
  const partes: string[] = [];
  let resto = linea;
  while (Buffer.byteLength(resto, 'utf8') > 75) {
    let corte = 75;
    while (Buffer.byteLength(resto.slice(0, corte), 'utf8') > 75) corte--;
    partes.push(resto.slice(0, corte));
    resto = ` ${resto.slice(corte)}`;
  }
  partes.push(resto);
  return partes.join('\r\n');
}
