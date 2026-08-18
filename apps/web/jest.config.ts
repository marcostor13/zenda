import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  /*
   * Mismo motivo que en el API: un worker por CPU (aquí 19) con jsdom + el
   * compilador de Angular en cada uno satura la memoria del equipo y vuelve la
   * suite lenta e intermitente. Con la mitad va más rápida, no más lenta.
   */
  maxWorkers: '50%',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  /*
   * Los paquetes de Angular (p.ej. `@angular/common/locales/es`) y los `.mjs`
   * son ESM y hay que transformarlos. Bun no aplana node_modules como npm:
   * instala en `node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>/`, así que el
   * patrón acepta cualquier prefijo antes del segmento del paquete y ambos
   * separadores de ruta (Windows y CI Linux).
   */
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!(.*[\\\\/])?(@angular[\\\\/]|@stripe[\\\\/]|.*\\.mjs$))',
  ],
  moduleNameMapper: {
    '^shared$': '<rootDir>/../../libs/shared/src',
  },
  /*
   * `e2e/` es de Playwright, no de Jest. Sus ficheros también se llaman
   * `*.spec.ts`, así que sin esto Jest los descubre, intenta ejecutarlos y la
   * suite entera falla al importar `@playwright/test` (que no corre bajo jsdom).
   */
  testPathIgnorePatterns: ['<rootDir>/e2e/', '/node_modules/'],
  /*
   * Se excluyen, por no contener lógica verificable: los barriles de
   * re-exportación (`index.ts`, p.ej. `shared/index.ts`, 59 sentencias que solo
   * reexportan) y los ficheros de configuración declarativa. Todo lo que tenga
   * comportamiento —componentes, servicios, guards, directivas, pipes— sí entra.
   */
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/environments/**',
    '!src/**/*.routes.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  /*
   * `json-summary` no está entre los reporters por defecto de Jest, así que
   * `coverage/coverage-summary.json` no se regeneraba y quedaba congelado con
   * datos viejos. Se añade explícitamente, manteniendo los de serie.
   */
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  /*
   * El objetivo de CLAUDE.md §20, alcanzado el 2026-08-18. El suelo anterior
   * (80/70/74/80) iba por detrás de la cobertura real en ramas y funciones.
   */
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};

export default config;
