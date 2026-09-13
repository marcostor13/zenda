import { DatePipe } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { desfaseIso } from 'shared';

type ValorFecha = Date | string | number | null | undefined;

/**
 * `| date` en la hora del comercio, se abra desde donde se abra.
 *
 * El `DatePipe` de Angular formatea con la zona del navegador: una cita a las
 * 10:00 en Madrid salía a las 03:00 para quien la miraba desde Lima, y una
 * estancia guardada como "el día 20" (medianoche UTC) salía el 19. Esta pipe
 * se llama igual y acepta los mismos argumentos, así que sustituye a la de
 * Angular sin tocar las plantillas; sólo cambia la zona por defecto, que pasa a
 * ser la de la plataforma con el desfase de **esa** fecha (verano o invierno).
 * Si una plantilla pasa su propia zona, se respeta.
 */
@Pipe({ name: 'date', standalone: true })
export class FechaPipe implements PipeTransform {
  private readonly angular = new DatePipe(inject(LOCALE_ID));

  transform(valor: ValorFecha, formato?: string, zona?: string, locale?: string): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    return this.angular.transform(valor, formato, zona || desfaseDe(valor), locale);
  }
}

function desfaseDe(valor: Date | string | number): string | undefined {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : desfaseIso(fecha);
}
