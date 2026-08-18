import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
    '^.+\\.mjs$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  /*
   * nanoid v5 es ESM puro y hay que transformarlo. Bun no aplana node_modules
   * como npm: instala en `node_modules/.bun/nanoid@x.y.z/node_modules/nanoid/`,
   * así que el patrón acepta cualquier prefijo antes del segmento del paquete y
   * ambos separadores de ruta (Windows y CI Linux).
   */
  transformIgnorePatterns: ['node_modules[\\\\/](?!(.*[\\\\/])?nanoid[\\\\/])'],
  extensionsToTreatAsEsm: [],
  /*
   * `scripts/` queda fuera de la medición: son utilidades de línea de comandos
   * que se ejecutan a mano (sembrar datos, migrar, limpiar), nunca forman parte
   * del API servido y no tienen forma razonable de probarse en unitario. Contar
   * sus ~200 sentencias siempre a cero distorsionaba el porcentaje del código
   * que sí se sirve, que es lo que el umbral pretende vigilar.
   *
   * OJO con el patrón: la forma "!scripts/" + doble asterisco NO excluía nada
   * (los ficheros seguían en el informe, hundiendo el porcentaje ~2,5 puntos).
   * Los patrones negados se comparan contra la ruta completa, no contra la
   * relativa a `rootDir`, así que hay que anteponerles el comodín de directorio.
   *
   * Se excluyen además, por no contener lógica verificable:
   *  - `*.schema.ts`: decoradores de Mongoose, sin comportamiento propio.
   *  - `*.dto.ts`: clases de solo declaración; su validación real se ejercita
   *    al probar los controllers que las reciben.
   *  - `index.ts`: barriles de re-exportación.
   *  - conectores de calendario externos: su unitario solo probaría el mock;
   *    se cubren con tests de integración/contrato, no aquí.
   */
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/scripts/**',
    '!**/*.schema.ts',
    '!**/*.dto.ts',
    '!**/index.ts',
    '!**/agenda/*-calendar.connector.ts',
  ],
  coverageDirectory: '../coverage',
  /*
   * `json-summary` no está entre los reporters por defecto de Jest, así que
   * `coverage/coverage-summary.json` no se regeneraba: quedó congelado con datos
   * viejos y cualquiera que lo consultara leía una foto obsoleta. Se añade
   * explícitamente, manteniendo los de serie.
   */
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  testEnvironment: 'node',
  /*
   * Los decoradores de class-validator se evalúan al importar los DTOs de
   * `shared`. Un spec que los importe antes que nada de NestJS (que arrastra
   * reflect-metadata) reventaba con "Reflect.getMetadata is not a function".
   */
  setupFiles: ['reflect-metadata'],
  /*
   * La suite era intermitente: fallaba un `describe` distinto en cada ejecución
   * y siempre pasaba al correrlo aislado. La causa no era el código sino la
   * memoria: por defecto Jest lanza un worker por CPU menos una (aquí, 19), y
   * cada worker carga ts-jest, el grafo de NestJS y todos los schemas de
   * Mongoose. Con eso el equipo se va a swap y suites que tardan 5 s pasan de
   * los 130. Con la mitad de workers hay CPU de sobra y memoria suficiente.
   */
  maxWorkers: '50%',
  /*
   * Margen sobre los 5 s por defecto para que un pico puntual de carga no
   * convierta un test sano en un fallo. No enmascara nada: la suite unitaria no
   * hace E/S real, así que un test que de verdad se cuelgue sigue fallando.
   */
  testTimeout: 20_000,
  moduleNameMapper: {
    '^shared$': '<rootDir>/../../../libs/shared/src',
  },
  /*
   * El objetivo de CLAUDE.md §20. Se alcanzó el 2026-08-18; antes el suelo
   * estaba en 70/56/58/70, entre 16 y 19 puntos POR DEBAJO de la cobertura real,
   * así que no protegía de nada: se podían borrar cientos de tests sin que el
   * gate protestara.
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
