import type { Config } from 'jest';

/**
 * Configuración de las pruebas E2E del API.
 *
 * Separada de la unitaria (`apps/api/jest.config.ts`) por tres motivos:
 *  - Se ejecutan en serie (`maxWorkers: 1`): cada suite levanta su propia Mongo
 *    en memoria y el AppModule entero, y paralelizarlo satura la máquina.
 *  - Necesitan mucho más tiempo por prueba que un unitario.
 *  - No aportan a la métrica de cobertura unitaria: miden otra cosa (que el
 *    sistema ensamblado responde), así que no deben mezclarse en el mismo
 *    informe ni disparar sus umbrales.
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: ['node_modules[\\\\/](?!(.*[\\\\/])?nanoid[\\\\/])'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^shared$': '<rootDir>/../../libs/shared/src',
  },
  // Descargar Mongo la primera vez y arrancar el AppModule no cabe en los 5 s de serie.
  testTimeout: 120_000,
  maxWorkers: 1,
  // Evita que un handle abierto (conexión, timer) deje el proceso colgado en CI.
  forceExit: true,
  detectOpenHandles: true,
};

export default config;
