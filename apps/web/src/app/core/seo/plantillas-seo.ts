import { formatearImporte } from '../moneda/importe';
import type { MetadatosSeo } from './seo.service';

/**
 * Cómo se construye el título y la descripción de cada familia de páginas.
 *
 * Vive aparte del `SeoService` a propósito: aquí no hay DOM ni inyección, sólo
 * funciones puras de datos a texto. Eso las hace probables una a una y, sobre
 * todo, deja el copy de SEO en **un solo sitio**; si estuviera repartido por las
 * vistas, cada categoría acabaría con su propia forma de titular y volveríamos a
 * la mezcla que encontró la auditoría.
 */

/** Se añade al final de cada título. Google corta sobre los 60 caracteres. */
const MARCA = 'Doogking';
const LARGO_TITULO = 60;
const LARGO_DESCRIPCION = 158;

/**
 * Recorta por la última palabra entera y cierra con «…».
 *
 * Cortar a lo bruto deja títulos como «Residencia canina El Enc», que en los
 * resultados de Google se lee como un error de la web.
 */
export function recortar(texto: string, maximo: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= maximo) return limpio;

  const cortado = limpio.slice(0, maximo - 1);
  const ultimoEspacio = cortado.lastIndexOf(' ');

  return `${(ultimoEspacio > maximo * 0.6 ? cortado.slice(0, ultimoEspacio) : cortado).trimEnd()}…`;
}

/** `Residencia El Encinar en Madrid · Doogking`, sin pasarse de largo. */
export function titular(texto: string): string {
  const sufijo = ` · ${MARCA}`;
  return `${recortar(texto, LARGO_TITULO - sufijo.length)}${sufijo}`;
}

/** Descripción del largo que Google enseña entera. */
export function describir(texto: string): string {
  return recortar(texto, LARGO_DESCRIPCION);
}

/** Portada. Es la única página cuyo título no lleva el sufijo de marca: ya es la marca. */
export function seoPortada(): MetadatosSeo {
  return {
    titulo: 'Doogking · Todo para tu rey, en un solo lugar',
    descripcion: describir(
      'Reserva alojamiento canino, veterinarios, peluquerías, transporte, adiestramiento y seguros '
      + 'para tu perro. Profesionales verificados en toda España, con precio cerrado.',
    ),
    canonica: '/',
  };
}

export interface DatosCategoria {
  readonly label: string;
  readonly descripcion: string;
  readonly ruta: string;
  /** Ciudad del filtro activo, si el usuario ha buscado en una. */
  readonly ciudad?: string;
}

/**
 * Listado de una categoría.
 *
 * Cuando hay ciudad se mete en el título: «Peluquería canina en Valencia» es lo
 * que la gente escribe en Google, no «Peluquería canina».
 */
export function seoCategoria(datos: DatosCategoria): MetadatosSeo {
  const conCiudad = datos.ciudad ? `${datos.label} en ${datos.ciudad}` : datos.label;

  return {
    titulo: titular(conCiudad),
    descripcion: describir(
      datos.ciudad
        ? `${datos.descripcion} Compara precios y disponibilidad en ${datos.ciudad}.`
        : datos.descripcion,
    ),
    // La canónica nunca lleva la ciudad: los filtros generan infinitas URL con
    // el mismo contenido, y todas deben apuntar al listado limpio.
    canonica: datos.ruta,
  };
}

export interface DatosFichaServicio {
  readonly titulo: string;
  readonly descripcion: string;
  readonly ciudad?: string;
  readonly categoria: string;
  readonly ruta: string;
  readonly imagen?: string;
  readonly precioDesde?: number;
  readonly publicado: boolean;
}

/**
 * Ficha de un servicio. Es la página que más se comparte por mensajería, así que
 * es donde más se nota tener imagen y descripción propias.
 */
export function seoFichaServicio(datos: DatosFichaServicio): MetadatosSeo {
  const dondeEsta = datos.ciudad ? `${datos.titulo} en ${datos.ciudad}` : datos.titulo;
  /*
   * Siempre en euros, nunca en la divisa que el visitante tenga elegida en la
   * cabecera: esta descripción la indexa Google desde el render de servidor,
   * donde no hay ninguna elección que respetar, y quedaría congelada en una
   * divisa que no es la de la plataforma.
   */
  const precio = datos.precioDesde
    ? ` Desde ${formatearImporte(datos.precioDesde, '1.0-0')}.`
    : '';

  return {
    titulo: titular(dondeEsta),
    descripcion: describir(`${datos.descripcion}${precio}`),
    canonica: datos.ruta,
    imagen: datos.imagen,
    imagenAlt: dondeEsta,
    // Una ficha pausada o en borrador sigue siendo accesible por enlace directo
    // —el comercio la revisa— pero no debe entrar en el índice de Google.
    indexable: datos.publicado,
  };
}

export interface DatosLugar {
  readonly nombre: string;
  readonly descripcion: string;
  readonly municipio?: string;
  readonly provincia?: string;
  readonly ruta: string;
  readonly imagen?: string;
}

/** Ficha de un lugar de *Explora*: playa, parque, ruta, restaurante pet-friendly. */
export function seoLugar(datos: DatosLugar): MetadatosSeo {
  const donde = [datos.municipio, datos.provincia].filter(Boolean).join(', ');
  const conLugar = donde ? `${datos.nombre}, ${donde}` : datos.nombre;

  return {
    titulo: titular(conLugar),
    descripcion: describir(
      datos.descripcion || `${datos.nombre}: sitio para ir con tu perro${donde ? ` en ${donde}` : ''}.`,
    ),
    canonica: datos.ruta,
    imagen: datos.imagen,
    // El alt describe el sitio, no la página: es lo que lee quien usa un lector
    // de pantalla y lo que aparece si la imagen no carga.
    imagenAlt: conLugar,
    tipo: 'article',
  };
}

/**
 * Páginas que existen pero no deben salir en Google: paneles, perfil, carrito,
 * resultados de búsqueda con filtros, la propia 404.
 */
export function seoPrivada(titulo: string, descripcion = ''): MetadatosSeo {
  return {
    titulo: titular(titulo),
    descripcion: describir(descripcion || titulo),
    indexable: false,
  };
}
