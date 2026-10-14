import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * Explica por qué un formulario con fotos no deja avanzar.
 *
 * `rs-image-upload` invalida su control mientras una foto sube o si falló
 * (`subidaEnCurso` / `subidaFallida`). Eso es correcto, pero el formulario sólo
 * veía «inválido» y se quedaba quieto al pulsar Continuar: en el móvil, con la
 * subida lenta o una foto rechazada dentro de una suite, el comercio no sabía
 * qué le impedía seguir.
 *
 * Devuelve el mensaje que hay que enseñar, o `null` si las fotos no son el
 * problema y lo que falla es otro campo.
 */
export function motivoBloqueoPorFotos(control: AbstractControl): string | null {
  // La que falló va primero: esperar no la arregla, hay que hacer algo.
  if (tieneError(control, 'subidaFallida')) {
    return 'Hay una foto que no se ha subido (marcada en rojo). Debajo verás el motivo: pulsa «Reintentar» o quítala con la ✕ para poder continuar.';
  }
  if (tieneError(control, 'subidaEnCurso')) {
    return 'Todavía se están subiendo fotos. Espera unos segundos a que terminen y vuelve a pulsar el botón.';
  }
  return null;
}

/** ¿Este control, o alguno de los que cuelgan de él, tiene el error? */
function tieneError(control: AbstractControl, error: string): boolean {
  if (control.hasError(error)) return true;
  if (!(control instanceof FormGroup) && !(control instanceof FormArray)) return false;

  const hijos: AbstractControl[] = Object.values(control.controls);
  return hijos.some((hijo) => tieneError(hijo, error));
}
