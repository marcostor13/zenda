/**
 * Orígenes a los que el API permite llamar desde un navegador.
 *
 * Antes se hacía `app.enableCors()` sin opciones, que responde
 * `Access-Control-Allow-Origin: *`: cualquier web de internet podía consumir la
 * API. Aquí se acota a los dominios propios.
 */

import { URL_PUBLICA_POR_DEFECTO } from './url-publica';

/**
 * Orígenes del contenedor de Capacitor. La app móvil (CLAUDE.md §3.1) comparte
 * el código de la web pero se sirve desde el propio dispositivo, así que su
 * `Origin` no es el dominio de producción: iOS envía `capacitor://localhost` y
 * Android `http://localhost`. Van siempre en la lista —también en producción—
 * porque sin ellos la app móvil se queda sin API.
 */
const ORIGENES_CAPACITOR = ['capacitor://localhost', 'ionic://localhost', 'http://localhost'];

/** Puertos del `ng serve` y del `ionic serve` en la máquina del desarrollador. */
const ORIGENES_DESARROLLO = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:8100',
];

/** Quita la barra final para que `https://x.com/` y `https://x.com` sean el mismo origen. */
const normalizar = (origen: string): string => origen.trim().replace(/\/+$/, '');

/**
 * @param configurados valor de `CORS_ORIGINS` (lista separada por comas)
 * @param appUrl       valor de `APP_URL`; el dominio de la web siempre vale
 * @param entorno      valor de `NODE_ENV`
 */
export function origenesPermitidos(
  configurados?: string,
  appUrl?: string,
  entorno?: string,
): string[] {
  const declarados = (configurados ?? '')
    .split(',')
    .map(normalizar)
    .filter(Boolean);

  const web = normalizar(appUrl ?? '');
  const enDesarrollo = entorno !== 'production';

  const origenes = [
    ...declarados,
    ...(web ? [web] : []),
    ...ORIGENES_CAPACITOR,
    ...(enDesarrollo ? ORIGENES_DESARROLLO : []),
  ];

  // En producción sin nada configurado, el dominio propio antes que abrir la
  // puerta: dejar la lista vacía equivaldría a bloquear también a la web real.
  if (!enDesarrollo && !declarados.length && !web) {
    origenes.push(URL_PUBLICA_POR_DEFECTO);
  }

  return [...new Set(origenes)];
}
