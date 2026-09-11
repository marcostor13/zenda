import {
  describir, recortar, seoCategoria, seoFichaServicio, seoLugar, seoPortada, seoPrivada, titular,
} from './plantillas-seo';

describe('recortar', () => {
  it('debería dejar intacto el texto que ya cabe', () => {
    expect(recortar('Peluquería canina', 40)).toBe('Peluquería canina');
  });

  it('debería normalizar los espacios', () => {
    expect(recortar('  Peluquería   canina  ', 40)).toBe('Peluquería canina');
  });

  /** Cortar a lo bruto deja títulos como «Residencia El Enc», que parecen un error. */
  it('debería cortar por la última palabra entera', () => {
    expect(recortar('Residencia canina El Encinar de Madrid', 25)).toBe('Residencia canina El…');
  });

  it('debería cortar por carácter si la primera palabra ya no cabe', () => {
    expect(recortar('Supercalifragilisticoespialidoso', 10)).toBe('Supercali…');
  });

  it('nunca debería devolver más caracteres de los pedidos', () => {
    expect(recortar('Residencia canina El Encinar de Madrid', 25).length).toBeLessThanOrEqual(25);
  });
});

describe('titular', () => {
  it('debería añadir la marca al final', () => {
    expect(titular('Peluquería canina en Valencia')).toBe('Peluquería canina en Valencia · Doogking');
  });

  it('debería recortar dejando sitio para la marca', () => {
    const resultado = titular('Residencia canina con piscina, patio y cámaras en la sierra de Madrid');

    expect(resultado.endsWith(' · Doogking')).toBe(true);
    expect(resultado.length).toBeLessThanOrEqual(60);
  });
});

describe('describir', () => {
  it('debería respetar una descripción de largo normal', () => {
    expect(describir('Residencias caninas verificadas.')).toBe('Residencias caninas verificadas.');
  });

  it('debería recortar a la longitud que Google enseña', () => {
    expect(describir('palabra '.repeat(60)).length).toBeLessThanOrEqual(158);
  });
});

describe('seoPortada', () => {
  it('debería llevar la marca en el título y ser canónica de la raíz', () => {
    const seo = seoPortada();

    expect(seo.titulo).toContain('Doogking');
    expect(seo.canonica).toBe('/');
  });
});

describe('seoCategoria', () => {
  const base = {
    label: 'Peluquería canina',
    descripcion: 'Baño, corte y deslanado con groomers profesionales.',
    ruta: '/peluqueria',
  };

  it('debería titular con la categoría cuando no hay ciudad', () => {
    expect(seoCategoria(base).titulo).toBe('Peluquería canina · Doogking');
  });

  it('debería meter la ciudad en el título, que es como se busca en Google', () => {
    expect(seoCategoria({ ...base, ciudad: 'Valencia' }).titulo)
      .toBe('Peluquería canina en Valencia · Doogking');
  });

  /**
   * Los filtros generan infinitas URL con el mismo contenido. Si cada una se
   * declarase canónica de sí misma, Google las trataría como páginas duplicadas.
   */
  it('debería apuntar la canónica al listado limpio aunque haya ciudad', () => {
    expect(seoCategoria({ ...base, ciudad: 'Valencia' }).canonica).toBe('/peluqueria');
  });
});

describe('seoFichaServicio', () => {
  const base = {
    titulo: 'Residencia El Encinar',
    descripcion: 'Suites individuales con patio y paseos diarios.',
    categoria: 'Alojamiento canino',
    ruta: '/alojamiento/abc',
    publicado: true,
  };

  it('debería situar la ficha en su ciudad', () => {
    expect(seoFichaServicio({ ...base, ciudad: 'Madrid' }).titulo)
      .toBe('Residencia El Encinar en Madrid · Doogking');
  });

  it('debería añadir el precio a la descripción cuando lo hay', () => {
    expect(seoFichaServicio({ ...base, precioDesde: 24.5 }).descripcion).toContain('Desde 25 €.');
  });

  it('debería usar la foto de la ficha como vista previa', () => {
    const seo = seoFichaServicio({ ...base, imagen: '/media/patio.jpg', ciudad: 'Madrid' });

    expect(seo.imagen).toBe('/media/patio.jpg');
    expect(seo.imagenAlt).toBe('Residencia El Encinar en Madrid');
  });

  /** Una ficha pausada se abre por enlace directo, pero no debe entrar en Google. */
  it('debería pedir que no se indexe una ficha sin publicar', () => {
    expect(seoFichaServicio({ ...base, publicado: false }).indexable).toBe(false);
  });

  it('debería indexar una ficha publicada', () => {
    expect(seoFichaServicio(base).indexable).toBe(true);
  });
});

describe('seoLugar', () => {
  const base = {
    nombre: 'Río Júcar',
    descripcion: 'Tramo del río con acceso libre para perros.',
    municipio: 'Riola',
    provincia: 'Valencia',
    ruta: '/explora/rio-jucar-riola',
  };

  it('debería situar el lugar en su municipio y provincia', () => {
    expect(seoLugar(base).titulo).toBe('Río Júcar, Riola, Valencia · Doogking');
  });

  it('debería describir el lugar aunque no tenga descripción propia', () => {
    expect(seoLugar({ ...base, descripcion: '' }).descripcion)
      .toBe('Río Júcar: sitio para ir con tu perro en Riola, Valencia.');
  });

  it('debería marcarse como contenido editorial', () => {
    expect(seoLugar(base).tipo).toBe('article');
  });

  it('debería describir el sitio en el texto alternativo de la imagen', () => {
    expect(seoLugar(base).imagenAlt).toBe('Río Júcar, Riola, Valencia');
  });
});

describe('seoPrivada', () => {
  it('debería pedir que no se indexe', () => {
    expect(seoPrivada('Mis reservas').indexable).toBe(false);
  });

  it('debería usar el título como descripción si no se da ninguna', () => {
    expect(seoPrivada('Mis reservas').descripcion).toBe('Mis reservas');
  });
});
