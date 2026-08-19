/**
 * Deja una foto lista para subir: decodificada, girada, redimensionada y
 * comprimida por debajo del límite del servidor.
 *
 * El origen de casi todos los fallos de subida es el iPhone, por tres motivos
 * que se acumulan:
 *
 *  1. **Formato.** Desde iOS 11 el carrete guarda en HEIC, y ningún navegador
 *     que no sea Safari sabe pintarlo: subirlo en crudo deja la foto rota para
 *     todo el que entre desde Chrome, Firefox o Android.
 *  2. **Tamaño.** Una foto de 12 MP convertida a JPEG sin tocar la resolución
 *     pesa 3-6 MB, y las de 48 MP de los modelos Pro pasan de 15 MB. El
 *     endpoint corta en 5 MB, así que subían unas fotos sí y otras no según con
 *     qué móvil y en qué modo se hubieran tomado. Ese es el síntoma de "sólo
 *     algunas imágenes suben".
 *  3. **Límite del canvas.** Safari en iOS no rasteriza canvas por encima de
 *     unos 16,7 Mpx: dibujar ahí una foto de 48 MP no da error, devuelve una
 *     imagen en blanco. Por eso hay que reducir *antes* de dibujar.
 *
 * Se procesa lo mínimo: un JPEG que ya cabe se sube tal cual. Si algo falla se
 * devuelve el fichero original —el servidor acepta HEIC como último recurso—
 * porque subir algo imperfecto es mejor que no poder subir.
 */

/** Tope de `POST /upload/image`. Debe seguir al del controlador del API. */
export const MAX_SUBIDA_BYTES = 5 * 1024 * 1024;

/**
 * Lado máximo del resultado. 2560 px cubre cualquier pantalla y un zoom
 * razonable en la ficha; guardar los 8064 px del original no aporta nada y
 * multiplica el peso y el tiempo de carga.
 */
const LADO_MAX = 2560;

/**
 * Área máxima antes de dibujar. Es el techo de canvas de Safari en iOS
 * (4096x4096, unos 16,7 Mpx): por encima devuelve un lienzo en blanco sin
 * avisar de nada.
 */
const AREA_MAX = 4096 * 4096;

/**
 * Pasadas sucesivas hasta que el resultado cabe. Primero se sacrifica calidad,
 * que casi no se nota; sólo después, resolución.
 */
const INTENTOS: readonly { readonly escala: number; readonly calidad: number }[] = [
  { escala: 1, calidad: 0.9 },
  { escala: 1, calidad: 0.72 },
  { escala: 0.6, calidad: 0.72 },
];

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

/** Extensiones de imagen que el usuario puede elegir, para cuando no hay tipo. */
const EXTENSIONES_IMAGEN = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

/**
 * ¿Merece la pena intentar subir esto como imagen?
 *
 * No basta con `type.startsWith('image/')`: iOS deja el tipo vacío —o pone
 * `application/octet-stream`— cuando el fichero llega desde la app Archivos, y
 * esos ficheros se descartaban antes de intentar nada.
 */
export function pareceImagen(fichero: File): boolean {
  return fichero.type.startsWith('image/') || EXTENSIONES_IMAGEN.test(fichero.name);
}

/** Cambia la extensión del nombre, conservando el resto. */
function conExtension(nombre: string, extension: string): string {
  return `${nombre.replace(/\.[^.]+$/, '')}.${extension}`;
}

/**
 * ¿Hay que tocar el fichero?
 *
 * Un JPEG de 800 KB ya funciona en todas partes: reprocesarlo sólo le quitaría
 * calidad. Se interviene cuando el navegador de destino no sabría pintarlo
 * (HEIC) o cuando no cabría en la petición.
 */
function necesitaProceso(fichero: File, maxBytes: number): boolean {
  return esHeic(fichero) || fichero.size > maxBytes;
}

/**
 * Reduce hasta respetar a la vez el lado máximo y el techo de canvas de iOS.
 * Nunca amplía: una foto pequeña se queda como está.
 */
function encajar(ancho: number, alto: number): { ancho: number; alto: number } {
  const porLado = LADO_MAX / Math.max(ancho, alto);
  const porArea = Math.sqrt(AREA_MAX / (ancho * alto));
  const factor = Math.min(1, porLado, porArea);

  return {
    ancho: Math.max(1, Math.round(ancho * factor)),
    alto: Math.max(1, Math.round(alto * factor)),
  };
}

/**
 * Formato de salida.
 *
 * Un PNG se mantiene en PNG porque puede llevar transparencia —un logotipo
 * pasado a JPEG saldría con el fondo relleno de negro—. Todo lo demás va a
 * JPEG, que es lo que pinta cualquier navegador y lo que menos pesa en fotos.
 */
function formatoDestino(fichero: File): string {
  const esPng = fichero.type === 'image/png' || /\.png$/i.test(fichero.name);
  return esPng && !esHeic(fichero) ? 'image/png' : 'image/jpeg';
}

function extensionDe(tipo: string): string {
  return tipo === 'image/png' ? 'png' : 'jpg';
}

/** Dibuja el bitmap al tamaño pedido y lo vuelca al formato indicado. */
async function volcar(
  bitmap: ImageBitmap,
  ancho: number,
  alto: number,
  tipo: string,
  calidad: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;

  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Canvas 2D no disponible');

  contexto.drawImage(bitmap, 0, 0, ancho, alto);

  return new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

/**
 * Decodifica respetando la orientación EXIF.
 *
 * Sin `from-image`, una foto tomada en vertical con el móvil se dibuja tumbada:
 * el sensor la guarda apaisada y la rotación vive sólo en los metadatos, que el
 * canvas descarta.
 */
function decodificar(fichero: File): Promise<ImageBitmap> {
  return createImageBitmap(fichero, { imageOrientation: 'from-image' });
}

/**
 * Devuelve la imagen lista para subir. Si no hay nada que hacer —o si el
 * navegador no sabe decodificarla— devuelve el fichero original.
 */
export async function prepararImagen(
  fichero: File,
  maxBytes: number = MAX_SUBIDA_BYTES,
): Promise<File> {
  if (!necesitaProceso(fichero, maxBytes)) return fichero;

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodificar(fichero);
  } catch {
    // Chrome y Firefox no decodifican HEIC. Que decida el servidor, que también
    // lo acepta, en vez de dejar al usuario sin poder subir su foto.
    return fichero;
  }

  try {
    const base = encajar(bitmap.width, bitmap.height);
    let tipo = formatoDestino(fichero);
    let mejor: Blob | null = null;

    for (const intento of INTENTOS) {
      const ancho = Math.max(1, Math.round(base.ancho * intento.escala));
      const alto = Math.max(1, Math.round(base.alto * intento.escala));

      const blob = await volcar(bitmap, ancho, alto, tipo, intento.calidad);
      if (!blob) break;

      mejor = blob;
      if (blob.size <= maxBytes) break;

      /*
       * Un PNG ignora la calidad, así que repetirla no sirve de nada: si sigue
       * sin caber se pasa a JPEG y se pierde la transparencia. Perder el alfa
       * de una captura enorme es preferible a no poder subirla.
       */
      if (tipo === 'image/png') tipo = 'image/jpeg';
    }

    if (!mejor) return fichero;

    return new File([mejor], conExtension(fichero.name, extensionDe(tipo)), {
      type: tipo,
      lastModified: fichero.lastModified,
    });
  } catch {
    return fichero;
  } finally {
    bitmap.close();
  }
}
