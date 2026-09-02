import { formatNumber, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { MONEDA_DEFAULT, MonedaSoportada } from 'shared';

/*
 * Los datos de `es` se registran aquí, al importar el módulo, y no en el
 * arranque de la aplicación: así el formato de los importes no depende de que
 * alguien se acuerde de configurarlo, y los tests que usan el pipe sueltos
 * también lo tienen. `registerLocaleData` es idempotente, así que repetirlo no
 * cuesta.
 */
registerLocaleData(localeEs);

/**
 * Los importes se formatean siempre en español, sin tocar el `LOCALE_ID` de la
 * aplicación: cambiarlo afectaría a cualquier número (cantidades, valoraciones,
 * kilómetros) y aquí sólo se trata del dinero.
 */
const LOCALE_IMPORTES = 'es';

/**
 * Espacio duro entre la cifra y el símbolo. Con un espacio normal, un importe
 * al final de una línea estrecha puede partirse y dejar el «€» solo en la
 * siguiente.
 */
const ESPACIO_DURO = ' ';

/** Lo que se pinta cuando no hay importe: `NaN €` no es una respuesta. */
const SIN_IMPORTE = '—';

/**
 * Divisa de visualización y la tasa con la que llegar a ella desde el euro.
 * La fija el selector de la cabecera; el cobro sigue siendo en euros.
 */
export interface ConversionImporte {
  readonly moneda: MonedaSoportada;
  readonly tasa: number;
}

/** ¿Esta conversión llega de verdad a otra divisa? */
export function conviertePorDeVeras(conversion?: ConversionImporte): conversion is ConversionImporte {
  return !!conversion
    && conversion.moneda !== MONEDA_DEFAULT
    && Number.isFinite(conversion.tasa)
    && conversion.tasa > 0;
}

/**
 * Convierte un importe en euros a la divisa de visualización.
 *
 * Ante una tasa que no sirve devuelve el importe original: mejor un precio
 * correcto en euros que uno inventado en otra divisa.
 */
export function convertirImporte(importeEur: number, conversion?: ConversionImporte): number {
  if (!conviertePorDeVeras(conversion)) return importeEur;
  return Math.round(importeEur * conversion.tasa * 100) / 100;
}

/** Número de decimales que pide `digitos` ('1.0-2' → máximo 2). */
function decimalesMaximos(digitos: string): number {
  const maximo = Number(digitos.split('-')[1]);
  return Number.isFinite(maximo) ? maximo : 2;
}

/**
 * Convierte un importe en su representación monetaria: `24 €`, `1.234,50 €`.
 *
 * Existe porque hasta ahora cada plantilla lo decidía por su cuenta: unas
 * escribían `€24`, otras `24 €` y otras `€ 24,00`, así que la misma pantalla
 * podía contradecirse consigo misma. El cliente pidió el símbolo detrás
 * (feedback 2026-08-20), que además es como se escribe en España.
 *
 * `null`, `undefined` y lo que no sea un número devuelven un guion: un precio
 * que todavía no ha llegado del API no debe pintarse como si valiera cero.
 *
 * @param conversion divisa de visualización elegida en la cabecera. Sin ella
 * —o siendo euros— el importe se pinta tal cual, que es el caso de la inmensa
 * mayoría de usuarios y de todas las pantallas de contabilidad.
 */
export function formatearImporte(
  valor: number | string | null | undefined,
  digitos = '1.0-2',
  conversion?: ConversionImporte,
): string {
  if (valor === null || valor === undefined || valor === '') return SIN_IMPORTE;

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return SIN_IMPORTE;

  if (!conviertePorDeVeras(conversion)) {
    return `${formatNumber(numero, LOCALE_IMPORTES, digitos)}${ESPACIO_DURO}€`;
  }

  /*
   * `narrowSymbol` para que el dólar salga como «$» y no como «US$», que es lo
   * que devuelve `es-ES` por defecto y ensucia una tarjeta de precio. Los
   * espacios que mete `Intl` se endurecen por el mismo motivo que en euros.
   */
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: conversion.moneda,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: decimalesMaximos(digitos),
  })
    .format(convertirImporte(numero, conversion))
    .replace(/\s/g, ESPACIO_DURO);
}
