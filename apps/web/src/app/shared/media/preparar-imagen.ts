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
 *  4. **Orientación.** `imageOrientation: 'from-image'` sólo existe desde
 *     Safari 16, Chrome 112 y Firefox 111. Antes de esas versiones el navegador
 *     lanza un TypeError al validar el diccionario en vez de ignorar la opción,
 *     así que en iOS 15 la conversión moría antes de empezar y la foto se subía
 *     en HEIC crudo. Por eso hay un reintento sin opciones.
 *
 * Se procesa lo mínimo: un JPEG que ya cabe se sube tal cual. Si la conversión
 * no sale, se devuelve el original y es `problemaDeSubida` quien decide: subir
 * un HEIC sin convertir deja la foto rota para todo el que no entre desde un
 * iPhone, que es peor que un aviso claro.
 */

/** Tope de `POST /upload/image`. Debe seguir al del controlador del API. */
export const MAX_SUBIDA_BYTES = 5 * 1024 * 1024;

/**
 * Holgura que se deja por debajo del tope del endpoint.
 *
 * `MaxFileSizeValidator` de Nest compara con `<`, no con `<=`: un fichero de
 * exactamente 5 MB se rechaza con un 422 que aquí se leía como "formato no
 * válido". Apuntar por debajo evita quedarse justo en el filo.
 */
const MARGEN_BYTES = 128 * 1024;

/** Peso al que se apunta al comprimir, dado el tope que acepta el endpoint. */
function objetivoDe(limite: number): number {
  return Math.max(1, limite - MARGEN_BYTES);
}

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
  { escala: 0.75, calidad: 0.7 },
  { escala: 0.55, calidad: 0.65 },
  // Último recurso para panorámicas y capturas enormes: antes la lista se
  // acababa antes de que la foto cupiera y se subía igual, para que el
  // servidor la rechazara con un 422.
  { escala: 0.4, calidad: 0.6 },
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
function necesitaProceso(fichero: File, objetivo: number): boolean {
  return esHeic(fichero) || fichero.size > objetivo;
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

/** Imagen ya decodificada, venga de donde venga, lista para pintar en el canvas. */
interface Decodificada {
  readonly fuente: CanvasImageSource;
  readonly ancho: number;
  readonly alto: number;
  /** Libera la memoria del bitmap o el blob URL de la etiqueta img. */
  liberar(): void;
}

/** Dibuja la imagen al tamaño pedido y la vuelca al formato indicado. */
async function volcar(
  imagen: Decodificada,
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

  contexto.drawImage(imagen.fuente, 0, 0, ancho, alto);

  return new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

/**
 * Decodifica con `createImageBitmap`, pidiendo la orientación EXIF y
 * reintentando sin ella si el navegador no la conoce.
 *
 * `imageOrientation: 'from-image'` sólo existe desde Safari 16, Chrome 112 y
 * Firefox 111 (datos de MDN). Antes de esas versiones el navegador **lanza un
 * TypeError** al validar el diccionario de opciones, no lo ignora: en iOS 15 la
 * conversión moría aquí y la foto se subía en crudo. El reintento sin opciones
 * pierde la rotación automática, que es mucho menos grave que no poder subir.
 */
async function conCreateImageBitmap(fichero: File): Promise<Decodificada> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichero, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(fichero);
  }

  return {
    fuente: bitmap,
    ancho: bitmap.width,
    alto: bitmap.height,
    liberar: () => bitmap.close(),
  };
}

/** Tope de espera de la decodificación por etiqueta: un `img` colgado no avisa. */
const ESPERA_DECODIFICACION_MS = 15000;

/**
 * Respaldo para navegadores sin `createImageBitmap` (Safari < 15, WebViews
 * antiguas de Android). Usa los mismos decodificadores del sistema, así que no
 * sirve para rescatar un formato que `createImageBitmap` no supo abrir: sólo
 * cubre la ausencia de la API.
 */
