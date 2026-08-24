/**
 * Extrae el mensaje que manda el API en un `HttpErrorResponse`.
 *
 * Nest devuelve `{ message: string | string[] }` en el cuerpo del error; el
 * panel enseñaba en su lugar un texto genérico, y eso escondía la razón real
 * (por ejemplo "hay 3 reservas en curso"), que es justo lo que el operador
 * necesita para saber qué hacer a continuación.
 */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  const cuerpo = (error as { error?: { message?: string | string[] } } | null)?.error;
  const mensaje = cuerpo?.message;
  if (Array.isArray(mensaje)) return mensaje.join('. ') || porDefecto;
  return typeof mensaje === 'string' && mensaje.trim() ? mensaje : porDefecto;
}
