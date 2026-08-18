/**
 * Detección del tipo real de un fichero por sus primeros bytes.
 *
 * `ParseFilePipeBuilder.addFileTypeValidator` valida el `Content-Type` que
 * **declara el cliente** en el multipart, no el contenido. Ese mismo valor se
 * guardaba y se devolvía luego en `GET /upload/:id`, servido desde el origen del
 * API: bastaba subir cualquier cosa etiquetada como `image/png`. Aquí se
 * comprueba la firma real y se rechaza lo que no coincide.
 *
 * La lista cubre exactamente los formatos que aceptan los tres endpoints de
 * subida; añadir uno nuevo pasa por añadirlo también aquí, a propósito.
 */

interface Firma {
  readonly mime: string;
  /** Bytes esperados al inicio; `null` = cualquier byte en esa posición. */
  readonly bytes: readonly (number | null)[];
  /** Desplazamiento desde el que comparar. */
  readonly desde?: number;
  /** Comprobación extra para contenedores que comparten cabecera. */
  readonly ademas?: (buffer: Buffer) => boolean;
}

const ASCII = (texto: string): number[] => [...texto].map((c) => c.charCodeAt(0));

/** `ftyp` + marca del subtipo, que es lo que separa un MP4 de un MOV. */
const marcaIso = (buffer: Buffer): string => buffer.subarray(8, 12).toString('ascii');

const FIRMAS: readonly Firma[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', bytes: ASCII('GIF8') },
  // RIFF....WEBP: el tamaño va en los cuatro bytes intermedios.
  {
    mime: 'image/webp',
    bytes: ASCII('RIFF'),
    ademas: (b) => b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { mime: 'application/pdf', bytes: ASCII('%PDF-') },
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  {
    mime: 'video/quicktime',
    bytes: ASCII('ftyp'),
    desde: 4,
    ademas: (b) => marcaIso(b).startsWith('qt'),
  },
  {
    mime: 'video/mp4',
    bytes: ASCII('ftyp'),
    desde: 4,
    ademas: (b) => !marcaIso(b).startsWith('qt'),
  },
];

function casa(buffer: Buffer, firma: Firma): boolean {
  const desde = firma.desde ?? 0;
  if (buffer.length < desde + firma.bytes.length) return false;

  const coincideCabecera = firma.bytes.every(
    (byte, i) => byte === null || buffer[desde + i] === byte,
  );

  return coincideCabecera && (firma.ademas?.(buffer) ?? true);
}

/** Tipo MIME deducido del contenido, o `null` si no se reconoce. */
export function detectarTipoReal(buffer: Buffer): string | null {
  return FIRMAS.find((firma) => casa(buffer, firma))?.mime ?? null;
}

/**
 * true si el contenido corresponde al tipo declarado.
 *
 * MP4 y MOV comparten contenedor ISO-BMFF y muchos móviles etiquetan uno como el
 * otro; se aceptan entre sí para no rechazar vídeos legítimos.
 */
export function coincideConDeclarado(buffer: Buffer, declarado: string): boolean {
  const real = detectarTipoReal(buffer);
  if (!real) return false;
  if (real === declarado) return true;

  const contenedorIso = ['video/mp4', 'video/quicktime'];
  return contenedorIso.includes(real) && contenedorIso.includes(declarado);
}
