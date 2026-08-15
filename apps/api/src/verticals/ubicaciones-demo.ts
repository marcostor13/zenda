/**
 * Ubicaciones reales para los datos de demostración.
 *
 * Todos los seeders situaban sus listados en el mismo punto (el centro de
 * Madrid), así que en el mapa del buscador los pines se apilaban unos sobre
 * otros y parecía que no había oferta. Cada listado demo apunta ahora al barrio
 * que ya decía su nombre.
 *
 * Las coordenadas van en el orden de GeoJSON: **[lng, lat]**.
 */
export interface UbicacionDemo {
  readonly ciudad: string;
  readonly barrio: string;
  readonly direccion: string;
  readonly coordenadas: [number, number];
}

export const UBICACIONES_MADRID: Readonly<Record<string, UbicacionDemo>> = {
  malasana: {
    ciudad: 'Madrid', barrio: 'Malasaña',
    direccion: 'Calle del Espíritu Santo, 12',
    coordenadas: [-3.7031, 40.4249],
  },
  salamanca: {
    ciudad: 'Madrid', barrio: 'Salamanca',
    direccion: 'Calle de Velázquez, 45',
    coordenadas: [-3.6816, 40.4283],
  },
  chueca: {
    ciudad: 'Madrid', barrio: 'Chueca',
    direccion: 'Calle de Hortaleza, 63',
    coordenadas: [-3.6976, 40.4224],
  },
  chamberi: {
    ciudad: 'Madrid', barrio: 'Chamberí',
    direccion: 'Calle de Fuencarral, 128',
    coordenadas: [-3.7018, 40.4340],
  },
  retiro: {
    ciudad: 'Madrid', barrio: 'Retiro',
    direccion: 'Calle de Alcalá, 176',
    coordenadas: [-3.6759, 40.4223],
  },
  chamartin: {
    ciudad: 'Madrid', barrio: 'Chamartín',
    direccion: 'Calle de Bravo Murillo, 297',
    coordenadas: [-3.6939, 40.4653],
  },
  arganzuela: {
    ciudad: 'Madrid', barrio: 'Arganzuela',
    direccion: 'Paseo de las Delicias, 61',
    coordenadas: [-3.6939, 40.3975],
  },
  moncloa: {
    ciudad: 'Madrid', barrio: 'Moncloa-Aravaca',
    direccion: 'Avenida de la Memoria, 20',
    coordenadas: [-3.7300, 40.4390],
  },
  laLatina: {
    ciudad: 'Madrid', barrio: 'La Latina',
    direccion: 'Calle de Toledo, 88',
    coordenadas: [-3.7115, 40.4085],
  },
  tetuan: {
    ciudad: 'Madrid', barrio: 'Tetuán',
    direccion: 'Calle de Orense, 34',
    coordenadas: [-3.6935, 40.4560],
  },
  usera: {
    ciudad: 'Madrid', barrio: 'Usera',
    direccion: 'Calle de Marcelo Usera, 78',
    coordenadas: [-3.7060, 40.3820],
  },
  carabanchel: {
    ciudad: 'Madrid', barrio: 'Carabanchel',
    direccion: 'Calle del General Ricardos, 152',
    coordenadas: [-3.7280, 40.3860],
  },
  hortaleza: {
    ciudad: 'Madrid', barrio: 'Hortaleza',
    direccion: 'Calle de Mar de Cristal, 5',
    coordenadas: [-3.6480, 40.4720],
  },
  vallecas: {
    ciudad: 'Madrid', barrio: 'Puente de Vallecas',
    direccion: 'Avenida de la Albufera, 94',
    coordenadas: [-3.6580, 40.3900],
  },
  ciudadLineal: {
    ciudad: 'Madrid', barrio: 'Ciudad Lineal',
    direccion: 'Calle de Arturo Soria, 210',
    coordenadas: [-3.6480, 40.4480],
  },
  fuencarral: {
    ciudad: 'Madrid', barrio: 'Fuencarral-El Pardo',
    direccion: 'Avenida del Cardenal Herrera Oria, 250',
    coordenadas: [-3.7080, 40.4880],
  },
  villaverde: {
    ciudad: 'Madrid', barrio: 'Villaverde',
    direccion: 'Calle Real de Pinto, 32',
    coordenadas: [-3.6900, 40.3450],
  },
  barajas: {
    ciudad: 'Madrid', barrio: 'Barajas',
    direccion: 'Avenida de Logroño, 179',
    coordenadas: [-3.5810, 40.4740],
  },
};

/**
 * Punto de partida de cada vertical dentro del catálogo, para que dos listados
 * de categorías distintas no caigan en el mismo portal.
 */
export const DESPLAZAMIENTO_DEMO = {
  peluqueria: 0,
  adiestramiento: 3,
  alojamiento: 6,
  hoteles: 9,
  veterinaria: 12,
  transporte: 15,
} as const;

/**
 * Reparte las ubicaciones entre los listados de un seeder en el orden en que se
 * declaran. Vuelve a empezar si hay más listados que barrios: repetir barrio es
 * mejor que dejar un listado sin punto y fuera del mapa.
 */
export function ubicacionDemo(indice: number): UbicacionDemo {
  const barrios = Object.values(UBICACIONES_MADRID);
  return barrios[indice % barrios.length];
}

/** Los campos de ubicación tal y como los espera el documento `Servicio`. */
export function ubicacionServicio(indice: number): {
  ubicacion: { ciudad: string; geo: { type: 'Point'; coordinates: [number, number] } };
  direccion: string;
  barrio: string;
} {
  const lugar = ubicacionDemo(indice);
  return {
    ubicacion: { ciudad: lugar.ciudad, geo: { type: 'Point', coordinates: lugar.coordenadas } },
    direccion: `${lugar.direccion}, ${lugar.ciudad}`,
    barrio: lugar.barrio,
  };
}
