import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
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
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/environments/**',
    '!src/**/*.routes.ts',
  ],
  coverageDirectory: 'coverage',
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
