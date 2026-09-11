import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EstadoModeracion, VerticalKey } from 'shared';
import { Servicio } from '../catalog/servicio.schema';
import { Lugar } from '../lugares/lugar.schema';
import { SitemapService } from './sitemap.service';

/** Imita la cadena `find().select().sort().limit().lean()` de Mongoose. */
function cadenaQueDevuelve(documentos: unknown[]) {
  const cadena = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(documentos),
  };
  return { find: jest.fn().mockReturnValue(cadena), cadena };
}

describe('SitemapService', () => {
  let service: SitemapService;
  let servicios: ReturnType<typeof cadenaQueDevuelve>;
  let lugares: ReturnType<typeof cadenaQueDevuelve>;

  const montar = async (docsServicios: unknown[], docsLugares: unknown[]) => {
    servicios = cadenaQueDevuelve(docsServicios);
    lugares = cadenaQueDevuelve(docsLugares);

    const modulo = await Test.createTestingModule({
      providers: [
        SitemapService,
        { provide: getModelToken(Servicio.name), useValue: servicios },
        { provide: getModelToken(Lugar.name), useValue: lugares },
      ],
    }).compile();

    service = modulo.get(SitemapService);
  };

  beforeEach(() => montar([], []));

  it('debería incluir la portada y los ocho listados de categoría', async () => {
    const rutas = (await service.entradas()).map((entrada) => entrada.ruta);

    expect(rutas).toContain('/');
    expect(rutas).toContain('/alojamiento');
    expect(rutas).toContain('/veterinaria');
    expect(rutas).toContain('/funerarios');
    expect(rutas).toContain('/explora');
  });

  /**
   * Los paneles y el proceso de reserva no son contenido: ofrecérselos a Google
   * gasta rastreo y genera resultados que llevan a un login.
   */
  it('no debería incluir rutas de sesión ni paneles', async () => {
    const rutas = (await service.entradas()).map((entrada) => entrada.ruta);

    for (const privada of ['/admin', '/comercio', '/perfil', '/reservas', '/auth', '/buscador']) {
      expect(rutas).not.toContain(privada);
    }
  });

  describe('fichas de servicio', () => {
    /**
     * `comercioActivo` es la misma condición que aplica el buscador. Sin ella el
     * sitemap ofrecería fichas de comercios suspendidos que al abrirlas no salen.
     */
    it('debería pedir sólo las publicadas de comercios activos', async () => {
      await service.entradas();

      expect(servicios.find).toHaveBeenCalledWith({ estado: 'publicado', comercioActivo: true });
    });

    it('debería componer la ruta con la del vertical', async () => {
      await montar(
        [{ _id: 'abc', vertical: VerticalKey.VETERINARIA, updatedAt: new Date('2026-09-01T10:00:00Z') }],
        [],
      );

      const entrada = (await service.entradas()).find((e) => e.ruta === '/veterinaria/abc');
      expect(entrada).toBeDefined();
      expect(entrada?.lastmod).toBe('2026-09-01T10:00:00.000Z');
    });

    /** Un vertical retirado deja fichas cuya ruta pública ya no existe. */
    it('debería descartar una ficha de un vertical desconocido', async () => {
      await montar([{ _id: 'abc', vertical: 'cuidadores' }], []);

      const rutas = (await service.entradas()).map((e) => e.ruta);
      expect(rutas.some((ruta) => ruta.includes('abc'))).toBe(false);
    });
  });

  describe('lugares', () => {
    it('debería pedir sólo los publicados', async () => {
      await service.entradas();

      expect(lugares.find).toHaveBeenCalledWith({ estado: EstadoModeracion.PUBLICADO });
    });

    it('debería usar el slug cuando lo tiene', async () => {
      await montar([], [{ _id: 'xyz', slug: 'rio-jucar-riola' }]);

      const rutas = (await service.entradas()).map((e) => e.ruta);
      expect(rutas).toContain('/explora/rio-jucar-riola');
    });

    /** Mientras la migración de slugs no haya pasado, el id sigue siendo válido. */
    it('debería caer al id si todavía no tiene slug', async () => {
      await montar([], [{ _id: 'xyz' }]);

      const rutas = (await service.entradas()).map((e) => e.ruta);
      expect(rutas).toContain('/explora/xyz');
    });
  });

  describe('xml', () => {
    it('debería generar un urlset válido con URL absolutas', async () => {
      const xml = await service.xml('https://doogking.com');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<loc>https://doogking.com/alojamiento</loc>');
      expect(xml).toContain('</urlset>');
    });

    it('debería quitar la barra final del origen para no generar URL con doble barra', async () => {
      const xml = await service.xml('https://doogking.com/');

      expect(xml).toContain('<loc>https://doogking.com/alojamiento</loc>');
      expect(xml).not.toContain('//alojamiento');
    });

    /** Un `&` sin escapar deja el XML mal formado y Google descarta el fichero entero. */
    it('debería escapar los caracteres que romperían el XML', async () => {
      await montar([], [{ _id: 'a&b' }]);

      const xml = await service.xml('https://doogking.com');
      expect(xml).toContain('/explora/a&amp;b');
    });

    it('debería omitir lastmod cuando el documento no tiene fecha', async () => {
      await montar([], [{ _id: 'xyz' }]);

      const xml = await service.xml('https://doogking.com');
      const bloque = xml.slice(xml.indexOf('/explora/xyz'));
      expect(bloque.slice(0, bloque.indexOf('</url>'))).not.toContain('<lastmod>');
    });
  });
});
