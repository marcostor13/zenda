import { bandera, variable } from './entorno-runtime';

/**
 * Configuración de desarrollo. Cada valor puede sobrescribirse desde
 * `apps/web/.env` (ver `.env.example`) sin tocar este fichero; lo escrito aquí
 * es sólo el valor por defecto para arrancar sin configurar nada.
 */
export const environment = {
  production: false,
  apiUrl: variable('WEB_API_URL', 'http://localhost:3051/api/v1'),
  // Pantalla "muy pronto": desactivada en desarrollo para no estorbar.
  underConstruction: bandera('WEB_UNDER_CONSTRUCTION', false),
  underConstructionKey: variable('WEB_UNDER_CONSTRUCTION_KEY', 'royal-preview-2026'),
  // Clave publicable de Stripe (de test; segura para exponer en el frontend).
  stripePublicKey: variable(
    'WEB_STRIPE_PUBLIC_KEY',
    'pk_test_51TmN6IA68yWZtvLm0XfmtZLLxqSmfTUshpLVz1mEyFcLAhv64LFPgn6d3jxKufHjFClHyCqcMU4lWZrQCVxKTjFM00x6Uf0Pnm',
  ),
  // Login social: rellenar con las credenciales públicas (client_id / app_id).
  // Si quedan vacías, los botones sociales no se muestran (la app sigue funcionando).
  googleClientId: variable(
    'WEB_GOOGLE_CLIENT_ID',
    '479851653802-adnm1q9a2dq8o6vutbu0sg3bb5k6bv6c.apps.googleusercontent.com',
  ),
  facebookAppId: variable('WEB_FACEBOOK_APP_ID', '1008224575538729'),
};
