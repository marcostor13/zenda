import { lugar, migasDePan, negocioLocal, organizacion, sitioWeb } from './json-ld';

describe('organizacion', () => {
  it('debería declarar la marca con su logo y sus redes', () => {
    const documento = organizacion({
      url: 'https://doogking.com',
      logo: 'https://doogking.com/images/logo.svg',
      redes: ['https://instagram.com/doogking'],
    }) as Record<string, unknown>;

    expect(documento['@type']).toBe('Organization');
    expect(documento['name']).toBe('Doogking');
    expect(documento['sameAs']).toEqual(['https://instagram.com/doogking']);
  });
});

describe('sitioWeb', () => {
  it('debería declarar el buscador para que Google lo pueda enseñar', () => {
    const documento = sitioWeb('https://doogking.com') as Record<string, any>;

    expect(documento['potentialAction']['@type']).toBe('SearchAction');
    expect(documento['potentialAction']['target']['urlTemplate'])
      .toBe('https://doogking.com/buscador?q={search_term_string}');
  });
});

describe('negocioLocal', () => {
  const base = {
    nombre: 'Residencia El Encinar',
    descripcion: 'Suites con patio.',
    url: 'https://doogking.com/alojamiento/abc',
    imagenes: ['https://doogking.com/media/a.jpg'],
  };

  it('debería declarar el negocio con su nombre e imágenes', () => {
    const documento = negocioLocal(base) as Record<string, unknown>;

    expect(documento['@type']).toBe('LocalBusiness');
    expect(documento['image']).toEqual(['https://doogking.com/media/a.jpg']);
  });

  it('debería componer la dirección postal cuando hay ciudad', () => {
    const documento = negocioLocal({ ...base, ciudad: 'Madrid', provincia: 'Madrid' }) as Record<string, any>;

    expect(documento['address']['addressLocality']).toBe('Madrid');
    expect(documento['address']['addressCountry']).toBe('ES');
  });

  it('debería omitir la dirección si no hay ni ciudad ni calle', () => {
    expect((negocioLocal(base) as Record<string, unknown>)['address']).toBeUndefined();
  });

  it('debería omitir las claves de dirección sin valor', () => {
    const documento = negocioLocal({ ...base, ciudad: 'Madrid' }) as Record<string, any>;

    expect('streetAddress' in documento['address']).toBe(false);
  });

  it('debería declarar las coordenadas cuando las hay', () => {
    const documento = negocioLocal({ ...base, coordenadas: { lat: 40.4, lng: -3.7 } }) as Record<string, any>;

    expect(documento['geo']).toEqual({ '@type': 'GeoCoordinates', latitude: 40.4, longitude: -3.7 });
  });

  it('debería declarar la valoración cuando hay reseñas', () => {
    const documento = negocioLocal({ ...base, valoracion: { media: 4.67, total: 12 } }) as Record<string, any>;

    expect(documento['aggregateRating']['ratingValue']).toBe(4.7);
    expect(documento['aggregateRating']['reviewCount']).toBe(12);
  });

  /**
   * Un `aggregateRating` con cero reseñas es un dato estructurado inválido y
   * Google lo marca como error en Search Console.
   */
  it('no debería declarar valoración si no hay ninguna reseña', () => {
    const documento = negocioLocal({ ...base, valoracion: { media: 0, total: 0 } }) as Record<string, unknown>;

    expect(documento['aggregateRating']).toBeUndefined();
  });

  /**
   * El importe pasa por el formateador comun de la plataforma, que separa la
   * cifra del simbolo con un espacio duro para que no se parta de linea.
   */
  it('debería declarar el precio de partida redondeado y en euros', () => {
    const documento = negocioLocal({ ...base, precioDesde: 24.4 }) as Record<string, unknown>;

    expect(documento['priceRange']).toBe('desde 24 €');
  });
});

describe('lugar', () => {
  it('debería declararse como sitio, no como negocio', () => {
    const documento = lugar({
      nombre: 'Río Júcar',
      descripcion: 'Tramo con acceso libre para perros.',
      url: 'https://doogking.com/explora/rio-jucar-riola',
      imagenes: [],
      municipio: 'Riola',
      provincia: 'Valencia',
    }) as Record<string, any>;

    expect(documento['@type']).toBe('Place');
    expect(documento['address']['addressLocality']).toBe('Riola');
  });
});

describe('migasDePan', () => {
  it('debería numerar las migas desde uno', () => {
    const documento = migasDePan([
      { nombre: 'Inicio', url: 'https://doogking.com/' },
      { nombre: 'Alojamiento', url: 'https://doogking.com/alojamiento' },
    ]) as Record<string, any>;

    expect(documento['itemListElement'][0]['position']).toBe(1);
    expect(documento['itemListElement'][1]['name']).toBe('Alojamiento');
  });
});
