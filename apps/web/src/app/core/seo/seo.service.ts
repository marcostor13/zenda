import { DOCUMENT, Injectable, REQUEST, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { esNavegador } from '../plataforma/almacen';

/** Lo que necesita una página para presentarse a Google y a las redes sociales. */
export interface MetadatosSeo {
  /** Lo que se ve en la pestaña y como enlace azul en Google. Hasta 60 caracteres. */
  readonly titulo: string;
  /** El párrafo bajo el enlace en Google. Entre 140 y 160 caracteres. */
  readonly descripcion: string;
  /** Ruta absoluta desde la raíz (`/alojamiento/madrid`). Sin dominio. */
  readonly canonica?: string;
  /** URL absoluta o ruta de la imagen de la vista previa al compartir. */
  readonly imagen?: string;
  /** Texto alternativo de esa imagen. */
  readonly imagenAlt?: string;
  /** `website` para páginas de la plataforma, `article` para contenido editorial. */
  readonly tipo?: 'website' | 'article' | 'profile';
  /** `false` pide a los buscadores que no indexen la página. */
  readonly indexable?: boolean;
}

/** Imagen de la marca cuando la página no tiene una propia. */
export const IMAGEN_SOCIAL_POR_DEFECTO = '/images/og-doogking.png';

const ETIQUETAS_GESTIONADAS = [
  'description', 'robots',
  'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:type',
  'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt',
] as const;

/**
 * Escribe el título, la descripción, la URL canónica, las etiquetas de vista
 * previa social y los datos estructurados de cada página.
 *
 * Por qué existe: antes de esto toda la web compartía el `<title>` y la
 * `<meta name="description">` de `index.html`. Google veía ocho categorías y
 * cientos de fichas como páginas casi idénticas, y al compartir una residencia
 * canina por WhatsApp salía la descripción genérica de la portada.
 *
 * Funciona igual en el navegador y en el render de servidor —es en el servidor
 * donde de verdad importa, porque los rastreadores de las redes sociales no
 * ejecutan JavaScript—, así que ningún método asume que exista `window`.
 *
 * **Cada página pública debe llamar a `aplicar()`.** Lo que no se sobrescribe se
 * queda con lo de la página anterior, así que el servicio borra siempre las
 * etiquetas que gestiona antes de escribir las nuevas: sin eso, navegar de una
 * ficha a otra dejaba la imagen de la anterior.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly documento = inject(DOCUMENT);
  private readonly peticion = inject(REQUEST, { optional: true });
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  /** Escribe de una vez todas las etiquetas de la página. */
  aplicar(metadatos: MetadatosSeo): void {
    this.limpiar();

    const {
      titulo, descripcion, canonica, imagen, imagenAlt,
      tipo = 'website', indexable = true,
    } = metadatos;

    const urlCanonica = canonica ? this.absoluta(canonica) : this.urlActual();
    const urlImagen = this.absoluta(imagen ?? IMAGEN_SOCIAL_POR_DEFECTO);

    this.title.setTitle(titulo);
    this.meta.updateTag({ name: 'description', content: descripcion });

    /*
     * `noindex` no basta con `follow` implícito: se escribe entero para que el
     * rastreador no tenga que suponer nada. Las páginas privadas llevan además
     * `noarchive` para que no quede copia en caché de un panel de gestión.
     */
    this.meta.updateTag({
      name: 'robots',
      content: indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive',
    });

    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descripcion });
    this.meta.updateTag({ property: 'og:type', content: tipo });
    this.meta.updateTag({ property: 'og:url', content: urlCanonica });
    this.meta.updateTag({ property: 'og:image', content: urlImagen });
    this.meta.updateTag({ property: 'og:image:alt', content: imagenAlt ?? titulo });

    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: descripcion });
    this.meta.updateTag({ name: 'twitter:image', content: urlImagen });
    this.meta.updateTag({ name: 'twitter:image:alt', content: imagenAlt ?? titulo });

    this.canonica(urlCanonica);
  }

  /**
   * Datos estructurados de la página (JSON-LD).
   *
   * Es lo que permite a Google enseñar la valoración con estrellas, el precio o
   * la dirección directamente en los resultados. Se sustituye entero en cada
   * navegación: dos bloques de tipos distintos conviviendo confunden al
   * validador y acaban en un aviso de "datos estructurados no válidos".
   */
  datosEstructurados(documentos: readonly object[]): void {
    for (const viejo of Array.from(this.documento.querySelectorAll('script[data-dk-jsonld]'))) {
      viejo.remove();
    }

    for (const documento of documentos) {
      const script = this.documento.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-dk-jsonld', '');
      script.textContent = JSON.stringify(documento);
      this.documento.head.appendChild(script);
    }
  }

  /**
   * Marca la respuesta como 404.
   *
   * Sólo hace algo en el servidor, que es donde existe un código de estado que
   * dar. En el navegador no hay respuesta HTTP que cambiar: la página 404 se ve
   * igual, pero el estado ya lo fijó el servidor en la primera carga.
   */
  noEncontrado(): void {
    if (this.respuesta) this.respuesta.status = 404;
  }

  /**
   * El dominio público desde el que se sirve la web, sin barra final.
   *
   * Lo necesitan los datos estructurados, que exigen URL absolutas. Es lo mismo
   * que usan las etiquetas `og:`, así que sale de la misma fuente: el `Host` de
   * la petición en servidor, la barra de direcciones en el navegador.
   */
  origenPublico(): string {
    return this.origen();
  }

  /** Deja el `<link rel="canonical">` apuntando a `url`, creándolo si no existe. */
  private canonica(url: string): void {
    const existente = this.documento.head.querySelector('link[rel="canonical"]');
    const enlace = existente ?? this.documento.createElement('link');

    enlace.setAttribute('rel', 'canonical');
    enlace.setAttribute('href', url);
    if (!existente) this.documento.head.appendChild(enlace);
  }

  private limpiar(): void {
    for (const etiqueta of ETIQUETAS_GESTIONADAS) {
      this.meta.removeTag(etiqueta.startsWith('og:') ? `property='${etiqueta}'` : `name='${etiqueta}'`);
    }
  }

  /**
   * Convierte una ruta en URL absoluta. Las etiquetas `og:` **exigen** URL
   * absoluta: Facebook y WhatsApp descartan en silencio una imagen declarada
   * como `/images/foo.png`, y el resultado es una vista previa sin foto.
   */
  private absoluta(rutaOUrl: string): string {
    if (/^https?:\/\//i.test(rutaOUrl)) return rutaOUrl;

    const base = this.origen();
    return `${base}${rutaOUrl.startsWith('/') ? '' : '/'}${rutaOUrl}`;
  }

  /** El dominio con el que ha llegado la visita, sin barra final. */
  private origen(): string {
    if (esNavegador()) return this.documento.location.origin;
    if (this.peticion) return new URL(this.peticion.url).origin;
    return '';
  }

  private urlActual(): string {
    if (esNavegador()) {
      const { origin, pathname } = this.documento.location;
      return `${origin}${pathname}`;
    }

    if (this.peticion) {
      const url = new URL(this.peticion.url);
      return `${url.origin}${url.pathname}`;
    }

    return '';
  }
}
