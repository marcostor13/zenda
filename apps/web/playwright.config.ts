import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E de la web (Doogking).
 *
 * Estrategia: los E2E de la web ejercitan la aplicación real en un navegador
 * real, pero **interceptan las llamadas al API** (ver `e2e/fixtures/api.ts`).
 * Es deliberado:
 *
 *  - Las pruebas quedan herméticas y deterministas: no dependen de que haya un
 *    API levantado, ni de datos sembrados en Mongo, ni de la red.
 *  - El contrato del servidor se prueba por separado y de verdad en los E2E del
 *    API (`apps/api/test/`), con Nest real contra Mongo en memoria.
 *  - El flujo de pago no puede cerrarse de punta a punta sin Stripe real y sus
 *    webhooks, algo que no tiene sentido automatizar aquí.
 *
 * Entre las dos capas queda cubierto el recorrido completo sin pagar el precio
 * de un entorno integrado frágil.
 */
export default defineConfig({
  testDir: './e2e',
  // Un fallo en E2E suele ser un fallo real; no se enmascara con reintentos en local.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // El arranque en frío de Angular es lento; sin margen, el primer test falla por tiempo.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Doogking recibe mucho tráfico móvil: el layout se verifica también ahí.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    // `ng serve` compila todo el proyecto la primera vez: necesita margen amplio.
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
