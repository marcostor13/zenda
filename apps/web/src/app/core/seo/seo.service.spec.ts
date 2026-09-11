import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let respuesta: ResponseInit;

  const meta = (selector: string): string | null =>
    document.head.querySelector(selector)?.getAttribute('content') ?? null;

  beforeEach(() => {
    respuesta = {};
    TestBed.configureTestingModule({
      providers: [{ provide: RESPONSE_INIT, useValue: respuesta }],
    });
    service = TestBed.inject(SeoService);
    document.head.querySelectorAll('link[rel="canonical"], script[data-dk-jsonld]')
      .forEach((n) => n.remove());
  });

  it('debería escribir título y descripción propios de la página', () => {
    service.aplicar({
      titulo: 'Residencias caninas en Madrid · Doogking',
      descripcion: 'Compara residencias caninas verificadas en Madrid.',
    });

    expect(document.title).toBe('Residencias caninas en Madrid · Doogking');
    expect(meta('meta[name="description"]')).toBe('Compara residencias caninas verificadas en Madrid.');
  });

  it('debería escribir las etiquetas Open Graph y de Twitter', () => {
    service.aplicar({
      titulo: 'Ficha',
      descripcion: 'Descripción de la ficha',
      imagen: '/media/foto.jpg',
      imagenAlt: 'Patio de la residencia',
      tipo: 'article',
    });

    expect(meta('meta[property="og:title"]')).toBe('Ficha');
    expect(meta('meta[property="og:description"]')).toBe('Descripción de la ficha');
    expect(meta('meta[property="og:type"]')).toBe('article');
    expect(meta('meta[property="og:image:alt"]')).toBe('Patio de la residencia');
    expect(meta('meta[name="twitter:title"]')).toBe('Ficha');
    expect(meta('meta[name="twitter:image:alt"]')).toBe('Patio de la residencia');
  });

  /**
   * Facebook y WhatsApp descartan en silencio una imagen declarada como ruta
   * relativa: la vista previa sale sin foto y no hay ningún error que lo diga.
   */
  it('debería convertir la imagen a URL absoluta', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D', imagen: '/media/foto.jpg' });

    expect(meta('meta[property="og:image"]')).toBe(`${location.origin}/media/foto.jpg`);
  });

  it('debería respetar una imagen que ya viene absoluta', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D', imagen: 'https://cdn.doogking.com/a.jpg' });

    expect(meta('meta[property="og:image"]')).toBe('https://cdn.doogking.com/a.jpg');
  });

  it('debería usar la imagen de marca cuando la página no aporta ninguna', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D' });

    expect(meta('meta[property="og:image"]')).toBe(`${location.origin}/images/og-doogking.png`);
  });

  it('debería marcar la página como indexable por defecto', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D' });

    expect(meta('meta[name="robots"]')).toBe('index, follow, max-image-preview:large');
  });

  it('debería pedir que no se indexe cuando la página no es pública', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D', indexable: false });

    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow, noarchive');
  });

  it('debería crear el enlace canónico y luego reutilizarlo', () => {
    service.aplicar({ titulo: 'T', descripcion: 'D', canonica: '/alojamiento' });
    service.aplicar({ titulo: 'T2', descripcion: 'D2', canonica: '/veterinaria' });

    const enlaces = document.head.querySelectorAll('link[rel="canonical"]');
    expect(enlaces.length).toBe(1);
    expect(enlaces[0].getAttribute('href')).toBe(`${location.origin}/veterinaria`);
  });

  /**
   * El fallo que motiva el borrado: al pasar de una ficha con foto a otra sin
   * foto, la vista previa seguía enseñando la imagen de la anterior.
   */
  it('debería borrar las etiquetas de la página anterior antes de escribir las nuevas', () => {
    service.aplicar({ titulo: 'Con foto', descripcion: 'D', imagenAlt: 'Foto vieja' });
    service.aplicar({ titulo: 'Sin foto', descripcion: 'D' });

    expect(document.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
    expect(meta('meta[property="og:image:alt"]')).toBe('Sin foto');
  });

  describe('datosEstructurados', () => {
    it('debería escribir un bloque JSON-LD por documento', () => {
      service.datosEstructurados([
        { '@type': 'Organization', name: 'Doogking' },
        { '@type': 'WebSite', name: 'Doogking' },
      ]);

      const bloques = document.head.querySelectorAll('script[data-dk-jsonld]');
      expect(bloques.length).toBe(2);
      expect(bloques[0].getAttribute('type')).toBe('application/ld+json');
      expect(JSON.parse(bloques[0].textContent ?? '')).toEqual({
        '@type': 'Organization', name: 'Doogking',
      });
    });

    it('debería sustituir los bloques de la página anterior', () => {
      service.datosEstructurados([{ '@type': 'Organization' }]);
      service.datosEstructurados([{ '@type': 'Place' }]);

      const bloques = document.head.querySelectorAll('script[data-dk-jsonld]');
      expect(bloques.length).toBe(1);
      expect(JSON.parse(bloques[0].textContent ?? '')).toEqual({ '@type': 'Place' });
    });
  });

  describe('noEncontrado', () => {
    it('debería marcar la respuesta del servidor como 404', () => {
      service.noEncontrado();

      expect(respuesta.status).toBe(404);
    });
  });
});
