import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { PerrosService } from '../perros/perros.service';
import { Comercio } from '../comercios/comercio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { ServicioClinicoTipo } from 'shared';

describe('CatalogService', () => {
  let service: CatalogService;
  let repo: jest.Mocked<CatalogRepository>;
  let reviewsService: jest.Mocked<ReviewsService>;
  let perrosService: jest.Mocked<PerrosService>;
  let comercioModel: { find: jest.Mock; findById: jest.Mock };

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
    comercioModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      // Al crear un listado se consulta el estado del comercio para saber si
      // debe ser visible en el buscador (flag `comercioActivo`).
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ estado: 'activo' }),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: CatalogRepository,
          useValue: {
            buscar: jest.fn(), obtenerPorId: jest.fn(), contarTotal: jest.fn(),
            actualizarCampos: jest.fn(), crear: jest.fn(), puntos: jest.fn(),
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
        {
          // Solo se consulta para marcar los comercios adheridos a Alpha (HU-13.3).
          provide: getModelToken(Comercio.name),
          useValue: comercioModel,
        },
      ],
    }).compile();

    service = module.get(CatalogService);
    repo = module.get(CatalogRepository);
    reviewsService = module.get(ReviewsService);
    perrosService = module.get(PerrosService);
  });

  describe('ventajas Alpha en el listado (HU-13.3)', () => {
    it('debería marcar las tarjetas de comercios adheridos', async () => {
      repo.buscar.mockResolvedValue({ items: [hotelDoc] as never, total: 1 });
      comercioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'comercio-1' }]),
      });

      const result = await service.buscarServicios({});

      expect(result.items[0].alphaAdherido).toBe(true);
    });

    it('no debería marcar las tarjetas de comercios no adheridos', async () => {
      repo.buscar.mockResolvedValue({ items: [hotelDoc] as never, total: 1 });

      const result = await service.buscarServicios({});

      expect(result.items[0].alphaAdherido).toBe(false);
    });

    it('no debería consultar comercios si la búsqueda no devuelve nada', async () => {
      repo.buscar.mockResolvedValue({ items: [] as never, total: 0 });

      await service.buscarServicios({});

      expect(comercioModel.find).not.toHaveBeenCalled();
    });
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

    it('debería exponer las coordenadas invertidas respecto a GeoJSON', async () => {
      repo.buscar.mockResolvedValue({
        items: [{ ...hotelDoc, ubicacion: { ciudad: 'Madrid', geo: { coordinates: [-3.7038, 40.4168] } } }] as never,
        total: 1,
      });

      const [card] = (await service.buscarServicios({})).items;

      // Sin esto el mapa pintaría los alojamientos en mitad del océano Índico.
      expect(card.lat).toBe(40.4168);
      expect(card.lng).toBe(-3.7038);
    });

    it('no debería inventar coordenadas para un servicio que no las tiene', async () => {
      repo.buscar.mockResolvedValue({ items: [hotelDoc] as never, total: 1 });

      const [card] = (await service.buscarServicios({})).items;

      expect(card.lat).toBeUndefined();
      expect(card.lng).toBeUndefined();
    });

    it('debería pasar el rectángulo del mapa al repositorio', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });
      const bbox = { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 };

      await service.buscarServicios({ bbox });

      expect(repo.buscar).toHaveBeenCalledWith(expect.objectContaining({ bbox }));
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

  describe('obtenerPuntosMapa', () => {
    it('debería resolver la compatibilidad del perro también para los pines', async () => {
      repo.puntos.mockResolvedValue([]);
      perrosService.obtenerPerfilCompatibilidad.mockResolvedValue({ tamano: 'mini' as never });
      const bbox = { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 };

      await service.obtenerPuntosMapa({ vertical: 'alojamiento', perroId: 'perro-1', bbox });

      // El mapa y la lista deben contar lo mismo: si el filtro por perro solo se
      // aplicara a la lista, aparecerían pines de sitios que no lo admiten.
      expect(repo.puntos).toHaveBeenCalledWith(expect.objectContaining({
        vertical: 'alojamiento', perfilPerro: { tamano: 'mini' }, bbox, soloDisponibles: true,
      }));
    });
  });

  /**
   * El detalle esta lleno de valores por defecto (`??`) porque un comercio puede
   * publicar sin rellenar casi nada. Estos dos casos cubren los dos extremos:
   * ficha minima y ficha completa. Si algun defecto desaparece, el frontend
   * empieza a recibir `undefined` en campos que pinta sin comprobar.
   */
  describe('obtenerServicio — valores por defecto de una ficha minima', () => {
    /** Lo minimo que Mongoose garantiza: ni descripcion, ni horarios, ni espacios. */
    const fichaMinima = {
      _id: 'servicio-1',
      titulo: 'Guarderia',
      vertical: 'alojamiento',
      precioBase: 30,
      comercioId: 'comercio-1',
    };

    beforeEach(() => {
      repo.obtenerPorId.mockResolvedValue(fichaMinima as never);
    });

    it('deberia rellenar los textos vacios en vez de dejar undefined', async () => {
      const detalle = await service.obtenerServicio('servicio-1');

      expect(detalle.descripcion).toBe('');
      expect(detalle.politicaCancelacion).toContain('cancelación');
    });

    it('deberia dar horarios de check-in y check-out por defecto', async () => {
      const detalle = await service.obtenerServicio('servicio-1');

      expect(detalle.checkIn).toBe('12:00');
      expect(detalle.checkOut).toBe('11:00');
    });

    it('deberia exigir vacunas por defecto y no dar por hecha ninguna otra facilidad', async () => {
      // Fallar del lado seguro: mejor pedir la cartilla de mas que de menos.
      const detalle = await service.obtenerServicio('servicio-1');

      expect(detalle.requisitoVacunas).toBe(true);
      expect(detalle.camaras24h).toBe(false);
      expect(detalle.requisitoMicrochip).toBe(false);
      expect(detalle.requiereDesparasitacionInterna).toBe(false);
      expect(detalle.requiereDesparasitacionExterna).toBe(false);
      expect(detalle.requiereVacunaTosPerreras).toBe(false);
    });

    it('deberia devolver listas vacias, nunca undefined', async () => {
      const detalle = await service.obtenerServicio('servicio-1');

      expect(detalle.espacios).toEqual([]);
      expect(detalle.habitaciones).toEqual([]);
      expect(detalle.compatibilidadSocialAdmitida).toEqual([]);
      expect(detalle.serviciosAdicionales).toEqual([]);
    });

    it('deberia devolver comercioId vacio si el listado quedo huerfano', async () => {
      repo.obtenerPorId.mockResolvedValue({ ...fichaMinima, comercioId: undefined } as never);

      const detalle = await service.obtenerServicio('servicio-1');

      expect(detalle.comercioId).toBe('');
    });
  });

  describe('obtenerServicio — normalizacion de espacios a medio rellenar', () => {
    it('deberia completar cada espacio con id, precio y banderas por defecto', async () => {
      // Un espacio creado sin tocar los campos opcionales del formulario.
      repo.obtenerPorId.mockResolvedValue({
        _id: 'servicio-1',
        titulo: 'Guarderia',
        vertical: 'alojamiento',
        precioBase: 30,
        comercioId: 'comercio-1',
        espacios: [{}],
      } as never);

      const [espacio] = (await service.obtenerServicio('servicio-1')).espacios as Record<string, unknown>[];

      expect(espacio['id']).toBe('esp-0');
      expect(espacio['tipo']).toBe('estandar');
      expect(espacio['descripcion']).toBe('');
      expect(espacio['precioNoche']).toBe(30);
      expect(espacio['cantidad']).toBe(1);
      expect(espacio['disponible']).toBe(true);
      expect(espacio['cancelacionGratis']).toBe(true);
      expect(espacio['amenities']).toEqual([]);
      expect(espacio['imagenes']).toEqual([]);
    });

    it('deberia caer a 0 si el listado tampoco tiene precio base', async () => {
      repo.obtenerPorId.mockResolvedValue({
        _id: 'servicio-1', titulo: 'x', vertical: 'alojamiento', comercioId: 'c1', espacios: [{}],
      } as never);

      const [espacio] = (await service.obtenerServicio('servicio-1')).espacios as Record<string, unknown>[];

      expect(espacio['precioNoche']).toBe(0);
    });

    it('deberia respetar el id propio del espacio cuando existe', async () => {
      repo.obtenerPorId.mockResolvedValue({
        _id: 'servicio-1', titulo: 'x', vertical: 'alojamiento', comercioId: 'c1', precioBase: 30,
        espacios: [{ _id: 'mongo-id' }, { id: 'id-propio' }],
      } as never);

      const espacios = (await service.obtenerServicio('servicio-1')).espacios as Record<string, unknown>[];

      expect(espacios[0]['id']).toBe('mongo-id');
      expect(espacios[1]['id']).toBe('id-propio');
    });

    it('deberia proyectar los espacios como habitaciones cuando no hay habitaciones propias', async () => {
      // Shape legacy: hay consumidores que siguen leyendo `habitaciones`.
      repo.obtenerPorId.mockResolvedValue({
        _id: 'servicio-1', titulo: 'x', vertical: 'alojamiento', comercioId: 'c1', precioBase: 30,
        espacios: [{}],
      } as never);

      const [habitacion] = (await service.obtenerServicio('servicio-1')).habitaciones;

      expect(habitacion.tipo).toBe('estandar');
      expect(habitacion.capacidad).toBe(1);
      expect(habitacion.disponible).toBe(true);
      expect(habitacion.cancelacionGratis).toBe(true);
      expect(habitacion.amenities).toEqual([]);
    });

    it('deberia completar una habitacion propia a la que le faltan campos', async () => {
      repo.obtenerPorId.mockResolvedValue({
        _id: 'servicio-1', titulo: 'x', vertical: 'alojamiento', comercioId: 'c1', precioBase: 30,
        habitaciones: [{ tipo: 'Suite', capacidad: 2, precio: 120 }],
      } as never);

      const [habitacion] = (await service.obtenerServicio('servicio-1')).habitaciones;

      expect(habitacion.id).toBe('hab-0');
      expect(habitacion.descripcion).toBe('');
      expect(habitacion.camas).toBe('');
      expect(habitacion.tamano).toBe(0);
      expect(habitacion.disponible).toBe(true);
      expect(habitacion.imagenes).toEqual([]);
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
      // Los espacios se normalizan con id + disponible + arrays por defecto para el flujo de reserva.
      expect(result.espacios).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          tipo: 'suite',
          tamanoMaxPerro: 'grande',
          precioNoche: 45,
          cantidad: 3,
          disponible: true,
          amenities: [],
          imagenes: [],
          cancelacionGratis: true,
        }),
      ]);
    });

    it('debería asignar id, disponible y arrays por defecto a un espacio con datos mínimos', async () => {
      repo.obtenerPorId.mockResolvedValue({
        ...hotelDoc,
        espacios: [{ tipo: 'estandar', precioNoche: 30, cantidad: 1 }],
      } as never);

      const result = await service.obtenerServicio('hotel-1');
      const esp = result.espacios[0] as Record<string, unknown>;

      expect(esp['id']).toBeTruthy();
      expect(esp['disponible']).toBe(true);
      expect(esp['imagenes']).toEqual([]);
      expect(esp['amenities']).toEqual([]);
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
          aspectos: {},
          fotos: [],
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

    describe('catálogo cerrado de servicios veterinarios', () => {
      const conServicios = (servicios: unknown[]) => ({
        ...base,
        vertical: 'veterinaria' as never,
        extra: { precioConsulta: 35, serviciosClinicos: servicios },
      });

      it('debería aceptar los servicios del catálogo', async () => {
        repo.crear.mockResolvedValue(hotelDoc as never);

        await service.crearServicio(
          conServicios([{ tipo: ServicioClinicoTipo.VACUNACION, nombre: 'Vacunación', precio: 25 }]),
          'comercio-1',
        );

        expect(repo.crear).toHaveBeenCalled();
      });

      it('debería rechazar dermatología: Doogking no la intermedia', async () => {
        await expect(
          service.crearServicio(
            conServicios([{ tipo: 'dermatologia', nombre: 'Consulta dermatología', precio: 55 }]),
            'comercio-1',
          ),
        ).rejects.toThrow(DomainException);
        expect(repo.crear).not.toHaveBeenCalled();
      });

      it('debería rechazar cirugía por la misma regla', async () => {
        await expect(
          service.crearServicio(
            conServicios([{ tipo: 'cirugia_menor', nombre: 'Cirugía menor', precio: 320 }]),
            'comercio-1',
          ),
        ).rejects.toThrow(DomainException);
      });

      it('debería rechazar cualquier servicio fuera del catálogo', async () => {
        await expect(
          service.crearServicio(
            conServicios([{ tipo: 'ecografia', nombre: 'Ecografía', precio: 70 }]),
            'comercio-1',
          ),
        ).rejects.toThrow(DomainException);
      });

      it('debería tolerar listados antiguos sin tipo, para no bloquear al comercio', async () => {
        repo.crear.mockResolvedValue(hotelDoc as never);

        await service.crearServicio(
          conServicios([{ nombre: 'Consulta general', precio: 35 }]),
          'comercio-1',
        );

        expect(repo.crear).toHaveBeenCalled();
      });

      it('no debería aplicar la regla a otros verticales', async () => {
        repo.crear.mockResolvedValue(hotelDoc as never);

        await service.crearServicio(
          { ...base, vertical: 'peluqueria' as never, extra: { serviciosClinicos: [{ tipo: 'lo_que_sea' }] } },
          'comercio-1',
        );

        expect(repo.crear).toHaveBeenCalled();
      });
    });
  });
});
