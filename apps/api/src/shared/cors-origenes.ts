/**
 * Orígenes a los que el API permite llamar desde un navegador.
 *
 * Antes se hacía `app.enableCors()` sin opciones, que responde
 * `Access-Control-Allow-Origin: *`: cualquier web de internet podía consumir la
 * API. Aquí se acota a los dominios propios.
 */

/**
 * Orígenes del contenedor de Capacitor. La app móvil (CLAUDE.md §3.1) comparte
 * el código de la web pero se sirve desde el propio dispositivo, así que su
 * `Origin` no es el dominio de producción. Van siempre en la lista —también en
 * producción— porque sin ellos la app móvil se queda sin API.
 *
 * `https://localhost` es el que usan hoy Android e iOS: desde Capacitor 4 el
 * esquema por defecto es `https`, y así lo declara `capacitor.config.ts`. Esta
 * lista se escribió con los esquemas antiguos, de modo que la app instalada
 * recibía un CORS bloqueado en **todas** las llamadas y se quedaba en blanco
 * sin decir nada. Los antiguos se conservan por si algún build los usa.
 */
const ORIGENES_CAPACITOR = [
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
];

/** Puertos del `ng serve` y del `ionic serve` en la máquina del desarrollador. */
const ORIGENES_DESARROLLO = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:8100',
];

/**
 * Dominios propios de Doogking (DEPLOY.md §3.4: los tres van por el mismo
 * Cloudflare Tunnel). Se permiten **siempre**, aunque `CORS_ORIGINS` no esté
 * declarada.
 *
 * Existe por una caída real: al pasar de `enableCors()` abierto a esta lista, el
 * despliegue no tenía `CORS_ORIGINS` ni un `APP_URL` con el dominio bueno, así
 * que el API rechazó a su propia web. Que la plataforma confíe en sus dominios
 * no depende de que alguien se acuerde de una variable de entorno.
 */
const DOMINIOS_PROPIOS = ['doogking.com', 'doogking.eu', 'doogking.es']
  .flatMap((dominio) => [`https://${dominio}`, `https://www.${dominio}`]);

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
    ...DOMINIOS_PROPIOS,
    ...ORIGENES_CAPACITOR,
    ...(enDesarrollo ? ORIGENES_DESARROLLO : []),
  ];

  return [...new Set(origenes)];
}
