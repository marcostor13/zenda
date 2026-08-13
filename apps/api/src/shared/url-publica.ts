/**
 * URL pública de la web, la que viaja dentro de los correos.
 *
 * Existe por un fallo real: se desplegó con `APP_URL=http://localhost:4200`
 * (el valor de desarrollo) y los correos de verificación salieron con enlaces
 * a localhost, inservibles para quien los recibía. Fuera de desarrollo, una
 * URL local se descarta y se usa el dominio de producción: es preferible un
 * enlace al dominio bueno que uno que no abre en ningún sitio.
 */

/** Dominio de producción; también es el que aparece en el pie de los correos. */
export const URL_PUBLICA_POR_DEFECTO = 'https://www.doogking.com';

/** Hosts que solo tienen sentido en la máquina del desarrollador. */
const HOSTS_LOCALES = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

const esLocal = (url: string): boolean => {
  try {
    return HOSTS_LOCALES.includes(new URL(url).hostname);
  } catch {
    // Una URL mal formada no sirve para un enlace de correo.
    return true;
  }
};

/**
 * @param configurada valor de `APP_URL`
 * @param entorno     valor de `NODE_ENV`
 */
export function urlPublica(configurada?: string, entorno?: string): string {
  const url = (configurada ?? '').trim().replace(/\/+$/, '');
  if (!url) return URL_PUBLICA_POR_DEFECTO;

  // En desarrollo el enlace a localhost es justo lo que se quiere.
  const enDesarrollo = entorno !== 'production';
  if (enDesarrollo) return url;

  return esLocal(url) ? URL_PUBLICA_POR_DEFECTO : url;
}
