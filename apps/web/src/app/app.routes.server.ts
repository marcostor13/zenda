import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Cómo se renderiza cada ruta en el servidor.
 *
 * Por qué hace falta SSR en una web que ya funcionaba como SPA: los rastreadores
 * de WhatsApp, Facebook, LinkedIn y X **no ejecutan JavaScript**. Leen el HTML
 * tal y como llega y se quedan con lo que encuentran. Mientras la web sirvió un
 * único `index.html` para todo, compartir la ficha de una residencia canina
 * enseñaba el título y la descripción genéricos de la portada, daba igual lo que
 * el `SeoService` escribiera después en el navegador. Lo mismo con el 404: sin
 * servidor, cualquier dirección inventada devolvía un 200 con la portada dentro.
 *
 * El reparto es deliberado:
 *
 * - `Prerender` para lo que no cambia entre visitas (portada, categorías,
 *   legales): se genera una vez al construir y se sirve como fichero estático,
 *   con el mismo coste que tenía la SPA.
 * - `Server` para lo que depende de un dato de la base de datos (fichas de
 *   servicio, fichas de Explora): es justo lo que se comparte por mensajería y
 *   lo que tiene que llevar su propio título, su descripción y su imagen.
 * - `Client` para todo lo que vive detrás de la sesión (paneles, perfil,
 *   reservas, carrito). Renderizarlo en el servidor no aporta nada —no se
 *   indexa ni se comparte— y obligaría a resolver la sesión del usuario en el
 *   render, que es justo el tipo de complejidad que no queremos.
 */
export const serverRoutes: ServerRoute[] = [
  // --- Detrás de la sesión: sólo cliente ---
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'comercio', renderMode: RenderMode.Client },
  { path: 'comercio/**', renderMode: RenderMode.Client },
  { path: 'perfil', renderMode: RenderMode.Client },
  { path: 'perfil/**', renderMode: RenderMode.Client },
  { path: 'perros', renderMode: RenderMode.Client },
  { path: 'perros/**', renderMode: RenderMode.Client },
  { path: 'reservas', renderMode: RenderMode.Client },
  { path: 'reservas/**', renderMode: RenderMode.Client },
  { path: 'favoritos', renderMode: RenderMode.Client },
  { path: 'auth', renderMode: RenderMode.Client },
  { path: 'auth/**', renderMode: RenderMode.Client },
  // El enlace del correo de valoración: es de un solo uso y lleva un token en
  // la URL, así que ni se indexa ni se comparte.
  { path: 'valorar/:token', renderMode: RenderMode.Client },

  /*
   * Todo lo demás se renderiza en el servidor a cada petición.
   *
   * No se prerenderizan las rutas públicas fijas aunque podrían serlo: el guard
   * "muy pronto" decide con una clave de `localStorage` si la web está abierta,
   * y una página congelada en tiempo de construcción no puede saberlo. Cuando
   * la web se abra al público de forma definitiva y el guard desaparezca, pasar
   * la portada, las categorías y los legales a `RenderMode.Prerender` es un
   * cambio de una línea por ruta.
   */
  { path: '**', renderMode: RenderMode.Server },
];
