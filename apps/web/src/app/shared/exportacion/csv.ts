/**
 * Descarga de listados como CSV desde el panel de administración.
 *
 * Se usa punto y coma como separador y se antepone el BOM porque es lo único
 * que Excel en español abre sin pasar por el asistente de importación: un CSV
 * "correcto" que el cliente tiene que reparar a mano no sirve de nada.
 */
export function descargarCsv(filas: ReadonlyArray<ReadonlyArray<string>>, nombreFichero: string): void {
  const csv = filas
    .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreFichero;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Sufijo de fecha para que dos exportaciones del mismo listado no se pisen. */
export function conFecha(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
}