function conEtiquetaImagen(fichero: File): Promise<Decodificada> {
  return new Promise<Decodificada>((resolver, rechazar) => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      rechazar(new Error('Sin URL.createObjectURL'));
      return;
    }

    const url = URL.createObjectURL(fichero);
    const imagen = document.createElement('img');

    const temporizador = setTimeout(() => {
      URL.revokeObjectURL(url);
      rechazar(new Error('La decodificación tardó demasiado'));
    }, ESPERA_DECODIFICACION_MS);

    imagen.onload = () => {
      clearTimeout(temporizador);
      resolver({
        fuente: imagen,
        ancho: imagen.naturalWidth,
        alto: imagen.naturalHeight,
        liberar: () => URL.revokeObjectURL(url),
      });
    };
    imagen.onerror = () => {
      clearTimeout(temporizador);
      URL.revokeObjectURL(url);
      rechazar(new Error('El navegador no sabe pintar este formato'));
    };

    imagen.src = url;
  });
}

/**
 * Decodifica respetando la orientación EXIF cuando el navegador la entiende.
 *
 * Sin la orientación, una foto tomada en vertical con el móvil se dibuja
 * tumbada: el sensor la guarda apaisada y la rotación vive sólo en los
 * metadatos, que el canvas descarta.
 */
function decodificar(fichero: File): Promise<Decodificada> {
  return typeof createImageBitmap === 'function'
    ? conCreateImageBitmap(fichero)
    : conEtiquetaImagen(fichero);
}

/**
 * Devuelve la imagen lista para subir. Si no hay nada que hacer —o si el
 * navegador no sabe decodificarla— devuelve el fichero original.
 */
export async function prepararImagen(
  fichero: File,
  maxBytes: number = MAX_SUBIDA_BYTES,
): Promise<File> {
  const objetivo = objetivoDe(maxBytes);
  if (!necesitaProceso(fichero, objetivo)) return fichero;

  let imagen: Decodificada;
  try {
    imagen = await decodificar(fichero);
  } catch {
    // El navegador no sabe abrir este formato (un HEIC fuera de Safari). Se
    // devuelve el original; quien llama decide qué hacer con él —ver
    // `problemaDeSubida`—, porque subir un HEIC sin convertir deja la foto
    // rota para todo el que no entre desde un iPhone.
    return fichero;
  }

  try {
    const base = encajar(imagen.ancho, imagen.alto);
    let tipo = formatoDestino(fichero);
    let mejor: Blob | null = null;

    for (const intento of INTENTOS) {
      const ancho = Math.max(1, Math.round(base.ancho * intento.escala));
      const alto = Math.max(1, Math.round(base.alto * intento.escala));

      const blob = await volcar(imagen, ancho, alto, tipo, intento.calidad);
      if (!blob) break;

      mejor = blob;
      if (blob.size <= objetivo) break;

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
    imagen.liberar();
  }
}

/** Qué impide subir este fichero, o `null` si está listo. */
export type ProblemaSubida = 'vacio' | 'sin_convertir' | 'demasiado_grande';

/**
 * Revisa el resultado de `prepararImagen` antes de gastar una petición.
 *
 * Los tres casos son fallos reales vistos con fotos de iPhone:
 *
 *  - **vacío**: la foto vive en iCloud y no está descargada en el dispositivo;
 *    iOS entrega un fichero de 0 bytes sin avisar de nada.
 *  - **sin convertir**: sigue siendo HEIC porque el navegador no supo abrirlo.
 *    El servidor lo aceptaría, pero la ficha quedaría con una imagen que sólo
 *    se ve desde Safari.
 *  - **demasiado grande**: ni con la última pasada de compresión cabe. Subirlo
 *    sólo sirve para recibir un 422 que el usuario lee como "formato no válido".
 */
export function problemaDeSubida(
  fichero: File,
  maxBytes: number = MAX_SUBIDA_BYTES,
): ProblemaSubida | null {
  if (fichero.size === 0) return 'vacio';
  if (esHeic(fichero)) return 'sin_convertir';
  if (fichero.size > objetivoDe(maxBytes)) return 'demasiado_grande';
  return null;
}
