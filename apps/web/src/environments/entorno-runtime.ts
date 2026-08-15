/**
 * Lectura de la configuración inyectada en tiempo de ejecución (`public/env.js`,
 * que el contenedor reescribe al arrancar con las variables del entorno).
 *
 * Si la variable no está declarada se usa el valor compilado por defecto: la web
 * arranca igual en un entorno sin configurar, en vez de quedarse sin API.
 *
 * **Nada de lo que se lea aquí es secreto.** El navegador descarga el fichero:
 * sólo deben viajar valores públicos (URL del API, claves publicables). Las
 * claves de servidor —Google Maps, Stripe secreta, Mongo— se quedan en el API.
 */
interface EntornoInyectado {
  readonly [clave: string]: string | undefined;
}

function inyectado(): EntornoInyectado {
  return (globalThis as { __env?: EntornoInyectado }).__env ?? {};
}

/** Valor de texto; el vacío cuenta como "no declarada" para no dejar campos a medias. */
export function variable(clave: string, porDefecto: string): string {
  const valor = inyectado()[clave];
  return valor === undefined || valor === '' ? porDefecto : valor;
}

/** Bandera: sólo `true`/`1` activan; cualquier otra cosa desactiva. */
export function bandera(clave: string, porDefecto: boolean): boolean {
  const valor = inyectado()[clave];
  if (valor === undefined || valor === '') return porDefecto;
  return valor === 'true' || valor === '1';
}
