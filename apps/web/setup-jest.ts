import 'reflect-metadata';
// Define `$localize`, que el compilador genera para las plantillas marcadas con
// `i18n`. Sin él, cualquier componente traducible revienta en los tests.
import '@angular/localize/init';
import 'jest-preset-angular/setup-jest';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

// Las plantillas formatean fechas con `| date:…:'es'`; sin estos datos el pipe
// lanza NG0701 en los tests aunque en la app funcione.
registerLocaleData(localeEs, 'es');

// jsdom no implementa IntersectionObserver; lo usan directivas como AnimateOnScroll.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver;
