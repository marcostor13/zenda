/**
 * Fotos de iPhone (HEIC/HEIF) → JPEG, en el propio navegador.
 *
 * Desde iOS 11 el carrete guarda en HEIC. Aceptarlo tal cual no basta: **ningún
 * navegador que no sea Safari sabe pintarlo**, así que una foto subida desde un
 * iPhone se vería rota para todo el que entre desde Chrome, Firefox o Android —
 * exactamente el mismo síntoma que tener la URL mal guardada.
 *
 * La conversión se hace donde el formato es nativo: Safari sí decodifica HEIC,
 * así que se pinta en un canvas y se vuelca a JPEG. En los demás navegadores la
 * decodificación falla, pero da igual: esos navegadores tampoco producen HEIC.
 *
 * Si algo sale mal se devuelve el fichero original. El API acepta HEIC como
 * último recurso, así que es mejor subir algo que el servidor pueda guardar que
 * dejar al usuario sin poder subir su foto.
 */

/** Calidad del JPEG resultante: suficiente para una ficha, sin inflar el peso. */
const CALIDAD_JPEG = 0.9;

/** Tipos que anuncia iOS para una foto del carrete, según versión y origen. */
const TIPOS_HEIC = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/**
 * ¿Es una foto de iPhone?
 *
 * Se mira también la extensión porque iOS **no siempre rellena `file.type`**:
 * cuando el fichero llega desde la app Archivos en vez del carrete, llega vacío
 * o como `application/octet-stream`. Fiarse sólo del tipo hacía que esas fotos
 * se descartaran en silencio, sin subida y sin mensaje.
 */
export function esHeic(fichero: File): boolean {
  if (TIPOS_HEIC.includes(fichero.type.toLowerCase())) return true;

  return /\.(heic|heif)$/i.test(fichero.name);
}

/** Cambia la extensión del nombre a `.jpg`, conservando el resto. */
function comoJpg(nombre: string): string {
  return `${nombre.replace(/\.(heic|heif)$/i, '')}.jpg`;
}

/** Dibuja el fichero en un canvas del tamaño de la imagen. */
async function aCanvas(fichero: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(fichero);

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Canvas 2D no disponible');

  contexto.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas;
}

/**
 * Devuelve el fichero listo para subir: convertido a JPEG si era HEIC, y tal
 * cual en cualquier otro caso (incluido si la conversión falla).
 */
export async function normalizarImagen(fichero: File): Promise<File> {
  if (!esHeic(fichero)) return fichero;

  try {
    const canvas = await aCanvas(fichero);

    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, 'image/jpeg', CALIDAD_JPEG),
    );
    if (!blob) throw new Error('No se pudo generar el JPEG');

    return new File([blob], comoJpg(fichero.name), {
      type: 'image/jpeg',
      lastModified: fichero.lastModified,
    });
  } catch {
    // Sin conversión posible: que decida el servidor, que también acepta HEIC.
    return fichero;
  }
}
