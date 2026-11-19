import { bandera, variable } from './entorno-runtime';

/**
 * Configuración de producción. Los valores reales llegan por variables de
 * entorno del contenedor (Coolify → `docker-entrypoint.sh` → `env.js`), así que
 * cambiar la URL del API o apagar la pantalla de "muy pronto" es reiniciar el
 * servicio, no reconstruir la imagen.
 *
 * Lo escrito aquí es el respaldo si la variable no está declarada.
 */
export const environment = {
  production: true,
  apiUrl: variable('WEB_API_URL', 'https://api.doogking.com/api/v1'),
  /*
   * Pantalla "muy pronto" para TODA la web (cierre total). Apagada: la web está
   * abierta a clientes. Se ignora a propósito la antigua WEB_UNDER_CONSTRUCTION,
   * que en Coolify seguía a `true` del prelanzamiento y volvería a cerrar la web.
   * Si hiciera falta cerrarla otra vez: WEB_CIERRE_TOTAL=true y se entra con
   * ?acceso=<clave>.
   */
  underConstruction: bandera('WEB_CIERRE_TOTAL', false),
  underConstructionKey: variable('WEB_UNDER_CONSTRUCTION_KEY', 'royal-preview-2026'),
  /*
   * Lanzamiento por fases. Los clientes ya pueden registrarse, explorar,
   * guardar favoritos y dar de alta a sus perros, pero reservar y el alta de
   * negocios esperan a la apertura de comercios: hasta entonces muestran su
   * pantalla de "muy pronto" (ver `lanzamiento.guard.ts`). Cerradas salvo que
   * la variable valga `true`. Deben ir a la par que `RESERVAS_ABIERTAS` y
   * `REGISTRO_COMERCIOS_ABIERTO` del API, que es quien las hace cumplir.
   */
  reservasAbiertas: bandera('WEB_RESERVAS_ABIERTAS', false),
  registroComerciosAbierto: bandera('WEB_REGISTRO_COMERCIOS_ABIERTO', false),
  // Sustituir por la clave publicable LIVE (pk_live_…) desde WEB_STRIPE_PUBLIC_KEY.
  stripePublicKey: variable(
    'WEB_STRIPE_PUBLIC_KEY',
    'pk_test_51U7y4eL9gDXoXRd8n3X8E5IpK6W9HWbFkD7p4DWG5AdHD5RTv68U5W4N1XQgYqmHbRRKGO4csX17A9aonPQljdWE00LMs9BxEx',
  ),
  // Login social: credenciales públicas de producción.
  googleClientId: variable(
    'WEB_GOOGLE_CLIENT_ID',
    '479851653802-adnm1q9a2dq8o6vutbu0sg3bb5k6bv6c.apps.googleusercontent.com',
  ),
  facebookAppId: variable('WEB_FACEBOOK_APP_ID', '1008224575538729'),
};
