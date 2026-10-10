import { CATEGORIA_ICONOS } from '../../../media/images';
import type { PuntoMapa } from './motor-mapa';

/** Pin de una categoría desconocida: la huella, nunca el icono de otra. */
const ICONO_GENERICO = CATEGORIA_ICONOS['mas'];

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
 * Pin con el icono de la categoría.
 *
 * Por defecto va sólo el icono: un mapa con veinte pastillas de texto encima
 * tapa el mapa que se supone que está enseñando (feedback 2026-08-20). En el
 * buscador por mapa (`conPrecio`) el cliente pidió después ver el precio sin
 * pulsar, como en Booking (2026-10-10): ahí el pin es una pastilla compacta con
 * el icono y la cifra, y el resto de mapas siguen con el icono a secas.
 *
 * Es un `<button>` y no un `<span>` para que se pueda alcanzar con el teclado y
 * lo anuncie un lector de pantalla: los resultados del mapa son los mismos que
 * los de la lista y deben ser igual de accesibles. Como el texto ya no dice
 * nada, la etiqueta accesible carga con el título y el precio.
 */
export function htmlPin(punto: PuntoMapa, esActivo: boolean, conPrecio = false): string {
  const icono = escapar(CATEGORIA_ICONOS[punto.vertical ?? ''] ?? ICONO_GENERICO);
  // Sin precio que enseñar —transporte lo calcula por viaje— el pin se queda en
  // el icono: una pastilla vacía sería más ruido que información.
  const precio = conPrecio && punto.etiqueta
    ? `<span class="rs-pin__precio">${escapar(punto.etiqueta)}</span>`
    : '';
  const clases = `rs-pin${precio ? ' rs-pin--precio' : ''}${esActivo ? ' rs-pin--activo' : ''}`;

  return `<button type="button" class="${clases}"`
    + ` aria-label="${escapar(etiquetaAccesible(punto))}"`
    + `${esActivo ? ' aria-current="true"' : ''}>`
    + `<img class="rs-pin__icono" src="${icono}" alt="" aria-hidden="true">${precio}</button>`;
}

/** Lo que oye quien no ve el mapa: el nombre y, si lo hay, el precio. */
function etiquetaAccesible(punto: PuntoMapa): string {
  const nombre = punto.titulo ?? 'Servicio';
  return punto.etiqueta ? `${nombre}, ${punto.etiqueta}` : nombre;
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

  const subtitulo = punto.subtitulo
    ? `<span class="rs-mapa-pop__sub">${escapar(punto.subtitulo)}</span>`
    : '';

  return `<div class="rs-mapa-pop">${imagen}`
    + `<span class="rs-mapa-pop__titulo">${escapar(punto.titulo)}</span>`
    + subtitulo
    + `<span class="rs-mapa-pop__meta">${nota}${precio}</span></div>`;
}
