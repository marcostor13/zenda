import { Router } from '@angular/router';

/**
 * `true` si la ficha se abrió por una dirección que no es la suya (el id antiguo
 * u otra forma del slug) y hay una legible a la que llevarla.
 *
 * Sin slug no se redirige: la ficha aún no ha pasado por la migración y su id
 * es, por ahora, su única dirección.
 */
export function debeIrAlSlug(pedido: string | null | undefined, slug: string | null | undefined): boolean {
  return !!slug && !!pedido && pedido !== slug;
}

/**
 * Corrige la barra de direcciones a la URL legible sin dejar la antigua en el
 * historial (`replaceUrl`), conservando la consulta (fechas, mascota…).
 *
 * En el servidor esto no llega a ejecutarse para los enlaces por id: `server.ts`
 * responde antes con un 301. Cubre la navegación dentro de la aplicación, por
 * ejemplo un enlace viejo guardado en una reserva.
 *
 * La ruta de destino usa la misma configuración que la de origen, así que
 * Angular reutiliza el componente y la ficha no se vuelve a pedir.
 */
export function irAlSlug(router: Router, ruta: readonly unknown[]): void {
  void router.navigate([...ruta], { replaceUrl: true, queryParamsHandling: 'preserve' });
}
