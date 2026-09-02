import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import type { ParametrosTraduccion } from './diccionario';

/**
 * `{{ 'Mis reservas' | t }}` — traducción en plantilla. La clave es el propio
 * texto español, así que la plantilla se sigue leyendo en castellano y una
 * cadena sin traducir sale tal cual.
 *
 * Impuro a propósito: un pipe puro cachea por identidad del argumento, así que
 * al cambiar de idioma seguiría devolviendo la traducción anterior (el texto de
 * entrada no ha cambiado). Al ser impuro se reevalúa dentro del contexto
 * reactivo de la plantilla, donde `t()` lee la signal `idioma()`: el componente
 * queda suscrito y Angular lo repinta al cambiar de idioma **incluso con
 * `OnPush`**.
 *
 * El coste es un acceso a un objeto por cadena visible, y sólo cuando el
 * componente entra en detección de cambios.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TraducirPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  /** @param params valores para las marcas `{nombre}` del texto. */
  transform(textoEs: string, params?: ParametrosTraduccion | null): string {
    return this.i18n.t(textoEs, params);
  }
}
