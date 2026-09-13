import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogRepository } from './catalog.repository';
import { Servicio } from './servicio.schema';
import { Alojamiento } from '../../verticals/alojamiento/alojamiento.schema';
import { Transporte } from '../../verticals/transporte/transporte.schema';
import { Veterinaria } from '../../verticals/veterinaria/veterinaria.schema';
import { Peluqueria } from '../../verticals/peluqueria/peluqueria.schema';
import { Adiestramiento } from '../../verticals/adiestramiento/adiestramiento.schema';

describe('CatalogRepository', () => {
  let repository: CatalogRepository;
  let model: {
    find: jest.Mock; countDocuments: jest.Mock; findById: jest.Mock;
    estimatedDocumentCount: jest.Mock; aggregate: jest.Mock;
    findOne: jest.Mock; findByIdAndUpdate: jest.Mock; findOneAndUpdate: jest.Mock;
  };
  let baseModelCtor: jest.Mock;
  let alojamientoModelCtor: jest.Mock;
  let transporteModelCtor: jest.Mock;

  const chainable = (resultado: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    ['sort', 'skip', 'limit', 'lean', 'select'].forEach((m) => (chain[m] = jest.fn(() => chain)));
    chain['exec'] = jest.fn().mockResolvedValue(resultado);
    return chain;
  };

  beforeEach(async () => {
    model = {
      find: jest.fn().mockReturnValue(chainable([])),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(null) }) }),
      estimatedDocumentCount: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      findOne: jest.fn().mockReturnValue(chainable(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(chainable(null)),
      findOneAndUpdate: jest.fn().mockReturnValue(chainable(null)),
    };

    const mockDoc = (datos: Record<string, unknown>) => ({ ...datos, save: jest.fn().mockResolvedValue(datos) });
    // El modelo base es a la vez consulta y constructor: un vertical sin
    // discriminador propio (seguros, funerarios…) guarda con él.
    baseModelCtor = jest.fn().mockImplementation(mockDoc);
    Object.assign(baseModelCtor, model);
    alojamientoModelCtor = jest.fn().mockImplementation(mockDoc);
    transporteModelCtor = jest.fn().mockImplementation(mockDoc);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogRepository,
        { provide: getModelToken(Servicio.name), useValue: baseModelCtor },
        { provide: getModelToken(Alojamiento.name), useValue: alojamientoModelCtor },
        { provide: getModelToken(Transporte.name), useValue: transporteModelCtor },
        { provide: getModelToken(Veterinaria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Peluqueria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Adiestramiento.name), useValue: jest.fn().mockImplementation(mockDoc) },
      ],
    }).compile();

    repository = moduleRef.get(CatalogRepository);
  });

  /** Condición de población: viaja dentro de `$and` como un `$or` de formas. */
  const condicionCiudad = (): Record<string, unknown>[] => {
    const filtro = model.find.mock.calls[0][0];
    return (filtro.$and ?? []).find((c: Record<string, unknown>) => Array.isArray(c.$or)
      && (c.$or as Record<string, unknown>[]).some((o) => 'ubicacion.ciudadClave' in o))?.$or ?? [];
  };

  it('debería filtrar por estado publicado, vertical, ciudad y rango de precio', async () => {
    await repository.buscar({ vertical: 'alojamiento', ciudad: 'Madrid', precioMin: 100, precioMax: 500, page: 1, limit: 10 });

    const filtro = model.find.mock.calls[0][0];
    expect(filtro.estado).toBe('publicado');
    expect(filtro.vertical).toBe('alojamiento');
    expect(condicionCiudad()).toContainEqual({ 'ubicacion.ciudadClave': { $in: ['madrid'] } });
    expect(filtro.precioBase).toEqual({ $gte: 100, $lte: 500 });
  });

  it('debería exigir además que el comercio esté activo', async () => {
    // Suspender un comercio (HU J1) no lo sacaba del buscador: el filtro sólo
    // miraba el estado del listado, nunca el del negocio que lo presta.
    await repository.buscar({ vertical: 'alojamiento', page: 1, limit: 10 });

    expect(model.find.mock.calls[0][0].comercioActivo).toBe(true);
  });

  it('debería seguir exigiendo comercio activo al buscar por zona del mapa', async () => {
    await repository.buscar({
      page: 1, limit: 10,
      bbox: { swLat: 40, swLng: -4, neLat: 41, neLng: -3 },
    });

    expect(model.find.mock.calls[0][0].comercioActivo).toBe(true);
  });

  it('debería tratar la ciudad como texto literal, no como patrón', async () => {
    // `?ciudad=(a+)+$` construía un RegExp con retroceso catastrófico desde un
    // endpoint público y sin sesión.
    await repository.buscar({ ciudad: '(a+)+$', page: 1, limit: 10 });

    const regexes = condicionCiudad()
      .flatMap((c) => Object.values(c))
      .filter((v): v is RegExp => v instanceof RegExp);

    // Ningún cuantificador vivo: todo lo que venga del usuario va escapado, y
    // lo único sin escapar son los anclajes que pone el propio filtro.
    expect(regexes.length).toBeGreaterThan(0);
    regexes.forEach((regex) => expect(regex.source).not.toMatch(/[^\\]\+/));
  });

  describe('población escrita de otra forma (buscador del home)', () => {
    /*
     * El caso que lo destapó: un comercio dado de alta como «villa-real» no
     * aparecía al buscar «Villareal». Ahora las dos formas se traducen a las
     * mismas claves y la consulta las cubre todas.
     */
    it('debería buscar todas las variantes de una población del catálogo', async () => {
      await repository.buscar({ ciudad: 'Villareal', page: 1, limit: 10 });

      const claves = condicionCiudad()
        .find((c) => '$in' in ((c['ubicacion.ciudadClave'] ?? {}) as object)) as
        { 'ubicacion.ciudadClave': { $in: string[] } };

      expect(claves['ubicacion.ciudadClave'].$in).toEqual(
        expect.arrayContaining(['vilareal', 'villarreal', 'villareal']),
      );
    });

    it('debería encontrar la población escrita sin tildes', async () => {
      await repository.buscar({ ciudad: 'malaga', page: 1, limit: 10 });

      expect(condicionCiudad()).toContainEqual({ 'ubicacion.ciudadClave': { $in: ['malaga'] } });
    });

    it('debería reconocer el nombre oficial en otra lengua', async () => {
      await repository.buscar({ ciudad: 'Elx', page: 1, limit: 10 });

      expect(condicionCiudad()).toContainEqual({ 'ubicacion.ciudadClave': { $in: ['elche', 'elx'] } });
    });

    it('debería buscar por prefijo cuando la población no está en el catálogo', async () => {
      await repository.buscar({ ciudad: 'Riola', page: 1, limit: 10 });

      const porClave = condicionCiudad()[0]['ubicacion.ciudadClave'] as RegExp;
      expect(porClave).toBeInstanceOf(RegExp);
      expect(porClave.source).toBe('^riola');
    });

    it('debería exigir principio de palabra: «Vera» no puede sacar «Talavera»', async () => {
      await repository.buscar({ ciudad: 'Vera', page: 1, limit: 10 });

      const porTexto = condicionCiudad()
        .map((c) => c['ubicacion.ciudadNormalizada'])
        .find((v): v is RegExp => v instanceof RegExp);

      expect(porTexto!.test('talavera de la reina')).toBe(false);
      expect(porTexto!.test('vera')).toBe(true);
    });

    it('debería seguir encontrando lo anterior a la migración, que no tiene claves', async () => {
      await repository.buscar({ ciudad: 'Madrid', page: 1, limit: 10 });

      expect(condicionCiudad()).toContainEqual(expect.objectContaining({
        'ubicacion.ciudadClave': { $exists: false },
      }));
    });

    it('no debería filtrar por población cuando manda la zona del mapa', async () => {
      await repository.buscar({
        ciudad: 'Madrid', page: 1, limit: 10,
        bbox: { swLat: 40, swLng: -4, neLat: 41, neLng: -3 },
      });

      expect(condicionCiudad()).toEqual([]);
      expect(model.find.mock.calls[0][0]['ubicacion.geo']).toBeDefined();
    });
  });

  describe('estandarización al guardar', () => {
    it('debería guardar la población canonizada con sus claves y su provincia', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite', descripcion: 'desc', ciudad: 'villa-real',
        precioBase: 40, imagenes: [], comercioId: '507f1f77bcf86cd799439011', comercioActivo: true,
      } as never);

      expect(alojamientoModelCtor.mock.calls[0][0].ubicacion).toEqual(expect.objectContaining({
        ciudad: 'Vila-real',
        ciudadNormalizada: 'vila real',
        ciudadClave: 'vilareal',
        provincia: 'Castellón',
      }));
    });

    it('debería respetar la provincia que escribe el comercio', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite', descripcion: 'desc', ciudad: 'Villarreal',
        provincia: 'Castelló', precioBase: 40, imagenes: [], comercioId: '507f1f77bcf86cd799439011',
        comercioActivo: true,
      } as never);

      expect(alojamientoModelCtor.mock.calls[0][0].ubicacion.provincia).toBe('Castelló');
    });

    it('debería respetar el nombre de una población que no está en el catálogo', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Casa', descripcion: 'desc', ciudad: '  Riola ',
        precioBase: 40, imagenes: [], comercioId: '507f1f77bcf86cd799439011', comercioActivo: true,
      } as never);

      expect(alojamientoModelCtor.mock.calls[0][0].ubicacion).toEqual(expect.objectContaining({
        ciudad: 'Riola', ciudadClave: 'riola', provincia: undefined,
      }));
    });

    it('debería guardar el horario y sus excepciones al editarlos', async () => {
      await repository.actualizar('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', {
        horario: [{ dia: 'lunes', abre: '09:00', cierra: '18:00', cerrado: false }] as never,
        excepcionesHorario: [{ fecha: '2026-12-25', cerrado: true }] as never,
      });

      const set = model.findOneAndUpdate.mock.calls[0][1].$set;
      expect(set.horario).toHaveLength(1);
      expect(set.excepcionesHorario).toHaveLength(1);
    });

    it('debería usar el modelo base para un vertical sin discriminador propio', async () => {
      // Los verticales nuevos (seguros, funerarios…) guardan con el esquema base
      // hasta que tienen el suyo; sin el respaldo, crear su listado reventaba.
      await repository.crear({
        vertical: 'seguros', titulo: 'Póliza', descripcion: 'desc', ciudad: 'Madrid',
        precioBase: 10, imagenes: [], comercioId: '507f1f77bcf86cd799439011', comercioActivo: true,
      } as never);

      expect(alojamientoModelCtor).not.toHaveBeenCalled();
      expect(baseModelCtor).toHaveBeenCalledWith(expect.objectContaining({ vertical: 'seguros' }));
    });

    it('debería editar la calle sin tocar la población', async () => {
      await repository.actualizar('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', {
        calle: 'Gran Vía', numero: '31', codigoPostal: '46005', pais: 'España',
      });

      const set = model.findOneAndUpdate.mock.calls[0][1].$set;
      expect(set['ubicacion.calle']).toBe('Gran Vía');
      expect(set['ubicacion.ciudad']).toBeUndefined();
      expect(set['ubicacion.ciudadClave']).toBeUndefined();
    });

    it('debería tomar la provincia del catálogo si el formulario la manda en blanco', async () => {
      await repository.actualizar('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', {
        ciudad: 'Vila-real', provincia: '   ',
      });

      expect(model.findOneAndUpdate.mock.calls[0][1].$set['ubicacion.provincia']).toBe('Castellón');
    });

    it('debería escribir la provincia suelta cuando la edición no toca la ciudad', async () => {
      await repository.actualizar('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { provincia: 'Castellón' });

      expect(model.findOneAndUpdate.mock.calls[0][1].$set['ubicacion.provincia']).toBe('Castellón');
    });

    it('debería reescribir las claves al editar la población', async () => {
      await repository.actualizar('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { ciudad: 'ALACANT' });

      const set = model.findOneAndUpdate.mock.calls[0][1].$set;
      expect(set['ubicacion.ciudad']).toBe('Alicante');
      expect(set['ubicacion.ciudadClave']).toBe('alicante');
      expect(set['ubicacion.provincia']).toBe('Alicante');
    });
  });

  it('debería descartar los servicios sin nota al pedir una valoración mínima', async () => {
    // La media es 0 mientras nadie ha reseñado: colarlos en un filtro de «4+»
    // sería enseñar como bien valorado lo que no tiene ni una reseña.
    await repository.buscar({ page: 1, limit: 10, ratingMin: 4 });

    expect(model.find.mock.calls[0][0].ratingPromedio).toEqual({ $gte: 4 });
  });

  it('debería exigir todos los amenities marcados, no cualquiera de ellos', async () => {
    await repository.buscar({ page: 1, limit: 10, amenities: ['piscina', 'jardin'] });

    expect(model.find.mock.calls[0][0].amenities).toEqual({ $all: ['piscina', 'jardin'] });
  });

  it('no debería añadir condiciones de compatibilidad si no se indica perfil de perro', async () => {
    await repository.buscar({ vertical: 'alojamiento', page: 1, limit: 10 });
    const filtro = model.find.mock.calls[0][0];
    expect(filtro.$and).toBeUndefined();
  });

  it('debería filtrar por tamaño, tipo de pelo y excluir temperamentos no admitidos', async () => {
    await repository.buscar({
      vertical: 'peluqueria',
      page: 1,
      limit: 10,
      perfilPerro: { tamano: 'mini' as never, tipoPelo: ['corto' as never], temperamento: 'nervioso' },
    });

    const filtro = model.find.mock.calls[0][0];
    expect(filtro.$and).toHaveLength(3);
    expect(filtro.$and[0].$or).toContainEqual({ 'aptitud.tamanosAdmitidos': 'mini' });
    expect(filtro.$and[1].$or).toContainEqual({ 'aptitud.tipoPeloAdmitido': { $in: ['corto'] } });
    expect(filtro.$and[2]).toEqual({ 'aptitud.temperamentosNoAdmitidos': { $ne: 'nervioso' } });
  });

  it('debería paginar con skip = (page - 1) * limit', async () => {
    const chain = chainable([]);
    model.find.mockReturnValue(chain);

    await repository.buscar({ page: 3, limit: 10, vertical: 'alojamiento' });

    expect(chain['skip']).toHaveBeenCalledWith(20);
    expect(chain['limit']).toHaveBeenCalledWith(10);
  });

  describe('crear', () => {
    it('debería usar el modelo del discriminador correspondiente al vertical', async () => {
      await repository.crear({
        vertical: 'transporte', titulo: 'PetVan', descripcion: 'desc', ciudad: 'Madrid',
        comercioActivo: true,
        precioBase: 20, imagenes: [], comercioId: '650000000000000000000001',
        extra: { tarifaBase: 15, tarifaKm: 0.9 },
      });

      expect(transporteModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'transporte', tarifaBase: 15, tarifaKm: 0.9, moneda: 'EUR' }),
      );
      expect(alojamientoModelCtor).not.toHaveBeenCalled();
    });

    it('debería guardar las coordenadas como punto GeoJSON [lng, lat]', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite Canina', descripcion: 'desc', ciudad: 'Madrid',
        comercioActivo: true,
        precioBase: 40, imagenes: [], comercioId: '650000000000000000000001',
        lat: 40.4168, lng: -3.7038,
      });

      expect(alojamientoModelCtor).toHaveBeenCalledWith(expect.objectContaining({
        ubicacion: expect.objectContaining({
          ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7038, 40.4168] },
        }),
      }));
    });

    it('debería publicar sin geo si falta alguna coordenada', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite Canina', descripcion: 'desc', ciudad: 'Cuenca',
        precioBase: 40, imagenes: [], comercioId: '650000000000000000000001',
        lat: 40.4168,
        comercioActivo: true,
      });

      // Un punto a medias rompería el índice 2dsphere; mejor sin geolocalizar.
      expect(alojamientoModelCtor).toHaveBeenCalledWith(expect.objectContaining({
        ubicacion: expect.objectContaining({ ciudad: 'Cuenca', geo: undefined }),
      }));
    });

    it('debería persistir los campos extra del vertical en el documento creado', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite Canina', descripcion: 'desc', ciudad: 'Madrid',
        comercioActivo: true,
        precioBase: 40, imagenes: [], comercioId: '650000000000000000000001',
        extra: { espacios: [{ tipo: 'estandar', cantidad: 2, precioNoche: 40 }] },
      });

      expect(alojamientoModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ espacios: [{ tipo: 'estandar', cantidad: 2, precioNoche: 40 }] }),
      );
    });
  });

  describe('búsqueda por mapa', () => {
    const zona = { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 };

    it('debería acotar la búsqueda al rectángulo visible con $geoWithin', async () => {
      await repository.buscar({ vertical: 'alojamiento', page: 1, limit: 10, bbox: zona });

      const filtro = model.find.mock.calls[0][0];
      expect(filtro['ubicacion.geo'].$geoWithin.$geometry).toEqual({
        type: 'Polygon',
        coordinates: [[
          [-3.8, 40.3], [-3.6, 40.3], [-3.6, 40.5], [-3.8, 40.5], [-3.8, 40.3],
        ]],
      });
    });

    it('debería descartar la ciudad cuando se busca por zona del mapa', async () => {
      await repository.buscar({
        vertical: 'alojamiento', ciudad: 'Madrid', page: 1, limit: 10, bbox: zona,
      });

      // Si el usuario arrastró el mapa hasta otra comarca, quiere ver lo que
      // hay ahí, no lo que casaba con el texto que tecleó antes.
      const filtro = model.find.mock.calls[0][0];
      expect(filtro['ubicacion.ciudad']).toBeUndefined();
    });

    it('debería ignorar un rectángulo degenerado en vez de romper la búsqueda', async () => {
      await repository.buscar({
        vertical: 'alojamiento', ciudad: 'Madrid', page: 1, limit: 10,
        // Esquinas invertidas: MongoDB rechazaría la consulta entera.
        bbox: { swLat: 40.5, swLng: -3.6, neLat: 40.3, neLng: -3.8 },
      });

      const filtro = model.find.mock.calls[0][0];
      expect(filtro['ubicacion.geo']).toBeUndefined();
      // Sin zona utilizable manda la ciudad escrita, que si no dejaría la
      // búsqueda sin ningún criterio de sitio.
      expect(condicionCiudad()).toContainEqual({ 'ubicacion.ciudadClave': { $in: ['madrid'] } });
    });

    it('debería ignorar coordenadas fuera del rango terrestre', async () => {
      await repository.buscar({
        vertical: 'alojamiento', page: 1, limit: 10,
        bbox: { swLat: -95, swLng: -3.8, neLat: 40.5, neLng: -3.6 },
      });

      expect(model.find.mock.calls[0][0]['ubicacion.geo']).toBeUndefined();
    });

    it('debería devolver los pines con lat/lng invertidas respecto a GeoJSON', async () => {
      model.find.mockReturnValue(chainable([
        {
          _id: 'a1', titulo: 'Residencia Las Rozas', precioBase: 24,
          ratingPromedio: 4.75, imagenes: ['img.jpg'],
          ubicacion: { geo: { coordinates: [-3.7038, 40.4168] } },
        },
      ]));

      const puntos = await repository.puntos({ vertical: 'alojamiento', page: 1, limit: 1, bbox: zona });

      expect(puntos).toEqual([{
        id: 'a1', titulo: 'Residencia Las Rozas', precio: 24,
        lat: 40.4168, lng: -3.7038, rating: 4.8, imagen: 'img.jpg',
      }]);
    });

    it('debería descartar los servicios sin coordenadas utilizables', async () => {
      model.find.mockReturnValue(chainable([
        { _id: 'a1', titulo: 'Sin ubicación', precioBase: 30, ubicacion: {} },
        { _id: 'a2', titulo: 'Coordenadas rotas', precioBase: 30, ubicacion: { geo: { coordinates: [] } } },
      ]));

      expect(await repository.puntos({ vertical: 'alojamiento', page: 1, limit: 1 })).toEqual([]);
    });

    it('debería topar el número de pines y exigir coordenadas en la consulta', async () => {
      const chain = chainable([]);
      model.find.mockReturnValue(chain);

      await repository.puntos({ vertical: 'alojamiento', page: 1, limit: 1 });

      expect(chain['limit']).toHaveBeenCalledWith(300);
      expect(model.find.mock.calls[0][0]['ubicacion.geo.coordinates'])
        .toEqual({ $exists: true, $ne: null });
    });
  });

  describe('facetas (PDF 27/07 §3)', () => {
    const facetasCrudas = {
      precios: [
        { _id: { min: 10, max: 30 }, n: 4 },
        { _id: { min: 30, max: 60 }, n: 7 },
      ],
      amenities: [
        { _id: 'Parking', n: 514 },
        { _id: 'Piscina', n: 87 },
      ],
      valoracion: [{ tres: 20, cuatro: 12, cinco: 3 }],
    };

    it('debería devolver histograma de precios, contadores de amenities y de valoración', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([facetasCrudas]) });

      const facetas = await repository.facetas({ vertical: 'alojamiento', ciudad: 'Madrid', page: 1, limit: 1 });

      expect(facetas.precios).toEqual([
        { desde: 10, hasta: 30, n: 4 },
        { desde: 30, hasta: 60, n: 7 },
      ]);
      expect(facetas.amenities).toEqual([
        { valor: 'Parking', n: 514 },
        { valor: 'Piscina', n: 87 },
      ]);
      expect(facetas.valoracion).toEqual([
        { minimo: 3, n: 20 },
        { minimo: 4, n: 12 },
        { minimo: 5, n: 3 },
      ]);
    });

    it('debería ignorar el rango de precio al calcular el histograma', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([facetasCrudas]) });

      await repository.facetas({
        vertical: 'alojamiento', precioMin: 20, precioMax: 40, page: 1, limit: 1,
      });

      // El histograma describe el destino entero, no solo el tramo ya filtrado:
      // si se recortara, el usuario no podría volver a ampliar el rango.
      const [{ $match: filtro }] = model.aggregate.mock.calls[0][0];
      expect(filtro.precioBase).toBeUndefined();
      expect(filtro.vertical).toBe('alojamiento');
    });

    it('debería devolver facetas vacías si la agregación no trae nada', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const facetas = await repository.facetas({ vertical: 'alojamiento', page: 1, limit: 1 });

      expect(facetas).toEqual({ precios: [], amenities: [], valoracion: [] });
    });
  });

  describe('búsqueda por distancia', () => {
    /** El `$geoNear` va dentro de un `aggregate`, no del `find` normal. */
    const etapaGeoNear = () => model.aggregate.mock.calls.at(-1)![0][0].$geoNear;

    it('debería ordenar por cercanía usando el índice geoespacial', async () => {
      model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ items: [{ _id: 's1' }], total: [{ n: 1 }] }]),
      });

      const res = await repository.buscar({ page: 1, limit: 10, orden: 'distancia', lat: 40.4, lng: -3.7 } as never);

      // GeoJSON guarda [lng, lat], no al revés: invertirlo mandaría la búsqueda
      // a otro punto del planeta.
      expect(etapaGeoNear().near).toEqual({ type: 'Point', coordinates: [-3.7, 40.4] });
      expect(res).toEqual({ items: [{ _id: 's1' }], total: 1 });
    });

    it('debería devolver vacío si la agregación no da resultados', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      await expect(repository.buscar({ page: 1, limit: 10, orden: 'distancia', lat: 40.4, lng: -3.7 } as never))
        .resolves.toEqual({ items: [], total: 0 });
    });

    it('debería devolver total 0 cuando la faceta de conteo viene vacía', async () => {
      model.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ items: [], total: [] }]),
      });

      await expect(repository.buscar({ page: 1, limit: 10, orden: 'distancia', lat: 40.4, lng: -3.7 } as never))
        .resolves.toEqual({ items: [], total: 0 });
    });
  });

  describe('lectura puntual', () => {
    it('debería obtener un servicio por id', async () => {
      await repository.obtenerPorId('s1');

      expect(model.findById).toHaveBeenCalledWith('s1');
    });

    it('debería exigir también el comercio al obtener un servicio propio', async () => {
      // Sin el comercio, un comercio podría leer el listado de otro.
      const id = '507f1f77bcf86cd799439011';
      const comercioId = '507f1f77bcf86cd799439012';

      await repository.obtenerPorIdYComercio(id, comercioId);

      const filtro = model.findOne.mock.calls[0][0];
      expect(String(filtro._id)).toBe(id);
      expect(String(filtro.comercioId)).toBe(comercioId);
    });

    it('debería contar el total con la estimación rápida', async () => {
      model.estimatedDocumentCount.mockReturnValue({ exec: jest.fn().mockResolvedValue(42) });

      await expect(repository.contarTotal()).resolves.toBe(42);
    });

    it('debería actualizar solo los campos indicados, devolviendo el documento nuevo', async () => {
      await repository.actualizarCampos('s1', { cuposDisponibles: 5 });

      expect(model.findByIdAndUpdate)
        .toHaveBeenCalledWith('s1', { cuposDisponibles: 5 }, { new: true });
    });
  });

  describe('actualizar', () => {
    const id = '507f1f77bcf86cd799439011';
    const comercioId = '507f1f77bcf86cd799439012';
    const cambios = () => model.findOneAndUpdate.mock.calls.at(-1)![1].$set;

    it('debería aplanar la ciudad a su ruta anidada', async () => {
      await repository.actualizar(id, comercioId, { ciudad: 'Madrid' } as never);

      expect(cambios()['ubicacion.ciudad']).toBe('Madrid');
    });

    it('debería guardar el punto GeoJSON cuando llegan ambas coordenadas', async () => {
      await repository.actualizar(id, comercioId, { lat: 40.4, lng: -3.7 } as never);

      expect(cambios()['ubicacion.geo']).toEqual({ type: 'Point', coordinates: [-3.7, 40.4] });
    });

    it('no debería guardar un punto a medias con una sola coordenada', async () => {
      // Un punto incompleto rompería el índice 2dsphere, y el servicio debe
      // poder publicarse sin coordenadas.
      await repository.actualizar(id, comercioId, { lat: 40.4 } as never);

      expect(cambios()).not.toHaveProperty('ubicacion.geo');
    });

    it('debería fundir los campos propios del vertical con los comunes', async () => {
      await repository.actualizar(id, comercioId, {
        titulo: 'Suite', precioBase: 80, extra: { camaras24h: true },
      } as never);

      expect(cambios()).toEqual(
        expect.objectContaining({ titulo: 'Suite', precioBase: 80, camaras24h: true }),
      );
    });

    it('no debería incluir los campos que no se envían', async () => {
      await repository.actualizar(id, comercioId, { titulo: 'Solo el título' } as never);

      const set = cambios();
      expect(set).toHaveProperty('titulo');
      expect(set).not.toHaveProperty('descripcion');
      expect(set).not.toHaveProperty('precioBase');
      expect(set).not.toHaveProperty('imagenes');
    });

    it('debería permitir guardar la aptitud y una lista de imágenes vacía', async () => {
      await repository.actualizar(id, comercioId, {
        imagenes: [], aptitud: { tamanosAdmitidos: ['mini'] },
      } as never);

      const set = cambios();
      expect(set.imagenes).toEqual([]);
      expect(set.aptitud).toEqual({ tamanosAdmitidos: ['mini'] });
    });

    it('debería exigir id y comercio en el filtro de actualización', async () => {
      await repository.actualizar(id, comercioId, { titulo: 'X' } as never);

      const filtro = model.findOneAndUpdate.mock.calls.at(-1)![0];
      expect(String(filtro._id)).toBe(id);
      expect(String(filtro.comercioId)).toBe(comercioId);
    });
  });

  describe('filtro de disponibilidad', () => {
    const filtroUsado = () => model.find.mock.calls.at(-1)![0];

    it('no debería filtrar por plazas si no se pide "solo disponibles"', async () => {
      await repository.buscar({ page: 1, limit: 10 } as never);

      expect(JSON.stringify(filtroUsado())).not.toContain('Disponibles');
    });

    it('debería aceptar los servicios sin contador declarado', async () => {
      // Un listado antiguo sin el campo no puede desaparecer del buscador por
      // no tener contador; solo se descarta el que declara cero.
      await repository.buscar({ page: 1, limit: 10, vertical: 'peluqueria', soloDisponibles: true } as never);

      const condiciones = JSON.stringify(filtroUsado());
      expect(condiciones).toContain('$exists');
      expect(condiciones).toContain('$gt');
    });

    it('debería mirar todos los contadores si no se acota el vertical', async () => {
      await repository.buscar({ page: 1, limit: 10, soloDisponibles: true } as never);

      expect(JSON.stringify(filtroUsado())).toContain('Disponibles');
    });
  });

  describe('filtros propios del vertical', () => {
    const filtroUsado = () => model.find.mock.calls.at(-1)![0];

    it('debería traducir un booleano marcado a una condición verdadera', async () => {
      await repository.buscar({
        page: 1, limit: 10, vertical: 'peluqueria', filtrosVertical: { aDomicilio: true },
      } as never);

      expect(filtroUsado().aDomicilio).toBe(true);
    });

    it('debería ignorar un booleano sin marcar en vez de exigir false', async () => {
      // Un interruptor apagado significa "me da igual", no "que NO lo tenga".
      await repository.buscar({
        page: 1, limit: 10, vertical: 'peluqueria', filtrosVertical: { aDomicilio: false },
      } as never);

      expect(filtroUsado()).not.toHaveProperty('aDomicilio');
    });

    it('debería exigir todos los valores de una lista marcada como "todos"', async () => {
      await repository.buscar({
        page: 1, limit: 10, vertical: 'adiestramiento',
        filtrosVertical: { tiposAdiestramiento: ['obediencia', 'agility'] },
      } as never);

      expect(filtroUsado().tiposAdiestramiento).toEqual({ $all: ['obediencia', 'agility'] });
    });

    it('debería admitir cualquiera de los valores en un filtro de tipo "en"', async () => {
      await repository.buscar({
        page: 1, limit: 10, vertical: 'transporte',
        filtrosVertical: { tipoVehiculo: ['coche', 'furgon_climatizado'] },
      } as never);

      expect(filtroUsado().tipoVehiculo).toEqual({ $in: ['coche', 'furgon_climatizado'] });
    });

    it('debería envolver un valor suelto como lista de un elemento', async () => {
      await repository.buscar({
        page: 1, limit: 10, vertical: 'transporte', filtrosVertical: { tipoVehiculo: 'coche' },
      } as never);

      expect(filtroUsado().tipoVehiculo).toEqual({ $in: ['coche'] });
    });

    it('debería descartar cadenas vacías dentro de una lista', async () => {
      await repository.buscar({
        page: 1, limit: 10, vertical: 'transporte', filtrosVertical: { tipoVehiculo: ['', ''] },
      } as never);

      expect(filtroUsado()).not.toHaveProperty('tipoVehiculo');
    });

    it('debería ignorar filtros que el vertical no declara permitidos', async () => {
      // Lista blanca: un campo arbitrario en la query no puede llegar a Mongo.
      await repository.buscar({
        page: 1, limit: 10, vertical: 'peluqueria', filtrosVertical: { campoInventado: 'x' },
      } as never);

      expect(filtroUsado()).not.toHaveProperty('campoInventado');
    });
  });
});
