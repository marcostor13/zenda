/**
 * Entrega un fichero al navegador desde datos que ya están en memoria.
 *
 * Todo lo que la aplicación descarga viene de una llamada autenticada —el token
 * va en la cabecera, no en la URL—, así que no vale un enlace normal: hay que
 * pedirlo por código y darle al navegador el resultado ya descargado.
 */
export function descargarFichero(contenido: Blob, nombreFichero: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombreFichero;
  enlace.click();

  URL.revokeObjectURL(url);
}
