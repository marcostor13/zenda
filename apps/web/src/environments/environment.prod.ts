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
  apiUrl: variable('WEB_API_URL', 'https://apizenda.marcostorresalarcon.com/api/v1'),
  // Pantalla "muy pronto" mientras se prepara el lanzamiento público.
  // Acceso directo: https://doogking.com/?acceso=royal-preview-2026
  // Al entrar una vez con la clave correcta, queda guardado en localStorage
  // y no hace falta repetir el query param. Para lanzar: WEB_UNDER_CONSTRUCTION=false.
  underConstruction: bandera('WEB_UNDER_CONSTRUCTION', true),
  underConstructionKey: variable('WEB_UNDER_CONSTRUCTION_KEY', 'royal-preview-2026'),
  // Sustituir por la clave publicable LIVE (pk_live_…) desde WEB_STRIPE_PUBLIC_KEY.
  stripePublicKey: variable(
    'WEB_STRIPE_PUBLIC_KEY',
    'pk_test_51TmN6IA68yWZtvLm0XfmtZLLxqSmfTUshpLVz1mEyFcLAhv64LFPgn6d3jxKufHjFClHyCqcMU4lWZrQCVxKTjFM00x6Uf0Pnm',
  ),
  // Login social: credenciales públicas de producción.
  googleClientId: variable(
    'WEB_GOOGLE_CLIENT_ID',
    '479851653802-adnm1q9a2dq8o6vutbu0sg3bb5k6bv6c.apps.googleusercontent.com',
  ),
  facebookAppId: variable('WEB_FACEBOOK_APP_ID', '1008224575538729'),
};
