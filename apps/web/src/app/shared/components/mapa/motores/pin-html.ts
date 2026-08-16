import type { PuntoMapa } from './motor-mapa';

/**
 * Marcado de los pines y de sus tarjetas emergentes. Se compone a mano porque
 * los dos motores (Google Maps y OpenStreetMap) solo aceptan HTML plano ahí, y
 * vive aparte para que ambos pinten exactamente el mismo pin: si cada motor
 * tuviera el suyo, cambiar de proveedor cambiaría el aspecto de la búsqueda.
 */

/** Escapa texto del API: un título con comillas rompería el marcado. */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Pin con el precio. Es un `<button>` y no un `<span>` para que se pueda
 * alcanzar con el teclado y anunciarlo un lector de pantalla: los resultados
 * del mapa son los mismos que los de la lista y deben ser igual de accesibles.
 */
export function htmlPin(punto: PuntoMapa, esActivo: boolean): string {
  const etiqueta = escapar(punto.etiqueta ?? '·');
  const titulo = punto.titulo ? escapar(punto.titulo) : etiqueta;
  return `<button type="button" class="rs-pin${esActivo ? ' rs-pin--activo' : ''}"`
    + ` aria-label="${titulo}"${esActivo ? ' aria-current="true"' : ''}>${etiqueta}</button>`;
}

/** Tarjeta emergente del pin; `null` cuando el punto no tiene ni título. */
export function htmlTarjeta(punto: PuntoMapa): string | null {
  if (!punto.titulo) return null;

  const imagen = punto.imagen
    ? `<img class="rs-mapa-pop__img" src="${escapar(punto.imagen)}" alt="" loading="lazy">`
    : '';
  // La nota va en una insignia con su número, como el marcador de puntuación
  // de Booking: el proyecto no admite emojis en el código de producción.
  const nota = punto.rating
    ? `<span class="rs-mapa-pop__nota" title="Valoración">${punto.rating.toFixed(1)}</span> `
    : '';
  const precio = punto.etiqueta
    ? `<span class="rs-mapa-pop__precio">${escapar(punto.etiqueta)}</span>`
    : '';

  return `<div class="rs-mapa-pop">${imagen}`
    + `<span class="rs-mapa-pop__titulo">${escapar(punto.titulo)}</span>`
    + `<span class="rs-mapa-pop__meta">${nota}${precio}</span></div>`;
}
