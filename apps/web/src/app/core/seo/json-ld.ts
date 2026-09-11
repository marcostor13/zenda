/**
 * Datos estructurados (schema.org) en JSON-LD.
 *
 * Es lo que permite a Google enseñar en los resultados la valoración con
 * estrellas, el precio, la dirección o las migas de pan, en vez de un enlace
 * azul pelado. Sin esto, una ficha con 40 reseñas se ve igual que una sin
 * ninguna.
 *
 * Todo son funciones puras: reciben datos y devuelven un objeto. El servicio de
 * SEO es quien lo pinta. Así se pueden probar sin DOM y sin inyector.
 *
 * **Regla que no se puede saltar:** aquí sólo entra información que el visitante
 * ve en la propia página. Declarar una valoración que no está escrita en la
 * ficha es motivo de penalización manual por parte de Google, no un matiz.
 */

import { formatearImporte } from '../moneda/importe';

const CONTEXTO = 'https://schema.org';

export interface DatosOrganizacion {
  readonly url: string;
  readonly logo: string;
  readonly redes: readonly string[];
}

/** La empresa. Va en la portada y es lo que alimenta el panel de marca de Google. */
export function organizacion(datos: DatosOrganizacion): object {
  return {
    '@context': CONTEXTO,
    '@type': 'Organization',
    name: 'Doogking',
    description: 'Marketplace de servicios para perros: alojamiento, veterinaria, '
      + 'peluquería, transporte, adiestramiento, seguros y servicios funerarios.',
    url: datos.url,
    logo: datos.logo,
    sameAs: [...datos.redes],
  };
}

/**
 * El sitio y su buscador.
 *
 * `SearchAction` es lo que permite que Google enseñe una caja de búsqueda de
 * Doogking dentro de su propio resultado. `{search_term_string}` es un marcador
 * literal de schema.org, no una plantilla nuestra: Google lo sustituye.
 */
export function sitioWeb(url: string): object {
  return {
    '@context': CONTEXTO,
    '@type': 'WebSite',
    name: 'Doogking',
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${url}/buscador?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface DatosNegocio {
  readonly nombre: string;
  readonly descripcion: string;
  readonly url: string;
  readonly imagenes: readonly string[];
  readonly ciudad?: string;
  readonly direccion?: string;
  readonly provincia?: string;
  readonly telefono?: string;
  readonly coordenadas?: { readonly lat: number; readonly lng: number };
  readonly precioDesde?: number;
  readonly valoracion?: { readonly media: number; readonly total: number };
}

/**
 * Ficha de un comercio. `LocalBusiness` es el tipo correcto para un negocio con
 * dirección física; los buscadores lo usan para el mapa y el horario.
 */
export function negocioLocal(datos: DatosNegocio): object {
  const documento: Record<string, unknown> = {
    '@context': CONTEXTO,
    '@type': 'LocalBusiness',
    name: datos.nombre,
    description: datos.descripcion,
    url: datos.url,
    image: [...datos.imagenes],
  };

  if (datos.ciudad || datos.direccion) {
    documento['address'] = sinVacios({
      '@type': 'PostalAddress',
      streetAddress: datos.direccion,
      addressLocality: datos.ciudad,
      addressRegion: datos.provincia,
      addressCountry: 'ES',
    });
  }

  if (datos.telefono) documento['telephone'] = datos.telefono;

  if (datos.coordenadas) {
    documento['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: datos.coordenadas.lat,
      longitude: datos.coordenadas.lng,
    };
  }

  if (datos.precioDesde !== undefined) {
    // En euros siempre: lo lee Google, no el visitante, y la moneda de la
    // plataforma es el euro con independencia de cómo se vean los precios.
    documento['priceRange'] = `desde ${formatearImporte(datos.precioDesde, '1.0-0')}`;
  }

  /*
   * La valoración sólo se declara si hay reseñas de verdad. Un `aggregateRating`
   * con `reviewCount: 0` es un dato estructurado inválido y Google lo marca como
   * error en Search Console.
   */
  if (datos.valoracion && datos.valoracion.total > 0) {
    documento['aggregateRating'] = {
      '@type': 'AggregateRating',
      ratingValue: Number(datos.valoracion.media.toFixed(1)),
      reviewCount: datos.valoracion.total,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return documento;
}

export interface DatosLugarJsonLd {
  readonly nombre: string;
  readonly descripcion: string;
  readonly url: string;
  readonly imagenes: readonly string[];
  readonly municipio?: string;
  readonly provincia?: string;
  readonly coordenadas?: { readonly lat: number; readonly lng: number };
}

/** Un lugar de *Explora*: no es un negocio, es un sitio al que ir. */
export function lugar(datos: DatosLugarJsonLd): object {
  const documento: Record<string, unknown> = {
    '@context': CONTEXTO,
    '@type': 'Place',
    name: datos.nombre,
    description: datos.descripcion,
    url: datos.url,
    image: [...datos.imagenes],
  };

  if (datos.municipio) {
    documento['address'] = sinVacios({
      '@type': 'PostalAddress',
      addressLocality: datos.municipio,
      addressRegion: datos.provincia,
      addressCountry: 'ES',
    });
  }

  if (datos.coordenadas) {
    documento['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: datos.coordenadas.lat,
      longitude: datos.coordenadas.lng,
    };
  }

  return documento;
}

export interface Miga {
  readonly nombre: string;
  readonly url: string;
}

/**
 * Migas de pan. Lo que convierte el `doogking.com › alojamiento › madrid` de
 * debajo del título en Google, en vez de la URL cruda.
 */
export function migasDePan(migas: readonly Miga[]): object {
  return {
    '@context': CONTEXTO,
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((miga, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: miga.nombre,
      item: miga.url,
    })),
  };
}

/** Quita las claves sin valor: schema.org prefiere ausencia a cadena vacía. */
function sinVacios(objeto: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, valor]) => valor !== undefined && valor !== ''),
  );
}
