import { LOCALE_ID, Provider, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEn from '@angular/common/locales/en';
import localeDe from '@angular/common/locales/de';
import localeFr from '@angular/common/locales/fr';
import localeIt from '@angular/common/locales/it';
import localePt from '@angular/common/locales/pt';
import localePl from '@angular/common/locales/pl';
import localeNl from '@angular/common/locales/nl';
import { I18nService } from './i18n.service';

/*
 * Datos de formato de los ocho idiomas. Sin registrarlos, `DatePipe` no sabe
 * escribir los meses ni los días en ese idioma y Angular lanza en tiempo de
 * ejecución.
 */
[localeEs, localeEn, localeDe, localeFr, localeIt, localePt, localePl, localeNl]
  .forEach((datos) => registerLocaleData(datos));

/**
 * Ata el `LOCALE_ID` de Angular al idioma elegido por el usuario.
 *
 * Hacía falta porque nadie lo configuraba y el valor por defecto de Angular es
 * `en-US`: los 47 sitios que usan `| date` escribían el mes en inglés ("2 Sep
 * 26") aunque la interfaz entera estuviera en español. El texto sí se traducía
 * —el diccionario cubre el 98%—, pero las fechas no, y era lo que hacía que la
 * pantalla pareciese a medio traducir.
 *
 * Los importes van por su cuenta (`core/moneda/importe.ts`) y siguen en formato
 * español a propósito: son euros con IVA español, no una cifra que deba
 * adaptarse a la región de quien mira.
 *
 * **Limitación conocida:** Angular resuelve `LOCALE_ID` una sola vez, al
 * arrancar. Cambiar de idioma sin recargar traduce los textos al momento, pero
 * las fechas ya pintadas conservan el idioma de carga hasta la siguiente
 * navegación completa. Corregirlo del todo exige un pipe de fecha propio que
 * lea la signal; se deja anotado y no se hace aquí para no tocar 47 plantillas.
 */
export const proveerLocaleAngular = (): Provider => ({
  provide: LOCALE_ID,
  useFactory: () => inject(I18nService).idioma(),
});
