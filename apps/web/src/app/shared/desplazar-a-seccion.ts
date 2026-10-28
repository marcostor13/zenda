/**
 * Tiempo tras el que se comprueba si el desplazamiento suave llegó a su sitio.
 * Algo más de lo que dura la animación del navegador en una ficha larga.
 */
const MS_COMPROBACION = 700;

/** Por debajo de esto el desvío no se nota y corregirlo sólo daría un tirón. */
const TOLERANCIA_PX = 8;

/**
 * Lleva la ventana hasta la sección con ese `id`, dejando libre lo que ocupa la
 * barra de navegación (el `scroll-margin-top` global de los `[id]`).
 *
 * `scrollIntoView` suave se quedaba corto en móvil: el destino se calcula al
 * empezar, y durante el recorrido terminan de cargar fotos de más arriba o se
 * esconde la barra de direcciones del navegador, que mueven la sección. Aquí
 * se recalcula al acabar y, si quedó lejos, se completa el salto.
 *
 * Devuelve `false` si la sección no existe (o no hay ventana, en el servidor).
 */
export function desplazarASeccion(id: string, documento: Document = document): boolean {
  const ventana = documento.defaultView;
  const seccion = documento.getElementById(id);
  if (!ventana || !seccion) return false;

  const destino = (): number => {
    const margen = parseFloat(ventana.getComputedStyle(seccion).scrollMarginTop) || 0;
    return Math.max(0, seccion.getBoundingClientRect().top + ventana.scrollY - margen);
  };

  ventana.scrollTo({ top: destino(), behavior: 'smooth' });
  ventana.setTimeout(() => {
    const final = destino();
    if (Math.abs(ventana.scrollY - final) > TOLERANCIA_PX) ventana.scrollTo({ top: final });
  }, MS_COMPROBACION);
  return true;
}
