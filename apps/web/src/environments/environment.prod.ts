export const environment = {
  production: true,
  apiUrl: 'https://apizenda.marcostorresalarcon.com/api/v1',
  // Pantalla "muy pronto" mientras se prepara el lanzamiento público.
  // Acceso directo: https://doogking.com/?acceso=royal-preview-2026
  // Al entrar una vez con la clave correcta, queda guardado en localStorage
  // y no hace falta repetir el query param. Para lanzar: poner en false.
  underConstruction: true,
  underConstructionKey: 'royal-preview-2026',
  // TODO: sustituir por la clave publicable LIVE (pk_live_…) antes de producción real.
  stripePublicKey: 'pk_test_51TmN6IA68yWZtvLm0XfmtZLLxqSmfTUshpLVz1mEyFcLAhv64LFPgn6d3jxKufHjFClHyCqcMU4lWZrQCVxKTjFM00x6Uf0Pnm',
  // Login social: rellenar con las credenciales públicas de producción.
  googleClientId: '479851653802-adnm1q9a2dq8o6vutbu0sg3bb5k6bv6c.apps.googleusercontent.com',
  facebookAppId: '1008224575538729',
};
