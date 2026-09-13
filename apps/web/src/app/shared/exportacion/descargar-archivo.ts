/**
 * Guarda en el dispositivo un archivo que ya llegó del API (un PDF, por
 * ejemplo). Los informes se piden con `HttpClient` y no con un enlace directo
 * porque el endpoint exige el token de sesión, que un `<a href>` no manda.
 */
export function descargarBlob(blob: Blob, nombreFichero: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreFichero;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // El navegador necesita la URL viva hasta que arranca la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Mismo criterio que el API: sin tildes ni espacios, para cualquier sistema. */
export function nombreInforme(nombreMascota: string): string {
  const base = nombreMascota
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `historial-${base || 'mascota'}.pdf`;
}
