export const environment = {
  production: false,
  apiUrl: 'http://localhost:3051/api/v1',
  // Clave publicable de Stripe (de test; segura para exponer en el frontend).
  stripePublicKey: 'pk_test_51TmN6IA68yWZtvLm0XfmtZLLxqSmfTUshpLVz1mEyFcLAhv64LFPgn6d3jxKufHjFClHyCqcMU4lWZrQCVxKTjFM00x6Uf0Pnm',
  // Login social: rellenar con las credenciales públicas (client_id / app_id).
  // Si quedan vacías, los botones sociales no se muestran (la app sigue funcionando).
  googleClientId: '',
  facebookAppId: '',
};
