import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { PerrosService } from '../perros/perros.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('CatalogService', () => {
  let service: CatalogService;
  let repo: jest.Mocked<CatalogRepository>;
  let reviewsService: jest.Mocked<ReviewsService>;
  let perrosService: jest.Mocked<PerrosService>;

  const hotelDoc = {
    _id: 'hotel-1',
    comercioId: 'comercio-1',
    titulo: 'Gran Hotel Madrid',
    descripcion: 'Un gran hotel',
    imagenes: ['img1.jpg'],
    ubicacion: { ciudad: 'Madrid' },
    precioBase: 320,
    precioAnterior: 420,
    descuentoPct: 24,
    destacado: true,
    ratingPromedio: 9.2,
    totalReseñas: 2840,
    amenities: ['🌊 Piscina'],
    estrellas: 5,
    barrio: 'Salamanca',
    direccion: 'Calle Serrano 1',
    desayunoIncluido: true,
    cancelacionGratis: true,
    espaciosDisponibles: 4,
    paseosIncluidos: true,
    requisitoVacunas: true,
    camaras24h: true,
    espacios: [
      { tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 45, cantidad: 3 },
    ],
    habitaciones: [
      { id: 'r1', tipo: 'Superior', descripcion: 'desc', capacidad: 2, camas: '1 doble', tamano: 32, precio: 320, amenities: [], imagenes: [], cantidad: 4, disponible: true, cancelacionGratis: true },
    ],
    politicaCancelacion: 'Gratis 24h',
    checkIn: '15:00',
    checkOut: '12:00',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: CatalogRepository,
          useValue: {
            buscar: jest.fn(), obtenerPorId: jest.fn(), contarTotal: jest.fn(),
            actualizarCampos: jest.fn(), crear: jest.fn(),
          },
        },
        {
          provide: ReviewsService,
          useValue: { listarPorServicio: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: PerrosService,
          useValue: { obtenerPerfilCompatibilidad: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(CatalogService);
    repo = module.get(CatalogRepository);
    reviewsService = module.get(ReviewsService);
    perrosService = module.get(PerrosService);
  });

  describe('buscarServicios', () => {
    it('debería mapear los documentos a tarjetas de hotel y calcular la paginación', async () => {
      repo.buscar.mockResolvedValue({ items: [hotelDoc] as never, total: 25 });

      const result = await service.buscarServicios({ page: 2, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.items[0]).toMatchObject({
        id: 'hotel-1',
        nombre: 'Gran Hotel Madrid',
        ciudad: 'Madrid',
        barrio: 'Salamanca',
        estrellas: 5,
        score: 9.2,
        scoreLabel: 'Excepcional',
        numResenas: 2840,
        precioPorNoche: 320,
        descuentoPct: 24,
        espaciosDisponibles: 4,
        paseosIncluidos: true,
      });
    });

    it('debería usar el vertical hoteles por defecto y acotar el límite máximo', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });

      await service.buscarServicios({ limit: 999 });

      expect(repo.buscar).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'alojamiento', limit: 50, page: 1 }),
      );
    });

    it('debería resolver el perfil de compatibilidad del perro y pasarlo al repositorio', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });
      perrosService.obtenerPerfilCompatibilidad.mockResolvedValue({ tamano: 'mini' as never });

      await service.buscarServicios({ perroId: 'perro-1' });

      expect(perrosService.obtenerPerfilCompatibilidad).toHaveBeenCalledWith('perro-1');
      expect(repo.buscar).toHaveBeenCalledWith(
        expect.objectContaining({ perfilPerro: { tamano: 'mini' } }),
      );
    });

    it('debería devolver totalPages 1 cuando no hay resultados', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });

      const result = await service.buscarServicios({});

      expect(result.totalPages).toBe(1);
      expect(result.items).toEqual([]);
    });

    it('debería exponer en "extra" los campos de enriquecimiento de residencia/alojamiento (Fase C)', async () => {
      const alojamientoDoc = {
        ...hotelDoc,
        vertical: 'alojamiento',
        compatibilidadSocialAdmitida: ['cualquiera'],
        requisitoMicrochip: true,
        requiereDesparasitacionInterna: true,
        requiereDesparasitacionExterna: false,
        requiereVacunaTosPerreras: false,
        serviciosAdicionales: [{ nombre: 'Paseo individual', precio: 10 }],
      };
      repo.buscar.mockResolvedValue({ items: [alojamientoDoc] as never, total: 1 });

      const result = await service.buscarServicios({ vertical: 'alojamiento' });

      expect(result.items[0].extra).toMatchObject({
        compatibilidadSocialAdmitida: ['cualquiera'],
        requisitoMicrochip: true,
        requiereDesparasitacionInterna: true,
        requiereDesparasitacionExterna: false,
        requiereVacunaTosPerreras: false,
        serviciosAdicionales: alojamientoDoc.serviciosAdicionales,
      });
    });

    it('debería exponer en "extra" los campos de enriquecimiento de peluquería (Fase C)', async () => {
      const peluqueriaDoc = {
        ...hotelDoc,
        vertical: 'peluqueria',
        serviciosGrooming: [{ nombre: 'Spa premium', precio: 55, tipoPeloCompatible: ['duro'] }],
        politicaTemperamentoDificil: 'valoracion_previa',
        bozalObligatorioSiAgresivo: true,
        serviciosAdicionales: [{ nombre: 'Corte de uñas', precio: 8 }],
        razasEspecificas: ['Caniche'],
        requiereVacunasAlDia: true,
        requiereMicrochip: false,
      };
      repo.buscar.mockResolvedValue({ items: [peluqueriaDoc] as never, total: 1 });

      const result = await service.buscarServicios({ vertical: 'peluqueria' });

      expect(result.items[0].extra).toMatchObject({
        serviciosGrooming: peluqueriaDoc.serviciosGrooming,
        politicaTemperamentoDificil: 'valoracion_previa',
        bozalObligatorioSiAgresivo: true,
        serviciosAdicionales: peluqueriaDoc.serviciosAdicionales,
        razasEspecificas: ['Caniche'],
        requiereVacunasAlDia: true,
        requiereMicrochip: false,
      });
    });
  });

  describe('obtenerServicio', () => {
    it('debería devolver el detalle mapeado con sus habitaciones', async () => {
      repo.obtenerPorId.mockResolvedValue(hotelDoc as never);

      const result = await service.obtenerServicio('hotel-1');

      expect(result.descripcion).toBe('Un gran hotel');
      expect(result.habitaciones).toHaveLength(1);
      expect(result.habitaciones[0].tipo).toBe('Superior');
      expect(result.comercioId).toBe('comercio-1');
      expect(result.requisitoVacunas).toBe(true);
      expect(result.camaras24h).toBe(true);
      expect(result.espacios).toEqual([{ tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 45, cantidad: 3 }]);
    });

    it('debería lanzar DomainException 404 si el hotel no existe', async () => {
      repo.obtenerPorId.mockResolvedValue(null);

      await expect(service.obtenerServicio('no-existe')).rejects.toThrow(DomainException);
    });

    it('debería incluir las reseñas reales del servicio (no un array vacío hardcodeado)', async () => {
      repo.obtenerPorId.mockResolvedValue(hotelDoc as never);
      reviewsService.listarPorServicio.mockResolvedValue([
        {
          _id: 'r1',
          usuarioNombre: 'María',
          puntuacion: 5,
          comentario: 'Genial con mi perro',
          respuesta: null,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ] as never);

      const result = await service.obtenerServicio('hotel-1');

      expect(reviewsService.listarPorServicio).toHaveBeenCalledWith('hotel-1');
      expect(result.resenas).toEqual([
        {
          id: 'r1',
          autorNombre: 'María',
          puntuacion: 5,
          comentario: 'Genial con mi perro',
          fecha: '2026-06-01T00:00:00.000Z',
          respuesta: null,
        },
      ]);
    });
  });

  describe('actualizarDisponibilidad', () => {
    it('debería actualizar unidadesDisponibles para un servicio de transporte', async () => {
      repo.obtenerPorId.mockResolvedValue({ ...hotelDoc, vertical: 'transporte', comercioId: 'comercio-1' } as never);
      repo.actualizarCampos.mockResolvedValue({ ...hotelDoc, vertical: 'transporte' } as never);

      await service.actualizarDisponibilidad('serv-1', 'comercio-1', { unidadesDisponibles: 3 });

      expect(repo.actualizarCampos).toHaveBeenCalledWith('serv-1', { unidadesDisponibles: 3 });
    });

    it('debería ignorar campos que no corresponden al vertical del servicio', async () => {
      repo.obtenerPorId.mockResolvedValue({ ...hotelDoc, vertical: 'veterinaria', comercioId: 'comercio-1' } as never);
      repo.actualizarCampos.mockResolvedValue({ ...hotelDoc, vertical: 'veterinaria' } as never);

      await service.actualizarDisponibilidad('serv-1', 'comercio-1', {
        citasDisponibles: 8, unidadesDisponibles: 99,
      } as never);

      expect(repo.actualizarCampos).toHaveBeenCalledWith('serv-1', { citasDisponibles: 8 });
    });

    it('debería lanzar 403 si el servicio no pertenece al comercio', async () => {
      repo.obtenerPorId.mockResolvedValue({ ...hotelDoc, vertical: 'transporte', comercioId: 'otro-comercio' } as never);
      await expect(
        service.actualizarDisponibilidad('serv-1', 'comercio-1', { unidadesDisponibles: 3 }),
      ).rejects.toThrow(DomainException);
      expect(repo.actualizarCampos).not.toHaveBeenCalled();
    });

    it('debería lanzar 404 si el servicio no existe', async () => {
      repo.obtenerPorId.mockResolvedValue(null);
      await expect(
        service.actualizarDisponibilidad('no-existe', 'comercio-1', { unidadesDisponibles: 3 }),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si no se envía ningún campo válido para el vertical', async () => {
      repo.obtenerPorId.mockResolvedValue({ ...hotelDoc, vertical: 'transporte', comercioId: 'comercio-1' } as never);
      await expect(
        service.actualizarDisponibilidad('serv-1', 'comercio-1', { citasDisponibles: 8 } as never),
      ).rejects.toThrow(DomainException);
      expect(repo.actualizarCampos).not.toHaveBeenCalled();
    });
  });

  describe('crearServicio', () => {
    const base = { titulo: 'Test', descripcion: 'desc', ciudad: 'Madrid', precioBase: 20 };

    it('debería rechazar la creación si no hay comercioId (evita listados huérfanos)', async () => {
      await expect(
        service.crearServicio({ ...base, vertical: 'peluqueria' as never, extra: {} }, ''),
      ).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería filtrar solo los campos del vertical elegido (ignora los ajenos)', async () => {
      repo.crear.mockResolvedValue(hotelDoc as never);

      await service.crearServicio(
        {
          ...base, vertical: 'transporte' as never,
          extra: { tarifaBase: 15, tarifaKm: 0.9, precioConsulta: 999, cuposDisponibles: 5 },
        },
        'comercio-1',
      );

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ extra: { tarifaBase: 15, tarifaKm: 0.9 } }),
      );
    });

    it('debería lanzar 400 si faltan los campos obligatorios de transporte', async () => {
      await expect(
        service.crearServicio({ ...base, vertical: 'transporte' as never, extra: {} }, 'comercio-1'),
      ).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería lanzar 400 si alojamiento no incluye ningún espacio', async () => {
      await expect(
        service.crearServicio({ ...base, vertical: 'alojamiento' as never, extra: { espacios: [] } }, 'comercio-1'),
      ).rejects.toThrow(DomainException);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('debería crear correctamente un servicio de veterinaria con precioConsulta', async () => {
      repo.crear.mockResolvedValue(hotelDoc as never);

      await service.crearServicio(
        { ...base, vertical: 'veterinaria' as never, extra: { precioConsulta: 35, especialidades: ['General'] } },
        'comercio-1',
      );

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ extra: { precioConsulta: 35, especialidades: ['General'] } }),
      );
    });
  });
});
