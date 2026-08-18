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
    alojamientoModelCtor = jest.fn().mockImplementation(mockDoc);
    transporteModelCtor = jest.fn().mockImplementation(mockDoc);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogRepository,
        { provide: getModelToken(Servicio.name), useValue: model },
        { provide: getModelToken(Alojamiento.name), useValue: alojamientoModelCtor },
        { provide: getModelToken(Transporte.name), useValue: transporteModelCtor },
        { provide: getModelToken(Veterinaria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Peluqueria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Adiestramiento.name), useValue: jest.fn().mockImplementation(mockDoc) },
      ],
    }).compile();

    repository = moduleRef.get(CatalogRepository);
  });

  it('debería filtrar por estado publicado, vertical, ciudad (regex) y rango de precio', async () => {
    await repository.buscar({ vertical: 'alojamiento', ciudad: 'Madrid', precioMin: 100, precioMax: 500, page: 1, limit: 10 });

    const filtro = model.find.mock.calls[0][0];
    expect(filtro.estado).toBe('publicado');
    expect(filtro.vertical).toBe('alojamiento');
    expect(filtro['ubicacion.ciudad']).toBeInstanceOf(RegExp);
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

  it('debería tratar la ciudad como texto literal, no como patrón', () => {
    // `?ciudad=(a+)+$` construía un RegExp con retroceso catastrófico desde un
    // endpoint público y sin sesión.
    return repository.buscar({ ciudad: '(a+)+$', page: 1, limit: 10 }).then(() => {
      const regex = model.find.mock.calls[0][0]['ubicacion.ciudad'] as RegExp;
      expect(regex.test(`${'a'.repeat(40)}!`)).toBe(false);
      expect(regex.source).toContain('\(');
    });
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
        ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: [-3.7038, 40.4168] } },
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
        ubicacion: { ciudad: 'Cuenca', geo: undefined },
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
      expect(filtro['ubicacion.ciudad']).toBeInstanceOf(RegExp);
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
