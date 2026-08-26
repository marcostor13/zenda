import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración de la app móvil (Android/iOS).
 *
 * `appId` es el identificador con el que la app vive en las tiendas y **no se
 * puede cambiar** una vez publicada: un cambio obliga a publicar otra app y los
 * usuarios pierden la suya. Se fija aquí a propósito, no se deja al azar del
 * scaffolding.
 *
 * `webDir` apunta al build de Angular. Con el `application builder` de Angular
 * 17+ los ficheros del navegador quedan bajo `browser/`, no en la raíz de
 * `dist`, y apuntar a `dist/web` daría una app en blanco.
 */
const config: CapacitorConfig = {
  appId: 'com.doogking.app',
  appName: 'Doogking',
  webDir: 'dist/web/browser',

  /*
   * La app carga desde el propio paquete, no de un servidor. Se declara
   * `cleartext: false` porque el API va por HTTPS: dejar tráfico en claro
   * abierto sería una puerta que nadie necesita. Para probar contra un API
   * local, ver `WEB_API_URL` en `public/env.js` y la nota de DEPLOY-MOVIL.md.
   */
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },

  android: {
    // Un WebView mostrando contenido mixto aceptaría recursos http:// dentro de
    // una página https://, que es justo lo que un ataque de red necesita.
    allowMixedContent: false,
  },

  ios: {
    // El teclado no debe tapar el campo enfocado en los formularios largos
    // (paso 2 de la reserva, alta de comercio).
    scrollEnabled: true,
    contentInset: 'automatic',
  },

  plugins: {
    SplashScreen: {
      // La oculta la propia app cuando Angular ya ha pintado (ver `app.component`).
      // Con `launchAutoHide` se vería un parpadeo en blanco entre medias.
      launchAutoHide: false,
      backgroundColor: '#08258B',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      // El icono y el sonido los resuelve Android desde los recursos nativos.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
