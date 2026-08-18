import type { Config } from 'jest';

/**
 * `libs/shared` es sobre todo DTOs, enums y constantes —declaraciones sin
 * comportamiento—, así que sólo se mide lo que sí tiene lógica: las utilidades.
 * Los barriles de re-exportación quedan fuera por el mismo motivo.
 */
const config: Config = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  /*
   * Fuera de la medición por no tener comportamiento que probar: DTOs (sólo
   * declaraciones), enums, barriles de re-exportación y `constants.ts`, que es
   * una lista de valores literales.
   */
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.dto.ts',
    '!**/*.enum.ts',
    '!**/index.ts',
    '!**/constants.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['json', 'lcov', 'text', 'json-summary'],
  coverageThreshold: {
    global: { statements: 100, branches: 100, functions: 100, lines: 100 },
  },
};

export default config;
