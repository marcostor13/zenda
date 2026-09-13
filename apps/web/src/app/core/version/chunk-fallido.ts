/**
 * Reconoce el fallo de "no he podido traerme un trozo de la aplicación".
 *
 * La web se carga por partes: cada pantalla vive en su propio fichero y el
 * navegador lo pide cuando hace falta, no al entrar. Si ese fichero ya no está
 * en el servidor —porque el visitante arrancó con el HTML de un despliegue
 * anterior y pide nombres que ya no existen— la navegación se corta y no se
 * pinta nada. En blanco, sin mensaje.
 *
 * Cada navegador lo cuenta con sus palabras y no hay un tipo de error común, así
 * que se reconoce por el texto. La lista cubre los tres motores; conviene
 * mantenerla larga antes que corta: confundirse aquí sólo cuesta una recarga.
 */
const SENALES: readonly string[] = [
  'chunkloaderror',
  'loading chunk',
  'loading css chunk',
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'unable to preload css',
  'importing a module script failed',
  'expected a javascript module script',
  'failed to import',
];

/** `true` si el error es un trozo de la aplicación que no se pudo cargar. */
export function esErrorDeChunk(error: unknown): boolean {
  const texto = textoDe(error).toLowerCase();
  if (!texto) return false;

  return SENALES.some((senal) => texto.includes(senal));
}

/** Todo lo legible del error: el nombre, el mensaje y lo que traiga dentro. */
function textoDe(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return '';

  const causa = 'cause' in error ? textoDe(error.cause) : '';
  return `${error.name} ${error.message} ${causa}`;
}
